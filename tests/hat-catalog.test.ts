import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { animateHatMesh, createHatMesh, disposeHatGroup } from '../src/utils/hatFactory.js';
import { HAT_CATALOG, HAT_VALUES } from '../src/utils/hatCatalog.js';

describe('hat catalogue', () => {
  it('contains exactly 20 distinct replacement hats plus the no-hat option', () => {
    expect(HAT_CATALOG).toHaveLength(20);
    expect(new Set(HAT_CATALOG.map((hat) => hat.id)).size).toBe(20);
    expect(HAT_VALUES).toHaveLength(21);
    expect(HAT_VALUES[0]).toBe('none');
  });

  it.each(HAT_CATALOG.map((hat) => [hat.id]))('builds and animates %s', (hatId) => {
    const result = createHatMesh(hatId, 2);

    expect(result).not.toBeNull();
    expect(result?.group.userData.hatType).toBe(hatId);
    expect(result?.group.getObjectsByProperty('isMesh', true).length).toBeGreaterThan(1);
    expect(() => animateHatMesh(result!.group, 1.25, 12)).not.toThrow();

    disposeHatGroup(result!.group);
  });

  it('uses real Three.js groups suitable for match and preview scenes', () => {
    const result = createHatMesh('mini_ufo', 2);
    expect(result?.group).toBeInstanceOf(THREE.Group);
    disposeHatGroup(result!.group);
  });
});
