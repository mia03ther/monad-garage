#!/usr/bin/env node

/**
 * Measure the CommunityGateway.read() transport path.
 *
 * This diagnostic uses the production gateway class with an instrumented
 * JSON-RPC request function. It performs reads only, never signs or sends a
 * transaction, and does not load .env or private keys.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { CommunityGateway, MONAD } from "../frontend/community/gateway.js";

const DEFAULT_CONTRACT = "0xb1EEA6F45B37098f62Fe6cA484441F846eb42C1A";
const DEFAULT_ACTOR = "0xc338e05fD4F8322E1562DB052c42995223254B97";
const DEFAULT_OUTPUT = "docs/examples/monad-gateway-batch-results.json";

function usage() {
  return `Usage: node tools/measure_gateway_reads.mjs [options]

Measure the CommunityGateway.read() path against Monad Testnet.
This tool is read-only and never loads a private key.

Options:
  --rpc <url>          HTTP JSON-RPC endpoint (default: ${MONAD.rpc})
  --contract <address> GenesisCommunity address (default: ${DEFAULT_CONTRACT})
  --actor <address>    Public address used for allowance read (default: ${DEFAULT_ACTOR})
  --mode <batch|single> Transport mode (default: batch)
  --samples <count>    Recorded reads (default: 30)
  --warmup <count>     Unrecorded warm-up reads (default: 3)
  --delay-ms <ms>      Delay between reads (default: 500)
  --timeout-ms <ms>    Timeout for each HTTP request (default: 12000)
  --output <path>      JSON report (default: ${DEFAULT_OUTPUT})
  --help               Show this help
`;
}

function parseInteger(value, option, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum)
    throw new Error(`${option} must be an integer from ${minimum} to ${maximum}`);
  return number;
}

function parseArgs(argv) {
  const options = {
    rpc: MONAD.rpc,
    contract: DEFAULT_CONTRACT,
    actor: DEFAULT_ACTOR,
    mode: "batch",
    samples: 30,
    warmup: 3,
    delayMs: 500,
    timeoutMs: 12_000,
    output: DEFAULT_OUTPUT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--help") return { ...options, help: true };
    const value = argv[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for ${option}`);
    if (option === "--rpc") options.rpc = value;
    else if (option === "--contract") options.contract = value;
    else if (option === "--actor") options.actor = value;
    else if (option === "--mode") options.mode = value;
    else if (option === "--samples")
      options.samples = parseInteger(value, option, 1, 500);
    else if (option === "--warmup")
      options.warmup = parseInteger(value, option, 0, 100);
    else if (option === "--delay-ms")
      options.delayMs = parseInteger(value, option, 0, 60_000);
    else if (option === "--timeout-ms")
      options.timeoutMs = parseInteger(value, option, 1_000, 120_000);
    else if (option === "--output") options.output = value;
    else throw new Error(`Unknown option: ${option}`);
    index += 1;
  }
  if (!/^https?:\/\//i.test(options.rpc))
    throw new Error("--rpc must be an HTTP(S) URL");
  if (!["batch", "single"].includes(options.mode))
    throw new Error("--mode must be batch or single");
  for (const [option, value] of [
    ["--contract", options.contract],
    ["--actor", options.actor],
  ])
    if (!/^0x[0-9a-f]{40}$/i.test(value))
      throw new Error(`${option} must be a 20-byte hex address`);
  if (!options.output.trim()) throw new Error("--output must not be empty");
  return options;
}

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return rounded(sorted[index]);
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length
    ? rounded(finite.reduce((total, value) => total + value, 0) / finite.length)
    : null;
}

function summarize(values) {
  const finite = values.filter(Number.isFinite);
  return {
    min: finite.length ? rounded(Math.min(...finite)) : null,
    mean: average(finite),
    p50: percentile(finite, 0.5),
    p95: percentile(finite, 0.95),
    max: finite.length ? rounded(Math.max(...finite)) : null,
  };
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class MeasuredRpc {
  constructor(url, timeoutMs) {
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.capture = null;
  }

  begin(label) {
    if (this.capture) throw new Error("An RPC capture is already active");
    this.capture = { label, requests: [] };
  }

  end() {
    const capture = this.capture;
    if (!capture) throw new Error("No RPC capture is active");
    this.capture = null;
    return capture.requests;
  }

  async call(method, params = []) {
    const started = performance.now();
    const record = {
      method,
      rpcMethods: [method],
      blockTag: method === "eth_call" ? (params[1] ?? null) : null,
      blockTags: method === "eth_call" ? [params[1] ?? null] : [],
      batchSize: 1,
      durationMs: null,
      httpStatus: null,
      responseBytes: null,
      ok: false,
    };
    if (this.capture) this.capture.requests.push(record);
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: this.nextId++,
          method,
          params,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      record.httpStatus = response.status;
      const text = await response.text();
      record.responseBytes = Buffer.byteLength(text);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`${method} returned invalid JSON`);
      }
      if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
      if (body.error)
        throw new Error(`${method}: ${body.error.message ?? "JSON-RPC error"}`);
      if (!("result" in body)) throw new Error(`${method} omitted result`);
      record.ok = true;
      return body.result;
    } finally {
      record.durationMs = rounded(performance.now() - started);
    }
  }

  async batch(calls) {
    const started = performance.now(),
      requests = calls.map(({ method, params }, index) => ({
        jsonrpc: "2.0",
        id: this.nextId + index,
        method,
        params,
      })),
      record = {
        method: "rpc_batch",
        rpcMethods: calls.map(({ method }) => method),
        blockTag: null,
        blockTags: calls.flatMap(({ method, params }) =>
          method === "eth_call" ? [params[1] ?? null] : [],
        ),
        batchSize: calls.length,
        durationMs: null,
        httpStatus: null,
        responseBytes: null,
        ok: false,
      };
    this.nextId += calls.length;
    if (this.capture) this.capture.requests.push(record);
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requests),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      record.httpStatus = response.status;
      const text = await response.text();
      record.responseBytes = Buffer.byteLength(text);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error("Batch returned invalid JSON");
      }
      if (!response.ok) throw new Error(`Batch returned HTTP ${response.status}`);
      if (!Array.isArray(body))
        throw new Error("RPC endpoint rejected JSON-RPC batch");
      const expected = new Set(requests.map(({ id }) => id)),
        byId = new Map();
      for (const item of body) {
        if (!item || !expected.has(item.id) || byId.has(item.id))
          throw new Error("Batch returned an unexpected response id");
        byId.set(item.id, item);
      }
      const results = requests.map(({ id, method }) => {
        const item = byId.get(id);
        if (!item) throw new Error(`Batch omitted response for ${method}`);
        if (item.error) throw new Error(`${method}: ${item.error.message}`);
        if (!("result" in item)) throw new Error(`${method} omitted result`);
        return item.result;
      });
      record.ok = true;
      return results;
    } finally {
      record.durationMs = rounded(performance.now() - started);
    }
  }
}

function sampleResult(index, durationMs, requests, snapshot, error) {
  const methodCounts = countBy(requests.flatMap((request) => request.rpcMethods));
  const blockTags = [
    ...new Set(
      requests.flatMap((request) => request.blockTags),
    ),
  ];
  const allRequestsSucceeded = requests.every((request) => request.ok);
  return {
    index,
    ok: !error && allRequestsSucceeded,
    durationMs: rounded(durationMs),
    httpRequestCount: requests.length,
    rpcMethodCounts: methodCounts,
    blockTags,
    pinnedToSnapshotBlock:
      Boolean(snapshot) && blockTags.length === 1 && blockTags[0] === snapshot.block,
    snapshot: snapshot
      ? {
          block: snapshot.block,
          revision: snapshot.revision,
          participants: snapshot.participants,
          balance: snapshot.balance,
          phase: snapshot.phase,
        }
      : null,
    requests,
    error: error ? String(error.message ?? error) : null,
  };
}

async function measuredRead(gateway, rpc, actor, label, index) {
  rpc.begin(label);
  const started = performance.now();
  let snapshot = null;
  let error = null;
  try {
    snapshot = await gateway.read(actor);
  } catch (caught) {
    error = caught;
  }
  const durationMs = performance.now() - started;
  const requests = rpc.end();
  return sampleResult(index, durationMs, requests, snapshot, error);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const build = JSON.parse(
    await readFile(new URL("../frontend/community/build.json", import.meta.url), "utf8"),
  );
  if (!/^([0-9a-f]{64})$/i.test(build.runtimeHash))
    throw new Error("frontend/community/build.json has an invalid runtimeHash");

  const rpc = new MeasuredRpc(options.rpc, options.timeoutMs);
  const gateway = new CommunityGateway(
    rpc.call.bind(rpc),
    options.contract,
    MONAD.id,
    build.runtimeHash,
    options.mode === "batch" ? rpc.batch.bind(rpc) : null,
  );

  rpc.begin("preflight");
  const preflightStarted = performance.now();
  let preflightError = null;
  try {
    await gateway.check();
  } catch (error) {
    preflightError = error;
  }
  const preflightRequests = rpc.end();
  if (preflightError) throw preflightError;
  const preflight = {
    ok: true,
    durationMs: rounded(performance.now() - preflightStarted),
    httpRequestCount: preflightRequests.length,
    rpcMethodCounts: countBy(
      preflightRequests.flatMap((request) => request.rpcMethods),
    ),
  };

  process.stdout.write(
    `Preflight passed for ${options.contract}; running ${options.warmup} warm-ups.\n`,
  );
  const warmups = [];
  for (let index = 1; index <= options.warmup; index += 1) {
    const sample = await measuredRead(gateway, rpc, options.actor, "warmup", index);
    warmups.push(sample);
    process.stdout.write(
      `Warm-up ${index}/${options.warmup}: ${sample.ok ? `${sample.durationMs} ms` : sample.error}\n`,
    );
    if (index < options.warmup && options.delayMs) await sleep(options.delayMs);
  }
  if (warmups.some((sample) => !sample.ok))
    throw new Error("A warm-up read failed; no baseline report was written");

  if (options.warmup && options.delayMs) await sleep(options.delayMs);
  process.stdout.write(`Recording ${options.samples} reads.\n`);
  const samples = [];
  for (let index = 1; index <= options.samples; index += 1) {
    const sample = await measuredRead(gateway, rpc, options.actor, "sample", index);
    samples.push(sample);
    process.stdout.write(
      `Sample ${index}/${options.samples}: ${sample.ok ? `${sample.durationMs} ms, ${sample.httpRequestCount} requests` : sample.error}\n`,
    );
    if (index < options.samples && options.delayMs) await sleep(options.delayMs);
  }

  const successful = samples.filter((sample) => sample.ok);
  const allRequests = samples.flatMap((sample) => sample.requests);
  const report = {
    format: `genesis.monad-gateway-read-${options.mode}.v1`,
    measuredAt: new Date().toISOString(),
    publicMonadTestnet: true,
    chainId: Number(BigInt(MONAD.id)),
    rpc: options.rpc,
    contract: options.contract,
    actor: options.actor,
    gatewaySource: "frontend/community/gateway.js#CommunityGateway.read",
    configuration: {
      samples: options.samples,
      warmup: options.warmup,
      delayMs: options.delayMs,
      timeoutMs: options.timeoutMs,
      actorIncluded: true,
      mode: options.mode,
    },
    preflight,
    warmupSummary: {
      count: warmups.length,
      durationMs: summarize(warmups.map((sample) => sample.durationMs)),
    },
    summary: {
      sampleCount: samples.length,
      successCount: successful.length,
      failureCount: samples.length - successful.length,
      successRate: rounded(successful.length / samples.length),
      durationMs: summarize(successful.map((sample) => sample.durationMs)),
      httpRequestsPerRead: summarize(
        successful.map((sample) => sample.httpRequestCount),
      ),
      totalHttpRequestCount: allRequests.length,
      rpcMethodCounts: countBy(
        allRequests.flatMap((request) => request.rpcMethods),
      ),
      pinnedToSnapshotBlockCount: successful.filter(
        (sample) => sample.pinnedToSnapshotBlock,
      ).length,
      uniqueSnapshotBlocks: [
        ...new Set(successful.map((sample) => sample.snapshot.block)),
      ],
    },
    samples,
    security: {
      privateKeyRead: false,
      transactionsSent: 0,
      note: "This read-only tool does not load .env or require signing credentials.",
    },
  };

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`Report written to ${options.output}.\n`);

  if (!successful.length) throw new Error("All recorded reads failed");
  if (successful.some((sample) => !sample.pinnedToSnapshotBlock))
    throw new Error("At least one successful read was not pinned to its snapshot block");
}

main().catch((error) => {
  process.stderr.write(`measure_gateway_reads: ${error.message}\n`);
  process.exitCode = 1;
});
