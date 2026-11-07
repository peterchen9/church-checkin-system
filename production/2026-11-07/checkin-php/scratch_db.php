<?php
require_once 'api/db_config.php';
$dbs = $pdo->query("SHOW DATABASES")->fetchAll(PDO::FETCH_COLUMN);
echo "Databases: " . implode(', ', $dbs) . "\n";
$tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
echo "Tables in datacenter: " . implode(', ', $tables) . "\n";
// Let's check if there is a cms26 table
if (in_array('cms26', $tables)) {
    echo "cms26 table structure:\n";
    $schema = $pdo->query("DESCRIBE cms26")->fetchAll(PDO::FETCH_ASSOC);
    print_r($schema);
}
// Or if cms26 is a DB
if (in_array('cms26', $dbs)) {
    echo "Tables in cms26 DB:\n";
    $cms26_tables = $pdo->query("SHOW TABLES IN cms26")->fetchAll(PDO::FETCH_COLUMN);
    print_r($cms26_tables);
}
?>
