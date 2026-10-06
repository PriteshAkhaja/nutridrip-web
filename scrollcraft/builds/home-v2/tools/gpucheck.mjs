// Which WebGL renderer does headless Chrome get on this machine?
import { chromium } from "playwright-core";
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--headless=new", "--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"],
});
const p = await b.newPage();
const info = await p.evaluate(() => {
  const c = document.createElement("canvas");
  const gl = c.getContext("webgl2");
  if (!gl) return "no webgl2";
  const d = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    float: !!gl.getExtension("EXT_color_buffer_float"),
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  };
});
console.log(info);
await b.close();
