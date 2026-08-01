import {
  HAT_DEFINITIONS,
  HAT_IDS,
  getHatDefinitionById,
} from '../../shared/cosmetics.js';

export interface HatDefinition {
  id: string;
  label: string;
  iconPath: string;
  artStatus: 'vertical-slice' | 'prototype';
  modelSource: 'asset-pipeline' | 'procedural-polished' | 'procedural-fallback';
}

/**
 * Shared cosmetic records drive every selector and preview. The public
 * collection is intentionally curated: every entry has a recognizable
 * portrait and an in-game model rather than a generic prototype tile.
 */
export const HAT_CATALOG: ReadonlyArray<Readonly<HatDefinition>> =
  HAT_DEFINITIONS as ReadonlyArray<Readonly<HatDefinition>>;

export const HAT_VALUES: ReadonlyArray<string> = ['none', ...HAT_IDS];

export function getHatDefinition(id: string): Readonly<HatDefinition> | null {
  return getHatDefinitionById(id) as Readonly<HatDefinition> | null;
}
