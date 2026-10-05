/* Ember & Iron: shared, authored content registry. No timers or mutable save state. */
(function (root) {
  'use strict';
  const map = rows => Object.fromEntries(rows.map(row => [row.id, row]));
  const round = value => Math.round(value * 1000) / 1000;
  const materials = map([
    { id: 'bronze', name: 'Bronze', price: 2, tier: 1, icon: '◆', description: 'Basic metal stock, processed at your quarry.' },
    { id: 'iron', name: 'Iron', price: 5, tier: 2, icon: '◆', description: 'Stronger metal from the iron seam.' },
    { id: 'steel', name: 'Steel', price: 12, tier: 3, icon: '◆', description: 'An improved alloy made by quarry processing.' },
    { id: 'mithril', name: 'Mithril', price: 30, tier: 4, icon: '◆', description: 'Light, strong ore uncovered in deep workings.' },
    { id: 'starforged', name: 'Starforged Alloy', price: 70, tier: 5, icon: '✦', description: 'Legendary stock refined from fallen star ore.' },
    { id: 'wood', name: 'Wood', price: 1, tier: 1, icon: '▥', description: 'Handles, shafts and bow cores; bought or earned on expeditions.' },
    { id: 'leather', name: 'Leather', price: 1, tier: 1, icon: '▰', description: 'Grips, straps and protective layers.' },
    { id: 'fuel', name: 'Fuel', price: 1, tier: 1, icon: '♨', description: 'One unit is reserved for every craft.' },
    { id: 'gem', name: 'Gem', price: 8, tier: 2, icon: '◇', description: 'A catalyst for basic enchantments.' },
    { id: 'ember_shard', name: 'Ember Shard', price: null, tier: 3, icon: '✧', questOnly: true, description: 'A fire catalyst earned in the Ember region.' },
    { id: 'frost_crystal', name: 'Frost Crystal', price: null, tier: 4, icon: '❄', questOnly: true, description: 'An ice catalyst earned in the Frost region.' },
    { id: 'star_fragment', name: 'Star Fragment', price: null, tier: 5, icon: '✦', questOnly: true, description: 'A rare catalyst recovered at Starfall.' }
  ]);

  const classRows = [
    ['daggers', 'Daggers', 'weapon', 'precision', false, '†', 'fine_tools', { attack: 4.3, interval: 1.6, crit: 0.06 }],
    ['swords', 'Swords', 'weapon', 'strength', false, '⚔', 'heavy_forge', { attack: 5.5, interval: 2.0 }],
    ['axes', 'Axes', 'weapon', 'strength', true, '⌁', 'heavy_forge', { attack: 7.1, interval: 2.6 }],
    ['maces', 'Maces', 'weapon', 'strength', true, '♜', 'heavy_forge', { attack: 6.5, interval: 2.4, armorPen: 1 }],
    ['polearms', 'Polearms', 'weapon', 'strength', true, '↟', 'heavy_forge', { attack: 7.3, interval: 2.7, block: 0.03 }],
    ['bows', 'Bows', 'weapon', 'precision', false, '⌒', 'bowyers_bench', { attack: 5.0, interval: 1.8, crit: 0.08 }],
    ['foci', 'Arcane Foci', 'weapon', 'knowledge', false, '✦', 'rune_workbench', { attack: 5.1, interval: 1.9, damageType: 'arcane' }],
    ['armor', 'Armor', 'body', 'strength', true, '♜', 'fitting_bench', { health: 12, armor: 1.8 }],
    ['shields', 'Shields', 'offhand', 'strength', true, '⬟', 'fitting_bench', { health: 3, armor: 1.2, block: 0.06 }],
    ['rings', 'Rings', 'ring', 'knowledge', false, '○', 'jewelers_bench', { attack: 0.7, health: 3 }],
    ['charms', 'Charms', 'charm', 'knowledge', false, '◈', 'rune_workbench', { health: 4, armor: 0.3, evasion: 0.02 }],
    ['tools', 'Tools', 'tool', 'precision', false, '⚒', 'toolwright_bench', { attack: 0.5, health: 4, armorPen: 0.3 }]
  ];
  const classes = map(classRows.map(([id, name, slot, stat, heavy, icon, station, combat]) => ({
    id, name, slot, stat, heavy, icon, station, combat,
    twoHanded: ['polearms', 'bows', 'foci'].includes(id),
    description: `Completed ${name.toLowerCase()} improve this proficiency across every material tier.`
  })));

  const recipeNames = {
    daggers: ['Bronze Dagger', 'Iron Stiletto', 'Steel Rondel', 'Mithril Shadowblade', 'Starforged Nightfall'],
    swords: ['Bronze Shortsword', 'Iron Longsword', 'Steel Arming Sword', 'Mithril Dawnblade', 'Starforged Sovereign'],
    axes: ['Bronze Hatchet', 'Iron War Axe', 'Steel Battle Axe', 'Mithril Crescent', 'Starforged Worldsplitter'],
    maces: ['Bronze Mace', 'Iron Flanged Mace', 'Steel Warhammer', 'Mithril Thundermaul', 'Starforged Judgment'],
    polearms: ['Bronze Spear', 'Iron Glaive', 'Steel Halberd', 'Mithril Moonlance', 'Starforged Horizon'],
    bows: ['Bronze Reinforced Bow', 'Iron Recurve', 'Steel Composite Bow', 'Mithril Windbow', 'Starforged Celestial Bow'],
    foci: ['Bronze Channeling Rod', 'Iron Runestaff', 'Steel Ember Focus', 'Mithril Astral Focus', 'Starforged Eventide'],
    armor: ['Riveted Leather Vest', 'Iron Cuirass', 'Steel Brigandine', 'Mithril Aegis', 'Starforged Guardian Plate'],
    shields: ['Bronze Buckler', 'Iron Kite Shield', 'Steel Tower Shield', 'Mithril Mirror Shield', 'Starforged Bulwark'],
    rings: ['Bronze Signet', 'Iron Warden Ring', 'Steel Flameband', 'Mithril Moonring', 'Starforged Eternal Ring'],
    charms: ['Bronze Ward Charm', 'Iron Pathfinder Charm', 'Steel Ember Charm', 'Mithril Spirit Charm', 'Starforged Oracle Charm'],
    tools: ['Bronze Trail Kit', 'Iron Delver Kit', 'Steel Expedition Kit', 'Mithril Wayfinder', 'Starforged Voyager Kit']
  };
  const baseTimes = { daggers: 32, swords: 40, axes: 44, maces: 46, polearms: 48, bows: 44, foci: 45, armor: 50, shields: 40, rings: 34, charms: 36, tools: 38 };
  const basePrices = { daggers: 6, swords: 8, axes: 8, maces: 8, polearms: 8, bows: 8, foci: 6, armor: 8, shields: 7, rings: 6, charms: 6, tools: 6 };
  const metalCounts = { daggers: 1, swords: 2, axes: 2, maces: 2, polearms: 2, bows: 1, foci: 1, armor: 1, shields: 1, rings: 1, charms: 1, tools: 1 };
  const supports = {
    daggers: { leather: 1 }, swords: { leather: 1 }, axes: { wood: 1 }, maces: { wood: 1 },
    polearms: { wood: 1 }, bows: { wood: 3 }, foci: { wood: 1 }, armor: { leather: 2 },
    shields: { wood: 2 }, rings: { leather: 1 }, charms: { leather: 1 }, tools: { wood: 1 }
  };
  const tiers = [
    { tier: 1, materialId: 'bronze', multiplier: 1, stat: 2, proficiency: 0, rarity: 'common', difficulty: 0, time: 1, price: 1 },
    { tier: 2, materialId: 'iron', multiplier: 1.5, stat: 5, proficiency: 15, rarity: 'uncommon', difficulty: 6, time: 1.8, price: 3.4 },
    { tier: 3, materialId: 'steel', multiplier: 2.25, stat: 9, proficiency: 30, rarity: 'rare', difficulty: 12, time: 2.8, price: 9 },
    { tier: 4, materialId: 'mithril', multiplier: 3.4, stat: 14, proficiency: 50, rarity: 'epic', difficulty: 18, time: 4, price: 24 },
    { tier: 5, materialId: 'starforged', multiplier: 5.2, stat: 20, proficiency: 75, rarity: 'legendary', difficulty: 24, time: 5.5, price: 65 }
  ];
  const recipes = {};
  for (const c of Object.values(classes)) for (const t of tiers) {
    const id = `${t.materialId}_${c.id}`;
    const combat = { attack: 0, health: 0, armor: 0, interval: 2, crit: 0, evasion: 0, block: 0, armorPen: 0, damageType: 'physical', resistances: {}, ...c.combat };
    for (const stat of ['attack', 'health', 'armor', 'armorPen']) combat[stat] = round((combat[stat] || 0) * t.multiplier);
    if (c.id === 'charms' && t.tier >= 3) combat.resistances = { fire: 0.04 * t.tier, ice: 0.025 * t.tier };
    if (c.id === 'shields' && t.tier >= 3) combat.resistances = { fire: 0.025 * t.tier };
    const inputs = { [t.materialId]: metalCounts[c.id] + (t.tier > 1 ? 1 : 0), ...supports[c.id], fuel: 1 };
    const unlock = t.tier === 1 ? {} : t.tier === 2 ? { level: 3, questId: 'quarry_road', wins: 1, any: true } :
      t.tier === 3 ? { questId: 'ember_shrine', wins: 1 } : t.tier === 4 ? { questId: 'frost_citadel', wins: 1 } :
      { questId: 'void_sovereign', wins: 1, route: { questId: 'fallen_observatory', choiceId: 'recover_starforge' }, any: true };
    recipes[id] = {
      id, name: recipeNames[c.id][t.tier - 1], classId: c.id, slot: c.slot, materialId: t.materialId, tier: t.tier,
      rarity: t.rarity, inputs, baseSeconds: Math.round(baseTimes[c.id] * t.time), basePrice: Math.round(basePrices[c.id] * t.price),
      difficulty: t.difficulty, heavy: c.heavy, twoHanded: c.twoHanded, combat,
      smithXp: 12 * t.tier, classXp: 8 * t.tier,
      requires: { stat: c.stat, statValue: t.stat, proficiency: t.proficiency, upgrades: t.tier === 1 ? {} : { [c.station]: t.tier - 1 } },
      unlock, known: t.tier === 1,
      unlockText: ['Known from the beginning.', 'Reach smith level 3 or win Quarry Road.', 'Win Ember Shrine with iron equipment.', 'Win Frost Citadel with steel equipment and a prepared party.', 'Defeat the Void Sovereign or recover the Starforge at Fallen Observatory.'][t.tier - 1],
      description: `${t.materialId === 'starforged' ? 'Starforged' : t.materialId[0].toUpperCase() + t.materialId.slice(1)} ${c.name.toLowerCase()} construction. Class proficiency carries across materials.`
    };
  }

  const upgradeRows = [
    ['precision_anvil', 'Precision Anvil', 30, 5, { quality: 3 }, 'Each rank adds 3 crafting quality.', 1],
    ['improved_bellows', 'Improved Bellows', 24, 5, { speed: 0.08 }, 'Each rank adds 8% to the craft-speed bonus.', 1],
    ['heavy_forge', 'Heavy Forge', 48, 4, { heavyQuality: 2 }, 'Opens the next heavy weapon tier; +2 heavy-item quality per rank.', 2],
    ['fine_tools', 'Fine Tool Set', 44, 4, { quality: 1 }, 'Opens the next dagger tier; +1 crafting quality per rank.', 2],
    ['bowyers_bench', "Bowyer's Bench", 44, 4, { quality: 1 }, 'Opens the next bow tier; +1 crafting quality per rank.', 2],
    ['rune_workbench', 'Rune Workbench', 50, 4, { quality: 1 }, 'Opens the next focus and charm tier; +1 quality per rank.', 2],
    ['jewelers_bench', "Jeweler's Bench", 48, 4, { quality: 1 }, 'Opens the next ring tier; +1 crafting quality per rank.', 2],
    ['fitting_bench', 'Armor Fitting Bench', 46, 4, { quality: 1 }, 'Opens the next armor and shield tier; +1 quality per rank.', 2],
    ['toolwright_bench', "Toolwright's Bench", 40, 4, { quality: 1 }, 'Opens the next utility-tool tier; +1 quality per rank.', 2],
    ['research_library', 'Research Library', 70, 5, { proficiencyXp: 0.1 }, 'Each rank adds 10% proficiency XP.', 3],
    ['enchanting_table', 'Enchanting Table', 140, 4, { enchanting: 1, enchant: 0.1 }, 'Unlocks enchanting; each rank adds 10% enchant strength.', 4],
    ['parallel_stations', 'Parallel Stations', 160, 2, { lanes: 1 }, 'Each rank adds one simultaneous crafting lane.', 4],
    ['queue_racks', 'Queue Racks', 28, 5, { queue: 2 }, 'Each rank adds two waiting craft slots.', 1],
    ['material_warehouse', 'Material Warehouse', 32, 5, { materialCapacity: 40 }, 'Each rank stores 40 more loose materials.', 1],
    ['display_shelving', 'Display Shelving', 36, 5, { capacity: 6, display: 1 }, 'Each rank stores six more finished items and displays one more.', 1],
    ['guild_hall', 'Guild Hall', 90, 2, { partySize: 1 }, 'Each rank allows one more party member, up to three.', 3],
    ['trade_counter', 'Trade Counter', 50, 4, { arrival: 0.08 }, 'Each rank improves customer arrival cadence by 8%.', 2],
    ['automation_desk', 'Automation Desk', 120, 1, { automation: 1 }, 'Enables explicit repeat-craft, purchase and sale policies.', 4],
    ['supply_logistics', 'Supply Logistics', 80, 4, { materialDiscount: 0.04 }, 'Each rank reduces common material prices by 4%.', 3],
    ['expedition_office', 'Expedition Office', 95, 2, { expeditions: 1 }, 'Each rank permits one additional simultaneous expedition.', 3]
  ];
  const upgrades = map(upgradeRows.map(([id, name, cost, maxLevel, effects, description, level]) => ({ id, name, cost, maxLevel, costScale: 1.9, effects, description, requires: { level } })));
  const staff = map([
    { id: 'apprentice', name: 'Apprentice', cost: 60, maxLevel: 5, costScale: 1.7, description: 'Assigned production gains 4% craft-speed bonus per rank.', effects: { speed: 0.04 }, requires: { level: 2 }, work: 'craft' },
    { id: 'quartermaster', name: 'Quartermaster', cost: 55, maxLevel: 5, costScale: 1.7, description: 'Each rank adds 15 material capacity and a 2% procurement discount.', effects: { materialCapacity: 15, materialDiscount: 0.02 }, requires: { level: 2 }, work: 'supply' },
    { id: 'envoy', name: 'Envoy', cost: 55, maxLevel: 5, costScale: 1.7, description: 'Each rank adds 4% customer cadence and 3% customer budgets.', effects: { arrival: 0.04, budget: 0.03 }, requires: { level: 2 }, work: 'sale' },
    { id: 'runekeeper', name: 'Runekeeper', cost: 120, maxLevel: 5, costScale: 1.7, description: 'Each rank adds 1 crafting quality and 5% enchant strength.', effects: { quality: 1, enchant: 0.05 }, requires: { level: 4 }, work: 'enchant' }
  ]);
  const decor = map([
    { id: 'hearth_banner', name: 'Hearth Banner', cost: 45, maxLevel: 1, description: 'A familiar welcome brings customers 5% faster. Survives Legacy.', effects: { arrival: 0.05 } },
    { id: 'warming_brazier', name: 'Warming Brazier', cost: 60, maxLevel: 1, description: 'A comfortable workshop adds 4% craft speed. Survives Legacy.', effects: { speed: 0.04 } },
    { id: 'makers_plaque', name: "Maker's Plaque", cost: 80, maxLevel: 1, description: 'Pride in your mark adds 2 crafting quality. Survives Legacy.', effects: { quality: 2 } },
    { id: 'guild_trophy', name: 'Guild Trophy', cost: 120, maxLevel: 1, description: 'A trusted name raises customer budgets by 5%. Survives Legacy.', effects: { budget: 0.05 } }
  ]);

  const baseHero = { health: 34, attack: 2, armor: 0.5, interval: 2, crit: 0.03, evasion: 0.02 };
  const universal = ['armor', 'rings', 'charms', 'tools'];
  const archetypes = map([
    { id: 'vanguard', name: 'Vanguard', role: 'frontline', icon: '⚔', preferences: ['swords', 'shields', ...universal], base: { ...baseHero }, passive: { id: 'steady_front', name: 'Steady Front', description: 'Balanced offense and protection.' } },
    { id: 'duelist', name: 'Duelist', role: 'skirmisher', icon: '†', preferences: ['daggers', 'swords', ...universal], base: { ...baseHero, health: 32, evasion: 0.04 }, passive: { id: 'quickstep', name: 'Quickstep', description: 'Attacks 8% faster.', speed: 0.08 } },
    { id: 'breaker', name: 'Breaker', role: 'breaker', icon: '♜', preferences: ['axes', 'maces', 'shields', ...universal], base: { ...baseHero, health: 36, attack: 2.2 }, passive: { id: 'crush', name: 'Crush', description: 'Ignores 1 armor.', armorPen: 1 } },
    { id: 'ranger', name: 'Ranger', role: 'ranged', icon: '⌒', preferences: ['bows', 'daggers', ...universal], base: { ...baseHero, health: 32, crit: 0.08 }, passive: { id: 'eagle_eye', name: 'Eagle Eye', description: 'Critical attacks pressure priority targets.', crit: 0.05 } },
    { id: 'guardian', name: 'Guardian', role: 'protector', icon: '⬟', preferences: ['polearms', 'swords', 'shields', ...universal], base: { ...baseHero, health: 38, armor: 0.8, attack: 1.8 }, passive: { id: 'shelter', name: 'Shelter', description: 'Reduces damage suffered by the party by 8%.', protection: 0.08 } },
    { id: 'mage', name: 'Mage', role: 'caster', icon: '✦', preferences: ['foci', ...universal], base: { ...baseHero, health: 30, armor: 0.3, attack: 2.4 }, passive: { id: 'arcane_echo', name: 'Arcane Echo', description: 'Arcane attacks splash other living enemies.', aoe: 0.25 } }
  ]);
  const heroes = [
    { id: 'mara', name: 'Mara', archetypeId: 'vanguard' }, { id: 'bren', name: 'Bren', archetypeId: 'breaker' },
    { id: 'lyra', name: 'Lyra', archetypeId: 'duelist' }, { id: 'orrin', name: 'Orrin', archetypeId: 'ranger' },
    { id: 'sable', name: 'Sable', archetypeId: 'mage' }, { id: 'thane', name: 'Thane', archetypeId: 'guardian' },
    { id: 'ida', name: 'Ida', archetypeId: 'vanguard' }, { id: 'renn', name: 'Renn', archetypeId: 'duelist' },
    { id: 'hark', name: 'Hark', archetypeId: 'breaker' }, { id: 'wren', name: 'Wren', archetypeId: 'ranger' },
    { id: 'aela', name: 'Aela', archetypeId: 'guardian' }, { id: 'vesper', name: 'Vesper', archetypeId: 'mage' }
  ];
  const regions = [
    { id: 'town', name: 'Town Cellars', description: 'Learn the cost of weak gear and the value of a careful retry.', tier: 1 },
    { id: 'quarry', name: 'Old Quarry', description: 'Iron plans and armored opponents.', tier: 2 },
    { id: 'ember', name: 'Ember Hills', description: 'Fire counters and the secrets of steel.', tier: 3 },
    { id: 'wildwood', name: 'Wildwood', description: 'Branches, scouting and complementary party roles.', tier: 3 },
    { id: 'frost', name: 'Frost March', description: 'Epic discoveries beyond a phased guardian.', tier: 4 },
    { id: 'starfall', name: 'Starfall Crater', description: 'A legendary route and a three-hero finale.', tier: 5 }
  ];
  const enemy = (id, name, health, attack, armor, interval, damageType = 'physical', extra = {}) => ({ id, name, health, attack, armor, interval, damageType, ...extra });
  const quests = map([
    { id: 'rat_nest', name: 'Rat Nest', regionId: 'town', tier: 1, baseSeconds: 60, description: 'A hungry giant rat tests an ordinary first weapon.', enemies: [enemy('giant_rat', 'Giant Rat', 40, 8.25, 0.5, 2.3)], requires: {}, rewards: { gold: 1, materials: { leather: 1 }, heroXp: 8 }, benchmark: 80, recoverySeconds: 90, choices: [] },
    { id: 'smuggler_cache', name: 'Smuggler Cache', regionId: 'town', tier: 1, baseSeconds: 80, description: 'A patient bandit punishes weak protection. Retreat, improve, return.', enemies: [enemy('cache_guard', 'Smuggler Guard', 43, 8.75, 0.8, 2.5)], requires: { questWins: { rat_nest: 1 } }, rewards: { gold: 2, materials: { bronze: 1, wood: 1 }, heroXp: 12 }, benchmark: 92, recoverySeconds: 110, choices: [{ id: 'recover_supplies', name: 'Recover supplies', description: 'Bring extra bronze home.', rewards: { materials: { bronze: 2 } } }, { id: 'help_townsfolk', name: 'Help the townsfolk', description: 'Earn a small tip and experience.', rewards: { gold: 2, heroXp: 4 } }] },
    { id: 'quarry_road', name: 'Quarry Road', regionId: 'quarry', tier: 2, baseSeconds: 100, description: 'Good bronze equipment or a coordinated pair can reopen the iron road.', enemies: [enemy('quarry_raider', 'Quarry Raider', 62, 9.5, 2, 2.5)], requires: { questWins: { smuggler_cache: 1 } }, rewards: { gold: 4, materials: { iron: 2, leather: 1 }, heroXp: 20 }, benchmark: 135, recoverySeconds: 120, choices: [] },
    { id: 'stone_sentinel', name: 'Stone Sentinel', regionId: 'quarry', tier: 2, baseSeconds: 120, description: 'A stone guardian hardens its attacks below half health.', enemies: [enemy('stone_sentinel', 'Stone Sentinel', 104, 12, 4, 2.8, 'physical', { phaseAt: 0.5, phaseAttack: 0.25, phaseName: 'Shattered Fury' })], requires: { questWins: { quarry_road: 1 } }, rewards: { gold: 6, materials: { iron: 3, gem: 1 }, heroXp: 28 }, benchmark: 185, recoverySeconds: 120, choices: [{ id: 'survey_depths', name: 'Survey the depths', description: 'Recover ore and a gem.', rewards: { materials: { iron: 2, gem: 1 } } }, { id: 'secure_trade', name: 'Secure the trade road', description: 'Take the guild payment.', rewards: { gold: 5 } }] },
    { id: 'ash_courtyard', name: 'Ash Courtyard', regionId: 'ember', tier: 3, baseSeconds: 130, description: 'Fire-resistant charms protect a prepared iron-equipped party.', enemies: [enemy('ash_hound', 'Ash Hound', 90, 12, 2, 2.2, 'fire'), enemy('ember_warden', 'Ember Warden', 75, 10, 3, 2.6, 'physical')], requires: { questWins: { stone_sentinel: 1 } }, rewards: { gold: 9, materials: { iron: 3, ember_shard: 1 }, heroXp: 35 }, benchmark: 260, recoverySeconds: 130, choices: [] },
    { id: 'ember_shrine', name: 'Ember Shrine', regionId: 'ember', tier: 3, baseSeconds: 150, description: 'An iron-equipped party can claim steel plans without needing steel first.', enemies: [enemy('ember_priest', 'Ember Priest', 230, 19, 4, 2.6, 'fire', { phaseAt: 0.5, phaseAttack: 0.25, phaseName: 'Living Flame' })], requires: { questWins: { ash_courtyard: 1 } }, rewards: { gold: 14, materials: { steel: 3, ember_shard: 2 }, heroXp: 48 }, benchmark: 335, recoverySeconds: 140, choices: [{ id: 'preserve_flame', name: 'Preserve the flame', description: 'Collect a fire catalyst.', rewards: { materials: { ember_shard: 2 } } }, { id: 'forge_accord', name: 'Forge an accord', description: 'Receive steel and a guild payment.', rewards: { materials: { steel: 2 }, gold: 8 } }] },
    { id: 'thorn_pass', name: 'Thorn Pass', regionId: 'wildwood', tier: 3, baseSeconds: 160, description: 'Rangers and tools help a steel-equipped party through the ambush.', enemies: [enemy('thorn_stalker', 'Thorn Stalker', 115, 15, 3, 2.0), enemy('briar_guard', 'Briar Guard', 130, 14, 5, 2.8)], requires: { questWins: { ember_shrine: 1 } }, rewards: { gold: 16, materials: { steel: 3, leather: 4 }, heroXp: 55 }, benchmark: 410, recoverySeconds: 140, choices: [] },
    { id: 'wildwood_heart', name: 'Wildwood Heart', regionId: 'wildwood', tier: 3, baseSeconds: 170, description: 'A branching pact rewards a balanced party with resources or lore.', enemies: [enemy('heartwood_warden', 'Heartwood Warden', 335, 23, 6, 2.6, 'physical', { phaseAt: 0.5, phaseAttack: 0.2, phaseName: 'Rootbound Rage' })], requires: { questWins: { thorn_pass: 1 } }, rewards: { gold: 20, materials: { steel: 4, gem: 2 }, heroXp: 65 }, benchmark: 480, recoverySeconds: 150, choices: [{ id: 'protect_grove', name: 'Protect the grove', description: 'Gain party experience and rare wood.', rewards: { heroXp: 18, materials: { wood: 8 } } }, { id: 'map_ruins', name: 'Map the ruins', description: 'Recover gems and an expedition payment.', rewards: { materials: { gem: 3 }, gold: 12 } }] },
    { id: 'frost_pass', name: 'Frost Pass', regionId: 'frost', tier: 4, baseSeconds: 190, description: 'Ice resistance and a Guardian soften a dangerous mountain approach.', enemies: [enemy('frost_wolf', 'Frost Wolf', 175, 21, 5, 2.1, 'frost'), enemy('ice_guard', 'Ice Guard', 180, 24, 7, 2.8, 'frost')], requires: { questWins: { wildwood_heart: 1 } }, rewards: { gold: 26, materials: { steel: 4, frost_crystal: 1 }, heroXp: 78 }, benchmark: 585, recoverySeconds: 160, choices: [] },
    { id: 'frost_citadel', name: 'Frost Citadel', regionId: 'frost', tier: 4, baseSeconds: 210, description: 'Prepared steel, protection and three developed heroes unlock mithril.', enemies: [enemy('frost_regent', 'Frost Regent', 510, 31, 8, 2.7, 'frost', { phaseAt: 0.5, phaseAttack: 0.25, phaseName: 'Whiteout' })], requires: { questWins: { frost_pass: 1 } }, rewards: { gold: 34, materials: { mithril: 4, frost_crystal: 2 }, heroXp: 95 }, benchmark: 710, recoverySeconds: 170, choices: [{ id: 'claim_epic_lore', name: 'Claim epic lore', description: 'Take mithril and a crystal.', rewards: { materials: { mithril: 3, frost_crystal: 1 } } }, { id: 'rescue_scholars', name: 'Rescue the scholars', description: 'Receive experience and a larger tip.', rewards: { heroXp: 25, gold: 20 } }] },
    { id: 'fallen_observatory', name: 'Fallen Observatory', regionId: 'starfall', tier: 5, baseSeconds: 220, description: 'Mithril equipment can recover a Starforge route before the Void finale.', enemies: [enemy('astral_construct', 'Astral Construct', 370, 32, 9, 2.6, 'arcane'), enemy('void_echo', 'Void Echo', 220, 24, 6, 2.2, 'arcane')], requires: { questWins: { frost_citadel: 1 } }, rewards: { gold: 45, materials: { mithril: 4, star_fragment: 1 }, heroXp: 115 }, benchmark: 875, recoverySeconds: 180, choices: [{ id: 'recover_starforge', name: 'Recover the Starforge', description: 'Unlock the alternate Starforged recipe route after victory.', unlockRecipes: Object.values(recipes).filter(r => r.tier === 5).map(r => r.id), rewards: { materials: { starforged: 3 } } }, { id: 'seal_rift', name: 'Seal the rift', description: 'Take safer spoils; replay later for the Starforge route.', rewards: { gold: 25, materials: { star_fragment: 2 } } }] },
    { id: 'void_sovereign', name: 'Void Sovereign', regionId: 'starfall', tier: 5, baseSeconds: 240, description: 'A three-hero finale. Prepared mithril, counters and mastery remain viable.', enemies: [enemy('void_sovereign', 'Void Sovereign', 900, 43, 12, 2.5, 'arcane', { phaseAt: 0.5, phaseAttack: 0.25, phaseName: 'The Falling Sky' })], requires: { questWins: { fallen_observatory: 1 }, partySize: 3 }, rewards: { gold: 65, materials: { starforged: 5, star_fragment: 3 }, heroXp: 150 }, benchmark: 1150, recoverySeconds: 180, choices: [] }
  ]);

  const affixes = map([
    { id: 'keen', name: 'Keen', description: '+8% item attack.', effects: { attack: 0.08 }, slots: ['weapon'] },
    { id: 'stout', name: 'Stout', description: '+10% item health.', effects: { health: 0.1 }, slots: ['body', 'offhand', 'ring', 'charm', 'tool'] },
    { id: 'warded', name: 'Warded', description: '+10% item armor.', effects: { armor: 0.1 }, slots: ['body', 'offhand', 'charm'] },
    { id: 'precise', name: 'Precise', description: '+4 percentage points critical chance.', effects: { crit: 0.04 }, slots: ['weapon', 'ring', 'tool'] },
    { id: 'nimble', name: 'Nimble', description: '+3 percentage points evasion.', effects: { evasion: 0.03 }, slots: ['body', 'charm', 'tool'] },
    { id: 'piercing', name: 'Piercing', description: '+1 armor penetration.', effects: { armorPen: 1 }, slots: ['weapon', 'ring', 'tool'] }
  ]);
  const enchantments = map([
    { id: 'flame', name: 'Flame Etching', description: 'Adds 2 weapon attack.', cost: 12, inputs: { gem: 1, ember_shard: 1 }, requires: { upgrades: { enchanting_table: 1 }, level: 4 }, effects: {}, combat: { attack: 2 }, slots: ['weapon'] },
    { id: 'frost_ward', name: 'Frost Ward', description: 'Adds 15% frost resistance.', cost: 16, inputs: { gem: 1, frost_crystal: 1 }, requires: { upgrades: { enchanting_table: 1 }, level: 5 }, effects: { iceResist: 0.15 }, slots: ['body', 'offhand', 'ring', 'charm'] },
    { id: 'ember_ward', name: 'Ember Ward', description: 'Adds 15% fire resistance.', cost: 12, inputs: { gem: 1, ember_shard: 1 }, requires: { upgrades: { enchanting_table: 1 }, level: 4 }, effects: { fireResist: 0.15 }, slots: ['body', 'offhand', 'ring', 'charm'] },
    { id: 'vitality', name: 'Vitality Seal', description: 'Adds 8 health.', cost: 8, inputs: { gem: 1 }, requires: { upgrades: { enchanting_table: 1 }, level: 4 }, effects: {}, combat: { health: 8 }, slots: ['body', 'offhand', 'ring', 'charm', 'tool'] },
    { id: 'starlight', name: 'Starlight Rune', description: 'Adds 4 attack and 10% void resistance.', cost: 28, inputs: { gem: 2, star_fragment: 1 }, requires: { upgrades: { enchanting_table: 2 }, level: 8 }, effects: { voidResist: 0.1 }, combat: { attack: 4 }, slots: ['weapon', 'ring', 'charm'] }
  ]);

  const talentRows = {
    force: [
      ['practiced_hands', 'Practiced Hands', { speed: 0.12 }, '+12% crafting speed bonus.'],
      ['deep_stores', 'Deep Stores', { capacity: 8 }, '+8 finished-item capacity.'],
      ['heavy_forms', 'Heavy Forms', { heavyQuality: 6 }, '+6 quality for heavy equipment.'],
      ['tireless_furnace', 'Tireless Furnace', { queue: 2 }, '+2 waiting craft slots.'],
      ['twin_anvils', 'Twin Anvils', { lanes: 1 }, '+1 parallel crafting lane.'],
      ['founders_strength', 'Founders Strength', { startStrength: 2 }, '+2 starting Strength after allocation.']
    ],
    artifice: [
      ['steady_eye', 'Steady Eye', { quality: 4 }, '+4 quality for every craft.'],
      ['keen_edges', 'Keen Edges', { attack: 0.08 }, '+8% item attack contribution.'],
      ['measured_lines', 'Measured Lines', { affixChance: 0.15 }, '+15 percentage points affix chance.'],
      ['runic_resonance', 'Runic Resonance', { enchant: 0.25 }, '+25% enchantment strength.'],
      ['masterwork_tradition', 'Masterwork Tradition', { quality: 8 }, '+8 quality for every craft.'],
      ['heirloom_bond', 'Heirloom Bond', { heirloomCombat: 0.2 }, '+20% heirloom combat contributions.']
    ],
    commerce: [
      ['trusted_name', 'Trusted Name', { sale: 0.1 }, '+10% final sale price.'],
      ['busy_counter', 'Busy Counter', { arrival: 0.2 }, 'Customer arrivals are 20% faster.'],
      ['guild_purse', 'Guild Purse', { budget: 0.2 }, '+20% customer budgets.'],
      ['fair_contracts', 'Fair Contracts', { staffDiscount: 0.25 }, 'Staff hiring costs 25% less.'],
      ['trade_network', 'Trade Network', { materialDiscount: 0.15 }, 'Common materials cost 15% less.'],
      ['family_fortune', 'Family Fortune', { startGold: 250 }, '+250 starting gold.']
    ],
    lore: [
      ['patient_study', 'Patient Study', { proficiencyXp: 0.2 }, '+20% proficiency XP.'],
      ['field_notes', 'Field Notes', { heroXp: 0.2 }, '+20% adventurer XP.'],
      ['hidden_veins', 'Hidden Veins', { loot: 0.25 }, '+25% quest material loot.'],
      ['ancient_script', 'Ancient Script', { proficiencyGateReduction: 5 }, 'Recipe proficiency gates reduced by 5, floor zero.'],
      ['shared_purpose', 'Shared Purpose', { partySynergy: 0.2 }, 'Distinct-role party synergy becomes 20% instead of 10%.'],
      ['living_archive', 'Living Archive', { startProficiency: 10 }, 'Every proficiency starts at 10.']
    ]
  };
  const talents = {};
  for (const [branch, rows] of Object.entries(talentRows)) rows.forEach(([id, name, effects, description], index) => {
    talents[id] = { id, name, branch, depth: index + 1, cost: [1, 1, 2, 2, 3, 4][index], maxLevel: 1, effects, description, previousId: index ? rows[index - 1][0] : null, prerequisite: index ? rows[index - 1][0] : null, requires: index ? [rows[index - 1][0]] : [] };
  });

  const quarry = {
    description: 'Ore is processed into usable stock on site. Workers have no wages; output pauses at material capacity.',
    manualCooldownSeconds: 5,
    deposits: map([
      { id: 'bronze', materialId: 'bronze', name: 'Bronze Working', baseSeconds: 45, yield: 1, requires: { depth: 0 }, description: 'Your original shallow working produces usable bronze stock.' },
      { id: 'fuel', materialId: 'fuel', name: 'Coal Pocket', baseSeconds: 50, yield: 1, requires: { depth: 0 }, description: 'Coal is prepared as crafting fuel.' },
      { id: 'iron', materialId: 'iron', name: 'Iron Seam', baseSeconds: 65, yield: 1, requires: { depth: 2, level: 3 }, description: 'Depth 2 and smith level 3 reveal stronger metal.' },
      { id: 'steel', materialId: 'steel', name: 'Steel Processing', baseSeconds: 90, yield: 1, requires: { depth: 2, quarryUpgrades: { smelter: 1 }, questWins: { ember_shrine: 1 } }, description: 'The smelter processes the iron seam into steel stock.' },
      { id: 'gem', materialId: 'gem', name: 'Gem Pocket', baseSeconds: 120, yield: 1, requires: { depth: 2 }, description: 'Slowly recover catalysts from a richer pocket.' },
      { id: 'mithril', materialId: 'mithril', name: 'Mithril Seam', baseSeconds: 130, yield: 1, requires: { depth: 4, questWins: { frost_citadel: 1 } }, description: 'Frost discoveries reveal the deep mithril seam.' },
      { id: 'starforged', materialId: 'starforged', name: 'Star Ore Refinery', baseSeconds: 175, yield: 1, requires: { depth: 5, questWins: { void_sovereign: 1 }, route: { questId: 'fallen_observatory', choiceId: 'recover_starforge' }, any: true }, description: 'Process star ore after the finale or the alternate Starforge route.' }
    ]),
    upgrades: map([
      { id: 'depth', name: 'Depth', description: 'Each rank opens deeper workings and improves extraction speed by 2%.', cost: 18, maxLevel: 5, costScale: 1.9, effects: { speed: 0.02 }, requires: {} },
      { id: 'tools', name: 'Mining Tools', description: 'Each rank adds 10% extraction speed.', cost: 14, maxLevel: 5, costScale: 1.7, effects: { speed: 0.1 }, requires: {} },
      { id: 'haulage', name: 'Haulage', description: 'Each rank adds one usable stock unit per completed production cycle.', cost: 28, maxLevel: 4, costScale: 2, effects: { yield: 1 }, requires: { depth: 1 } },
      { id: 'smelter', name: 'Smelter', description: 'Enables advanced alloy processing and adds 8% production speed per rank.', cost: 40, maxLevel: 4, costScale: 1.9, effects: { speed: 0.08 }, requires: { depth: 2, level: 3 } },
      { id: 'safety', name: 'Safety', description: 'Better bracing and routines add 6% reliable production speed per rank.', cost: 16, maxLevel: 5, costScale: 1.6, effects: { speed: 0.06 }, requires: {} }
    ]),
    workers: map([
      { id: 'miner', name: 'Miner', description: 'Each assigned rank adds one usable stock unit per cycle. No wages.', cost: 12, maxLevel: 5, costScale: 1.8, effects: { yield: 1 }, requires: {} },
      { id: 'digger', name: 'Digger', description: 'Each assigned rank adds 12% extraction speed. No wages.', cost: 18, maxLevel: 5, costScale: 1.8, effects: { speed: 0.12 }, requires: { depth: 1 } },
      { id: 'smelter', name: 'Smelter', description: 'Each assigned rank adds 10% stock-processing speed. No wages.', cost: 24, maxLevel: 5, costScale: 1.8, effects: { speed: 0.1 }, requires: { depth: 2, level: 3 } },
      { id: 'surveyor', name: 'Surveyor', description: 'Each assigned rank adds 8% productive extraction speed in richer seams. No wages.', cost: 30, maxLevel: 5, costScale: 1.8, effects: { speed: 0.08 }, requires: { depth: 2 } }
    ])
  };

  for (const archetype of Object.values(archetypes)) {
    archetype.passiveInfo = archetype.passive;
    archetype.passive = archetype.id;
  }
  archetypes.vanguard.passiveInfo = { name: 'Steady Front', description: '+2 percentage points critical chance and block chance.', crit: 0.02, block: 0.02 };
  archetypes.duelist.passiveInfo = { name: 'Quickstep', description: 'Attacks 8% faster.', speed: 0.08 };
  archetypes.breaker.passiveInfo = { name: 'Crush', description: 'Ignores 1 armor.', armorPen: 1 };
  archetypes.ranger.passiveInfo = { name: 'Eagle Eye', description: '+5 percentage points critical chance.', crit: 0.05 };
  archetypes.guardian.passiveInfo = { name: 'Shelter', description: 'A living Guardian reduces incoming party damage by 8%.', protection: 0.08 };
  archetypes.mage.passiveInfo = { name: 'Arcane Echo', description: 'Arcane attacks splash 25% damage onto other living enemies.', aoe: 0.25 };
  materials.iron.unlock = { level: 3, questId: 'quarry_road', wins: 1, any: true };
  materials.steel.unlock = { questId: 'ember_shrine', wins: 1 };
  materials.mithril.unlock = { questId: 'frost_citadel', wins: 1 };
  materials.starforged.unlock = { questId: 'void_sovereign', wins: 1, route: { questId: 'fallen_observatory', choiceId: 'recover_starforge' }, any: true };
  materials.gem.requires = { level: 3 };
  for (const quest of Object.values(quests)) for (const foe of quest.enemies) {
    if (foe.damageType === 'frost') foe.damageType = 'ice';
    if (quest.regionId === 'starfall') foe.damageType = 'void';
  }
  quests.void_sovereign.minPartySize = 3;
  for (const quest of Object.values(quests)) {
    quest.budget = { 1: 16, 2: 40, 3: 110, 4: 300, 5: 850 }[quest.tier];
    quest.benchmarkTier = { town: 1, quarry: 1, ember: 2, wildwood: 3, frost: 3, starfall: 4 }[quest.regionId];
    quest.benchmarkQuality = 40;
  }
  const townGoodwill = quests.smuggler_cache.choices.find(c => c.id === 'help_townsfolk');
  townGoodwill.description = 'Earn a small tip and goodwill: customer budgets rise 3% this generation.';
  townGoodwill.rewards = { gold: 2 };
  townGoodwill.effects = { budget: 0.03 };
  const grovePact = quests.wildwood_heart.choices.find(c => c.id === 'protect_grove');
  grovePact.description = 'Gain wood and a lasting pact: +5% adventurer XP this generation.';
  grovePact.rewards = { materials: { wood: 8 } };
  grovePact.effects = { heroXp: 0.05 };
  const rescuedScholars = quests.frost_citadel.choices.find(c => c.id === 'rescue_scholars');
  rescuedScholars.description = 'Receive a tip and scholarly aid: +3% proficiency XP this generation.';
  rescuedScholars.rewards = { gold: 20 };
  rescuedScholars.effects = { proficiencyXp: 0.03 };
  quests.fallen_observatory.choices.find(c => c.id === 'seal_rift').description = 'Take the spoils now. Defeating the Void Sovereign remains your Starforged recipe route this generation.';
  const commissions = map([
    { id: 'named_order', name: 'A Trusted Commission', description: 'A familiar adventurer requests a fine example of a compatible weapon class.', relationship: 5, minTier: 1, minQuality: 50, premium: 1.5, bonusGold: 3, rewardMaterials: { leather: 1 }, smithXp: 12 },
    { id: 'veteran_order', name: 'Veteran Equipment', description: 'An experienced customer requests superior equipment made from iron or better.', relationship: 15, minTier: 2, minQuality: 70, premium: 1.75, bonusGold: 8, rewardMaterials: { gem: 1 }, smithXp: 24 },
    { id: 'masterwork_order', name: 'A Signature Masterwork', description: 'A loyal adventurer commissions a named masterwork made from steel or better.', relationship: 30, minTier: 3, minQuality: 85, premium: 2, bonusGold: 15, rewardMaterials: { gem: 2 }, smithXp: 40 }
  ]);
  const relationshipMilestones = [
    { threshold: 5, name: 'Trusted Craftsperson', gift: { materials: { leather: 1, wood: 1 } }, commissionId: 'named_order', description: 'One-time material gift and a trusted commission.' },
    { threshold: 15, name: 'Veteran Partnership', gift: { materials: { gem: 1 } }, commissionId: 'veteran_order', description: 'One-time gem gift and a superior-equipment commission.' },
    { threshold: 30, name: 'Lifelong Patron', gift: { materials: { gem: 2 } }, commissionId: 'masterwork_order', guaranteedDiscovery: true, description: 'One-time gem gift, an eligible unknown recipe when available, and a masterwork commission.' }
  ];
  const EIData = {
    version: '0.3.0', title: 'Ember & Iron', materials, classes, tiers, recipes, upgrades, staff, decor,
    archetypes, heroes, regions, quests, affixes, enchantments, talents, quarry, commissions, relationshipMilestones,
    starting: { gold: 18, materials: { bronze: 6, wood: 4, leather: 4, fuel: 6 }, heroIds: ['mara', 'bren'], wornWeapon: { attack: 3, interval: 2 }, wornBody: { health: 3, armor: 0.5 } },
    balance: { customerSeconds: 30, offlineCapSeconds: 28800, initialLanes: 1, initialQueue: 3, initialCapacity: 24, initialMaterialCapacity: 200, initialDisplay: 6, initialPartySize: 1, initialExpeditions: 3, basePartySynergy: 0.1, legacyLevel: 8, legacyWins: 6, forecastSeeds: 20 },
    rarityOrder: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    qualityLabels: [{ min: 0, name: 'Rough' }, { min: 20, name: 'Serviceable' }, { min: 40, name: 'Fine' }, { min: 60, name: 'Superior' }, { min: 85, name: 'Masterwork' }]
  };
  root.EIData = EIData;
  if (typeof module !== 'undefined' && module.exports) module.exports = EIData;
})(typeof globalThis !== 'undefined' ? globalThis : window);
