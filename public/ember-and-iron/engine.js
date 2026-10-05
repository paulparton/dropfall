(function (root, factory) {
  const Engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = Engine;
  else root.EIEngine = Engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const vals = value => Object.values(value || {});
  const stats = ['strength', 'precision', 'charisma', 'knowledge'];
  const slots = ['weapon', 'body', 'offhand', 'ring', 'charm', 'tool'];
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  const random = seed => { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; };
  const okay = (message, data) => ({ ok: true, message, data });
  const fail = message => ({ ok: false, message });
  const sum = object => vals(object).reduce((a, b) => a + b, 0);
  class EIEngine {
    constructor(data, saved) {
      if (!data || !data.recipes || !data.classes) throw new Error('A content registry is required.');
      this.data = data;
      this._previewCache = new Map();
      this._offline = false;
      this._offlineSpend = 0;
      this.state = this._fresh();
      if (saved) {
        const checked = EIEngine.validateSave(saved, data);
        if (!checked.ok) throw new Error(checked.message);
        this.state = checked.state;
      }
    }
    _fresh() {
      const proficiency = {}, materials = {};
      Object.keys(this.data.classes).forEach(id => proficiency[id] = { level: 0, xp: 0 });
      Object.keys(this.data.materials || {}).forEach(id => materials[id] = 0);
      Object.assign(materials, { bronze: 6, wood: 4, leather: 4, fuel: 6 });
      return {
        schemaVersion: 1, contentVersion: this.data.version || '0.2', started: false,
        shopName: 'Ember & Iron', simTime: 0, lastWallTime: Date.now(), rngState: 2463534242, nextId: 1,
        player: { level: 1, xp: 0, points: 0, stats: { strength: 2, precision: 2, charisma: 2, knowledge: 2 },
          proficiency, gold: 18, reputation: 0, respecTokens: 0, talents: [],
          legacy: { generation: 1, points: 0, totalPoints: 0, heirlooms: [], unlockedRecipes: [], collection: {} } },
        materials, inventory: [], jobs: [], adventurers: [], runs: [], commissions: [], upgrades: {}, staff: {}, decorations: [], decorationLevels: {},
        unlocks: { recipes: [], quests: [], milestones: [], routes: {} }, questWins: {}, discoveryMisses: 0,
        mailbox: [], automation: { enabled: false, recipeId: null, targetStock: 3, autoBuy: false,
          autoSell: false, autoDispatch: false, goldReserve: 12, spendCap: 60, allowRare: false },
        nextArrivalAt: 30000, nextAutomationAt: 5000, nextNpcAt: 2000, shopEvents: [],
        quarry: { workers: {}, upgrades: {}, activeDeposit: 'bronze', progress: 0, lastYieldAt: 0,
          nextYieldAt: 45000, nextManualAt: 0, pausedReason: '' },
        logs: [], stats: { crafted: 0, sold: 0, questsWon: 0, questsLost: 0, goldEarned: 0, masterworks: [] },
        tutorial: { stage: 0 }, offlineReport: null,
        offlineSession: { active: false, credited: 0, spent: 0 }
      };
    }
    getState() { return clone(this.state); }
    _id(prefix) { return prefix + '-' + this.state.nextId++; }
    _roll() {
      let x = this.state.rngState >>> 0 || 1;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.state.rngState = x >>> 0;
      return this.state.rngState / 4294967296;
    }
    _log(text, type = 'info') {
      this.state.logs.unshift({ id: this._id('log'), time: this.state.simTime, text, type });
      this.state.logs.length = Math.min(150, this.state.logs.length);
    }
    _shopEvent(type, hero, details = {}) {
      this.state.shopEvents.unshift({ id: this._id('scene'), type, time: this.state.simTime, heroId: hero?.id || null, ...details });
      this.state.shopEvents.length = Math.min(80, this.state.shopEvents.length);
    }
    _effects() {
      const out = {};
      const add = (effects, multiplier = 1) => Object.entries(effects || {}).forEach(([key, value]) => {
        if (typeof value !== 'number') return;
        out[key] = key === 'partySynergy' ? Math.max(out[key] || 0, value) : (out[key] || 0) + value * multiplier;
      });
      Object.entries(this.state.upgrades).forEach(([id, rank]) => add(this.data.upgrades?.[id]?.effects, rank));
      this.state.player.talents.forEach(id => add(this.data.talents?.[id]?.effects));
      this.state.decorations.forEach(id => add(this.data.decor?.[id]?.effects, this.decorationLevel(id)));
      Object.entries(this.state.staff).forEach(([id, member]) => { if (member.active) add(this.data.staff?.[id]?.effects, (member.level || 1)*(this.data.companyVersion?this.staffEfficiency(id):1)); });
      Object.entries(this.state.unlocks.routes).forEach(([id, choice]) => add(this.data.quests[id]?.choices?.find(c => c.id === choice)?.effects));
      return out;
    }
    derived() {
      const p = this.state.player, a = p.stats, e = this._effects();
      const masterworks = (this.state.stats.masterworks || []).length;
      const balance = this.data.balance || {};
      return { qualityBonus: e.quality || 0, speedBonus: e.speed || 0,
        priceMultiplier: Math.min(2, 1 + .035 * (a.charisma - 2)) * (1 + (e.sale || 0)),
        materialPriceMultiplier: Math.max(.2, 1 - (e.materialDiscount || 0)),
        staffPriceMultiplier: Math.max(.2, 1 - Math.min(.4, .015 * (a.charisma - 2)) - (e.staffDiscount || 0)),
        queueCapacity: 3 + (e.queue || 0), stationCount: 1 + (e.lanes || 0),
        storageCapacity: 24 + 2 * Math.floor((a.strength - 2) / 3) + (e.capacity || 0),
        materialCapacity: (balance.initialMaterialCapacity || 200) + (e.materialCapacity || 0), displayCapacity: (balance.initialDisplay || 6) + (e.display || 0),
        expeditionCapacity: (balance.initialExpeditions || 3) + (e.expeditions || 0), partySize: Math.min(3, 1 + (e.partySize || 0)),
        arrivalInterval: Math.round(30000 / (1 + (e.arrival || 0))),
        levelXpRequired: Math.ceil(60 * Math.pow(p.level, 1.15)),
        legacyEligible: p.level >= 8 && this.state.stats.questsWon >= 6,
        legacyReward: 1 + Math.floor(p.level / 5) + Math.floor(this.state.stats.questsWon / 5) + Math.floor(masterworks / 3),
        masterworks, staffWagePerMinute: 0, activeStaffCount: vals(this.state.staff).filter(s => s.active).length,
        enchantStrength: 1 + .03 * (a.knowledge - 2) + (e.enchant || 0), effects: e
      };
    }
    _gates(req = {}) {
      const p = this.state.player, gates = [];
      const add = (label, current, required, source) => { if (required) gates.push({ label, current, required, met: current >= required, source }); };
      add('Smith level', p.level, req.level, 'Complete crafts');
      add('Reputation', p.reputation, req.reputation, 'Successful expeditions');
      add('Knowledge', p.stats.knowledge, req.knowledge, 'Allocate attribute points');
      add('Quarry depth', this.state.quarry.upgrades.depth || 0, req.depth, 'Upgrade quarry depth');
      Object.entries(req.stats || {}).forEach(([id, n]) => add(id, p.stats[id] || 0, n, 'Allocate attribute points'));
      Object.entries(req.upgrades || {}).forEach(([id, n]) => add(this.data.upgrades?.[id]?.name || id, this.state.upgrades[id] || 0, n, 'Shop upgrades'));
      Object.entries(req.quarryUpgrades || {}).forEach(([id, n]) => add('Quarry ' + id, this.state.quarry.upgrades[id] || 0, n, 'Quarry upgrades'));
      if (req.any && req.route) {
        const route = this.state.unlocks.routes[req.route.questId] === req.route.choiceId;
        const quest = Object.entries(req.questWins || {}).some(([id, n]) => (this.state.questWins[id] || 0) >= n);
        add('Quest victory or alternate story route', route || quest ? 1 : 0, 1, 'Complete either discovery route');
      } else {
        Object.entries(req.questWins || {}).forEach(([id, n]) => add(this.data.quests[id]?.name || id, this.state.questWins[id] || 0, n, 'Win this quest'));
        if (req.route) add('Story route', this.state.unlocks.routes[req.route.questId] === req.route.choiceId ? 1 : 0, 1, 'Choose the required story route');
      }
      (req.milestones || []).forEach(id => add(id, this.state.unlocks.milestones.includes(id) ? 1 : 0, 1, 'Complete the story milestone'));
      return gates;
    }
    _recipeKnown(recipe) {
      if (this.state.unlocks.recipes.includes(recipe.id) || this.state.player.legacy.unlockedRecipes.includes(recipe.id)) return true;
      if (recipe.tier === 1 || recipe.known) return true;
      const u = recipe.unlock || {}, checks = [];
      if (u.level) checks.push(this.state.player.level >= u.level);
      if (u.questId) checks.push((this.state.questWins[u.questId] || 0) >= (u.wins || 1));
      if (u.route) checks.push(this.state.unlocks.routes[u.route.questId] === u.route.choiceId);
      return checks.length > 0 && (u.any ? checks.some(Boolean) : checks.every(Boolean));
    }
    _refreshUnlocks() {
      vals(this.data.recipes).forEach(r => { if (this._recipeKnown(r) && !this.state.unlocks.recipes.includes(r.id)) this.state.unlocks.recipes.push(r.id); });
      vals(this.data.quests).forEach(q => { if (this._gates(q.requires).every(g => g.met) && !this.state.unlocks.quests.includes(q.id)) this.state.unlocks.quests.push(q.id); });
    }
    craftPreview(recipeId, options = {}) {
      const r = this.data.recipes[recipeId];
      if (!r) return { eligible: false, reason: 'Unknown recipe.', gates: [], inputs: {}, maxQuantity: 0 };
      const p = this.state.player, d = this.derived(), e = d.effects, prof = p.proficiency[r.classId]?.level || 0;
      const requirement = r.requires || {}, classInfo = this.data.classes[r.classId] || {};
      const stat = requirement.stat || classInfo.stat || 'precision';
      const gates = this._gates(requirement);
      gates.push({ label: stat, current: p.stats[stat], required: requirement.statValue || 2,
        met: p.stats[stat] >= (requirement.statValue || 2), source: 'Allocate attribute points' });
      const profGate = Math.max(0, (requirement.proficiency || 0) - (e.proficiencyGateReduction || 0));
      gates.push({ label: (classInfo.name || r.classId) + ' proficiency', current: prof, required: profGate, met: prof >= profGate, source: 'Craft this item class' });
      gates.push({ label: 'Recipe discovery', current: this._recipeKnown(r) ? 1 : 0, required: 1, met: this._recipeKnown(r), source: r.unlockText || 'Complete its discovery quest' });
      const quantity = options.quantity || 1;
      const inputs = {};
      Object.entries(r.inputs || {}).forEach(([id, n]) => {
        inputs[id] = n * quantity;
        gates.push({ label: this.data.materials?.[id]?.name || id, current: this.state.materials[id] || 0, required: inputs[id], met: (this.state.materials[id] || 0) >= inputs[id], source: 'Quarry or material shop' });
      });
      const quality = Math.round(clamp(18 + 2.5 * p.stats.precision + 1.5 * p.stats.knowledge + .65 * prof + d.qualityBonus
        + ((r.heavy || classInfo.heavy) ? .5 * (p.stats.strength - 2) + (e.heavyQuality || 0) : 0) - (r.difficulty || 0), 0, 100));
      const seconds = (r.baseSeconds || 30) / (1 + .07 * (p.stats.strength - 2) + .006 * prof + d.speedBonus);
      const open = Math.max(0, d.stationCount + d.queueCapacity - this.state.jobs.length);
      const maxQuantity = Math.max(0, Math.min(open, ...Object.entries(r.inputs || {}).map(([id, n]) => Math.floor((this.state.materials[id] || 0) / n))));
      const reason = gates.find(g => !g.met)?.label + ' requirement not met.';
      return { eligible: this.state.started && gates.every(g => g.met) && open >= quantity, quality, seconds,
        price: this._price(r, quality), inputs, gates, maxQuantity,
        reason: !this.state.started ? 'Create your smith first.' : gates.some(g => !g.met) ? reason : open < quantity ? 'Crafting queue is full.' : 'Ready to craft.' };
    }
    _price(recipe, quality) { return Math.max(1, Math.round((recipe.basePrice || 1) * (.75 + .004 * quality) * this.derived().priceMultiplier)); }
    itemPrice(id) { const item = this.state.inventory.find(i => i.id === id); return item ? this._price(this.data.recipes[item.recipeId], item.quality) : 0; }
    itemStats(id) { const item = this._item(id); return item ? clone(this._itemCombat(item)) : null; }
    materialPrice(id) { const material = this.data.materials?.[id]; return material && Number.isFinite(material.price) ? Math.max(1, Math.ceil(material.price * this.derived().materialPriceMultiplier)) : null; }
    materialAvailable(id) {
      const material = this.data.materials?.[id];
      if (!material || !Number.isFinite(material.price) || this._gates(material.requires).some(g => !g.met)) return false;
      if (!material.unlock || !Object.keys(material.unlock).length) return true;
      return this._recipeKnown({ id: 'material:' + id, tier: material.tier || 2, unlock: material.unlock });
    }
    staffPrice(id) { return Math.ceil((this.data.staff?.[id]?.cost || 0) * this.derived().staffPriceMultiplier); }
    upgradePreview(id) {
      const u = this.data.upgrades?.[id];
      if (!u) return { eligible: false, reason: 'Unknown upgrade.' };
      const level = this.state.upgrades[id] || 0, cost = Math.ceil(u.cost * Math.pow(u.costScale || 1.7, level));
      const gate = this._gates(u.requires).find(g => !g.met);
      return { eligible: !gate && level < (u.maxLevel || 1) && this.state.player.gold >= cost, cost, level, maxLevel: u.maxLevel || 1,
        reason: gate ? gate.label + ' requirement not met.' : level >= (u.maxLevel || 1) ? 'Maximum rank.' : this.state.player.gold < cost ? 'Not enough gold.' : 'Available.' };
    }
    _quarryData() {
      return this.data.quarry || { deposits: { bronze: { materialId: 'bronze', baseSeconds: 45, yield: 1 } }, upgrades: {}, workers: {} };
    }
    quarryDerived() {
      const q = this.state.quarry, data = this._quarryData(), deposit = data.deposits[q.activeDeposit] || vals(data.deposits)[0];
      let speed = 0, amount = deposit?.yield || 1;
      for (const [kind, store] of [['upgrades', q.upgrades], ['workers', q.workers]]) Object.entries(store).forEach(([id, rank]) => {
        const effects = data[kind]?.[id]?.effects || {};
        speed += (effects.speed || 0) * rank; amount += (effects.yield || 0) * rank;
      });
      const seconds = Math.max(3, (deposit?.baseSeconds || 45) / (1 + speed));
      const availableDeposits = vals(data.deposits).filter(d => this._gates(d.requires).every(g => g.met));
      return { yield: Math.max(1, amount), seconds, progress: clamp((this.state.simTime - q.lastYieldAt) / Math.max(1, q.nextYieldAt - q.lastYieldAt), 0, 1),
        manualReady: this.state.simTime >= q.nextManualAt, deposit: q.activeDeposit, availableDeposits, pausedReason: q.pausedReason };
    }
    quarryPreview(id, kind = 'upgrade') {
      const type = kind === 'worker' ? 'workers' : 'upgrades', definition = this._quarryData()[type]?.[id];
      if (!definition) return { eligible: false, reason: 'Unknown quarry improvement.' };
      const level = this.state.quarry[type][id] || 0, maxLevel = definition.maxLevel || 5;
      const cost = Math.ceil(definition.cost * Math.pow(definition.costScale || 1.65, level));
      const gate = this._gates(definition.requires).find(g => !g.met);
      return { eligible: !gate && level < maxLevel && this.state.player.gold >= cost, cost, level, maxLevel, effects: definition.effects,
        reason: gate ? gate.label + ' requirement not met.' : level >= maxLevel ? 'Maximum rank.' : this.state.player.gold < cost ? 'Not enough gold.' : 'Available.' };
    }
    command(name, payload) { return this.act(name, payload); }
    act(name, payload = {}) {
      const handlers = {
        create: '_create', allocate: '_allocate', craft: '_craft', technique: '_technique', cancel: '_cancel', reorder: '_reorder',
        buyMaterial: '_buyMaterial', sell: '_sell', gift: '_gift', salvage: '_salvage', protect: '_protect', display: '_display', reserve: '_reserve',
        dispatch: '_dispatch', upgrade: '_upgrade', hireStaff: '_hireStaff', toggleStaff: '_toggleStaff', decorate: '_decorate', enchant: '_enchant',
        route: '_route', retire: '_retire', talent: '_talent', automation: '_automation', reclaim: '_reclaim', claim: '_claim', respec: '_respec',
        mine: '_mine', quarryUpgrade: '_quarryUpgrade', hireQuarryWorker: '_hireQuarryWorker', quarryDeposit: '_quarryDeposit',
        sellMaterial: '_sellMaterial', acceptCommission: '_acceptCommission', fulfillCommission: '_fulfillCommission'
      };
      if (!handlers[name]) return fail('Unknown action.');
      if (!this.state.started && name !== 'create' && name !== 'talent') return fail('Create your smith first.');
      try {
        const result = this[handlers[name]](payload || {});
        if (result.ok) { this._refreshUnlocks(); this._startJobs(); this._previewCache.clear(); }
        return result;
      } catch (error) { return fail('Action could not be completed: ' + error.message); }
    }
    _create({ name, stats: allocation }) {
      if (this.state.started) return fail('This smith already exists.');
      if (!allocation || !stats.every(k => Number.isInteger(allocation[k]) && allocation[k] >= 2 && allocation[k] <= 6) || stats.reduce((a, k) => a + allocation[k], 0) !== 16) return fail('Assign exactly eight points; starting attributes range from 2 to 6.');
      this.state.shopName = String(name || 'Ember & Iron').trim().slice(0, 48) || 'Ember & Iron';
      this.state.player.stats = Object.fromEntries(stats.map(k => [k, allocation[k]]));
      const e = this._effects();
      this.state.player.stats.strength += e.startStrength || 0;
      this.state.player.gold += e.startGold || 0;
      vals(this.state.player.proficiency).forEach(p => p.level = e.startProficiency || 0);
      this.state.started = true; this.state.tutorial.stage = 1;
      this._refreshUnlocks(); this._arrive(true); this._arrive(true);
      this._log('The doors of ' + this.state.shopName + ' are open.', 'milestone');
      return okay('Your forge is ready.');
    }
    _allocate({ stat }) {
      const p = this.state.player;
      if (!stats.includes(stat) || p.points < 1) return fail('No attribute point is available.');
      if (p.stats[stat] >= 50) return fail('This attribute is at its cap.');
      p.stats[stat]++; p.points--; return okay('Increased ' + stat + '.');
    }
    _craft({ recipeId, quantity = 1 }) {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return fail('Choose a valid quantity.');
      const preview = this.craftPreview(recipeId, { quantity });
      if (!preview.eligible) return fail(preview.reason);
      Object.entries(preview.inputs).forEach(([id, n]) => this.state.materials[id] -= n);
      for (let n = 0; n < quantity; n++) this.state.jobs.push({ id: this._id('job'), recipeId, stationId: null,
        status: 'queued', inputs: clone(this.data.recipes[recipeId].inputs), startedAt: null, completeAt: null,
        duration: 0, quality: 0, technique: false, outputReserved: false, affixSeed: Math.floor(this._roll() * 4294967295) });
      this._log('Queued ' + quantity + ' × ' + this.data.recipes[recipeId].name + '; materials reserved.', 'craft');
      return okay('Materials reserved and work queued.');
    }
    _startJobs() {
      if (!this.state.started) return;
      const d = this.derived();
      let active = this.state.jobs.filter(j => j.status === 'active');
      for (const job of this.state.jobs) {
        if (job.status !== 'queued' || active.length >= d.stationCount) continue;
        if (this.state.inventory.length + active.length >= d.storageCapacity) break;
        const preview = this.craftPreview(job.recipeId);
        job.status = 'active'; job.startedAt = this.state.simTime; job.duration = Math.max(1, Math.ceil(preview.seconds * 1000));
        job.completeAt = job.startedAt + job.duration; job.quality = preview.quality; job.outputReserved = true;
        job.affixChance = this._craftAffixChance();
        if (job.technique) this._applyFinishing(job);
        if (!Number.isInteger(job.affixSeed)) job.affixSeed = Math.floor(this._roll() * 4294967295);
        job.stationId = 'forge-' + ([...Array(d.stationCount).keys()].find(n => !active.some(a => a.stationId === 'forge-' + n)) || 0);
        active.push(job);
      }
    }
    _craftAffixChance() {
      return Math.min(.55, .10 + .008 * (this.state.player.stats.precision - 2) + (this._effects().affixChance || 0));
    }
    techniquePreview(jobId) {
      const job = this.state.jobs.find(j => j.id === jobId);
      if (!job || !['active', 'queued'].includes(job.status)) return { eligible: false, reason: 'That craft is no longer pending.' };
      if (job.technique) return { eligible: false, reason: 'Quality finishing is already selected.' };
      const active = job.status === 'active', craft = active ? null : this.craftPreview(job.recipeId);
      const quality = active ? job.quality : craft.quality;
      const finishedQuality = Math.max(quality, Math.min(this.derived().qualityCap || 100, quality + 20));
      return { eligible: true, quality: finishedQuality, qualityGain: finishedQuality - quality,
        addedSeconds: active ? job.duration / 1000 : Math.max(1, Math.ceil(craft.seconds * 1000)) / 1000,
        prefixChance: Math.min(1, (active ? job.affixChance || 0 : this._craftAffixChance()) + .10) };
    }
    _applyFinishing(job) {
      // Add a whole original craft, even if almost all the normal work is complete.
      job.completeAt += job.duration; job.duration *= 2;
      job.quality = Math.max(job.quality, Math.min(this.derived().qualityCap || 100, job.quality + 20));
      job.affixChance = Math.min(1, (job.affixChance || 0) + .10);
    }
    _technique({ jobId }) {
      const preview = this.techniquePreview(jobId);
      if (!preview.eligible) return fail(preview.reason);
      const job = this.state.jobs.find(j => j.id === jobId);
      job.technique = true;
      if (job.status === 'active') this._applyFinishing(job);
      return okay('Quality finish selected: +100% crafting time, +20 quality up to the forge cap, and +10 percentage points prefix chance.');
    }
    _cancel({ jobId }) {
      const job = this.state.jobs.find(j => j.id === jobId);
      if (!job) return fail('That job is no longer pending.');
      if (!this._canDeliver(job.inputs)) return fail('Make room in materials or the mailbox before cancelling.');
      this._deliver({ materials: job.inputs, gold: 0, recipes: [], source: 'Cancelled craft refund' });
      this.state.jobs = this.state.jobs.filter(j => j.id !== jobId);
      return okay('Craft cancelled; all reserved materials returned.');
    }
    _reorder({ jobId, direction }) {
      const index = this.state.jobs.findIndex(j => j.id === jobId && j.status === 'queued');
      const target = index + (direction < 0 ? -1 : 1);
      if (index < 0 || !this.state.jobs[target] || this.state.jobs[target].status !== 'queued') return fail('Cannot move that job.');
      [this.state.jobs[index], this.state.jobs[target]] = [this.state.jobs[target], this.state.jobs[index]];
      return okay('Queue reordered.');
    }
    _buyMaterial({ materialId, quantity = 1 }) {
      const price = this.materialPrice(materialId), m = this.data.materials?.[materialId];
      if (price === null || !m || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return fail('This material cannot be purchased.');
      if (!this.materialAvailable(materialId)) return fail('This supplier is not unlocked.');
      if (this.state.player.gold < price * quantity) return fail('Not enough gold.');
      if (sum(this.state.materials) + quantity > this.derived().materialCapacity) return fail('Material storage is full.');
      this.state.player.gold -= price * quantity; this.state.materials[materialId] = (this.state.materials[materialId] || 0) + quantity;
      this._staffXp('supply', quantity); return okay('Purchased ' + quantity + ' ' + m.name + '.');
    }
    materialSalePrice(materialId, quantity = 1) { const m=this.data.materials[materialId]; return m&&Number.isFinite(m.price)&&Number.isInteger(quantity)&&quantity>0?Math.max(1,Math.floor(m.price*quantity*.5)):null; }
    _sellMaterial({ materialId, quantity = 1 }) {
      const m = this.data.materials[materialId];
      if (!m || !Number.isFinite(m.price) || !Number.isInteger(quantity) || quantity < 1 || quantity > (this.state.materials[materialId] || 0)) return fail('Choose available common materials to sell.');
      const gold = this.materialSalePrice(materialId, quantity);
      this.state.materials[materialId] -= quantity; this.state.player.gold += gold; this.state.stats.goldEarned += gold;
      return okay('Sold materials for ' + gold + ' gold; storage space is available.');
    }
    _item(id) { return this.state.inventory.find(i => i.id === id); }
    _protected(item) { return item.protected || !!item.reservedFor; }
    _townPrice(item) {
      return 1 + Object.entries(this.data.recipes[item.recipeId].inputs).reduce((total, [id, qty]) => {
        const price = this.data.materials?.[id]?.price;
        return total + (Number.isFinite(price) ? price * qty : 0);
      }, 0);
    }
    salePreview(itemId, heroId) {
      const item = this._item(itemId);
      if (!item) return { eligible: false, reason: 'Item not found.', price: 0 };
      if (!heroId) return { eligible: !this._protected(item), price: this._townPrice(item), compatible: true, improvement: 0, reason: this._protected(item) ? 'Release the protected or reserved item first.' : 'Town buyer offer.' };
      const hero = this.state.adventurers.find(h => h.id === heroId), recipe = this.data.recipes[item.recipeId];
      if (!hero) return { eligible: false, price: 0, reason: 'Customer not found.' };
      const archetype = this.data.archetypes[hero.archetypeId];
      const compatible = this.data.companyVersion?(archetype.preferences||[]).includes(recipe.classId):['body', 'ring', 'charm', 'tool'].includes(recipe.slot) || (archetype.preferences || []).includes(recipe.classId);
      const offhandBlocked = recipe.slot === 'offhand' && hero.equipment.weapon && this.data.recipes[hero.equipment.weapon.recipeId].twoHanded;
      const afterHero = clone(hero);
      afterHero.equipment[recipe.slot || 'weapon'] = item;
      if (recipe.twoHanded) afterHero.equipment.offhand = null;
      const quest = this.data.quests[hero.questId] || vals(this.data.quests)[0];
      const improvement = this._gearScore(afterHero, quest) - this._gearScore(hero, quest), price = this.itemPrice(itemId);
      const reason = !['browsing', 'ready'].includes(hero.status) ? 'This adventurer is away or recovering.' : item.protected ? 'This item is protected.' : item.reservedFor && item.reservedFor !== heroId ? 'Reserved for another customer.' : !compatible || offhandBlocked ? 'The item does not fit this loadout.' : price > hero.budget ? 'The customer cannot afford it.' : improvement <= 0 ? 'This would not improve their equipment.' : 'A useful upgrade.';
      return { eligible: reason === 'A useful upgrade.', price, compatible: compatible && !offhandBlocked, improvement, reason };
    }
    _sell({ itemId, heroId = null, dispatch = true }) {
      const preview = this.salePreview(itemId, heroId);
      if (!preview.eligible) return fail(preview.reason);
      const item = this._item(itemId);
      this.state.inventory = this.state.inventory.filter(i => i.id !== itemId);
      this.state.player.gold += preview.price; this.state.stats.goldEarned += preview.price; this.state.stats.sold++;
      if (heroId) {
        const hero = this.state.adventurers.find(h => h.id === heroId);
        this._equip(hero, item); hero.budget -= preview.price; hero.relationship++; hero.status = 'ready';
        hero.lastPurchaseAt = this.state.simTime;
        this._shopEvent('purchase', hero, { itemId, recipeId: item.recipeId, price: preview.price });
        this._relationshipMilestones(hero);
        if (dispatch) this._dispatch({ questId: hero.questId, heroIds: [hero.id] });
      }
      this._staffXp('sale', 3); this._log('Sold ' + [this.data.affixes[item.affixId]?.name,this.data.recipes[item.recipeId].name,this.data.enchantments[item.enchantmentId]?.suffix].filter(Boolean).join(' ') + ' for ' + preview.price + ' gold.', 'sale');
      return okay('Sold for ' + preview.price + ' gold.');
    }
    _equip(hero, item) {
      const recipe = this.data.recipes[item.recipeId];
      hero.equipment[recipe.slot || 'weapon'] = clone(item);
      hero.equipment[recipe.slot || 'weapon'].displayed = false;
      if (recipe.twoHanded) hero.equipment.offhand = null;
    }
    _gift({ itemId, heroId }) {
      const item = this._item(itemId), hero = this.state.adventurers.find(h => h.id === heroId);
      if (!item || !hero || !['ready', 'browsing'].includes(hero.status) || this._protected(item)) return fail('Cannot equip this item now.');
      const recipe = this.data.recipes[item.recipeId], preferences = this.data.archetypes[hero.archetypeId].preferences || [];
      if ((this.data.companyVersion||['weapon', 'offhand'].includes(recipe.slot)) && !preferences.includes(recipe.classId)) return fail('This class does not fit the adventurer.');
      if (recipe.slot === 'offhand' && hero.equipment.weapon && this.data.recipes[hero.equipment.weapon.recipeId].twoHanded) return fail('A two-handed weapon blocks the offhand.');
      this._equip(hero, item); hero.status = 'ready'; hero.relationship++;
      this.state.inventory = this.state.inventory.filter(i => i.id !== itemId);
      this._relationshipMilestones(hero);
      return okay('Equipment gifted to ' + hero.name + '.');
    }
    _salvage({ itemId }) {
      const item = this._item(itemId);
      if (!item || this._protected(item)) return fail('Release protection or reservation first.');
      const materials = {};
      Object.entries(this.data.recipes[item.recipeId].inputs).forEach(([id, qty]) => { if (this.data.materials[id]?.salvageable!==false && Number.isFinite(this.data.materials[id]?.price) && Math.floor(qty / 2)) materials[id] = Math.floor(qty / 2); });
      if (!this._canDeliver(materials)) return fail('Make room in materials or the mailbox.');
      this._deliver({ materials, gold: 0, recipes: [], source: 'Salvage' });
      this.state.inventory = this.state.inventory.filter(i => i.id !== itemId); return okay('Common materials recovered.');
    }
    _protect({ itemId }) { const i = this._item(itemId); if (!i) return fail('Item not found.'); i.protected = !i.protected; return okay(i.protected ? 'Item protected.' : 'Protection removed.'); }
    _display({ itemId }) {
      const i = this._item(itemId); if (!i) return fail('Item not found.');
      if (!i.displayed && this.state.inventory.filter(x => x.displayed).length >= this.derived().displayCapacity) return fail('Display is full.');
      i.displayed = !i.displayed; return okay(i.displayed ? 'Placed on display.' : 'Removed from display.');
    }
    _reserve({ itemId, heroId = null }) { const i = this._item(itemId); if (!i || (heroId && !this.state.adventurers.some(h => h.id === heroId))) return fail('Invalid reservation.'); i.reservedFor = heroId; return okay('Reservation updated.'); }
    _itemCombat(item) {
      if (!item) return {};
      const recipe = this.data.recipes[item.recipeId]; if (!recipe) return {};
      const e = this._effects(), scale = (.70 + .008 * item.quality) * ((item.heirloom || item.makerGeneration < this.state.player.legacy.generation) ? 1 + (e.heirloomCombat || 0) : 1);
      const out = { ...recipe.combat, resistances: { ...(recipe.combat?.resistances || {}) } };
      ['attack', 'health', 'armor'].forEach(k => out[k] = (out[k] || 0) * scale);
      out.attack *= 1 + (e.attack || 0);
      const apply = (def, strength) => {
        if (!def) return;
        const effects = def.effects || {};
        ['attack', 'armor', 'health'].forEach(k => out[k] = (out[k] || 0) * (1 + (effects[k] || 0) * strength) + (def.combat?.[k] || 0) * strength);
        ['crit', 'evasion', 'block', 'armorPen'].forEach(k => out[k] = (out[k] || 0) + (effects[k] || 0) * strength);
        if (out.interval) out.interval /= 1 + (effects.speed || 0) * strength;
        for (const [key, type] of [['fireResist', 'fire'], ['iceResist', 'ice'], ['voidResist', 'void']]) out.resistances[type] = (out.resistances[type] || 0) + (effects[key] || 0) * strength;
      };
      apply(this.data.affixes?.[item.affixId], 1);
      apply(this.data.enchantments?.[item.enchantmentId], item.enchantStrength || this.derived().enchantStrength);
      return out;
    }
    _heroStats(hero) {
      const a = this.data.archetypes[hero.archetypeId], base = a?.base || {}, level = hero.level || 1;
      const out = { id: hero.id, name: hero.name, role: a?.role || hero.archetypeId, archetypeId: hero.archetypeId,
        health: (base.health || 35) * (1 + .07 * (level - 1)), attack: (base.attack || 3) * (1 + .06 * (level - 1)),
        armor: (base.armor || 0) + .2 * (level - 1), interval: base.interval || 2.5,
        crit: base.crit || .03, evasion: base.evasion || 0, block: base.block || 0, armorPen: base.armorPen || 0,
        damageType: base.damageType || 'physical', resistances: { ...(base.resistances || {}) }, traits: [] };
      slots.forEach(slot => {
        const item = hero.equipment[slot];
        if (!item) {
          const worn = slot === 'weapon' ? this.data.starting?.wornWeapon : slot === 'body' ? this.data.starting?.wornBody : null;
          if (worn) { ['health', 'attack', 'armor'].forEach(k => out[k] += worn[k] || 0); if (slot === 'weapon' && worn.interval) out.interval = worn.interval; }
          return;
        }
        const c = this._itemCombat(item);
        ['health', 'attack', 'armor', 'crit', 'evasion', 'block', 'armorPen'].forEach(k => out[k] += c[k] || 0);
        if (slot === 'weapon' && c.interval) out.interval = c.interval;
        if (slot === 'weapon' && c.damageType) out.damageType = c.damageType;
        Object.entries(c.resistances || {}).forEach(([id, n]) => out.resistances[id] = (out.resistances[id] || 0) + n);
        out.traits.push(this.data.recipes[item.recipeId].name + ' Q' + item.quality);
      });
      const passive = typeof a?.passive === 'string' ? a.passive : hero.archetypeId, info = a?.passiveInfo || a?.passive || {};
      if (passive === 'vanguard') { out.crit += .02; out.block += .02; }
      if (passive === 'duelist') out.interval /= 1 + (info.speed || .08);
      if (passive === 'breaker') out.armorPen += info.armorPen || 1;
      if (passive === 'ranger') out.crit += info.crit || .05;
      if (passive === 'guardian') { out.guardian = true; out.protection = info.protection || .08; }
      if (passive === 'mage') { out.aoe = info.aoe || .25; out.damageType = 'arcane'; }
      ['crit', 'evasion', 'block'].forEach(k => out[k] = clamp(out[k], 0, .65));
      Object.keys(out.resistances).forEach(k => out.resistances[k] = clamp(out.resistances[k], 0, .75));
      out.interval = Math.max(.35, out.interval); out.health = Math.max(1, out.health);
      return out;
    }
    heroStats(id) { const hero = this.state.adventurers.find(h => h.id === id); return hero ? this._heroStats(hero) : null; }
    _simulate(quest, heroes, seed) {
      if(this.data.companyVersion)return (typeof module==='object'&&module.exports?require('./formation-combat.js'):globalThis.EIFormation).simulate(this,quest,heroes,seed);
      const rng = random(seed), party = heroes.map(h => ({ ...this._heroStats(h), hp: 0, next: 0 }));
      const roles = new Set(party.map(h => h.role));
      const synergy = party.length > 1 && roles.size === party.length ? 1 + (this._effects().partySynergy || .1) : 1;
      party.forEach(h => { h.attack *= synergy; h.hp = h.health; h.next = h.interval * 1000; });
      const enemies = (quest.enemies || []).map((enemy, index) => ({ ...clone(enemy), id: enemy.id || 'enemy-' + index,
        health: enemy.health || 30, hp: enemy.health || 30, interval: enemy.interval || 2.5, next: (enemy.interval || 2.5) * 1000, phase: false }));
      const initialHeroes = clone(party), initialEnemies = clone(enemies), events = [];
      const snapshot = () => ({ heroes: party.map(h => ({ id: h.id, name: h.name, hp: Math.max(0, h.hp), maxHp: h.health })),
        enemies: enemies.map(h => ({ id: h.id, name: h.name, hp: Math.max(0, h.hp), maxHp: h.health })) });
      let at = 0, attacks = 0;
      const push = event => { if (events.length < 800) events.push({ ...event, ...snapshot() }); };
      while (party.some(h => h.hp > 0) && enemies.some(e => e.hp > 0) && attacks++ < 1500) {
        const choices = [...party.filter(h => h.hp > 0).map(h => ({ entity: h, hero: true })), ...enemies.filter(e => e.hp > 0).map(e => ({ entity: e, hero: false }))];
        choices.sort((a, b) => a.entity.next - b.entity.next || Number(b.hero) - Number(a.hero) || a.entity.id.localeCompare(b.entity.id));
        const next = choices[0], actor = next.entity; at = actor.next;
        if (at > 120000) break;
        let targets;
        if (next.hero) targets = enemies.filter(e => e.hp > 0);
        else {
          const living = party.filter(h => h.hp > 0), weighted = living.flatMap(h => Array(h.guardian ? 3 : h.archetypeId === 'vanguard' ? 2 : 1).fill(h));
          targets = [weighted[Math.floor(rng() * weighted.length)]];
        }
        const target = targets[0];
        const dodged = rng() < (target.evasion || 0), critical = rng() < (actor.crit || 0), blocked = rng() < (target.block || 0);
        const phaseBoost = actor.phase ? 1 + (actor.phaseAttack || .25) : 1;
        const damageType = actor.damageType || 'physical';
        const armor = Math.max(0, (target.armor || 0) - (actor.armorPen || 0));
        const guardian = !next.hero ? 1 - Math.max(0, ...party.filter(h => h.hp > 0 && h.guardian).map(h => h.protection || .08)) : 1;
        const raw = (actor.attack || 1) * (.9 + rng() * .2) * (critical ? 1.5 : 1) * phaseBoost;
        const damage = dodged ? 0 : Math.max(1, (raw - armor) * (1 - (target.resistances?.[damageType] || 0)) * (blocked ? .5 : 1) * guardian);
        target.hp = Math.max(0, target.hp - damage);
        if (next.hero && actor.aoe) targets.slice(1).forEach(t => { t.hp = Math.max(0, t.hp - damage * actor.aoe); });
        push({ at, actorId: actor.id, targetId: target.id, type: 'attack', damage, critical, blocked, dodged,
          text: actor.name + (dodged ? ' misses ' : ' hits ') + target.name + (dodged ? '.' : ' for ' + Math.round(damage) + (critical ? ' (critical)' : '') + (blocked ? ' (blocked)' : '') + '.') });
        enemies.forEach(enemy => {
          if (enemy.hp > 0 && !enemy.phase && (quest.boss || enemy.phaseAt) && enemy.hp <= enemy.health * (enemy.phaseAt || .5)) {
            enemy.phase = true; push({ at, type: 'phase', actorId: enemy.id, text: enemy.name + ' enters its second phase; attacks grow stronger.' });
          }
        });
        actor.next += actor.interval * 1000 * (actor.phase && actor.phaseSpeed ? Math.max(.4, 1 - actor.phaseSpeed) : 1);
      }
      const victory = enemies.every(e => e.hp <= 0) && party.some(h => h.hp > 0);
      push({ at: Math.min(at, 120000), type: 'outcome', text: victory ? 'Victory. The party begins the journey home.' : 'Retreat. The survivors need rest and better equipment.' });
      return { victory, events, duration: Math.min(120000, Math.max(1, at)), heroStats: initialHeroes, enemyStats: initialEnemies,
        survivors: party.filter(h => h.hp > 0).length, finalHeroes: snapshot().heroes, finalEnemies: snapshot().enemies };
    }
    _gearScore(hero, quest) {
      const h = this._heroStats(hero), enemies = quest.enemies || [];
      const dps = enemies.reduce((v, e) => v + Math.max(1, h.attack * (1 + .5 * h.crit) - Math.max(0, (e.armor || 0) - h.armorPen)) / h.interval, 0) / Math.max(1, enemies.length);
      const raw = enemies.reduce((v, e) => v + (e.attack || 1) / (e.interval || 2.5), 0);
      const mitigated = enemies.reduce((v, e) => v + Math.max(1, (e.attack || 1) - h.armor) * (1 - (h.resistances[e.damageType || 'physical'] || 0)) * (1 - h.evasion) * (1 - .5 * h.block) / (e.interval || 2.5), 0);
      return 10 * dps + h.health / Math.max(.25, raw ? mitigated / raw : 1);
    }
    _gearRatio(quest, heroes) {
      let actual = 0, benchmark = 0;
      heroes.forEach(hero => {
        actual += this._gearScore(hero, quest);
        const baseHero = clone(hero); baseHero.equipment = Object.fromEntries(slots.map(s => [s, null]));
        const tier = quest.benchmarkTier || Math.max(1, (quest.tier || 1) - 1), preferences = this.data.archetypes[hero.archetypeId].preferences || [];
        for (const slot of ['weapon', 'body']) {
          const r = vals(this.data.recipes).find(r => r.tier === tier && r.slot === slot && ((slot === 'body'&&!this.data.companyVersion) || preferences.includes(r.classId)));
          if (r) baseHero.equipment[slot] = { recipeId: r.id, quality: quest.benchmarkQuality || 40, makerGeneration: this.state.player.legacy.generation };
        }
        benchmark += this._gearScore(baseHero, quest);
      });
      return actual / Math.max(1, benchmark);
    }
    questPreview(questId, heroIds = []) {
      const q = this.data.quests?.[questId], heroes = heroIds.map(id => this.state.adventurers.find(h => h.id === id)).filter(Boolean);
      if (!q) return { eligible: false, reason: 'Unknown quest.', gates: [], successEstimate: 0, partyStats: [] };
      const gates = this._gates(q.requires), min = q.minPartySize || q.requires?.partySize || 1, max = q.manualBoss?3:this.derived().partySize;
      gates.push({ label: 'Party size', current: heroes.length, required: min, met: heroes.length >= min && heroes.length <= max, source: 'Guild Hall expands party size' });
      const available = heroes.length === heroIds.length && new Set(heroIds).size === heroIds.length && heroes.every(h => ['browsing', 'ready'].includes(h.status));
      gates.push({ label: 'Adventurers ready', current: Number(available), required: 1, met: available, source: 'Wait for return and recovery' });
      const capacity = this.state.runs.filter(r => !['complete'].includes(r.status)).length < this.derived().expeditionCapacity;
      gates.push({ label: 'Expedition slot', current: Number(capacity), required: 1, met: capacity, source: 'Wait for a returning expedition' });
      let successEstimate = 0, gearRatio = 0;
      if (heroes.length) {
        const key = JSON.stringify([q.id, this.data.companyVersion?Math.min(q.masteryTarget||5,this.state.questWins[q.id]||0):0, heroes.map(h => [h.id, h.level, h.equipment]), this._effects()]);
        if (this._previewCache.has(key)) ({ successEstimate, gearRatio } = this._previewCache.get(key));
        else {
          for (let n = 1; n <= 20; n++) if (this._simulate(q, heroes, n * 2654435761 >>> 0).victory) successEstimate += 5;
          gearRatio = this._gearRatio(q, heroes);
          this._previewCache.set(key, { successEstimate, gearRatio });
          if (this._previewCache.size > 600) this._previewCache.delete(this._previewCache.keys().next().value);
        }
      }
      return { eligible: this.state.started && gates.every(g => g.met), gates, successEstimate, gearRatio,
        wellEquipped: gearRatio >= 1.25, partyStats: heroes.map(h => this._heroStats(h)), reason: gates.find(g => !g.met)?.label + ' requirement not met.' };
    }
    _dispatch({ questId, heroIds }) {
      if (!Array.isArray(heroIds)) return fail('Choose an adventurer or party.');
      const preview = this.questPreview(questId, heroIds); if (!preview.eligible) return fail(preview.reason);
      const heroes = heroIds.map(id => this.state.adventurers.find(h => h.id === id)), q = this.data.quests[questId];
      const seed = Math.floor(this._roll() * 4294967295), result = this._simulate(q, heroes, seed);
      const duration = Math.max(1000, Math.round((q.baseSeconds || 90) * 1000)), startAt = this.state.simTime;
      const run = { id: this._id('run'), questId, heroIds: [...heroIds], seed, startAt, battleAt: startAt + duration * .2,
        battleEndAt: startAt + duration * .8, returnAt: startAt + duration, status: 'travelling', result,
        reward: null, rewardApplied: false, wellEquipped: preview.wellEquipped, gearRatio: preview.gearRatio,
        charisma: this.state.player.stats.charisma, heroSnapshots: clone(heroes) };
      this.state.runs.push(run);
      heroes.forEach(h => { h.status = 'travelling'; h.runId = run.id; h.questId = questId; h.departAt = startAt; h.shoppingReason = 'Adventuring'; });
      this._shopEvent('depart', heroes[0], { heroIds: [...heroIds], questId, runId: run.id });
      this._log(heroes.map(h => h.name).join(', ') + ' departed for ' + q.name + '.', 'quest');
      return okay('Expedition departed.', { runId: run.id });
    }
    battleView(runId, elapsedMs) {
      const run = this.state.runs.find(r => r.id === runId); if (!run) return null;
      const now = elapsedMs == null ? this.state.simTime : run.startAt + elapsedMs;
      const progress = clamp((now - run.battleAt) / Math.max(1, run.battleEndAt - run.battleAt), 0, 1);
      const events = run.result.events.filter(e => e.at <= run.result.duration * progress && now >= run.battleAt);
      const last = events[events.length - 1];
      return { id: run.id, questId: run.questId, status: run.status, progress, round:last?.round||1,rounds:run.result.rounds||1,
        heroes: last?.heroes || run.result.heroStats.map(h => ({ id: h.id, name: h.name, hp: h.health, maxHp: h.health, line:h.line||'front' })),
        enemies: last?.enemies || run.result.enemyStats.map(h => ({ id: h.id, name: h.name, hp: h.health, maxHp: h.health, line:h.line||'front' })),
        events: clone(events), victory: progress >= 1 ? run.result.victory : null, returnIn: Math.max(0, run.returnAt - now) };
    }
    _upgrade({ upgradeId }) {
      const p = this.upgradePreview(upgradeId); if (!p.eligible) return fail(p.reason);
      this.state.player.gold -= p.cost; this.state.upgrades[upgradeId] = p.level + 1;
      this._log(this.data.upgrades[upgradeId].name + ' upgraded to rank ' + (p.level + 1) + '.', 'upgrade');
      return okay('Shop upgrade installed.');
    }
    _hireStaff({ staffId }) {
      const staff = this.data.staff?.[staffId], price = this.staffPrice(staffId);
      if (!staff || this.state.staff[staffId]) return fail('That staff member is unavailable or already hired.');
      const gate = this._gates(staff.requires).find(g => !g.met); if (gate) return fail(gate.label + ' requirement not met.');
      if (this.state.player.gold < price) return fail('Not enough gold.');
      this.state.player.gold -= price; this.state.staff[staffId] = { hired: true, active: true, level: 1, xp: 0, unpaid: false };
      return okay(staff.name + ' hired. No recurring wages.');
    }
    _toggleStaff({ staffId }) { const staff = this.state.staff[staffId]; if (!staff) return fail('Hire this staff member first.'); staff.active = !staff.active; return okay(staff.active ? 'Staff assigned.' : 'Staff resting.'); }
    _staffXp(work, amount) {
      Object.entries(this.state.staff).forEach(([id, staff]) => {
        if (!staff.active || this.data.staff[id]?.work !== work || staff.level >= 5) return;
        staff.xp += amount;
        while (staff.level < 5 && staff.xp >= 30 * staff.level) { staff.xp -= 30 * staff.level; staff.level++; this._log(this.data.staff[id].name + ' reached staff level ' + staff.level + '.', 'level'); }
      });
    }
    _relationshipMilestones(hero) {
      hero.relationshipMilestones = hero.relationshipMilestones || [];
      this.state.commissions = this.state.commissions || [];
      const templates = vals(this.data.commissions).length ? vals(this.data.commissions) : [
        { id: 'named_order', name: 'A Trusted Commission', relationship: 5, minTier: 1, minQuality: 50, premium: 1.5, bonusGold: 3, rewardMaterials: { leather: 1 }, smithXp: 12 },
        { id: 'veteran_order', name: 'Veteran Equipment', relationship: 15, minTier: 2, minQuality: 70, premium: 1.75, bonusGold: 8, rewardMaterials: { gem: 1 }, smithXp: 24 },
        { id: 'masterwork_order', name: 'A Signature Masterwork', relationship: 30, minTier: 3, minQuality: 85, premium: 2, bonusGold: 15, rewardMaterials: { gem: 2 }, smithXp: 40 }
      ];
      for (const threshold of [5, 15, 30]) {
        if (hero.relationship < threshold || hero.relationshipMilestones.includes(threshold)) continue;
        const gift = { materials: threshold === 5 ? { leather: 1, wood: 1 } : { gem: threshold === 15 ? 1 : 2 }, gold: 0, recipes: [], source: hero.name + ' relationship milestone' };
        if (threshold === 30) {
          const maxTier = Math.max(1, ...vals(this.data.quests).filter(q => !q.manualBoss && this._gates(q.requires).every(g => g.met)).map(q => q.tier || 1));
          const discovery = vals(this.data.recipes).find(r => !this._recipeKnown(r) && r.tier <= Math.min(5, maxTier + 1));
          if (discovery) gift.recipes.push(discovery.id);
        }
        if (!this._deliver(gift)) continue;
        hero.relationshipMilestones.push(threshold);
        for (const template of templates.filter(t => t.relationship === threshold)) {
          if (this.state.commissions.some(c => c.heroId === hero.id && c.templateId === template.id)) continue;
          const archetype = this.data.archetypes[hero.archetypeId], classId = archetype.preferences.find(id => this.data.classes[id]?.slot === 'weapon') || archetype.preferences[0];
          this.state.commissions.push({ id: this._id('commission'), templateId: template.id, name: template.name,
            heroId: hero.id, classId, minTier: template.minTier, minQuality: template.minQuality,
            premium: template.premium || 1.5, bonusGold: template.bonusGold || 0,
            rewardMaterials: clone(template.rewardMaterials || {}), smithXp: template.smithXp || 12,
            status: 'offered', createdAt: this.state.simTime, completedAt: null });
        }
        this._log(hero.name + ' reached relationship ' + threshold + ' and sent a gift with a named commission.', 'relationship');
      }
    }
    commissionPreview(commissionId, itemId) {
      const c = this.state.commissions?.find(c => c.id === commissionId);
      if (!c) return { eligible: false, reason: 'Commission not found.', items: [], payment: 0, candidateItemId: null };
      const hero = this.state.adventurers.find(h => h.id === c.heroId);
      const items = this.state.inventory.filter(item => {
        const recipe = this.data.recipes[item.recipeId];
        return recipe.classId === c.classId && recipe.tier >= c.minTier && item.quality >= c.minQuality && !item.protected && (!item.reservedFor || item.reservedFor === c.heroId);
      });
      const item = itemId ? items.find(i => i.id === itemId) : items[0];
      const payment = item ? Math.round(this.itemPrice(item.id) * c.premium) + c.bonusGold : 0;
      const reason = c.status === 'complete' ? 'Commission already fulfilled.' : c.status !== 'accepted' ? 'Accept this commission first.' : !hero || !['browsing', 'ready', 'idle'].includes(hero.status) ? 'Wait until the adventurer is home and recovered.' : !item ? 'Supply the required class, tier and quality.' : !this._canDeliver(c.rewardMaterials) ? 'Make room for the commission reward.' : 'Ready to deliver.';
      return { eligible: reason === 'Ready to deliver.', reason, payment, candidateItemId: item?.id || null, items: clone(items) };
    }
    _acceptCommission({ commissionId }) {
      const c = this.state.commissions?.find(c => c.id === commissionId);
      if (!c || c.status !== 'offered') return fail('This commission is unavailable or already accepted.');
      c.status = 'accepted'; return okay('Commission accepted. Deliver matching work when ready.');
    }
    _fulfillCommission({ commissionId, itemId }) {
      const preview = this.commissionPreview(commissionId, itemId); if (!preview.eligible) return fail(preview.reason);
      const c = this.state.commissions.find(c => c.id === commissionId), item = this._item(preview.candidateItemId);
      const hero = this.state.adventurers.find(h => h.id === c.heroId);
      const improvesEquipment = this.salePreview(item.id, hero.id).improvement > 0;
      this._deliver({ gold: preview.payment, materials: c.rewardMaterials, recipes: [], source: c.name });
      if (improvesEquipment) this._equip(hero, item);
      hero.status = 'ready'; hero.relationship += 2;
      this.state.inventory = this.state.inventory.filter(i => i.id !== item.id);
      c.status = 'complete'; c.completedAt = this.state.simTime;
      this.state.stats.sold++; this.state.player.xp += c.smithXp;
      while ((this.data.overhaul || this.state.player.level < 50) && this.state.player.xp >= Math.ceil(60 * Math.pow(this.state.player.level, 1.15))) {
        this.state.player.xp -= Math.ceil(60 * Math.pow(this.state.player.level, 1.15)); this.state.player.level++; this.state.player.points += this.data.overhaul ? 5 : 3;
        if (this.state.player.level === 5) this.state.player.respecTokens++;
      }
      this._relationshipMilestones(hero); this._staffXp('sale', 6);
      hero.lastPurchaseAt = this.state.simTime;
      this._shopEvent('commission', hero, { itemId: item.id, recipeId: item.recipeId, price: preview.payment, commissionId: c.id });
      this._log(hero.name + ' accepted ' + c.name + ' · ' + preview.payment + ' gold.', 'commission');
      return okay('Commission fulfilled for ' + preview.payment + ' gold.');
    }
    decorationLevel(id) { return this.state.decorations.includes(id) ? this.state.decorationLevels?.[id] || 1 : 0; }
    decorationPreview(decorId) {
      const decor = this.data.decor?.[decorId];
      if (!decor) return { eligible:false, reason:'Unknown furnishing.', level:0, maxLevel:0, cost:0 };
      const level=this.decorationLevel(decorId),maxLevel=decor.maxLevel||1,cost=Math.ceil(decor.cost*Math.pow(decor.costScale||2.4,level));
      return {level,maxLevel,cost,eligible:this.state.started&&level<maxLevel&&this.state.player.gold>=cost,
        reason:level>=maxLevel?'Fully furnished.':this.state.player.gold<cost?'Not enough gold.':'Available.'};
    }
    _decorate({ decorId }) {
      const v=this.decorationPreview(decorId);if(!v.eligible)return fail(v.reason);
      this.state.player.gold-=v.cost;
      if(!v.level)this.state.decorations.push(decorId);
      this.state.decorationLevels=this.state.decorationLevels||{};
      this.state.decorationLevels[decorId]=v.level+1;
      return okay(this.data.decor[decorId].name+' is now level '+(v.level+1)+'. Its bonuses survive Legacy.');
    }
    enchantPreview(itemId, enchantmentId) {
      const item = this._item(itemId), enchantment = this.data.enchantments?.[enchantmentId];
      if (!item || !enchantment) return { eligible: false, reason: 'Choose an item and enchantment.' };
      const gates = this._gates(enchantment.requires), cost = enchantment.cost || 0;
      if (enchantment.slots?.length && !enchantment.slots.includes(this.data.recipes[item.recipeId].slot)) return { eligible: false, reason: 'This enchantment does not fit this item slot.', cost, inputs: enchantment.inputs || {}, gates };
      const enough = Object.entries(enchantment.inputs || {}).every(([id, n]) => (this.state.materials[id] || 0) >= n);
      const reason = this._protected(item) ? 'Release protection first.' : item.enchantmentId === enchantmentId ? 'This enchantment is already applied.' : gates.some(g => !g.met) ? gates.find(g => !g.met).label + ' requirement not met.' : !enough ? 'Enchanting materials are missing.' : this.state.player.gold < cost ? 'Not enough gold.' : 'Ready to enchant.';
      return { eligible: reason === 'Ready to enchant.', reason, cost, inputs: enchantment.inputs || {}, strength: this.derived().enchantStrength, gates };
    }
    _enchant({ itemId, enchantmentId }) {
      const p = this.enchantPreview(itemId, enchantmentId); if (!p.eligible) return fail(p.reason);
      Object.entries(p.inputs).forEach(([id, n]) => this.state.materials[id] -= n); this.state.player.gold -= p.cost;
      const item = this._item(itemId); item.enchantmentId = enchantmentId; item.enchantStrength = p.strength;
      this._staffXp('enchant', 10); return okay('Enchantment applied. Knowledge and runic bonuses are captured in its strength.');
    }
    _route({ questId, choiceId }) {
      const quest = this.data.quests[questId], choice = quest?.choices?.find(c => c.id === choiceId);
      if (!choice || !(this.state.questWins[questId] > 0)) return fail('Win this story quest before choosing a route.');
      if (this.state.unlocks.routes[questId]) return fail('This route is already chosen for this generation.');
      const reward = { gold: choice.rewards?.gold || 0, materials: choice.rewards?.materials || {}, recipes: choice.unlockRecipes || choice.unlocks || [], source: choice.name };
      if (!this._canDeliver(reward.materials)) return fail('Make space for the route reward.');
      this.state.unlocks.routes[questId] = choiceId; this._deliver(reward);
      this._refreshUnlocks(); this._previewCache.clear();
      this._log('Story choice: ' + choice.name + '.', 'story'); return okay('Your choice changes this generation.');
    }
    talentPreview(talentId) {
      const t = this.data.talents?.[talentId], p = this.state.player;
      if (!t) return { eligible: false, reason: 'Unknown talent.' };
      const requirements = Array.isArray(t.requires) ? t.requires : t.prerequisite ? [t.prerequisite] : [];
      const reason = p.legacy.generation < 2 ? 'Retire once to unlock the legacy tree.' : p.talents.includes(talentId) ? 'Already learned.' : requirements.some(id => !p.talents.includes(id)) ? 'Learn the previous talent first.' : p.legacy.points < t.cost ? 'Not enough legacy sparks.' : 'Available.';
      return { eligible: reason === 'Available.', reason, cost: t.cost, owned: p.talents.includes(talentId) };
    }
    _talent({ talentId }) {
      const p = this.talentPreview(talentId); if (!p.eligible) return fail(p.reason);
      this.state.player.legacy.points -= p.cost; this.state.player.talents.push(talentId);
      return okay('Legacy talent learned. Starting bonuses apply to your next smith creation.');
    }
    retirementPreview() {
      const d = this.derived(); return { eligible: d.legacyEligible, sparks: d.legacyReward,
        heirlooms: clone(this.state.inventory), retained: ['Legacy sparks and talents', 'Collection records', 'Decorations', 'One heirloom and its recipe discovery'],
        reset: ['Smith level, stats and proficiency', 'Gold and materials', 'Quarry and shop upgrades', 'Staff and adventurers', 'Quests and recipe discoveries'] };
    }
    _retire({ heirloomItemId = null, confirmed }) {
      if (confirmed !== true) return fail('Confirm the retirement preview before retiring.');
      const d = this.derived(); if (!d.legacyEligible) return fail(this.data.campaignVersion?'Defeat the tier 5 Void Sovereign to unlock Legacy retirement.':'Retirement requires smith level 8 and six victories.');
      const item = heirloomItemId ? this._item(heirloomItemId) : null;
      if (heirloomItemId && !item) return fail('Choose an heirloom currently in your inventory.');
      const previous = this.state, next = this._fresh();
      next.shopName = previous.shopName; next.rngState = previous.rngState; next.nextId = previous.nextId;
      next.player.talents = [...previous.player.talents]; next.decorations = [...previous.decorations]; next.decorationLevels = Object.fromEntries(previous.decorations.map(id => [id, this.decorationLevel(id)]));
      next.player.legacy = { ...clone(previous.player.legacy), generation: previous.player.legacy.generation + 1,
        points: previous.player.legacy.points + d.legacyReward, totalPoints: previous.player.legacy.totalPoints + d.legacyReward,
        heirlooms: item ? [item.id] : [], unlockedRecipes: item ? [item.recipeId] : [] };
      if (item) next.inventory = [{ ...clone(item), heirloom: true, protected: true, displayed: false, reservedFor: null }];
      this.state = next; this._log('A new generation inherits ' + d.legacyReward + ' legacy sparks.', 'legacy');
      return okay('A new smith can now take up the hammer.', { sparks: d.legacyReward });
    }
    _automation(settings) {
      if (!this._effects().automation && !this.state.staff.quartermaster) return fail('Unlock shop automation first.');
      const current = { ...this.state.automation };
      for (const key of ['enabled', 'autoBuy', 'autoSell', 'autoDispatch', 'allowRare']) if (key in settings) current[key] = !!settings[key];
      if ('recipeId' in settings) { if (settings.recipeId && !this.data.recipes[settings.recipeId]) return fail('Unknown recipe.'); current.recipeId = settings.recipeId || null; }
      for (const key of ['targetStock', 'goldReserve', 'spendCap']) if (key in settings) { if (!integer(settings[key]) || settings[key] > 1000000) return fail('Use valid nonnegative automation limits.'); current[key] = settings[key]; }
      this.state.automation = current; return okay('Automation policy saved.');
    }
    _respec() {
      if (this.state.jobs.length) return fail('Empty the craft queue before respeccing.');
      const p = this.state.player, free = this.state.stats.crafted === 0 || p.respecTokens > 0;
      if (!free && p.gold < 200) return fail('A respec costs 200 gold.');
      if (!free) p.gold -= 200; else if (this.state.stats.crafted && p.respecTokens) p.respecTokens--;
      p.stats = { strength: 2 + (this._effects().startStrength || 0), precision: 2, charisma: 2, knowledge: 2 };
      p.points = 8 + 3 * (p.level - 1); return okay('Attribute points refunded. Learned recipes and proficiency remain.');
    }
    _reclaim() {
      if (this.state.inventory.length || this.state.jobs.length) return fail('Use or sell existing work before requesting a rescue bundle.');
      const basics = vals(this.data.recipes).filter(r => r.tier === 1), candidates = basics.map(r => ({ r,
        cost: Object.entries(r.inputs).reduce((cost, [id, n]) => cost + Math.max(0, n - (this.state.materials[id] || 0)) * (this.materialPrice(id) || 99999), 0) }));
      if (candidates.some(c => c.cost <= this.state.player.gold)) return fail('You can afford a basic craft; use your supplies or the quarry.');
      const chosen = candidates.sort((a, b) => a.cost - b.cost)[0]; if (!chosen) return fail('No rescue recipe available.');
      const rescue = {};
      for (const id of ['wood', 'leather']) if ((chosen.r.inputs[id] || 0) > (this.state.materials[id] || 0)) rescue[id] = chosen.r.inputs[id] - (this.state.materials[id] || 0);
      if (!Object.keys(rescue).length) return fail('Mine bronze or fuel in the quarry to continue.');
      if (sum(this.state.materials) + sum(rescue) > this.derived().materialCapacity) return fail('Material storage is full.');
      Object.entries(rescue).forEach(([id, n]) => this.state.materials[id] = (this.state.materials[id] || 0) + n);
      return okay('Reclaimed fittings supplied for one basic craft. Mine its metal and fuel.');
    }
    _mine({ materialId = 'bronze' }) {
      if (!['bronze', 'fuel'].includes(materialId)) return fail('Hand gathering produces bronze or fuel.');
      if (this.state.simTime < this.state.quarry.nextManualAt) return fail('Hand gathering is ready every five seconds.');
      if (sum(this.state.materials) >= this.derived().materialCapacity) return fail('Material storage is full.');
      this.state.materials[materialId] = (this.state.materials[materialId] || 0) + 1;
      this.state.quarry.nextManualAt = this.state.simTime + 5000; return okay('Gathered one ' + materialId + '.');
    }
    _quarryUpgrade({ upgradeId }) { return this._improveQuarry(upgradeId, 'upgrade'); }
    _hireQuarryWorker({ workerId }) { return this._improveQuarry(workerId, 'worker'); }
    _improveQuarry(id, kind) {
      const p = this.quarryPreview(id, kind); if (!p.eligible) return fail(p.reason);
      const key = kind === 'worker' ? 'workers' : 'upgrades'; this.state.player.gold -= p.cost;
      this.state.quarry[key][id] = p.level + 1;
      return okay(kind === 'worker' ? 'Quarry worker hired. Production has no upkeep cost.' : 'Quarry upgraded.');
    }
    _quarryDeposit({ materialId }) {
      const deposit = this._quarryData().deposits[materialId];
      if (!deposit || this._gates(deposit.requires).some(g => !g.met)) return fail('This deposit is not unlocked.');
      const q = this.state.quarry; q.activeDeposit = materialId; q.lastYieldAt = this.state.simTime;
      q.nextYieldAt = this.state.simTime + Math.ceil(this.quarryDerived().seconds * 1000); q.progress = 0;
      return okay('Quarry production changed to ' + (deposit.name || materialId) + '.');
    }
    _completeJob(job) {
      const r = this.data.recipes[job.recipeId], p = this.state.player, e = this._effects();
      const candidates = vals(this.data.affixes).filter(a => (a.minTier || 1) <= r.tier && (!a.classes?.length || a.classes.includes(r.classId)) && (!a.slots?.length || a.slots.includes(r.slot)));
      const chance = job.affixChance || 0, rng = random(job.affixSeed || 1);
      const affixId = candidates.length && rng() < chance ? candidates[Math.floor(rng() * candidates.length)].id : null;
      const item = { id: this._id('item'), recipeId: r.id, quality: job.quality, affixId, enchantmentId: null,
        createdAt: this.state.simTime, displayed: !this.data.campaignVersion && this.state.inventory.filter(i => i.displayed).length < this.derived().displayCapacity,
        protected: false, reservedFor: null, makerGeneration: p.legacy.generation };
      this.state.inventory.push(item); this.state.jobs = this.state.jobs.filter(j => j.id !== job.id);
      this.state.stats.crafted++; this.state.tutorial.stage = Math.max(2, this.state.tutorial.stage);
      p.legacy.collection[r.id] = Math.max(p.legacy.collection[r.id] || 0, item.quality);
      if (item.quality >= (this.data.qualityThresholds?.masterwork||85)) { this.state.stats.masterworks = this.state.stats.masterworks || []; if (!this.state.stats.masterworks.includes(r.id)) this.state.stats.masterworks.push(r.id); }
      p.xp += r.smithXp || 12 * r.tier;
      while ((this.data.overhaul || p.level < 50) && p.xp >= Math.ceil(60 * Math.pow(p.level, 1.15))) {
        p.xp -= Math.ceil(60 * Math.pow(p.level, 1.15)); p.level++; p.points += this.data.overhaul ? 5 : 3;
        if (p.level === 5) p.respecTokens++;
        this._log('Smith level ' + p.level + ': ' + (this.data.overhaul ? 'five' : 'three') + ' attribute points gained.', 'level');
      }
      const proficiency = p.proficiency[r.classId];
      if (proficiency) {
        const trivial = proficiency.level >= 25 && r.tier === 1 ? .25 : 1;
        proficiency.xp += (r.classXp || 8 * r.tier) * (1 + .06 * (p.stats.knowledge - 2) + (e.proficiencyXp || 0)) * trivial;
        while (proficiency.level < 100 && proficiency.xp >= 6 + 2 * proficiency.level) { proficiency.xp -= 6 + 2 * proficiency.level; proficiency.level++; }
      }
      this._staffXp('craft', r.tier * 3); this._refreshUnlocks();
      this._log('Forged ' + r.name + ' · quality ' + item.quality + (affixId ? ' · ' + this.data.affixes[affixId].name : '') + '.', 'craft');
    }
    _arrive(force = false) {
      if (!force && this.state.adventurers.filter(h => ['browsing', 'ready'].includes(h.status)).length >= 3) return;
      const definitions = this.data.heroes?.length ? this.data.heroes : vals(this.data.archetypes).map((a, i) => ({ id: 'hero-' + i, name: a.name + ' traveler', archetypeId: a.id }));
      const candidates = definitions.filter(def => !this.state.adventurers.some(h => h.id === def.id && h.status !== 'idle'));
      if (!candidates.length) return;
      const weights = candidates.map(def => {
        const pref = this.data.archetypes[def.archetypeId]?.preferences || [];
        const count = pref.reduce((total, classId) => total + Math.min(3, this.state.inventory.filter(i => i.displayed && !i.protected && !i.reservedFor && this.data.recipes[i.recipeId].classId === classId).length), 0);
        return 1 + count * 2;
      });
      let definition = candidates[0];
      if (!force) { let pick = this._roll() * sum(weights); for (let n = 0; n < candidates.length; n++) { pick -= weights[n]; if (pick <= 0) { definition = candidates[n]; break; } } }
      let hero = this.state.adventurers.find(h => h.id === definition.id);
      if (!hero) {
        hero = { id: definition.id, name: definition.name, archetypeId: definition.archetypeId, level: 1, xp: 0, status: 'browsing', budget: 0,
          relationship: 0, questId: null, equipment: Object.fromEntries(slots.map(s => [s, null])), arrivedAt: this.state.simTime,
          leaveAt: 0, recoverUntil: 0, runId: null, failures: 0, memories: [] };
        this.state.adventurers.push(hero);
      }
      const available = vals(this.data.quests).filter(q => (q.minPartySize || q.requires?.partySize || 1) <= this.derived().partySize && this._gates(q.requires).every(g => g.met));
      const repeatFailed = hero.memories?.[0] && !hero.memories[0].victory;
      const quest = (repeatFailed ? available.find(q => q.id === hero.questId) : null) || available[force ? 0 : Math.floor(this._roll() * available.length)];
      hero.questId = quest?.id || vals(this.data.quests)[0]?.id;
      this._beginBrowsing(hero, repeatFailed ? 'Looking for an upgrade before retrying' : 'Looking for useful equipment');
      this._log(hero.name + ' is browsing for ' + (quest?.name || 'a new adventure') + '.', 'customer');
    }
    _beginBrowsing(hero, reason, eventType = 'arrive') {
      const now = this.state.simTime;
      hero.status = 'browsing'; hero.arrivedAt = now;
      hero.browseUntil = now + 45000 + 6000 * (this.state.player.stats.charisma - 2);
      hero.leaveAt = hero.browseUntil; hero.nextShopAt = now + 4000;
      hero.lastPurchaseAt = hero.lastPurchaseAt ?? null; hero.departAt = hero.departAt ?? null;
      hero.shoppingReason = reason;
      hero.budget = this._heroBudget(this.data.quests[hero.questId]);
      this._shopEvent(eventType, hero, { questId: hero.questId });
    }
    _npcShop(hero) {
      this._relationshipMilestones(hero);
      const commissions = this.state.commissions.filter(c => c.heroId === hero.id && c.status !== 'complete');
      for (const commission of commissions) if (commission.status === 'offered') this._acceptCommission({ commissionId: commission.id });
      for (const commission of commissions.sort((a, b) => b.minQuality - a.minQuality || b.minTier - a.minTier)) {
        const item = this.state.inventory.filter(i => i.displayed && !this._protected(i))
          .sort((a, b) => a.quality - b.quality).find(i => this.commissionPreview(commission.id, i.id).eligible);
        if (item && this._fulfillCommission({ commissionId: commission.id, itemId: item.id }).ok) {
          hero.shoppingReason = 'Collecting a commissioned piece'; hero.nextShopAt = this.state.simTime + 6000; return;
        }
      }
      const choices = this.state.inventory.filter(i => i.displayed && !this._protected(i))
        .map(item => ({ item, quote: this.salePreview(item.id, hero.id) })).filter(x => x.quote.eligible)
        .sort((a, b) => b.quote.improvement / Math.max(1, b.quote.price) - a.quote.improvement / Math.max(1, a.quote.price));
      if (choices.length) {
        this._sell({ itemId: choices[0].item.id, heroId: hero.id, dispatch: false });
        hero.shoppingReason = 'Bought an upgrade; checking the shelves';
      } else hero.shoppingReason = hero.memories?.[0]?.victory === false ? 'Seeking better gear after a defeat' : 'Browsing for an affordable upgrade';
      hero.nextShopAt = this.state.simTime + 6000;
    }
    _npcQuestPlan(leader) {
      if(this.state.world?.bossParty?.includes(leader.id))return null;
      const now = this.state.simTime, max = this.derived().partySize;
      const companions = this.state.adventurers.filter(h => h.id !== leader.id && !this.state.world?.bossParty?.includes(h.id) && ['browsing', 'ready'].includes(h.status) && now - h.arrivedAt >= 8000);
      const party = [leader];
      while (party.length < max && companions.length) {
        companions.sort((a, b) => {
          const unique = h => Number(!party.some(p => p.archetypeId === h.archetypeId));
          return unique(b) - unique(a) || this._heroStats(b).health - this._heroStats(a).health || a.id.localeCompare(b.id);
        });
        party.push(companions.shift());
      }
      const groups = party.length > 1 ? [party, [leader]] : [party];
      const available = vals(this.data.quests).filter(q => !q.manualBoss && this._gates(q.requires).every(g => g.met) && (q.minPartySize || q.requires?.partySize || 1) <= max);
      const options = [];
      for (let index = available.length - 1; index >= 0; index--) {
        const quest = available[index];
        for (const group of groups) {
          if (group.length < (quest.minPartySize || quest.requires?.partySize || 1)) continue;
          const heroIds = group.map(h => h.id), preview = this.questPreview(quest.id, heroIds);
          if (preview.eligible) options.push({ quest, heroIds, preview, order: index });
        }
      }
      // Work toward all five victories on a reachable unfinished quest before farming cleared routes.
      const frontier = options.find(x => (this.state.questWins[x.quest.id] || 0) < (x.quest.masteryTarget || 1) && x.preview.successEstimate >= 35);
      if (frontier) return frontier;
      const reliable = options.find(x => x.preview.successEstimate >= 65);
      if (reliable) return reliable;
      return options.sort((a, b) => b.preview.successEstimate - a.preview.successEstimate || a.order - b.order || a.heroIds.length - b.heroIds.length)[0] || null;
    }
    _runNpcs() {
      const now = this.state.simTime;
      for (const bundle of [...this.state.mailbox]) if (sum(this.state.materials) + sum(bundle.materials || {}) <= this.derived().materialCapacity) this._claim({ bundleId: bundle.id });
      for (const quest of vals(this.data.quests)) if (this.state.questWins[quest.id] && quest.choices?.length && !this.state.unlocks.routes[quest.id]) {
        const choice = quest.choices.find(c => c.id === 'recover_starforge') || quest.choices.find(c => c.effects) || quest.choices[0];
        this._route({ questId: quest.id, choiceId: choice.id });
      }
      for (const hero of this.state.adventurers) if (['browsing', 'ready'].includes(hero.status) && hero.nextShopAt <= now) this._npcShop(hero);
      for (const hero of this.state.adventurers) if (['browsing', 'ready'].includes(hero.status) && hero.browseUntil <= now) {
        if(this.state.world?.bossParty?.includes(hero.id)){hero.shoppingReason='Gathered for your selected boss party';hero.browseUntil=now+6000;hero.leaveAt=hero.browseUntil;continue;}
        const home = this.state.adventurers.filter(h => ['browsing', 'ready'].includes(h.status) && now - h.arrivedAt >= 8000);
        const waitingForParty = vals(this.data.quests).some(q => !q.manualBoss && !this.state.questWins[q.id] && this._gates(q.requires).every(g => g.met) && (q.minPartySize || q.requires?.partySize || 1) === 3 && this.derived().partySize === 3 && home.length < 3);
        if (waitingForParty) { hero.shoppingReason = 'Gathering three adventurers for the next challenge'; hero.browseUntil = now + 6000; hero.leaveAt = hero.browseUntil; continue; }
        const plan = this._npcQuestPlan(hero);
        if (plan) this._dispatch({ questId: plan.quest.id, heroIds: plan.heroIds });
        else { hero.shoppingReason = 'Waiting for an expedition berth'; hero.browseUntil = now + 6000; hero.leaveAt = hero.browseUntil; }
      }
    }
    _heroBudget(quest) {
      const tier = quest?.tier || 1, base = quest?.budget || 9 + tier * 7;
      return Math.round(base * (1 + .04 * (this.state.player.stats.charisma - 2)) * (1 + (this._effects().budget || 0)));
    }
    _canDeliver(materials) { return sum(this.state.materials) + sum(materials || {}) <= this.derived().materialCapacity || this.state.mailbox.length < 25; }
    _deliver(bundle) {
      if (!this._canDeliver(bundle.materials)) return false;
      if (sum(this.state.materials) + sum(bundle.materials || {}) > this.derived().materialCapacity) {
        this.state.mailbox.push({ id: this._id('bundle'), gold: 0, recipes: [], claimed: false, ...clone(bundle) });
        return true;
      }
      Object.entries(bundle.materials || {}).forEach(([id, n]) => this.state.materials[id] = (this.state.materials[id] || 0) + n);
      this.state.player.gold += bundle.gold || 0; this.state.stats.goldEarned += bundle.gold || 0;
      (bundle.recipes || []).forEach(id => { if (this.data.recipes[id] && !this.state.unlocks.recipes.includes(id)) this.state.unlocks.recipes.push(id); });
      return true;
    }
    _claim({ bundleId }) {
      const b = this.state.mailbox.find(x => x.id === bundleId);
      if (!b) return fail('This reward is already claimed or unavailable.');
      if (sum(this.state.materials) + sum(b.materials || {}) > this.derived().materialCapacity) return fail('Make room in material storage first.');
      this.state.mailbox = this.state.mailbox.filter(x => x.id !== bundleId); this._deliver(b);
      return okay('Reward claimed.');
    }
    _rewardFor(run) {
      const q = this.data.quests[run.questId], rng = random(run.seed ^ 0x9e3779b9), e = this._effects();
      const route = q.choices?.find(c => c.id === this.state.unlocks.routes[q.id]);
      const multiplier = (1 + (e.loot || 0)) * (route?.rewardMultiplier || 1), materials = {};
      Object.entries(q.rewards?.materials || {}).forEach(([id, n]) => { const value = n * multiplier; materials[id] = Math.floor(value) + (rng() < value % 1 ? 1 : 0); });
      if (run.wellEquipped) {
        const id = Object.keys(materials).find(id => Number.isFinite(this.data.materials[id]?.price)) || 'bronze';
        materials[id] = (materials[id] || 0) + Math.max(1, q.tier || 1);
      }
      const recipes = [...(q.unlocks || q.unlockRecipes || [])];
      if (run.wellEquipped) {
        this.state.discoveryMisses++;
        if (rng() < .2 || this.state.discoveryMisses >= 5) {
          this.state.discoveryMisses = 0;
          const discoveries = vals(this.data.recipes).filter(r => !this._recipeKnown(r) && r.tier <= Math.min(5, (q.tier || 1) + 1));
          if (discoveries.length) recipes.push(discoveries[Math.floor(rng() * discoveries.length)].id);
          else if (this.data.materials.gem) materials.gem = (materials.gem || 0) + 1;
        }
      }
      return { id: this._id('reward'), gold: Math.round((q.rewards?.gold || 2) * (1 + .01 * (run.charisma - 2))), materials, recipes, source: q.name };
    }
    _deliverQuestReward(bundle) { return this._deliver(bundle); }
    _return(run) {
      if (run.rewardApplied || run.status === 'complete') return;
      const q = this.data.quests[run.questId];
      if (run.result.victory) {
        if (!run.reward) run.reward = this._rewardFor(run);
        if (!this._deliverQuestReward(run.reward)) { run.status = 'pending'; return; }
        this.state.stats.questsWon++; this.state.questWins[q.id] = (this.state.questWins[q.id] || 0) + (this.data.companyVersion&&!q.manualBoss?run.heroIds.length:1);
        this.state.player.reputation++;
        this._refreshUnlocks();
        this._log(q.name + ' won' + (run.wellEquipped ? ' · Well equipped bonus' : '') + '.', 'victory');
      } else { this.state.stats.questsLost++; this._log(q.name + ' failed. The party returns to recover and seek better gear.', 'defeat'); }
      run.rewardApplied = true; run.status = 'complete';
      run.heroIds.forEach(id => {
        const hero = this.state.adventurers.find(h => h.id === id); if (!hero) return;
        hero.runId = null; hero.memories = hero.memories || [];
        hero.memories.unshift({ questId: q.id, victory: run.result.victory, time: this.state.simTime }); hero.memories.length = Math.min(8, hero.memories.length);
        if (run.result.victory) {
          hero.relationship += run.wellEquipped ? 3 : 2;
          this._heroXp(hero, q.rewards?.heroXp || 10 * (q.tier || 1));
          const nextQuest = vals(this.data.quests).filter(candidate => !candidate.manualBoss && this._gates(candidate.requires).every(g => g.met) && (candidate.minPartySize || candidate.requires?.partySize || 1) <= this.derived().partySize).at(-1);
          if (nextQuest) hero.questId = nextQuest.id;
          this._beginBrowsing(hero, 'Back from a victory; preparing the next adventure', 'return');
        } else {
          hero.failures = (hero.failures || 0) + 1; hero.status = 'recovering';
          hero.recoverUntil = this.state.simTime + clamp((q.recoverySeconds || 90 + (q.tier || 1) * 15) * 1000, 90000, 180000);
          hero.shoppingReason = 'Recovering after a defeat';
          this._shopEvent('return', hero, { questId: q.id, runId: run.id, victory: false });
        }
        this._relationshipMilestones(hero);
      });
      this._refreshUnlocks();
      const completed = this.state.runs.filter(r => r.status === 'complete');
      if (completed.length > 16) this.state.runs = this.state.runs.filter(r => r.status !== 'complete' || completed.slice(-16).includes(r));
    }
    _heroXp(hero, amount) {
      hero.xp = (hero.xp || 0) + amount * (1 + (this._effects().heroXp || 0));
      while (hero.level < 30 && hero.xp >= 25 * hero.level) { hero.xp -= 25 * hero.level; hero.level++; }
    }
    _runAutomation() {
      const a = this.state.automation; if (!a.enabled) return;
      const recipe = this.data.recipes[a.recipeId]; if (!recipe) return;
      const current = this.state.inventory.filter(i => i.recipeId === recipe.id).length + this.state.jobs.filter(j => j.recipeId === recipe.id).length;
      if (current >= a.targetStock || this.state.jobs.length >= this.derived().stationCount + this.derived().queueCapacity) return;
      let preview = this.craftPreview(recipe.id);
      const nonMaterial = preview.gates.filter(g => !Object.keys(recipe.inputs).some(id => (this.data.materials[id]?.name || id) === g.label));
      if (nonMaterial.some(g => !g.met)) return;
      if (a.autoBuy && !preview.eligible) {
        const missing = Object.entries(recipe.inputs).map(([id, n]) => [id, Math.max(0, n - (this.state.materials[id] || 0))]);
        const costs = missing.map(([id, n]) => n && this.materialPrice(id) === null ? Infinity : n * (this.materialPrice(id) || 0));
        const total = sum(costs);
        const materialCount = missing.reduce((n, row) => n + row[1], 0);
        if (Number.isFinite(total) && this.state.player.gold - total >= a.goldReserve && (!this._offline || this._offlineSpend + total <= a.spendCap)
          && sum(this.state.materials) + materialCount <= this.derived().materialCapacity) {
          for (const [id, n] of missing) if (n) {
            const result = this._buyMaterial({ materialId: id, quantity: n }); if (!result.ok) return;
          }
          if (this._offline) this._offlineSpend += total;
        }
      }
      preview = this.craftPreview(recipe.id); if (preview.eligible) this._craft({ recipeId: recipe.id, quantity: 1 });
    }
    _quarryYield() {
      const q = this.state.quarry, d = this.quarryDerived(), amount = Math.max(1, Math.floor(d.yield));
      if (sum(this.state.materials) + amount <= this.derived().materialCapacity) {
        this.state.materials[q.activeDeposit] = (this.state.materials[q.activeDeposit] || 0) + amount; q.pausedReason = '';
      } else q.pausedReason = 'Material storage is full.';
      q.lastYieldAt = this.state.simTime; q.nextYieldAt = this.state.simTime + Math.ceil(d.seconds * 1000); q.progress = 0;
    }
    heroActivity(heroId) {
      const hero = this.state.adventurers.find(h => h.id === heroId);
      if (!hero) return null;
      const run = this.state.runs.find(r => r.id === hero.runId && !['complete', 'pending'].includes(r.status));
      if (run) {
        const phase = this.state.simTime < run.battleAt ? 'travelling' : this.state.simTime < run.battleEndAt ? 'fighting' : 'returning';
        const nextAt = phase === 'travelling' ? run.battleAt : phase === 'fighting' ? run.battleEndAt : run.returnAt;
        return { heroId, room: 'adventurers', phase, remainingMs: Math.max(0, nextAt - this.state.simTime), returnIn: Math.max(0, run.returnAt - this.state.simTime), runId: run.id, questId: run.questId };
      }
      const recovering = hero.status === 'recovering' && hero.recoverUntil > this.state.simTime;
      return { heroId, room: recovering ? 'adventurers' : 'shop', phase: recovering ? 'recovering' : 'browsing', remainingMs: Math.max(0, (recovering ? hero.recoverUntil : hero.browseUntil) - this.state.simTime), returnIn: 0, runId: null, questId: hero.questId };
    }
    _reconcileAdventurers() {
      for (const hero of this.state.adventurers) {
        const active = this.state.runs.find(r => r.heroIds.includes(hero.id) && !['complete', 'pending'].includes(r.status) && !r.rewardApplied);
        if (active) {
          hero.runId = active.id;
          hero.status = this.state.simTime < active.battleAt ? 'travelling' : this.state.simTime < active.battleEndAt ? 'fighting' : 'returning';
        } else if (['travelling', 'fighting', 'returning'].includes(hero.status) && !this.state.runs.some(r => r.id === hero.runId && r.status === 'pending')) {
          hero.runId = null;
          if (hero.recoverUntil > this.state.simTime) hero.status = 'recovering';
          else this._beginBrowsing(hero, 'Back at the shop and looking for equipment', 'return');
        }
      }
    }
    tick(deltaMs, options = {}) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0) return fail('Elapsed time must be nonnegative.');
      let delta = Math.floor(deltaMs);
      const session = this.state.offlineSession || (this.state.offlineSession = { active: false, credited: 0, spent: 0 });
      this._offline = !!options.offline;
      if (this._offline) {
        if (!session.active) Object.assign(session, { active: true, credited: 0, spent: 0 });
        this._offlineSpend = session.spent;
        delta = Math.min(delta, Math.max(0, 8 * 3600000 - session.credited));
      } else {
        Object.assign(session, { active: false, credited: 0, spent: 0 });
        this._offlineSpend = 0;
      }
      if (!this.state.started || !delta) { this._offline = false; return okay('No time advanced.', { milliseconds: 0 }); }
      this._reconcileAdventurers();
      const start = this.state.simTime, end = start + delta; let iterations = 0;
      this._startJobs();
      while (this.state.simTime < end && iterations++ < 200000) {
        const times = [end, this.state.quarry.nextYieldAt, this.state.nextAutomationAt, this.state.nextNpcAt, this.state.nextArrivalAt];
        this.state.jobs.filter(j => j.status === 'active').forEach(j => times.push(j.completeAt));
        this.state.runs.filter(r => !['complete', 'pending'].includes(r.status)).forEach(r => times.push(r.returnAt));
        this.state.adventurers.filter(h => h.status === 'recovering').forEach(h => times.push(h.recoverUntil));
        const next = Math.min(...times.filter(t => t > this.state.simTime));
        this.state.simTime = Number.isFinite(next) ? next : end;
        if(this.data.companyVersion)this._staffClock();
        // Stable order: returns, completions, quarry, customer activity, automation, job starts.
        for (const run of [...this.state.runs]) if (run.status !== 'complete' && run.returnAt <= this.state.simTime) this._return(run);
        for (const job of [...this.state.jobs]) if (job.status === 'active' && job.completeAt <= this.state.simTime) this._completeJob(job);
        if (this.state.quarry.nextYieldAt <= this.state.simTime) this._quarryYield();
        for (const hero of this.state.adventurers) {
          if (hero.status === 'recovering' && hero.recoverUntil <= this.state.simTime) {
            this._beginBrowsing(hero, 'Seeking better gear before another attempt', 'recover');
            this._log(hero.name + ' has recovered and seeks an upgrade before retrying ' + this.data.quests[hero.questId].name + '.', 'customer');
          }
        }
        if (this.state.nextArrivalAt <= this.state.simTime) { this._arrive(); this.state.nextArrivalAt = this.state.simTime + this.derived().arrivalInterval; }
        if (this.state.nextNpcAt <= this.state.simTime) { this._runNpcs(); this.state.nextNpcAt = this.state.simTime + 2000; }
        if (this.state.nextAutomationAt <= this.state.simTime) { this._runAutomation(); this.state.nextAutomationAt = this.state.simTime + 5000; }
        this.state.adventurers.forEach(hero => this._relationshipMilestones(hero));
        this._startJobs();
      }
      for (const run of this.state.runs) if (!['complete', 'pending'].includes(run.status)) {
        run.status = this.state.simTime < run.battleAt ? 'travelling' : this.state.simTime < run.battleEndAt ? 'fighting' : 'returning';
        run.heroIds.forEach(id => { const hero = this.state.adventurers.find(h => h.id === id); if (hero) hero.status = run.status; });
      }
      this.state.quarry.progress = this.quarryDerived().progress;
      if (this._offline) { session.credited += delta; session.spent = this._offlineSpend; }
      this._offline = false; return okay('Time advanced.', { milliseconds: delta });
    }
    advanceOffline(now = Date.now()) {
      if (!Number.isFinite(now)) return fail('Invalid current time.');
      const elapsed = Math.max(0, now - this.state.lastWallTime);
      const before = { ...this.state.stats }, gold = this.state.player.gold, materials = sum(this.state.materials);
      const spentBefore = this.state.offlineSession?.active ? this.state.offlineSession.spent : 0;
      const credited = this.tick(elapsed, { offline: true }).data?.milliseconds || 0;
      // Consume the actual wall time even when simulation time was capped.
      this.state.lastWallTime = Math.max(this.state.lastWallTime, now);
      const report = { elapsed, credited, capped: elapsed > credited, crafted: this.state.stats.crafted - before.crafted,
        sold: this.state.stats.sold - before.sold, victories: this.state.stats.questsWon - before.questsWon,
        defeats: this.state.stats.questsLost - before.questsLost, netGold: this.state.player.gold - gold,
        netMaterials: sum(this.state.materials) - materials, automationSpent: this._offlineSpend - spentBefore,
        stopReason: this.state.inventory.length >= this.derived().storageCapacity ? 'Finished inventory is full.' : this.state.quarry.pausedReason || '' };
      this.state.offlineReport = report; return { ok: true, message: 'Offline progress reconciled.', report };
    }
    markSaved(now = Date.now()) { if (Number.isFinite(now)) this.state.lastWallTime = Math.max(this.state.lastWallTime, now); }
    exportSave() { return JSON.stringify({ format: 'ember-and-iron', version: 1, state: this.state }); }
    importSave(text) {
      const parsed = EIEngine.validateSave(text, this.data); if (!parsed.ok) return parsed;
      this.state = parsed.state; this._previewCache.clear(); return okay('Save imported.');
    }
    static validateSave(input, data) {
      try {
        if (typeof input === 'string' && input.length > 12000000) return fail('Save is too large.');
        const parsed = typeof input === 'string' ? JSON.parse(input) : clone(input);
        const s = parsed?.format === 'ember-and-iron' ? parsed.state : parsed;
        if (!s || s.schemaVersion !== 1 || s.contentVersion !== (data.version || '0.2')) return fail('Save version is not compatible with this game.');
        let visited = 0;
        const inspect = (value, depth = 0) => {
          if (++visited > 800000 || depth > 35) throw new Error('Save structure is too complex.');
          if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Save contains invalid numbers.');
          if (typeof value === 'string' && value.length > 5000) throw new Error('Save contains oversized text.');
          if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
            if (['__proto__', 'prototype', 'constructor'].includes(k)) throw new Error('Unsafe save field.');
            inspect(v, depth + 1);
          }
        };
        inspect(s);
        const assert = (test, message) => { if (!test) throw new Error(message); };
        assert(typeof s.started === 'boolean' && typeof s.shopName === 'string', 'Missing smith identity.');
        assert(integer(s.simTime) && integer(s.lastWallTime) && integer(s.nextId) && integer(s.rngState), 'Invalid save clocks or identifiers.');
        if (!s.offlineSession) s.offlineSession = { active: false, credited: 0, spent: 0 };
        assert(typeof s.offlineSession.active === 'boolean' && integer(s.offlineSession.credited) && s.offlineSession.credited <= 8 * 3600000 && integer(s.offlineSession.spent), 'Invalid offline allowance.');
        assert(s.player && integer(s.player.gold) && s.player.gold <= 1e12 && integer(s.player.level) && s.player.level >= 1 && s.player.level <= (data.overhaul ? Number.MAX_SAFE_INTEGER : 50), 'Invalid player progression.');
        assert(integer(s.player.points) && s.player.points <= (data.overhaul ? Number.MAX_SAFE_INTEGER : 200) && Number.isFinite(s.player.xp) && s.player.xp >= 0, 'Invalid attribute or XP balance.');
        assert(stats.every(k => integer(s.player.stats?.[k]) && s.player.stats[k] >= 2 && s.player.stats[k] <= (data.overhaul ? Number.MAX_SAFE_INTEGER : 50)), 'Invalid attributes.');
        assert(s.materials && Object.entries(s.materials).every(([id, n]) => data.materials[id] && integer(n) && n <= 1e8), 'Invalid materials.');
        if(data.companyVersion&&s.world?.companyVersion!==3&&s.player.proficiency)for(const id of Object.keys(data.classes))if(!s.player.proficiency[id])s.player.proficiency[id]={level:0,xp:0};
        assert(Object.keys(data.classes).every(id => integer(s.player.proficiency?.[id]?.level) && s.player.proficiency[id].level <= 100 && Number.isFinite(s.player.proficiency[id].xp) && s.player.proficiency[id].xp >= 0), 'Invalid proficiency.');
        if (!s.commissions) s.commissions = [];
        if (!s.shopEvents) s.shopEvents = [];
        if (s.nextNpcAt == null) s.nextNpcAt = s.simTime + 2000;
        assert(integer(s.nextNpcAt) && Array.isArray(s.shopEvents) && s.shopEvents.length <= 80 && s.shopEvents.every(event => typeof event.id === 'string' && typeof event.type === 'string' && integer(event.time)), 'Invalid shop activity.');
        for (const key of ['inventory', 'jobs', 'adventurers', 'runs', 'commissions', 'decorations', 'mailbox', 'logs']) assert(Array.isArray(s[key]) && s[key].length <= (key === 'logs' ? 150 : key === 'inventory' ? 5000 : 1000), 'Invalid ' + key + ' list.');
        const ids = new Set();
        const itemCheck = item => {
          assert(item && typeof item.id === 'string' && data.recipes[item.recipeId] && integer(item.quality) && item.quality <= (data.overhaul ? 200 : 100), 'Invalid item.');
          assert(!item.affixId || data.affixes?.[item.affixId], 'Unknown item affix.');
          assert(!item.enchantmentId || data.enchantments?.[item.enchantmentId], 'Unknown enchantment.');
          assert(!ids.has(item.id), 'Duplicate item identity.'); ids.add(item.id);
        };
        s.inventory.forEach(itemCheck);
        s.adventurers.forEach(h => {
          assert(data.archetypes[h.archetypeId] && integer(h.level) && h.level >= 1 && h.level <= 30 && h.equipment, 'Invalid adventurer.');
          assert(typeof h.id === 'string' && typeof h.name === 'string' && integer(h.budget) && Number.isFinite(h.relationship) && h.relationship >= 0, 'Invalid customer identity or budget.');
          assert(['browsing', 'ready', 'idle', 'travelling', 'fighting', 'returning', 'recovering'].includes(h.status), 'Invalid adventurer status.');
          assert(!h.questId || data.quests[h.questId], 'Unknown adventurer quest.');
          assert(Number.isFinite(h.leaveAt) && Number.isFinite(h.recoverUntil), 'Invalid customer timers.');
          if (h.browseUntil == null) h.browseUntil = s.simTime + 45000;
          if (h.nextShopAt == null) h.nextShopAt = s.simTime + 4000;
          if (h.lastPurchaseAt == null) h.lastPurchaseAt = null;
          if (h.departAt == null) h.departAt = null;
          if (!h.shoppingReason) h.shoppingReason = 'Browsing for useful equipment';
          assert(integer(h.browseUntil) && integer(h.nextShopAt) && (h.lastPurchaseAt === null || integer(h.lastPurchaseAt)) && (h.departAt === null || integer(h.departAt)) && typeof h.shoppingReason === 'string', 'Invalid autonomous customer timing.');
          slots.forEach(slot => { if (h.equipment[slot]) itemCheck(h.equipment[slot]); });
        });
        const jobs = new Set();
        s.jobs.forEach(j => {
          assert(data.recipes[j.recipeId] && !jobs.has(j.id) && ['queued', 'active'].includes(j.status), 'Invalid craft job.'); jobs.add(j.id);
          assert([data.recipes[j.recipeId].inputs,data.legacyRecipeInputs?.[j.recipeId],data.preSupplyRecipeInputs?.[j.recipeId]].filter(Boolean).some(inputs=>JSON.stringify(Object.entries(j.inputs||{}).sort())===JSON.stringify(Object.entries(inputs).sort())), 'Craft escrow does not match its recipe.');
          if (j.status === 'active') assert(integer(j.startedAt) && integer(j.completeAt) && j.completeAt > j.startedAt && integer(j.quality) && j.quality <= (data.overhaul ? 200 : 100), 'Invalid active craft.');
        });
        const heroIds = new Set(s.adventurers.map(h => h.id)); assert(heroIds.size === s.adventurers.length && heroIds.size <= 12, 'Duplicate or excessive adventurers.');
        const commissionIds = new Set();
        s.commissions.forEach(c => {
          assert(typeof c.id === 'string' && !commissionIds.has(c.id) && heroIds.has(c.heroId) && data.classes[c.classId] && integer(c.minTier) && c.minTier >= 1 && c.minTier <= 5 && integer(c.minQuality) && c.minQuality <= (data.campaignVersion ? 200 : 100) && ['offered', 'accepted', 'complete'].includes(c.status), 'Invalid commission.');
          assert(Number.isFinite(c.premium) && c.premium > 0 && c.premium <= 5 && integer(c.bonusGold) && integer(c.smithXp) && c.rewardMaterials && Object.entries(c.rewardMaterials).every(([id, n]) => data.materials[id] && integer(n)), 'Invalid commission rewards.');
          commissionIds.add(c.id);
        });
        const runs = new Set();
        s.runs.forEach(r => {
          assert(!runs.has(r.id) && typeof r.id === 'string' && data.quests[r.questId] && Array.isArray(r.heroIds) && r.heroIds.length >= 1 && r.heroIds.length <= 3 && new Set(r.heroIds).size === r.heroIds.length && r.heroIds.every(id => heroIds.has(id)), 'Invalid expedition identity.'); runs.add(r.id);
          assert(r.result && typeof r.result.victory === 'boolean' && Array.isArray(r.result.events) && r.result.events.length <= 800 && Number.isFinite(r.returnAt) && Number.isFinite(r.battleAt) && Number.isFinite(r.battleEndAt) && r.returnAt >= r.battleEndAt && r.battleEndAt >= r.battleAt, 'Invalid expedition.');
          assert(['travelling', 'fighting', 'returning', 'complete', 'pending'].includes(r.status) && typeof r.rewardApplied === 'boolean', 'Invalid expedition state.');
          assert(Array.isArray(r.result.heroStats) && Array.isArray(r.result.enemyStats) && Number.isFinite(r.result.duration) && r.result.duration > 0, 'Invalid battle record.');
        });
        assert(s.upgrades && Object.entries(s.upgrades).every(([id, n]) => data.upgrades?.[id] && integer(n) && n <= (data.upgrades[id].maxLevel || 1)), 'Invalid station rank.');
        assert(s.staff && Object.entries(s.staff).every(([id, m]) => data.staff?.[id] && integer(m.level) && m.level >= 1 && m.level <= 5 && typeof m.active === 'boolean'), 'Invalid staff.');
        assert(s.decorations.every(id => data.decor?.[id]) && new Set(s.decorations).size === s.decorations.length, 'Invalid decorations.');
        assert(s.decorationLevels==null||(typeof s.decorationLevels==='object'&&!Array.isArray(s.decorationLevels)&&Object.entries(s.decorationLevels).every(([id,n])=>s.decorations.includes(id)&&integer(n)&&n>=1&&n<=(data.decor[id]?.maxLevel||1))), 'Invalid furnishing levels.');
        assert(Array.isArray(s.player.talents) && s.player.talents.every(id => data.talents?.[id]) && new Set(s.player.talents).size === s.player.talents.length, 'Invalid talents.');
        assert(s.player.legacy && integer(s.player.legacy.generation) && s.player.legacy.generation >= 1 && integer(s.player.legacy.points) && integer(s.player.legacy.totalPoints) && s.player.legacy.collection && Object.entries(s.player.legacy.collection).every(([id, q]) => data.recipes[id] && integer(q) && q <= (data.overhaul ? 200 : 100)), 'Invalid legacy records.');
        assert(Array.isArray(s.player.legacy.unlockedRecipes) && s.player.legacy.unlockedRecipes.every(id => data.recipes[id]) && Array.isArray(s.player.legacy.heirlooms), 'Invalid legacy discoveries.');
        assert(s.unlocks && Array.isArray(s.unlocks.recipes) && s.unlocks.recipes.every(id => data.recipes[id]) && Array.isArray(s.unlocks.milestones) && s.unlocks.routes && s.questWins && Object.entries(s.questWins).every(([id, n]) => data.quests[id] && integer(n)), 'Invalid discovery records.');
        assert(Object.entries(s.unlocks.routes).every(([id, choice]) => data.quests[id]?.choices?.some(c => c.id === choice)), 'Invalid story choice.');
        assert(s.quarry && integer(s.quarry.nextManualAt) && Number.isFinite(s.quarry.nextYieldAt) && s.quarry.workers && s.quarry.upgrades && (!data.quarry || data.quarry.deposits[s.quarry.activeDeposit]), 'Invalid quarry.');
        for (const type of ['workers', 'upgrades']) assert(Object.entries(s.quarry[type]).every(([id, rank]) => data.quarry?.[type]?.[id] && integer(rank) && rank <= (data.quarry[type][id].maxLevel || 5)), 'Invalid quarry rank.');
        assert(s.automation && ['enabled', 'autoBuy', 'autoSell', 'autoDispatch'].every(k => typeof s.automation[k] === 'boolean') && integer(s.automation.goldReserve) && integer(s.automation.spendCap) && integer(s.automation.targetStock) && (!s.automation.recipeId || data.recipes[s.automation.recipeId]), 'Invalid automation limits.');
        const bundles = new Set();
        s.mailbox.forEach(b => {
          assert(typeof b.id === 'string' && !bundles.has(b.id) && integer(b.gold || 0) && b.materials && Object.entries(b.materials).every(([id, n]) => data.materials[id] && integer(n)) && Array.isArray(b.recipes) && b.recipes.every(id => data.recipes[id]), 'Invalid mailbox reward.'); bundles.add(b.id);
        });
        assert(Number.isFinite(s.nextArrivalAt) && Number.isFinite(s.nextAutomationAt) && s.stats && s.tutorial, 'Missing simulation scheduling data.');
        return { ok: true, message: 'Valid save.', state: clone(s), summary: { name: s.shopName, level: s.player.level, gold: s.player.gold, generation: s.player.legacy.generation } };
      } catch (error) { return fail('Invalid save: ' + error.message); }
    }
  }
  return EIEngine;
});
