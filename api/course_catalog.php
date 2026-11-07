<?php
// Negative public IDs identify platform courses; positive IDs identify special events.
// The namespaces preserve existing special-event IDs and avoid course ID collisions.
function checkin_catalog(PDO $pdo): array {
    $courses = $pdo->query('SELECT id AS platform_course_id, code, subject AS name,
        teachers, class_time, total_classes AS total_sessions, created_at
        FROM education_course ORDER BY code DESC, id DESC')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($courses as &$course) {
        $course['id'] = -(int)$course['platform_course_id'];
        $course['type'] = 'course';
        $course['price'] = null;
        $course['source'] = 'platform';
        $course['read_only'] = true;
    }
    unset($course);
    $specials = $pdo->query("SELECT * FROM checkin_events WHERE type = 'special' ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($specials as &$event) {
        $event['source'] = 'special';
        $event['read_only'] = false;
    }
    return array_merge($courses, $specials);
}

function checkin_event_exists(PDO $pdo, int $id): bool {
    $query = $id < 0 ? 'SELECT id FROM education_course WHERE id = ?'
                    : "SELECT id FROM checkin_events WHERE id = ? AND type = 'special'";
    $stmt = $pdo->prepare($query);
    $stmt->execute([abs($id)]);
    return (bool)$stmt->fetchColumn();
}
