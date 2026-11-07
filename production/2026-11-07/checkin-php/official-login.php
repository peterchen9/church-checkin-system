<?php
// Canonical login document with response-level cache protection.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
if (($_SERVER['HTTP_HOST'] ?? '') !== '192.168.16.240:8033') {
    header('Location: http://192.168.16.240:8033/official-login.php?v=20261027-login-return', true, 302);
    exit;
}
header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/login.html');
