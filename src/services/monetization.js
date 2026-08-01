const SUPPORTED_PLATFORMS = new Set(['web', 'ios', 'android', 'steam']);

export function normalizePlatform(value) {
    const platform = String(value || '').toLowerCase();
    return SUPPORTED_PLATFORMS.has(platform) ? platform : 'web';
}

export function getProductModel(platformValue) {
    const platform = normalizePlatform(platformValue);
    if (platform === 'steam') {
        return {
            platform,
            entryProduct: 'premium',
            adFreeIncluded: true,
            removeAdsProductId: null,
        };
    }
    return {
        platform,
        entryProduct: 'ad-supported',
        adFreeIncluded: false,
        removeAdsProductId: `dropfall.${platform}.remove_ads`,
    };
}

/**
 * @param {{
 *   platform?: string,
 *   verifiedEntitlements?: Array<{ productId: string, status: string }>
 * }} [options]
 */
export function resolveAdFreeEntitlement({
    platform,
    verifiedEntitlements = [],
} = {}) {
    const product = getProductModel(platform);
    return product.adFreeIncluded
        || verifiedEntitlements.some(entitlement => (
            entitlement?.status === 'active'
            && entitlement?.productId === product.removeAdsProductId
        ));
}

/**
 * Dropfall never interrupts live play, online setup, or a waiting rematch.
 * Providers may only fill a post-match placement after consent and frequency
 * gates have passed.
 *
 * @param {{
 *   platform?: string,
 *   adFree?: boolean,
 *   consentAllowsAds?: boolean,
 *   childDirected?: boolean,
 *   gameMode?: string,
 *   completedOfflineMatches?: number,
 *   onlineRematchPending?: boolean
 * }} [options]
 */
export function shouldShowPostMatchAd({
    platform,
    adFree = false,
    consentAllowsAds = false,
    childDirected = false,
    gameMode,
    completedOfflineMatches = 0,
    onlineRematchPending = false,
} = {}) {
    if (getProductModel(platform).entryProduct !== 'ad-supported') return false;
    if (adFree || !consentAllowsAds || childDirected || onlineRematchPending) return false;
    if (gameMode === 'ONLINE') return false;
    return completedOfflineMatches > 0 && completedOfflineMatches % 3 === 0;
}

export const MONETIZATION_PLACEMENTS = Object.freeze({
    POST_MATCH_OFFLINE: 'post_match_offline',
});
