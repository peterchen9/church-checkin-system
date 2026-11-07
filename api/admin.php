<?php
session_start();
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");

// Check Session
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    echo json_encode(['success' => false, 'message' => '未登入或授權已過期']);
    exit;
}

require_once 'db_config.php';
require_once 'course_catalog.php';
require_once 'contact_directory.php';
require_once 'registration_membership.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (isset($data['action'])) {
        $action = $data['action'];
    }
}

if ($action==='registration_membership_choices') {
    header('Cache-Control: no-store, private');
    try { echo json_encode(['success'=>true]+registration_membership_choices($pdo_nads),JSON_UNESCAPED_UNICODE); }
    catch (Throwable $error) { http_response_code(500);echo json_encode(['success'=>false,'message'=>'牧區與小家載入失敗。']); }
    exit;
}
if (in_array($action,['add_contact','update_contact'],true) && array_key_exists('planned_section_id',$data??[])) {
    try { [$data['section'],$data['family1']]=registration_resolve_membership($pdo_nads,$data); }
    catch (InvalidArgumentException $error) { http_response_code(400);echo json_encode(['success'=>false,'message'=>$error->getMessage()],JSON_UNESCAPED_UNICODE);exit; }
}

if (in_array($action, ['get_contact','get_original_photo','add_contact','update_contact'], true)) {
    contact_handle($pdo_nads, $action, $data ?? []);
    exit;
}

try {
    switch ($action) {
        // --- LOGS ---
        case 'get_logs':
            $start_date = $_GET['start_date'] ?? date('Y-m-d');
            $end_date = $_GET['end_date'] ?? date('Y-m-d');
            $modes = isset($_GET['modes']) && !empty($_GET['modes']) ? explode(',', $_GET['modes']) : [];
            $name = $_GET['name'] ?? '';
            
            $query = "
                SELECT c.id, c.checkin_time, c.checkin_mode, c.status, 
                       c.church_id, CASE WHEN c.event_id < 0
                           THEN COALESCE(course.subject COLLATE utf8mb4_unicode_ci, '平台課程已刪除')
                           ELSE e.name COLLATE utf8mb4_unicode_ci END as event_name
                FROM (
                    SELECT id, church_id, checkin_mode COLLATE utf8mb4_unicode_ci AS checkin_mode,
                           checkin_time, event_id, status COLLATE utf8mb4_unicode_ci AS status FROM checkin_logs
                    UNION ALL
                    SELECT -id, church_id, '主日聚會' COLLATE utf8mb4_unicode_ci,
                           CONVERT_TZ(checked_in_at, '+00:00', '+08:00'), NULL,
                           service COLLATE utf8mb4_unicode_ci FROM sunday_checkins
                ) c
                LEFT JOIN checkin_events e ON c.event_id = e.id
                LEFT JOIN education_course course ON c.event_id = -course.id
                WHERE DATE(c.checkin_time) >= ? AND DATE(c.checkin_time) <= ?
            ";
            $params = [$start_date, $end_date];
            
            if (!empty($modes)) {
                $inQuery = implode(',', array_fill(0, count($modes), '?'));
                $query .= " AND c.checkin_mode IN ($inQuery)";
                $params = array_merge($params, $modes);
            }
            
            $query .= " ORDER BY c.checkin_time DESC, c.id DESC";
            
            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch names from nads26db
            $church_ids = array_unique(array_column($logs, 'church_id'));
            $members_map = [];
            if (!empty($church_ids)) {
                $inQuery = implode(',', array_fill(0, count($church_ids), '?'));
                $memStmt = $pdo_nads->prepare("SELECT church_id, name FROM members WHERE church_id IN ($inQuery)");
                $memStmt->execute(array_values($church_ids));
                while ($row = $memStmt->fetch()) {
                    $members_map[$row['church_id']] = $row['name'];
                }
            }

            $final_logs = [];
            foreach ($logs as $log) {
                $log['name'] = $members_map[$log['church_id']] ?? '未知';
                if ($name && stripos($log['name'], $name) === false) {
                    continue; // filter by name manually
                }
                $final_logs[] = $log;
            }

            echo json_encode(['success' => true, 'data' => $final_logs]);
            break;

        // --- EVENTS ---
        case 'get_events':
            echo json_encode(['success' => true, 'data' => checkin_catalog($pdo)]);
            break;
            
        case 'add_event':
            if (($data['type'] ?? '') !== 'special') {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => '課程以行政平台為準，請至平台新增或修改課程。'], JSON_UNESCAPED_UNICODE);
                break;
            }
            $stmt = $pdo->prepare("INSERT INTO checkin_events (type, name, total_sessions, price) VALUES (?, ?, ?, ?)");
            $stmt->execute([$data['type'], $data['name'], $data['total_sessions'] ?? 0, $data['price'] ?? 0]);
            echo json_encode(['success' => true]);
            break;
            
        case 'update_event':
            if ((int)($data['id'] ?? 0) <= 0 || ($data['type'] ?? '') !== 'special') {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => '平台課程請至行政平台維護。'], JSON_UNESCAPED_UNICODE);
                break;
            }
            $stmt = $pdo->prepare("UPDATE checkin_events SET type=?, name=?, total_sessions=?, price=? WHERE id=?");
            $stmt->execute([$data['type'], $data['name'], $data['total_sessions'] ?? 0, $data['price'] ?? 0, $data['id']]);
            echo json_encode(['success' => true]);
            break;
            
        case 'delete_event':
            if ((int)($data['id'] ?? 0) <= 0) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => '平台課程請至行政平台維護。'], JSON_UNESCAPED_UNICODE);
                break;
            }
            $pdo->prepare("DELETE FROM checkin_event_registrations WHERE event_id = ?")->execute([$data['id']]);
            $pdo->prepare("DELETE FROM checkin_events WHERE id = ?")->execute([$data['id']]);
            echo json_encode(['success' => true]);
            break;

        // --- REGISTRATIONS ---
        case 'get_registrations':
            $event_id = $_GET['event_id'];
            $is_course = (int)$event_id < 0;
            $stmt = $pdo->prepare($is_course
                ? 'SELECT -id AS id, -course_id AS event_id, church_id, is_paid, paid_at, created_at FROM checkin_course_registrations WHERE course_id = ?'
                : 'SELECT * FROM checkin_event_registrations WHERE event_id = ?');
            $stmt->execute([abs((int)$event_id)]);
            $regs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $church_ids = array_unique(array_column($regs, 'church_id'));
            $members_map = [];
            if (!empty($church_ids)) {
                $inQuery = implode(',', array_fill(0, count($church_ids), '?'));
                $memStmt = $pdo_nads->prepare("SELECT church_id, name FROM members WHERE church_id IN ($inQuery)");
                $memStmt->execute(array_values($church_ids));
                while ($row = $memStmt->fetch()) {
                    $members_map[$row['church_id']] = $row['name'];
                }
            }

            // Get total sessions
            $eventStmt = $pdo->prepare($is_course ? 'SELECT total_classes AS total_sessions FROM education_course WHERE id = ?'
                : 'SELECT total_sessions FROM checkin_events WHERE id = ?');
            $eventStmt->execute([abs((int)$event_id)]);
            $eventData = $eventStmt->fetch(PDO::FETCH_ASSOC);
            $total_sessions = $eventData ? (int)$eventData['total_sessions'] : 1;

            // Get attendance counts
            $checkinStmt = $pdo->prepare("SELECT church_id, COUNT(*) as attend_count FROM checkin_logs WHERE event_id = ? GROUP BY church_id");
            $checkinStmt->execute([$event_id]);
            $attend_counts = [];
            while ($row = $checkinStmt->fetch(PDO::FETCH_ASSOC)) {
                $attend_counts[$row['church_id']] = (int)$row['attend_count'];
            }

            foreach ($regs as &$r) {
                $r['name'] = $members_map[$r['church_id']] ?? '未知';
                $r['attend_count'] = $attend_counts[$r['church_id']] ?? 0;
                $r['total_sessions'] = $total_sessions;
            }
            echo json_encode(['success' => true, 'data' => $regs]);
            break;
            
        case 'add_registration':
            $event_id = (int)$data['event_id'];
            if (!checkin_event_exists($pdo, $event_id)) {
                echo json_encode(['success' => false, 'message' => '課程或聚會不存在，請重新整理。'], JSON_UNESCAPED_UNICODE);
                break;
            }
            $input = trim($data['input']); // QR or Name
            
            // Resolve church_id
            $church_id = null;
            if (preg_match('/^NG(\d{6})\d{3}$/i', $input, $matches)) {
                $church_id = (int)$matches[1];
            } else {
                $stmt = $pdo_nads->prepare("SELECT church_id FROM members WHERE name = ?");
                $stmt->execute([$input]);
                $person = $stmt->fetch();
                if ($person) $church_id = $person['church_id'];
            }
            
            if (!$church_id) {
                echo json_encode(['success' => false, 'message' => '找不到此會友']);
                break;
            }
            
            try {
                $stmt = $pdo->prepare($event_id < 0
                    ? 'INSERT INTO checkin_course_registrations (course_id, church_id) VALUES (?, ?)'
                    : 'INSERT INTO checkin_event_registrations (event_id, church_id) VALUES (?, ?)');
                $stmt->execute([abs($event_id), $church_id]);
                echo json_encode(['success' => true]);
            } catch (PDOException $e) {
                if ($e->getCode() == 23000) {
                    echo json_encode(['success' => false, 'message' => '此會友已報名']);
                } else {
                    throw $e;
                }
            }
            break;
            
        case 'update_payment':
            $id = $data['id'];
            $is_paid = $data['is_paid'] ? 1 : 0;
            $paid_at = $is_paid ? date('Y-m-d H:i:s') : null;
            $table = (int)$id < 0 ? 'checkin_course_registrations' : 'checkin_event_registrations';
            $stmt = $pdo->prepare("UPDATE $table SET is_paid = ?, paid_at = ? WHERE id = ?");
            $stmt->execute([$is_paid, $paid_at, abs((int)$id)]);
            echo json_encode(['success' => true]);
            break;
            
        case 'delete_registration':
            $table = (int)$data['id'] < 0 ? 'checkin_course_registrations' : 'checkin_event_registrations';
            $pdo->prepare("DELETE FROM $table WHERE id = ?")->execute([abs((int)$data['id'])]);
            echo json_encode(['success' => true]);
            break;

        // --- EMPLOYEES ---
        case 'get_employees':
            $stmt = $pdo->query("SELECT s.staff_id AS id, s.name, s.employee_no, s.identity_code,
                s.is_active, s.onboard_date, COALESCE(NULLIF(p.department, ''), '未分配部門') AS unit
                FROM staff_info s LEFT JOIN accounts_userprofile p ON p.user_id = s.user_id
                ORDER BY s.is_active DESC, s.staff_id");
            $emps = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $emps]);
            break;
            
        case 'add_employee':
        case 'update_employee':
        case 'delete_employee':
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => '員工資料以行政平台人事主檔為準，請至平台維護。'], JSON_UNESCAPED_UNICODE);
            break;

        // --- CONTACTS (via nads26db.members) ---
        case 'search_contacts':
            $keyword = isset($_GET['keyword']) ? trim($_GET['keyword']) : '';
            $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
            $section = isset($_GET['section']) ? trim($_GET['section']) : '';
            $group = isset($_GET['group']) ? trim($_GET['group']) : '';
            $limit = 50;
            $offset = ($page - 1) * $limit;

            $conditions = [];
            $params = [];

            if (!empty($keyword)) {
                $conditions[] = "(name LIKE ? OR mobile1 LIKE ? OR email1 LIKE ? OR address LIKE ? OR phone_h LIKE ? OR phone_o LIKE ? OR line_id LIKE ? OR car_number LIKE ? OR note LIKE ? OR visitor_info LIKE ?)";
                $kwParam = "%$keyword%";
                $params = array_merge($params, array_fill(0, 10, $kwParam));
            }

            if (!empty($section)) {
                $conditions[] = "section = ?";
                $params[] = $section;
            }

            if (!empty($group) && $group !== '全小組') {
                $conditions[] = "family1 = ?";
                $params[] = $group;
            }

            $whereSql = "";
            if (!empty($conditions)) {
                $whereSql = "WHERE " . implode(" AND ", $conditions);
            }

            // Count total
            $countStmt = $pdo_nads->prepare("SELECT COUNT(*) FROM members $whereSql");
            $countStmt->execute($params);
            $total_records = $countStmt->fetchColumn();
            $total_pages = ceil($total_records / $limit) ?: 1;

            // Fetch data
            $query = "SELECT church_id, name, gender, marriage, birthday, phone_h, phone_o, mobile1, mobile1 as phone_num, email1, email1 as email, address, baptized, section, family1, family_id, visitor_info, note, join_date, dataindate, car_number, line_id FROM members $whereSql ORDER BY church_id DESC LIMIT ? OFFSET ?";
            $stmt = $pdo_nads->prepare($query);
            
            // Bind params
            foreach ($params as $index => $param) {
                $stmt->bindValue($index + 1, $param);
            }
            $stmt->bindValue(count($params) + 1, $limit, PDO::PARAM_INT);
            $stmt->bindValue(count($params) + 2, $offset, PDO::PARAM_INT);
            
            $stmt->execute();
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC), 'total_pages' => $total_pages, 'current_page' => $page]);
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'Unknown action']);
    }
} catch (Exception $e) {
    error_log("Admin API Error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => '系統發生錯誤: ' . $e->getMessage()]);
}
?>
