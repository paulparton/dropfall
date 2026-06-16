import { getLevel, loadLevels } from '../levelLoader.js';
import {
  demoLevels,
  type DemoLevel,
  type LevelMode,
  type LevelTheme,
  type LevelTile,
  type RaceConfig,
} from './demoLevels';

export type LevelData =
  | DemoLevel
  | {
      id?: string;
      name: string;
      description: string;
      difficulty: string;
      theme?: LevelTheme;
      mode?: LevelMode;
      raceConfig?: RaceConfig;
      tiles: LevelTile[];
      sphereSize?: number;
      sphereWeight?: number;
      sphereAccel?: number;
      collisionBounce?: number;
      arenaSize?: number;
      destructionRate?: number;
      iceRate?: number;
      bonusRate?: number;
      bonusDuration?: number;
      boostRegenSpeed?: number;
      boostDrainRate?: number;
      bloomLevel?: number;
      playerAuraSize?: number;
      playerAuraOpacity?: number;
      playerGlowIntensity?: number;
      playerGlowRange?: number;
      defaultP1Color?: number;
      defaultP2Color?: number;
      defaultP1Hat?: string;
      defaultP2Hat?: string;
      isDemo?: false;
    };

export type LevelSummary = {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  mode: LevelMode;
  tileCount: number;
  isDemo: boolean;
};

const DEFAULT_LEVEL_SUMMARY: LevelSummary = {
  id: 'default',
  name: 'Default Arena',
  description: 'Standard procedural hex grid',
  difficulty: 'normal',
  mode: 'battle',
  tileCount: 0,
  isDemo: false,
};

function toDemoSummary(level: DemoLevel): LevelSummary {
  return {
    id: level.id,
    name: level.name,
    description: level.description,
    difficulty: level.difficulty,
    mode: level.mode,
    tileCount: level.tiles.length,
    isDemo: true,
  };
}

function toServerSummary(level: unknown): LevelSummary | null {
  if (!level || typeof level !== 'object') {
    return null;
  }

  const candidate = level as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null;
  }

  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' ? candidate.name : candidate.id,
    description: typeof candidate.description === 'string' ? candidate.description : '',
    difficulty: typeof candidate.difficulty === 'string' ? candidate.difficulty : 'normal',
    mode: candidate.mode === 'race' ? 'race' : 'battle',
    tileCount: typeof candidate.tileCount === 'number' ? candidate.tileCount : 0,
    isDemo: false,
  };
}

export async function getAllLevels(): Promise<LevelSummary[]> {
  const allLevels: LevelSummary[] = [
    DEFAULT_LEVEL_SUMMARY,
    ...demoLevels.map(toDemoSummary),
  ];

  const seenIds = new Set(allLevels.map((level) => level.id));

  try {
    const serverLevels = await loadLevels();
    const levelList = Array.isArray(serverLevels) ? serverLevels : [];

    for (const level of levelList) {
      const summary = toServerSummary(level);
      if (!summary || seenIds.has(summary.id)) {
        continue;
      }

      seenIds.add(summary.id);
      allLevels.push(summary);
    }
  } catch (error) {
    console.warn('[LevelProvider] Failed to load editor levels, using demo levels only:', error);
  }

  return allLevels;
}

export async function getLevelById(id: string): Promise<LevelData | null> {
  if (id === 'default') {
    return null;
  }

  const demoLevel = demoLevels.find((level) => level.id === id);
  if (demoLevel) {
    return demoLevel;
  }

  const serverLevel = await getLevel(id);
  if (!serverLevel || typeof serverLevel !== 'object') {
    return serverLevel as LevelData | null;
  }

  const candidate = serverLevel as Record<string, unknown>;
  const mode: LevelMode = candidate.mode === 'race' ? 'race' : 'battle';
  const levelData = {
    ...(candidate as LevelData),
    mode,
  } as LevelData;

  if (candidate.raceConfig && typeof candidate.raceConfig === 'object') {
    levelData.raceConfig = candidate.raceConfig as RaceConfig;
  }

  return levelData;
}