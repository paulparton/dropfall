import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { HAT_DEFINITIONS } from '../shared/cosmetics.js';
import { POWER_UP_DEFINITIONS } from '../shared/powerUps.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const warnings = [];

function publicPath(assetPath) {
  return join(root, 'public', assetPath.replace(/^\/+/, ''));
}

function validatePath(label, assetPath) {
  const filePath = publicPath(assetPath);
  if (!existsSync(filePath)) {
    errors.push(`${label} is missing ${assetPath}`);
    return null;
  }
  return filePath;
}

function readPngDimensions(filePath) {
  const buffer = readFileSync(filePath);
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature || buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const hatIds = new Set();
for (const hat of HAT_DEFINITIONS) {
  if (hatIds.has(hat.id)) errors.push(`Duplicate hat id: ${hat.id}`);
  hatIds.add(hat.id);
  const filePath = validatePath(`Hat ${hat.id}`, hat.iconPath);
  if (hat.artStatus === 'vertical-slice') {
    if (!filePath?.endsWith('.png')) errors.push(`Vertical-slice hat ${hat.id} must use a rendered PNG portrait`);
    else {
      const dimensions = readPngDimensions(filePath);
      if (!dimensions || dimensions.width !== 256 || dimensions.height !== 256) {
        errors.push(`Hat ${hat.id} portrait must be exactly 256×256`);
      }
    }
    if (hat.modelSource === 'procedural-fallback') {
      warnings.push(`Hat ${hat.id} still uses an unpolished procedural 3D fallback`);
    }
  }
}

const powerUpIds = new Set();
for (const powerUp of POWER_UP_DEFINITIONS) {
  if (powerUpIds.has(powerUp.id)) errors.push(`Duplicate power-up id: ${powerUp.id}`);
  powerUpIds.add(powerUp.id);
  validatePath(`Power-up ${powerUp.id}`, powerUp.iconPath);
}

if (warnings.length > 0) warnings.forEach(warning => console.warn(`Asset warning: ${warning}`));
if (errors.length > 0) {
  errors.forEach(error => console.error(`Asset error: ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Validated ${HAT_DEFINITIONS.length} hats and ${POWER_UP_DEFINITIONS.length} power-ups.`);
}
