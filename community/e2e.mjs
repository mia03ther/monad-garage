// Runs the full HTTP -> bounded relay -> real Anvil -> contract -> three clients flow.
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { CommunityGateway } from "./gateway.js";
import { power } from "./domain.js";
const python = process.env.GENESIS_PYTHON ?? "python";
const child = spawn(
  python,
  ["-m", "genesis.live", "--port", "0", "--control-stdin"],
  {
    cwd: new URL("../../", import.meta.url),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  },
);
let errorOutput = "";
child.stderr.on("data", (b) => (errorOutput += b.toString()));
const ready = await new Promise((resolve, reject) => {
  let text = "";
  const timeout = setTimeout(
    () => reject(Error("server startup timeout: " + errorOutput)),
    30000,
  );
  child.on("error", reject);
  child.on("exit", (code) => {
    clearTimeout(timeout);
    reject(Error("server exited " + code + ": " + errorOutput));
  });
  child.stdout.on("data", (b) => {
    text += b.toString();
    if (text.includes("\n")) {
      try {
        const d = JSON.parse(text.split("\n")[0]);
        clearTimeout(timeout);
        resolve(d);
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    }
  });
}).catch((e) => {
  child.stdin.end("q");
  throw e;
});
const base = "http://127.0.0.1:" + ready.port,
  build = JSON.parse(
    await readFile(new URL("./build.json", import.meta.url), "utf8"),
  );
let instance = ready.instance;
async function mined(gateway, tx) {
  for (let i = 0; i < 100; i++) {
    const r = await gateway.receipt(tx);
    if (r) {
      assert.equal(r.status, "0x1");
      return r;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("mining timeout");
}
function client() {
  let cookie = "";
  return {
    async post(path, body, id, origin = base) {
      const r = await fetch(base + path, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(id ? { "Idempotency-Key": id } : {}),
          "X-Room-Instance": instance,
        },
        body: JSON.stringify(body),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return { status: r.status, data: await r.json() };
    },
    get cookie() {
      return cookie;
    },
  };
}
try {
  const clients = [client(), client(), client()],
    names = ["Alice", "Bob", "Carol"],
    actors = [];
  for (let i = 0; i < 3; i++) {
    const r = await clients[i].post("/api/join", { name: names[i] });
    assert.equal(r.status, 200);
    actors.push(r.data.address);
  }
  assert.equal(new Set(actors).size, 3);
  const gateways = clients.map(
    (c) =>
      new CommunityGateway(
        async (method, params) => {
          const r = await c.post("/api/rpc", { method, params });
          if (r.status !== 200) throw Error(r.data.error);
          return r.data.result;
        },
        ready.contract,
        "0x7a69",
        build.runtimeHash,
      ),
  );
  for (const g of gateways) await g.check();
  const trace = [];
  for (const [who, cell, kind] of [
    [0, 41, 2],
    [1, 49, 3],
    [2, 39, 4],
    [1, 50, 3],
    [2, 31, 7],
  ]) {
    const action = { type: "build", cell, kind, rotation: 0 },
      id = `operation-${trace.length}`;
    const r = await clients[who].post("/api/action", action, id);
    assert.equal(r.status, 200, JSON.stringify(r));
    const duplicate = await clients[who].post("/api/action", action, id);
    assert.equal(duplicate.data.tx, r.data.tx);
    let receipt;
    for (let i = 0; i < 100; i++) {
      receipt = await gateways[who].receipt(r.data.tx);
      if (receipt) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(receipt?.status, "0x1");
    trace.push({ actor: actors[who], ...action, tx: r.data.tx });
  }
  const states = await Promise.all(gateways.map((g) => g.read()));
  for (const state of states) {
    assert.equal(state.phase, 2);
    assert.ok(state.endsAt > 0);
    assert.equal(state.restored, true);
    assert.equal(state.revision, 5);
    assert.equal(state.participants, 3);
    assert.deepEqual(state.kinds, states[0].kinds);
    assert.deepEqual(state.owners, states[0].owners);
    const derived = power(state.kinds, state.participants);
    assert.equal(derived.restored, state.restored);
    assert.deepEqual([...derived.active], [...state.active]);
  }
  assert.equal(
    (
      await clients[1].post(
        "/api/action",
        { type: "remove", cell: 41 },
        "foreign-removal",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await clients[1].post(
        "/api/action",
        { type: "build", cell: 41, kind: 3, rotation: 0 },
        "occupied-tile",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await clients[0].post(
        "/api/action",
        { type: "build", cell: 42, kind: 1, rotation: 0 },
        "operation-0",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await clients[0].post(
        "/api/join",
        { name: "evil" },
        null,
        "https://example.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await clients[0].post("/api/rpc", {
        method: "eth_sendTransaction",
        params: [],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await client().post(
        "/api/action",
        { type: "remove", cell: 41 },
        "no-session",
      )
    ).status,
    400,
  );
  const removed = await clients[0].post(
    "/api/action",
    { type: "remove", cell: 41 },
    "remove-source",
  );
  assert.equal(removed.status, 200);
  await mined(gateways[0], removed.data.tx);
  const dark = await gateways[0].read(actors[0]);
  assert.equal(dark.restored, false);
  assert.equal(dark.balance, 12);
  const rebuilt = await clients[0].post(
    "/api/action",
    { type: "build", cell: 41, kind: 2, rotation: 0 },
    "rebuild-source",
  );
  assert.equal(rebuilt.status, 200);
  await mined(gateways[0], rebuilt.data.tx);
  const restored = await gateways[0].read();
  assert.equal(restored.restored, true);
  assert.equal(restored.revision, 7);
  const events = await gateways[0].events("0x0", restored.block);
  assert.equal(events.length, 7);
  const info = await fetch(base + "/api/info", {
    headers: { Cookie: clients[0].cookie },
  }).then((r) => r.json());
  assert.equal(info.session.address, actors[0]);
  const wall = await fetch(base + "/play.html?wall=1");
  assert.equal(wall.status, 200);
  assert.equal((await clients[1].post("/api/restart", {})).status, 400);
  const restarted = await clients[0].post("/api/restart", {});
  assert.equal(restarted.status, 200);
  assert.notEqual(restarted.data.contract, ready.contract);
  assert.equal(
    (
      await clients[1].post(
        "/api/action",
        { type: "build", cell: 41, kind: 2, rotation: 0 },
        "old-round-action",
      )
    ).status,
    409,
  );
  instance = restarted.data.instance;
  const nextGateway = new CommunityGateway(
    async (method, params) => {
      const r = await clients[0].post("/api/rpc", { method, params });
      if (r.status !== 200) throw Error(r.data.error);
      return r.data.result;
    },
    restarted.data.contract,
    "0x7a69",
    build.runtimeHash,
  );
  await nextGateway.check();
  const newRound = await nextGateway.read();
  assert.equal(newRound.revision, 0);
  assert.equal(newRound.phase, 0);
  const report = {
    network: "Anvil-local",
    chainId: 31337,
    publicMonadTestnet: false,
    contract: ready.contract,
    trace,
    finalBlock: restored.block,
    revision: restored.revision,
    threeClientsEqual: true,
    restored: true,
    idempotentRetry: true,
    ownerEnforced: true,
    occupiedTileRejected: true,
    crossOriginRejected: true,
    arbitrarySigningRpcRejected: true,
    sessionRequired: true,
    powerLossAndRecovery: true,
    eventCount: events.length,
    timedGoalCompleted: restored.phase === 2,
    hostOnlyRestart: true,
    staleRoundActionRejected: true,
    nextRoundContract: restarted.data.contract,
    nextRoundWaiting: true,
    browserUiVerified: false,
  };
  await writeFile(
    new URL("../../docs/examples/relaunch-e2e.report.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  child.stdin.end("q");
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(Error("server did not shut down"));
    }, 10000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    if (child.exitCode !== null) {
      clearTimeout(timeout);
      resolve();
    }
  });
}
