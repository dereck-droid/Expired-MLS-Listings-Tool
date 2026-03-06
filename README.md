# EquityPro Expired MLS Listings Tool

Automated pipeline that detects expired MLS listings from Stellar MLS (MFRMLS) in near real-time, skip traces property owners for contact information, and delivers enriched leads to GoHighLevel CRM.

**Client:** Ben Yonge — EquityPro (Orlando, FL)
**Built by:** Advanced Lead Solutions

---

## How It Works

```
MLS Grid API ──> n8n (every 10 min) ──> Supabase ──> Tracerfy ──> GoHighLevel
```

1. **Poll MLS Grid** every 10 minutes for newly expired listings in the target counties
2. **Deduplicate** against previously seen listings stored in Supabase
3. **Filter** by county, property type, and price range
4. **Skip trace** the property owner via Tracerfy to get phone numbers and emails
5. **Deliver** the enriched lead as a contact into GoHighLevel with custom fields
6. **Track billing** against a monthly skip trace cap (200/month)

---

## Tech Stack

| Component | Purpose |
|---|---|
| **MLS Grid API v2** | Replication-based feed of MLS data from Stellar MLS (MFRMLS) |
| **n8n** | Workflow automation — polling, data transformation, API orchestration |
| **Supabase** | PostgreSQL database for listing storage, deduplication, billing tracking |
| **Tracerfy** | Skip trace provider — async CSV-based API for owner contact info |
| **GoHighLevel** | CRM — receives enriched leads as contacts with custom fields |

---

## Architecture

### Workflow 01 — MLS Replication + Skip Trace + Deliver

Runs every 10 minutes. The full node chain:

```
Schedule Trigger (10 min)
  |
  v
Get Last Timestamp (Supabase) ── read last poll cursor
  |
  v
Query MLS Grid (HTTP) ── fetch expired listings since last timestamp
  |
  +──> Update Replication Timestamp (Supabase) ── advance cursor
  |
  v
Has Results? (If)
  |── No  ──> done
  |── Yes ──v
Split Into Items
  |
  v
Apply Client Filters (If) ── county, price range (client-side)
  |
  v
Check Duplicate (Supabase) ── lookup by listing_key
  |
  v
Is New? (If)
  |── Already exists ──> skip
  |── New ──v
Transform Listing Data (Code) ── map MLS fields to DB columns
  |
  v
Insert Listing (Supabase) ── status: pending_skip_trace
  |
  v
Check Billing Cap (Supabase) ── current month usage
  |
  v
Under Cap? (If)
  |── Over cap ──> Mark Cap Reached (Supabase)
  |── Under cap ──v
Build CSV for Tracerfy (Code)
  |
  v
Submit to Tracerfy (HTTP) ── POST CSV
  |
  v
Wait 60s
  |
  v
Poll Tracerfy Results (HTTP) ── GET results
  |
  v
Parse Trace Results (Code) ── extract phones, emails, owner name
  |
  v
Store Trace Results (Supabase)
  |
  v
Build GHL Payload (Code) ── construct contact with custom fields
  |
  v
Deliver to GoHighLevel (HTTP) ── POST contact
  |
  +──> Log Delivery (Supabase) ── audit trail
  +──> Mark Delivered (Supabase) ── update listing status
  +──> Increment Counter (Code) ──> Update Billing (Supabase)
```

### Workflow 02 — Monthly Billing Reset

Runs on the 1st of every month at midnight. Creates a new `billing_tracker` row with counters reset to 0.

---

## Database Schema (Supabase)

**Project:** `ojxwxvrpcztbyxkagymd` (als-operations org)

| Table | Purpose |
|---|---|
| `replication_state` | Tracks `ModificationTimestamp` cursor for MLS Grid polling |
| `billing_tracker` | Monthly skip trace usage counter (cap: 200/month) |
| `expired_listings` | Core lead table — MLS data, address, price, status |
| `skip_trace_results` | Owner contact info from Tracerfy (phones, emails) |
| `delivery_log` | Audit trail for GHL deliveries |

### Listing Status Flow

```
pending_skip_trace ──> skip_traced ──> delivered
                  \──> cap_reached
                  \──> skip_trace_failed
                  \──> failed
```

---

## MLS Grid API Notes

- Uses a **replication model** — you track a `ModificationTimestamp` and poll for changes since your last cursor
- `StandardStatus` is searchable server-side (filter `eq 'Expired'`)
- `OriginatingSystemName` is searchable (filter `eq 'mfrmls'` for Stellar MLS)
- County and price range are **not** searchable server-side — filtered client-side in n8n
- Returns up to 200 records per request (`$top=200`)

---

## Environment Variables

See `.env.example` for the full template. Key variables:

| Variable | Description |
|---|---|
| `MLSGRID_ACCESS_TOKEN` | Bearer token for MLS Grid API |
| `SKIP_TRACE_API_KEY` | Tracerfy API key |
| `GHL_API_KEY` | GoHighLevel Private Integration API key |
| `GHL_LOCATION_ID` | GHL sub-account/location ID |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for n8n credential) |
| `FILTER_COUNTIES` | Comma-separated county list (e.g., `Orange,Seminole,Osceola`) |

These are configured as **n8n Variables** (Settings > Variables), not system env vars.

---

## Setup

### 1. Supabase

Database schema and seed data are already applied to the production project. Tables, indexes, RLS policies, and initial seed rows are in place.

### 2. n8n

See [`n8n/README.md`](n8n/README.md) for detailed setup:

1. Create the Supabase credential in n8n
2. Set n8n Variables (API keys, filter criteria)
3. Import the two workflow JSON files
4. Test each node step-by-step before activating

### 3. GoHighLevel

Before going live, create custom fields in GHL and update the field IDs in the "Build GHL Payload" Code node:

- Listing Price
- Original List Price
- Bedrooms / Bathrooms
- Square Footage / Year Built
- MLS Number
- Property Type / County
- Days on Market
- Listing Agent
- Expired Date

---

## Pending Before Launch

- [ ] MLS Grid API token from Ben
- [ ] GHL API key + Location ID from Ben
- [ ] Confirm filter criteria (counties, property types, price ranges)
- [ ] Create GHL custom fields and update field IDs in workflow
- [ ] Confirm Tracerfy API is re-enabled (pending confirmation from Michelle)
- [ ] Verify Tracerfy response field names match the Parse Trace Results code
- [ ] End-to-end test with real data

---

## File Structure

```
.
+-- README.md                  # This file
+-- .env.example               # Environment variable template
+-- .gitignore
+-- n8n/
    +-- README.md              # n8n-specific setup instructions
    +-- workflows/
        +-- 01-mls-replication-and-delivery.json
        +-- 02-monthly-reset.json
```
