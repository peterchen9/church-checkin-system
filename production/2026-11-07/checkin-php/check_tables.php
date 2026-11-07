<?php
$host = '172.20.60.241';
$user = 'peter';
$pass = '__PRIVATE_BACKUP_ONLY__';

try {
    $pdo = new PDO("mysql:host=$host;dbname=nads25db;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]);
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables in nads25db on $host:\n" . implode(", ", $tables) . "\n\n";

    if (in_array('members', $tables)) {
        $schema = $pdo->query("DESCRIBE members")->fetchAll(PDO::FETCH_ASSOC);
        echo "nads25db.members Schema:\n";
        foreach ($schema as $col) {
            echo $col['Field'] . " - " . $col['Type'] . "\n";
        }
    }
} catch (Exception $e) {
    echo "Error nads25db: " . $e->getMessage() . "\n";
}
?>
