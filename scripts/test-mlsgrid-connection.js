/**
 * Test MLS Grid API Connection
 *
 * Verifies that the API token works and returns data for Stellar MLS (mfrmls).
 * Run: node scripts/test-mlsgrid-connection.js
 *
 * Requires: MLSGRID_ACCESS_TOKEN in .env
 */

require('dotenv').config();

const BASE_URL = process.env.MLSGRID_API_BASE_URL || 'https://api.mlsgrid.com/v2';
const TOKEN = process.env.MLSGRID_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('ERROR: MLSGRID_ACCESS_TOKEN not set in .env');
  process.exit(1);
}

async function testConnection() {
  console.log('=== MLS Grid API Connection Test ===\n');

  // Test 1: Basic connectivity — fetch a small set of records
  console.log('Test 1: Basic connectivity...');
  try {
    const url = `${BASE_URL}/Property?$filter=OriginatingSystemName eq 'mfrmls' and MlgCanView eq true&$top=5`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (!res.ok) {
      console.error(`  FAILED: HTTP ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(`  Response: ${body.substring(0, 500)}`);
      process.exit(1);
    }

    const data = await res.json();
    const records = data.value || [];
    console.log(`  OK: Got ${records.length} records`);

    if (records.length > 0) {
      const sample = records[0];
      console.log(`  Sample ListingKey: ${sample.ListingKey}`);
      console.log(`  Sample StandardStatus: ${sample.StandardStatus}`);
      console.log(`  Sample PropertyType: ${sample.PropertyType}`);
      console.log(`  Sample City: ${sample.City}`);
      console.log(`  Sample ModificationTimestamp: ${sample.ModificationTimestamp}`);
      console.log(`  MlgCanView: ${sample.MlgCanView}`);
    }
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    process.exit(1);
  }

  // Test 2: Query for expired listings specifically
  console.log('\nTest 2: Query for expired listings...');
  try {
    const url = `${BASE_URL}/Property?$filter=OriginatingSystemName eq 'mfrmls' and StandardStatus eq 'Expired'&$top=5`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (!res.ok) {
      console.error(`  FAILED: HTTP ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(`  Response: ${body.substring(0, 500)}`);
      return;
    }

    const data = await res.json();
    const records = data.value || [];
    console.log(`  OK: Got ${records.length} expired records`);

    if (records.length > 0) {
      const sample = records[0];
      console.log(`  Sample Expired Listing:`);
      console.log(`    ListingKey: ${sample.ListingKey}`);
      console.log(`    Address: ${sample.UnparsedAddress || `${sample.StreetNumber} ${sample.StreetName} ${sample.StreetSuffix}`}`);
      console.log(`    City: ${sample.City}, ${sample.StateOrProvince} ${sample.PostalCode}`);
      console.log(`    County: ${sample.CountyOrParish}`);
      console.log(`    ListPrice: $${sample.ListPrice}`);
      console.log(`    PropertyType: ${sample.PropertyType}`);
      console.log(`    Bedrooms: ${sample.BedroomsTotal}, Bathrooms: ${sample.BathroomsTotalInteger}`);
      console.log(`    ListingContractDate: ${sample.ListingContractDate}`);
      console.log(`    ModificationTimestamp: ${sample.ModificationTimestamp}`);
      console.log(`    ListAgentFullName: ${sample.ListAgentFullName}`);
    }
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
  }

  // Test 3: Replication query (ModificationTimestamp filter)
  console.log('\nTest 3: Replication-style query (last 24 hours)...');
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const url = `${BASE_URL}/Property?$filter=OriginatingSystemName eq 'mfrmls' and ModificationTimestamp gt ${yesterday} and StandardStatus eq 'Expired'&$top=10`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (!res.ok) {
      console.error(`  FAILED: HTTP ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(`  Response: ${body.substring(0, 500)}`);
      return;
    }

    const data = await res.json();
    const records = data.value || [];
    console.log(`  OK: Got ${records.length} expired records modified in last 24h`);
    console.log(`  Has nextLink: ${!!data['@odata.nextLink']}`);

    records.forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.ListingKey} — ${r.City}, ${r.CountyOrParish} — $${r.ListPrice} — Modified: ${r.ModificationTimestamp}`);
    });
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
  }

  console.log('\n=== Test Complete ===');
}

testConnection();
