import { sha256Hex } from "../engine.js";
export const MONAD = {
  id: "0x279f",
  rpc: "https://testnet-rpc.monad.xyz",
  ws: "wss://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadexplorer.com",
};
export const PUBLIC_APP =
  "https://mia03ther.github.io/project-genesis/play.html";
export const word = (n) => BigInt(n).toString(16).padStart(64, "0");
export function encodeAction(a) {
  if (!Number.isInteger(a.cell) || a.cell < 0 || a.cell > 80)
    throw Error("Invalid tile");
  if (a.type === "remove") return "0xf06730e0" + word(a.cell);
  if (
    a.type !== "build" ||
    !Number.isInteger(a.kind) ||
    a.kind < 1 ||
    a.kind > 7 ||
    !Number.isInteger(a.rotation) ||
    a.rotation < 0 ||
    a.rotation > 3
  )
    throw Error("Invalid build action");
  return "0x50548d40" + word(a.cell) + word(a.kind) + word(a.rotation);
}
export function words(raw, length) {
  if (
    typeof raw !== "string" ||
    !/^0x[0-9a-f]+$/i.test(raw) ||
    raw.length !== 2 + length * 64
  )
    throw Error("Unexpected contract response");
  return Array.from({ length }, (_, i) =>
    BigInt("0x" + raw.slice(2 + i * 64, 66 + i * 64)),
  );
}
function integer(n) {
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("Contract value exceeds the supported range");
  return Number(n);
}
export class CommunityGateway {
  constructor(request, contract, chainId, expectedHash, batchRequest = null) {
    this.request = request;
    this.contract = contract;
    this.chainId = chainId;
    this.expectedHash = expectedHash;
    this.batchRequest = batchRequest;
  }
  async check() {
    if (!/^0x[0-9a-f]{40}$/i.test(this.contract))
      throw Error("Invalid room address");
    if ((await this.request("eth_chainId", [])) !== this.chainId)
      throw Error("Connected to the wrong network");
    const raw = await this.request("eth_getCode", [this.contract, "latest"]);
    if (
      !/^0x(?:[a-f0-9]{2})+$/i.test(raw) ||
      sha256Hex(
        Uint8Array.from(raw.slice(2).match(/../g), (v) => parseInt(v, 16)),
      ) !== this.expectedHash
    )
      throw Error("This room does not match the current CITY ZERO contract");
  }
  async read(actor = "") {
    const block = await this.request("eth_blockNumber", []),
      call = (data) => ["eth_call", [{ to: this.contract, data }, block]],
      calls = [
        call("0x7cd3229a"),
        call("0x7cc96380"),
        call("0x6c4470fb"),
        call("0x200d2ed2"),
        call("0xe0ba8cea"),
        ...(actor
          ? [call("0x3e5beab9" + actor.slice(2).padStart(64, "0"))]
          : []),
      ];
    let results;
    if (this.batchRequest) {
      try {
        results = await this.batchRequest(
          calls.map(([method, params]) => ({ method, params })),
        );
        if (!Array.isArray(results) || results.length !== calls.length)
          throw Error("Incomplete batch response");
      } catch {
        results = null;
      }
    }
    results ??= await Promise.all(
      calls.map(([method, params]) => this.request(method, params)),
    );
    const [raw, revision, participants, status, round] = results,
      balance = actor ? results[5] : null;
    const roundWords = words(round, 3);
    if (roundWords[0] > 3n) throw Error("Invalid mission state");
    const b = words(raw, 243),
      p = words(status, 87),
      kinds = b.slice(0, 81).map(integer),
      rotations = b.slice(81, 162).map(integer);
    if (
      kinds.some((k) => k > 8) ||
      rotations.some((r) => r > 3) ||
      b.slice(162).some((v) => v >= 1n << 160n) ||
      p.slice(0, 81).some((v) => v > 1n) ||
      p[86] > 1n
    )
      throw Error("Invalid room state");
    const owners = b
      .slice(162)
      .map((v) => "0x" + v.toString(16).padStart(40, "0"));
    return {
      block,
      kinds,
      rotations,
      owners,
      revision: integer(words(revision, 1)[0]),
      participants: integer(words(participants, 1)[0]),
      active: new Set(p.slice(0, 81).flatMap((v, i) => (v === 1n ? [i] : []))),
      supply: integer(p[81]),
      used: integer(p[82]),
      homes: integer(p[83]),
      gardens: integer(p[84]),
      beacons: integer(p[85]),
      restored: p[86] === 1n,
      balance: balance ? integer(words(balance, 1)[0]) : null,
      phase: integer(roundWords[0]),
      endsAt: integer(roundWords[1]),
      chainTime: integer(roundWords[2]),
    };
  }
  async submit(actor, action) {
    if ((await this.request("eth_chainId", [])) !== this.chainId)
      throw Error("Wallet network changed; switch back to the room network");
    return this.request("eth_sendTransaction", [
      {
        from: actor,
        to: this.contract,
        value: "0x0",
        data: encodeAction(action),
      },
    ]);
  }
  async receipt(hash) {
    if (!/^0x[0-9a-f]{64}$/i.test(hash))
      throw Error("Invalid transaction hash");
    const r = await this.request("eth_getTransactionReceipt", [hash]);
    if (r && r.to?.toLowerCase() !== this.contract.toLowerCase())
      throw Error("Transaction target does not match this room");
    return r;
  }
  async events(from, to) {
    const logs = await this.request("eth_getLogs", [
      { address: this.contract, fromBlock: from, toBlock: to },
    ]);
    const built =
        "0xb3d2e4d61bb575c08ba72a05402ca5e7fe2a7cad7de944cc62a690f93a018f2c",
      removed =
        "0xda244a6edcf3b2d9aaa0c059acf24728801b72aa79f9fbe8af36699ffb1222e8";
    return logs
      .filter(
        (l) =>
          !l.removed &&
          l.address?.toLowerCase() === this.contract.toLowerCase() &&
          [built, removed].includes(l.topics?.[0]),
      )
      .map((l) => {
        const isBuild = l.topics[0] === built,
          v = words(l.data, isBuild ? 3 : 1);
        if (
          l.topics.length !== 3 ||
          !/^0x[0-9a-f]{64}$/i.test(l.transactionHash)
        )
          throw Error("Invalid event payload");
        return {
          type: isBuild ? "build" : "remove",
          actor: "0x" + l.topics[1].slice(-40),
          cell: Number(BigInt(l.topics[2])),
          kind: isBuild ? Number(v[0]) : 0,
          revision: integer(v[isBuild ? 2 : 0]),
          tx: l.transactionHash,
        };
      });
  }
}
export async function publicRpc(method, params) {
  const r = await fetch(MONAD.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw Error("Testnet read failed; try again");
  const data = await r.json();
  if (data.error) throw Error(data.error.message);
  return data.result;
}
export async function publicBatchRpc(calls) {
  if (!Array.isArray(calls) || !calls.length)
    throw Error("Batch request must contain at least one call");
  const requests = calls.map(({ method, params }, index) => ({
    jsonrpc: "2.0",
    id: index + 1,
    method,
    params,
  }));
  const r = await fetch(MONAD.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requests),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw Error("Testnet batch read failed; using compatibility mode");
  const data = await r.json();
  if (!Array.isArray(data)) throw Error("Testnet rejected the batch request");
  const expected = new Set(requests.map(({ id }) => id)),
    responses = new Map();
  for (const item of data) {
    if (!item || !expected.has(item.id) || responses.has(item.id))
      throw Error("Unexpected testnet batch response");
    responses.set(item.id, item);
  }
  return requests.map(({ id }) => {
    const item = responses.get(id);
    if (!item) throw Error("Testnet batch response omitted a call");
    if (item.error) throw Error(item.error.message ?? "Testnet batch call failed");
    if (!("result" in item)) throw Error("Testnet batch response omitted a result");
    return item.result;
  });
}
export async function localPost(path, body, id, instance) {
  const r = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(id ? { "Idempotency-Key": id } : {}),
      ...(instance ? { "X-Room-Instance": instance } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error ?? "Local room request failed");
  return data;
}
