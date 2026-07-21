import { useGameStore } from '../store.js';
import {
  MATCH_PRESETS,
  MATCH_SETTING_GROUPS,
  MATCH_THEMES,
  formatMatchSettingValue,
} from '../../shared/matchSettings.js';

type MatchSettingsEditorOptions = {
  title?: string;
  subtitle?: string;
};

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/**
 * Shared pre-match rules editor for single-player and local multiplayer.
 * Online rooms render the same schema but add server-authoritative edit locks.
 */
export function createMatchSettingsEditor(options: MatchSettingsEditorOptions = {}): HTMLElement {
  const root = node('div', 'match-rules-launcher');

  const summary = node('button', 'match-rules-launcher__button');
  summary.type = 'button';
  summary.setAttribute('aria-haspopup', 'dialog');
  const summaryCopy = node('span');
  summaryCopy.append(
    node('strong', undefined, options.title || 'Match Settings'),
    node('small', undefined, options.subtitle || 'Tune the arena, physics, and match tempo before launch.'),
  );
  const summaryValue = node('span', 'match-rules-editor__value');
  const summaryArrow = node('span', 'match-rules-launcher__arrow', '›');
  summary.append(summaryCopy, summaryValue, summaryArrow);

  const dialog = node('dialog', 'match-rules-dialog');
  dialog.setAttribute('aria-labelledby', 'match-rules-dialog-title');
  const dialogPanel = node('div', 'match-rules-editor');
  const dialogHeader = node('header', 'match-rules-dialog__header');
  const dialogHeading = node('span');
  const dialogTitle = node('strong', undefined, options.title || 'Match Settings');
  dialogTitle.id = 'match-rules-dialog-title';
  dialogHeading.append(
    dialogTitle,
    node('small', undefined, options.subtitle || 'Tune the arena, physics, and match tempo before launch.'),
  );
  const closeButton = node('button', 'match-rules-dialog__close', 'Close');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close match settings');
  dialogHeader.append(dialogHeading, closeButton);

  const body = node('div', 'match-rules-editor__body');
  const presetRow = node('div', 'match-rules-editor__presets');
  const controls = new Map<string, { input: HTMLInputElement; output: HTMLOutputElement; field: any }>();

  const themeField = node('label', 'match-rules-field match-rules-field--theme');
  const themeCopy = node('span');
  themeCopy.append(node('strong', undefined, 'Arena Theme'), node('small', undefined, 'Shared environment treatment'));
  const themeSelect = node('select', 'match-rules-field__select');
  for (const theme of MATCH_THEMES) {
    const option = node('option', undefined, theme.label);
    option.value = theme.value;
    themeSelect.append(option);
  }
  themeField.append(themeCopy, themeSelect);

  const groups = node('div', 'match-rules-editor__groups');
  for (const group of MATCH_SETTING_GROUPS) {
    const groupNode = node('section', 'match-rules-group');
    groupNode.append(node('h4', undefined, group.title));
    for (const field of group.fields) {
      const fieldNode = node('label', 'match-rules-field');
      const copy = node('span');
      copy.append(node('strong', undefined, field.label), node('small', undefined, field.description));
      const control = node('span', 'match-rules-field__control');
      const input = node('input');
      input.type = 'range';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.dataset.setting = field.key;
      const output = node('output');
      control.append(input, output);
      fieldNode.append(copy, control);
      groupNode.append(fieldNode);
      controls.set(field.key, { input, output, field });
    }
    groups.append(groupNode);
  }

  function sync(): void {
    const settings = useGameStore.getState().settings;
    themeSelect.value = String(settings.theme || 'tron');
    summaryValue.textContent = `${MATCH_THEMES.find(item => item.value === themeSelect.value)?.label || 'Cyber'} · ${Math.round(Number(settings.arenaSize || 4))} rings`;
    for (const [key, control] of controls) {
      const value = Number((settings as any)[key]);
      control.input.value = String(value);
      control.output.value = formatMatchSettingValue(control.field, value);
      control.output.textContent = formatMatchSettingValue(control.field, value);
    }
  }

  themeSelect.addEventListener('change', () => {
    useGameStore.getState().updateSetting('theme', themeSelect.value);
    sync();
  });
  for (const [key, control] of controls) {
    control.input.addEventListener('input', () => {
      useGameStore.getState().updateSetting(key as any, Number(control.input.value));
      sync();
    });
  }
  for (const preset of MATCH_PRESETS) {
    const button = node('button', undefined, preset.label);
    button.type = 'button';
    button.addEventListener('click', () => {
      for (const [key, value] of Object.entries(preset.settings)) {
        useGameStore.getState().updateSetting(key as any, value);
      }
      sync();
    });
    presetRow.append(button);
  }

  body.append(presetRow, themeField, groups);
  dialogPanel.append(dialogHeader, body);
  dialog.append(dialogPanel);
  root.append(summary, dialog);

  const closeDialog = (): void => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };
  summary.addEventListener('click', () => {
    sync();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeButton.focus();
  });
  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  sync();
  return root;
}
