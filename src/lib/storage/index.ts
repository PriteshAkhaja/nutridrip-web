import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { isSafeKey } from "@/lib/media/rules";

/**
 * Where uploaded files live. Today: a folder on the server's own disk,
 * STORAGE_DIR or ./storage beside the app, laid out by what the file is
 * (images/site/<page>/<place>/, images/drips/<slug>/). Not public/: a running
 * server only reliably serves the public files it started with, and uploads
 * must not end up in git or a code zip. Files are served by app/media.
 *
 * Everything goes through these three functions, so moving to S3 later is a
 * second driver here with the same keys, and nothing else changes.
 *
 * The folder holds the client's photographs: back it up with the database.
 */

function root(): string {
  // The folder is chosen at run time, so the build must not try to trace it into the output.
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.STORAGE_DIR?.trim() ||
      path.join(/*turbopackIgnore: true*/ process.cwd(), "storage")
  );
}

function pathOf(key: string): string {
  if (!isSafeKey(key)) throw new Error(`Refused storage key: ${key}`);
  const base = root();
  const full = path.resolve(base, ...key.split("/"));
  // Belt and braces: the key rules already forbid "..".
  if (!full.startsWith(base + path.sep)) throw new Error(`Refused storage key: ${key}`);
  return full;
}

/** Writes the file; a crash mid-write leaves a stray temp file, never a half photo under the real name. */
export async function putFile(key: string, data: Buffer): Promise<void> {
  const full = pathOf(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const tmp = `${full}.${randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, full);
}

/** The file, or null if it is not there (or the key is not one we serve). */
export async function getFile(key: string): Promise<Buffer | null> {
  if (!isSafeKey(key)) return null;
  try {
    return await fs.readFile(pathOf(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Every stored photograph with its size, for the cleanup command. Only real
 * keys (lib/media/rules isSafeKey) are listed; a stray temporary file left by a
 * crash mid-write is not one, and is skipped.
 */
export async function listFiles(): Promise<Array<{ key: string; bytes: number }>> {
  const base = root();
  const out: Array<{ key: string; bytes: number }> = [];
  const walk = async (dir: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) {
        const key = path.relative(base, full).split(path.sep).join("/");
        if (isSafeKey(key)) out.push({ key, bytes: (await fs.stat(full)).size });
      }
    }
  };
  await walk(path.join(base, "images"));
  return out;
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await fs.unlink(pathOf(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
