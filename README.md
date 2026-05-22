# 教會智能報到系統

北門聖教會使用的智能報到系統，前台以活石條碼 / QR Code 掃描進行報到，後台提供報到紀錄、人員、活動、報名與付款狀態管理。

## 線上入口

- 前台：https://checkin.nghcc.org.tw/index.html
- 後台：https://checkin.nghcc.org.tw/admin.html

## 目前整理狀態

此資料夾已從線上站台整理出目前可公開取得的前端檔案：

- `index.html`：前台報到入口
- `app.js`：前台掃描、手動搜尋、報到流程
- `style.css`：前台樣式
- `admin.html`：後台管理入口
- `admin.js`：後台管理互動與 API 呼叫
- `style_admin.css`：後台樣式
- `contact_form.html`：新增 / 編輯人員資料表單

後端 PHP 原始碼目前尚未放入本機專案，前端呼叫的 API 請見 [docs/API.md](docs/API.md)。

## 外部前端依賴

目前頁面直接透過 CDN 載入：

- Noto Sans TC：Google Fonts
- html5-qrcode：前台 QR Code 掃描
- qrcodejs：後台 QR Code 產生
- SheetJS xlsx：後台匯出 Excel
- Pixabay 音效：前台成功 / 失敗提示音

## 本機檢視

這是靜態前端搭配 PHP API 的專案。前端可直接用瀏覽器開啟 HTML 檔預覽畫面，但完整報到功能需要部署在含 `api/` 後端的 Web Server 上。

## GitHub 管理建議

1. 在 GitHub 建立 repository，例如 `church-checkin-system`。
2. 將 GitHub App 授權到該 repository。
3. 本機安裝 Git，或提供可用的 Git 執行環境。
4. 初始化 repo、提交目前整理成果並設定 remote。

詳細步驟請見 [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md)。

