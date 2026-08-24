# Gecko and Gecko

呱呱與呱妹的公開照片網站。內容在 Obsidian 以 Markdown 管理，照片由 ImageKit 提供，推送至 GitHub 後由 GitHub Pages 自動發布。

網站已包含：

- 薰衣草紫與白色的磨砂玻璃介面
- 呱呱／呱妹標籤篩選
- 開始日期與結束日期檢索
- 依年份、日期排序的照片時間軸
- 照片系列內文、照片替代文字與照片說明
- 點擊內文照片全螢幕放大
- 手機、鍵盤操作與減少動態效果支援
- GitHub Pages 自動發布流程

專案不使用前端框架或外部套件，執行建置時不需要 `npm install`。

## 第一次設定

### 1. 填入 ImageKit Endpoint

開啟 `site.config.json`，把：

```json
"imageKitEndpoint": "https://ik.imagekit.io/YOUR_IMAGEKIT_ID"
```

換成 ImageKit Dashboard 顯示的公開 URL Endpoint，例如：

```json
"imageKitEndpoint": "https://ik.imagekit.io/abc123"
```

只填公開 Endpoint。不要把 ImageKit Private API Key、密碼或其他密鑰放進這個專案。

建議在 ImageKit 建立以下資料夾：

```text
/geckos/
  /guagua/
  /guamei/
```

每個系列再使用獨立資料夾，例如：

```text
/geckos/guagua/2026-08-sunbath/cover.jpg
/geckos/guagua/2026-08-sunbath/photo-01.jpg
/geckos/guagua/2026-08-sunbath/photo-02.jpg
```

網站會自動為首頁封面要求 1100px 版本，為內文照片要求 1800px 版本；Markdown 只需要儲存 ImageKit 中的檔案路徑。

### 2. 將專案開成 Obsidian Vault

在 Obsidian 選擇「Open folder as vault」，開啟整個 `gecko-and-gecko` 資料夾。

接著到：

```text
Settings → Core plugins → Templates
```

將 Template folder location 設成：

```text
templates
```

網站內容放在：

```text
content/series/
```

`.obsidian/` 已被 Git 忽略，不會把你的個人 Obsidian 工作區設定發布到 GitHub。

## 建立一個照片系列

複製 `templates/series-template.md`，存入 `content/series/`。建議檔名使用：

```text
YYYY-MM-DD-英文系列名稱.md
```

例如：

```text
2026-08-23-guagua-sunbath.md
```

系列檔案的開頭：

```yaml
---
title: 午後曬太陽
date: 2026-08-23
pet: guagua
cover: /geckos/guagua/2026-08-sunbath/cover.jpg
summary: 呱呱在窗邊找到一個舒服的位置。
tags: 日常, 曬太陽
published: true
---
```

欄位說明：

| 欄位 | 寫法 | 用途 |
|---|---|---|
| `title` | 任意文字 | 系列名稱 |
| `date` | `YYYY-MM-DD` | 排序與時間區間檢索 |
| `pet` | `guagua` 或 `guamei` | 守宮篩選 |
| `cover` | ImageKit 路徑 | 首頁系列封面 |
| `summary` | 一至兩句 | 首頁摘要 |
| `tags` | 逗號分隔 | 額外標籤 |
| `published` | `true`／`false` | 是否公開顯示 |

內文使用一般 Markdown：

```md
這天的光線很柔和，呱呱在窗邊停留了很久。

## 照片

![呱呱趴在木頭上](/geckos/guagua/2026-08-sunbath/photo-01.jpg "剛找到最喜歡的位置。")

![呱呱抬頭看向窗外](/geckos/guagua/2026-08-sunbath/photo-02.jpg "窗外傳來了一點聲音。")
```

圖片語法中的三部分：

```text
![照片替代文字](ImageKit 路徑 "顯示在照片下方的說明")
```

替代文字應描述照片內容，照片說明則可以寫當下的故事。

如果仍在編輯，把 `published` 設成 `false`；GitHub 建置時就不會發布該系列。

## 在 VS Code 預覽

於專案根目錄執行：

```bash
npm run dev
```

開啟：

```text
http://localhost:4321
```

在 Obsidian 儲存系列後，網站會自動重新建置；重新整理瀏覽器即可看到結果。

如果只需要建立正式檔案：

```bash
npm run build
```

網站會輸出至 `dist/`。

## 發布至 GitHub Pages

在 GitHub 建立名為 `gecko-and-gecko` 的 repository，然後於專案根目錄執行：

```bash
git init
git add .
git commit -m "Create Gecko and Gecko"
git branch -M main
git remote add origin https://github.com/你的帳號/gecko-and-gecko.git
git push -u origin main
```

接著在 GitHub repository：

1. 開啟 `Settings`。
2. 選擇 `Pages`。
3. 在 `Build and deployment` 將 Source 設成 `GitHub Actions`。
4. 等待 `Actions` 頁面的 Deploy Gecko and Gecko 完成。

網站網址會是：

```text
https://你的帳號.github.io/gecko-and-gecko/
```

日後只需要：

```bash
git add .
git commit -m "Add new photo series"
git push
```

GitHub Pages 就會自動重新建置。

## 目前的範例內容

`content/series/` 內附有呱呱和呱妹各一篇範例。設定好 ImageKit 後，可以直接修改它們，或刪除並從範本建立自己的系列。

如果更改 `site.config.json` 的守宮 ID，也必須同步修改所有系列檔案的 `pet` 欄位。
