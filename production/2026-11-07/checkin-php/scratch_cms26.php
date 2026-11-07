<?php
$host = '127.0.0.1';
$user = 'peter';
$pass = '__PRIVATE_BACKUP_ONLY__';
try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 2]);
    $dbs = $pdo->query("SHOW DATABASES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Databases:\n";
    print_r($dbs);

    if (in_array('cms26', $dbs)) {
        echo "\nTables in cms26:\n";
        $tables = $pdo->query("SHOW TABLES IN cms26")->fetchAll(PDO::FETCH_COLUMN);
        print_r($tables);

        // check columns of the table that looks like users or contacts
        foreach ($tables as $t) {
            if (strpos($t, 'user') !== false || strpos($t, 'member') !== false || strpos($t, 'person') !== false) {
                echo "\nColumns in cms26.$t:\n";
                print_r($pdo->query("DESCRIBE cms26.$t")->fetchAll(PDO::FETCH_ASSOC));
            }
        }
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
