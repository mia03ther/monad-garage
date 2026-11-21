import {sha256Hex} from '../engine.js';

export const KIT=Object.freeze({
  core:{name:'创世核心',cost:[0,0,0],power:0},
  cable:{name:'能量桥',cost:[1,1,0],power:0},
  generator:{name:'脉冲风塔',cost:[3,5,2],power:0},
  home:{name:'居民舱',cost:[5,3,0],power:1},
  garden:{name:'生态温室',cost:[4,2,0],power:1},
  lumber:{name:'木工坊',cost:[3,4,0],power:1},
  quarry:{name:'晶石工坊',cost:[4,3,0],power:1},
  beacon:{name:'星际信标',cost:[5,6,2],power:2},
});
const valid=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&Math.abs(x)<=4&&Math.abs(z)<=4&&x*x+z*z<=21;
const key=(x,z)=>`${x},${z}`;
export function digest(text){return sha256Hex(new TextEncoder().encode(text));}
export class Island {
  constructor(){this.stock=[32,32,6];this.food=12;this.day=0;this.modules=[{kind:'core',x:0,z:0,rotation:0}];this.actions=[];}
  network(){
    const connected=new Set(['0,0']);let changed=true;
    while(changed){changed=false;for(const m of this.modules)if(!connected.has(key(m.x,m.z))&&[[1,0],[-1,0],[0,1],[0,-1]].some(([x,z])=>connected.has(key(m.x+x,m.z+z)))){connected.add(key(m.x,m.z));changed=true;}}
    const supply=1+this.modules.filter(m=>m.kind==='generator'&&connected.has(key(m.x,m.z))).length*6;
    let used=0;const active=new Set(['0,0']);
    // Grid order makes power allocation independent of rendering and array ordering.
    for(const m of [...this.modules].sort((a,b)=>a.x-b.x||a.z-b.z))if(connected.has(key(m.x,m.z))&&used+KIT[m.kind].power<=supply){active.add(key(m.x,m.z));used+=KIT[m.kind].power;}
    return {connected,active,supply,used};
  }
  apply(action){
    if(this.actions.length>=240)throw Error('本蓝图最多 240 个操作，请导出后新建');
    if(!action||typeof action!=='object')throw Error('无效操作');
    const {type}=action;
    if(type==='place'){
      const {kind,x,z,rotation}=action;
      if(!Object.hasOwn(KIT,kind)||kind==='core'||!valid(x,z)||!Number.isInteger(rotation)||rotation<0||rotation>3)throw Error('无效模块或坐标');
      if(this.modules.some(m=>m.x===x&&m.z===z))throw Error('这里已有建筑，先拆解再组装');
      const cost=KIT[kind].cost;if(cost.some((c,i)=>c>this.stock[i]))throw Error('材料不足：建工坊并推进一天可生产材料');
      this.stock=this.stock.map((n,i)=>n-cost[i]);this.modules.push({kind,x,z,rotation});
      this.actions.push({type,kind,x,z,rotation});
    }else if(type==='remove'){
      const {x,z}=action;if(!valid(x,z))throw Error('无效坐标');
      const i=this.modules.findIndex(m=>m.x===x&&m.z===z);if(i<0||this.modules[i].kind==='core')throw Error('核心不可拆解，空地无需拆解');
      const cost=KIT[this.modules[i].kind].cost;this.stock=this.stock.map((n,j)=>n+cost[j]);this.modules.splice(i,1);this.actions.push({type,x,z});
    }else if(type==='tick'){
      if(this.day>=60)throw Error('本次挑战已结束；可继续建造或新建浮岛');
      const {active}=this.network();let homes=0;
      for(const m of this.modules)if(active.has(key(m.x,m.z))){if(m.kind==='lumber')this.stock[0]+=3;if(m.kind==='quarry')this.stock[1]+=3;if(m.kind==='garden')this.food+=4;if(m.kind==='home')homes++;}
      this.food=Math.max(0,this.food-homes);this.day++;this.actions.push({type});
    }else throw Error('未知操作');
    return this;
  }
  status(){const n=this.network(),count=k=>this.modules.filter(m=>m.kind===k&&n.active.has(key(m.x,m.z))).length;
    return {...n,population:this.food>0?count('home')*2:0,won:count('home')>=2&&count('garden')>=1&&count('beacon')>=1&&this.food>0};}
  blueprint(){return JSON.stringify({format:'genesis.island',version:1,actions:this.actions});}
  report(){const blueprint=this.blueprint();return {blueprint,digest:digest(blueprint),day:this.day,stock:[...this.stock],food:this.food,modules:structuredClone(this.modules),population:this.status().population};}
  static restore(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>24000)throw Error('蓝图过大');
    const data=JSON.parse(text);if(data.format!=='genesis.island'||data.version!==1||!Array.isArray(data.actions)||data.actions.length>240)throw Error('不支持的蓝图格式');
    const island=new Island();for(const action of data.actions)island.apply(action);
    if(island.blueprint()!==text)throw Error('蓝图不是规范格式');return island;
  }
}
