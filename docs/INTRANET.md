# 內網部署進度

更新日期：2026-10-22

## 已完成

- 前台：http://192.168.16.240:8022/
- 後台：http://192.168.16.240:8033/
- Nginx 設定檢查通過並已 reload，兩個 port 均確認 LISTEN。
- 前後台首頁、後台 login.html 回應 HTTP 200，頁面標題符合報到系統。
- 登入狀態 API 正常回傳未登入。
- SSH 金鑰登入已驗證；私鑰及密碼未納入 repository。

## 部署方式

直接沿用原站 `/home/peterchen/church_checkin` 與 PHP 8.1 FPM socket `/var/run/php/php8.1-fpm.sock`，未搬移資料或變更原 8002 服務。

設定檔為 `/etc/nginx/sites-available/checkin-intranet-8022-8033.conf`，並以同名 symlink 於 sites-enabled 啟用。版本化設定見 `deploy/nginx/checkin-intranet.conf.example`，初次部署腳本見 `deploy/install-intranet.sh`。腳本遇到既有同名設定會停止，避免覆蓋。

## 尚未解決：資料庫連線

活動及牧區 API 回應 HTTP 200，但 JSON 為 `success:false`，回報 MySQL 1045：`peter@localhost` 驗證失敗。原 HTTPS 站活動 API 亦有相同錯誤；不能僅以 HTTP 200 判定功能正常。

待確認伺服器 `api/db_config.php` 的資料庫連線設定及 MySQL 帳號授權。修復後需驗證活動、牧區、後台登入及實際報到寫入。目前尚未驗證後台帳密登入或報到寫入，完整功能尚未恢復。

## 使用限制與待辦

- HTTP 內網 IP 的攝影機掃碼受瀏覽器安全限制；需攝影機時應配置受信任 HTTPS。
- 前後台 port 僅指定不同預設頁，未實作存取隔離；兩者共享原站登入 Cookie 與資料。
- 頁面仍使用外部 CDN，需可存取相關外部服務。
- 原網域 DNS 查詢回報名稱不存在；新 IP:port 入口不依賴該 DNS。
- Nginx 既有其他站台的重複 server_name 警告未阻止本次部署，尚未處理。
- 後端 PHP、login.html 及資料庫 schema 尚未納入本 repository，不能只靠此 repository 重建完整服務。
