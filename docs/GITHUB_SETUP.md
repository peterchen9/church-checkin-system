# GitHub 設定筆記

目前狀態：

- 本機資料夾：`C:\Users\peter\OneDrive\Documents\教會智能報到系統`
- GitHub 帳號：`peterchen9`
- GitHub App 已安裝到帳號，且已可存取 `peterchen9/church-checkin-system`
- 此 PowerShell 環境目前找不到 `git` 指令

## Repository

GitHub repository：

```text
https://github.com/peterchen9/church-checkin-system
```

## 本機 Git 指令

安裝 Git 後，在此資料夾執行：

```powershell
git init
git add .
git commit -m "Initial project inventory"
git branch -M main
git remote add origin https://github.com/peterchen9/church-checkin-system.git
git push -u origin main
```

也可以直接執行已準備好的 script：

```powershell
.\scripts\bootstrap-git.ps1 -RemoteUrl "https://github.com/peterchen9/church-checkin-system.git"
```

## 後端納管建議

目前本機只整理出前端檔案。後端 PHP 需從 192.168.16.240 取回原始碼後再提交。

建議提交前先確認：

- 不提交真實資料庫密碼、API key、session secret
- 上傳資料夾、匯出檔、備份 SQL 不納入 git
- 建立 `.env.example` 描述必要設定
- 建立資料庫 schema 或 migration，讓日後可重建環境
