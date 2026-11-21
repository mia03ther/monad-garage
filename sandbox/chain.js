import {digest,Island} from './model.js';
import {sha256Hex} from '../engine.js';
import {RUNTIME_HASH} from './contract-info.js';
export const NETWORK={chainId:'0x279f',name:'Monad Testnet',rpc:'https://testnet-rpc.monad.xyz',explorer:'https://testnet.monadexplorer.com'};
const word=n=>BigInt(n).toString(16).padStart(64,'0');
const hex=text=>Array.from(new TextEncoder().encode(text),n=>n.toString(16).padStart(2,'0')).join('');
export function encodePublish(blueprint){Island.restore(blueprint);const data=hex(blueprint);if(data.length/2>8192)throw Error('链上蓝图最多 8192 字节；可继续使用文件分享');return '0x70a74532'+digest(blueprint)+word(64)+word(data.length/2)+data.padEnd(Math.ceil(data.length/64)*64,'0');}
export function decodeBytes(raw){if(!/^0x[0-9a-f]*$/i.test(raw)||raw.length<130)throw Error('链上数据格式错误');const body=raw.slice(2),offset=Number(BigInt('0x'+body.slice(0,64)))*2;if(offset!==64)throw Error('无效字节偏移');const length=Number(BigInt('0x'+body.slice(offset,offset+64)));if(!Number.isSafeInteger(length)||length>8192||body.length<offset+64+length*2)throw Error('链上内容大小错误');return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(body.slice(offset+64,offset+64+length*2).match(/../g)??[],b=>parseInt(b,16)));}
export function decodePublish(input){if(!/^0x70a74532[0-9a-f]+$/i.test(input)||input.length<202||BigInt('0x'+input.slice(74,138))!==64n)throw Error('这不是蓝图发布交易');const hash=input.slice(10,74).toLowerCase(),blueprint=decodeBytes('0x'+word(32)+input.slice(138));Island.restore(blueprint);if(digest(blueprint)!==hash)throw Error('内容摘要不匹配');return {hash,blueprint};}
// Separate transport allows the exact wallet/RPC flow to run on local Anvil in tests.
export class BlueprintChain {
  constructor(request){this.request=request;}
  async check(contract){if(!/^0x[0-9a-f]{40}$/i.test(contract))throw Error('请填写已部署的蓝图合约地址');if(await this.request('eth_chainId',[])!==NETWORK.chainId)throw Error('请选择 Monad Testnet（10143）');const code=await this.request('eth_getCode',[contract,'latest']);if(!/^0x[0-9a-f]+$/i.test(code)||sha256Hex(Uint8Array.from(code.slice(2).match(/../g)??[],b=>parseInt(b,16)))!==RUNTIME_HASH)throw Error('合约运行时代码与已测试蓝图合约不符');}
  async publish(contract,blueprint){await this.check(contract);const [from]=await this.request('eth_requestAccounts',[]);if(!from)throw Error('钱包没有授权账户');return this.request('eth_sendTransaction',[{from,to:contract,value:'0x0',data:encodePublish(blueprint)}]);}
  async restore(contract,txHash){await this.check(contract);if(!/^0x[0-9a-f]{64}$/i.test(txHash))throw Error('交易哈希格式错误');
    const tx=await this.request('eth_getTransactionByHash',[txHash]),receipt=await this.request('eth_getTransactionReceipt',[txHash]);
    if(!tx||!receipt)throw Error('交易尚未确认，请稍后重试');if(receipt.status!=='0x1'||tx.to?.toLowerCase()!==contract.toLowerCase())throw Error('交易失败或目标合约不符');
    const decoded=decodePublish(tx.input),stored=decodeBytes(await this.request('eth_call',[{to:contract,data:'0x61da1439'+decoded.hash},receipt.blockNumber]));
    if(stored!==decoded.blueprint)throw Error('合约存储与交易内容不一致');return {...decoded,author:tx.from,block:receipt.blockNumber};
  }
}
export async function rpc(method,params){const response=await fetch(NETWORK.rpc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('测试网 RPC 不可用');const data=await response.json();if(data.error)throw Error(data.error.message);return data.result;}
