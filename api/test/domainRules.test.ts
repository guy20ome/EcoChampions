import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCombinedScoreFromLogs,
  getSignificantChangeEvent,
  shouldCreateFirstReport,
} from '../src/services/domainRules.js';

test('combined score requires all four indicators', () => {
  const entries = [
    { value: 100, lowerIsBetter: true },
    { value: 20, lowerIsBetter: true },
    { value: 50, lowerIsBetter: true },
    { value: 80, lowerIsBetter: false },
  ];

  assert.equal(calculateCombinedScoreFromLogs(entries.slice(0, 3)), null);
  assert.equal(calculateCombinedScoreFromLogs(entries), 290);
});

test('significant change uses the 25 percent threshold and indicator direction', () => {
  assert.equal(getSignificantChangeEvent(125, 100, true), 'significant_increase');
  assert.equal(getSignificantChangeEvent(75, 100, true), 'significant_decrease');
  assert.equal(getSignificantChangeEvent(125, 100, false), 'significant_decrease');
  assert.equal(getSignificantChangeEvent(75, 100, false), 'significant_increase');
  assert.equal(getSignificantChangeEvent(124, 100, true), null);
  assert.equal(getSignificantChangeEvent(125, 0, true), null);
});

test('only the first bulk entry for a new user creates a first-report event', () => {
  assert.equal(shouldCreateFirstReport(0, 0), true);
  assert.equal(shouldCreateFirstReport(0, 1), false);
  assert.equal(shouldCreateFirstReport(1, 0), false);
});
