import { describe, expect, it } from 'vitest';
import {
  getProductModel,
  resolveAdFreeEntitlement,
  shouldShowPostMatchAd,
} from '../src/services/monetization.js';

describe('cross-platform monetization policy', () => {
  it('ships Steam as premium and mobile/web as one ad-supported binary with an upgrade', () => {
    expect(getProductModel('steam')).toMatchObject({
      entryProduct: 'premium',
      adFreeIncluded: true,
      removeAdsProductId: null,
    });
    expect(getProductModel('ios')).toMatchObject({
      entryProduct: 'ad-supported',
      removeAdsProductId: 'dropfall.ios.remove_ads',
    });
    expect(getProductModel('android')).toMatchObject({
      entryProduct: 'ad-supported',
      removeAdsProductId: 'dropfall.android.remove_ads',
    });
  });

  it('accepts only an active verified product entitlement', () => {
    expect(resolveAdFreeEntitlement({
      platform: 'web',
      verifiedEntitlements: [{ productId: 'dropfall.web.remove_ads', status: 'active' }],
    })).toBe(true);
    expect(resolveAdFreeEntitlement({
      platform: 'web',
      verifiedEntitlements: [{ productId: 'dropfall.web.remove_ads', status: 'expired' }],
    })).toBe(false);
  });

  it('never shows ads during online play and frequency-gates offline post-match ads', () => {
    const base = {
      platform: 'android',
      consentAllowsAds: true,
      completedOfflineMatches: 3,
    };
    expect(shouldShowPostMatchAd({ ...base, gameMode: '1P' })).toBe(true);
    expect(shouldShowPostMatchAd({ ...base, gameMode: 'ONLINE' })).toBe(false);
    expect(shouldShowPostMatchAd({ ...base, gameMode: '1P', completedOfflineMatches: 2 })).toBe(false);
    expect(shouldShowPostMatchAd({ ...base, gameMode: '1P', adFree: true })).toBe(false);
    expect(shouldShowPostMatchAd({ ...base, gameMode: '1P', childDirected: true })).toBe(false);
  });
});
