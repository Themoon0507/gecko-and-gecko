import { copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(projectRoot, "content", "series");
const sourceRoot = path.join(projectRoot, "src");
const publicRoot = path.join(projectRoot, "public");
const outputRoot = path.join(projectRoot, "dist");

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const unquote = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

function parseFrontmatter(source, filename) {
  if (!source.startsWith("---\n")) {
    throw new Error(`${filename} 缺少開頭的 YAML frontmatter`);
  }

  const end = source.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error(`${filename} 的 YAML frontmatter 沒有結束標記`);
  }

  const rawMeta = source.slice(4, end).split(/\r?\n/);
  const body = source.slice(end + 4).trim();
  const meta = {};

  for (const line of rawMeta) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      throw new Error(`${filename} 的欄位格式錯誤：${line}`);
    }

    const key = trimmed.slice(0, colonIndex).trim();
    const rawValue = unquote(trimmed.slice(colonIndex + 1));

    if (rawValue === "true" || rawValue === "false") {
      meta[key] = rawValue === "true";
    } else if (key === "tags") {
      meta[key] = rawValue
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(",")
        .map((item) => unquote(item))
        .filter(Boolean);
    } else {
      meta[key] = rawValue;
    }
  }

  return { meta, body };
}

function sanitizeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(https?:\/\/|\/|#)/i.test(url)) return url;
  return "";
}

function imageKitUrl(value, width, config) {
  const url = sanitizeUrl(value);
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const endpoint = String(config.imageKitEndpoint || "").replace(/\/$/, "");
  if (!endpoint || endpoint.includes("YOUR_IMAGEKIT_ID")) return "";
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${endpoint}/tr:w-${width}${cleanPath}`;
}

function inlineMarkdown(value) {
  let output = escapeHtml(value);
  const codeTokens = [];

  output = output.replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  output = output
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const safeHref = sanitizeUrl(href);
      return safeHref
        ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${label}</a>`
        : label;
    });

  codeTokens.forEach((code, index) => {
    output = output.replace(`@@CODE_${index}@@`, code);
  });

  return output;
}

function markdownToHtml(markdown, config) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let paragraph = [];
  let listItems = [];
  let photoCount = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    output.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const photo = line.match(/^!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)$/);

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (photo) {
      flushParagraph();
      flushList();
      photoCount += 1;
      const [, alt, rawUrl, caption] = photo;
      const src = imageKitUrl(rawUrl, 1800, config);

      if (src) {
        output.push(
          `<figure class="story-photo"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`,
        );
      } else {
        output.push(
          `<figure class="story-photo story-photo--placeholder"><div class="photo-placeholder"><span>照片位置</span><code>${escapeHtml(rawUrl)}</code></div>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`,
        );
      }
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length + 1;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2));
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return { html: output.join("\n"), photoCount };
}

async function loadSeries(config) {
  const entries = await readdir(contentRoot, { withFileTypes: true });
  const petIds = new Set(config.pets.map((pet) => pet.id));
  const items = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const filename = path.join(contentRoot, entry.name);
    const source = await readFile(filename, "utf8");
    const { meta, body } = parseFrontmatter(source, entry.name);

    for (const required of ["title", "date", "pet", "summary"]) {
      if (!meta[required]) throw new Error(`${entry.name} 缺少 ${required} 欄位`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
      throw new Error(`${entry.name} 的 date 必須是 YYYY-MM-DD`);
    }

    if (!petIds.has(meta.pet)) {
      throw new Error(`${entry.name} 的 pet 必須是 ${[...petIds].join(" 或 ")}`);
    }

    if (meta.published === false) continue;

    const rendered = markdownToHtml(body, config);
    items.push({
      slug: entry.name.replace(/\.md$/i, ""),
      title: meta.title,
      date: meta.date,
      pet: meta.pet,
      summary: meta.summary,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      sample: meta.sample === true,
      coverSrc: imageKitUrl(meta.cover, 1100, config),
      coverPath: meta.cover || "",
      bodyHtml: rendered.html,
      photoCount: rendered.photoCount,
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function build() {
  const config = JSON.parse(await readFile(path.join(projectRoot, "site.config.json"), "utf8"));
  const series = await loadSeries(config);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  await Promise.all([
    copyFile(path.join(sourceRoot, "index.html"), path.join(outputRoot, "index.html")),
    copyFile(path.join(sourceRoot, "styles.css"), path.join(outputRoot, "styles.css")),
    copyFile(path.join(sourceRoot, "app.js"), path.join(outputRoot, "app.js")),
  ]);

  if (await pathExists(publicRoot)) {
    await cp(publicRoot, outputRoot, { recursive: true });
  }

  const payload = JSON.stringify({ config, series }).replaceAll("<", "\\u003c");
  await writeFile(path.join(outputRoot, "series-data.js"), `window.GECKO_SITE_DATA = ${payload};\n`);
  await copyFile(path.join(outputRoot, "index.html"), path.join(outputRoot, "404.html"));
  await writeFile(path.join(outputRoot, ".nojekyll"), "");

  console.log(`Gecko and Gecko：已建立 ${series.length} 個公開照片系列 → dist/`);
}

await build();
