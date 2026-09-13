import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

// Render every export from the native, editable SVG master.
const base = new URL("../client/public/", import.meta.url);
const source = await readFile(new URL("brand/wjh-symbol.svg", base), "utf8");
const shapes = source.slice(
  source.indexOf(">") + 1,
  source.lastIndexOf("</svg>")
);
const icon = (maskable = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" ${maskable ? "" : 'rx="112"'} fill="#F5F2EE"/><g transform="${maskable ? "translate(120 128.5) scale(.85)" : "translate(96 106)"}">${shapes}</g></svg>`;
await writeFile(new URL("icons/wjh-app-icon.svg", base), icon());
for (const size of [180, 192, 512]) {
  await sharp(Buffer.from(icon()))
    .resize(size, size)
    .png()
    .toFile(new URL(`icons/wjh-${size}.png`, base).pathname);
}
await sharp(Buffer.from(icon(true)))
  .resize(512, 512)
  .png()
  .toFile(new URL("icons/wjh-maskable-512.png", base).pathname);
await sharp(Buffer.from(source))
  .resize(1280, 1200)
  .png()
  .toFile(new URL("brand/wjh-symbol.png", base).pathname);
await sharp(Buffer.from(icon()))
  .resize(1024, 1024)
  .png()
  .toFile(new URL("../assets/icon-only.png", import.meta.url).pathname);
console.log("Generated وجهة icons and transparent symbol from the SVG master.");

const fontfile = new URL(
  "../client/public/brand/fonts/IBMPlexSansArabic-Bold.ttf",
  import.meta.url
).pathname;
const fontData = (await readFile(fontfile)).toString("base64");
const fontStyle = `<style>@font-face{font-family:"IBM Plex Sans Arabic";src:url(data:font/ttf;base64,${fontData})}text.arabic{font-family:"IBM Plex Sans Arabic",sans-serif;font-weight:700}</style>`;
const socialBase = `<rect width="1200" height="630" fill="#F5F2EE"/><circle cx="260" cy="315" r="245" fill="#E9EDE4"/><g transform="translate(100 155)">${shapes}</g><text x="1090" y="455" text-anchor="end" font-family="Arial, sans-serif" font-size="28" fill="#62635F">wjh.ralmatham.ai</text><path d="M620 510h150" stroke="#1E3A8A" stroke-width="10"/><path d="M780 510h120" stroke="#7A2E5C" stroke-width="10"/><path d="M910 510h100" stroke="#A6B69A" stroke-width="10"/><path d="M1020 510h70" stroke="#F6B801" stroke-width="10"/>`;
const svg = content =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${content}</svg>`;
const socialText = `<g text-anchor="end"><text class="arabic" x="1090" y="255" font-size="112" fill="#1F2328">وجهة</text><text class="arabic" x="1090" y="365" font-size="54" fill="#1E3A8A">لكل طموح، وجهة</text></g>`;
await writeFile(
  new URL("brand/wjh-social.svg", base),
  svg(fontStyle + socialBase + socialText)
);
const render = source =>
  new Resvg(source, {
    font: {
      fontFiles: [fontfile],
      loadSystemFonts: false,
      defaultFontFamily: "IBM Plex Sans Arabic",
    },
  })
    .render()
    .asPng();
await writeFile(
  new URL("brand/wjh-social.png", base),
  render(svg(fontStyle + socialBase + socialText))
);
const lockup = `<svg xmlns="http://www.w3.org/2000/svg" width="950" height="340" viewBox="0 0 950 340">${fontStyle}<g transform="translate(610 20)">${shapes}</g><text class="arabic" text-anchor="end" x="550" y="235" font-size="240" fill="#1F2328">وجهة</text></svg>`;
await writeFile(new URL("brand/wjh-logo.svg", base), lockup);
await writeFile(new URL("brand/wjh-logo.png", base), render(lockup));
