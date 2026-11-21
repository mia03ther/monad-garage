import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { test } from "node:test";
import { GarageRegistry, versionId } from "./chain.js";
import { key, parseBuild, score, STOCK, trackPosition, validBuild } from "./rules.js";

test("challenge codes round-trip every legal loadout and reject malformed imports", () => {
  let combinations = 0;
  for (let motor = 0; motor < 3; motor++) for (let tires = 0; tires < 3; tires++) {
    for (let boost = 0; boost < 4; boost++) {
      const build = { motor, tires, boost };
      if (!validBuild(build)) continue;
      combinations++;
      assert.deepEqual(parseBuild(key(build)), build);
      assert.ok(score(build).splits.every((ms) => ms > 0));
    }
  }
  assert.equal(combinations, 32);
  for (const value of ["223", "231", "004", "01", "0011", {}, null]) assert.equal(parseBuild(value), null);
  assert.throws(() => versionId("-1"));
  assert.throws(() => versionId(2n ** 256n));
});

test("rain tires trade straight-line pace for corner grip; boost timing matters", () => {
  const stock = score(STOCK);
  const tires = score({ ...STOCK, tires: 1 });
  const wetBoost = score({ ...STOCK, tires: 1, boost: 2 });
  const climbBoost = score({ ...STOCK, tires: 1, boost: 3 });
  assert.deepEqual(stock, { splits: [3520, 5650, 4780], ms: 13950 });
  assert.equal(tires.ms, 13040);
  assert.ok(tires.splits[0] > stock.splits[0] && tires.splits[1] < stock.splits[1]);
  assert.ok(climbBoost.ms < tires.ms && tires.ms < wetBoost.ms);
  assert.deepEqual(score({ ...STOCK, tires: 1 }), tires);
  assert.equal(trackPosition(stock.splits, 3520), 1);
  assert.equal(trackPosition(stock.splits, 3520 + 5650 / 2), 1.5);
  assert.equal(trackPosition(stock.splits, stock.ms + 900), 3);
});

const anvil = spawnSync("anvil", ["--version"], { windowsHide: true });

test("Anvil validates scores and promotes only a winning child of the current champion", {
  skip: anvil.status !== 0 ? "Anvil is not available on PATH" : false,
  timeout: 25000,
}, async (t) => {
  let compiled;
  try {
    compiled = JSON.parse(await readFile(new URL("../../contracts/out/GenesisGarage.sol/GenesisGarage.json", import.meta.url), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return t.skip("Compile the registry first with forge build --root contracts --use 0.8.29");
  }
  const artifact = JSON.parse(await readFile(new URL("./build.json", import.meta.url), "utf8"));
  const process = spawn("anvil", ["--host", "127.0.0.1", "--port", "0", "--chain-id", "31337", "--accounts", "2", "--slots-in-an-epoch", "1"], {
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  t.after(() => process.kill());
  const port = await new Promise((resolve, reject) => {
    let stdout = "";
    const timeout = setTimeout(() => reject(Error("Anvil did not report a loopback listener")), 10000);
    const abort = (error) => { clearTimeout(timeout); reject(error); };
    process.on("error", abort);
    process.on("exit", () => abort(Error("Anvil exited before listening")));
    process.stderr.resume();
    process.stdout.on("data", (bytes) => {
      stdout = (stdout + bytes.toString()).slice(-8192);
      const match = /Listening on 127\.0\.0\.1:(\d+)/.exec(stdout);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const client = () => async (method, params) => {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(4000),
    });
    const rpc = await response.json();
    if (rpc.error) throw Error(rpc.error.message);
    return rpc.result;
  };
  const alice = client(), bob = client();
  const [a, b] = await alice("eth_accounts", []);
  assert.notEqual(a, b);
  const deployment = await alice("eth_sendTransaction", [{ from: a, data: compiled.bytecode.object }]);
  let receipt = null;
  for (let attempt = 0; attempt < 20 && !receipt; attempt++) {
    receipt = await alice("eth_getTransactionReceipt", [deployment]);
    if (!receipt) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(receipt, "deployment receipt was not mined");
  assert.equal(receipt.status, "0x1");
  const advanceFinality = () => alice("anvil_mine", ["0x3"]);
  await advanceFinality();
  const sender = new GarageRegistry(alice, receipt.contractAddress, "0x7a69", artifact);
  const receiver = new GarageRegistry(bob, receipt.contractAddress, "0x7a69", artifact);
  await sender.check();
  await receiver.check();
  assert.deepEqual((await receiver.read(0)).build, STOCK);
  assert.equal(await receiver.champion(), 0n);
  await assert.rejects(new GarageRegistry(bob, receipt.contractAddress, "0x279f", artifact).check(), /网络不匹配/);
  await assert.rejects(new GarageRegistry(bob, a, "0x7a69", artifact).check(), /不是兼容/);
  for (let motor = 0; motor < 3; motor++) for (let tires = 0; tires < 3; tires++) {
    for (let boost = 0; boost < 4; boost++) {
      const build = { motor, tires, boost };
      const lap = () => sender.call("lapTime(uint8,uint8,uint8)", motor, tires, boost);
      if (validBuild(build)) assert.equal(Number(BigInt(await lap())), score(build).ms);
      else await assert.rejects(lap, /over budget/);
    }
  }
  await assert.rejects(sender.call("publish(uint256,uint8,uint8,uint8)", 0, 0, 0, 1), /unchanged run/);
  await assert.rejects(sender.call("publish(uint256,uint8,uint8,uint8)", 99, 1, 1, 1), /missing parent/);

  const first = { from: a, parent: 0n, build: { motor: 0, tires: 1, boost: 1 } };
  const hash = await alice("eth_sendTransaction", [sender.transaction(first.from, first.parent, first.build)]);
  assert.equal(await sender.confirmed(hash, first), null);
  await advanceFinality();
  const published = await sender.confirmed(hash, first);
  assert.equal(published.version, 1n);
  assert.equal(published.beatParent, true);
  assert.equal(published.promoted, true);
  assert.equal(await receiver.champion(), 1n);
  assert.deepEqual(await receiver.read(1), published);
  const next = { from: b, parent: published.version, build: { ...published.build, motor: 1, boost: 3 } };
  const childHash = await bob("eth_sendTransaction", [receiver.transaction(next.from, next.parent, next.build)]);
  await advanceFinality();
  const child = await receiver.confirmed(childHash, next);
  assert.equal(child.version, 2n);
  assert.equal(child.parent, 1n);
  assert.equal(child.author, b);
  assert.ok(child.timeMs < published.timeMs);
  assert.equal(child.promoted, true);
  assert.equal(await sender.champion(), 2n);
  assert.deepEqual(await sender.read(2), child);
  const fork = { from: b, parent: 0n, build: { motor: 2, tires: 0, boost: 1 } };
  const forkHash = await bob("eth_sendTransaction", [receiver.transaction(fork.from, fork.parent, fork.build)]);
  await advanceFinality();
  const staleFork = await receiver.confirmed(forkHash, fork);
  assert.equal(staleFork.parent, 0n);
  assert.equal(staleFork.beatParent, true);
  assert.equal(staleFork.promoted, false);
  assert.equal(await receiver.champion(), 2n);
  assert.deepEqual(await sender.read(2), child);
});
