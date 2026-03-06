# n8n Workflows — EquityPro Expired MLS Listings

## Workflow Overview

### 01 — MLS Replication + Skip Trace + Deliver
**Trigger:** Every 10 minutes

**Flow:**
1. **Get Last Timestamp** (Supabase node) — read last poll timestamp
2. **Query MLS Grid** (HTTP Request) — fetch expired listings since last timestamp
3. **Has Results?** (If) — skip if no new expireds
4. **Split Into Items** — break response array into individual listings
5. **Apply Client Filters** (If) — filter by county, price range
6. **Check Duplicate** (Supabase node) — skip if listing_key already exists
7. **Is New?** (If) — route new vs existing
8. **Transform Listing Data** (Code) — map MLS fields to DB columns, calculate days on market
9. **Insert Listing** (Supabase node) — save with status `pending_skip_trace`
10. **Check Billing Cap** (Supabase node) — read current month's usage
11. **Under Cap?** (If) — route to skip trace or cap_reached
12. **Build CSV for Tracerfy** (Code) — create CSV from address
13. **Submit to Tracerfy** (HTTP Request) — POST CSV for skip tracing
14. **Wait 60s** (Wait) — Tracerfy processes ~1 min per record
15. **Poll Tracerfy Results** (HTTP Request) — GET queue results
16. **Parse Trace Results** (Code) — extract phones, emails, owner name
17. **Store Trace Results** (Supabase node) — save enrichment data
18. **Build GHL Payload** (Code) — construct contact with custom fields
19. **Deliver to GoHighLevel** (HTTP Request) — POST to GHL API v2
20. **Log Delivery** (Supabase node) — audit trail
21. **Mark Delivered** (Supabase node) — update listing status
22. **Increment Counter** (Code) + **Update Billing** (Supabase node) — track usage

### 02 — Monthly Billing Reset
**Trigger:** 1st of every month at midnight

**Flow:**
1. **Create New Billing Row** (Supabase node) — reset counters for new month

## Setup in n8n

### 1. Create Supabase Credential
Settings → Credentials → New → Supabase
- **Host:** `https://ojxwxvrpcztbyxkagymd.supabase.co`
- **Service Role Key:** (from Supabase dashboard → Settings → API)
- Name it: `Supabase ALS Ops`

### 2. Set n8n Variables
Settings → Variables:

| Variable | Value |
|---|---|
| `MLSGRID_API_BASE_URL` | `https://api.mlsgrid.com/v2` |
| `MLSGRID_ACCESS_TOKEN` | Bearer token from MLS Grid |
| `SKIP_TRACE_API_KEY` | Tracerfy API key |
| `GHL_API_KEY` | GoHighLevel Private Integration API key |
| `GHL_LOCATION_ID` | GHL sub-account/location ID |
| `FILTER_COUNTIES` | `Orange,Seminole,Osceola` |
| `FILTER_MIN_PRICE` | `0` |
| `FILTER_MAX_PRICE` | `999999999` |

### 3. Import Workflows
Workflows → Import from File → select each JSON

### 4. Before Going Live
- [ ] Create GHL custom fields (Listing Price, Bedrooms, Bathrooms, etc.)
- [ ] Update custom field IDs in the "Build GHL Payload" Code node
- [ ] Test each node step-by-step using "Test Step"
- [ ] Verify Tracerfy CSV upload works (may need binary file config in n8n UI)
- [ ] Verify the Tracerfy response field names match the Parse Trace Results code
