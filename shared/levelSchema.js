import { z } from 'zod';

const finiteNumber = z.number().finite();
const boundedSetting = finiteNumber.min(-100_000).max(100_000).optional();
const colorValue = z.union([
  z.number().int().min(0).max(0xffffff),
  z.string().min(1).max(32),
]).optional();

const tileSchema = z.object({
  coord: z.object({
    q: z.number().int().min(-24).max(24),
    r: z.number().int().min(-24).max(24),
  }).strict(),
  ability: z.enum(['NORMAL', 'ICE', 'BONUS', 'WARNING']),
  height: finiteNumber.min(-8).max(24).optional().default(4),
}).strict();

const raceConfigSchema = z
  .record(z.string().min(1).max(48), z.unknown())
  .refine(value => Object.keys(value).length <= 30, {
    message: 'raceConfig may contain at most 30 fields',
  })
  .optional();

export const levelPayloadSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional().default(''),
  difficulty: z.enum(['easy', 'normal', 'hard', 'expert']).optional().default('normal'),
  theme: z.string().min(1).max(32).optional().default('tron'),
  mode: z.enum(['battle', 'race']).optional().default('battle'),
  author: z.string().trim().max(40).optional(),
  active: z.boolean().optional().default(false),
  isPublic: z.boolean().optional(),
  isDemo: z.boolean().optional(),
  lastModified: finiteNumber.optional(),
  boundaryType: z.string().max(32).optional(),
  symmetry: z.string().max(32).optional(),
  raceConfig: raceConfigSchema,
  tiles: z.array(tileSchema).max(1300),
  arenaSize: boundedSetting,
  sphereSize: boundedSetting,
  sphereWeight: boundedSetting,
  sphereAccel: boundedSetting,
  collisionBounce: boundedSetting,
  destructionRate: boundedSetting,
  iceRate: boundedSetting,
  bonusRate: boundedSetting,
  bonusDuration: boundedSetting,
  boostRegenSpeed: boundedSetting,
  boostDrainRate: boundedSetting,
  bloomLevel: boundedSetting,
  playerAuraSize: boundedSetting,
  playerAuraOpacity: boundedSetting,
  playerGlowIntensity: boundedSetting,
  playerGlowRange: boundedSetting,
  portalCooldown: boundedSetting,
  portalRate: boundedSetting,
  p1Color: colorValue,
  p2Color: colorValue,
  p1Hat: z.string().max(48).optional(),
  p2Hat: z.string().max(48).optional(),
}).strict();

export function parseLevelPayload(value) {
  return levelPayloadSchema.safeParse(value);
}
