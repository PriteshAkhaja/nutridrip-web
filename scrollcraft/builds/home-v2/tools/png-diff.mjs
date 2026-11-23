// Ad hoc: bounding boxes of the pixels that differ between two PNGs (same size), in a 40 px grid.
import { chromium } from "playwright-core";
import fs from "fs";
const [A, B] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const p = await (await b.newContext()).newPage();
  const res = await p.evaluate(
    async ([a, c]) => {
      const load = (s) =>
        new Promise((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = "data:image/png;base64," + s;
        });
      const [ia, ib] = await Promise.all([load(a), load(c)]);
      const px = (i) => {
        const cv = document.createElement("canvas");
        cv.width = i.width;
        cv.height = i.height;
        const x = cv.getContext("2d");
        x.drawImage(i, 0, 0);
        return x.getImageData(0, 0, i.width, i.height).data;
      };
      const da = px(ia);
      const db = px(ib);
      const W = ia.width;
      const cells = new Map();
      let n = 0;
      for (let k = 0; k < da.length; k += 4) {
        const d = Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]);
        if (d > 24) {
          n++;
          const x = (k / 4) % W;
          const y = Math.floor(k / 4 / W);
          const key = `${Math.floor(x / 40) * 40},${Math.floor(y / 40) * 40}`;
          cells.set(key, (cells.get(key) ?? 0) + 1);
        }
      }
      return { n, cells: [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25) };
    },
    [fs.readFileSync(A).toString("base64"), fs.readFileSync(B).toString("base64")]
  );
  console.log(JSON.stringify(res));
} finally {
  await b.close();
}
