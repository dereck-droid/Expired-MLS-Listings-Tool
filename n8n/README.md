# n8n Workflows — EquityPro Expired MLS Listings

## Workflow Overview

### 01 — MLS Replication + Skip Trace + Deliver
**Trigger:** Every 10 minutes

**Flow:**
1. Read last poll timestamp from Supabase
2. Query MLS Grid for expired listings modified since last timestamp
3. Filter by client criteria (county, price range)
4. Deduplicate against Supabase
5. Insert new leads into `expired_listings` table
6. Check monthly skip trace cap
7. If under cap: submit to Tracerfy → wait ~60s → poll results
8. Store skip trace results in Supabase
9. Deliver enriched lead to GoHighLevel
10. Log delivery, increment billing counter
11. Update replication timestamp

### 02 — Monthly Billing Reset
**Trigger:** 1st of every month at midnight

**Flow:**
1. Creates a new `billing_tracker` row with skip_traces_used = 0

## Setup Instructions

### Prerequisites
- n8n instance (self-hosted on Railway or similar)
- API credentials for: MLS Grid, Tracerfy, GoHighLevel, Supabase

### Import Workflows
1. Open your n8n instance
2. Go to Workflows → Import from File
3. Import each JSON file from this directory

### Configure n8n Variables
Set these as n8n Variables (Settings → Variables):

| Variable | Description |
|---|---|
| `SUPABASE_URL` | `https://nffwmjabrnjqealtpehs.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase dashboard |
| `MLSGRID_API_BASE_URL` | `https://api.mlsgrid.com/v2` |
| `MLSGRID_ACCESS_TOKEN` | Bearer token from MLS Grid |
| `SKIP_TRACE_API_KEY` | Tracerfy API key |
| `GHL_API_KEY` | GoHighLevel Private Integration API key |
| `GHL_LOCATION_ID` | GHL sub-account/location ID |
| `FILTER_COUNTIES` | Comma-separated: `Orange,Seminole,Osceola` |
| `FILTER_MIN_PRICE` | e.g., `0` |
| `FILTER_MAX_PRICE` | e.g., `999999999` |

### Important Notes

**Placeholders:** Several nodes contain `REPLACE_WITH_*` values that need Code nodes
inserted during implementation. These transform data between steps:
- Building CSV for Tracerfy from listing address
- Parsing Tracerfy response into structured phone/email arrays
- Building GHL payload with customFields array
- Computing MAX ModificationTimestamp for replication state updates
- Read-modify-write pattern for incrementing billing counter

**Pagination:** The MLS Grid query uses `$top=200`. If there are more than 200
expired listings in a 10-minute window (unlikely), the workflow needs a loop
to follow `@odata.nextLink`. This can be added if needed.

**Error Handling:** Add error handling nodes around:
- MLS Grid API calls (retry with backoff)
- Tracerfy submissions (retry, mark as failed)
- GHL delivery (retry, log failures)
- Never update replication timestamp if the run failed

**GHL Custom Fields:** Before the workflow will work, you need to create custom
fields in GHL for: Listing Price, Original List Price, Bedrooms, Bathrooms,
Square Footage, Year Built, MLS Number, Property Type, County, Days on Market,
Previous Listing Agent. Then update the Code node with the custom field IDs.
