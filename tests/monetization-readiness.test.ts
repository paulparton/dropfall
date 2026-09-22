// @vitest-environment node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatReadinessSummary, validateMonetizationReadiness } from '../scripts/check-monetization-readiness.mjs';

const registry = JSON.parse(readFileSync(new URL('../deployment/monetization-readiness.json', import.meta.url), 'utf8'));
const script = fileURLToPath(new URL('../scripts/check-monetization-readiness.mjs', import.meta.url));

function approvedFixture() {
  const fixture = structuredClone(registry);
  for (const type of ['analytics', 'ads', 'payments']) {
    fixture.accounts[type] = {
      provider: `fixture-${type}-provider`,
      publicAccountId: `fixture-${type}-public-account`,
      brandScope: 'dropfall',
      dedicatedToDropfall: true,
      usesSharedPdsAccount: false,
      ownershipApproved: true,
      approvedBy: 'fixture-owner',
      approvalReference: 'fixture-approval-record',
    };
  }
  for (const product of fixture.products) {
    product.integrations.analytics = 'ready';
    product.integrations.ads = 'ready';
    for (const field of Object.keys(product.readiness)) {
      product.readiness[field] = field === 'approvalReference' ? 'fixture-product-approval' : true;
    }
  }
  return fixture;
}

describe('offline monetization readiness registry', () => {
  it('records verified library/Arena analytics while retaining all advertising and payment gates', () => {
    expect(registry.products.map((product: { id: string }) => product.id).sort()).toEqual(
      ['library', 'super-face-pop', 'dropfall', 'big-racers', 'mofighter'].sort(),
    );
    expect(registry.products.every((product: { domainsVerified: boolean }) => product.domainsVerified)).toBe(true);
    for (const product of registry.products) {
      const analyticsReady = ['library', 'dropfall'].includes(product.id);
      expect(product.integrations).toEqual({ analytics: analyticsReady ? 'ready' : 'disabled', ads: 'disabled', payments: 'disabled' });
      expect(product.readiness.analyticsValidated).toBe(analyticsReady);
    }
    const result = validateMonetizationReadiness(registry);
    expect(result.ready).toBe(false);
    expect(result.status).toBe('BLOCKED');
    expect(registry.accounts.ads.publicAccountId).toBe('pub-7669551026428141');
    expect(result.blockers).toContain('library: adPlacementValidated is not approved.');
    expect(result.blockers).toContain('dropfall: H5 advertising approval is missing.');
  });

  it('permits a fully approved fixture without confusing infrastructure or copyright sharing with accounts', () => {
    const fixture = approvedFixture();
    expect(fixture.accountBoundary.sharedInfrastructureAllowed).toBe(true);
    expect(fixture.accountBoundary.sharedCopyrightAttributionAllowed).toBe(true);
    const before = structuredClone(fixture);
    expect(validateMonetizationReadiness(fixture)).toMatchObject({ ready: true, status: 'READY', blockers: [] });
    expect(fixture).toEqual(before);
    expect(formatReadinessSummary(validateMonetizationReadiness(fixture))).toContain('account ownership, approvals and live behavior require human verification');
  });

  it.each(['analytics', 'ads', 'payments'])('cannot become ready with a shared PDS %s account', type => {
    const fixture = approvedFixture();
    fixture.accounts[type].brandScope = 'pds';
    fixture.accounts[type].usesSharedPdsAccount = true;
    fixture.accounts[type].ownershipApproved = true;
    expect(validateMonetizationReadiness(fixture).ready).toBe(false);
  });

  it('cannot whitelist PDS reuse through global metadata or Big Racers local Stripe settings', () => {
    const fixture = approvedFixture();
    fixture.accountBoundary.sharedPdsPaymentsAllowed = true;
    fixture.products.find((product: { id: string }) => product.id === 'big-racers').pdsStripeReuseAllowed = true;
    const result = validateMonetizationReadiness(fixture);
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('big-racers: Local Big Racers PDS Stripe reuse must remain blocked.');
  });

  it.each(['ownershipApproved', 'approvedBy', 'approvalReference', 'publicAccountId', 'dedicatedToDropfall'])('blocks missing account approval field %s', field => {
    const fixture = approvedFixture();
    delete fixture.accounts.analytics[field];
    expect(validateMonetizationReadiness(fixture).ready).toBe(false);
  });

  it.each(['audiencePolicyApproved', 'privacyPublished', 'consentPublished', 'consentEnforced', 'analyticsValidated', 'adPlacementValidated', 'adFreeSuppressionValidated', 'h5Approved'])('blocks an unapproved product prerequisite: %s', field => {
    const fixture = approvedFixture();
    fixture.products.find((product: { id: string }) => product.id === 'dropfall').readiness[field] = false;
    expect(validateMonetizationReadiness(fixture).ready).toBe(false);
  });

  it('requires dedicated payment approval before any product can declare payments ready', () => {
    const fixture = approvedFixture();
    fixture.accounts.payments = structuredClone(registry.accounts.payments);
    expect(validateMonetizationReadiness(fixture).ready).toBe(true);
    fixture.products.find((product: { id: string }) => product.id === 'big-racers').integrations.payments = 'ready';
    expect(validateMonetizationReadiness(fixture).ready).toBe(false);
  });

  it('fails closed for missing products, duplicates, changed domains and malformed input', () => {
    const missing = approvedFixture();
    missing.products.pop();
    const duplicate = approvedFixture();
    duplicate.products.push(structuredClone(duplicate.products[0]));
    const badDomain = approvedFixture();
    badDomain.products[0].urls = ['https://dropfall-game.com.attacker.test/'];
    for (const input of [missing, duplicate, badDomain, null, {}]) {
      expect(validateMonetizationReadiness(input).ready).toBe(false);
    }
  });

  it('returns a readable default report and only fails the readiness gate when requested', () => {
    const normal = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    expect(normal.status).toBe(0);
    expect(normal.stdout).toContain('readiness: BLOCKED');
    const gate = spawnSync(process.execPath, [script, '--require-ready'], { encoding: 'utf8' });
    expect(gate.status).toBe(1);
    expect(gate.stdout).toContain('This checker does not activate or deploy any integration.');
  });
});
