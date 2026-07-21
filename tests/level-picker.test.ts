import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/levelThumbnail.js', () => ({
  createHexArenaPreviewTiles: () => [{ coord: { q: 0, r: 0 }, ability: 'NORMAL' }],
  createLevelThumbnailCanvas: () => document.createElement('canvas'),
}));

import { createLevelSelectModal } from '../src/components/LevelSelectModal.js';

const levels = [
  {
    id: 'default',
    name: 'Default Arena',
    description: 'The classic playground',
    difficulty: 'normal',
    tileCount: 0,
    isDemo: false,
    launchReady: true,
  },
  {
    id: 'custom-falls',
    name: 'Custom Falls',
    description: 'An active editor arena',
    difficulty: 'hard',
    tileCount: 31,
    isDemo: false,
    launchReady: false,
    validationIssues: ['Spawn separation is tight.'],
  },
];

beforeEach(() => {
  document.body.innerHTML = '';
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  }
});

describe('level picker', () => {
  it('supports the options API, selects custom arenas, and returns null for default', () => {
    const onSelect = vi.fn();
    createLevelSelectModal({ levels, currentLevelId: null, onSelect });

    const custom = document.querySelector<HTMLButtonElement>('[data-level-id="custom-falls"]');
    expect(custom?.textContent).toContain('EXPERIMENTAL');
    custom?.click();
    document.querySelector<HTMLButtonElement>('.level-picker__confirm')?.click();
    expect(onSelect).toHaveBeenCalledWith('custom-falls');

    createLevelSelectModal({ levels, currentLevelId: 'default', onSelect });
    document.querySelector<HTMLButtonElement>('.level-picker__confirm')?.click();
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('filters cards without losing the current selection', () => {
    createLevelSelectModal({ levels, currentLevelId: 'custom-falls', onSelect: vi.fn() });
    const search = document.querySelector<HTMLInputElement>('.level-picker__search');
    if (!search) throw new Error('Search control missing');
    search.value = 'classic';
    search.dispatchEvent(new Event('input'));

    expect(document.querySelector('[data-level-id="default"]')?.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('[data-level-id="custom-falls"]')?.classList.contains('hidden')).toBe(true);
    expect(document.querySelector('.level-picker__count')?.textContent).toBe('1 MATCH');
  });
});
