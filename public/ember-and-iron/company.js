/* Company chapter: compatible content expansion and equipment roles. */
(function(root){
'use strict';
const copy=o=>JSON.parse(JSON.stringify(o));
const access={
 vanguard:['swords','armor','shields','rings','charms','tools'],
 duelist:['daggers','swords','leather_armor','rings','talismans','instruments'],
 ranger:['bows','daggers','leather_armor','rings','charms','tools'],
 breaker:['axes','maces','armor','shields','talismans','tools'],
 guardian:['polearms','swords','armor','shields','talismans','tools'],
 mage:['foci','cloth_armor','offhands','rings','charms','instruments']
};
const names={daggers:['Bollock Knife','Rondel Dagger','Misericorde'],swords:['Short Sword','Arming Sword','Greatsword'],axes:['Hand Axe','Bearded Axe','Dane Axe'],maces:['Cudgel','Flanged Mace','War Hammer'],polearms:['Spear','Billhook','Halberd'],bows:['Hunting Bow','Longbow','War Bow'],foci:['Wand','Sceptre','Runic Staff'],armor:['Mail Coif & Vest','Mail Haubergeon','Mail Hauberk'],leather_armor:['Leather Jerkin','Hardened Leather Jack','Lamellar Harness'],cloth_armor:['Linen Tunic','Padded Gambeson','Runesilk Robe'],shields:['Buckler','Kite Shield','Pavise'],offhands:['Prayer Book','Grimoire','Illuminated Codex'],rings:['Copper Band','Signet Ring','Sovereign Ring'],charms:['Pilgrim Token','Reliquary','Saints Reliquary'],talismans:['Knotted Cord','Ward Talisman','Runic Torc'],tools:['Trail Pouch','Delver Kit','Siege Kit'],instruments:['Reed Pipe','Herald Horn','Silver War Horn']};
function applySupplies(d){
 if(d.supplyVersion)return d;
 d.supplyVersion=1;
 d.materials.alchemical_oil={id:'alchemical_oil',name:'Alchemical Oil',price:8,tier:3,icon:'◈',color:'#dfb853',purchasedSupply:true,salvageable:false,description:'Purchased finishing oil for tier 3–5 equipment. Cannot be mined.'};
 d.purchasedSupplies=['leather','wood','alchemical_oil'];
 d.purchasedSupplies.forEach(id=>d.materials[id].purchasedSupply=true);
 // Keep exact pre-update escrow for unfinished orders imported from v1.3.
 d.preSupplyRecipeInputs=Object.fromEntries(Object.values(d.recipes).map(r=>[r.id,copy(r.inputs)]));
 for(const r of Object.values(d.recipes))if(r.tier>=3){const quantity=r.tier-2+(r.variant===2?1:0);r.inputs.alchemical_oil=quantity;r.basePrice+=Math.ceil(quantity*d.materials.alchemical_oil.price*.8);}
 return d;
}
function apply(d){if(d.companyVersion)return applySupplies(d);d.companyVersion=3;d.legacyRecipeInputs=Object.fromEntries(Object.values(d.recipes).map(r=>[r.id,copy(r.inputs)]));
 const additions=[['cloth_armor','Cloth armour','armor','knowledge',false,{health:9,armor:.65,attack:.5}],['leather_armor','Leather armour','armor','precision',false,{health:10,armor:1.1,evasion:.025}],['offhands','Books & relics','charms','knowledge',false,{attack:1.5,health:3,armor:.2}],['instruments','Instruments','tools','charisma',false,{attack:.5,health:5,crit:.015}],['talismans','Talismans','charms','knowledge',false,{health:6,armor:.3,block:.025}]];
 for(const[id,name,source,stat,heavy,combat]of additions){d.classes[id]={...copy(d.classes[source]),id,name,stat,heavy,slot:id==='offhands'?'offhand':d.classes[source].slot,combat};for(const base of Object.values(d.recipes).filter(r=>r.classId===source)){const r=copy(base);r.id=r.id.replace('_'+source,'_'+id);r.classId=id;r.slot=d.classes[id].slot;r.heavy=heavy;r.twoHanded=false;r.requires.stat=stat;r.familyId=r.familyId.replace('_'+source,'_'+id);const scale=[1,1.5,2.25,3.4,5.2][r.tier-1];r.combat={attack:0,health:0,armor:0,interval:2,crit:0,evasion:0,block:0,armorPen:0,resistances:{},...combat};for(const k of ['attack','health','armor'])r.combat[k]*=scale;d.recipes[r.id]=r;}}
 d.classes.armor.name='Mail armour';
 const originals=copy(d.recipes);
 for(const r of Object.values(d.recipes)){const base=copy(originals[r.familyId]),v=r.variant||0,t=r.tier,m=r.materialId;const metalName=t===5?'Starforged':d.materials[m].name;r.name=(['bows','cloth_armor','leather_armor'].includes(r.classId)?names[r.classId][v]+' · '+metalName+' fittings':metalName+' '+names[r.classId][v]);r.pattern=['training','standard','prestige'][v];r.group=r.slot==='weapon'?'weapons':r.slot==='body'?'armour':'other';d.classes[r.classId].group=r.group;
  r.requires.proficiency=v===2?[22,37,55,80,97][t-1]:base.requires.proficiency+(v===1?4:0);r.requires.statValue=v===2?[18,30,46,66,90][t-1]:base.requires.statValue+(v===1?1:0);
  r.inputs=copy(base.inputs);if(v===0)r.inputs[m]=Math.max(1,Math.floor(r.inputs[m]*.65));if(v===2){r.inputs[m]+=2;r.inputs.fuel+=1;}
  r.basePrice=Math.max(4,Math.round(base.basePrice*[.7,1.22,2.7][v]));r.baseSeconds=Math.round(base.baseSeconds*[.7,1,1.8][v]);r.smithXp=Math.max(5,Math.round(base.smithXp*[.7,1,1.5][v]));r.classXp=Math.max(4,Math.round(base.classXp*[.8,1,1.4][v]));r.difficulty=base.difficulty;r.qualityOffset=[-12,0,12][v];
  r.combat=copy(base.combat);for(const k of ['attack','health','armor','armorPen'])r.combat[k]=(r.combat[k]||0)*[.7,1,1.95][v];if(v===2){if(r.slot==='weapon'){r.combat.interval*=1.1;r.combat.armorPen=(r.combat.armorPen||0)+.6*t;}else r.combat.block=(r.combat.block||0)+.02;}
  r.twoHanded=r.classId==='foci'?v===2:r.twoHanded;
  r.description=['Training pattern: cheap inputs, faster practice, lower quality and combat strength.','Standard pattern: dependable quality and balanced combat strength.','Prestige pattern: exceptional strength and quality; demanding attributes unlock it after the next material tier.'][v];
 }
 for(const[id,a]of Object.entries(d.archetypes)){a.preferences=[...access[id]];a.line=['ranger','mage'].includes(id)?'back':'front';}
 const colors={fuel:'#555b68',bronze:'#ce8d51',iron:'#abb9cd',steel:'#b9d9e8',gem:'#ad88ef',mithril:'#60d4c8',starforged:'#efd376',wood:'#b58b5b',leather:'#c17f5a'};for(const[id,m]of Object.entries(d.materials))m.color=colors[id]||'#c58edd';
 // Every material tier has three ordinary quest levels followed by its boss.
 const additionsByTier=[
  ['rat_nest',[['mill_cellar','Mill Cellar',['Cellar Vermin'],'Clear the mill before the smugglers can use it as a storehouse.'],['smugglers_road','Smugglers Road',['Smuggler Scout'],'Break the road patrol and find the entrance to the smuggler cache.']]],
  ['quarry_road',[['abandoned_pit','Abandoned Pit',['Pit Marauder'],'Recover the abandoned diggings from an entrenched raider.'],['sentinel_approach','Sentinel Approach',['Stonebound Sentry'],'Clear the stonebound sentries guarding the quarry heart.']]],
  ['frost_pass',[['whitewood_trail','Whitewood Trail',['Whitewood Wolf','Rime Hunter'],'Follow the frozen trail through wolves and patient hunters.'],['glacier_gate','Glacier Gate',['Glacier Watcher','Rime Castellan'],'Break the outer watch before challenging the Frost Regent.']]],
  ['fallen_observatory',[['astral_vault','Astral Vault',['Vault Construct','Astral Echo'],'Explore the sealed vault below the fallen observatory.'],['sovereign_stair','Sovereign Stair',['Void Sentinel','Rift Herald'],'Silence the final sentries on the road to the Void Sovereign.']]]
 ];
 for(const [source,levels] of additionsByTier)levels.forEach(([id,name,enemies,description],index)=>{const q=copy(d.quests[source]),step=index+1;q.id=id;q.name=name;q.description=description;q.choices=[];q.requires={};q.enemies.forEach((e,i)=>{e.id=id+'_'+i;e.name=enemies[i];e.health=Math.round(e.health*[1.12,1.27][index]);e.attack=Math.round(e.attack*[1.06,1.12][index]*100)/100;});q.baseSeconds=Math.round(q.baseSeconds*(1+.1*step));q.benchmark=Math.round(q.benchmark*(1+.1*step));q.rewards.gold=Math.max(q.rewards.gold+step,Math.round(q.rewards.gold*(1+.15*step)));q.rewards.heroXp+=step;d.quests[id]=q;});
 d.questTiers=[
  ['rat_nest','mill_cellar','smugglers_road','smuggler_cache'],
  ['quarry_road','abandoned_pit','sentinel_approach','stone_sentinel'],
  ['ash_courtyard','ember_shrine','thorn_pass','wildwood_heart'],
  ['frost_pass','whitewood_trail','glacier_gate','frost_citadel'],
  ['fallen_observatory','astral_vault','sovereign_stair','void_sovereign']
 ];
 d.questTiers.forEach((chain,tierIndex)=>chain.forEach((id,index)=>{const q=d.quests[id],previous=chain[index-1];q.questLevel=q.manualBoss?null:index+1;q.requires.questWins={};if(tierIndex)q.requires.questWins[d.tierBosses[tierIndex-1]]=1;if(previous&&!q.manualBoss)q.requires.questWins[previous]=5;if(q.manualBoss)for(const approach of chain.slice(0,3))q.requires.questWins[approach]=5;q.approachId=previous||d.tierBosses[tierIndex-1]||null;q.rounds=q.manualBoss?3:2;q.baseSeconds=Math.round(q.baseSeconds*.7);q.masteryTarget=q.manualBoss?1:5;q.enemies.forEach((e,n)=>{e.line=n===0?'front':'back';});}));
 d.quests=Object.fromEntries(d.questTiers.flat().map(id=>[id,d.quests[id]]));d.questProgressionVersion=2;
 for(const q of Object.values(d.quests))for(const c of q.choices||[])if(c.id==='recover_starforge')c.unlockRecipes=Object.values(d.recipes).filter(r=>r.tier===5).map(r=>r.id);
 const furnishing=[['hearth_banner',260,{arrival:.15,budget:.08},'Customer cadence +15%; budgets +8%.'],['warming_brazier',420,{speed:.12,staffRecovery:.2},'Craft speed +12%; resting staff recover 20% faster.'],['makers_plaque',700,{quality:5,proficiencyXp:.08},'Craft quality +5; proficiency XP +8%.'],['guild_trophy',1100,{budget:.18,relationship:1},'Customer budgets +18%; useful sales earn +1 relationship.'],['rest_chamber',1700,{staffRecovery:.5},'A quiet chamber: resting staff recover 50% faster.'],['guild_library',2600,{proficiencyXp:.2,enchant:.12},'Proficiency XP +20%; enchantments +12%.']];
 for(const[id,cost,effects,description]of furnishing)d.decor[id]={id,name:d.decor[id]?.name||({rest_chamber:'Staff Rest Chamber',guild_library:'Guild Library'}[id]),cost,maxLevel:5,costScale:2.4,effects,description:description+' Per level; survives Legacy.'};
 // Capacity is a physical purchase, never removed when an employee takes leave.
 d.staff.quartermaster.effects={binCapacity:3,materialDiscount:.02};d.staff.quartermaster.description='Each experience level adds 3 permanent bin space and up to 2% supply discount while rested.';
 return applySupplies(d);
}
const api={apply,access};if(typeof module==='object'&&module.exports)module.exports=api;else root.EICompany=api;
})(globalThis);
