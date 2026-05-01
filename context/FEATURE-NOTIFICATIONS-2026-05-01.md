# Notifications System & Assessment Deletion Workflow

**Status**: Implemented | **Last Updated**: 2026-05-01

---

## Overview

RADP now has a centralized, event-driven notification system that tracks system events and routes notifications to relevant contractors. Key features:

- **Event-driven architecture**: All system events (assessment created, deletion requested, etc.) flow through a central pipeline
- **Contractor notifications**: Contractors see unread/read status for each notification
- **Admin notifications dashboard**: Admins can view all notifications with filtering, read/unread toggling, created/modified timestamps
- **Assessment deletion workflow**: Contractors request deletion → Admin approves/rejects
- **Automatic change tracking**: `modified_at` timestamp auto-updates whenever a notification is modified

---

## Data Model

### Tables

#### `notification_events` (transient event log)
Captures system events that trigger notifications.

```sql
CREATE TABLE notification_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,           -- deletion_requested, expiry_critical, etc.
  entity_type TEXT NOT NULL,          -- assessment, personnel, equipment, etc.
  entity_id TEXT,                     -- ID of the affected entity
  triggered_by UUID NOT NULL,         -- User who triggered the event
  metadata JSONB,                     -- {contractor_id, contractor_email, ...}
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `notification_rules` (configuration)
Maps event types to notification templates.

```sql
CREATE TABLE notification_rules (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT UNIQUE NOT NULL,       -- deletion_requested, expiry_critical, etc.
  target_role TEXT,                      -- contractor, admin, assessor (nullable = all)
  notification_template TEXT NOT NULL,   -- "Assessment {entity_id} deletion requested"
  active BOOLEAN DEFAULT TRUE
);
```

#### `notifications` (actual notifications for users)
End-user facing notifications, created by trigger from `notification_events`.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES user_profiles(id),
  type TEXT NOT NULL,                    -- deletion_requested, expiry_critical, etc.
  entity_type TEXT NOT NULL,             -- assessment, personnel, equipment, etc.
  entity_id TEXT,                        -- ID of affected entity
  entity_label TEXT,                     -- Human-readable description
  days_until INTEGER,                    -- For expiry alerts (null for others)
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `assessment_deletion_requests` (approval workflow)
Tracks contractor deletion requests awaiting admin action.

```sql
CREATE TABLE assessment_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  requested_by UUID NOT NULL REFERENCES user_profiles(id),
  status TEXT NOT NULL,                  -- pending, approved, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Workflows

### 1. Assessment Deletion Request Flow

**Actor**: Contractor with assessment

**Steps**:
1. Contractor clicks "Delete" on assessment card
2. System checks role:
   - **Contractor**: Shows confirmation → creates `assessment_deletion_requests` record (status=pending) → logs notification event
   - **Admin**: Direct delete of assessment + children (assessment_equipment, assessment_personnel) → logs audit
3. Notification event triggers database trigger `notify_on_event`
4. Trigger extracts `contractor_id` from metadata and creates notification
5. Admin sees deletion request in audit tab OR admin notifications tab
6. Admin approves/rejects:
   - **Approve**: Deletes assessment + children, deletes deletion request
   - **Reject**: Deletes deletion request, contractor can try again
7. Contractor can cancel pending request (status returns to draft)

**Files Involved**:
- `js/assessment.js:deleteAssessment()` — Request creation, contractor vs admin logic
- `js/admin.js:approveDeletion()`, `rejectDeletion()` — Admin actions
- Database trigger: `create_notifications_from_event()`

---

### 2. Notification Lifecycle

**Creation**:
1. System action occurs (assessment created, deletion requested, etc.)
2. `logNotificationEvent(eventType, entityType, entityId, metadata)` inserts into `notification_events`
3. Database trigger `notify_on_event` fires AFTER INSERT:
   - Looks up `notification_rules` for matching `event_type`
   - Extracts `contractor_id` from `metadata->>'contractor_id'` (fallback to `triggered_by`)
   - Inserts row into `notifications` table
   - Sets `read = FALSE`

**Contractor Viewing**:
- Contractors see notifications in the notification bell (top nav)
- Clicking notification marks it as read (updates `read = TRUE`, updates `modified_at`)
- Unread count shown in badge

**Admin Viewing**:
- Admins navigate to Notifications tab in main nav
- Table shows: User (email), Type, Label, Status (Read/Unread badge), Created, Modified, Action button
- Action button toggles read/unread status
- Admin can filter by user, type, date range (future enhancement)

---

## RLS Policies

### Notifications Table

```sql
-- Contractors see only their own notifications (read + update own)
CREATE POLICY "Contractors read own notifications" ON notifications
  FOR SELECT USING (contractor_id = auth.uid());

CREATE POLICY "Contractors update own notifications" ON notifications
  FOR UPDATE USING (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());

-- Admins can read all notifications
CREATE POLICY "Admins read all notifications" ON notifications
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins can update all notifications (for toggling read/unread)
CREATE POLICY "Admins update all notifications" ON notifications
  FOR UPDATE USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

### Assessment Deletion Requests Table

```sql
-- Contractors see own deletion requests
CREATE POLICY "Contractors read own deletion requests" ON assessment_deletion_requests
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM assessments WHERE id = assessment_id AND contractor_id = auth.uid()
  ));

-- Contractors can insert deletion requests for own assessments
CREATE POLICY "Contractors create deletion requests" ON assessment_deletion_requests
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM assessments WHERE id = assessment_id AND contractor_id = auth.uid()
  ));

-- Contractors can delete their own pending requests
CREATE POLICY "Contractors delete own deletion requests" ON assessment_deletion_requests
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM assessments WHERE id = assessment_id AND contractor_id = auth.uid()
  ) AND status = 'pending');

-- Admins can do everything
CREATE POLICY "Admins manage deletion requests" ON assessment_deletion_requests
  FOR ALL USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

---

## Database Trigger

### `notify_on_event` Trigger & Function

Fires AFTER INSERT on `notification_events`. Converts events into user notifications.

```sql
CREATE OR REPLACE FUNCTION create_notifications_from_event()
RETURNS TRIGGER AS $$
DECLARE
  rule RECORD;
  label TEXT;
  contractor_id UUID;
BEGIN
  -- Look up notification rule for this event_type
  SELECT * INTO rule FROM notification_rules WHERE event_type = NEW.event_type;
  IF rule IS NULL THEN RETURN NEW; END IF;
  
  -- Extract contractor_id from metadata, fallback to triggered_by
  contractor_id := (NEW.metadata->>'contractor_id')::UUID;
  IF contractor_id IS NULL THEN contractor_id := NEW.triggered_by; END IF;
  
  -- Substitute entity_id into template label
  label := REPLACE(rule.notification_template, '{entity_id}', COALESCE(NEW.entity_id::text, '?'));
  
  -- Insert notification for the contractor
  INSERT INTO notifications (contractor_id, type, entity_type, entity_id, entity_label, read)
  VALUES (contractor_id, NEW.event_type, NEW.entity_type, NEW.entity_id::text, label, FALSE);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_event
AFTER INSERT ON notification_events
FOR EACH ROW
EXECUTE FUNCTION create_notifications_from_event();
```

### `update_notifications_modified_at` Trigger

Auto-updates `modified_at` whenever a notification is changed.

```sql
CREATE OR REPLACE FUNCTION update_notifications_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_modified_at_trigger
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_modified_at();
```

---

## JavaScript Functions

### `logNotificationEvent(eventType, entityType, entityId, metadata)`
**File**: `js/shared.js`

Logs a system event that may trigger notifications.

```javascript
async function logNotificationEvent(eventType, entityType, entityId, metadata = {}) {
  const u = getUser();
  if (!u?.id) return;
  
  // 2-second deduplication cache
  const cacheKey = `${eventType}:${entityType}:${entityId}`;
  if (_eventCache.has(cacheKey)) return;
  _eventCache.add(cacheKey);
  setTimeout(() => _eventCache.delete(cacheKey), 2000);
  
  try {
    const res = await originalFetch(`${SUPABASE_URL}/rest/v1/notification_events`, {
      method: 'POST',
      headers: { ...getHeaders() },
      body: JSON.stringify({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        triggered_by: u.id,
        metadata: { ...metadata, contractor_id: metadata.contractor_id || u.id }
      })
    });
    if (res.ok) return;
    console.warn(`Event logging failed (${res.status}):`, cacheKey);
  } catch (err) {
    console.error(`Event logging error:`, err);
  }
}
```

**Usage Example** (Assessment Deletion):
```javascript
// Get assessment contractor_id
const assessRes = await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${id}&select=contractor_id`);
const assessment = (await assessRes.json())[0];

// Log the event with correct contractor_id
await logNotificationEvent('deletion_requested', 'assessment', id, { 
  contractor_id: assessment?.contractor_id,
  contractor_email: u.email 
});
```

### `loadAdminNotifications()`
**File**: `js/admin.js`

Fetches all notifications and renders admin table with read/unread status and timestamps.

**Table Columns**:
- User (contractor email)
- Type (event type)
- Label (human-readable description)
- Status (Read/Unread badge)
- Created (date)
- Modified (date)
- Action (Mark Read/Mark Unread button)

### `toggleNotifReadStatus(notifId, shouldBeRead)`
**File**: `js/admin.js`

PATCH notification to toggle read status. Uses `originalFetch` to bypass proxy wrapper.

---

## Assessment Deletion Request Admin Functions

### `loadDeletionRequests()`
**File**: `js/admin.js`

Fetches pending deletion requests and renders list.

### `approveDeletion(requestId)`
**File**: `js/admin.js`

Admin approves deletion: deletes assessment + children, deletes deletion request.

### `rejectDeletion(requestId)`
**File**: `js/admin.js`

Admin rejects deletion: deletes deletion request only, assessment remains.

### `adminCancelDeletion(id)` 
**File**: `js/admin.js`

Admin can cancel a deletion request (moves assessment status from `awaiting_deletion` back to `draft`).

---

## Frontend UI

### Contractor Notification Bell (Top Nav)
- Shows unread count in red badge
- Click opens panel with last 30 notifications (contractor's only)
- Each notification is clickable → marks as read
- "Mark all read" button

### Admin Notifications Tab
- Accessible from main nav (admin-only)
- Full table of all notifications
- Columns: User, Type, Label, Status (badge), Created, Modified, Action
- Action button: toggle read/unread
- Future: filters by user, type, date range

### Assessment Deletion Requests (Audit Tab)
- Section shows pending requests
- Admin can: Approve, Reject, or Cancel each request
- Contractor sees "awaiting_deletion" status badge on assessment card
- Contractor can click "Cancel Deletion Request" button

---

## API Endpoints

### Read Notifications (Contractor)
```
GET /rest/v1/notifications?contractor_id=eq.{user_id}&order=created_at.desc&limit=30
```

### Read All Notifications (Admin)
```
GET /rest/v1/notifications?order=created_at.desc&limit=100
```

### Update Notification Status
```
PATCH /rest/v1/notifications?id=eq.{notification_id}
Body: { "read": true|false }
```

### Log Notification Event
```
POST /rest/v1/notification_events
Body: {
  "event_type": "deletion_requested",
  "entity_type": "assessment",
  "entity_id": "24",
  "triggered_by": "{user_id}",
  "metadata": { "contractor_id": "{contractor_id}", "contractor_email": "..." }
}
```

### Get Deletion Requests
```
GET /rest/v1/assessment_deletion_requests?status=eq.pending&order=created_at.desc
```

---

## Migration Files

```sql
-- Add assessment_deletion_requests table
CREATE TABLE assessment_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES user_profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add modified_at to notifications
ALTER TABLE notifications ADD COLUMN modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create triggers (see above)
```

---

## Known Issues & Fixes

### Issue: Proxy intercepting PATCH requests
**Solution**: Use `originalFetch` instead of `fetch` to bypass global fetch wrapper

### Issue: contractor_id not properly tracked for multi-user contractors
**Solution**: Pass `contractor_id` explicitly in metadata when logging events, extract in trigger

### Issue: Old notifications have wrong contractor_id
**Solution**: Delete old test notifications, new events will have correct contractor

---

## Testing Checklist

- [ ] Contractor creates assessment
- [ ] Another contractor requests deletion
- [ ] Admin sees notification with correct contractor email
- [ ] Admin toggles read/unread status
- [ ] Modified_at timestamp updates
- [ ] Created vs Modified dates display correctly
- [ ] Contractor can cancel deletion request
- [ ] Admin can approve/reject deletion
- [ ] Assessment deleted completely (cascade delete works)
- [ ] RLS prevents contractor from seeing other contractors' notifications
- [ ] RLS prevents contractor from seeing admin notifications tab

---

**Document Owner**: Tech Lead  
**Last Updated**: 2026-05-01  
**Related Files**: assessment.js, admin.js, shared.js, index.html  
