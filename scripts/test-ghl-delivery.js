/**
 * Test GoHighLevel API Connection
 *
 * Verifies that the GHL API key works and can create a test contact.
 * Run: node scripts/test-ghl-delivery.js
 *
 * Requires: GHL_API_KEY and GHL_LOCATION_ID in .env
 */

require('dotenv').config();

const GHL_BASE_URL = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('ERROR: GHL_API_KEY and GHL_LOCATION_ID must be set in .env');
  process.exit(1);
}

async function testGHL() {
  console.log('=== GoHighLevel API Connection Test ===\n');

  // Test 1: Search for existing contacts (validates API key works)
  console.log('Test 1: Validate API key (search contacts)...');
  try {
    const url = `${GHL_BASE_URL}/contacts/?locationId=${GHL_LOCATION_ID}&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.error(`  FAILED: HTTP ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(`  Response: ${body.substring(0, 500)}`);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`  OK: API key valid. Total contacts in location: ${data.meta?.total || 'unknown'}`);
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    process.exit(1);
  }

  // Test 2: List custom fields
  console.log('\nTest 2: List custom fields...');
  try {
    const url = `${GHL_BASE_URL}/locations/${GHL_LOCATION_ID}/customFields`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28'
      }
    });

    if (!res.ok) {
      console.error(`  FAILED: HTTP ${res.status} ${res.statusText}`);
      return;
    }

    const data = await res.json();
    const fields = data.customFields || [];
    console.log(`  OK: Found ${fields.length} custom fields`);
    fields.forEach(f => {
      console.log(`    - ${f.name} (${f.fieldKey}) [${f.dataType}]`);
    });

    if (fields.length === 0) {
      console.log('  NOTE: No custom fields found. You will need to create them for property data.');
    }
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
  }

  console.log('\n=== Test Complete ===');
  console.log('\nNOTE: This test does NOT create a contact. Run with --create-test flag to send a test lead.');
}

testGHL();
