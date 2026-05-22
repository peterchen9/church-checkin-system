# 專案盤點

## 來源

本次整理從線上站台下載公開前端檔案：

- `https://checkin.nghcc.org.tw/index.html`
- `https://checkin.nghcc.org.tw/admin.html`
- `https://checkin.nghcc.org.tw/contact_form.html`
- `https://checkin.nghcc.org.tw/app.js`
- `https://checkin.nghcc.org.tw/admin.js`
- `https://checkin.nghcc.org.tw/style.css`
- `https://checkin.nghcc.org.tw/style_admin.css`

## 功能模組

- 前台報到：掃描 QR Code / 活石條碼、手動搜尋、成功與失敗提示
- 聚會模式：主日聚會、成主課程、牧區小組聚會、同工打卡、特別聚會
- 後台管理：登入檢查、報到紀錄、活動、報名、付款、人員、同工與聯絡人搜尋
- 聯絡人表單：新增 / 編輯資料、照片上傳 / 貼上

## 已知風險

- 後端 PHP 原始碼尚未納管，無法完整重建部署環境。
- 前端有硬編碼 PIN，後續建議移到後端驗證或環境設定。
- CDN 依賴若外部服務異常，掃描、匯出或 QR Code 產生可能受影響。
- 目前沒有自動化測試與資料庫 schema。

## 下一步

1. 從 192.168.16.240 取回後端 `api/`、資料庫 schema 與部署設定。
2. 移除或遮蔽任何敏感資訊後提交。
3. 補上部署流程與基本 API 測試。
