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
| 共用會員照片 | /home/apps1/nads26/media/eureka/photo；歷史為 media/eureka/photo_history | 已含於本機媒體封包；資料庫內舊 photo_base64 亦含於 SQL |
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
| database/all-databases.sql.gz | MySQL 全資料庫邏輯匯出；本系統 nads26db 的 127 個 InnoDB 表具交易一致性，含 routines、events、triggers、binary-safe values |
| archives/platform.tar.zst | 平台程式、環境設定、static、private_media、_rooms、原始文件與記錄；media、mysql_data、舊備份分開保存 |
| archives/checkin.tar.zst | 原 PHP 網站與獨立報到服務完整主機目錄，包含私人 config |
| archives/checkin-runtime-app.tar.gz | 報到容器實際 /srv/app 程式 |
| archives/media-local.tar.zst | media 本機內容，排除另存的 NAS 子樹 |
| archives/media-nas.tar.zst | NAS FileCenter 完整內容 |
| archives/host-config.tar.zst | Nginx、PHP、church-checkin、cron、fstab 與 TLS 設定，含敏感檔 |
| archives/system-crontabs.tar.zst | 主機 root 與使用者原始 crontab，僅存於受限備份 |
| archives/nas-credentials.tar.zst | NAS 掛載引用的獨立憑證檔，僅存於受限備份 |
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

## 既有固定備份排程與限制

補查 root 與 peter 的原始 crontab 後確認：

| 帳號／時間 | 作業與目的地 | 已確認狀態 |
| --- | --- | --- |
| root 每天 18:00 | rsync -avr --delete /home/ 至 /mnt/usb1t/gino25-home/ | 有固定排程及既有鏡像，涵蓋兩套位於 /home 的程式；覆寫式同步，不等於每日獨立快照，也不能保證執行中 MySQL 實體檔一致性 |
| root 每週日 05:00 | sh /home/apps1/nads26/scripts/backup.sh，保存至 /mnt/usb1t/nads26/latest/ 與 nads-bkYYYYMM.tar.gz | 有固定排程；latest SQL 最後修改 2026-11-01 05:00，16,849,872 bytes；每月同名封包可能於當月再次執行時覆寫 |
| peter 每天 02:00 | /home/apps1/nads26/scripts/backup.sh | 2026-11-01 至 11-07 的該帳號執行紀錄顯示目的地無法寫入 |

兩個 /mnt/usb1t 下的目的地目前都在主機系統磁碟 /dev/sda2，沒有獨立 USB 掛載。每日 /home 鏡像未涵蓋 /etc 下的 PHP DB 設定、NAS 憑證與 Nginx/TLS 設定；沒有將這些排程視為已驗證的全系統還原點。本次完整備份另外涵蓋相關設定、NAS 全部文件與一致性 nads26db SQL，並保存至本機 D 槽。

原始 root／使用者 crontab 已以 archives/system-crontabs.tar.zst 保存，篩選摘要在 inventory/system-backup-cron-summary.txt。先前只查 peter crontab 的結論不完整；現以本節為準。本次未變更任何排程或目錄權限，未另行宣稱既有 root 排程的最近整批執行成功。

## 已完成的資料庫與服務驗證

隔離 MySQL 匯入成功：members 7,987 筆、sunday_checkins 816 筆、checkin_records 108,101 筆、nads26db 共 127 個資料表。測試容器已移除。正式平台、8022 前台及 8033 後台均 HTTP 200；獨立服務 /sunday/ 為預期的 HTTP 302 登入導向。兩套程式共 1,812 個 Python 檔案已完成語法檢查，沒有語法錯誤；未重新執行所有應用功能測試。

歷史清理僅推送 GitHub 可寫分支；GitHub 管理的 PR 參照與快取不在一般 Git push 的可改寫範圍。受限備份保存清理前歷史，應作為敏感資料管理。

## GitHub 保留參照的實際核對

重新下載遠端 mirror 後，可寫分支均已清理；GitHub 保留的 refs/pull/1/head, refs/pull/2/head 仍可到達舊密碼雜湊物件。這些是 GitHub 管理的唯讀 PR 參照，無法由一般 push 改寫。徹底移除保留參照與快取需由版本庫擁有者向 GitHub Support 提出敏感資料清除要求；本次沒有變更或關閉 PR，也沒有輪替正式帳號密碼。受限備份另存 github-managed-ref-audit.json。

GitHub 保留參照處理依據：[GitHub 官方敏感資料移除說明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)。
