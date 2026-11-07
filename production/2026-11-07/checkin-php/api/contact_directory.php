<?php
// Shared-platform contact editing: canonical codes and partial, conflict-aware updates.
function contact_photo_path($id) { return rtrim(CHECKIN_PHOTO_DIR, '/') . '/' . $id . '.jpg'; }
function contact_photo_version($row) {
    $path = contact_photo_path($row['church_id']);
    return is_file($path) ? hash_file('sha256', $path) : hash('sha256', (string)($row['photo_base64'] ?? ''));
}
function contact_code($field, $value) {
    $value = trim((string)$value);
    $maps = [
        'gender' => [''=>'','未填寫'=>'','M'=>'M','m'=>'M','男'=>'M','male'=>'M','F'=>'F','f'=>'F','女'=>'F','female'=>'F'],
        'marriage' => [''=>'','未填寫'=>'','m'=>'m','M'=>'m','已婚'=>'m','yes'=>'m','s'=>'s','S'=>'s','未婚'=>'s','no'=>'s'],
        'baptized' => [''=>'','未填寫'=>'','y'=>'y','Y'=>'y','已受洗'=>'y','yes'=>'y','n'=>'n','N'=>'n','慕道友'=>'n','未受洗'=>'n','no'=>'n']
    ];
    if (!array_key_exists($value, $maps[$field])) throw new InvalidArgumentException('性別、婚姻或受洗選項不正確。');
    return $maps[$field][$value];
}
function contact_photo_bytes($encoded) {
    if (!is_string($encoded) || strlen($encoded) > 14000000 || !preg_match('~^data:image/(?:jpeg|png|gif|webp);base64,(.+)$~s', $encoded, $match))
        throw new InvalidArgumentException('照片格式不正確，或檔案超過 10 MB。');
    $bytes = base64_decode($match[1], true);
    $size = $bytes === false ? false : @getimagesizefromstring($bytes);
    if (!$size || $size[0]*$size[1] > 25000000) throw new InvalidArgumentException('照片無法讀取或尺寸過大。');
    $image = @imagecreatefromstring($bytes);
    if (!$image) throw new InvalidArgumentException('照片無法讀取。');
    ob_start(); imagejpeg($image, null, 90); $jpeg = ob_get_clean(); imagedestroy($image);
    return $jpeg;
}
function contact_write_photo($path, $bytes) {
    if ($bytes === null) { if (is_file($path) && !unlink($path)) throw new RuntimeException('無法移除照片。'); return; }
    $temp = tempnam(dirname($path), '.checkin-photo-');
    if ($temp === false) throw new RuntimeException('照片目錄目前無法寫入。');
    try {
        if (file_put_contents($temp, $bytes) === false) throw new RuntimeException('照片儲存失敗。');
        chmod($temp, 0664);
        if (!rename($temp, $path)) throw new RuntimeException('照片儲存失敗。');
    } finally { if (is_file($temp)) unlink($temp); }
}
function contact_handle(PDO $pdo, $action, array $data) {
    $photoChanged = false; $oldPhoto = null; $photoPath = null;
    try {
        if ($action === 'get_contact' || $action === 'get_original_photo') {
            $id = (string)($_GET['church_id'] ?? '');
            if (!preg_match('/^[1-9][0-9]{0,17}$/D', $id)) throw new InvalidArgumentException('人員編號格式不正確。');
            $stmt = $pdo->prepare('SELECT * FROM members WHERE church_id = ?'); $stmt->execute([$id]); $row = $stmt->fetch();
            if (!$row) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'找不到人員資料。']); return; }
            if ($action === 'get_original_photo') {
                $path=contact_photo_path($id);
                if (is_file($path)) { header('Content-Type: image/jpeg'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff'); readfile($path); return; }
                $raw=preg_replace('~^data:image/[^;]+;base64,~','',(string)($row['photo_base64']??''));
                $bytes=base64_decode($raw,true);$size=$bytes?@getimagesizefromstring($bytes):false;
                if ($size && in_array($size['mime'],['image/jpeg','image/png','image/gif','image/webp'],true)) {
                    header('Content-Type: '.$size['mime']);header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');echo $bytes;return;
                }
                http_response_code(404); return;
            }
            $row['phone_num']=$row['mobile1'];$row['email']=$row['email1'];
            $row['has_photo']=is_file(contact_photo_path($id)) || !empty($row['photo_base64']);
            $row['photo_version']=contact_photo_version($row);
            $row['photo_url']='api/admin.php?action=get_original_photo&church_id='.$id;
            echo json_encode(['success'=>true,'data'=>$row],JSON_UNESCAPED_UNICODE);return;
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405);echo json_encode(['success'=>false,'message'=>'請使用儲存表單。']);return; }
        if (($data['schema_version']??0)!==2) { http_response_code(409);echo json_encode(['success'=>false,'message'=>'通訊錄表單已更新，請重新整理頁面後再儲存。'],JSON_UNESCAPED_UNICODE);return; }
        $fields=['name','gender','marriage','birthday','phone_h','phone_o','mobile1','address','email1','baptized','section','family1','family_id','note','join_date','dataindate','car_number','line_id'];
        // Retain compatible programmatic aliases; the new UI uses platform names.
        if (array_key_exists('mobile',$data) && !array_key_exists('mobile1',$data)) $data['mobile1']=$data['mobile'];
        if (array_key_exists('email',$data) && !array_key_exists('email1',$data)) $data['email1']=$data['email'];
        $changes=[];
        foreach ($fields as $field) if (array_key_exists($field,$data)) {
            $value=$data[$field];
            if (in_array($field,['gender','marriage','baptized'],true)) $value=contact_code($field,$value);
            elseif (in_array($field,['birthday','join_date','dataindate'],true)) {
                if ($value===null || $value==='') $value=null;
                elseif (!is_string($value) || !preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D',$value,$m) || !checkdate((int)$m[2],(int)$m[3],(int)$m[1])) throw new InvalidArgumentException('日期不正確。');
            } elseif ($field==='family_id') {
                if ($value==='' || $value===null) $value=null;
                elseif (!preg_match('/^[0-9]{1,18}$/D',(string)$value)) throw new InvalidArgumentException('家庭 ID 需為數字或留空。');
            } else { if (!is_scalar($value) && $value!==null) throw new InvalidArgumentException('欄位格式不正確。');$value=trim((string)$value); }
            $changes[$field]=$value;
        }
        if (isset($changes['name']) && $changes['name']==='') throw new InvalidArgumentException('姓名為必填。');
        $photoAction=$data['photo_action']??'keep';
        if (!in_array($photoAction,['keep','replace','remove'],true)) throw new InvalidArgumentException('照片操作不正確。');
        $newPhoto=$photoAction==='replace'?contact_photo_bytes($data['photo_base64']??null):null;
        $pdo->beginTransaction();
        $isNew=$action==='add_contact';
        if ($isNew) {
            if (empty($changes['name'])) throw new InvalidArgumentException('姓名為必填。');
            $id=(int)$pdo->query('SELECT COALESCE(MAX(church_id),0)+1 FROM members')->fetchColumn();
            $row=['church_id'=>$id,'note'=>'','photo_base64'=>null];
        } else {
            $id=(string)($data['church_id']??'');
            if (!preg_match('/^[1-9][0-9]{0,17}$/D',$id)) throw new InvalidArgumentException('人員編號格式不正確。');
            $stmt=$pdo->prepare('SELECT * FROM members WHERE church_id=? FOR UPDATE');$stmt->execute([$id]);$row=$stmt->fetch();
            if (!$row) throw new InvalidArgumentException('找不到人員資料。');
            foreach (($data['original_values']??[]) as $field=>$original) {
                if (in_array($field,array_merge($fields,['visitor_info']),true) && (string)($row[$field]??'')!==(string)($original??'')) {
                    $pdo->rollBack();http_response_code(409);echo json_encode(['success'=>false,'message'=>'這筆資料已在其他頁面更新，請重新整理後再修改。'],JSON_UNESCAPED_UNICODE);return;
                }
            }
            if ($photoAction!=='keep' && ($data['photo_version']??'')!==contact_photo_version($row)) {
                $pdo->rollBack();http_response_code(409);echo json_encode(['success'=>false,'message'=>'照片已被更新，請重新整理後再換圖。'],JSON_UNESCAPED_UNICODE);return;
            }
        }
        $note=$changes['note']??($row['note']??'');
        if (array_key_exists('visitor_choices',$data)) {
            $allowed=['我不是基督徒，願進一步了解基督教','我尚未受洗，願參加慕道班明白真理','我是基督徒，因臨時需要而參加貴堂之聚會','我是基督徒，我目前還沒有固定參加哪一個教會','我是基督徒，今後可能經常參加貴堂之聚會'];
            if (!is_array($data['visitor_choices']) || array_diff($data['visitor_choices'],$allowed)) throw new InvalidArgumentException('訪客選項不正確。');
            $note=preg_replace('/\s*[（(]訪客資訊[:：][^）)]*[）)]/u','',$note);
            if ($data['visitor_choices']) $note.=' (訪客資訊: '.implode('，',array_unique($data['visitor_choices'])).')';
            $changes['visitor_info']='';$changes['note']=$note;
        }
        if (array_key_exists('emergency_contact',$data)) {
            $emergency=$data['emergency_contact'];
            if (!is_array($emergency)) throw new InvalidArgumentException('緊急聯絡人格式不正確。');
            foreach (['name','phone','relation'] as $part) if (!is_scalar($emergency[$part]??'')) throw new InvalidArgumentException('緊急聯絡人格式不正確。');
            $note=preg_replace('/\s*\[緊急聯絡人:[^\]]*\]/u','',$note);
            $name=trim((string)($emergency['name']??''));$phone=trim((string)($emergency['phone']??''));$relation=trim((string)($emergency['relation']??''));
            if ($name!=='' || $phone!=='' || $relation!=='') $note.=" [緊急聯絡人: $name ($relation) $phone]";
            $changes['note']=$note;
        }
        if ($photoAction!=='keep') $changes['photo_base64']=null;
        if ($isNew) {
            $changes=['church_id'=>$id]+$changes;
            $columns=array_keys($changes);$stmt=$pdo->prepare('INSERT INTO members (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($columns),'?')).')');
            $stmt->execute(array_values($changes));
        } elseif ($changes) {
            $columns=array_map(function($f){return '`'.$f.'`=?';},array_keys($changes));
            $stmt=$pdo->prepare('UPDATE members SET '.implode(',',$columns).' WHERE church_id=?');$stmt->execute(array_merge(array_values($changes),[$id]));
        }
        if ($photoAction!=='keep') {
            $photoPath=contact_photo_path($id);$oldPhoto=is_file($photoPath)?file_get_contents($photoPath):null;
            $photoChanged=true;contact_write_photo($photoPath,$newPhoto);
        }
        $pdo->commit();echo json_encode(['success'=>true,'new_church_id'=>$id],JSON_UNESCAPED_UNICODE);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($photoChanged) { try { contact_write_photo($photoPath,$oldPhoto); } catch (Throwable $restore) { error_log('Contact photo rollback failed.'); } }
        $validation=$error instanceof InvalidArgumentException;
        http_response_code($validation?422:503);
        if (!$validation) error_log('Contact save failed: '.$error->getMessage());
        echo json_encode(['success'=>false,'message'=>$validation?$error->getMessage():'儲存未完成，資料未更新，請聯絡管理員。'],JSON_UNESCAPED_UNICODE);
    }
}
