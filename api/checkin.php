<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => '只支援 POST 請求']);
    exit;
}

require_once 'db_config.php';
require_once 'course_catalog.php';

$rawData = file_get_contents("php://input");
$data = json_decode($rawData, true);

$qr_code_id = isset($data['qr_code_id']) ? trim($data['qr_code_id']) : '';
$is_manual_search = isset($data['is_manual_search']) ? (bool)$data['is_manual_search'] : false;
$mode = isset($data['mode']) ? trim($data['mode']) : '';
$event_id = isset($data['event_id']) ? (int)$data['event_id'] : null;
$target_section = isset($data['target_section']) ? trim($data['target_section']) : null;
$target_group = isset($data['target_group']) ? trim($data['target_group']) : null;
$target_unit = isset($data['target_unit']) ? trim($data['target_unit']) : null;

if (empty($qr_code_id) || empty($mode)) {
    echo json_encode(['success' => false, 'message' => '缺少必要的參數']);
    exit;
}

// Sunday attendance has one canonical writer with transaction and duplicate protection.
if ($mode === '主日聚會') {
    echo json_encode(['success' => false, 'message' => '請從主日聚會專用入口報到。'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $member = null;
    $multiple_matches = [];

    if ($is_manual_search) {
        // Manual search by name or phone
        $stmt = $pdo_nads->prepare("SELECT church_id, name, section, family1, mobile1, email1 FROM members WHERE name LIKE ? OR mobile1 LIKE ?");
        $searchTerm = "%{$qr_code_id}%";
        $stmt->execute([$searchTerm, $searchTerm]);
        $results = $stmt->fetchAll();

        if (count($results) === 0) {
            echo json_encode(['success' => false, 'message' => "找不到符合「{$qr_code_id}」的紀錄"]);
            exit;
        } elseif (count($results) > 1) {
            // Return multiple matches for user to select
            $results = array_map(function ($result) {
                unset($result['mobile1'], $result['email1']);
                return $result;
            }, $results);
            echo json_encode(['success' => false, 'multiple' => true, 'matches' => $results]);
            exit;
        } else {
            $member = $results[0];
        }
    } else {
        // Normal QR Code scan
        $parsed_id = $qr_code_id;
        if (preg_match('/^NG(\d{6})\d{3}$/i', $qr_code_id, $matches)) {
            $parsed_id = (int)$matches[1];
        }

        $stmt = $pdo_nads->prepare("SELECT church_id, name, section, family1, mobile1, email1 FROM members WHERE church_id = ?");
        $stmt->execute([$parsed_id]);
        $member = $stmt->fetch();

        if (!$member) {
            echo json_encode(['success' => false, 'message' => "找不到此成員紀錄 (掃描到的內容為: '{$qr_code_id}')"]);
            exit;
        }
    }

    $now = new DateTime();
    $today = $now->format('Y-m-d');
    $current_time = $now->format('H:i');
    $current_datetime = $now->format('Y-m-d H:i:s');

    // 處理防呆 (通用 10 分鐘內)
    $checkStmt = $pdo->prepare("
        SELECT id FROM checkin_logs 
        WHERE church_id = ? AND checkin_mode = ? 
        AND checkin_time >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        ORDER BY id DESC LIMIT 1
    ");
    $checkStmt->execute([$member['church_id'], $mode]);
    if ($checkStmt->rowCount() > 0) {
        $msg = ($mode === '同工打卡') ? "{$member['name']} 已打卡！請勿重複刷卡。" : "{$member['name']} 已報到了！";
        echo json_encode(['success' => false, 'message' => $msg]);
        exit;
    }

    $status = null;
    $final_event_id = null;
    $response_message = "{$member['name']} 報到成功";

    // 依據模式處理邏輯
    if ($mode === '主日聚會') {
        // 檢查是否為星期天
        if ($now->format('w') != 0) {
            echo json_encode(['success' => false, 'message' => '今天沒有主日聚會！']);
            exit;
        }
        
        // 判斷堂次
        if ($current_time >= '07:30' && $current_time <= '10:15') {
            $status = '第一堂';
        } elseif ($current_time > '10:15' && $current_time <= '13:00') {
            $status = '第二堂';
        } elseif ($current_time >= '18:00' && $current_time <= '21:30') {
            $status = '晚崇拜';
        } else {
            $status = '主日其他時段';
        }
        $response_message = "{$member['name']} 參加 {$status} 報到成功！";
        
    } elseif ($mode === '成主課程' || $mode === '特別聚會') {
        if (!$event_id) {
            echo json_encode(['success' => false, 'message' => '請選擇一個課程或聚會！']);
            exit;
        }
        if (($mode === '成主課程' && $event_id >= 0) || ($mode === '特別聚會' && $event_id <= 0)
                || !checkin_event_exists($pdo, $event_id)) {
            echo json_encode(['success' => false, 'message' => '課程或聚會不存在或類別不符，請重新整理後選擇。'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        
        $final_event_id = $event_id;
        $response_message = "{$member['name']} 課程報到成功！";
        
    } elseif ($mode === '牧區小組聚會') {
        if (!$target_section || !$target_group) {
            echo json_encode(['success' => false, 'message' => '請選擇牧區與小組！']);
            exit;
        }
        $response_message = "{$member['name']} 小組報到成功！";

    } elseif ($mode === '同工打卡') {
        // 檢查是否為員工
        $empStmt = $pdo->prepare("SELECT s.staff_id, s.mobile, s.email,
            COALESCE(NULLIF(p.department, ''), '未分配部門') AS unit
            FROM staff_info s LEFT JOIN accounts_userprofile p ON p.user_id = s.user_id
            WHERE s.is_active = 1 AND s.name = ?");
        $empStmt->execute([$member['name']]);
        $phone = preg_replace('/\D/', '', $member['mobile1'] ?? '');
        $email = strtolower(trim($member['email1'] ?? ''));
        $matches = array_values(array_filter($empStmt->fetchAll(), function ($staff) use ($phone, $email) {
            return ($phone !== '' && $phone === preg_replace('/\D/', '', $staff['mobile'] ?? '')) ||
                   ($email !== '' && $email === strtolower(trim($staff['email'] ?? '')));
        }));
        $employee = count($matches) === 1 ? $matches[0] : null;
        
        if (!$employee) {
            echo json_encode(['success' => false, 'message' => '無法唯一對應平台在職人員，請確認人事與通訊錄的姓名及手機或 Email 一致。'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($employee['unit'] !== $target_unit) {
            echo json_encode(['success' => false, 'message' => "打卡失敗：所選單位與您的所屬單位不符，請重新確認！"]);
            exit;
        }

        // 判斷上下班 (抓取今天最後一筆打卡紀錄)
        $todayStart = $now->format('Y-m-d 00:00:00');
        $todayEnd = $now->format('Y-m-d 23:59:59');
        $logStmt = $pdo->prepare("
            SELECT status FROM checkin_logs 
            WHERE church_id = ? AND checkin_mode = '同工打卡' 
            AND checkin_time BETWEEN ? AND ?
            ORDER BY id DESC LIMIT 1
        ");
        $logStmt->execute([$member['church_id'], $todayStart, $todayEnd]);
        $lastLog = $logStmt->fetch();

        if ($lastLog && $lastLog['status'] === '上班') {
            $status = '下班';
            $response_message = "{$member['name']} 打卡，已下班！辛苦了！";
        } else {
            $status = '上班';
            $response_message = "{$member['name']} 打卡，上班中！";
        }
    }

    // 寫入報到紀錄
    $insertStmt = $pdo->prepare("
        INSERT INTO checkin_logs (church_id, checkin_mode, checkin_time, event_id, status, target_section, target_group) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $insertStmt->execute([$member['church_id'], $mode, $current_datetime, $final_event_id, $status, $target_section, $target_group]);

    // 同步更新 nads26db.members 的最後報到時間與出席狀態 (僅限主日聚會)
    if ($mode === '主日聚會') {
        try {
            $updateMemberStmt = $pdo_nads->prepare("UPDATE members SET last_checkin = ?, presence = 1 WHERE church_id = ?");
            $updateMemberStmt->execute([$today, $member['church_id']]);
        } catch (Exception $e) {
            // Ignore errors in syncing back to cms26, don't fail the checkin
            error_log("Failed to sync last_checkin to nads26db: " . $e->getMessage());
        }
    }

    echo json_encode([
        'success' => true,
        'message' => $response_message,
        'member' => [
            'church_id' => $member['church_id'],
            'name' => $member['name'],
            'section' => $member['section'],
            'family1' => $member['family1'],
            'status' => $status
        ]
    ]);

} catch (Exception $e) {
    error_log("Checkin Error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => '系統發生錯誤，請聯絡管理員']);
}
?>
