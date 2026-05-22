param(
    [Parameter(Mandatory = $true)]
    [string]$RemoteUrl,

    [string]$CommitMessage = "Initial project inventory"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "找不到 git 指令。請先安裝 Git for Windows，再重新執行此 script。"
}

if (-not (Test-Path ".git")) {
    git init
}

git add .

$hasCommit = $true
git rev-parse --verify HEAD *> $null
if ($LASTEXITCODE -ne 0) {
    $hasCommit = $false
}

$status = git status --porcelain
if ($status) {
    git commit -m $CommitMessage
} elseif (-not $hasCommit) {
    throw "目前沒有可提交的檔案。"
}

git branch -M main

$remoteExists = git remote get-url origin *> $null
if ($LASTEXITCODE -eq 0) {
    git remote set-url origin $RemoteUrl
} else {
    git remote add origin $RemoteUrl
}

git push -u origin main
