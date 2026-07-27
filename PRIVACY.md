# Privacy Policy for Shirushi for Firefox

Last updated: 2026-07-27

Shirushi for Firefox connects only to the Shirushi server that you configure. It has no developer-operated backend, analytics service, advertising service, or third-party data recipient.

## Data the extension sends

To provide its bookmark features, the extension sends the following data to your configured Shirushi server:

- The server URL and Bearer token are used to establish and authenticate the connection.
- The URL and title of the active page, and the note and tags you enter, are sent when you save a bookmark.
- Search text is sent when you search your saved bookmarks.
- Bookmark and tag data returned by your Shirushi server is displayed in the extension.

Firefox identifies this as transmission of authentication information, browsing activity, and website content. The extension declares these required data types in its manifest so Firefox can present its built-in consent notice during installation.

## Local storage and retention

The extension stores your configured server URL and Bearer token in Firefox's local extension storage. It does not independently encrypt the token. Data sent to Shirushi is retained according to the configuration and operation of your own Shirushi server; this extension does not control that retention.

## Your controls

You can change or remove the server URL and token in the extension settings, revoke the server permission from Firefox's Add-ons Manager, or uninstall the extension. These actions stop future communication from the extension to that server. Removing data already stored by Shirushi must be done through that Shirushi server.

## Security

The public release accepts only HTTPS Shirushi servers. This protects the Bearer token and bookmark data while they are transmitted. A separate development build may allow HTTP only for local development and is not distributed through AMO.

## Changes and contact

Changes to this policy will be recorded in this repository. For questions, please use the [project issue tracker](https://forge.harakara.site/littleisland/shirushi-ext/issues).
