/**
 * Test Tracerfy Skip Trace API Connection
 *
 * Submits a test address to Tracerfy and polls for results.
 * Run: node scripts/test-skip-trace.js
 *
 * Requires: SKIP_TRACE_API_KEY in .env
 *
 * Tracerfy API flow:
 *   1. POST CSV to /v1/api/trace/ → get queue_id
 *   2. Poll GET /v1/api/queue/{queue_id} until complete
 *   3. Parse results (phones, emails, owner name)
 */

require('dotenv').config();

const API_KEY = process.env.SKIP_TRACE_API_KEY;

if (!API_KEY) {
  console.error('ERROR: SKIP_TRACE_API_KEY not set in .env');
  process.exit(1);
}

const BASE_URL = 'https://tracerfy.com/v1/api';

// Test address — use a known property address
const TEST_ADDRESS = {
  address: '123 Main St',
  city: 'Orlando',
  state: 'FL'
};

async function submitTrace(address, city, state) {
  // Tracerfy expects a CSV file upload via multipart form data
  const csvContent = `address,city,state\n${address},${city},${state}`;
  const blob = new Blob([csvContent], { type: 'text/csv' });

  const formData = new FormData();
  formData.append('csv_file', blob, 'trace.csv');
  formData.append('address_column', 'address');
  formData.append('city_column', 'city');
  formData.append('state_column', 'state');

  const res = await fetch(`${BASE_URL}/trace/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    },
    body: formData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit failed: HTTP ${res.status} — ${text}`);
  }

  return await res.json();
}

async function pollResults(queueId, maxAttempts = 12, intervalMs = 10000) {
  for (let i = 1; i <= maxAttempts; i++) {
    console.log(`  Polling attempt ${i}/${maxAttempts}...`);

    const res = await fetch(`${BASE_URL}/queue/${queueId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Poll failed: HTTP ${res.status} — ${text}`);
    }

    const data = await res.json();

    if (data.status === 'completed' || data.status === 'done') {
      return data;
    }

    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(`Trace failed: ${JSON.stringify(data)}`);
    }

    console.log(`  Status: ${data.status} — waiting ${intervalMs / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out waiting for trace results');
}

async function checkCredits() {
  const res = await fetch(`${BASE_URL}/analytics/`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });

  if (!res.ok) {
    console.log('  Could not fetch analytics');
    return null;
  }

  return await res.json();
}

async function testSkipTrace() {
  console.log('=== Tracerfy Skip Trace API Test ===\n');

  // Test 1: Check account/credits
  console.log('Test 1: Check account credits...');
  try {
    const analytics = await checkCredits();
    if (analytics) {
      console.log(`  OK: Account analytics:`, JSON.stringify(analytics, null, 2));
    }
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
  }

  // Test 2: Submit a trace
  console.log(`\nTest 2: Submit trace for ${TEST_ADDRESS.address}, ${TEST_ADDRESS.city}, ${TEST_ADDRESS.state}...`);
  try {
    const submission = await submitTrace(
      TEST_ADDRESS.address,
      TEST_ADDRESS.city,
      TEST_ADDRESS.state
    );
    console.log(`  OK: Queue created — ID: ${submission.queue_id}, Status: ${submission.status}`);

    // Test 3: Poll for results
    console.log('\nTest 3: Polling for results (this may take 1-2 minutes)...');
    const results = await pollResults(submission.queue_id);
    console.log(`  OK: Results received`);
    console.log(`  Full response:`, JSON.stringify(results, null, 2));
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
  }

  console.log('\n=== Test Complete ===');
}

testSkipTrace();
