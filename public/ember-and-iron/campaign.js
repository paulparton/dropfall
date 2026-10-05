/* Campaign content and stable quality standards for the 200-quality ceiling. */
(function(root){
'use strict';
const bosses=['smuggler_cache','stone_sentinel','wildwood_heart','frost_citadel','void_sovereign'];
const qualityThresholds={fine:45,superior:80,masterwork:115,epic:150,legendary:180};
function qualityName(q){return Object.entries(qualityThresholds).reverse().find(([,min])=>q>=min)?.[0]||'common';}
const patterns={daggers:['Baselard','Quillon Dagger'],swords:['Falchion','Longsword'],axes:['Hand Axe','Bearded Axe'],maces:['Flanged Mace','War Hammer'],polearms:['Spear','Glaive'],bows:['Shortbow','War Bow'],foci:['Channeling Wand','Runic Staff'],armor:['Jack of Plates','Brigandine'],shields:['Round Shield','Kite Shield'],rings:['Duelist Ring','Ward Ring'],charms:['Scout Talisman','Guardian Talisman'],tools:['Scout Kit','Siege Kit']};
function apply(data){if(data.campaignVersion)return data;data.campaignVersion=2;data.qualityThresholds={...qualityThresholds};data.tierBosses=[...bosses];
 for(const recipe of Object.values(data.recipes)){recipe.variant=0;recipe.familyId=recipe.id;const bases={daggers:'Rondel Dagger',swords:'Arming Sword',axes:'Hatchet',maces:'Pernach',polearms:'Billhook',bows:'Longbow',foci:'Sceptre',armor:'Lamellar Cuirass',shields:'Buckler',rings:'Signet Ring',charms:'Reliquary',tools:'Delver Kit'};recipe.name=(recipe.tier===5?'Starforged':data.materials[recipe.materialId].name)+' '+bases[recipe.classId];for(let n=1;n<=2;n++){const r=JSON.parse(JSON.stringify(recipe));r.id=recipe.id+'_v'+n;r.variant=n;r.name=(recipe.tier===5?'Starforged':data.materials[recipe.materialId].name)+' '+patterns[r.classId][n-1];if(r.name===recipe.name)r.name=(n===1?'Swift ':'Stout ')+r.name;r.requires.proficiency+=n*4;r.requires.statValue+=n;r.baseSeconds=Math.round(r.baseSeconds*(1+n*.17));r.basePrice=Math.ceil(r.basePrice*(1+n*.22));r.inputs[r.materialId]+=n===2?1:0;if(n===1){const support=r.inputs.leather?'leather':r.inputs.wood?'wood':'fuel';r.inputs[support]++;}r.difficulty+=n*2;r.classXp=Math.round(r.classXp*(1+n*.1));r.smithXp=Math.round(r.smithXp*(1+n*.1));if(r.slot==='weapon'){r.combat.attack*=n===1?.9:1.2;r.combat.interval*=n===1?.8:1.18;if(n===1)r.combat.crit=(r.combat.crit||0)+.025;else r.combat.armorPen=(r.combat.armorPen||0)+.35*r.tier;}else{if(n===1){r.combat.evasion=(r.combat.evasion||0)+.015;r.combat.health*=.9;}else{r.combat.health*=1.3;r.combat.armor=(r.combat.armor||0)+.3*r.tier;}}r.description=(n===1?'A lighter, quicker pattern.':'A sturdier pattern with greater material investment.')+' Shares '+data.classes[r.classId].name.toLowerCase()+' proficiency.';data.recipes[r.id]=r;}}
 for(const q of Object.values(data.quests)){const boss=bosses.includes(q.id);q.manualBoss=boss;q.baseSeconds=Math.round(q.baseSeconds*(boss?3:2.2));for(const enemy of q.enemies){enemy.health=Math.round(enemy.health*(boss?1.6:1.3));enemy.attack=Math.round(enemy.attack*(boss?1.25:1.15)*100)/100;}q.rewards.heroXp=Math.max(2,Math.round(q.rewards.heroXp*(boss?.7:.4)));q.rewards.gold=boss?[20,75,220,650,1800][q.tier-1]:Math.max(1,Math.round(q.rewards.gold*(1+(q.tier-1)*.12)));if(q.tier>1)q.requires.questWins={...(q.requires.questWins||{}),[bosses[q.tier-2]]:1};if(boss){q.minPartySize=[1,2,2,3,3][q.tier-1];const prior={smuggler_cache:['rat_nest',5],stone_sentinel:['quarry_road',4],wildwood_heart:['thorn_pass',3],frost_citadel:['frost_pass',3],void_sovereign:['fallen_observatory',3]}[q.id];q.requires.questWins[prior[0]]=prior[1];q.description+=' Tier '+q.tier+' boss: select and launch your own party. '+(q.tier<5?'Victory opens tier '+(q.tier+1)+' quests.':'Victory unlocks Legacy retirement.');}for(const choice of q.choices||[])if(choice.rewards?.heroXp)choice.rewards.heroXp=Math.max(1,Math.round(choice.rewards.heroXp*.4));}
 // Calibrated first equipment checkpoint for a player-selected trio.
 data.quests.smuggler_cache.enemies[0].health=220;data.quests.smuggler_cache.enemies[0].attack=20;data.quests.smuggler_cache.enemies[0].name='Smuggler Captain';
 const extraAffixes=[
 {id:'balanced',name:'Balanced',description:'+6% attack speed.',effects:{speed:.06},slots:['weapon']},
 {id:'tempered',name:'Tempered',description:'+15% item armour.',effects:{armor:.15},slots:['body','offhand'],minTier:2},
 {id:'resolute',name:'Resolute',description:'+14% item health.',effects:{health:.14},slots:['body','offhand','charm'],minTier:2},
 {id:'razored',name:'Razored',description:'+2 armour penetration.',effects:{armorPen:2},slots:['weapon'],minTier:3},
 {id:'stalwart',name:'Stalwart',description:'+5 percentage points block.',effects:{block:.05},slots:['offhand','body'],minTier:3},
 {id:'peerless',name:'Peerless',description:'+16% item attack and +3 percentage points critical chance.',effects:{attack:.16,crit:.03},slots:['weapon','ring'],minTier:4}
 ];for(const a of extraAffixes)data.affixes[a.id]=a;
 const suffixes={flame:'of Embers',frost_ward:'of the Hearth',ember_ward:'of Ash',vitality:'of Vigor',starlight:'of the Firmament'};
 for(const e of Object.values(data.enchantments))e.suffix=suffixes[e.id]||'of '+e.name;
 for(const e of [
 {id:'accuracy',name:'Hawkeye Inscription',suffix:'of the Hawk',description:'+5 percentage points critical chance, scaled by enchanting strength.',cost:18,inputs:{gem:2},requires:{upgrades:{enchanting_table:1},level:5},effects:{crit:.05},combat:{},slots:['weapon','ring','tool']},
 {id:'bulwark',name:'Bastion Inscription',suffix:'of the Bastion',description:'+12% item armour and +3 percentage points block, scaled by enchanting strength.',cost:22,inputs:{gem:2,iron:3},requires:{upgrades:{enchanting_table:1},level:6},effects:{armor:.12,block:.03},combat:{},slots:['body','offhand']},
 {id:'haste',name:'Zephyr Inscription',suffix:'of Alacrity',description:'+8% attack speed, scaled by enchanting strength.',cost:26,inputs:{gem:2,steel:2},requires:{upgrades:{enchanting_table:2},level:8},effects:{speed:.08},combat:{},slots:['weapon']}
 ])data.enchantments[e.id]=e;
 // The first pattern remains recognizable to old saves; all patterns use the same material discovery.
 for(const q of Object.values(data.quests))for(const choice of q.choices||[])if(choice.id==='recover_starforge')choice.unlockRecipes=Object.values(data.recipes).filter(r=>r.tier===5).map(r=>r.id);
 for(const c of Object.values(data.commissions||{}))if(c.id==='masterwork_order')c.minQuality=115;
 return data;
}
function itemName(item,data){const recipe=data.recipes[item.recipeId];return [data.affixes[item.affixId]?.name,recipe?.name||'Unknown item',data.enchantments[item.enchantmentId]?.suffix].filter(Boolean).join(' ');}
const api={apply,bosses,qualityThresholds,qualityName,itemName};if(typeof module==='object'&&module.exports)module.exports=api;else root.EICampaign=api;
})(globalThis);
