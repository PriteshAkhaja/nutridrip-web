import sharp, { type Metadata } from "sharp";
import { randomBytes } from "node:crypto";
import { fileName, needFor, slotFolder, storedSize, uploadProblem } from "@/lib/media/rules";
import { frameOf } from "@/lib/media/slots";
import { putFile } from "@/lib/storage";

export type Processed = { file: string; width: number; height: number; blur: string; bytes: number };

/**
 * Turns an upload into the stored photograph: checked by what the file really
 * is (not its name or the browser's word for it), turned upright from the
 * camera's orientation, flattened onto white if it has transparency, resized
 * to the most any layout needs, saved as a JPEG with its metadata (location
 * included) stripped, plus a 20px preview. Throws an Error whose message is
 * for the admin when the file cannot be used.
 */
export async function processUpload(data: Buffer, slot: string, dripSlug?: string | null): Promise<Processed> {
  let meta: Metadata;
  try {
    meta = await sharp(data).metadata();
  } catch {
    throw new UploadError("This file is not a photograph the site can read. Upload a JPEG, PNG, WebP or AVIF.");
  }
  // EXIF orientations 5–8 swap width and height once turned upright.
  const turned = (meta.orientation ?? 1) >= 5;
  const width = turned ? meta.height : meta.width;
  const height = turned ? meta.width : meta.height;
  const frame = frameOf(slot);
  const problem = uploadProblem(
    { bytes: data.length, format: meta.format, width, height },
    frame ? needFor(frame) : undefined
  );
  if (problem) throw new UploadError(problem);

  const size = storedSize(width!, height!);
  const image = await sharp(data)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: size.width, height: size.height, fit: "fill" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const preview = await sharp(image.data).resize({ width: 20 }).jpeg({ quality: 60 }).toBuffer();

  const file = `${slotFolder(slot, dripSlug)}/${fileName(new Date(), randomBytes(4).toString("hex"))}`;
  await putFile(file, image.data);
  return {
    file,
    width: image.info.width,
    height: image.info.height,
    blur: `data:image/jpeg;base64,${preview.toString("base64")}`,
    bytes: image.data.length,
  };
}

/** A problem with the file itself, shown to the admin as it is. */
export class UploadError extends Error {}
