# 行政平台與報到系統備份及版本記錄：2026-11-07

時區：Asia/Taipei。SQL 與程式快照自 2026-11-07 15:33 建立；使用者於同日明確縮小範圍為兩套系統程式、資料庫、設定與會員照片。NAS 自有備份規則，NAS 檔案內容排除。

## 最終備份範圍

- 行政平台程式根目錄、必要資源與環境設定。
- 報到 PHP 網站、後端 API、獨立 Django 服務及容器實際程式。
- 共用 MySQL 邏輯備份與帳號還原所需資料；正式 nads26db 全部 127 個資料表為 InnoDB。
- 會員照片 media/eureka/photo，以及存在時的 media/eureka/photo_history；照片由最初已完成的媒體快照選出，原始資料夾盤點約 3.9 GiB。
- Docker 執行映像、容器／網路設定、Nginx／PHP／TLS、NAS 掛載設定與憑證、系統排程。
- 程式版本、原始檔指紋、Git 歷史備份與驗證紀錄。

不封裝 NAS FileCenter，不另外備份整個一般 media，也不將既有大型備份目錄或執行中的 MySQL 實體檔再打包。先前產生的未完成 NAS 封包已由主機與本機移除；原 NAS 資料及既有備份未變動。

## 正式資料位置

主機 gino25，維護連線 172.20.100.240；服務另使用內網 192.168.16.240。

| 用途 | 位置／服務 |
| --- | --- |
| 行政平台 | /home/apps1/nads26；nads26-web，26001:8000 |
| 共用 MySQL | /home/apps1/nads26/mysql_data；nads26db，33069:3306 |
| 報到 PHP 與網頁 | /home/peterchen/church_checkin；主機 Nginx + PHP-FPM |
| 報到獨立服務 | /home/peter/church-checkin-standalone；church-checkin-standalone，127.0.0.1:28022 至 8000 |
| PHP 資料庫設定 | /etc/church-checkin/database.json |
| 獨立服務設定 | /home/peter/church-checkin-standalone/config/settings.json，掛載為 /config/settings.json |
| 共用會員照片 | /home/apps1/nads26/media/eureka/photo；歷史為 media/eureka/photo_history |
| NAS 入口（內容不含於本次備份） | /home/apps1/nads26/media/NADS_FileCenter → //172.20.50.4/NADS_FileCenter |

已實際讀取設定的非敏感欄位確認：PHP 使用 127.0.0.1:33069/nads26db，獨立服務使用 db:3306/nads26db；兩者為同一個 MySQL 容器與資料庫。通訊錄 members、主日報到 sunday_checkins、出席彙整 checkin_records 均含於 SQL。舊照片 photo_base64 亦在資料庫內。

## 今日版本紀錄

- 平台：https://github.com/peterchen9/nghcc-nads26
- 報到：https://github.com/peterchen9/church-checkin-system
- production/2026-11-07 保存正式程式快照、原始來源與 SHA-256；平台本機開發版本與正式來源分開記錄，未為製作紀錄而部署本機變更。
- 報到根目錄前端已更新，補錄 PHP API、獨立服務與容器 /srv/app 實際版本。
- 密碼、.env、私人 JSON、帳號移轉資料、SQL、照片、附件、log 及備份不提交 GitHub。含秘密的工具檔只存在受限備份，login.php 以遮蔽範例記錄，舊 runtime JS PIN 亦以 placeholder 遮蔽；原始可還原內容完整保存在受限備份。
- 發布前使用 Gitleaks 掃描目前檔案與全部可達歷史，另比對正式站已知秘密值。
- 2026-11-07 使用者明確授權清理歷史中的正式密碼雜湊。所有可寫分支已清理，改寫前 bundle 已保存。其他電腦應重新 clone，勿將舊歷史合併推回。

## 備份位置與封包

- 主機實際位置：/var/backups/nghcc-full-20261107/platform-checkin-full-20261107-153313
- 相容連結：/home/peter/backups/platform-checkin-full-20261107-153313
- 本機：D:\backups\nghcc-nads26\platform-checkin-full-20261107-153313

本次主機備份實際放在 /var/backups 下；原 /home/peter/backups 位置保留連結，讓 root 每日 /home 的 rsync -a 保存連結、不再遞迴複製這份新備份。只搬移了新建備份目錄，正式程式與資料目錄未搬動。主機與本機備份目錄均採受限存取權限。

| 封包／目錄 | 保存內容 |
| --- | --- |
| database/all-databases.sql.gz | MySQL 邏輯匯出，含 routines、events、triggers、binary-safe values；本系統 nads26db 為交易一致性快照；另外保留同容器系統帳號與資料庫還原資訊 |
| archives/platform.tar.zst | 平台程式根目錄、設定、必要靜態資源與附屬檔案；排除 media、mysql_data 與 backups，照片另存 |
| archives/checkin.tar.zst | PHP 網站與獨立報到服務主機目錄，含私人設定 |
| archives/checkin-runtime-app.tar.gz | 報到容器實際 /srv/app 程式 |
| archives/member-photos.tar.zst | 會員照片及存在的照片歷史；不含 NAS |
| archives/host-config.tar.zst | Nginx、PHP、church-checkin、cron、fstab 與 TLS 設定 |
| archives/nas-credentials.tar.zst | NAS 掛載所需獨立憑證；僅設定，不含 NAS 文件 |
| archives/system-crontabs.tar.zst | 主機 root 與使用者 crontab 原件 |
| images/runtime-images.tar.zst | 平台、MySQL、報到實際執行映像 |
| config、inventory | 容器與網路設定、版本、排程、套件、封包清單、還原測試與範圍變更紀錄 |
| 本機 Git bundles／workspace ZIP | 改寫前歷史及本機未提交工作原件 |
| records/ | 最後 Git 版本、驗證結果及獨立 RECORD-SHA256SUMS（核驗完成後建立） |

SQL 是交易一致性快照；檔案於備份期間讀取，並非全系統同一瞬間的磁碟快照。NAS 資料的還原依 NAS 本身的備份規則辦理。

## 驗證與還原

主機與本機以 SHA256SUMS 逐檔比對；封包完成 tar／zstd／gzip 讀取檢查，並將正式程式原始指紋與封包內檔案核對。最後完成狀態以 REMOTE-VERIFICATION.txt、LOCAL-VERIFICATION.json 及 records/ 為準。

隔離、無網路、暫存磁碟的 MySQL 實際匯入測試已通過，容器已移除：members 7,987、sunday_checkins 816、checkin_records 108,101，共 127 個 nads26db 資料表。已先驗證平台封包內 412 個原始程式指紋一致；原始擷取共 480 檔亦全數核對。兩套程式共 1,812 個 Python 檔案通過語法檢查，未重新執行全部功能測試。

正式平台、PHP 8022 前台與 8033 後台皆 HTTP 200；獨立服務 /sunday/ 為預期 HTTP 302 登入導向。本次未部署、重啟正式服務、修改正式資料或輪替密碼。

還原須先在隔離環境核對 SHA256SUMS，載入保存的 Docker 映像；若原標籤未自動復原，依 image-inspect／container-inspect 的映像 ID 對應補回標籤。解開程式至原目錄，建立乾淨 MySQL 並匯入 SQL，恢復私人 .env、/etc/church-checkin 與 /config，再將會員照片封包解至平台目錄。恢復 Nginx/PHP/TLS 設定，檢視後由管理者安裝必要排程，另依 NAS 管理方式重新掛載原 FileCenter。啟用服務前核對權限、登入、通訊錄與報到功能；本次沒有執行整機或正式切換還原。

## 既有固定備份排程

| 帳號／時間 | 作業與目的地 | 已確認狀態 |
| --- | --- | --- |
| root 每天 18:00 | rsync -avr --delete /home/ 至 /mnt/usb1t/gino25-home/ | 有排程及既有鏡像；覆寫式同步，不等於每日獨立快照，也不保證執行中 MySQL 實體檔一致性 |
| root 每週日 05:00 | sh /home/apps1/nads26/scripts/backup.sh 至 /mnt/usb1t/nads26/latest/、nads-bkYYYYMM.tar.gz | 有排程；latest SQL 最後修改 2026-11-01 05:00，16,849,872 bytes；當月同名封包可能覆寫 |
| peter 每天 02:00 | /home/apps1/nads26/scripts/backup.sh | 2026-11-01～11-07 該帳號紀錄顯示目的地無法寫入 |

上述 /mnt/usb1t 目的地目前都在主機系統磁碟 /dev/sda2，沒有獨立 USB 掛載。/home 鏡像未涵蓋 /etc 下連線與 TLS 等設定。原始 crontab 已保存；先前只查 peter 排程的結論不完整，以本節為準。本次未修改既有排程，亦未宣稱 root 排程最近整批執行已驗證成功。

## GitHub 保留參照限制

重新下載遠端核對後，GitHub 管理的 refs/pull/1/head、refs/pull/2/head 仍可到達舊密碼雜湊物件。一般 push 無法改寫這些唯讀參照，徹底清除須向 GitHub Support 申請；實際處理由 GitHub 評估。申請草稿已保存於受限備份，未送出，未變更或關閉 PR。

依據：[GitHub 官方敏感資料移除說明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)。
<!-- FULL_BACKUP_VERIFIED_RESULT -->
## 本次完整備份完成結果

- 本機完整核驗完成：2026-11-07T17:25:29（Asia/Taipei）。
- 主機與本機主備份清單共 79 個檔案，總計 5,082,228,867 bytes（4.733 GiB），SHA-256 全部一致。
- 所有資料封包與 Docker 映像封包均完成讀取檢查；SQL gzip 與完成標記正常，隔離 MySQL 還原測試成功。
- 原始程式快照與備份封包來源核對：504 個檔案一致，無缺漏或指紋差異。
- 主備份 SHA256SUMS 清單指紋：`e6020c679bd1ecff2a008f2a6aac6c81282fd886a8ddb692fe138b25adea31f0`。
- 原始本機工作、原始程式擷取、改寫前 Git 歷史均保存在受限備份；最後 Git 紀錄與驗證結果另存兩端 records/，以 RECORD-SHA256SUMS 核對。
- 本次沒有修改既有每日備份排程、正式資料、密碼或服務。既有排程異常與 GitHub 舊 PR 保留參照仍依上文記錄。
