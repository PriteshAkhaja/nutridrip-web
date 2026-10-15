import { getFile } from "@/lib/storage";
import { contentTypeOf, isSafeKey } from "@/lib/media/rules";

/**
 * Serves uploaded photographs from storage (lib/storage), e.g.
 * /media/images/site/home/hero/20261014-153012-a1b2c3.jpg. Public: these are
 * the website's own pictures. Every upload gets a new name, so a file never
 * changes and browsers may keep it for a year.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const key = (await params).path.join("/");
  if (!isSafeKey(key)) return new Response("Not found", { status: 404 });
  const data = await getFile(key);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentTypeOf(key),
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
