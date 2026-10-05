/* Presentation-only room progression. Art never grants gameplay bonuses. */
(function(root){
'use strict';
const names={starter:{smith:"Maker's study",mine:'Shallow workings',forge:'Village forge',shop:'Village shop',adventurers:'Roadside company'},middle:{smith:"Craftsman's study",mine:'Iron workings',forge:'Established smithy',shop:'Village outfitter',adventurers:'Company lodge'},grand:{smith:"Master's study",mine:'Deep workings',forge:'Grand foundry',shop:'Guild emporium',adventurers:'Hall of heroes'}};
const labels={browsing:'Browsing the shop',ready:'Checking equipment',travelling:'Travelling out',fighting:'In battle',returning:'Returning home',recovering:'Recovering',idle:'At the inn',pending:'Unloading rewards',complete:'Home'};
const check=(label,current,required=1)=>({label,current,required,met:current>=required});
function progress(game,room){
 const s=game.state,e=game._effects(),d=game.derived();
 const middle={smith:[check('Smith level',s.player.level,8)],mine:[check('Iron seam unlocked',e.seamIron||0)],forge:[check('Smelting furnace installed',e.smelter||0)],shop:[check('Reputation',s.player.reputation,50),check('Display slots',d.displayCapacity,10)],adventurers:[check('Quest victories',s.stats.questsWon,25),check('Recruited heroes',s.adventurers.length,4)]};
 const grand={smith:[check('Smith level',s.player.level,25)],mine:[check('Starfall fissure unlocked',e.seamStar||0)],forge:[check('Starforge crucible installed',e.starforge||0),check('Quality ceiling',d.qualityCap,150)],shop:[check('Reputation',s.player.reputation,500),check('Display slots',d.displayCapacity,18)],adventurers:[check('Quest victories',s.stats.questsWon,200),check('Recruited heroes',s.adventurers.length,8)]};
 const midGates=[check('Tier 1 boss defeated this run',s.questWins.smuggler_cache||0),...(middle[room]||[])];
 const highGates=[...new Map([check('Legacy generation',s.player.legacy.generation,2),check('Tier 4 boss defeated this run',s.questWins.frost_citadel||0),...midGates,...(grand[room]||[])].map(g=>[g.label,g])).values()];
 return [{id:'starter',name:names.starter[room],gates:[],met:true},{id:'middle',name:names.middle[room],gates:midGates,met:s.started&&midGates.every(g=>g.met)},{id:'grand',name:names.grand[room],gates:highGates,met:s.started&&highGates.every(g=>g.met)}];
}
function legacyUnlocked(game){return game.state.player.legacy.generation>1||(game.state.questWins.void_sovereign||0)>0;}
function stage(game,room){if(room==='legacy')return 'grand';if(!game.state.started)return 'starter';return progress(game,room).filter(p=>p.met).at(-1).id;}
function activity(game,h){return game.heroActivity(h.id);}
const middleText={smith:'Smith level 8',mine:'Unlock the Iron seam',forge:'Install the Smelting furnace',shop:'50 reputation and 10 display slots',adventurers:'25 victories and 4 recruited heroes'};
const grandText={smith:'Smith level 25',mine:'Unlock the Starfall fissure',forge:'Install the Starforge crucible and reach a 150 quality ceiling',shop:'500 reputation and 18 display slots',adventurers:'200 victories and 8 recruited heroes'};
const api={stage,progress,legacyUnlocked,grandeur:(game,room)=>stage(game,room)==='grand',activity,labels,artKey(game,room){if(room==='legacy')return 'legacy';const s=stage(game,room);return room+(s==='grand'?'':'-'+s);},roomName(game,room){if(room==='legacy')return 'Hall of legacies';return names[stage(game,room)][room];},followRoom(game,id){const h=game.state.adventurers.find(h=>h.id===id);return h?activity(game,h).room:null;},requirement(room,level='grand'){return level==='middle'?'Defeat the tier 1 boss this run. '+middleText[room]+'.':'Generation 2 or later, tier 4 boss defeated this run, and all middle-stage requirements. '+grandText[room]+'.';}};
if(typeof module==='object'&&module.exports)module.exports=api;else root.EIRoomModel=api;
})(globalThis);