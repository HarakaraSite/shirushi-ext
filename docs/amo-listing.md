# AMO Listing Draft

This document is the source copy for the public AMO listing.

## Basic information

| AMO field | Draft value |
|---|---|
| Name | Shirushi for Firefox |
| Add-on URL slug | `shirushi-for-firefox` (tentative; use an available unique slug) |
| Summary | Save the current page to your self-hosted Shirushi bookmarks, with notes, tags, and search. |
| Experimental | No |
| Requires payment or paid service | No. A user-operated Shirushi server is required. |
| Firefox categories | Select **Bookmarks** and, if useful, the closest available secondary category. |
| License | MIT |
| Support website | `https://forge.harakara.site/littleisland/shirushi-ext` |
| Support email | Omit; use the issue tracker. |
| Privacy policy | `https://forge.harakara.site/littleisland/shirushi-ext/src/branch/main/PRIVACY.md` |

## Description

**Save pages to your own Shirushi server.**

Shirushi for Firefox saves the current page to a self-hosted Shirushi bookmark server without leaving the page. Configure your server URL and `SHIRUSHI_API_TOKEN`, then save pages with an editable title, note or summary, and tags.

Features:

- Searches saved bookmarks inside the extension popup.
- Previews bookmark notes and summaries from search results.
- Uses the Firefox interface language: Japanese is available, and other languages fall back to English.
- Connects only to the HTTPS Shirushi server you select. It does not use a developer-operated backend.

Requirements:

- Firefox 140 or later.
- A reachable Shirushi v1.1.0 or later server over HTTPS.
- A Bearer token configured as `SHIRUSHI_API_TOKEN` on that server.

Data sent to the configured server: the Bearer token, current page URL and title, entered notes and tags, and bookmark search text. See the Privacy Policy for details.

## Screenshot checklist

Create 1280×800 px screenshots where possible. Do not show a real API token, private bookmark, or personal URL.

1. The save popup with a page title, note, and tags ready to save.
2. The popup search view with result cards and a note or summary preview.
3. The settings page with a redacted token and successful connection result.

## Notes for reviewers

```text
Source: https://forge.harakara.site/littleisland/shirushi-ext
Build: ./scripts/package-extension.sh public

This extension has no third-party libraries, remote scripts, analytics, or
developer-operated backend. It communicates only with the user-configured
HTTPS Shirushi server.

No externally reachable test server or production credential is provided: the
server is intentionally self-hosted and user-configured. Please review the
readable source and the reproducible public build. If live functional testing
is necessary, contact the developer through https://forge.harakara.site/littleisland/shirushi-ext/issues; do not use a
personal production Shirushi server or token.
```

## Submission checklist

- [x] Public repository URL and issue tracker are available.
- [x] `PRIVACY.md` has a stable public URL and is linked in the listing.
- [ ] Final screenshots are captured with redacted data.
- [ ] The public XPI from `./scripts/package-extension.sh public` is manually tested.
- [ ] Reviewer notes explain that no production server or credential is shared.
- [ ] AMO data-collection consent and optional host-permission dialogs are previewed on a fresh Firefox profile.
