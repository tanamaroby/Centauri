// Copies the pdf.js worker into /public so it is served from our own origin.
import { copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
await copyFile(src, new URL("../public/pdf.worker.min.mjs", import.meta.url));
