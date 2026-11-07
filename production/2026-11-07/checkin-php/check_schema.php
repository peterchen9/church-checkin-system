<?php
require_once 'api/db_config.php'; // gets $pdo for 'datacenter'

// nads25db connection
$host = '127.0.0.1';
$user = 'peter';
$pass = '__PRIVATE_BACKUP_ONLY__';
try {
    $pdo_nads = new PDO("mysql:host=$host;dbname=nads25db;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $schema_members = $pdo_nads->query("DESCRIBE members")->fetchAll(PDO::FETCH_ASSOC);
    echo "nads25db.members Schema:\n";
    foreach ($schema_members as $col) {
        echo $col['Field'] . " - " . $col['Type'] . "\n";
    }
} catch (Exception $e) {
    echo "Error nads25db: " . $e->getMessage() . "\n";
}

try {
    $schema_daka = $pdo->query("DESCRIBE daka_by_person")->fetchAll(PDO::FETCH_ASSOC);
    echo "\ndatacenter.daka_by_person Schema:\n";
    foreach ($schema_daka as $col) {
        echo $col['Field'] . " - " . $col['Type'] . "\n";
    }
} catch (Exception $e) {
    echo "Error datacenter: " . $e->getMessage() . "\n";
}
?>
