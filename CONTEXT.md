# RADP — Readiness Assessment Digital Platform
## Project Context for Claude Code

---

## 1. Project Overview

RADP is a web platform for managing contractor equipment readiness assessments at Saudi Aramco (Well Services department). It replaces a manual Excel-based process.

**Developer:** Dmitrii Shturn (NAWCOD, Well Services, Aramco)  
**Live URL:** https://radp-space.vercel.app (domain radp.space is blocked by Aramco network)  
**GitHub:** https://github.com/dshturn/Radp-space  
**Deployment:** Vercel (auto-deploy on push to main)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Hosting | Vercel |
| Auth | Supabase Auth (email/password) |

**Supabase project URL:** `https://fslleuedqlxpjnerruzt.supabase.co`  
**Supabase anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGxldWVkcWx4cGpuZXJydXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTMxMTksImV4cCI6MjA5MDU2OTExOX0.H1narO5BF5uF2KwlKtKvioz3mun2ecxb1Lg_xVDLdt4`  
**Supabase service role key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGxldWVkcWx4cGpuZXJydXp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk5MzExOSwiZXhwIjoyMDkwNTY5MTE5fQ.oY_dihwgMimesUsvHSuKNoJEXTb3c7vuqWKzeH2pwg4`

> ⚠️ Service role key is used in all frontend fetch calls (no RLS enforcement needed for now)

---

## 3. Database Schema (Supabase)

### `user_profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | FK → auth.users |
| email | text | |
| full_name | text | |
| company | text | e.g. Halliburton, SLB |
| service_line | text | e.g. Coil Tubing |
| role | text | default: 'contractor' |
| status | text | pending / approved / rejected |

Trigger: `on_auth_user_created` → auto-creates user_profiles row on signup.

### `companies`
| Column | Type |
|--------|------|
| id | int |
| name | text |

Values: SLB, Halliburton, Baker Hughes, Weatherford, Archer

### `service_lines`
| Column | Type |
|--------|------|
| id | int |
| name | text |

Values: Slickline, Coil Tubing, Cementing, Stimulation, Well Testing, Wireline

### `equipment_templates`
| Column | Type | Notes |
|--------|------|-------|
| id | int | |
| name | text | e.g. BOP Stack |
| service_line | text | |
| is_mandatory | bool | |

### `document_types`
| Column | Type | Notes |
|--------|------|-------|
| id | int | |
| equipment_template_id | int | FK → equipment_templates |
| document_name | text | e.g. COC, MPI, Visual Test |

### `equipment_items`
| Column | Type | Notes |
|--------|------|-------|
| id | int | |
| contractor_id | uuid | FK → auth.users |
| equipment_template_id | int | FK → equipment_templates |
| serial_number | text | |
| model | text | |

### `documents`
| Column | Type | Notes |
|--------|------|-------|
| id | int | |
| equipment_item_id | int | FK → equipment_items |
| document_type_id | int | FK → document_types |
| file_url | text | Supabase Storage URL |
| issue_date | date | |
| expiry_date | date | |
| ai_status | text | default: 'pending' |
| ai_notes | text | |

### `personnel`
| Column | Type | Notes |
|--------|------|-------|
| id | int | |
| contractor_id | uuid | FK → auth.users |
| full_name | text | |
| position | text | Job role |
| years_experience | int | |
| certificate_number | text | |
| expiry_date | date | |
| file_url | text | Supabase Storage URL |
| ai_status | text | |
| ai_notes | text | |

### `assessments`
| Column | Type | Notes |
|--------|------|-------|
| id | int | |
| contractor_id | uuid | FK → auth.users |
| sharepoint_request_id | text | Links to SharePoint record |
| field_well | text | e.g. MANIFA/MNIF-123 |
| type_of_job | text | From service_lines |
| objective | text | |
| date_of_issue | date | |
| status | text | draft / submitted / approved |
| created_at | timestamp | |

### `assessment_equipment`
| Column | Type | Notes |
|--------|------|-------|
| id | int | |
| assessment_id | int | FK → assessments |
| equipment_item_id | int | FK → equipment_items |
| readiness | text | default: 'Pending' |
| comment | text | |

### `assessment_personnel`
| Column | Type | Notes |
|--------|------|-------|
| id | int | |
| assessment_id | int | FK → assessments |
| personnel_id | int | FK → personnel |
| readiness | text | default: 'Pending' |
| comment | text | |

---

## 4. Storage Buckets

| Bucket | Purpose |
|--------|---------|
| `equipment-docs` | Equipment certificates (PDF, JPG, PNG) |
| `personnel-docs` | Personnel certificates (PDF, JPG, PNG) |

File URLs are public and directly accessible via browser.

---

## 5. Pages

### `index.html`
Landing page with navigation buttons to Contractor Portal and Admin Dashboard.

### `register.html`
Contractor registration form. Selects company and service_line from dropdowns (loaded from Supabase). Creates auth user + user_profiles row. Status defaults to 'pending'.

### `login.html`
Login form. After login checks user_profiles status:
- `pending` → show waiting message
- `rejected` → show rejection message  
- `approved` → redirect to contractor.html

Stores `radp_token` and `radp_user` (JSON with id, email, company, service_line) in localStorage.

### `contractor.html`
Main contractor workspace with two tabs:
- **Equipment tab:** Shows mandatory equipment templates for contractor's service_line + any additional equipment. Contractor can add equipment items and upload documents for each.
- **Personnel tab:** Add personnel, upload certificates.

### `admin.html`
Admin dashboard:
- **Pending Approval** tab: List of contractors waiting for approval. Approve/Reject buttons.
- **Approved Users** tab: List of approved contractors. Delete button.

### `assessment.html`
Assessment creation and management:
- List view: Shows all assessments for logged-in contractor
- Create view: Form with SharePoint Request ID, Field/Well, Type of Job (dropdown from service_lines), Objective
- Detail view: Tabs for Equipment and Personnel selection from contractor's pool
- Generate LoR button: Opens LoR in new window/tab

---

## 6. LoR (List of Readiness) Generation

LoR is generated as HTML in a new window. Key features:
- **Single unified table** (not two separate tables) for proper column alignment
- **Valid Till** = MIN of all expiry dates (personnel + equipment documents)
  - Red if expired
  - Yellow if expiring within 14 days
  - Green if valid
- Individual expiry date cells also color-coded
- **Left section** (contractor fills): contractor info, documents, expiry dates
- **Right section** (assessor fills): NAWCOD Unit, Auditor, Date of Audit, Readiness for Operations, Comment — light green background
- Print/Save as PDF button (hidden on print)
- `@page { size: A4 landscape; margin: 8mm }` for print

### LoR Table Structure (11 columns)
```
3% | 13% | 9% | 9% | 10% | 8% | 10% | 8% | 8% | 11% | 11%
 #   Name  Yrs  Role  Doc  Exp  NAWCOD Aud  Date  Ready  Comment
```
Info section (SP, Field, Type of Job, etc.) uses same 11-column colgroup with colspan merging.

---

## 7. SharePoint Integration

**Existing SharePoint dashboard:** `https://sharek.aramco.com.sa/modern/30037952/Pages/RADP/main.html`

This is a custom HTML/JS app that reads from SharePoint lists via REST API. Key files:
- `requests/script.js` — main script, click handlers
- `requests/renderRecord.js` — renders table rows (has Change button)
- `requests/renderActiveRequests.js` — renders Active Requests table
- `requests/index/script.js` — older version (not the active one)

### Integration Plan
Contractor enters SharePoint Request ID when creating assessment in RADP. SharePoint dashboard has "Open LoR" button (purple) added next to "Change" button in Active Requests table. Clicking it:
1. Fetches assessment from Supabase by `sharepoint_request_id`
2. Shows popup with full LoR table including clickable document links

**Modified files for SharePoint integration:**
- `requests/renderRecord.js` — Open LoR button added at lines 131, 206, 300
- `requests/script.js` — click handler + `showRadpLoR()` function appended at end

**Test file:** `test-lor.html` — standalone HTML to test Supabase lookup by Request ID before deploying to SharePoint.

---

## 8. Business Process Flow

```
1. Coordinator creates request in SharePoint → gets Request ID
2. Contractor receives Request ID
3. Contractor logs into RADP → creates assessment with Request ID
4. Contractor adds equipment and personnel from their pool
5. Contractor uploads certificates for all items
6. Contractor generates LoR → reviews it
7. Auditor opens SharePoint → clicks "Open LoR" on the request
8. Auditor reviews each document (clickable links to files)
9. Auditor fills in NAWCOD Unit, Auditor name, Date of Audit, Readiness
10. Final approval → Approved LoR issued
```

---

## 9. Pending / TODO

### High Priority
- [ ] Fix LoR table column alignment (info section borders don't perfectly match data section)
- [ ] Test SharePoint "Open LoR" button with real Request ID
- [ ] Add document validity filter in Equipment Selector (only show equipment with valid docs)

### Medium Priority
- [ ] Admin panel — manage equipment templates (add/edit/remove)
- [ ] AI document analysis — extract issue_date and expiry_date from uploaded PDFs using Claude API
- [ ] Auditor fills readiness in popup (save back to Supabase)

### Future
- [ ] Option 2 auditor flow — separate auditor login in RADP
- [ ] Email notifications
- [ ] Dashboard with assessment statistics

---

## 10. Key Decisions Made

- Used service_role key in frontend (simpler, no RLS complexity for MVP)
- Type of Job = service_lines table (same as contractor registration)
- Valid Till = MIN of ALL expiry dates (both personnel and equipment)
- LoR is HTML-generated (not Excel) — future plan to attach as PDF when closing SharePoint request
- SharePoint integration via `sharepoint_request_id` field linking the two systems
- Single unified table for LoR (not two tables) to ensure column alignment

---

## 11. Auth Pattern

All pages check `localStorage.getItem('radp_token')` on load. If missing → redirect to login.html.

```javascript
const token = localStorage.getItem('radp_token');
const user = JSON.parse(localStorage.getItem('radp_user') || '{}');
// user has: id, email, company, service_line

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

---

*Last updated: April 2026*
*This file should be updated whenever significant changes are made to the project.*
