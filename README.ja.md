# Shirushi for Firefox

セルフホストした [Shirushi](https://shirushi.harakara.site/) サーバーへ、現在開いているページを離れずに登録する Firefox 拡張です。

> この拡張は Firefox Add-ons（AMO）での公開を準備中です。まだ AMO では公開していません。

## 機能

- 現在の HTTP/HTTPS ページを、編集可能なタイトル・メモまたは要約・タグとともに登録します。
- 拡張のポップアップ内で保存済みブックマークを検索し、選択した元ページを開けます。
- 検索結果のカードにホバーまたはキーボードフォーカスすると、メモまたは要約をプレビューできます。
- Firefox の表示言語に従います。日本語に対応し、それ以外の言語は英語へフォールバックします。

## 必要なもの

- Firefox 140 以降
- 接続可能な Shirushi v1.1.0 以降のサーバー
- サーバーに設定した Bearer トークン `SHIRUSHI_API_TOKEN`

## 設定

1. AMO 公開後に拡張をインストールします。
2. 拡張の「設定」を開きます。
3. Shirushi サーバーの HTTPS URL と、サーバーに設定した `SHIRUSHI_API_TOKEN` の値を入力します。
4. 保存し、Firefox から求められたらそのサーバーへのアクセスを許可します。
5. 「接続テスト」で設定を確認します。

アクセス許可は、利用者がサーバーを選んだときだけ求めます。Firefox の仕様により、許可は選択したスキームとホスト名に対して行われ、ポート単位には制限できません。

## 権限とデータ

この拡張は次の権限を使います。

- `activeTab`: 拡張を使ったときに現在のページの URL・タイトルを読みます。
- `storage`: サーバー URL と API トークンを Firefox 内にローカル保存します。
- 任意のホスト権限: 利用者が選択した Shirushi サーバーとの通信だけに使います。

設定済みの Shirushi サーバーへ、現在ページの URL・タイトル、入力したメモ・タグ、および Bearer トークンを送信します。他のサービスには送信しません。API トークンは秘密情報として扱ってください。拡張は Firefox の拡張ストレージへ保存する前に、トークンを独自に暗号化しません。

## 開発状況

現在の公開対象は Firefox のみです。Chrome と Edge への対応は、まだリリース予定に含めていません。

ローカル HTTP を使う開発時だけは、次のコマンドで一時登録用の開発版を作成できます。

```sh
./scripts/package-extension.sh dev
```

AMO 提出用の公開版は `./scripts/package-extension.sh public` で作成し、HTTPS サーバーだけを受け付けます。

## プライバシー

[プライバシーポリシー](PRIVACY.ja.md) を参照してください。

## ソースとサポート

ソースコードとサポート窓口は [forge.harakara.site/littleisland/shirushi-ext](https://forge.harakara.site/littleisland/shirushi-ext) です。問題は [Issue トラッカー](https://forge.harakara.site/littleisland/shirushi-ext/issues)へ報告してください。

## ライセンス

[MIT License](LICENSE) のもとで配布します。
