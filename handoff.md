# Handoff Notes

給接手這個專案的下一位 agent（無論是 Claude Code 或其他工具，如 ChatGPT app）看的交接文件。
先看 `CLAUDE.md` 了解整體專案架構，再看這份文件了解「現在進度到哪、接下來要做什麼」。

## 專案是什麼

後中醫生物學線上測驗平台（React + Vite + Firebase）。詳細架構、路由、Firestore 結構都寫在 `CLAUDE.md`，不重複列。

## 目前主線工作：`src/utils/parseDocx.js` 格式相容性

老師會上傳各單元的 `.docx` 題庫卷，`parseDocxQuestions()`（`src/utils/parseDocx.js`）負責把 docx 純文字解析成題目物件，供 `src/pages/AdminPage.jsx` 的上傳預覽流程使用。

每一份題庫檔案（代號如 C28、C31、C34...）的排版都是老師手動整理的 Word 檔，**格式不完全一致**——題號前綴、英文/中文題目區塊標記、選項符號等常有變體。目前的策略是「遇到解析失敗 → 看實際內容 → 加一個新的格式分支」，近期 commit 都是這個模式：

```
c99c0de fix: parseDocx 支援 [Q]/[EN]/[ZH] 方括號前綴區塊標記（C34 等格式）
59a0e85 fix: parseDocx 支援「溫古/溫故 題目 N」前綴格式（C31 等溫故題）
94c5945 fix: parseDocx 支援 Question/English 純英文區塊標記（C28 等格式）
f7cf062 fix: parseDocx 支援 emoji 題目 格式（中文題 emoji 被解析為文字）
d198d3d fix: parseDocx 支援 emoji 被解析為文字的 docx 格式
0f635a6 fix: parseDocx 支援中文字元前綴題號（題目 溫12 等格式）
3f43095 fix: parseDocx 支援任意字母前綴題號（Q197、G85 等格式）
```

### 現況

- 沒有已知的 bug list 或 TODO——每次都是「有一份新題庫上傳後解析失敗」才動手修。
- Repo 裡目前**沒有任何 `.docx` 樣本檔案**可供測試，也**沒有自動化測試框架**（`CLAUDE.md` 已註明：手動瀏覽器測試為主）。
- 上次對話中使用者提到「接下來會有別的 agent 接手」，但還沒給出具體要修的失敗案例。

### 接手時該怎麼做

1. **先跟使用者要實際失敗案例**：不要憑空猜測還有哪些格式沒吃到，猜錯只會加沒必要的分支，違反專案一貫做法（見上方 commit 歷史，每次都是對症下藥）。跟使用者要：
   - 上傳後 `needs_review` 過多、或解析直接失敗的 `.docx` 檔案路徑，或
   - 直接貼上那幾題解析失敗的原始文字（從 Word 複製出來的樣子）。
2. **定位問題**：`parseDocxQuestions()` 先用正規表示式抓「題目起始行」（`questionStarts`，`parseDocx.js:112-116`），再逐題丟進 `parseSingleQuestion()` 找英文題區塊（`enStart`）、中文題區塊（`zhStart`）、詳細解說（`detailStart`）、記憶口訣（`memStart`）等標記位置（`parseDocx.js:150-171`）。大部分新格式的修法都是在這幾個標記判斷式裡加一個 `||` 分支。
3. **驗證方式**：目前無測試框架，改完後要透過 `npm run dev` 開 AdminPage 上傳頁面實際上傳題庫檔案，檢查解析出的題目、`needs_review` 標記是否正確。
4. **未提交變更**：`.claude/launch.json` 目前有未提交的修改（幫 Vite Dev Server / Preview 設定加上 `cwd`），是環境設定調整，跟 parseDocx 無關，先不要動它，除非使用者要求。

## 其他待辦

目前沒有其他已知待辦事項。如果使用者提出新任務，直接處理即可，不需要照本文件的框架硬套。
