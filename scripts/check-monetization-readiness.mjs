import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_PRODUCTS = {
  library: ['https://dropfall-game.com/'],
  'super-face-pop': ['https://super-face-pop.dropfall-game.com/'],
  dropfall: ['https://dropfall-game.com/dropfall-arena/', 'https://dropfall.dropfall-game.com/'],
  'big-racers': ['https://big-racers.dropfall-game.com/'],
  mofighter: ['https://mofighter.dropfall-game.com/'],
};
const REQUIRED_CHECKS = [
  'audiencePolicyApproved', 'privacyPublished', 'consentPublished',
  'consentEnforced', 'analyticsValidated', 'adPlacementValidated',
];
const ACCOUNT_TYPES = ['analytics', 'ads', 'payments'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Pure metadata validation: READY is a recorded checklist, never proof of ownership. */
export function validateMonetizationReadiness(registry) {
  const blockers = [];
  const source = object(registry) ? registry : {};
  if (source.schemaVersion !== 1) blockers.push('Registry schemaVersion must be 1.');
  if (source.brand !== 'dropfall') blockers.push('Registry must be scoped to the Dropfall brand.');
  for (const field of ['sharedPdsAnalyticsAllowed', 'sharedPdsAdsAllowed', 'sharedPdsPaymentsAllowed']) {
    if (source.accountBoundary?.[field] !== false) blockers.push(`Account boundary: ${field} must remain false.`);
  }
  const products = Array.isArray(source.products) ? source.products : [];
  const paymentsRequested = products.some(product => product?.integrations?.payments === 'ready');
  for (const type of ACCOUNT_TYPES) {
    const account = source.accounts?.[type];
    if (account?.usesSharedPdsAccount !== false) blockers.push(`${type}: shared PDS account reuse is blocked.`);
    // Payment activation is optional. If requested it needs its own approved
    // account; disabled payments never inherit approval from analytics or ads.
    if (type === 'payments' && !paymentsRequested) continue;
    if (!object(account)) {
      blockers.push(`${type}: dedicated Dropfall account metadata is missing.`);
      continue;
    }
    for (const field of ['provider', 'publicAccountId', 'approvedBy', 'approvalReference']) {
      if (!nonempty(account[field])) blockers.push(`${type}: ${field} is missing.`);
    }
    if (account.brandScope !== 'dropfall' || account.dedicatedToDropfall !== true) {
      blockers.push(`${type}: account must be dedicated to Dropfall, independently of shared hosting or copyright.`);
    }
    if (account.ownershipApproved !== true) blockers.push(`${type}: explicit ownership approval is missing.`);
    if (typeof account.publicAccountId === 'string' && /^(?:sk_|rk_|whsec_)/.test(account.publicAccountId)) {
      blockers.push(`${type}: record a public account identifier, never a secret key.`);
    }
  }
  const knownIds = Object.keys(EXPECTED_PRODUCTS);
  for (const product of products) {
    if (!knownIds.includes(product?.id)) blockers.push('Registry contains an unknown product.');
  }
  const accountPrerequisitesMet = blockers.length === 0;
  const productResults = knownIds.map(id => {
    const matches = products.filter(product => product?.id === id);
    const issues = [];
    if (matches.length !== 1) {
      issues.push('Exactly one entry is required.');
    } else {
      const product = matches[0];
      const expectedUrls = EXPECTED_PRODUCTS[id];
      if (!Array.isArray(product.urls) || product.urls.length !== expectedUrls.length ||
          !expectedUrls.every(url => product.urls.includes(url))) {
        issues.push('Product URLs must match the verified Dropfall domains.');
      }
      if (product.domainsVerified !== true) issues.push('Domain verification is missing.');
      for (const type of ACCOUNT_TYPES) {
        const status = product.integrations?.[type];
        if (!['disabled', 'unconfigured', 'ready'].includes(status)) issues.push(`${type}: unknown or missing status.`);
        if (type !== 'payments' && status !== 'ready') issues.push(`${type}: disabled or unconfigured.`);
      }
      for (const field of REQUIRED_CHECKS) {
        if (product.readiness?.[field] !== true) issues.push(`${field} is not approved.`);
      }
      if (id !== 'library') {
        if (product.readiness?.h5Approved !== true) issues.push('H5 advertising approval is missing.');
        if (product.readiness?.adFreeSuppressionValidated !== true) issues.push('Paid ad-free suppression is not validated.');
      }
      if (!nonempty(product.readiness?.approvalReference)) issues.push('Product readiness approvalReference is missing.');
      if (id === 'big-racers' && product.pdsStripeReuseAllowed !== false) issues.push('Local Big Racers PDS Stripe reuse must remain blocked.');
    }
    blockers.push(...issues.map(issue => `${id}: ${issue}`));
    return { id, ready: accountPrerequisitesMet && issues.length === 0, blockers: issues };
  });
  return { ready: blockers.length === 0, status: blockers.length ? 'BLOCKED' : 'READY', blockers, products: productResults };
}

export function formatReadinessSummary(result) {
  return [
    `Dropfall advertising and analytics readiness: ${result.status}`,
    'Offline metadata check only: account ownership, approvals and live behavior require human verification.',
    'Infrastructure and copyright attribution may be shared; PDS ads, analytics and payment accounts may not.',
    'Payments remain disabled unless separately declared ready with approved Dropfall account metadata.',
    ...result.blockers.map(blocker => `- ${blocker}`),
    'This checker does not activate or deploy any integration.',
  ].join('\n');
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--require-ready')) throw new Error('Usage: node scripts/check-monetization-readiness.mjs [--require-ready]');
    const path = fileURLToPath(new URL('../deployment/monetization-readiness.json', import.meta.url));
    const result = validateMonetizationReadiness(JSON.parse(readFileSync(path, 'utf8')));
    console.log(formatReadinessSummary(result));
    if (args.includes('--require-ready') && !result.ready) process.exitCode = 1;
  } catch (error) {
    console.error(`Monetization readiness check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
