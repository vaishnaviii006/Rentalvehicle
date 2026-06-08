/**
 * verify.js — Production Readiness Verification Script
 *
 * Run: node server/scripts/verify.js
 *
 * This script tests the full booking lifecycle end-to-end via the live API:
 *   Create → Pickup → Extend → DropOff → Settlement
 *
 * It verifies:
 *   - MongoDB connection
 *   - Billing calculations (no double-counting)
 *   - Settlement formula correctness
 *   - All snapshot fields are set correctly
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

const BASE_URL = process.env.VERIFY_BASE_URL || 'http://localhost:5000';
const CREATED_IDS = { bookingId: null, vehicleId: null };

let passed = 0;
let failed = 0;

// ─── Utilities ────────────────────────────────────────────────────────────────

const api = async (method, path, body) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, body: json };
};

const assert = (label, condition, details = '') => {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${details ? ` — ${details}` : ''}`);
    failed++;
  }
};

const section = (title) => {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(55));
};

// ─── Tests ────────────────────────────────────────────────────────────────────

async function checkDatabaseStatus() {
  section('1. Database Status');
  const { ok, body } = await api('GET', '/api/system/database-status');
  assert('Endpoint responds', ok, `status not ok`);
  assert('connected field exists', body.connected !== undefined);
  assert('mode field exists', typeof body.mode === 'string', `mode=${body.mode}`);
  if (body.connected) {
    console.log(`     Mode: MongoDB Connected → ${body.database} @ ${body.host}`);
    assert('Mode is mongodb', body.mode === 'mongodb');
  } else {
    console.log(`     ⚠️  Running in: ${body.mode}`);
  }
}

async function checkVehicleList() {
  section('2. Vehicle Listing');
  const { ok, body } = await api('GET', '/api/vehicles');
  assert('Vehicles endpoint responds', ok);
  assert('Returns an array', Array.isArray(body), `got: ${typeof body}`);
  assert('Has at least 1 vehicle', body.length > 0, `count=${body.length}`);
  if (body.length > 0) {
    const v = body.find(v => v.status === 'Available') || body[0];
    CREATED_IDS.vehicleId = v.vehicleId;
    assert('Vehicle has vehicleId', !!v.vehicleId);
    assert('Vehicle has name', !!v.name);
    assert('Vehicle has pricingPlans', !!v.pricingPlans);
    console.log(`     Using vehicle: ${v.name} (${v.vehicleId})`);
  }
}

async function createTestBooking() {
  section('3. Create Booking');
  const startDate = new Date();
  const expectedEnd = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // +24 hours

  const payload = {
    vehicleId: CREATED_IDS.vehicleId,
    customer: { name: 'VERIFY_TEST_CUSTOMER', phone: '9999999999' },
    rentalPeriod: {
      startDate: startDate.toISOString(),
      expectedEndDate: expectedEnd.toISOString()
    },
    selectedPlan: { planType: '24-Hour', rate: 1000, kmLimit: 250, extraKmCharge: 10, extraHourCharge: 80 },
    durationHours: 24,
    durationDays: 1,
    baseFare: 1000,
    advancePaid: 500,
    securityDeposit: 2000,
    paymentMode: 'Cash',
    paymentCollection: [{ mode: 'Cash', amount: 500, cashAmount: 500, workerId: 'VERIFY_SCRIPT' }],
    workerId: 'VERIFY_SCRIPT'
  };

  const { ok, status, body } = await api('POST', '/api/bookings', payload);
  assert('Booking created (201)', status === 201, `status=${status}, msg=${body.message}`);

  if (ok) {
    CREATED_IDS.bookingId = body.bookingId;
    console.log(`     Created: ${body.bookingId}`);
    assert('bookingId generated', !!body.bookingId);
    assert('rentalCost = baseFare', body.rentalCost === 1000, `rentalCost=${body.rentalCost}`);
    assert('depositHeld = 2000', body.depositHeld === 2000, `depositHeld=${body.depositHeld}`);
    assert('rentalPaid = 500', body.rentalPaid === 500, `rentalPaid=${body.rentalPaid}`);
    assert('outstandingRent = 500', body.outstandingRent === 500, `outstandingRent=${body.outstandingRent}`);
    assert('status is Reserved or Ongoing', ['Reserved', 'Ongoing'].includes(body.status), `status=${body.status}`);
    assert('vehicleDetails.name set', !!body.vehicleDetails?.name);
    assert('customer.name saved', body.customer?.name === 'VERIFY_TEST_CUSTOMER');
  }
}

async function pickupBooking() {
  section('4. Pickup');
  if (!CREATED_IDS.bookingId) { console.log('  ⏭  Skipped (no booking)'); return; }

  const { ok, body } = await api('POST', `/api/bookings/${CREATED_IDS.bookingId}/pickup`, {
    handover: { startMeter: 5000, fuelIncluded: false },
    workerId: 'VERIFY_SCRIPT',
    paymentCollection: { mode: 'Cash', amount: 0, workerId: 'VERIFY_SCRIPT' }
  });

  assert('Pickup succeeded', ok, body.message);
  if (ok) {
    assert('status = Ongoing', body.status === 'Ongoing', `status=${body.status}`);
    assert('actualPickupDate set', !!body.actualPickupDate);
    assert('handover.startMeter = 5000', body.handover?.startMeter === 5000, `meter=${body.handover?.startMeter}`);
  }
}

async function extendBooking() {
  section('5. Extend Booking (billing double-count test)');
  if (!CREATED_IDS.bookingId) { console.log('  ⏭  Skipped (no booking)'); return; }

  const newEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // Extension cost = 12 extra hours × ₹80/hr = ₹960
  // New rentalCost should be ₹1000 (original) + ₹960 (extension) = ₹1960
  const { ok, body } = await api('POST', `/api/bookings/${CREATED_IDS.bookingId}/extend`, {
    newEndDateTime: newEnd.toISOString(),
    extraCharges: 960,
    remarks: 'Verify extension',
    workerId: 'VERIFY_SCRIPT',
    durationHours: 36
  });

  assert('Extend succeeded', ok, body.message);
  if (ok) {
    assert('status = Extended', body.status === 'Extended', `status=${body.status}`);
    // billingEngine: newRentalCost = 1000 + 960 = 1960 (not 1000+960+anything extra)
    assert('rentalCost = 1960 (no double-count)', body.rentalCost === 1960, `rentalCost=${body.rentalCost}`);
    assert('expectedReturnDate updated', !!body.expectedReturnDate);
    assert('extensions[] has 1 entry', body.extensions?.length === 1, `count=${body.extensions?.length}`);
  }
}

async function dropOffBooking() {
  section('6. Drop-Off & Settlement');
  if (!CREATED_IDS.bookingId) { console.log('  ⏭  Skipped (no booking)'); return; }

  // End meter 5300 = 300km driven, limit 250km, extra 50km × ₹10 = ₹500
  // actualBill = rentalCost(1960) + extraKm(500) = ₹2460
  // rentalPaid = 500
  // netDue = 2460 - 500 = 1960
  // depositAdjustment = min(2000, 1960) = 1960
  // finalRefund = 2000 - 1960 = 40
  // finalCollection = max(0, 1960 - 1960) = 0

  const { ok, body } = await api('POST', `/api/bookings/${CREATED_IDS.bookingId}/dropoff`, {
    dropDetails: {
      endMeter: 5300,
      vehicleCondition: 'Good',
      damageCharges: 0,
      cleaningCharges: 0,
      otherCharges: 0
    },
    workerId: 'VERIFY_SCRIPT'
  });

  assert('Drop-off succeeded', ok, body.message);
  if (ok) {
    assert('status = Completed', body.status === 'Completed', `status=${body.status}`);
    assert('actualReturnDate set', !!body.actualReturnDate);

    const s = body.settlement;
    assert('settlement.actualBill = 2460', s?.actualBill === 2460, `actualBill=${s?.actualBill}`);
    assert('settlement.collectAmount = 0', s?.collectAmount === 0, `collectAmount=${s?.collectAmount}`);
    assert('settlement.refundAmount = 40', s?.refundAmount === 40, `refundAmount=${s?.refundAmount}`);
    assert('settlement.depositAdjustment = 1960', s?.depositAdjustment === 1960, `depositAdjustment=${s?.depositAdjustment}`);

    console.log(`\n     Settlement Breakdown:`);
    console.log(`       Rental Cost:          ₹${body.rentalCost}`);
    console.log(`       Actual Bill:          ₹${s?.actualBill}`);
    console.log(`       Rental Paid:          ₹${s?.previousPaid || body.rentalPaid}`);
    console.log(`       Net Due:              ₹${s?.remainingToPay}`);
    console.log(`       Deposit Held:         ₹${s?.depositCollected || body.depositHeld}`);
    console.log(`       Deposit Adjustment:   ₹${s?.depositAdjustment}`);
    console.log(`       Final Refund:         ₹${s?.refundAmount}`);
    console.log(`       Final Collection:     ₹${s?.collectAmount}`);
  }
}

async function verifyDailyHisab() {
  section('7. Daily Hisab (Accounting)');
  const today = new Date().toISOString().slice(0, 10);
  const { ok, body } = await api('GET', `/api/accounting?date=${today}&workerId=VERIFY_SCRIPT`);
  assert('Accounting endpoint responds', ok, body.message);
  if (ok) {
    assert('summary object present', !!body.summary);
    assert('bookings array present', Array.isArray(body.bookings));
    assert('workerSettlement present', !!body.workerSettlement);
    console.log(`     Today's summary: revenue=₹${body.summary?.totalRevenue}, outstanding=₹${body.summary?.totalOutstanding}`);
  }
}

async function cleanupTestData() {
  section('8. Cleanup Test Data');
  if (!CREATED_IDS.bookingId) { console.log('  ⏭  Skipped'); return; }
  // Cancel the test booking
  const { ok } = await api('PATCH', `/api/bookings/${CREATED_IDS.bookingId}/cancel`);
  assert('Test booking cleaned up', ok);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Rental Vehicle System — Production Readiness Check  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Time:   ${new Date().toISOString()}`);

  try {
    await checkDatabaseStatus();
    await checkVehicleList();
    await createTestBooking();
    await pickupBooking();
    await extendBooking();
    await dropOffBooking();
    await verifyDailyHisab();
    await cleanupTestData();
  } catch (err) {
    console.error('\n  🔴 Unexpected error:', err.message);
    failed++;
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed} passed, ${failed} failed                          ║`.substring(0, 57) + '║');
  if (failed === 0) {
    console.log('║  ✅ System is PRODUCTION READY                        ║');
  } else {
    console.log('║  ❌ System has FAILING CHECKS — not production ready  ║');
  }
  console.log('╚══════════════════════════════════════════════════════╝\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
