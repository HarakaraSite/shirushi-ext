# Shirushi for Firefox

Save the current page to a self-hosted [Shirushi](https://shirushi.harakara.site/) bookmark server without leaving the page.

> This extension is being prepared for public release on Firefox Add-ons (AMO). It is not published on AMO yet.

## Features

- Save the current HTTP or HTTPS page with an editable title, note or summary, and tags.
- Search saved bookmarks from the extension popup and open the selected original page.
- Preview a bookmark's note or summary by hovering or focusing its search-result card.
- Follow Firefox's interface language: Japanese is available; other languages fall back to English.

## Requirements

- Firefox 140 or later.
- A reachable Shirushi server running v1.1.0 or later.
- A Bearer token configured as `SHIRUSHI_API_TOKEN` on that server.

## Setup

1. Install the extension from AMO once it is published.
2. Open the extension's **Settings**.
3. Enter the HTTPS URL of your Shirushi server and its `SHIRUSHI_API_TOKEN` value.
4. Save the settings and allow access to that server when Firefox asks.
5. Select **Test connection** to verify the configuration.

The extension requests access only when you choose a server. Firefox grants access for the selected scheme and hostname; Firefox does not support limiting this permission to one port.

## Permissions and data

The extension uses the following permissions:

- `activeTab` to read the active page's URL and title when you use the extension.
- `storage` to retain the server URL and API token locally in Firefox.
- Optional host access to communicate only with the Shirushi server you select.

The extension sends the current page URL, title, entered note, and tags, plus the Bearer token, to the configured Shirushi server. It does not send them to any other service. Treat the API token as a secret: the extension does not encrypt it before storing it in Firefox's extension storage.

## Development status

The current release target is Firefox only. Chrome and Edge support are not yet planned for a release.

For local HTTP development only, create a separate temporary-installation build with:

```sh
./scripts/package-extension.sh dev
```

The public AMO build is created with `./scripts/package-extension.sh public` and accepts HTTPS servers only.

## Privacy

See the [Privacy Policy](PRIVACY.md).

## Source and support

Source code and support: [forge.harakara.site/littleisland/shirushi-ext](https://forge.harakara.site/littleisland/shirushi-ext). Please report issues in the [issue tracker](https://forge.harakara.site/littleisland/shirushi-ext/issues).

## License

Distributed under the [MIT License](LICENSE).
