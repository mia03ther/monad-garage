import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {StudioSession} from './session.js';
import {runEpoch,stateDigest} from '../engine.js';
import {BUILDINGS,canWalk,createPlayer,movePlayer,lookPlayer,jumpPlayer} from './layout.js';
import {createScene} from './scene.js';

test('incremental scene playback equals canonical epoch and is camera-independent',()=>{
  for(const seed of [42,43,7]){
    const session=new StudioSession({seed});session.advance(12);session.advance(48);
    assert.deepEqual(session.result(),runEpoch({seed}));assert.equal(session.verify().passed,true);
    assert.equal(session.report().chain.submitted,false);
  }
});
test('rewinding reconstructs the same state; prediction never changes result',()=>{
  const session=new StudioSession();session.predict(1);session.advance(20);
  const before=session.worlds.map(stateDigest);session.advance(40);const result=session.result();
  session.seek(20);assert.deepEqual(session.worlds.map(stateDigest),before);assert.equal(session.observed,1);
  session.advance(40);assert.deepEqual(session.result(),result);
});
test('snapshot edits cannot create inventory, health, cash or fake events',()=>{
  const session=new StudioSession();session.advance();const before=session.worlds.map(stateDigest),view=session.snapshot();
  view.civs[0].residents[0].inventory.food=-100;view.civs[0].residents[0].skills.farmer=0;view.civs[0].events[0].data.bad=true;
  assert.deepEqual(session.worlds.map(stateDigest),before);
});
test('incomplete and invalid operations fail explicitly; no false proof',()=>{
  const s=new StudioSession();assert.throws(()=>s.result());assert.throws(()=>s.verify());assert.equal(s.verification,null);
  for(const seed of [NaN,1.2,-1,1e10])assert.throws(()=>new StudioSession({seed}));
  for(const n of [-1,1.5,91])assert.throws(()=>s.advance(n));
  for(const n of [-1,61,2.2])assert.throws(()=>s.seek(n));
  s.advance();assert.throws(()=>s.predict(0));s.reset();assert.equal(s.day,0);assert.equal(s.observed,null);
});
test('resource scarcity changes actual engine outcome, not just scenery',()=>{
  const session=new StudioSession({maxOrders:2});session.advance(60);
  assert.deepEqual(session.result(),runEpoch({maxOrders:2}));assert.ok(session.snapshot().civs.some(c=>c.alive<5));
});
test('motion is relative to view, bounded, collision-aware and jump returns to ground',()=>{
  const p=createPlayer();p.keys.add('w');movePlayer(p,.04);assert.ok(p.z<14);
  p.keys.clear();p.keys.add('d');p.yaw=Math.PI/2;const old=p.z;movePlayer(p,.04);assert.ok(p.z<old);
  for(const b of BUILDINGS.filter(b=>b.kind!=='market'))assert.equal(canWalk(b.x,b.z),false);
  assert.equal(canWalk(0,0),false);assert.equal(canWalk(80,0),false);
  assert.equal(jumpPlayer(p),true);assert.equal(jumpPlayer(p),false);
  movePlayer(p,.04);assert.equal(jumpPlayer(p),false);p.keys.clear();for(let i=0;i<100;i++)movePlayer(p,.02);assert.equal(p.height,0);
  lookPlayer(p,1e4,1e4);assert.equal(p.pitch,-1.1);
});

test('original scene has selectable engine residents, finite geometry and working ray selection',()=>{
  const world=createScene(),session=new StudioSession();
  assert.equal(world.residents.length,20);assert.equal(world.structures.length,20);
  world.update(session.snapshot(),0);
  world.scene.traverse(object=>{
    if(object.isMesh)assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
  });
  world.camera.position.set(0,1.85,7);world.camera.lookAt(0,1.85,0);
  assert.equal(world.pick().type,'proof');
  const expected=session.worlds.map(stateDigest);world.update(session.snapshot(),10000);
  assert.deepEqual(session.worlds.map(stateDigest),expected);
  session.advance(60);world.update(session.snapshot(),0);
  assert.equal(world.residents.filter(r=>r.visible).length,session.snapshot().civs.reduce((n,c)=>n+c.alive,0));
  world.dispose();assert.equal(world.scene.children.length,0);
});

test('scarcity is represented by the actual resident survival flags',()=>{
  const world=createScene(),session=new StudioSession({maxOrders:0});session.advance(60);
  const snapshot=session.snapshot();world.update(snapshot,1);
  for(let i=0;i<20;i++)assert.equal(world.residents[i].visible,snapshot.civs[Math.floor(i/5)].residents[i%5].alive);
  world.dispose();
});

test('the actual browser-exported report replays to the canonical result',()=>{
  const report=JSON.parse(readFileSync(new URL('../../docs/examples/world-studio-42.report.json',import.meta.url),'utf8'));
  assert.equal(report.format,'genesis.studio-report');assert.equal(report.version,1);
  const r=report.result;
  assert.deepEqual(r,runEpoch({seed:r.seed,days:r.days,civs:r.num_civs,residentsPerCiv:r.residents_per_civ,taxBps:r.tax_rate_bps,maxOrders:r.max_orders_per_day}));
  assert.equal(report.verification.passed,true);assert.equal(report.verification.reference,r.digest);
  assert.equal(report.verification.observed,r.digest);assert.equal(report.chain.submitted,false);
});
