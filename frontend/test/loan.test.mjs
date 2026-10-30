import test from 'node:test';
import assert from 'node:assert/strict';
import { emi, loanSummary, eligibleLoan } from '../src/utils/loan.js';

test('emi matches the standard formula', () => {
  // ₹50 L at 8.5% for 20 years ≈ ₹43,391/month (widely published figure)
  assert.equal(Math.round(emi(5000000, 8.5, 20)), 43391);
  assert.equal(emi(1200000, 0, 1), 100000, 'zero interest is principal / months');
  assert.equal(emi(0, 8.5, 20), 0);
  assert.equal(emi(5000000, 8.5, 0), 0);
});

test('loan summary totals are consistent', () => {
  const s = loanSummary(5000000, 8.5, 20);
  assert.equal(Math.round(s.totalPayable), Math.round(s.emi * 240));
  assert.equal(Math.round(s.totalInterest), Math.round(s.totalPayable - 5000000));
});

test('eligibility inverts the EMI formula at 50% of income', () => {
  const { maxEmi, maxLoan } = eligibleLoan(100000, 10000, 8.5, 20);
  assert.equal(maxEmi, 40000);
  assert.equal(Math.round(emi(maxLoan, 8.5, 20)), 40000);
  assert.deepEqual(eligibleLoan(10000, 9000, 8.5, 20), { maxEmi: 0, maxLoan: 0 }, 'no capacity left');
});
