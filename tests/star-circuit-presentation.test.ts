import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MUSIC_TRACKS } from '../src/audio.js';
import { createTronSkyMaterial } from '../src/shaders/tron-sky.js';

describe('Star Circuit audiovisual identity', () => {
  it('publishes a dedicated synth-wave music cue', () => {
    expect(MUSIC_TRACKS.tron).toMatchObject({
      id: 'star-circuit-neon-apex',
      title: 'Neon Apex',
      key: 'F# minor',
      baseBpm: 135,
    });
  });

  it('uses the detailed Star Circuit sky shader', () => {
    const material = createTronSkyMaterial();

    expect(material.fragmentShader).toContain('float starField');
    expect(material.fragmentShader).toContain('buildingHeight');
    expect(material.fragmentShader).toContain('gridPosition');
    expect(material.fragmentShader).toContain('sunDisc');
    expect(material.uniforms.uTime?.value).toBe(0);

    material.dispose();
  });

  it('keeps the synth-wave cascade after the legacy visual layer', () => {
    const css = readFileSync(`${process.cwd()}/src/style.css`, 'utf8');

    expect(css.lastIndexOf('Synth-wave interface system')).toBeGreaterThan(
      css.lastIndexOf('Dropfall V2 — Star Circuit'),
    );
    expect(css).toContain('--sw-cyan: #37f7ff');
    expect(css).toContain('@keyframes sw-grid-drift');
  });
});
