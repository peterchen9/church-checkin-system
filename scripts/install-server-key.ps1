$ErrorActionPreference = 'Stop'
$publicKeyPath = Join-Path $env:USERPROFILE '.ssh\church_checkin_ed25519.pub'
if (-not (Test-Path -LiteralPath $publicKeyPath)) {
    throw "找不到公鑰：$publicKeyPath"
}
$publicKey = (Get-Content -LiteralPath $publicKeyPath -Raw).Trim()
if ($publicKey -notmatch '^ssh-ed25519 [A-Za-z0-9+/=]+(?: .*)?$') {
    throw '公鑰格式不正確。'
}
# Only the public key goes to the remote host. SSH prompts locally for its password.
# Send ASCII Base64 as a command argument, avoiding PowerShell stdin encoding/CRLF.
$keyFields = $publicKey -split '\s+'
$installKey = $keyFields[0] + ' ' + $keyFields[1]
$remoteScript = @"
set -eu
umask 077
mkdir -p "`$HOME/.ssh"
touch "`$HOME/.ssh/authorized_keys"
chmod 700 "`$HOME/.ssh"
chmod 600 "`$HOME/.ssh/authorized_keys"
key='$installKey'
if ! grep -qxF "`$key" "`$HOME/.ssh/authorized_keys"; then
    printf '\n%s\n' "`$key" >> "`$HOME/.ssh/authorized_keys"
fi
"@
$remoteScript = $remoteScript.Replace("`r`n", "`n")
$encodedScript = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
& ssh -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password peter@192.168.16.240 "echo $encodedScript | base64 -d | sh"
if ($LASTEXITCODE -ne 0) {
    throw '公鑰安裝未完成，請查看上方 SSH 或伺服器錯誤訊息。'
}
& ssh -o BatchMode=yes -o ConnectTimeout=5 peter@192.168.16.240 'id'
if ($LASTEXITCODE -ne 0) {
    throw '免密碼登入驗證失敗，請檢查伺服器 authorized_keys 與 SSH 設定。'
}
Write-Host 'SSH 金鑰安裝及免密碼登入驗證成功。'
