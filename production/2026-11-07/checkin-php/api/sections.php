<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

require_once 'db_config.php';

try {
    // Use the current canonical directory, never legacy attendance snapshots.
    $stmt = $pdo->query("SELECT DISTINCT section, family1 FROM members WHERE section IS NOT NULL AND section != '' ORDER BY section, family1");
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Process into a nested structure: [ "SectionName" => ["Group1", "Group2"], ... ]
    $sections = [];
    foreach ($results as $row) {
        $section = $row['section'];
        $group = $row['family1'];
        
        if (!isset($sections[$section])) {
            $sections[$section] = [];
        }
        if ($group !== null && $group !== '') {
            $sections[$section][] = $group;
        }
    }
    
    $units = $pdo->query("SELECT DISTINCT COALESCE(NULLIF(p.department, ''), '未分配部門') AS unit
        FROM staff_info s LEFT JOIN accounts_userprofile p ON p.user_id = s.user_id
        WHERE s.is_active = 1 ORDER BY unit")->fetchAll(PDO::FETCH_COLUMN);
    echo json_encode(['success' => true, 'sections' => $sections, 'staff_units' => $units]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error fetching sections']);
}
?>
