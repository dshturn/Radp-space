# RADP API Reference

## Proxy Endpoint

All data operations go through the Vercel proxy (`api/index.js`).

### URL Format

```
GET/POST/PATCH/DELETE /api?endpoint={path}
```

### Example Requests

**List Assessments**:
```javascript
fetch('/api?endpoint=/rest/v1/assessments?contractor_id=eq.123', {
  headers: { Authorization: 'Bearer ' + token }
})
```

**Create Assessment**:
```javascript
fetch('/api?endpoint=/rest/v1/assessments', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ contractor_id: 123, field_well: 'Well A' })
})
```

**Update Assessment**:
```javascript
fetch('/api?endpoint=/rest/v1/assessments?id=eq.456', {
  method: 'PATCH',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ status: 'approved' })
})
```

**Delete Assessment**:
```javascript
fetch('/api?endpoint=/rest/v1/assessments?id=eq.456', {
  method: 'DELETE',
  headers: { Authorization: 'Bearer ' + token }
})
```

---

## Authentication

### Login
```javascript
await fetch('/api?endpoint=/auth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, grant_type: 'password' })
});
// Returns: { access_token, user: { id, email } }
```

### Get User Profile
```javascript
await fetch('/api?endpoint=/rest/v1/user_profiles?id=eq.{userId}', {
  headers: { Authorization: 'Bearer ' + token }
});
// Returns: [{ id, full_name, company, service_line, role, status }]
```

---

## Data Tables

### assessments
- **id** (uuid) — Primary key
- **contractor_id** (uuid) → user_profiles.id
- **field_well** (text) — Well name
- **type_of_job** (text) — Service type
- **objective** (text) — Short summary
- **company_name** (text) — Contractor company
- **sharepoint_request_id** (text) — External ID
- **status** (text) — draft | approved | rejected
- **created_at** (timestamp)
- **updated_at** (timestamp)

**Query Examples**:
```javascript
// Get contractor's assessments
/rest/v1/assessments?contractor_id=eq.123

// Get specific assessment with nested data
/rest/v1/assessments?id=eq.456&select=*,assessment_personnel(*,personnel(*))
```

### assessment_personnel
- **id** (uuid)
- **assessment_id** (uuid) → assessments.id
- **personnel_id** (uuid) → personnel.id

### assessment_equipment
- **id** (uuid)
- **assessment_id** (uuid) → assessments.id
- **equipment_items_id** (uuid) → equipment_items.id

### personnel
- **id** (uuid)
- **full_name** (text)
- **position** (text)
- **service_line** (text)
- **created_at** (timestamp)

### equipment_items
- **id** (uuid)
- **parent_id** (uuid) — For hierarchical equipment
- **serial_number** (text)
- **model** (text)
- **name** (text)
- **equipment_templates_id** (uuid) → equipment_templates.id
- **certification_expiry** (date)
- **dismissed** (boolean)

### user_profiles
- **id** (uuid) → auth.users.id
- **full_name** (text)
- **company** (text)
- **service_line** (text)
- **role** (text) — contractor | assessor | operations | admin
- **status** (text) — active | pending | rejected

### audit_log
- **id** (uuid)
- **actor_id** (uuid) → auth.users.id
- **entity_type** (text) — user | assessment | personnel | equipment | document
- **entity_id** (text)
- **action** (text) — created | updated | deleted | approved | rejected | uploaded | logged_in
- **label** (text) — Human-readable label
- **metadata** (jsonb) — Optional snapshot
- **created_at** (timestamp)

---

## Query Filters

### Operators
```
?id=eq.123          — equals
?status=neq.draft   — not equals
?id=in.(1,2,3)      — in list
?created_at=gt.2026-01-01  — greater than
?created_at=lt.2026-01-01  — less than
?name=like.*test*   — text search
?dismissed=is.false — boolean
```

### Sorting
```
?order=created_at   — ascending
?order=created_at.desc — descending
?order=name,created_at.desc — multiple
```

### Pagination
```
?limit=10           — limit rows
?offset=20          — skip rows
```

### Selection
```
?select=id,name     — specific columns
?select=*,personnel(*) — nested objects
```

**Example**:
```javascript
// Get last 10 personnel, sorted by name, with related equipment
/rest/v1/assessment_personnel?assessment_id=eq.123&limit=10&order=personnel_id&select=*,personnel(full_name)
```

---

## Response Headers

The proxy forwards these from Supabase:

```
Content-Type: application/json
Content-Range: items 0-9/100    — for pagination
x-total-count: 100              — total matching rows
```

---

## Error Responses

```javascript
{
  "code": "23505",
  "message": "duplicate key value violates unique constraint",
  "details": "...",
  "hint": "..."
}

// Or:
{
  "message": "Invalid login credentials"
}

// Or (401):
{
  "code": "401",
  "message": "Unauthorized"
}
```

---

## Common Patterns

### Fetch with Error Handling
```javascript
async function fetchAPI(endpoint, options = {}) {
  const url = `/api?endpoint=${encodeURIComponent(endpoint)}`;
  const res = await fetch(url, {
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    },
    ...options
  });
  
  if (res.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('radp_token');
    window.location.href = '/login';
    return null;
  }
  
  if (!res.ok) {
    const error = await res.json();
    console.error('API error:', error);
    return null;
  }
  
  return res.json();
}

// Usage:
const assessments = await fetchAPI('/rest/v1/assessments?limit=10');
```

### Batch Operations
```javascript
// Insert multiple rows
const results = await Promise.all([
  fetch('/api?endpoint=/rest/v1/personnel', {
    method: 'POST',
    body: JSON.stringify(person1)
  }),
  fetch('/api?endpoint=/rest/v1/personnel', {
    method: 'POST',
    body: JSON.stringify(person2)
  })
]);
```

### Nested Data Fetching
```javascript
// Get assessment with all related data
const [assessment] = await fetchAPI(
  `/rest/v1/assessments?id=eq.123&select=*,
   assessment_personnel(*,personnel(*)),
   assessment_equipment(*,equipment_items(*))`
);
```

---

## RLS Enforcement

Every query is filtered by Supabase RLS based on `auth.uid()`:

| Table | Contractor Access | Admin Access |
|-------|-------------------|--------------|
| assessments | Own only (contractor_id=id) | All |
| assessment_personnel | Own assessment's personnel only | All |
| assessment_equipment | Own assessment's equipment only | All |
| personnel | Own company's personnel only | All |
| equipment_items | Linked equipment only | All |
| user_profiles | Own profile only | All |
| audit_log | Own actions only | All |

**Example**: If contractor A requests `/rest/v1/assessments`, only their assessments are returned (enforced by RLS policy at database level).

---

## Production Considerations

### Rate Limiting
No explicit rate limit (Supabase free tier is generous). If needed, can add middleware in `api/index.js`.

### Caching
No caching layer (browser localStorage only). If needed, add Vercel KV.

### CORS
Handled by Vercel proxy (same-origin requests).

### Timeouts
Default 60 seconds. Increase in `api/index.js` if needed.

---

## Testing Locally

```bash
# Terminal 1
node server-local.js
# http://localhost:3000

# Terminal 2: test API
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3000/api?endpoint=/rest/v1/assessments?limit=1"
```

---

## Troubleshooting

**401 Unauthorized**:
- Check token in localStorage: `localStorage.getItem('radp_token')`
- Token may be expired (refresh via login)
- Check RLS policy allows the operation

**404 Not Found**:
- Check endpoint path (should start with `/rest/v1/` or `/auth/v1/`)
- Check table name spelling

**400 Bad Request**:
- Check endpoint is URL-encoded: `/api?endpoint=${encodeURIComponent(path)}`
- Check JSON body is valid

**500 Server Error**:
- Check Vercel function logs: `vercel logs`
- Check Supabase for database errors
