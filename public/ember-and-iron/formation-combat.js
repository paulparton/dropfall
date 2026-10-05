/* Seeded rounds with strict front-line protection, shared by previews and replays. */
(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),rngFor=seed=>{let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};};
function simulate(engine,quest,heroes,seed){
 const rng=rngFor(seed),party=heroes.map(h=>({...engine._heroStats(h),line:engine.data.archetypes[h.archetypeId].line||'front',hp:0,next:0}));
 const synergy=party.length>1&&new Set(party.map(h=>h.role)).size===party.length?1+(engine._effects().partySynergy||.1):1;
 party.forEach(h=>{h.attack*=synergy;h.hp=h.health;h.next=h.interval*1000;});
 const target=quest.masteryTarget||5,mastery=Math.min(target,engine.state.questWins[quest.id]||0)/target,pressure=quest.manualBoss?1:1+.35*mastery;
 const rounds=quest.rounds||2,waves=[];
 for(let round=1;round<=rounds;round++){const final=round===rounds,scale=final?1:quest.manualBoss?.18:.38;
  const wave=quest.enemies.map((e,i)=>({...clone(e),id:e.id+'-r'+round,line:e.line||'front',name:final?e.name:(quest.manualBoss?'Guard of ':'Patrol: ')+e.name,health:Math.max(4,e.health*scale*pressure),attack:e.attack*(final?1:quest.manualBoss?.55:.7)*(quest.manualBoss?1:1+.2*mastery),next:0,phase:false}));
  if(wave.length===1&&!final){const e=wave[0];wave.push({...clone(e),id:e.id+'-support',name:'Rear support',line:'back',health:e.health*.6,attack:e.attack*.5,interval:3.2,phaseAt:null});}
  wave.forEach(e=>{e.hp=e.health;e.interval=e.interval||2.5;});waves.push(wave);
 }
 let enemies=waves[0],at=0,attacks=0,round=1;enemies.forEach(e=>e.next=e.interval*1000);
 const initialHeroes=clone(party),initialEnemies=clone(enemies),events=[];
 const snap=()=>({round,rounds,heroes:party.map(h=>({id:h.id,name:h.name,line:h.line,hp:Math.max(0,h.hp),maxHp:h.health})),enemies:enemies.map(e=>({id:e.id,name:e.name,line:e.line,hp:Math.max(0,e.hp),maxHp:e.health}))});
 const push=e=>{if(events.length<790)events.push({...e,...snap()});};push({at:0,type:'round',text:'Round 1 of '+rounds+'. Break the front line to reach the rear.'});
 while(party.some(h=>h.hp>0)&&attacks++<1800&&at<240000){
  if(enemies.every(e=>e.hp<=0)){if(round===rounds)break;round++;at+=3000;party.filter(h=>h.hp>0).forEach(h=>{h.hp=Math.min(h.health,h.hp+h.health*.12);h.next=at+h.interval*1000;});enemies=waves[round-1];enemies.forEach(e=>e.next=at+e.interval*1000);push({at,type:'round',text:'Round '+round+' of '+rounds+'. Survivors recover 12% health; fallen allies remain out.'});continue;}
  const turns=[...party.filter(h=>h.hp>0).map(h=>({unit:h,hero:true})),...enemies.filter(e=>e.hp>0).map(unit=>({unit,hero:false}))].sort((a,b)=>a.unit.next-b.unit.next||Number(b.hero)-Number(a.hero)||a.unit.id.localeCompare(b.unit.id));
  const {unit:actor,hero}=turns[0];at=actor.next;if(at>240000)break;
  const opposition=(hero?enemies:party).filter(u=>u.hp>0),front=opposition.filter(u=>u.line==='front'),targets=front.length?front:opposition,target=targets[Math.floor(rng()*targets.length)];
  const dodged=rng()<(target.evasion||0),critical=rng()<(actor.crit||0),blocked=rng()<(target.block||0),armor=Math.max(0,(target.armor||0)-(actor.armorPen||0));
  const protection=hero?1:1-Math.max(0,...party.filter(h=>h.hp>0&&h.guardian).map(h=>h.protection||.08));
  const raw=(actor.attack||1)*(.9+rng()*.2)*(critical?1.5:1)*(actor.phase?1+(actor.phaseAttack||.25):1);
  const damage=dodged?0:Math.max(1,(raw-armor)*(1-(target.resistances?.[actor.damageType||'physical']||0))*(blocked?.5:1)*protection);
  target.hp=Math.max(0,target.hp-damage);if(hero&&actor.aoe)targets.filter(t=>t!==target).forEach(t=>{t.hp=Math.max(0,t.hp-damage*actor.aoe);});
  push({at,type:'attack',actorId:actor.id,targetId:target.id,targetLine:target.line,damage,critical,blocked,dodged,text:actor.name+(dodged?' misses ':' strikes ')+target.name+(dodged?'.':' for '+Math.round(damage)+'.')});
  for(const e of enemies)if(e.hp>0&&!e.phase&&e.phaseAt&&e.hp<=e.health*e.phaseAt){e.phase=true;push({at,type:'phase',actorId:e.id,text:e.name+' enters '+(e.phaseName||'a furious phase')+'.'});}
  actor.next+=actor.interval*1000;
 }
 const victory=round===rounds&&enemies.every(e=>e.hp<=0)&&party.some(h=>h.hp>0);const outcome={at:Math.min(at,240000),type:'outcome',text:victory?'Victory. The company returns home.':'Retreat. Recover and strengthen the company.',...snap()};events.push(outcome);
 return{victory,events,duration:Math.max(1,Math.min(at,240000)),heroStats:initialHeroes,enemyStats:initialEnemies,survivors:party.filter(h=>h.hp>0).length,finalHeroes:snap().heroes,finalEnemies:snap().enemies,rounds,completedRounds:victory?round:round-1,formation:true};
}
const api={simulate};if(typeof module==='object'&&module.exports)module.exports=api;else root.EIFormation=api;
})(globalThis);
