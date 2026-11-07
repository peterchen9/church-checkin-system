# 行政平台與報到系統完整記錄：2026-11-07

時區：Asia/Taipei。這是既有系統的保存與備份作業，未部署、重啟正式服務或修改正式資料。

## 正式系統與資料位置

主機 gino25，維護連線 172.20.100.240；既有內網文件使用 192.168.16.240。

| 範圍 | 正式來源 | 執行方式 |
| --- | --- | --- |
| 行政平台 | /home/apps1/nads26 | nads26-web，26001:8000，來源 bind mount 至 /app |
| 共用資料庫 | /home/apps1/nads26/mysql_data | nads26db，MySQL 8.0，33069:3306 |
| 報到 PHP 與網頁 | /home/peterchen/church_checkin | 主機 Nginx 與 PHP-FPM |
| 報到獨立服務 | /home/peter/church-checkin-standalone | church-checkin-standalone，127.0.0.1:28022 至 8000 |
| 報到資料庫設定 | /etc/church-checkin/database.json | 只保存在受限備份 |
| 報到獨立服務設定 | /home/peter/church-checkin-standalone/config/settings.json | 掛載為 /config/settings.json，只保存在受限備份 |
| 本機媒體與附件 | /home/apps1/nads26/media、private_media、_rooms | 完整備份含原始內容 |
| NAS 檔案中心 | /home/apps1/nads26/media/NADS_FileCenter | CIFS 來源 //172.20.50.4/NADS_FileCenter，獨立封包 |

兩套服務共用 nads26db.members 通訊錄及 sunday_checkins 主日報到資料；平台 checkin_records 為出席彙整來源之一。正式資料未複製到 GitHub。

## 今天的版本記錄

- 平台：https://github.com/peterchen9/nghcc-nads26
- 報到：https://github.com/peterchen9/church-checkin-system
- production/2026-11-07 保存正式來源的程式快照及原檔 SHA-256 清單。
- 平台根目錄 nads26 保留本機開發工作；與正式環境不同之處以正式快照辨認，沒有為了製作記錄而覆蓋本機未提交工作。
- 報到記錄補含原 PHP 後端與獨立 Django 服務；實際容器程式另存 checkin-runtime。
- .env、資料庫、帳號移轉資料、密碼、私人設定、照片、附件、log 及備份不提交 GitHub。
- 含敏感資訊的舊工具檔僅存於受限完整備份；PHP 登入原檔以明確標示的遮蔽範例記錄。公開快照不作為可直接部署的完整設定包。
- 發布前執行 Gitleaks 全部可達歷史、目前檔案掃描，並額外比對正式站已知秘密值。2026-11-07 使用者明確授權清理舊帳號移轉檔在 Git 歷史中的正式密碼雜湊；改寫前 bundle 已保存在本機備份。清理後其他電腦應重新 clone，勿合併舊歷史。

## 完整備份位置與範圍

- 主機：/home/peter/backups/platform-checkin-full-20261107-153313
- 本機：D:\backups\nghcc-nads26\platform-checkin-full-20261107-153313

| 備份項目 | 內容 |
| --- | --- |
| database/all-databases.sql.gz | MySQL 全資料庫一致性邏輯匯出，含 routines、events、triggers、binary-safe values |
| archives/platform.tar.zst | 平台程式、環境設定、static、private_media、_rooms、原始文件與記錄；media、mysql_data、舊備份分開保存 |
| archives/checkin.tar.zst | 原 PHP 網站與獨立報到服務完整主機目錄，包含私人 config |
| archives/checkin-runtime-app.tar.gz | 報到容器實際 /srv/app 程式 |
| archives/media-local.tar.zst | media 本機內容，排除另存的 NAS 子樹 |
| archives/media-nas.tar.zst | NAS FileCenter 完整內容 |
| archives/host-config.tar.zst | Nginx、PHP、church-checkin、cron、fstab 與 TLS 設定，含敏感檔 |
| archives/existing-backups.tar.zst | 平台目錄內既有備份 |
| archives/mysql-live-secondary.tar.zst | 執行中 MySQL 實體檔的次要救援副本，不作為一致性還原來源 |
| images/runtime-images.tar.zst | 平台、MySQL、報到三個正式 Docker 映像 |
| config、inventory | 容器與網路設定、版本、套件清單、排程、來源與封包清單、還原測試結果 |
| 本機 Git bundles 與 workspace ZIP | 改寫前 Git 歷史及本機未提交工作 |

備份資料夾具受限權限。主機目錄為同主機保存；D 槽副本提供另一台電腦的保存位置。服務持續運作，因此 SQL 具交易一致性，檔案為備份期間逐步讀取，並非全系統同一瞬間的磁碟快照。

## 驗證與還原

以 SHA256SUMS 在主機及本機逐檔比對；SQL gzip 檢查與完成標記、所有 tar/zstd 可讀性檢查，並在無網路、暫存磁碟的獨立 MySQL 容器實際匯入 SQL。詳細結果以備份內 REMOTE-VERIFICATION.txt、LOCAL-VERIFICATION.json、inventory/restore-test-results.txt 為準。

還原必須在隔離環境進行：先 sha256sum -c SHA256SUMS；zstd -dc images/runtime-images.tar.zst | docker load；將平台與報到封包解開至對應來源位置；建立乾淨 MySQL 並匯入 database/all-databases.sql.gz；從私人設定恢復 .env、/etc/church-checkin 及 /config；將本機媒體及 NAS 封包恢復至正確儲存位置；依 container-inspect 與 Compose 重建服務。報到容器應同時使用保存的正式映像與實際 runtime app，不能假設主機 app 是唯一執行來源。正式切換前另行核對權限、資料筆數、登入與報到功能。

本次沒有執行整機還原、實際 TLS 重簽或正式服務切換。執行中 MySQL 實體副本不可直接覆蓋 datadir。

## 既有每日備份狀態

每日 02:00 的 /home/apps1/nads26/scripts/backup.sh 已設定，但 2026-11-01 至 11-07 的排程紀錄均顯示目的地無法寫入。/mnt/usb1t/nads26 目前實際位於主機系統磁碟，沒有獨立掛載 USB。本次為另建完整備份，沒有擅自修改既有排程或目的地權限；今天一次備份成功不代表每日排程已修復。
