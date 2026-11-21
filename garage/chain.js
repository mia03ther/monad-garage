import { sha256Hex } from "../engine.js";
import { word, words } from "../community/gateway.js";
import { key, score } from "./rules.js";

export const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HASH = /^0x[0-9a-f]{64}$/i;
// BuildPublished(uint256,uint256,address,bool,bool)
const PUBLISHED = "0xbbbf05290d3b58320e15bc9abbf99376804f86684fdf12976fd7e604f73a01af";

export function versionId(value) {
  const id = String(value);
  if (!/^(0|[1-9][0-9]{0,77})$/.test(id) || BigInt(id) >= 2n ** 256n) {
    throw Error("无效车辆编号");
  }
  return BigInt(id);
}

export class GarageRegistry {
  constructor(request, address, chainId, artifact, blockTag = "finalized") {
    if (!ADDRESS.test(address)) throw Error("无效工作坊地址");
    this.request = request;
    this.address = address.toLowerCase();
    this.chainId = chainId;
    this.artifact = artifact;
    this.blockTag = blockTag;
  }

  data(signature, ...args) {
    return "0x" + this.artifact.methods[signature] + args.map(word).join("");
  }

  async check() {
    if (await this.request("eth_chainId", []) !== this.chainId) throw Error("网络不匹配");
    const raw = await this.request("eth_getCode", [this.address, this.blockTag]);
    if (!/^0x(?:[a-f0-9]{2})+$/i.test(raw) ||
        sha256Hex(Uint8Array.from(raw.slice(2).match(/../g), (byte) => parseInt(byte, 16))) !== this.artifact.runtimeHash) {
      throw Error("该地址不是兼容的 GENESIS GARAGE 合约");
    }
  }

  async call(signature, ...args) {
    return this.request("eth_call", [{ to: this.address, data: this.data(signature, ...args) }, this.blockTag]);
  }

  async read(id) {
    const version = versionId(id);
    const [parent, author, motor, tires, boost, timeMs, beatParent, promoted] =
      words(await this.call("read(uint256)", version), 8);
    if (author >= 2n ** 160n || (version === 0n ? parent !== 0n : parent >= version)) throw Error("无效的链上车辆数据");
    if (beatParent > 1n || promoted > 1n || (promoted === 1n && version !== 0n && beatParent !== 1n)) {
      throw Error("无效的链上擂台状态");
    }
    const build = { motor: Number(motor), tires: Number(tires), boost: Number(boost) };
    if (BigInt(score(build).ms) !== timeMs) throw Error("链上成绩与此版本规则不匹配");
    return {
      version, parent, author: "0x" + author.toString(16).padStart(40, "0"), build,
      timeMs: Number(timeMs), beatParent: beatParent === 1n, promoted: promoted === 1n,
    };
  }

  async champion() {
    return versionId(BigInt(await this.call("championVersion()")));
  }

  async count() {
    return versionId(BigInt(await this.call("nextVersion()")));
  }

  transaction(from, parent, build) {
    if (!ADDRESS.test(from)) throw Error("无可用钱包账号");
    key(build);
    return { from, to: this.address, value: "0x0", data: this.data("publish(uint256,uint8,uint8,uint8)", versionId(parent), build.motor, build.tires, build.boost) };
  }

  async confirmed(hash, { from, parent, build }) {
    if (!HASH.test(hash)) throw Error("无效交易哈希");
    const receipt = await this.request("eth_getTransactionReceipt", [hash]);
    if (!receipt) return null;
    const head = await this.request("eth_getBlockByNumber", [this.blockTag, false]);
    if (!head || BigInt(head.number) < BigInt(receipt.blockNumber)) return null;
    const mined = await this.request("eth_getBlockByNumber", [receipt.blockNumber, false]);
    if (mined?.hash !== receipt.blockHash) return null;
    if (receipt.status !== "0x1") {
      throw Object.assign(Error("交易已回滚，版本未保存"), { code: "GARAGE_REVERTED" });
    }
    const log = receipt.logs.find((entry) => entry.address.toLowerCase() === this.address && entry.topics[0] === PUBLISHED);
    const expectedAuthor = "0x" + from.toLowerCase().slice(2).padStart(64, "0");
    if (receipt.to?.toLowerCase() !== this.address || !log || log.topics.length !== 4 ||
        !HASH.test(log.topics[1]) || log.topics[2] !== "0x" + word(versionId(parent)) || log.topics[3] !== expectedAuthor) {
      throw Error("交易没有发布预期车辆");
    }
    const record = await this.read(BigInt(log.topics[1]));
    const [beatParent, promoted] = words(log.data, 2);
    if (key(record.build) !== key(build) || record.parent !== versionId(parent) || record.author !== from.toLowerCase()) {
      throw Error("链上车辆与提交内容不匹配");
    }
    if (beatParent !== BigInt(record.beatParent) || promoted !== BigInt(record.promoted)) {
      throw Error("链上擂台结果与事件不匹配");
    }
    return record;
  }
}
