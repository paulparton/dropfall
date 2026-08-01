import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  animateHatMesh,
  createHatMesh,
  disposeHatGroup,
  getHatFitProfile,
  getHatFitTransform,
} from '../src/utils/hatFactory.js';
import { HAT_CATALOG, HAT_VALUES } from '../src/utils/hatCatalog.js';

describe('hat catalogue', () => {
  it('contains a curated set of eight distinct production hats plus no-hat', () => {
    expect(HAT_CATALOG).toHaveLength(8);
    expect(new Set(HAT_CATALOG.map((hat) => hat.id)).size).toBe(8);
    expect(HAT_VALUES).toHaveLength(9);
    expect(HAT_VALUES[0]).toBe('none');
    expect(HAT_CATALOG.every((hat) => hat.iconPath.endsWith('.png'))).toBe(true);
    expect(HAT_CATALOG.every((hat) => hat.artStatus === 'vertical-slice')).toBe(true);
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
    const result = createHatMesh('cowboy', 2);
    expect(result?.group).toBeInstanceOf(THREE.Group);
    disposeHatGroup(result!.group);
  });

  it('applies curated fit profiles consistently at different player scales', () => {
    const cowboy = createHatMesh('cowboy', 2)!;
    const crown = createHatMesh('crown', 2)!;
    const pirate = createHatMesh('pirate_captain', 2)!;
    const witch = createHatMesh('arcane_witch', 2)!;
    const chef = createHatMesh('galaxy_chef', 2)!;
    const headphones = createHatMesh('sonic_headphones', 2)!;
    const halo = createHatMesh('neon_halo', 2)!;

    expect(getHatFitProfile('cowboy')).toEqual({ scale: 0.86, verticalOffset: -0.22 });
    const cowboyFit = getHatFitTransform(cowboy.group, 2, 1.5);
    expect(cowboyFit.scale).toBeCloseTo(1.29);
    expect(cowboyFit.attachmentHeight).toBeCloseTo(2.34);
    expect(getHatFitProfile('crown')).toEqual({ scale: 0.84, verticalOffset: -0.29 });
    expect(getHatFitTransform(crown.group, 2)).toEqual({
      scale: 0.84,
      attachmentHeight: 1.42,
    });
    expect(getHatFitProfile('pirate_captain')).toEqual({ scale: 0.92, verticalOffset: -0.16 });
    expect(getHatFitTransform(pirate.group, 2)).toEqual({
      scale: 0.92,
      attachmentHeight: 1.68,
    });
    expect(getHatFitProfile('arcane_witch')).toEqual({ scale: 0.9, verticalOffset: -0.18 });
    expect(getHatFitTransform(witch.group, 2)).toEqual({
      scale: 0.9,
      attachmentHeight: 1.6400000000000001,
    });
    expect(getHatFitProfile('galaxy_chef')).toEqual({ scale: 0.88, verticalOffset: -0.2 });
    expect(getHatFitTransform(chef.group, 2)).toEqual({
      scale: 0.88,
      attachmentHeight: 1.6,
    });
    expect(getHatFitProfile('sonic_headphones')).toEqual({ scale: 1.04, verticalOffset: -1.04 });
    expect(getHatFitTransform(headphones.group, 2)).toEqual({
      scale: 1.04,
      attachmentHeight: -0.08000000000000007,
    });
    expect(getHatFitTransform(halo.group, 2)).toEqual({
      scale: 1,
      attachmentHeight: 2,
    });

    disposeHatGroup(cowboy.group);
    disposeHatGroup(crown.group);
    disposeHatGroup(pirate.group);
    disposeHatGroup(witch.group);
    disposeHatGroup(chef.group);
    disposeHatGroup(headphones.group);
    disposeHatGroup(halo.group);
  });

  it('builds the pirate captain with a full ring of animated dreadlocks', () => {
    const pirate = createHatMesh('pirate_captain', 2)!;
    const dreadlocks = Array.from({ length: 8 }, (_, index) =>
      pirate.group.getObjectByName(`pirateDread${index}`));

    expect(dreadlocks.every(Boolean)).toBe(true);
    animateHatMesh(pirate.group, 1.25, 12);
    expect(dreadlocks.some((dread) => Math.abs(dread!.rotation.y) > 0)).toBe(true);

    disposeHatGroup(pirate.group);
  });

  it('builds the witch and chef hats from readable production layers', () => {
    const witch = createHatMesh('arcane_witch', 2)!;
    const chef = createHatMesh('galaxy_chef', 2)!;

    expect(witch.group.getObjectByName('witchBrim')).toBeTruthy();
    expect(witch.group.getObjectByName('witchCrown3')).toBeTruthy();
    expect(witch.group.getObjectByName('witchBuckle')).toBeTruthy();
    expect(chef.group.getObjectByName('chefToqueBody')).toBeTruthy();
    expect(chef.group.getObjectByName('chefPleat11')).toBeTruthy();
    expect(chef.group.getObjectByName('chefPuff7')).toBeTruthy();

    disposeHatGroup(witch.group);
    disposeHatGroup(chef.group);
  });
});
