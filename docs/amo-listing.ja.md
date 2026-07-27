# AMO Listing 下書き

公開 AMO listing 用の原稿です。

## 基本情報

| AMO の項目 | 下書き |
|---|---|
| 名前 | Shirushi for Firefox |
| アドオン URL スラッグ | `shirushi-for-firefox`（仮。AMO で空いている一意な値を使う） |
| 概要 | 自分で運用する Shirushi へ、現在ページをメモ・タグ・検索付きで保存します。 |
| 実験的アドオン | いいえ |
| 支払い・有料サービス等が必要 | いいえ。利用者が運用する Shirushi サーバーは必要です。 |
| Firefox カテゴリ | **Bookmarks** を選択し、必要なら最も近い第2カテゴリを選ぶ。 |
| ライセンス | MIT |
| サポートサイト | `https://forge.harakara.site/littleisland/shirushi-ext` |
| サポートメール | 省略。Issue トラッカーを利用する。 |
| プライバシーポリシー | `https://forge.harakara.site/littleisland/shirushi-ext/src/branch/main/PRIVACY.md` |

## 説明

**自分の Shirushi サーバーへページを保存します。**

Shirushi for Firefox は、セルフホストした Shirushi ブックマークサーバーへ、現在のページを離れずに保存する拡張です。サーバー URL と `SHIRUSHI_API_TOKEN` を設定すると、編集可能なタイトル、メモまたは要約、タグとともにページを登録できます。

機能:

- 拡張のポップアップ内で保存済みブックマークを検索します。
- 検索結果でブックマークのメモ・要約をプレビューします。
- Firefox の表示言語に従います。日本語に対応し、その他の言語は英語へフォールバックします。
- 利用者が選んだ HTTPS の Shirushi サーバーとのみ通信します。開発者運用のバックエンドは使いません。

必要なもの:

- Firefox 140 以降
- HTTPS で接続できる Shirushi v1.1.0 以降のサーバー
- そのサーバーに設定した Bearer トークン `SHIRUSHI_API_TOKEN`

設定済みのサーバーへ、Bearer トークン、現在ページの URL・タイトル、入力したメモ・タグ、ブックマークの検索語を送信します。詳細はプライバシーポリシーを参照してください。

## スクリーンショットのチェックリスト

可能なら 1280×800 px で撮影します。実際の API トークン、非公開ブックマーク、個人 URL は写しません。

1. ページタイトル・メモ・タグを入力した、登録前のポップアップ。
2. 結果カードとメモ・要約のプレビューが見える、ポップアップ内の検索画面。
3. トークンをマスクし、接続成功を表示した設定画面。

## レビュー担当者向けメモ

```text
ソース: https://forge.harakara.site/littleisland/shirushi-ext
ビルド: ./scripts/package-extension.sh public

この拡張はサードパーティーライブラリ、リモートスクリプト、解析、
開発者運用のバックエンドを使いません。利用者が設定した HTTPS の
Shirushi サーバーとのみ通信します。

外部から到達できるテストサーバーや本番の認証情報は提供しません。サーバーは
利用者自身が運用・設定する設計です。読みやすいソースコードと再現可能な公開版
ビルドを確認してください。実機での機能確認が必要な場合は https://forge.harakara.site/littleisland/shirushi-ext/issues から開発者へ
連絡し、個人用の本番 Shirushi サーバーやトークンは使わないでください。
```

## 提出チェックリスト

- [x] 公開リポジトリ URL と Issue トラッカーを用意した。
- [x] `PRIVACY.md` に安定した公開 URL を付け、listing からリンクした。
- [ ] 最終スクリーンショットをマスク済みデータで撮影した。
- [ ] `./scripts/package-extension.sh public` の XPI を手動テストした。
- [ ] 本番サーバー・本番認証情報は共有しないことをレビュー担当者向けメモに記載した。
- [ ] 新しい Firefox プロファイルで、AMO のデータ送信同意と任意ホスト権限のダイアログを確認した。
