# API 盤點

以下是目前前端程式碼中已盤點到的後端 API。後端原始碼尚未從 192.168.16.240 拉回本機，因此此文件先作為補齊後端與測試案例的依據。

## 前台

### `GET api/events.php`

用途：取得活動清單，供「成主課程」與「特別聚會」選擇。

前端期望回傳：

```json
{
  "success": true,
  "events": [
    {
      "id": 1,
      "name": "活動名稱",
      "type": "course"
    }
  ]
}
```

`type` 目前前端使用：

- `course`：成主課程
- `special`：特別聚會

### `GET api/sections.php`

用途：取得牧區、小組與同工單位資料。

前端期望回傳：

```json
{
  "success": true,
  "sections": {
    "牧區名稱": ["小組名稱"]
  }
}
```

### `POST api/checkin.php`

用途：掃描條碼或手動搜尋後執行報到。

掃描報到 payload：

```json
{
  "qr_code_id": "活石條碼或 QR Code 內容",
  "mode": "主日聚會",
  "event_id": null,
  "target_section": null,
  "target_group": null,
  "target_unit": null
}
```

手動搜尋 payload 會額外帶入：

```json
{
  "is_manual_search": true
}
```

前端支援的 `mode`：

- `主日聚會`
- `成主課程`
- `牧區小組聚會`
- `同工打卡`
- `特別聚會`

## 後台

### `GET api/login.php?action=check`

用途：檢查後台登入狀態。

### `GET api/login.php?action=logout`

用途：後台登出。

### `api/admin.php`

`admin.js` 透過 `action` 參數集中呼叫後台功能。

已盤點 action：

- `get_logs`
- `get_events`
- `add_event`
- `update_event`
- `delete_event`
- `get_registrations`
- `add_registration`
- `update_payment`
- `delete_registration`
- `get_employees`
- `add_employee`
- `update_employee`
- `delete_employee`
- `search_contacts`
- `get_contact`
- `add_contact`
- `update_contact`
- `get_original_photo`

## 待補檔案

建議從伺服器補齊以下後端檔案後納入版本管理：

- `api/login.php`
- `api/admin.php`
- `api/events.php`
- `api/sections.php`
- `api/checkin.php`
- 資料庫 schema / migration
- `.env.example`，只放環境變數名稱，不放真實密碼

