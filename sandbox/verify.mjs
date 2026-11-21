import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Island} from './model.js';
import {encodePublish,decodePublish,BlueprintChain} from './chain.js';
export function demo(){const w=new Island();for(const [kind,x,z] of [['generator',1,0],['lumber',-1,0],['quarry',0,-1],['garden',0,1],['home',1,1],['home',-1,1],['beacon',1,-1]])w.apply({type:'place',kind,x,z,rotation:0});for(let i=0;i<3;i++)w.apply({type:'tick'});return w;}
test('build, power, production and dismantle change the real sandbox state',()=>{const w=demo();assert.equal(w.status().won,true);assert.equal(w.status().population,4);assert.equal(w.status().used,7);assert.deepEqual(w.stock,[12,15,2]);assert.equal(w.food,18);w.apply({type:'remove',x:1,z:0});assert.equal(w.status().won,false);assert.equal(w.network().supply,1);assert.deepEqual(w.stock,[15,20,4]);});
test('repeated place/remove never duplicates materials',()=>{const w=new Island();for(let i=0;i<100;i++){w.apply({type:'place',kind:'generator',x:1,z:0,rotation:i%4});w.apply({type:'remove',x:1,z:0});}assert.deepEqual(w.stock,[32,32,6]);});
test('reject malformed actions, overlaps, bounds, insufficient funds and protected core atomically',()=>{const w=new Island();for(const a of [{type:'place',kind:'home',x:0,z:0,rotation:0},{type:'remove',x:0,z:0},{type:'place',kind:'__proto__',x:1,z:1,rotation:0},{type:'place',kind:'home',x:99,z:0,rotation:0},{type:'place',kind:'home',x:1,z:1,rotation:NaN}]){const before=w.report();assert.throws(()=>w.apply(a));assert.deepEqual(w.report(),before);}for(let i=1;i<=3;i++)w.apply({type:'place',kind:'generator',x:i,z:0,rotation:0});assert.throws(()=>w.apply({type:'place',kind:'generator',x:0,z:1,rotation:0}));assert.ok(w.stock.every(n=>n>=0));});
test('deterministic portable blueprint replays exactly and ABI round trips',()=>{const w=demo(),text=w.blueprint();assert.deepEqual(Island.restore(text).report(),w.report());assert.equal(decodePublish(encodePublish(text)).blueprint,text);assert.equal(decodePublish(encodePublish(text)).hash,w.report().digest);assert.throws(()=>decodePublish(encodePublish(text).replace(w.report().digest,'0'.repeat(64))));assert.throws(()=>Island.restore('{"format":"genesis.island","version":2,"actions":[]}'));});
test('disconnected production does not create materials',()=>{const w=new Island();w.apply({type:'place',kind:'lumber',x:4,z:0,rotation:0});const stock=[...w.stock];w.apply({type:'tick'});assert.deepEqual(w.stock,stock);});
test('chain gateway fails closed for wrong chain, unconfirmed receipt and wrong target',async()=>{
  const address='0x'+'1'.repeat(40),hash='0x'+'2'.repeat(64);
  await assert.rejects(()=>new BlueprintChain(async()=> '0x1').check(address),/请选择/);
  const artifact=JSON.parse(readFileSync(new URL('./contract-build.json',import.meta.url),'utf8'));
  let receipt=null,target=address;
  const chain=new BlueprintChain(async method=>({eth_chainId:'0x279f',eth_getCode:artifact.runtimeBytecode,eth_getTransactionByHash:{to:target},eth_getTransactionReceipt:receipt})[method]);
  await assert.rejects(()=>chain.restore(address,hash),/尚未确认/);
  receipt={status:'0x0'};await assert.rejects(()=>chain.restore(address,hash),/交易失败/);
  receipt={status:'0x1'};target='0x'+'3'.repeat(40);await assert.rejects(()=>chain.restore(address,hash),/目标合约/);
});
test('actual browser build, dismantle, rebuild and day advance replay correctly',()=>{
  const w=Island.restore(readFileSync(new URL('../../docs/examples/island-browser.blueprint.json',import.meta.url),'utf8'));
  assert.equal(w.day,4);assert.equal(w.status().population,4);assert.deepEqual(w.stock,[15,18,2]);assert.equal(w.food,20);
});
