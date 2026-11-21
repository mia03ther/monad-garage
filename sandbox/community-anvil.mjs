// Real multi-address local-chain experiment; no public RPC or private key.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
const node=spawn(process.env.ANVIL??'anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','10143','--silent'],{windowsHide:true,stdio:'ignore'});
let spawnError;node.on('error',e=>spawnError=e);
async function rpc(method,params=[]){const r=await fetch(`http://127.0.0.1:${port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(3000)});const data=await r.json();if(data.error)throw Error(data.error.message);return data.result;}
const word=n=>BigInt(n).toString(16).padStart(64,'0');
async function receipt(tx){for(let i=0;i<100;i++){const r=await rpc('eth_getTransactionReceipt',[tx]);if(r)return r;await new Promise(r=>setTimeout(r,100));}throw Error('receipt timeout');}
try{
  let ready=false;for(let i=0;i<100;i++){if(spawnError)throw spawnError;try{await rpc('eth_chainId');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}if(!ready)throw Error('Anvil unavailable');
  const artifact=JSON.parse(await readFile(new URL('../../contracts/out/GenesisCommunity.sol/GenesisCommunity.json',import.meta.url),'utf8'));
  const [alice,bob,carol]=await rpc('eth_accounts');
  const deployment=await rpc('eth_sendTransaction',[{from:alice,data:artifact.bytecode.object,gas:'0x600000'}]);
  const deployed=await receipt(deployment);assert.equal(deployed.status,'0x1');const contract=deployed.contractAddress;
  const build=(cell,kind,rotation=0)=>'0x50548d40'+word(cell)+word(kind)+word(rotation);
  const transactions=[];
  for(const [from,cell,kind] of [[alice,41,2],[bob,50,3],[carol,49,4]]){
    const tx=await rpc('eth_sendTransaction',[{from,to:contract,data:build(cell,kind),gas:'0x80000'}]);
    const r=await receipt(tx);assert.equal(r.status,'0x1');transactions.push({from,cell,kind,tx,block:r.blockNumber});
  }
  // Pin one observed block so all three clients inspect the same revision.
  const block=await rpc('eth_blockNumber');
  const boardAbi=artifact.methodIdentifiers['board()'];
  const results=await Promise.all([alice,bob,carol].map(from=>rpc('eth_call',[{from,to:contract,data:'0x'+boardAbi},block])));
  assert.equal(results[0],results[1]);assert.equal(results[1],results[2]);
  const data=results[0].slice(2),values=Array.from({length:243},(_,i)=>BigInt('0x'+data.slice(i*64,i*64+64)));
  assert.equal(values[40],8n);assert.equal(values[41],2n);assert.equal(values[50],3n);assert.equal(values[49],4n);
  assert.equal(values[162+41],BigInt(alice));assert.equal(values[162+50],BigInt(bob));assert.equal(values[162+49],BigInt(carol));
  await assert.rejects(()=>rpc('eth_estimateGas',[{from:bob,to:contract,data:build(41,3)}]));
  await assert.rejects(()=>rpc('eth_estimateGas',[{from:bob,to:contract,data:'0xf06730e0'+word(41)}]));
  const report={network:'Anvil-local',publicMonadTestnet:false,contract,block,participants:3,transactions,threeClientsIdentical:true,ownersVerified:true,occupiedTileRejected:true,unauthorizedDismantleRejected:true,frontendIntegrated:false};
  await writeFile(new URL('../../docs/examples/community-anvil.report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{node.kill();}
