# 教會智能報到系統

北門聖教會使用的智能報到系統，前台以活石條碼 / QR Code 掃描進行報到，後台提供報到紀錄、人員、活動、報名與付款狀態管理。

## 最新主日報到與列印（2026-10-24）

- 主日報到與內嵌列印：http://192.168.16.240:26001/eureka/sunday/
- 獨立列印搜尋：http://192.168.16.240:26001/eureka/sunday/barcodes/
- 標籤 25.4 × 25 mm、QR Code 20 × 20 mm、姓名 2 mm，每次 3 張；使用舊系統 MD5 檢查碼。
- Chrome 專用啟動檔：scripts/start-label-printing.cmd；背景列印後清空搜尋結果。
- 主日功能採 Django 行政平台原生整合；目前非主日測試限制仍開放。

完整現行設定、驗證範圍與部署限制見 [docs/SUNDAY_CHECKIN.md](docs/SUNDAY_CHECKIN.md)。

## 原 PHP 系統內網入口（暫用）

已於 2026-10-22 部署並驗證：

- 前台：http://192.168.16.240:8022/
- 後台：http://192.168.16.240:8033/

Nginx 直接沿用原站 `/home/peterchen/church_checkin` 及 PHP 8.1 FPM。頁面與登入狀態 API 可回應，但活動、牧區 API 回報 MySQL 1045（`peter@localhost` 驗證失敗）；原 HTTPS 站亦有相同錯誤，完整報到功能尚待修復資料庫連線。詳見 [docs/INTRANET.md](docs/INTRANET.md)。

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

