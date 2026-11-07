<?php
function registration_membership_choices(PDO $pdo): array {
    $sections=$pdo->query('SELECT id,name,parent_name FROM pastoral_sections WHERE is_active=1 ORDER BY overseer_id,id')->fetchAll(PDO::FETCH_ASSOC);
    $groups=$pdo->query('SELECT g.id,g.name,g.section_id FROM pastoral_groups g INNER JOIN pastoral_sections s ON s.id=g.section_id WHERE g.is_active=1 AND s.is_active=1 ORDER BY g.id')->fetchAll(PDO::FETCH_ASSOC);
    return ['sections'=>$sections,'groups'=>$groups];
}

function registration_resolve_membership(PDO $pdo, array $data): array {
    foreach (['planned_section_id','planned_group_id'] as $field) {
        if (isset($data[$field]) && !is_scalar($data[$field])) throw new InvalidArgumentException('預歸屬欄位格式不正確。');
    }
    $section=trim((string)($data['planned_section_id']??''));
    $group=trim((string)($data['planned_group_id']??''));
    if ($section==='') {
        if ($group!=='') throw new InvalidArgumentException('請先選擇預歸屬牧區。');
        return ['新朋友牧區','新朋友'];
    }
    if (!preg_match('/^[1-9][0-9]{0,17}$/D',$section) || ($group!=='' && !preg_match('/^[1-9][0-9]{0,17}$/D',$group))) {
        throw new InvalidArgumentException('預歸屬牧區或小家不正確，請重新選擇。');
    }
    $stmt=$pdo->prepare('SELECT name FROM pastoral_sections WHERE id=? AND is_active=1');$stmt->execute([$section]);$sectionName=$stmt->fetchColumn();
    if ($sectionName===false) throw new InvalidArgumentException('所選牧區已停用或不存在，請重新選擇。');
    if ($group==='') {
        $stmt=$pdo->prepare('SELECT COUNT(*) FROM pastoral_groups WHERE section_id=? AND is_active=1');$stmt->execute([$section]);
        if ((int)$stmt->fetchColumn()>0) throw new InvalidArgumentException('請選擇此牧區的小家。');
        return [$sectionName,''];
    }
    $stmt=$pdo->prepare('SELECT name FROM pastoral_groups WHERE id=? AND section_id=? AND is_active=1');$stmt->execute([$group,$section]);$groupName=$stmt->fetchColumn();
    if ($groupName===false) throw new InvalidArgumentException('所選小家不屬於此牧區或已停用，請重新選擇。');
    return [$sectionName,$groupName];
}
