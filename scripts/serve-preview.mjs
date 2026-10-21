import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".json": "application/json",
};
createServer(async (req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const file = resolve(root, "." + pathname);
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.setHeader("Content-Type", "text/html");
    res.end(await readFile(resolve(root, "index.html")));
  }
}).listen(4173, "127.0.0.1", () =>
  console.log("Ghost preview: http://127.0.0.1:4173"),
);
