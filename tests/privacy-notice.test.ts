import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const privacyHtml = readFileSync(join(process.cwd(), 'public', 'privacy.html'), 'utf8');

describe('privacy notice', () => {
  it('publishes the privacy contact email as a mailto link', () => {
    expect(privacyHtml).toMatch(/href=["']mailto:dropfallgamestudio@gmail\.com["']/i);
    expect(privacyHtml).toContain('dropfallgamestudio@gmail.com');
  });

  it('states the games are general-audience and analytics is optional', () => {
    expect(privacyHtml).toMatch(/general audience/i);
    expect(privacyHtml).toMatch(/not specifically for children/i);
    expect(privacyHtml).toMatch(/optional analytics/i);
  });

  it('describes the verified non-renewing retention setting accurately', () => {
    expect(privacyHtml).toContain('two-month retention period, without resetting that period on new activity');
    expect(privacyHtml).toContain('Most aggregate reports are unaffected');
  });

  it('does not embed vendor scripts', () => {
    expect(privacyHtml).not.toMatch(/<script\b/i);
  });

  it('retains consent, refusal and privacy behavior descriptions', () => {
    expect(privacyHtml).toMatch(/without allowing analytics/i);
    expect(privacyHtml).toMatch(/Refusing analytics does not disable them/i);
    expect(privacyHtml).toMatch(/Disabling analytics stops future optional measurement/i);
    expect(privacyHtml).toMatch(/Privacy choices/i);
  });
});
