/**
 * Owned games are the first collection; append reviewed games here as it grows.
 * A launch needs an available/preview status and a verified HTTPS or local URL.
 * Mobile means touch-enabled browser play, not an App Store / Play Store release.
 */
export const games = [
  {
    id: 'ember-and-iron',
    title: 'Ember & Iron',
    subtitle: 'Mine, forge and equip a company of adventurers.',
    description: 'Build a blacksmith workshop from a quiet first forge into a lasting legacy. Mine materials, craft equipment and send your company through a living campaign.',
    featureTitle: 'A quiet forge.<br>A lasting legacy.',
    genre: 'RPG',
    platforms: ['desktop', 'mobile'],
    modes: ['Single-player workshop', 'Persistent profile save'],
    controls: 'Mouse, keyboard or touch. Start instantly as a guest, then create a profile whenever you want to preserve your workshop.',
    status: 'available',
    url: '/ember-and-iron/',
    image: '/ember-and-iron/assets/smith-starter.png',
    imageAlt: 'A blacksmith at work in the Ember and Iron forge',
    artwork: 'ember-and-iron',
    accent: '#d68c4b',
    caption: 'A BLACKSMITH RPG',
    developer: 'Dropfall Games',
  },
  {
    id: 'super-face-pop',
    title: 'Super Face Pop',
    subtitle: 'Match four. Start a chain. Ruin somebody’s plan.',
    description: 'Match four bubbles of the same colour and watch the board unravel. Play for a high score, take on the CPU or share the screen with somebody who will absolutely notice your mistakes.',
    featureTitle: 'Four bubbles.<br>Then trouble.',
    genre: 'Puzzle',
    platforms: ['desktop', 'mobile'],
    modes: ['Solo score attack', 'Versus CPU', 'Local two-player', 'Online multiplayer'],
    controls: 'Keyboard, gamepad or touch. Touch controls support player one; local two-player needs a keyboard or a second controller.',
    status: 'available',
    url: 'https://super-face-pop.dropfall-game.com/',
    originUrl: 'https://super-bubble-face-pop-production.up.railway.app/',
    image: '/library/face-pop-gameplay.png',
    imageAlt: 'Super Face Pop versus gameplay with two puzzle boards, falling pairs and colourful jelly bubbles with expressive eyes',
    artwork: 'face-pop',
    accent: '#baade1',
    caption: 'A HEAD-TO-HEAD PUZZLE GAME',
    developer: 'Dropfall Games',
  },
  {
    id: 'dropfall',
    title: 'Dropfall',
    subtitle: 'The floor disappears. Try not to go with it.',
    description: 'Tiles drop away one by one. Keep rolling, nudge your rivals toward the gaps and stay out of them yourself. You can play solo, share a screen, go online or build an arena of your own.',
    featureTitle: 'The floor goes.<br>You don’t.',
    genre: 'Action',
    platforms: ['desktop', 'mobile'],
    modes: ['Solo', 'Local two-player', 'Online multiplayer', 'Level editor'],
    controls: 'Keyboard or touch controls. Choose your player and game settings before the round.',
    status: 'available',
    url: '/dropfall-arena/',
    image: '/library/dropfall-gameplay.png',
    imageAlt: 'A ball wearing a cowboy hat in the neon Dropfall arena',
    artwork: 'dropfall',
    accent: '#cb92d8',
    caption: 'THE FLOOR WON’T WAIT FOR YOU',
    developer: 'Dropfall Games',
  },
  {
    id: 'big-racers',
    title: 'Big Racers',
    subtitle: 'Land trains, tight corners and very bad braking distances.',
    description: 'These are land trains, not cars. Draft behind a rival to build overdrive, then pick the least terrible moment to pass. Race alone, split the screen or open an online room.',
    featureTitle: 'Too big to race.<br>We raced them.',
    genre: 'Racing',
    platforms: ['desktop', 'mobile'],
    modes: ['Solo career', 'Local split-screen', 'Online room races'],
    controls: 'Keyboard or gamepad. Touch controls are available for single-view races.',
    status: 'preview',
    url: 'https://big-racers.dropfall-game.com/',
    originUrl: 'https://big-racers-slipstream.agentdanimo.chatgpt.site/',
    image: '/library/big-racers.png',
    imageAlt: 'Big Racers game preview with colossal mecha land trains',
    artwork: 'racers',
    accent: '#d89b6f',
    caption: 'LAND-TRAIN RACING',
    developer: 'Dropfall Games',
    availability: 'Playable preview: you can race now, but we’re still working on the game. Expect rough edges and changes along the way.',
  },
  {
    id: 'mofighter',
    title: 'Titan Protocol',
    subtitle: 'One Titan per world power. Total control goes to the last standing.',
    description: 'Choose the Titan sent to represent a world power, master its fighting style and survive the arcade protocol—or put two contenders on the same screen and decide who controls the world.',
    featureTitle: 'One Titan.<br>Total control.',
    genre: 'Fighting',
    platforms: ['desktop'],
    modes: ['Solo arcade', 'Local two-player', 'Local high scores'],
    controls: 'Keyboard or gamepad required. Combat does not currently support touch controls.',
    status: 'preview',
    url: 'https://titan-protocol.dropfall-game.com/',
    originUrl: 'https://mofighter-production.up.railway.app/',
    image: '/library/mofighter-gameplay.png',
    imageAlt: 'Two rival Titans facing off in Titan Protocol’s sunset arena',
    artwork: 'mofighter',
    accent: '#bdcabc',
    caption: 'FIVE TITANS. YOUR PICK.',
    developer: 'Dropfall Games',
    availability: 'Playable preview: the Titan protocol and local versus are ready to try. We’re still refining the fights, so expect changes as development continues.',
  },
];

export function launchUrl(game) {
  if (!['available', 'preview'].includes(game.status) || !game.url) return null;
  // Browsers normalize backslashes and controls before resolving navigation.
  if ([...game.url].some((character) => {
    const code = character.charCodeAt(0);
    return character === '\\' || code <= 0x20 || code === 0x7f;
  })) return null;
  if (game.url.startsWith('/') && !game.url.startsWith('//')) return game.url;
  try {
    const url = new URL(game.url);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
