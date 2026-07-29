# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **給接手的 agent**：開工前請先看 [`handoff.md`](./handoff.md)，裡面記錄目前主線工作進度與下一步該做什麼（不限 Claude Code，其他工具/agent 接手也請先看這份）。

## 專案簡介

**後中醫生物學線上測驗平台** — 供後中醫考試學生進行生物學單元測驗與模擬考，支援即時題目解析、個人作答紀錄追蹤。老師可上傳 .docx 題庫卷自動匯入題目。

## 常用指令

```bash
npm install          # 安裝相依套件
npm run dev          # 啟動本機開發伺服器（預設 http://localhost:5173）
npm run build        # 打包正式版（輸出至 dist/）
npm run preview      # 本機預覽打包結果
```

> 沒有測試框架，目前以手動瀏覽器測試為主。

## 環境變數設定

複製 `.env.example` 為 `.env.local`，填入 Firebase 專案設定值（全部以 `VITE_FIREBASE_` 開頭）。  
Firebase 金鑰透過 GitHub Secrets 注入 CI/CD，不可寫入程式碼。

## 架構說明

### 技術棧
- **前端**：React 18 + Vite + Tailwind CSS
- **路由**：React Router v6（`BrowserRouter`，basename = `/bio-exam-platform`）
- **後端/資料庫**：Firebase（Firestore + Auth + Storage），無獨立後端伺服器
- **部署**：GitHub Pages（`main` branch push 自動觸發 `.github/workflows/deploy.yml`）

### Firebase Firestore 資料結構

```
units/{unitId}
  name, exam_ratio（歷年考試各單元出題比率）

questions/{questionId}
  unit, sources[], question_en, question_zh,
  options{A,B,C,D}, answer, explanations{A,B,C,D}, memory_tips

student_records/{studentId}/answers/{questionId}
  attempt_count, correct_count, wrong_count, last_answered
```

### 單元清單與歷年出題比率

`src/utils/units.js` 是全站的單元資料唯一來源，包含：
- **UNITS**：9 個單元、38 章完整清單，每個 unit 含 `exam_ratio`（112年7校綜合比率）
- **UNIT_MAP**：`{ unitId → unit }` 快速查找表
- **SCHOOL_RATIOS**：各校（中國、慈濟、義守、高醫、清華、中興、中山）歷年各單元出題比率，供模擬考「依目標學校比率」功能使用

| Unit | 中文 | 章節 | 綜合比率 |
|------|------|------|---------|
| Unit 1 | 細胞生物學 | Ch1–3 | 10% |
| Unit 2 | 動物構造和功能 | Ch4–14 | 21% |
| Unit 3 | 巨分子及生物化學 | Ch15–16 | 8% |
| Unit 4 | 分子生物學 | Ch17–23 | 17% |
| Unit 5 | DNA生物科技 | Ch24–25 | 4% |
| Unit 6 | 微生物免疫學 | Ch26–27 | 14% |
| Unit 7 | 植物生物學 | Ch28–30 | 8% |
| Unit 8 | 演化學 | Ch31–34 | 11% |
| Unit 9 | 生態學 | Ch35–38 | 7% |

### 頁面路由對應

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/` | HomePage | 選擇單元測驗或模擬考入口 |
| `/login` | LoginPage | Google OAuth 登入 |
| `/exam?mode=unit&units=unit1` | ExamPage | 作答介面 |
| `/result` | ResultPage | 批改結果與逐題解析 |
| `/record` | RecordPage | 學生個人學習紀錄 |
| `/admin` | AdminPage | 老師後台（上傳題庫、查看報告） |

### 測驗模式邏輯

- **單元測驗**：URL param `mode=unit`，`units=unit1,unit2,...`（可複選）
- **模擬考**：URL param `mode=mock`，從 `units` collection 讀取 `exam_ratio` 按比率抽題，或由學生自訂比率

### 題庫匯入流程（AdminPage 待實作）

1. 老師上傳 `.docx` → 存入 Firebase Storage
2. 解析函式讀取 docx（`python-docx` 或 Cloud Function），依以下格式抽取每題：
   - 題號、來源考試（如 `111中國後中`）、頁碼
   - 英文題目 / 中文翻譯
   - 選項 A~D（英中對照）
   - 正確答案、各選項解說、記憶口訣
3. 寫入 Firestore `questions` collection，`needs_review: true` 標記解析失敗的題目

### vite.config.js 注意事項

`base` 設定為 `/bio-exam-platform/`，對應 GitHub Pages repo 名稱。若 repo 名稱變更，需同步修改 `vite.config.js` 的 `base` 與 `src/main.jsx` 的 `BrowserRouter basename`。

## 主題色（Tailwind 自訂）

| 變數 | 色碼 | 用途 |
|------|------|------|
| `primary` | `#2E7D32` | 深綠，主要按鈕、Navbar |
| `secondary` | `#1565C0` | 深藍，模擬考相關 |
| `accent` | `#F57F17` | 橘黃，重點提示 |
