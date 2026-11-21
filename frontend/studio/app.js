import {StudioSession} from './session.js';
import {createPlayer,movePlayer,lookPlayer,jumpPlayer,CAMPS} from './layout.js';

const $=id=>document.getElementById(id),canvas=$('world'),player=createPlayer();
const names={food:'食物',wood:'木材',stone:'石材',home:'居民居所',market:'资源市场'};
const occupations={farmer:'农民',woodcutter:'伐木工',miner:'矿工'};
const eventNames={production:'生产',trade:'交易',consumption:'消费',market_cleared:'市场清算',death:'死亡',resident_died:'死亡',occupation_changed:'转业',world_created:'世界创建',resident_created:'居民创建'};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=cents=>(cents/100).toFixed(2);
let session=new StudioSession(),snapshot=session.snapshot(),scene=null,entered=false,selected=null,hover=null,elapsed=0,drag=null,finished=false;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function note(text){$('note').textContent=text;}
function fail(error){session.paused=true;$('fatal').hidden=false;$('fatal').textContent=`观测站暂不可用：${error.message}。你仍可打开原来的积分对局。`;
  const link=document.createElement('a');link.href='index.html#game';link.textContent=' 返回对局';$('fatal').append(link);}
function release(){player.keys.clear();drag=null;if(document.pointerLockElement===canvas)document.exitPointerLock();}
function stats(){
  snapshot=session.snapshot();$('day').textContent=String(session.day).padStart(2,'0');$('day-caption').textContent=`第 ${session.day} 天`;$('seek').value=session.day;
  $('phase').textContent=session.day===60?'纪元结束':session.paused?'已暂停':'演化中';
  $('run').textContent=session.day===60?'纪元已结束':session.paused?session.day?'▶ 继续演化':'▶ 开始 60 天':'Ⅱ 暂停';
  $('run').disabled=session.day===60;$('step').disabled=session.day===60;$('finish').disabled=session.day===60;$('export').disabled=session.day!==60;
  $('camps').replaceChildren(...snapshot.civs.map(c=>{
    const b=document.createElement('button');b.style.setProperty('--camp',['#a99cfa','#7bbfb9','#d7a17b','#b8ba91'][c.id]);b.setAttribute('aria-pressed',String(session.observed===c.id));
    const title=document.createElement('strong');title.textContent=c.name+(session.observed===c.id?' · 你的预测':'');const text=document.createElement('small');text.textContent=`${c.alive}/5 存活 · ${c.trades} 笔交易`;
    b.append(title,text);b.onclick=()=>{if(session.day===0)session.predict(c.id);selected={type:'camp',civ:c.id};inspect(selected);stats();};return b;
  }));
  if(selected)drawInspection();
  if(session.day===60&&!finished){finished=true;const result=session.result();note(`${result.winner_name} 胜出。到中央账本或按「导出报告」查看结局；本局尚未上链。`);}
}
function rows(entries){return `<dl>${entries.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;}
function recent(c,residentId=null,resource=null){
  const events=c.events.filter(e=>(residentId===null||e.resident_id===residentId||e.counterparty_id===residentId)&&(!resource||e.data.resource===resource||e.kind==='consumption')).slice(-8);
  return `<details><summary>第 ${snapshot.day} 天 · 引擎事件 ${events.length?`（展示 ${events.length} 条）`:''}</summary><ol>${events.map(e=>`<li>#${e.seq} ${esc(eventNames[e.kind]??e.kind)}<br><code>${esc(JSON.stringify(e.data))}</code></li>`).join('')||'<li>当天暂无此类事件。</li>'}</ol></details>`;
}
function inspect(target){release();session.paused=true;entered=true;$('welcome').hidden=true;document.body.classList.add('playing');selected=target;$('inspector').hidden=false;document.body.classList.add('inspecting');drawInspection();$('inspect-close').focus();}
function drawInspection(){
  const target=selected;if(!target)return;
  const c=snapshot.civs[target.civ];let title='',body='',type='ENGINE / 实时观测';
  if(target.type==='proof'){
    title='中央账本';type='RECOMPUTE / 可复现证明';
    if(session.day<60)body='<p>每一天由同一套确定性引擎推进。纪元结束后，这里会给出四个文明的摘要与胜者，并可独立重跑核对。</p><button id="inspect-finish">快进到结局</button>';
    else{const r=session.result();body=rows([['本局胜者',r.winner_name],['你的预测',session.observed===null?'未选择':snapshot.civs[session.observed].name],['摘要状态','本局未上链']])+`<p>纪元 SHA-256</p><code>${esc(r.digest)}</code><p>摘要证明输入与输出可复现；它不证明模拟规则就是真实经济。</p><button id="verify">独立重算本局</button><p id="verification">${session.verification?(session.verification.passed?'✓ 与参考纪元逐字段一致':'× 重算不一致'):'尚未执行重算'}</p><details><summary>查看各文明结算</summary>${r.civs.map(civ=>`<p>${esc(civ.name)} · ${civ.alive} 人存活 · ${civ.score} 分<br><code>${esc(civ.digest)}</code></p>`).join('')}</details>`;}
  }else if(target.type==='resident'){
    const r=c.residents.find(r=>r.id===target.id);if(!r)return;
    title=r.name;body=rows([['所属文明',c.name],['职业',occupations[r.occupation]],['状态',r.alive?'存活':'已死亡'],['健康',r.health],['现金',`${money(r.cash)} 积分`],...Object.entries(r.inventory).map(([k,v])=>[names[k],v])])+recent(c,r.id);
  }else{
    title=target.type==='camp'?c.name:`${c.name} / ${names[target.kind]}`;
    body=rows([['存活居民',`${c.alive} / 5`],['累计交易',c.trades],['总健康',c.health]]);
    if(target.kind&&['food','wood','stone'].includes(target.kind)){
      const resource=target.kind;body+=rows([['总持有量',c.holdings[resource]],['参考价格',money(c.prices[resource])],['累计生产',c.produced[resource]],['累计消费',c.consumed[resource]]]);
      body+='<p>仓储外观只提示是否有库存；精确数量以账本为准。</p>'+recent(c,null,resource);
    }else{body+=rows(Object.entries(c.holdings).map(([k,v])=>[names[k]+'库存',v]));body+=recent(c);}
    body+=`<button id="visit">走到 ${esc(c.name)} 入口</button>`;
  }
  $('inspect-title').textContent=title;$('inspect-type').textContent=type;$('inspect-body').innerHTML=body;
  $('verify')?.addEventListener('click',()=>{try{const result=session.verify();drawInspection();note(result.passed?'独立重算通过。没有发送任何链上交易。':'重算不一致，请导出报告排查。');}catch(e){note(e.message);}});
  $('inspect-finish')?.addEventListener('click',finish);
  $('visit')?.addEventListener('click',()=>{
    const center=CAMPS[target.civ];
    player.x=center.x;player.z=center.z+10;player.yaw=0;player.pitch=0;player.height=0;player.velocity=0;entered=true;$('welcome').hidden=true;document.body.classList.add('playing');closeInspection();note('已到文明入口。走近居民或生产站，准星对准后按 E。');
  });
}
function closeInspection(){selected=null;$('inspector').hidden=true;document.body.classList.remove('inspecting');canvas.focus();stats();}
function finish(){try{session.paused=true;session.advance(60-session.day);stats();}catch(e){fail(e);}}
function targetText(target){if(!target)return '走近居民、生产站或中央账本 · E 检查';if(target.type==='proof')return 'E · 中央账本';const c=snapshot.civs[target.civ];return target.type==='resident'?`E · ${c.residents.find(r=>r.id===target.id)?.name}`:`E · ${c.name} ${names[target.kind]}`;}
function safe(action){return ()=>{try{action();}catch(e){note(e.message);}};}
$('run').onclick=safe(()=>{session.paused=!session.paused;if(!session.paused){entered=true;$('welcome').hidden=true;document.body.classList.add('playing');}elapsed=0;stats();});
$('step').onclick=safe(()=>{session.paused=true;session.advance();stats();});$('finish').onclick=finish;
$('ledger').onclick=()=>inspect({type:'proof'});
$('seek').onchange=safe(()=>{session.seek(Number($('seek').value));finished=session.day===60;elapsed=0;stats();note(`已按原种子重建第 ${session.day} 天；视角和动画不参与摘要。`);});
$('reset').onclick=safe(()=>{session=new StudioSession({seed:Number($('seed').value)});finished=false;selected=null;closeInspection();stats();note('新纪元已准备。观察标记和之前的报告不会自动沿用。');});
$('export').onclick=safe(()=>{const blob=new Blob([JSON.stringify(session.report(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`genesis-studio-${session.params.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('inspect-close').onclick=closeInspection;$('touch-inspect').onclick=()=>{if(hover)inspect(hover);};
$('guide-toggle').onclick=()=>{const open=$('guide').hidden;$('guide').hidden=!open;$('guide-toggle').setAttribute('aria-expanded',String(open));};
function enter(){entered=true;$('welcome').hidden=true;document.body.classList.add('playing');canvas.focus();
  if(!matchMedia('(pointer:coarse)').matches)try{const promise=canvas.requestPointerLock?.();promise?.catch(()=>note('鼠标锁定未开启；按住画面拖动或用方向键转向。'));}catch{note('按住画面拖动，或用方向键转向。');}
}
$('enter').onclick=enter;
canvas.onpointerdown=e=>{canvas.focus();if(!entered){entered=true;$('welcome').hidden=true;document.body.classList.add('playing');}drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture?.(e.pointerId);};
canvas.onpointermove=e=>{if(selected)return;if(document.pointerLockElement===canvas)lookPlayer(player,e.movementX,e.movementY);else if(drag?.id===e.pointerId){lookPlayer(player,e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;}};
canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};canvas.oncontextmenu=e=>e.preventDefault();
window.addEventListener('keydown',e=>{if(e.key==='Escape'){release();if(selected)closeInspection();return;}
  if(e.target instanceof HTMLElement&&e.target.closest('input,button,a,summary'))return;if(!entered||selected)return;
  const key=e.key.toLowerCase();if(['w','a','s','d','shift','arrowleft','arrowright','arrowup','arrowdown',' '].includes(key)){e.preventDefault();player.keys.add(key);}
  if(key===' '&&!e.repeat)jumpPlayer(player);if(key==='e'&&!e.repeat&&hover)inspect(hover);
});
window.addEventListener('keyup',e=>player.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{release();session.paused=true;stats();});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas)player.keys.clear();});
for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);player.keys.add(b.dataset.key);};const up=()=>player.keys.delete(b.dataset.key);b.onpointerup=up;b.onpointercancel=up;b.onlostpointercapture=up;}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();release();fail(new Error('图形上下文已丢失，请刷新重试'));});
let frame=0,last=0,hoverTick=0;
async function boot(){stats();try{
  const {mountScene}=await import('./scene.js');scene=mountScene(canvas);
  const tick=time=>{try{const dt=last?Math.min(.04,(time-last)/1000):0;last=time;
    if(!document.hidden&&entered&&!selected)movePlayer(player,dt);
    if(!session.paused&&!document.hidden){elapsed+=dt;if(elapsed>=1.4){elapsed=0;session.advance();stats();}}
    scene.render(player,snapshot,reduced.matches?0:time/1000);
    if(time-hoverTick>100){hoverTick=time;hover=scene.pick();$('target').textContent=targetText(hover);}
    frame=requestAnimationFrame(tick);
  }catch(e){fail(e);}};frame=requestAnimationFrame(tick);
}catch(e){fail(e);}}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);release();scene?.dispose();},{once:true});
window.addEventListener('pageshow',e=>{if(e.persisted)window.location.reload();});
void boot();
