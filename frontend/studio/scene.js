// Original GENESIS geometry. Only Three.js is vendored; no reference-plugin code.
import * as T from '../vendor/three.module.js';
import { CAMPS, BUILDINGS, OFFSETS } from './layout.js';

export function createScene(){
  const scene=new T.Scene();scene.background=new T.Color('#b3b3cc');scene.fog=new T.Fog('#b3b3cc',65,180);
  const camera=new T.PerspectiveCamera(65,1,.08,240);scene.add(camera);
  const geometries=new Set(),materials=new Map(),textures=new Set(),picks=[];
  const geo=g=>{geometries.add(g);return g;};
  const cube=geo(new T.BoxGeometry(1,1,1));
  const material=(color,metalness=0)=>{const key=color+metalness;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.65,metalness}));return materials.get(key);};
  const add=(group,g,m,x,y,z,scale=[1,1,1])=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const box=(g,x,y,z,w,h,d,color)=>add(g,cube,material(color),x,y,z,[w,h,d]);
  const cylinder=(g,x,y,z,r,h,color,sides=12)=>add(g,geo(new T.CylinderGeometry(r,r,h,sides)),material(color),x,y,z);
  scene.add(new T.HemisphereLight('#eee6ff','#647962',2.4));
  const sun=new T.DirectionalLight('#ffe3b7',3.2);sun.position.set(-35,70,35);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:180});sun.shadow.bias=-.0005;scene.add(sun);
  cylinder(scene,0,-.35,0,66,.6,'#899e88',96);
  const rim=new T.Mesh(geo(new T.TorusGeometry(65.7,.38,6,128)),material('#6b7c7b'));rim.rotation.x=Math.PI/2;rim.position.y=-.1;scene.add(rim);
  // A concentric ledger instrument is the original landmark and proof station.
  const ledger=new T.Group();scene.add(ledger);ledger.userData={type:'proof'};picks.push(ledger);
  cylinder(ledger,0,.25,0,4.2,.5,'#c8c7c6',32);cylinder(ledger,0,.65,0,3.4,.3,'#646573',32);
  box(ledger,0,2,0,1.8,2.5,1.8,'#77708e');
  for(let i=0;i<3;i++){
    const ring=new T.Mesh(geo(new T.TorusGeometry(2.8-i*.45,.13,6,48)),material(i%2?'#cbb7ee':'#d6d3df',.3));ring.position.y=3.3;ring.rotation.x=.35+i*.8;ring.rotation.y=i*.9;ledger.add(ring);
  }
  const gem=add(ledger,geo(new T.OctahedronGeometry(.8)),material('#a683ec',.2),0,3.3,0);
  // Buildings have distinct silhouettes, driven by their economic role.
  const structures=[];
  function createBuilding(spec){
    const g=new T.Group();g.position.set(spec.x,0,spec.z);g.userData={type:'building',...spec};scene.add(g);picks.push(g);structures.push(g);
    const camp=CAMPS[spec.civ],accent=camp.color;
    box(g,0,.15,0,6.2,.3,5.7,'#b8b7a7');
    if(spec.kind==='food'){
      box(g,0,.65,0,5.5,1,4.7,'#7d9481');
      for(let i=-2;i<=2;i++){box(g,i,1.7,-2.25,.12,2.5,.15,'#d2d0bb');box(g,i,1.7,2.25,.12,2.5,.15,'#d2d0bb');}
      box(g,0,2.9,0,5.8,.15,4.9,'#c1cebb');
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
        box(g,i*1.5,1.25,j*1.4,1.1,.35,1,'#695d54');add(g,geo(new T.IcosahedronGeometry(.4,0)),material('#75976a'),i*1.5,1.7,j*1.4);
      }
      box(g,-2.5,3.2,0,.18,.6,4.5,accent);
    }else if(spec.kind==='wood'){
      box(g,0,1.4,-1,4.8,2.5,2.3,'#9c866e');box(g,0,2.9,-.2,5.6,.22,4.3,'#666d78');
      for(let i=0;i<5;i++){const log=add(g,geo(new T.CylinderGeometry(.3,.3,3,8)),material('#be9c75'),-1.2+(i%3)*.7,.7+Math.floor(i/3)*.55,1.4);log.rotation.z=Math.PI/2;}
      const saw=add(g,geo(new T.CylinderGeometry(.8,.8,.12,16)),material('#c3c5cb',.4),1.7,1.2,.2);saw.rotation.z=Math.PI/2;
      box(g,-2.4,1.5,1,.13,2.8,.13,accent);
    }else if(spec.kind==='stone'){
      cylinder(g,0,1.3,0,2,2.2,'#7d8290',6);cylinder(g,0,2.5,0,2.25,.2,'#b8b4c3',6);
      for(let i=0;i<3;i++){const crystal=add(g,geo(new T.OctahedronGeometry(.7)),material(accent,.2),-1+i,3.2+(i%2)*.5,0);crystal.scale.y=1.6;}
      box(g,0,.9,2,1.4,.6,1.3,'#52576a');box(g,0,1.2,2.7,1,.15,.05,'#d5c1eb');
    }else if(spec.kind==='home'){
      box(g,0,1.5,0,4.7,2.7,4.3,'#d6c9b6');box(g,0,3,0,5.2,.4,4.8,accent);
      box(g,0,1.25,2.18,.95,2.3,.12,'#696578');
      for(const x of [-1.6,1.6]){box(g,x,1.8,2.2,.9,.9,.1,'#737e89');box(g,x,1.8,2.27,.72,.68,.02,'#f4d7a6');}
      box(g,-1.7,3.6,-1,1.3,.8,1,'#c9bdae');
    }else{
      cylinder(g,0,.35,0,2,.4,'#c2baa9',12);for(const x of [-1.6,1.6])box(g,x,2,0,.12,3.2,.12,'#696579');
      box(g,0,3.6,0,4.3,.2,3,accent);box(g,0,1.1,0,3.5,.4,1.7,'#b2a090');
      for(let i=0;i<3;i++)box(g,i-1,1.5,.2,.55,.5,.55,['#9aa681','#bc9f7e','#9b98ab'][i]);
    }
    return g;
  }
  BUILDINGS.forEach(createBuilding);
  // Four radial avenues connect the campuses to the ledger instrument.
  for(const camp of CAMPS){
    const angle=Math.atan2(camp.x,camp.z),length=Math.hypot(camp.x,camp.z);
    const path=box(scene,camp.x/2,.03,camp.z/2,3,.06,length,'#bbb6a5');path.rotation.y=angle;
    cylinder(scene,camp.x,.02,camp.z,12,.08,'#a4ad99',32);
    for(const sign of [-1,1]){box(scene,camp.x+sign*11,1,camp.z,1,2,1,'#757a82');box(scene,camp.x+sign*11,2.1,camp.z,1.2,.22,1.2,camp.color);}
  }
  // Procedural original trees: cropped conical canopies, no external models.
  for(let i=0;i<38;i++){
    const a=i*2.399963,r=46+(i%4)*3,x=Math.sin(a)*r,z=Math.cos(a)*r;
    cylinder(scene,x,1.3,z,.24,2.6,'#8a7568',6);
    for(let tier=0;tier<3;tier++)add(scene,geo(new T.ConeGeometry(2.5-tier*.5,3,7)),material(i%4===0?'#9390b2':'#6a886f'),x,3+tier*1.2,z);
  }
  // 20 selectable residents. Walking is a visual illustration, not engine input.
  const residents=[];
  CAMPS.forEach(c=>{for(let i=0;i<5;i++){
    const person=new T.Group();person.userData={type:'resident',civ:c.id,id:i+1};scene.add(person);picks.push(person);residents.push(person);
    cylinder(person,0,.85,0,.24,.85,c.color,7);add(person,geo(new T.IcosahedronGeometry(.23,1)),material('#dfc6ad'),0,1.5,0);
    box(person,-.13,.2,0,.14,.5,.18,'#555368');box(person,.13,.2,0,.14,.5,.18,'#555368');
    box(person,0,1.7,-.02,.47,.12,.4,'#635e79');
  }});
  const packets=[];for(let i=0;i<24;i++){const packet=add(scene,geo(new T.OctahedronGeometry(.12)),material('#d5b9ff'),0,1,0);packet.visible=false;packets.push(packet);}
  let snapshot=null;
  function update(state,time){
    snapshot=state;gem.rotation.y=time*.3;
    residents.forEach((model,index)=>{
      const civ=Math.floor(index/5),r=state.civs[civ].residents[index%5],camp=CAMPS[civ];
      model.visible=r.alive;if(!r.alive)return;
      const resource={farmer:'food',woodcutter:'wood',miner:'stone'}[r.occupation];
      const destination=OFFSETS[resource],home=OFFSETS.home;
      const t=(Math.sin(time*.23+index*1.3)+1)/2;
      model.position.set(camp.x+home[0]+(destination[0]-home[0])*t,0,camp.z+home[1]+(destination[1]-home[1])*t+2+index%2);
      model.rotation.y=Math.atan2(destination[0]-home[0],destination[1]-home[1])+(Math.cos(time*.23+index*1.3)>0?0:Math.PI);
    });
    const trades=state.civs.flatMap(c=>c.events.filter(e=>e.kind==='trade').slice(0,6).map(e=>({c,e})));
    packets.forEach((p,i)=>{const trade=trades[i];p.visible=Boolean(trade);if(!trade)return;
      const camp=CAMPS[trade.c.id],offset=OFFSETS[trade.e.data.resource],t=(time*.2+i*.12)%1;
      p.position.set(camp.x+offset[0]*(1-t),1.7+Math.sin(t*Math.PI),camp.z+offset[1]*(1-t));
    });
    structures.forEach(g=>{if(['food','wood','stone'].includes(g.userData.kind)){
      const count=state.civs[g.userData.civ].holdings[g.userData.kind];g.scale.y=count===0?.8:1;
    }});
  }
  const ray=new T.Raycaster();ray.far=8;
  function pick(){scene.updateMatrixWorld(true);ray.setFromCamera(new T.Vector2(),camera);const hit=ray.intersectObjects(picks,true)[0];
    if(!hit)return null;let object=hit.object;while(object&&!object.userData.type)object=object.parent;return object?.userData??null;
  }
  function dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());scene.clear();}
  return {scene,camera,update,pick,dispose,residents,structures,get snapshot(){return snapshot;}};
}

export function mountScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const world=createScene();
  const resize=()=>{const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);world.camera.aspect=width/height;world.camera.updateProjectionMatrix();};
  resize();window.addEventListener('resize',resize);
  return {...world,render(player,state,time){world.camera.position.set(player.x,1.85+player.height,player.z);world.camera.rotation.order='YXZ';world.camera.rotation.set(player.pitch,player.yaw,0);world.update(state,time);renderer.render(world.scene,world.camera);},
    dispose(){window.removeEventListener('resize',resize);world.dispose();renderer.dispose();}};
}
