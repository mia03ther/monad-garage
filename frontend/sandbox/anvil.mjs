// Real local-chain validation. No public endpoint, funded wallet or secret is used.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Island} from './model.js';
import {BlueprintChain,encodePublish} from './chain.js';
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const anvil=spawn(process.env.ANVIL??'anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','10143','--silent'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let spawnError=null;anvil.on('error',e=>spawnError=e);
const request=async(method,params=[])=>{if(method==='eth_requestAccounts')method='eth_accounts';const r=await fetch(`http://127.0.0.1:${port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(3000)});const json=await r.json();if(json.error)throw Error(json.error.message);return json.result;};
async function receipt(tx){for(let i=0;i<100;i++){const r=await request('eth_getTransactionReceipt',[tx]);if(r)return r;await new Promise(r=>setTimeout(r,100));}throw Error('receipt timeout');}
try{
  let ready=false;for(let i=0;i<100;i++){if(spawnError)throw spawnError;try{await request('eth_chainId');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}if(!ready)throw Error('Anvil not ready');
  const artifact=JSON.parse(await readFile(new URL('../../contracts/out/GenesisBlueprints.sol/GenesisBlueprints.json',import.meta.url),'utf8'));
  const [from]=await request('eth_accounts'),deploy=await request('eth_sendTransaction',[{from,data:artifact.bytecode.object,gas:'0x500000'}]),deployed=await receipt(deploy);assert.equal(deployed.status,'0x1');
  const contract=deployed.contractAddress,w=new Island();w.apply({type:'place',kind:'generator',x:1,z:0,rotation:0});w.apply({type:'tick'});
  const chain=new BlueprintChain(request),tx=await chain.publish(contract,w.blueprint());await receipt(tx);const restored=await chain.restore(contract,tx);
  assert.deepEqual(Island.restore(restored.blueprint).report(),w.report());
  await assert.rejects(()=>request('eth_estimateGas',[{from,to:contract,data:encodePublish(w.blueprint()).replace(w.report().digest,'0'.repeat(64))}]));
  const report={network:'Anvil-local',chainId:10143,publicMonadTestnet:false,contract,tx,digest:restored.hash,author:restored.author,exactReplay:true,tamperedDigestRejected:true};
  await writeFile(new URL('../../docs/examples/island-anvil.report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{anvil.kill();}
