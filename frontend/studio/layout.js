// Original circular observatory campus and modular economic buildings.
export const CAMPS=[
  {id:0,x:-26,z:-24,color:'#a99cfa',name:'Aurora'},
  {id:1,x:26,z:-24,color:'#7bbfb9',name:'Boreas'},
  {id:2,x:26,z:24,color:'#d7a17b',name:'Cinder'},
  {id:3,x:-26,z:24,color:'#b8ba91',name:'Dune'},
];
export const OFFSETS={food:[-6,-5],wood:[6,-5],stone:[7,5],home:[-6,5],market:[0,0]};
export const BUILDINGS=CAMPS.flatMap(c=>Object.entries(OFFSETS).map(([kind,[x,z]])=>({id:`${c.id}:${kind}`,civ:c.id,kind,x:c.x+x,z:c.z+z,radius:kind==='market'?2:3.1})));
export const SPAWN={x:0,z:14,yaw:0,pitch:0};
export const MAX_PLAYER_RADIUS=59;
export function canWalk(x,z){return Math.hypot(x,z)<MAX_PLAYER_RADIUS&&!BUILDINGS.some(b=>b.kind!=='market'&&Math.abs(x-b.x)<3.7&&Math.abs(z-b.z)<3.5)&&Math.hypot(x,z)>4.4;}
export function createPlayer(){return {...SPAWN,keys:new Set(),height:0,velocity:0};}
export function movePlayer(player,dt){
  dt=Math.min(.04,Math.max(0,dt));
  if(player.keys.has('arrowleft'))player.yaw+=dt*1.8;
  if(player.keys.has('arrowright'))player.yaw-=dt*1.8;
  const f=Number(player.keys.has('w')||player.keys.has('arrowup'))-Number(player.keys.has('s')||player.keys.has('arrowdown'));
  const r=Number(player.keys.has('d'))-Number(player.keys.has('a'));
  if(f||r){const length=Math.hypot(f,r),speed=player.keys.has('shift')?12:6.5;
    const dx=(-Math.sin(player.yaw)*f+Math.cos(player.yaw)*r)/length*speed*dt;
    const dz=(-Math.cos(player.yaw)*f-Math.sin(player.yaw)*r)/length*speed*dt;
    if(canWalk(player.x+dx,player.z))player.x+=dx;
    if(canWalk(player.x,player.z+dz))player.z+=dz;
  }
  player.velocity-=15*dt;player.height=Math.max(0,player.height+player.velocity*dt);if(player.height===0)player.velocity=0;
}
export function lookPlayer(player,dx,dy){player.yaw-=dx*.0025;player.pitch=Math.max(-1.1,Math.min(1.1,player.pitch-dy*.0025));}
export function jumpPlayer(player){if(player.height===0&&player.velocity===0){player.velocity=5;return true;}return false;}
