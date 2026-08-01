import { beforeEach, describe, expect, it, vi } from 'vitest';

const { publishLevelMock } = vi.hoisted(() => ({
  publishLevelMock: vi.fn(),
}));

vi.mock('../src/levelLoader.js', () => ({
  publishLevel: publishLevelMock,
}));

import { createLevelEditor } from '../src/components/LevelEditor.js';

function getRadiusInput(editor: HTMLElement): HTMLInputElement {
  const input = editor.querySelector<HTMLInputElement>('input[type="range"]');
  if (!input) throw new Error('Canvas radius input missing');
  return input;
}

function dispatchPointer(target: Element, type: string, pointerId = 1): void {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: 10, clientY: 10 });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
  publishLevelMock.mockReset();
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => null,
  });
});

describe('in-game level editor', () => {
  it('supports a 20-ring canvas and remembers the selected radius', () => {
    const editor = createLevelEditor();
    document.body.appendChild(editor);
    const radius = getRadiusInput(editor);

    expect(radius.max).toBe('20');
    radius.value = '20';
    radius.dispatchEvent(new Event('input', { bubbles: true }));
    expect(editor.querySelectorAll('.creator-hex')).toHaveLength(1261);

    const reopened = createLevelEditor();
    expect(getRadiusInput(reopened).value).toBe('20');
  });

  it('supports hold-and-drag erasing, painting, and brush shortcuts', () => {
    const editor = createLevelEditor();
    document.body.appendChild(editor);

    const centre = editor.querySelector<SVGPolygonElement>('[aria-label^="NORMAL tile at 0, 0"]');
    const dragTarget = editor.querySelector<SVGPolygonElement>('[aria-label^="NORMAL tile at 0, 2"]');
    const svg = editor.querySelector<SVGSVGElement>('svg');
    expect(centre).not.toBeNull();
    expect(dragTarget).not.toBeNull();
    expect(svg).not.toBeNull();

    const elementFromPoint = vi.spyOn(document, 'elementFromPoint').mockReturnValue(centre!);
    dispatchPointer(centre!, 'pointerdown');
    elementFromPoint.mockReturnValue(dragTarget!);
    dispatchPointer(svg!, 'pointermove');
    dispatchPointer(svg!, 'pointerup');
    expect(editor.querySelector('[aria-label^="Empty tile at 0, 0"]')).not.toBeNull();
    expect(editor.querySelector('[aria-label^="Empty tile at 0, 1"]')).not.toBeNull();
    expect(editor.querySelector('[aria-label^="Empty tile at 0, 2"]')).not.toBeNull();

    editor.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', bubbles: true }));
    expect(editor.querySelector('[data-tool="ICE"]')?.classList.contains('active')).toBe(true);
    expect(editor.querySelector('.creator-tool-hint')?.textContent).toContain('Keys 1–4');

    const emptyCentre = editor.querySelector<SVGPolygonElement>('[aria-label^="Empty tile at 0, 0"]');
    elementFromPoint.mockReturnValue(emptyCentre!);
    dispatchPointer(emptyCentre!, 'pointerdown', 2);
    dispatchPointer(svg!, 'pointerup', 2);
    expect(editor.querySelector('[aria-label^="ICE tile at 0, 0"]')).not.toBeNull();
  });

  it('tests and publishes unreachable maps without gameplay validation', async () => {
    localStorage.setItem('dropfall_level_draft_v1', JSON.stringify({
      id: 'draft_unreachable',
      name: 'Decorative Islands',
      description: '',
      difficulty: 'normal',
      theme: 'default',
      mode: 'battle',
      active: false,
      tiles: [
        { coord: { q: 0, r: 0 }, ability: 'NORMAL', height: 4 },
        { coord: { q: 10, r: 10 }, ability: 'BONUS', height: 8 },
      ],
    }));
    publishLevelMock.mockResolvedValue({ id: 'draft_published', active: true, launchReady: false });
    const onTest = vi.fn();
    const editor = createLevelEditor({ authorName: 'Tester', onTest });
    document.body.appendChild(editor);

    expect(editor.querySelector('.creator-validation')).toBeNull();
    const testButton = Array.from(editor.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === 'Test in Solo');
    const publishButton = Array.from(editor.querySelectorAll<HTMLButtonElement>('button'))
      .find(button => button.textContent === 'Publish to Game');
    expect(testButton?.disabled).toBe(false);
    expect(publishButton?.disabled).toBe(false);
    testButton?.click();
    expect(onTest).toHaveBeenCalledOnce();
    publishButton?.click();

    await vi.waitFor(() => expect(publishLevelMock).toHaveBeenCalledOnce());
    const call = publishLevelMock.mock.calls[0];
    if (!call) throw new Error('Publish call missing');
    const [published, options] = call;
    expect(published.active).toBe(true);
    expect(published.author).toBe('Tester');
    expect(options).toEqual({ existingId: null });
    await vi.waitFor(() => {
      expect(editor.querySelector('.creator-action-status')?.textContent).toContain('now appears');
    });
  });
});
