// Demo rehearsal: simulate the exact on-stage clicks at engine level.
// Clicks: 1) lane Cinder  2) bet 100  3) lane Boreas  4) bet 100
//         5) 开始一局    6) ⏩ 快进到结算
// Seed 42 / 60 days is the DEFAULT demo round — winner is known in advance.
import * as Engine from "./engine.js";

const t0 = Date.now();
const SEED = 42, DAYS = 60;

// --- Click 1-4: two bets (Cinder wins, Boreas loses) ---
const epochId = Engine.epochIdFor(SEED, DAYS, 4, 5, 0, 10);
let bets = [];
bets = Engine.placeBet(bets, { player: "demo", civ: 2, amount: 10000, epochId, validCivs: [0, 1, 2, 3] }); // Cinder = 2
bets = Engine.placeBet(bets, { player: "demo", civ: 1, amount: 10000, epochId, validCivs: [0, 1, 2, 3] }); // Boreas = 1
console.log(`bets placed: Cinder 100 + Boreas 100, pool = ${bets.reduce((s, b) => s + b.amount, 0) / 100}`);

// --- Click 5-6: start + fast-forward = step 60 days x 4 civs synchronously ---
const ff0 = Date.now();
const result = Engine.runEpoch({ seed: SEED, days: DAYS, civs: 4, residentsPerCiv: 5, taxBps: 0, maxOrders: 10 });
const ffMs = Date.now() - ff0;
console.log(`fast-forward: ${DAYS} days x 4 civs in ${ffMs}ms`);
console.log(`winner: ${Engine.CIV_NAMES[result.winner]} (${result.winner_name}) | digest ${result.digest.slice(0, 16)}…`);

// --- Settle ---
const settlement = Engine.settleEpoch(result, bets);
console.log(`outcome: ${settlement.outcome} | pool ${settlement.pool / 100} | payouts:`,
  settlement.payouts.map((p) => `${Engine.CIV_NAMES[p.civ]} stake ${p.stake / 100} -> ${p.payout / 100} (profit ${p.profit / 100})`).join(" ; "));
const totalPaid = settlement.payouts.reduce((s, p) => s + p.payout, 0);
console.log(`payouts sum == pool: ${totalPaid === settlement.pool}`);

// --- Assertions: the demo beats that must hold on stage ---
const checks = [
  ["winner is Cinder (seed 42 / 60d, known in advance)", result.winner === 2],
  ["Cinder bet returns 200 (profit +100)", settlement.payouts[0].payout === 20000 && settlement.payouts[0].profit === 10000],
  ["Boreas bet returns 0 (lost)", settlement.payouts[1].payout === 0],
  ["payouts sum == pool", totalPaid === settlement.pool],
  ["fast-forward < 1s", ffMs < 1000],
];
let ok = true;
for (const [name, pass] of checks) { console.log(`${pass ? "PASS" : "FAIL"} ${name}`); if (!pass) ok = false; }
console.log(`total rehearsal wall time: ${Date.now() - t0}ms`);
process.exit(ok ? 0 : 1);
