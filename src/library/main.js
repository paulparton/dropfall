import { games, launchUrl } from './catalog.js';
import { createAnalytics } from '../services/analytics.js';
import { mountAnalyticsConsent } from '../components/AnalyticsConsent.js';

const analytics = createAnalytics({ productId: 'library' });
mountAnalyticsConsent(analytics, { productId: 'library' });

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const bookmark = '<svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden="true"><path d="M4 2.5h10a1 1 0 0 1 1 1v14l-6-4-6 4v-14a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6"/></svg>';
const platformIcon = '<svg aria-hidden="true" width="16" height="14" viewBox="0 0 20 16" fill="none"><rect x="1" y="1" width="18" height="11" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M6 15h8M10 12v3" stroke="currentColor" stroke-width="1.4"/></svg>';
const state = { platform: 'all', genre: 'all', query: '', sort: 'featured', savedOnly: false };
const storageKey = 'dropfall-library:saved:v1';
let storageAvailable = true;
let saved = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) saved = new Set(stored.filter((id) => games.some((game) => game.id === id)));
} catch { storageAvailable = false; }
let toastTimeout;
const featureGames = [games.find((game) => game.id === 'dropfall'), ...games.filter((game) => game.id !== 'dropfall')].filter(Boolean);
const featureIntervalMs = 7000;
let featureIndex = 0;
let featureTimer;
let featurePaused = false;
let featureInteractionPaused = false;

function announce(message) {
  clearTimeout(toastTimeout);
  const toast = $('#save-toast');
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function saveGame(id) {
  const game = games.find((item) => item.id === id);
  if (!game) return;
  if (saved.has(id)) saved.delete(id); else saved.add(id);
  try { localStorage.setItem(storageKey, JSON.stringify([...saved])); } catch { storageAvailable = false; }
  announce(`${game.title} ${saved.has(id) ? 'saved to your collection' : 'removed from saved games'}.`);
  analytics.track('game_saved', { game_id: id, saved: saved.has(id) });
  render();
}

function launchAnchor(game, classes = 'card-play') {
  const url = launchUrl(game);
  return url ? `<a class="${classes}" data-analytics-game="${game.id}" data-analytics-placement="${classes === 'card-play' ? 'card' : 'dialog'}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="Play ${escapeHtml(game.title)} (opens in a new tab)">Play now <span aria-hidden="true">↗</span></a>` : '';
}

function gameCard(game) {
  const available = Boolean(launchUrl(game));
  return `<article class="game-card ${game.artwork}">
    <div class="card-art" style="--art-accent:${game.accent}">
      <button class="art-details" data-details="${game.id}" type="button" aria-label="View ${escapeHtml(game.title)} details"><img src="${game.image}" alt="${escapeHtml(game.imageAlt)}" loading="lazy" width="640" height="480"/><span class="card-art-overlay"></span><span class="card-art-caption">${game.caption}</span><span class="card-art-name">${game.id === 'super-face-pop' ? 'SUPER<br>FACE POP' : game.id === 'big-racers' ? 'BIG<br>RACERS' : game.id === 'mofighter' ? 'moFighter<span>.</span>' : 'DROPFALL'}</span><span class="art-open" aria-hidden="true">↗</span></button>
      <span class="card-status ${available ? 'is-available' : ''}">${game.status === 'preview' ? '<i></i> Playable preview' : available ? '<i></i> Play in browser' : 'In development'}</span>
      <button type="button" class="save-button ${saved.has(game.id) ? 'is-saved' : ''}" data-save="${game.id}" aria-label="${saved.has(game.id) ? 'Unsave' : 'Save'} ${escapeHtml(game.title)}" aria-pressed="${saved.has(game.id)}">${bookmark}</button>
    </div>
    <div class="card-body"><div class="card-meta"><span>${game.genre}</span><span>${platformIcon}${game.platforms.includes('mobile') ? '<span title="Touch-enabled browser play">+ touch</span>' : '<span>Desktop</span>'}</span></div>
    <h3><button data-details="${game.id}" type="button">${escapeHtml(game.title)}</button></h3><p>${escapeHtml(game.subtitle)}</p>
    <div class="card-footer"><button class="card-details" data-details="${game.id}" type="button">Game details <span aria-hidden="true">→</span></button>${launchAnchor(game) || '<span class="coming-soon">Coming soon</span>'}</div></div>
  </article>`;
}

function render() {
  const query = state.query.trim().toLocaleLowerCase();
  const visibleGames = games.filter((game) => (!state.savedOnly || saved.has(game.id))
    && (state.platform === 'all' || game.platforms.includes(state.platform))
    && (state.genre === 'all' || game.genre === state.genre)
    && (!query || `${game.title} ${game.genre} ${game.subtitle} ${game.modes.join(' ')}`.toLocaleLowerCase().includes(query)));
  if (state.sort === 'name') visibleGames.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === 'available') visibleGames.sort((a, b) => Number(Boolean(launchUrl(b))) - Number(Boolean(launchUrl(a))));
  const focusedSave = document.activeElement?.dataset?.save;
  $('#game-grid').innerHTML = visibleGames.map(gameCard).join('');
  $('#result-count').textContent = `${visibleGames.length} ${state.savedOnly ? 'saved ' : ''}${visibleGames.length === 1 ? 'game' : 'games'}${state.savedOnly ? ' on this device' : ''}`;
  $('#saved-count').textContent = saved.size;
  $('#saved-nav').setAttribute('aria-pressed', String(state.savedOnly));
  $('#saved-nav').classList.toggle('nav-link--active', state.savedOnly);
  $('.nav-link[href="#games"]').classList.toggle('nav-link--active', !state.savedOnly);
  $('#empty-state').hidden = visibleGames.length > 0;
  $('#empty-message').textContent = state.savedOnly && !saved.size ? 'Use the bookmark on a game to save it here, on this device.' : 'Try a different search or clear your filters.';
  $('#clear-filters').hidden = !query && state.platform === 'all' && state.genre === 'all' && !state.savedOnly;
  $('#storage-note').hidden = storageAvailable;
  document.querySelectorAll('[data-platform]').forEach((button) => { const selected = button.dataset.platform === state.platform; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); });
  document.querySelectorAll('[data-genre]').forEach((button) => { const selected = button.dataset.genre === state.genre; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); });
  if (focusedSave) {
    const sameButton = document.querySelector(`[data-save="${focusedSave}"]`);
    if (sameButton) sameButton.focus({ preventScroll: true });
    else $('#saved-nav').focus({ preventScroll: true });
  }
}

function clearFilters() {
  Object.assign(state, { platform: 'all', genre: 'all', query: '', savedOnly: false });
  $('#game-search').value = '';
  render();
}

function showDetails(id) {
  const game = games.find((item) => item.id === id);
  if (!game) return;
  const available = Boolean(launchUrl(game));
  $('#dialog-content').innerHTML = `<div class="dialog-art ${game.artwork}"><img src="${game.image}" alt="${escapeHtml(game.imageAlt)}"/><span>${escapeHtml(game.genre)} / ${game.status === 'preview' ? 'PLAYABLE PREVIEW' : available ? 'PLAY IN BROWSER' : 'IN DEVELOPMENT'}</span></div><div class="dialog-body"><p class="eyebrow">${escapeHtml(game.developer)}</p><h2 id="dialog-title">${escapeHtml(game.title)}</h2><p class="dialog-description">${escapeHtml(game.description)}</p><dl><div><dt>Game modes</dt><dd>${game.modes.map(escapeHtml).join(' · ')}</dd></div><div><dt>Where to play</dt><dd>${game.platforms.includes('mobile') ? 'In your desktop or mobile browser. These links open the web game, not an app-store download.' : 'In your desktop browser, with a keyboard or controller.'}</dd></div><div><dt>Controls</dt><dd>${escapeHtml(game.controls)}</dd></div></dl>${game.status === 'preview' ? `<p class="preview-note">${escapeHtml(game.availability)}</p>` : ''}${available ? `${launchAnchor(game, 'button button-lime')}<p class="launch-note">Free to play · Opens in a new tab</p>` : `<div class="availability-note"><strong>Coming soon</strong><p>${escapeHtml(game.availability || 'This game isn’t available to play yet.')}</p></div>`}</div>`;
  $('#game-dialog').showModal();
  analytics.track('game_details_view', { game_id: id });
  document.body.classList.add('dialog-is-open');
}

function featureMode(game) {
  if (game.modes.some((mode) => /online/i.test(mode))) return 'Solo + multiplayer';
  if (game.modes.some((mode) => /two-player/i.test(mode))) return 'Solo + local multiplayer';
  return game.modes[0];
}

function renderFeature({ announce = false } = {}) {
  const game = featureGames[featureIndex];
  const url = launchUrl(game);
  $('#feature-image').src = game.image;
  $('#feature-image').alt = game.imageAlt;
  $('#feature-count').textContent = `${String(featureIndex + 1).padStart(2, '0')} / ${String(featureGames.length).padStart(2, '0')}`;
  $('#feature-status').textContent = game.status === 'preview' ? 'PLAYABLE PREVIEW' : 'PLAY IN BROWSER';
  $('#feature-art-title').textContent = game.title.toUpperCase();
  $('#feature-kicker').textContent = `${game.title.toUpperCase()} · ${game.genre.toUpperCase()}`;
  $('#feature-title').innerHTML = game.featureTitle;
  $('#feature-description').textContent = game.description;
  $('#feature-tags').innerHTML = [game.genre, featureMode(game), game.platforms.includes('mobile') ? 'Desktop + touch' : 'Desktop'].map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  $('#feature-play').href = url;
  $('#feature-play').dataset.analyticsGame = game.id;
  $('#feature-play').childNodes[0].nodeValue = `${game.status === 'preview' ? 'Try' : 'Play'} ${game.title} `;
  $('#feature-play').setAttribute('aria-label', `${game.status === 'preview' ? 'Try' : 'Play'} ${game.title} (opens in a new tab)`);
  $('#feature-note').textContent = `${game.status === 'preview' ? 'Playable preview' : 'Free to play'} · Opens in a new tab`;
  document.querySelectorAll('.feature-dot').forEach((dot, index) => {
    const active = index === featureIndex;
    dot.classList.toggle('active', active);
    dot.setAttribute('aria-current', active ? 'true' : 'false');
  });
  if (announce) $('#feature-announcement').textContent = `Showing ${game.title}, ${featureIndex + 1} of ${featureGames.length}`;
}

function stepFeature(direction, announce = true) {
  featureIndex = (featureIndex + direction + featureGames.length) % featureGames.length;
  renderFeature({ announce });
}

function stopFeatureTimer() {
  clearInterval(featureTimer);
  featureTimer = undefined;
}

function startFeatureTimer() {
  stopFeatureTimer();
  if (featurePaused || featureInteractionPaused || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  featureTimer = setInterval(() => stepFeature(1, false), featureIntervalMs);
}

function setupFeature() {
  $('#feature-dots').innerHTML = featureGames.map((game, index) => `<button class="feature-dot" type="button" aria-label="Show ${escapeHtml(game.title)}" data-feature-index="${index}"></button>`).join('');
  $('#feature-previous').addEventListener('click', () => { stepFeature(-1); startFeatureTimer(); });
  $('#feature-next').addEventListener('click', () => { stepFeature(1); startFeatureTimer(); });
  $('#feature-dots').addEventListener('click', (event) => {
    const dot = event.target.closest('[data-feature-index]');
    if (!dot) return;
    featureIndex = Number(dot.dataset.featureIndex);
    renderFeature({ announce: true });
    startFeatureTimer();
  });
  $('#feature-pause').addEventListener('click', () => {
    featurePaused = !featurePaused;
    $('#feature-pause').textContent = featurePaused ? 'Play' : 'Pause';
    $('#feature-pause').setAttribute('aria-pressed', String(featurePaused));
    startFeatureTimer();
  });
  const carousel = $('[data-feature-carousel]');
  carousel.addEventListener('mouseenter', () => { featureInteractionPaused = true; stopFeatureTimer(); });
  carousel.addEventListener('mouseleave', () => { featureInteractionPaused = false; startFeatureTimer(); });
  carousel.addEventListener('focusin', () => { featureInteractionPaused = true; stopFeatureTimer(); });
  carousel.addEventListener('focusout', (event) => {
    if (carousel.contains(event.relatedTarget)) return;
    featureInteractionPaused = false;
    startFeatureTimer();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopFeatureTimer(); else startFeatureTimer(); });
  renderFeature();
  startFeatureTimer();
}

$('#game-grid').addEventListener('click', (event) => {
  const save = event.target.closest('[data-save]');
  const details = event.target.closest('[data-details]');
  if (save) saveGame(save.dataset.save);
  else if (details) showDetails(details.dataset.details);
});
document.querySelectorAll('[data-platform]').forEach((button) => button.addEventListener('click', () => { state.platform = button.dataset.platform; render(); }));
document.querySelectorAll('[data-genre]').forEach((button) => button.addEventListener('click', () => { state.genre = button.dataset.genre; render(); }));
$('#game-search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
$('#game-sort').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
$('#saved-nav').addEventListener('click', () => { state.savedOnly = !state.savedOnly; render(); $('#games').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
$('.nav-link[href="#games"]').addEventListener('click', clearFilters);
$('#clear-filters').addEventListener('click', clearFilters);
$('#empty-clear').addEventListener('click', clearFilters);
$('#dialog-close').addEventListener('click', () => $('#game-dialog').close());
$('#game-dialog').addEventListener('close', () => document.body.classList.remove('dialog-is-open'));
$('#game-dialog').addEventListener('click', (event) => { if (event.target !== $('#game-dialog')) return; const bounds = event.target.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close(); });
$('#footer-year').textContent = new Date().getFullYear();
function trackLaunch(event) {
  if (event.type === 'auxclick' && event.button !== 1) return;
  const link = event.target.closest('[data-analytics-game]');
  if (link) analytics.track('game_launch', { game_id: link.dataset.analyticsGame, placement: link.dataset.analyticsPlacement });
}
document.addEventListener('click', trackLaunch);
document.addEventListener('auxclick', trackLaunch);
render();
setupFeature();
analytics.markReady();
