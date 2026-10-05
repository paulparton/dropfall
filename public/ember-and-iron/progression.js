/* The Foundry: professions, room progression and branching upgrade registry. */
(function(root){
'use strict';
const branches={
 mine:{Extraction:[
 ['Hardened picks',1,5,{miningSpeed:.12},'Workers extract 12% faster per rank.'],
 ['Survey lamps',2,3,{manualYield:1},'Manual mining yields one more material per rank.'],
 ['Drill heads',4,5,{miningSpeed:.18},'Worker speed +18% per rank.'],
 ['Ore sorting',8,3,{miningYield:1},'Each worker load contains one extra material.'],
 ['Precision blasting',16,4,{miningSpeed:.25},'Extract 25% faster per rank.'],
 ['Resonant picks',32,3,{manualYield:2},'Manual yield +2 per rank.'],
 ['Deep core rigs',64,4,{miningYield:2},'Worker loads +2 per rank.'],
 ['Living mountain',128,5,{miningSpeed:.5},'Worker speed +50% per rank.']],
 Depths:[
 ['Iron seam',2,1,{seamIron:1},'Expose iron. Requires smith level 2.'],
 ['Gem pocket',4,1,{seamGem:1},'Expose gems for enchantments.'],
 ['Alloy workings',8,1,{seamSteel:1},'Process steel in the mine; requires a forge smelter.'],
 ['Mithril gallery',18,1,{seamMithril:1},'Expose mithril. Requires smith level 8.'],
 ['Starfall fissure',40,1,{seamStar:1},'Expose star ore. Requires smith level 12.'],
 ['Vein mapping',80,4,{miningSpeed:.3},'All seam extraction +30% speed per rank.'],
 ['Crystal lenses',150,3,{miningYield:2},'Worker loads +2 per rank.'],
 ['Heart of the mountain',300,5,{miningYield:3},'Worker loads +3 per rank.']],
 Logistics:[
 ['Ore bins',1,5,{binCapacity:15},'Each material bin gains 15 capacity.'],
 ['Crew quarters',2,4,{workerSlots:2},'Room for two additional workers per rank.'],
 ['Mine foreman',4,3,{miningSpeed:.15},'All workers are 15% faster per rank.'],
 ['Freight elevators',8,5,{binCapacity:30},'Each bin gains 30 capacity per rank.'],
 ['Shift rosters',16,3,{workerSlots:2},'Two additional worker slots per rank.'],
 ['Supply contracts',32,4,{materialDiscount:.04},'Purchased materials cost 4% less per rank.'],
 ['Underground silos',64,5,{binCapacity:75},'Each bin gains 75 capacity per rank.'],
 ['Industrial workforce',128,4,{workerSlots:3,miningSpeed:.1},'Three worker slots and 10% extraction speed.']]},
 forge:{Machinery:[
 ['Grinding stone',35,1,{grinder:1,quality:4},'Install a grinding stone. All crafts +4 quality.'],
 ['Smelting furnace',75,1,{smelter:1,metallurgy:1},'Install the smelter; enables iron-tier machinery.'],
 ['Tempering station',170,1,{tempering:1,metallurgy:1,quality:5},'Unlock steel-tier machinery and +5 quality.'],
 ['Runic workbench',400,1,{runeBench:1,metallurgy:1,enchant:.15},'Unlock mithril-tier machinery and enchanting.'],
 ['Starforge crucible',950,1,{starforge:1,metallurgy:1,quality:6},'Unlock starforged-tier machinery; +6 quality.'],
 ['Calibrated tools',2200,4,{quality:3},'All crafts +3 quality per rank.'],
 ['Masterwork dies',5000,3,{heavyQuality:5},'Heavy crafts +5 quality per rank.'],
 ['Everlasting flame',12000,5,{speed:.2,quality:2},'Craft speed +20% and quality +2 per rank.']],
 Mastery:[
 ['Measured strikes',40,5,{quality:2},'All crafts +2 quality per rank.'],
 ['Pattern library',85,4,{proficiencyXp:.12},'Class proficiency XP +12% per rank.'],
 ['Balanced edges',190,4,{affixChance:.035},'Special affix chance +3.5% per rank.'],
 ['Breakthrough craft',440,4,{qualityCap:15},'Raise the quality ceiling by 15 per rank beyond 100.'],
 ['Elemental etching',1000,4,{enchant:.12},'Enchantments are 12% stronger per rank.'],
 ['Master schematics',2400,3,{proficiencyGateReduction:2},'Recipe proficiency requirements fall by 2 per rank.'],
 ['Perfect harmonics',5600,4,{quality:4,affixChance:.02},'Quality +4 and affix chance +2% per rank.'],
 ['Legendary finish',13000,4,{qualityCap:10,quality:5},'Quality ceiling +10 and quality +5 per rank.']],
 Workflow:[
 ['Tool racks',30,4,{queue:2},'Queue two additional crafts per rank.'],
 ['Power bellows',70,5,{speed:.12},'Crafting speed +12% per rank.'],
 ['Apprentice bench',160,2,{lanes:1},'Run one additional craft simultaneously.'],
 ['Fitted handles',380,4,{speed:.15},'Crafting speed +15% per rank.'],
 ['Production ledgers',900,4,{queue:4},'Queue four additional crafts per rank.'],
 ['Artisan benches',2100,2,{lanes:1},'Run one additional craft simultaneously.'],
 ['Clockwork hammers',4900,5,{speed:.25},'Crafting speed +25% per rank.'],
 ['Grand atelier',11500,3,{lanes:1,queue:4,automation:1},'One active bench and four queue slots per rank; unlock production rules.']]},
 shop:{Commerce:[
 ['Honest signage',2,5,{sale:.035},'Customer prices +3.5% per rank.'],
 ['Trusted supplier',4,4,{budget:.08},'Customer budgets +8% per rank.'],
 ['Guild introductions',8,3,{relationship:1},'Every sale earns one extra relationship per rank.'],
 ['Premium showcases',16,4,{sale:.05},'Customer prices +5% per rank.'],
 ['Patron accounts',32,4,{budget:.12},'Customer budgets +12% per rank.'],
 ['Renowned commissions',64,4,{commissionPay:.12},'Commission payments +12% per rank.'],
 ['Trade ambassador',128,3,{reputationBonus:1},'Successful quests earn one extra reputation per rank.'],
 ['Royal warrant',256,4,{sale:.08,budget:.08},'Prices and customer budgets +8% per rank.']],
 Warehouse:[
 ['Display plinths',2,5,{display:2},'Two more displayed items per rank.'],
 ['Stockroom shelves',4,5,{capacity:12},'Warehouse capacity +12 per rank.'],
 ['Porter service',8,1,{capacity:8,display:2},'Add 8 warehouse spaces and 2 display slots. Basic restocking is always automatic.'],
 ['Salvage bench',16,1,{autoScrap:1},'Unlock optional scrapping below your chosen quality threshold.'],
 ['Secure vault',32,4,{capacity:24},'Warehouse capacity +24 per rank.'],
 ['Gallery wing',64,4,{display:4},'Four more displayed items per rank.'],
 ['Distribution depot',128,4,{capacity:40},'Warehouse capacity +40 per rank.'],
 ['Grand exhibition',256,4,{display:6,capacity:20},'Six display slots and 20 warehouse slots per rank.']],
 Relations:[
 ['Welcoming hearth',2,4,{patience:5},'Customers browse five seconds longer per rank.'],
 ['Personal service',4,3,{relationship:1},'Every sale earns one extra relationship per rank.'],
 ['Quest sponsorship',8,3,{reputationBonus:1},'Every victory grants one extra reputation per rank.'],
 ['Returning patrons',16,4,{budget:.1},'Customer budgets +10% per rank.'],
 ['Commission desk',32,4,{commissionPay:.15},'Commission payments +15% per rank.'],
 ['Guild festival',64,4,{sale:.06},'Customer prices +6% per rank.'],
 ['Honoured allies',128,4,{patience:8,relationship:1},'Browse time +8 seconds and relationship +1 per rank.'],
 ['House of legends',256,4,{reputationBonus:2,budget:.1},'Victory reputation +2 and customer budgets +10% per rank.']]},
 adventurers:{Training:[
 ['Training yard',2,5,{heroHp:.06},'Hero health +6% per rank.'],
 ['Sparring partners',4,4,{heroAttack:.04},'Hero attack +4% per rank.'],
 ['Shield drills',8,4,{heroArmor:.5},'Hero armour +0.5 per rank.'],
 ['Combat reflexes',16,4,{heroSpeed:.04},'Hero attack speed +4% per rank.'],
 ['Veteran conditioning',32,4,{heroHp:.1},'Hero health +10% per rank.'],
 ['Master instructors',64,4,{heroAttack:.07},'Hero attack +7% per rank.'],
 ['Tactical movement',128,4,{heroSpeed:.07},'Hero attack speed +7% per rank.'],
 ['Champions of the forge',256,4,{heroHp:.12,heroAttack:.08},'Hero health +12% and attack +8% per rank.']],
 Expeditions:[
 ['Recovery beds',2,5,{recovery:.1},'Heroes recover 10% faster per rank.'],
 ['Trail maps',4,4,{travel:.1},'Quest journeys are 10% faster per rank.'],
 ['Companion charter',8,1,{partySize:1,partyPolicy:1},'Heroes may form pairs; unlock cautious and bold policies.'],
 ['Field infirmary',16,4,{recovery:.15},'Recovery speed +15% per rank.'],
 ['Warband charter',32,1,{partySize:1},'Heroes may form parties of three.'],
 ['Expedition berths',64,3,{expeditions:1},'One additional simultaneous expedition per rank.'],
 ['Waystone network',128,4,{travel:.15},'Quest journey speed +15% per rank.'],
 ['Sanctuary',256,4,{recovery:.25,heroHp:.05},'Recovery speed +25% and health +5% per rank.']],
 Recruitment:[
 ['The Breaker',4,1,{heroBren:1},'Recruit Bren. Unlock axes and maces.'],
 ['The Guardian',8,1,{heroThane:1},'Recruit Thane. Unlock polearms.'],
 ['The Arcanist',16,1,{heroSable:1},'Recruit Sable. Unlock arcane foci and charms.'],
 ['Another blade',32,1,{heroLyra:1},'Recruit Lyra, a second duelist.'],
 ['Frontier scouts',64,1,{heroOrrin:1},'Recruit Orrin, a second ranger.'],
 ['Stalwart company',128,1,{heroIda:1,heroHark:1},'Recruit Ida and Hark.'],
 ['Arcane fellowship',256,1,{heroVesper:1},'Recruit Vesper, a second mage.'],
 ['The final sentinel',512,1,{heroAela:1},'Recruit Aela, a second guardian.']]}
};
const nodes={};for(const [section,bs]of Object.entries(branches))for(const [branch,rows]of Object.entries(bs))rows.forEach((row,index)=>{const id=section+'_'+branch.toLowerCase()+'_'+index;nodes[id]={id,section,branch,depth:index,name:row[0],cost:row[1],maxRank:row[2],effects:row[3],description:row[4],parents:index?[section+'_'+branch.toLowerCase()+'_'+(index-1)]:[],scale:1.9};});
nodes.mine_depths_0.level=2;nodes.mine_depths_2.requiresEffect='smelter';nodes.mine_depths_3.level=8;nodes.mine_depths_4.level=12;
const professions={
 weaponsmith:{name:'Bladesmith',title:'Make every strike count',description:'Weapon quality +6. Crafting speed +10%.',effects:{weaponQuality:6,speed:.1}},
 armorer:{name:'Armourer',title:'Bring them home alive',description:'Heavy item quality +8. Hero health +8%.',effects:{heavyQuality:8,heroHp:.08}},
 artificer:{name:'Artificer',title:'Find the extraordinary',description:'Proficiency XP +20%. Enchantments +20%. Affix chance +5%.',effects:{proficiencyXp:.2,enchant:.2,affixChance:.05}},
 prospector:{name:'Prospector',title:'Build from the mountain',description:'Workers mine 25% faster. Manual mining yields +1.',effects:{miningSpeed:.25,manualYield:1}},
 merchant:{name:'Guild factor',title:'A name worth returning to',description:'Sale prices +12%. Customer budgets +20%. Each sale earns +1 relationship.',effects:{sale:.12,budget:.2,relationship:1}}
};
const seams=[['fuel','Coal face',null,40],['bronze','Bronze workings',null,45],['iron','Iron seam','seamIron',65],['gem','Gem pocket','seamGem',100],['steel','Alloy workings','seamSteel',95],['mithril','Mithril gallery','seamMithril',135],['starforged','Starfall fissure','seamStar',180]].map(([id,name,effect,seconds])=>({id,name,effect,seconds}));
const access={vanguard:['swords','armor','shields'],duelist:['daggers','swords','rings'],ranger:['bows','daggers','tools'],breaker:['axes','maces','armor'],guardian:['polearms','armor','shields'],mage:['foci','charms','rings']};
let recruitmentNumber=0;for(const n of Object.values(nodes).filter(n=>n.branch==='Recruitment')){const count=Object.keys(n.effects).filter(k=>/^hero[A-Z]/.test(k)).length;if(count){n.name='Company charter '+(++recruitmentNumber);n.description='Open '+count+' recruitment slot'+(count>1?'s':'')+'. Choose each hero name and class in Adventurers.';}}
const api={nodes,professions,seams,access,startingHeroes:['mara','renn','wren'],currencies:{mine:'Prospecting',forge:'Gold',shop:'Influence',adventurers:'Merits'},apply(data){const campaign=typeof module==='object'&&module.exports?require('./campaign.js'):root.EICampaign;const company=typeof module==='object'&&module.exports?require('./company.js'):root.EICompany;Object.assign(access,company.access);if(data.overhaul)return company.apply(campaign.apply(data));data.overhaul=true;for(const talent of Object.values(data.talents))talent.cost=Math.ceil(2*Math.pow(1.75,talent.depth-1));data.staff.quartermaster.effects={binCapacity:3,materialDiscount:.02};data.staff.quartermaster.description='Each rank adds 3 capacity to every material bin and a 2% procurement discount.';data.upgrades.material_warehouse.effects={binCapacity:4};data.upgrades.material_warehouse.description='Each rank adds 4 capacity to every material bin.';data.materials.fuel.name='Coal';for(const r of Object.values(data.recipes)){r.baseSeconds=Math.round(r.baseSeconds*2.2);r.smithXp=Math.max(8,Math.round((r.smithXp||12*r.tier)*.8));}return company.apply(campaign.apply(data));}};
if(typeof module==='object'&&module.exports)module.exports=api;else root.EIProgression=api;
})(typeof globalThis!=='undefined'?globalThis:this);
