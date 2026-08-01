import { z } from 'zod';
import { DROPFALL_PROTOCOL_VERSION } from './protocolVersion.js';
import { HAT_IDS } from './cosmetics.js';

const boundedRecord = (valueSchema, maxKeys) => z
  .record(z.string().min(1).max(48), valueSchema)
  .refine(value => Object.keys(value).length <= maxKeys, {
    message: `Object may contain at most ${maxKeys} fields`,
  });

const matchSettingsSchema = boundedRecord(
  z.union([z.string().max(48), z.number().finite()]),
  20,
);

const displayNameSchema = z.string().trim().min(1).max(20);
const gameIdSchema = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const reconnectTokenSchema = z.string().min(32).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const colorSchema = z.union([
  z.number().int().min(0).max(0xffffff),
  z.string().min(1).max(32),
]);
const hatSchema = z.enum(['none', ...HAT_IDS]);

const emptyMessage = type => z.object({ type: z.literal(type) }).strict();

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_name'),
    name: displayNameSchema,
    protocolVersion: z.literal(DROPFALL_PROTOCOL_VERSION).optional(),
  }).strict(),
  z.object({
    type: z.literal('ping'),
    timestamp: z.number().finite(),
  }).strict(),
  z.object({
    type: z.literal('create_game'),
    settings: matchSettingsSchema.optional().default({}),
  }).strict(),
  emptyMessage('list_games'),
  z.object({
    type: z.literal('join_game'),
    gameId: gameIdSchema,
  }).strict(),
  emptyMessage('leave_game'),
  emptyMessage('start_game'),
  z.object({
    type: z.literal('update_game_settings'),
    settings: matchSettingsSchema,
  }).strict(),
  z.object({
    type: z.literal('set_customization'),
    color: colorSchema,
    hat: hatSchema,
    name: displayNameSchema,
  }).strict(),
  z.object({
    type: z.literal('player_ready'),
    ready: z.boolean(),
  }).strict(),
  emptyMessage('hurry_up_request'),
  emptyMessage('rematch_request'),
  z.object({
    type: z.literal('rejoin_game'),
    gameId: gameIdSchema,
    reconnectToken: reconnectTokenSchema,
  }).strict(),
  z.object({
    type: z.literal('player_input'),
    forward: z.number().finite().min(-1).max(1),
    right: z.number().finite().min(-1).max(1),
    boost: z.boolean(),
    tick: z.number().int().min(0).max(2_147_483_647),
  }).strict(),
  z.object({
    type: z.literal('game_state'),
    state: boundedRecord(z.unknown(), 32),
  }).strict(),
  z.object({
    type: z.literal('round_over'),
    winner: z.union([z.literal(1), z.literal(2), z.null()]),
    scores: z.object({
      p1: z.number().int().min(0).max(99),
      p2: z.number().int().min(0).max(99),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('sync_state'),
    requestFullState: z.literal(true),
  }).strict(),
]);

export function parseClientMessage(value) {
  return clientMessageSchema.safeParse(value);
}

export function formatProtocolIssues(issues) {
  return issues
    .slice(0, 3)
    .map(issue => `${issue.path.join('.') || 'message'}: ${issue.message}`)
    .join('; ');
}
