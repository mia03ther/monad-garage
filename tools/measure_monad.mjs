#!/usr/bin/env node

/**
 * Measure the public Monad lifecycle of unchanged GenesisCommunity actions.
 *
 * This is an external diagnostic tool. It does not import or modify gameplay
 * code, and it never writes credentials to its report. By default it deploys
 * an isolated room and submits three cost-1 builds on cells 39, 38 and 37.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import process from "node:process";

const DEFAULT_OUTPUT = "docs/examples/monad-latency-baseline.json";
const DEFAULT_CELLS = [39, 38, 37];
const RECEIPT_POLL_MS = 200;
const COMMIT_POLL_MS = 250;
const SAMPLE_TIMEOUT_MS = 60_000;

function usage() {
  return `Usage: node tools/measure_monad.mjs [options]

Deploy an isolated GenesisCommunity room and measure three real Monad Testnet
build transactions without changing the game implementation.

Options:
  --env <path>         Environment file (default: .env)
  --output <path>      JSON report (default: ${DEFAULT_OUTPUT})
  --samples <1-3>      Number of build samples (default: 3)
  --contract <address> Use an existing waiting room instead of deploying one
  --timeout-ms <ms>    Per-sample timeout (default: ${SAMPLE_TIMEOUT_MS})
  --help               Show this help without reading credentials

Required environment:
  GENESIS_MONAD_PRIVATE_KEY
  GENESIS_MONAD_RPC_URL
  GENESIS_MONAD_WS_URL
  GENESIS_MONAD_CHAIN_ID
`;
}

function parseArgs(argv) {
  const options = {
    env: ".env",
    output: DEFAULT_OUTPUT,
    samples: 3,
    contract: null,
    timeoutMs: SAMPLE_TIMEOUT_MS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") return { ...options, help: true };
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    if (arg === "--env") options.env = value;
    else if (arg === "--output") options.output = value;
    else if (arg === "--samples") options.samples = Number(value);
    else if (arg === "--contract") options.contract = value;
    else if (arg === "--timeout-ms") options.timeoutMs = Number(value);
    else throw new Error(`Unknown option: ${arg}`);
    i += 1;
  }
  if (!Number.isInteger(options.samples) || options.samples < 1 || options.samples > 3)
    throw new Error("--samples must be an integer from 1 to 3");
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000)
    throw new Error("--timeout-ms must be an integer of at least 1000");
  if (options.contract && !/^0x[0-9a-fA-F]{40}$/.test(options.contract))
    throw new Error("--contract must be a 20-byte hex address");
  return options;
}

function parseEnv(text) {
  const result = {};
  for (const sourceLine of text.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("Malformed line in environment file");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    )
      value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function normalizeKey(value) {
  const key = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key))
    throw new Error("GENESIS_MONAD_PRIVATE_KEY must contain exactly 32 bytes");
  return key;
}

function redact(text, secret) {
  if (!text) return "";
  return String(text)
    .split(secret)
    .join("[private key redacted]")
    .split(secret.slice(2))
    .join("[private key redacted]");
}

function run(command, args, secret) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => reject(new Error(`${command}: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `${command} exited ${code}: ${redact(stderr || stdout, secret).trim()}`,
          ),
        );
    });
  });
}

function jsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Command did not return a JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

function hexNumber(value) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value))
    throw new Error(`Expected a hexadecimal quantity, received ${String(value)}`);
  const number = Number(BigInt(value));
  if (!Number.isSafeInteger(number)) throw new Error("Quantity exceeds safe integer range");
  return number;
}

function nowMs() {
  return performance.now();
}

function elapsed(start, point) {
  return point == null ? null : Math.round((point - start) * 1_000) / 1_000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values) {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2
    ? numbers[middle]
    : Math.round(((numbers[middle - 1] + numbers[middle]) / 2) * 1_000) / 1_000;
}

class RpcClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
  }

  async call(method, params = []) {
    const [result] = await this.batch([{ method, params }]);
    return result;
  }

  async batch(calls) {
    const requests = calls.map(({ method, params }) => ({
      jsonrpc: "2.0",
      id: this.nextId++,
      method,
      params,
    }));
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requests),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body)) throw new Error("RPC endpoint rejected JSON-RPC batch");
    const byId = new Map(body.map((item) => [item.id, item]));
    return requests.map((request) => {
      const item = byId.get(request.id);
      if (!item) throw new Error(`RPC omitted response for ${request.method}`);
      if (item.error) throw new Error(`${request.method}: ${item.error.message}`);
      return item.result;
    });
  }
}

class MonadLogSubscription {
  constructor(url, contract) {
    this.url = url;
    this.contract = contract.toLowerCase();
    this.socket = null;
    this.subscription = null;
    this.events = new Map();
    this.available = false;
    this.failure = null;
  }

  record(result) {
    const log = result?.log ?? result;
    const transactionHash = log?.transactionHash?.toLowerCase();
    if (!transactionHash || log?.address?.toLowerCase() !== this.contract) return;
    const commitState = String(result?.commitState ?? log?.commitState ?? "").toLowerCase();
    const entry = this.events.get(transactionHash) ?? {};
    const timestamp = nowMs();
    if (commitState === "proposed" && entry.proposed == null) entry.proposed = timestamp;
    if (commitState === "voted" && entry.voted == null) entry.voted = timestamp;
    if (commitState === "finalized" && entry.finalized == null) entry.finalized = timestamp;
    if (commitState === "verified" && entry.verified == null) entry.verified = timestamp;
    entry.blockId = result?.blockId ?? log?.blockId ?? entry.blockId ?? null;
    entry.blockHash = log?.blockHash ?? entry.blockHash ?? null;
    this.events.set(transactionHash, entry);
  }

  async connect() {
    try {
      await new Promise((resolve, reject) => {
        const socket = new WebSocket(this.url);
        this.socket = socket;
        const timer = setTimeout(() => reject(new Error("WebSocket open timeout")), 10_000);
        socket.addEventListener("open", () => {
          socket.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_subscribe",
              params: ["monadLogs", { address: this.contract }],
            }),
          );
        });
        socket.addEventListener("message", (event) => {
          let message;
          try {
            message = JSON.parse(String(event.data));
          } catch {
            return;
          }
          if (message.id === 1) {
            clearTimeout(timer);
            if (message.error) reject(new Error(message.error.message));
            else {
              this.subscription = message.result;
              this.available = true;
              resolve();
            }
            return;
          }
          if (
            message.method === "eth_subscription" &&
            message.params?.subscription === this.subscription
          )
            this.record(message.params.result);
        });
        socket.addEventListener("error", () => {
          if (!this.available) {
            clearTimeout(timer);
            reject(new Error("WebSocket connection failed"));
          }
        });
      });
    } catch (error) {
      this.failure = error.message;
      this.available = false;
      this.close();
    }
  }

  forTransaction(hash) {
    return this.events.get(hash.toLowerCase()) ?? {};
  }

  close() {
    try {
      this.socket?.close();
    } catch {
      // The HTTP measurements remain valid if WebSocket cleanup fails.
    }
  }
}

async function waitForReceipt(rpc, hash, deadline) {
  while (nowMs() < deadline) {
    const receipt = await rpc.call("eth_getTransactionReceipt", [hash]);
    if (receipt) return { receipt, observedAt: nowMs() };
    await sleep(RECEIPT_POLL_MS);
  }
  throw new Error(`Timed out waiting for receipt ${hash}`);
}

async function waitForCommitBlocks(rpc, transactionBlock, deadline) {
  let safeAt = null;
  let finalizedAt = null;
  let safeBlock = null;
  let finalizedBlock = null;
  while (nowMs() < deadline) {
    const [safe, finalized] = await rpc.batch([
      { method: "eth_getBlockByNumber", params: ["safe", false] },
      { method: "eth_getBlockByNumber", params: ["finalized", false] },
    ]);
    if (safe && hexNumber(safe.number) >= transactionBlock && safeAt == null) {
      safeAt = nowMs();
      safeBlock = hexNumber(safe.number);
    }
    if (finalized && hexNumber(finalized.number) >= transactionBlock && finalizedAt == null) {
      finalizedAt = nowMs();
      finalizedBlock = hexNumber(finalized.number);
    }
    if (safeAt != null && finalizedAt != null)
      return { safeAt, finalizedAt, safeBlock, finalizedBlock };
    await sleep(COMMIT_POLL_MS);
  }
  throw new Error(`Timed out waiting for safe/finalized block ${transactionBlock}`);
}

async function deployRoom({ rpcUrl, key }) {
  const startedAt = nowMs();
  const result = await run(
    "forge",
    [
      "create",
      "--root",
      "contracts",
      "--use",
      "0.8.29",
      "GenesisCommunity.sol:GenesisCommunity",
      "--rpc-url",
      rpcUrl,
      "--private-key",
      key,
      "--broadcast",
      "--json",
    ],
    key,
  );
  const completedAt = nowMs();
  const deployment = jsonObject(result.stdout);
  if (!/^0x[0-9a-fA-F]{40}$/.test(deployment.deployedTo ?? ""))
    throw new Error("forge create did not return a contract address");
  if (!/^0x[0-9a-fA-F]{64}$/.test(deployment.transactionHash ?? ""))
    throw new Error("forge create did not return a transaction hash");
  return {
    contract: deployment.deployedTo,
    transactionHash: deployment.transactionHash,
    deployer: deployment.deployer,
    commandWallMs: elapsed(startedAt, completedAt),
  };
}

async function sendBuild({ rpcUrl, key, contract, cell }) {
  const submittedAt = nowMs();
  const result = await run(
    "cast",
    [
      "send",
      contract,
      "build(uint8,uint8,uint8)",
      String(cell),
      "1",
      "0",
      "--rpc-url",
      rpcUrl,
      "--private-key",
      key,
      "--async",
    ],
    key,
  );
  const hashObservedAt = nowMs();
  const match = result.stdout.match(/0x[0-9a-fA-F]{64}/);
  if (!match) throw new Error("cast send did not return a transaction hash");
  return { hash: match[0].toLowerCase(), submittedAt, hashObservedAt };
}

async function measureSample({ rpc, subscription, rpcUrl, key, contract, cell, timeoutMs }) {
  const sent = await sendBuild({ rpcUrl, key, contract, cell });
  const deadline = sent.submittedAt + timeoutMs;
  const receiptResult = await waitForReceipt(rpc, sent.hash, deadline);
  const receipt = receiptResult.receipt;
  if (receipt.status !== "0x1") throw new Error(`Transaction reverted: ${sent.hash}`);
  const transactionBlock = hexNumber(receipt.blockNumber);
  const commits = await waitForCommitBlocks(rpc, transactionBlock, deadline);

  // Give monadLogs a short grace period to deliver commitment updates that
  // can arrive after the HTTP finalized tag has advanced.
  if (subscription.available) await sleep(500);
  const stream = subscription.forTransaction(sent.hash);

  return {
    transactionHash: sent.hash,
    cell,
    kind: 1,
    rotation: 0,
    blockNumber: transactionBlock,
    blockHash: receipt.blockHash,
    gasUsed: hexNumber(receipt.gasUsed),
    effectiveGasPriceWei: BigInt(receipt.effectiveGasPrice).toString(),
    hashLatencyMs: elapsed(sent.submittedAt, sent.hashObservedAt),
    proposedLatencyMs: elapsed(sent.submittedAt, stream.proposed),
    receiptLatencyMs: elapsed(sent.submittedAt, receiptResult.observedAt),
    votedLatencyMs: elapsed(sent.submittedAt, stream.voted),
    safeLatencyMs: elapsed(sent.submittedAt, commits.safeAt),
    websocketFinalizedLatencyMs: elapsed(sent.submittedAt, stream.finalized),
    finalizedLatencyMs: elapsed(sent.submittedAt, commits.finalizedAt),
    verifiedLatencyMs: elapsed(sent.submittedAt, stream.verified),
    safeBlock: commits.safeBlock,
    finalizedBlock: commits.finalizedBlock,
    websocketBlockId: stream.blockId ?? null,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const env = parseEnv(await readFile(options.env, "utf8"));
  const key = normalizeKey(required(env, "GENESIS_MONAD_PRIVATE_KEY"));
  const rpcUrl = required(env, "GENESIS_MONAD_RPC_URL");
  const wsUrl = required(env, "GENESIS_MONAD_WS_URL");
  const expectedChainId = Number(required(env, "GENESIS_MONAD_CHAIN_ID"));
  if (expectedChainId !== 10143) throw new Error("This measurement only permits Monad Testnet 10143");

  const rpc = new RpcClient(rpcUrl);
  const actualChainId = hexNumber(await rpc.call("eth_chainId"));
  if (actualChainId !== expectedChainId)
    throw new Error(`RPC chain ID ${actualChainId} does not match ${expectedChainId}`);

  const build = JSON.parse(await readFile("frontend/community/build.json", "utf8"));
  const deployment = options.contract
    ? { contract: options.contract, transactionHash: null, deployer: null, commandWallMs: null }
    : await deployRoom({ rpcUrl, key });

  const runtimeCode = await rpc.call("eth_getCode", [deployment.contract, "latest"]);
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(runtimeCode)) throw new Error("Deployed runtime code is empty");
  const runtimeHash = createHash("sha256")
    .update(Buffer.from(runtimeCode.slice(2), "hex"))
    .digest("hex");
  if (runtimeHash !== build.runtimeHash)
    throw new Error(`Runtime hash mismatch: ${runtimeHash} != ${build.runtimeHash}`);

  const subscription = new MonadLogSubscription(wsUrl, deployment.contract);
  await subscription.connect();

  const samples = [];
  try {
    for (const cell of DEFAULT_CELLS.slice(0, options.samples)) {
      samples.push(
        await measureSample({
          rpc,
          subscription,
          rpcUrl,
          key,
          contract: deployment.contract,
          cell,
          timeoutMs: options.timeoutMs,
        }),
      );
    }
  } finally {
    subscription.close();
  }

  const report = {
    format: "genesis.monad-latency.v1",
    measuredAt: new Date().toISOString(),
    publicMonadTestnet: true,
    chainId: actualChainId,
    rpc: rpcUrl,
    websocket: wsUrl,
    websocketAvailable: subscription.available,
    websocketFailure: subscription.failure,
    contract: deployment.contract,
    deployer: deployment.deployer,
    deploymentTransactionHash: deployment.transactionHash,
    deploymentCommandWallMs: deployment.commandWallMs,
    runtimeHash,
    samples,
    summary: {
      sampleCount: samples.length,
      medianHashMs: median(samples.map((sample) => sample.hashLatencyMs)),
      medianProposedMs: median(samples.map((sample) => sample.proposedLatencyMs)),
      medianReceiptMs: median(samples.map((sample) => sample.receiptLatencyMs)),
      medianVotedMs: median(samples.map((sample) => sample.votedLatencyMs)),
      medianSafeMs: median(samples.map((sample) => sample.safeLatencyMs)),
      medianFinalizedMs: median(samples.map((sample) => sample.finalizedLatencyMs)),
    },
    security: {
      privateKeyIncluded: false,
      note: "A dedicated test key was used only for signing and was not written to this report.",
    },
  };

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (serialized.includes(key) || serialized.includes(key.slice(2)))
    throw new Error("Refusing to write a report containing the private key");
  await writeFile(options.output, serialized, { mode: 0o644 });
  process.stdout.write(
    `${JSON.stringify(
      {
        report: options.output,
        contract: report.contract,
        samples: report.summary.sampleCount,
        websocketAvailable: report.websocketAvailable,
        medianReceiptMs: report.summary.medianReceiptMs,
        medianSafeMs: report.summary.medianSafeMs,
        medianFinalizedMs: report.summary.medianFinalizedMs,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`measure_monad: ${error.message}\n`);
  process.exitCode = 1;
});
