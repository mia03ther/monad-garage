// Original GENESIS adapter: presentation consumes the unchanged canonical engine.
import { CIV_NAMES, RESOURCES, createWorld, defaultConfig, Simulation,
  civSeed, playSummary, epochIdFor, survivalScore, epochDigest, deriveWinner,
  runEpoch, PLAY_MONEY_CURRENCY, PLAY_MONEY_LABEL } from '../engine.js';

export class StudioSession {
  constructor({seed=42,days=60,maxOrders=10}={}) {
    if(!Number.isInteger(seed)||seed<0||seed>1e9)throw new Error('种子须为 0–1000000000 的整数');
    if(!Number.isInteger(days)||days<30||days>90)throw new Error('纪元长度须为 30–90 天');
    if(!Number.isInteger(maxOrders)||maxOrders<0||maxOrders>10)throw new Error('每日订单上限须为 0–10');
    this.params={seed,days,civs:4,residentsPerCiv:5,taxBps:0,maxOrders};
    this.reset();
  }
  reset(){
    this.worlds=CIV_NAMES.map((_,i)=>{
      const config=defaultConfig();config.num_residents=5;config.max_orders_per_day=this.params.maxOrders;
      return createWorld(config,civSeed(this.params.seed,i));
    });
    this.simulations=this.worlds.map(w=>new Simulation(w,0));this.day=0;this.paused=true;this.observed=null;this.verification=null;
  }
  advance(count=1){
    if(!Number.isInteger(count)||count<0||count>90)throw new Error('推进步数须为 0–90 的整数');
    for(let i=0;i<count&&this.day<this.params.days;i++){
      this.simulations.forEach(sim=>sim.step());this.day++;
    }
    if(this.day===this.params.days)this.paused=true;
    return this.snapshot();
  }
  seek(day){
    if(!Number.isInteger(day)||day<0||day>this.params.days)throw new Error('回放日期超出本局范围');
    const choice=this.observed;this.reset();this.observed=choice;return this.advance(day);
  }
  predict(id){
    if(this.day!==0)throw new Error('开始后保留原预测；重开后可重新选择');
    if(!Number.isInteger(id)||id<0||id>3)throw new Error('未知文明');
    this.observed=id;
  }
  snapshot(){
    return {day:this.day,days:this.params.days,seed:this.params.seed,paused:this.paused,prediction:this.observed,
      civs:this.worlds.map((w,id)=>({id,name:CIV_NAMES[id],
        alive:w.residents.filter(r=>r.alive).length,
        health:w.residents.filter(r=>r.alive).reduce((s,r)=>s+r.health,0),
        holdings:Object.fromEntries(RESOURCES.map(resource=>[resource,w.residents.reduce((s,r)=>s+r.inventory[resource],0)])),
        prices:Object.fromEntries(RESOURCES.map(resource=>[resource,w.market[resource].price])),
        trades:w.stats.reduce((s,d)=>s+d.trade_count,0),
        produced:{...w.ledger.produced},consumed:{...w.ledger.consumed},
        residents:w.residents.map(r=>({...r,inventory:{...r.inventory},skills:{...r.skills}})),
        events:w.events.filter(e=>e.day===this.day).map(e=>structuredClone(e)),
      }))};
  }
  result(){
    if(this.day!==this.params.days)throw new Error('请先推进到纪元结束');
    const {seed,days,civs,residentsPerCiv,taxBps,maxOrders}=this.params;
    const results=this.worlds.map((w,id)=>{
      const summary=playSummary(w,0),alive=summary.final.population.alive;
      const wealth=summary.residents.reduce((s,r)=>s+r.wealth,0),health=summary.residents.reduce((s,r)=>s+r.health,0);
      return {id,name:CIV_NAMES[id],seed:civSeed(seed,id),digest:summary.digest,alive,wealth,health,
        score:survivalScore(alive,wealth,health),trades:summary.final.trades.trades,units:summary.final.trades.units,value:summary.final.trades.value};
    });
    const payload={epoch_id:epochIdFor(seed,days,civs,residentsPerCiv,taxBps,maxOrders),seed,days,num_civs:civs,
      residents_per_civ:residentsPerCiv,tax_rate_bps:taxBps,max_orders_per_day:maxOrders,civs:results};
    const digest=epochDigest(payload),winner=deriveWinner(results.map(c=>({civ:c.id,score:c.score})),digest);
    return {...payload,currency:PLAY_MONEY_CURRENCY,play_money_note:PLAY_MONEY_LABEL,digest,winner,winner_name:CIV_NAMES[winner]};
  }
  verify(){
    const observed=this.result(),reference=runEpoch(this.params);
    this.verification={passed:JSON.stringify(observed)===JSON.stringify(reference),observed:observed.digest,reference:reference.digest};
    return {...this.verification};
  }
  report(){return {format:'genesis.studio-report',version:1,mode:'browser-local-observation',
    prediction:this.observed,result:this.result(),verification:this.verification?{...this.verification}:null,
    chain:{submitted:false,note:'This epoch has not been submitted to a blockchain by this page.'}};}
}
