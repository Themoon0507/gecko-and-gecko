import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "dist");
const watchTargets = ["src", "content", "public", "site.config.json"].map((item) =>
  path.join(projectRoot, item),
);
const port = Number(process.env.PORT || 4321);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function newestModified(target) {
  const info = await stat(target);
  if (!info.isDirectory()) return info.mtimeMs;
  const entries = await readdir(target);
  const children = await Promise.all(entries.map((entry) => newestModified(path.join(target, entry))));
  return Math.max(info.mtimeMs, ...children);
}

async function projectModified() {
  const times = await Promise.all(watchTargets.map((target) => newestModified(target)));
  return Math.max(...times);
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/build.mjs"], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("建置失敗"))));
  });
}

await runBuild();
let lastModified = await projectModified();
let building = false;

setInterval(async () => {
  if (building) return;
  try {
    const current = await projectModified();
    if (current <= lastModified) return;
    building = true;
    await runBuild();
    lastModified = current;
    console.log("內容已更新，重新整理瀏覽器即可看到變更。");
  } catch (error) {
    console.error(error.message);
  } finally {
    building = false;
  }
}, 900);

const server = http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const resolved = path.resolve(outputRoot, requested);

  if (resolved !== outputRoot && !resolved.startsWith(`${outputRoot}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const info = await stat(resolved);
    const file = info.isDirectory() ? path.join(resolved, "index.html") : resolved;
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("找不到頁面");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`本機預覽：http://localhost:${port}`);
  console.log("在 Obsidian 儲存內容後，網站會自動重新建置。");
});
