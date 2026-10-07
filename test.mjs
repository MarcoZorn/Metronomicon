// Self-check: node test.mjs
import assert from 'node:assert/strict';
import { beatToTime, timeToBeat, judge, nearestBeat, median } from './js/timing.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

// beats -> seconds
near(beatToTime(0, 120), 0);
near(beatToTime(4, 120), 2);
near(beatToTime(4, 120, 0.25), 2.25);
near(beatToTime(1, 90), 2 / 3);
near(timeToBeat(beatToTime(37.5, 133, 0.1), 133, 0.1), 37.5);

// judge windows (inclusive edges)
assert.equal(judge(0), 'Perfect');
assert.equal(judge(0.040), 'Perfect');
assert.equal(judge(-0.040), 'Perfect');
assert.equal(judge(0.041), 'Good');
assert.equal(judge(-0.100), 'Good');
assert.equal(judge(0.101), 'Miss');
assert.equal(judge(-0.3), 'Miss');

// nearest beat
let n = nearestBeat(2.03, 120);
assert.equal(n.beat, 4); near(n.delta, 0.03);
n = nearestBeat(1.8, 120);
assert.equal(n.beat, 4); near(n.delta, -0.2);

assert.equal(median([5, 1, 3]), 3);
assert.equal(median([4, 1, 3, 2]), 2.5);

console.log('timing self-check ok');
