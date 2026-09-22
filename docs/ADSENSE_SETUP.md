# Dropfall AdSense setup

Updated 10 September 2026.

## Current activation note — 10 September 2026

Dropfall Game Studio is the public brand and the intended audience is general. Privacy questions, access requests and deletion requests should use `dropfallgamestudio@gmail.com`. Production analytics is enabled for the library and Dropfall Arena only; deployment `b5418115-93ca-4ab1-9a15-942063073976` succeeded with `VITE_DROPFALL_ANALYTICS_ENABLED=true`, and Google Analytics receipt was verified in the dedicated account/property (2 `page_view`, 1 `library_view`, 1 `game_ready`). The two active users were separate product identifiers in the test browser, not two people. Other games remain disabled. Ads remain off; AdSense is **Getting ready**, and H5/CMP work is pending.

## Verified account

- Owner supplied and authorized publisher `pub-7669551026428141` (client `ca-pub-7669551026428141`).
- Authenticated dashboard shows the Dropfall studio identity and only `dropfall-game.com` in the site list. No PDS account, tag, audience or payment credentials are reused by this setup.
- Initial site status: **Requires review**; ads.txt: **Not found**. Auto ads: **off**. Account existence is not site approval or H5 approval.

## Implementation

The library head contains Google's non-executing `google-adsense-account` verification meta tag. `public/ads.txt` publishes only:

```text
google.com, pub-7669551026428141, DIRECT, f08c47fec0942fa0
```

Vite copies this to `dist/ads.txt`; existing server routing serves `/ads.txt` as `text/plain`. The dedicated Arena hostname serves the same file. The other games remain separate deployments and are not instrumented by a library file.

No advertising SDK, Auto ads or interstitial is loaded. No paid ad impressions/clicks are generated during testing. No ad consent is inferred from the existing analytics choice. No payment profile, legal entity, terms acceptance or H5 application is submitted on the owner's behalf.

## Remaining activation gates

1. Publish verification artifacts, verify in AdSense, and request site review. Record the resulting dashboard state below. Google must mark the site **Ready** before ad serving.
2. Confirm the actual operating business/payee and complete the privacy/CMP work. The public brand is Dropfall Game Studio; this runbook does not infer a legal entity or claim legal compliance.
3. Configure a suitable certified consent-management platform in Privacy & messaging. The optional analytics dialog is not a certified advertising CMP. Validate refusal, revocation, regional behavior and absence of ad requests before the permitted choice.
4. After approval, create an explicit display unit for the library below the collection, separated from Play controls. Do not turn on uncontrolled Auto ads over game canvases.
5. Apply separately for **H5 Games Ads** for approved post-match in-game interstitials/rewarded placements. Ordinary AdSense approval does not grant H5 access. Follow the per-game exclusions, frequency limits and ad-free suppression in `DROPFALL_REVENUE_ANALYTICS.md`.
6. Implement and validate each separate game deployment; keep paid/ad-free, child-directed/unknown eligibility, live multiplayer and unavailable/declined consent paths free of ad requests. Do not claim all four games monetized from one library integration.

## Release evidence

Railway deployment `82ec2096-1de5-401d-b4dd-15a44477e789` reached **SUCCESS**. Public checks confirmed `/ads.txt` returns 200, `text/plain; charset=utf-8`, and the exact dedicated record; the homepage contains the matching verification meta tag and no AdSense loader. Validation: 525 tests in 37 files, type-check, production build and diff check passed. The empty online scoreboard and all 12 levels matched source before deployment.

AdSense confirmed **Your site is verified**. The review request was submitted successfully; the authenticated dashboard now shows **Getting ready** and **Review requested**. This is not approval to serve ads. The CMP prompt offered Google's two-choice/three-choice message or another certified CMP; publication was deferred with "Remind me later" pending the owner's privacy/audience details. Prefer the three-choice version (consent, do not consent, manage options) when configured and validated; no CMP is claimed as live.

## Official references

- [Site verification and review](https://support.google.com/adsense/answer/12169212?hl=en): supports non-executing meta-tag and ads.txt verification.
- [H5 Games Ads application](https://developers.google.com/ad-placement/docs/signup): separate by-application access; approval not guaranteed.
- [Google publisher CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en): certified consent requirements for EEA/UK/Switzerland.

This is an implementation/status runbook, not a declaration of legal compliance or guaranteed revenue.
