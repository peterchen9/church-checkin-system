<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

require_once 'db_config.php';
require_once 'course_catalog.php';

try {
    // Fetch active events
    $events = checkin_catalog($pdo);
    
    echo json_encode(['success' => true, 'events' => $events]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error fetching events']);
}
?>
