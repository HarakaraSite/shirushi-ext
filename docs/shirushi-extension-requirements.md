# shirushi Firefox 拡張 実装要件

shirushi にワンクリックでブックマークを登録する Firefox 拡張（Manifest V3 / WebExtensions）。

- 新規リポジトリ想定: `shirushi-webext`（将来 Chrome/Edge 対応も視野に入れた命名）
- 接続先: 本番 `https://shirushi.harakara.site`、開発 `http://localhost:8181`
- 前提: シングルユーザー、本体に Bearer トークン認証が入っていること（別紙 backend 要件 v1）

---

## 設計上の最重要原則

**popup からは fetch しない。ネットワークアクセスは全て background(event page) に集約する。**

Firefox MV3 では、popup や content script からのクロスオリジン fetch は `host_permissions` を宣言しても CORS で弾かれる。一方 **background 経由の fetch は `host_permissions` 宣言でバイパスできる**。そのため:

- popup: `tabs` API での url/title 取得、ユーザー入力、結果表示のみ（fetch しない）
- background: タグ一覧取得・タグ ID 解決・ブックマーク登録の全 fetch を担当
- 両者は `runtime.sendMessage` / `onMessage` でやり取りする

参考: https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/

---

## 構成

```
shirushi-webext/
├── manifest.json
├── background.js      # event page（全 fetch を担当）
├── popup.html         # ツールバーボタンの popup
├── popup.js
├── options.html       # 設定（baseURL / token）
├── options.js
└── icons/             # 拡張アイコン（16/48/96px 必須、AMO 審査用）
```

---

## manifest.json（MV3）

```json
{
  "manifest_version": 3,
  "name": "shirushi",
  "version": "0.1.0",
  "permissions": ["activeTab", "storage"],
  "host_permissions": [
    "https://shirushi.harakara.site/*",
    "http://localhost:8181/*"
  ],
  "background": { "scripts": ["background.js"] },
  "action": { "default_popup": "popup.html" },
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "browser_specific_settings": { "gecko": { "id": "shirushi@harakara.site" } }
}
```

- `activeTab`: アイコンクリック時だけ現タブの url/title にアクセス（最小権限、AMO 審査も通りやすい）
- `storage`: 設定の保存
- `host_permissions`: background fetch の CORS バイパス用。本番と開発の両方を宣言（options の baseURL 切り替えで使い分け）
- `background.scripts`: MV3 の非永続 background。**メッセージリスナーは必ずトップレベルで登録**（service worker/event page が寝ている間の取りこぼし防止）
- `browser_specific_settings.gecko.id`: 署名・AMO 公開に必要

> **本番ビルドでは `http://localhost:8181/*` を `host_permissions` から除外すること**。`web-ext` のビルドターゲットや環境変数で切り替える。AMO 審査での権限過剰を避けるため。

---

## 設定（options page）

`storage.local` に保存する項目:

| キー | 内容 | 例 |
|------|------|-----|
| `baseUrl` | shirushi のベース URL（末尾スラッシュなし） | `https://shirushi.harakara.site` |
| `apiToken` | Bearer トークン（本体の `SHIRUSHI_API_TOKEN` と同じ値） | `（openssl rand -hex 32 の値）` |

- options page で上記 2 つを入力・保存できる UI
- **`apiToken` の入力欄は前後の空白と `Bearer ` プレフィックスを自動除去して保存**（ユーザーが `Bearer xxx` と丸ごと貼り付けてしまう事故を防ぐ）
- 「接続テスト」ボタンがあると便利（background 経由で `GET /api/tags` を叩いて 200 が返るか確認）
- popup 起動時にこの 2 項目を読み込み、未設定なら popup に「設定が必要です」と表示して options へのリンクを出す
- **`storage.local` はディスク上平文保存となる**。トークン漏洩時は全ブックマークの読み書き・削除が可能なため、トークンは端末ローカルで厳重に管理すること（v1 時点のリスク受容）

---

## メッセージング契約

popup と background のやり取りは `runtime.sendMessage` / `onMessage` で行う。

### リクエスト形式

| type | 追加フィールド | 説明 |
|------|--------------|------|
| `"getTags"` | — | タグ一覧取得 |
| `"save"` | `url, title, excerpt, tags`（タグ名の配列） | ブックマーク登録 |

### レスポンス形式

background は常に以下のスキーマで返す:

```js
{
  ok: boolean,       // 成功なら true
  status?: number,   // HTTP ステータスコード（エラー時）
  error?: string,    // エラーメッセージ（エラー時）
  tags?: Array<{id: number, name: string}>  // getTags 成功時のみ
}
```

### background の onMessage 実装上の注意

**background の `onMessage` リスナーは非同期処理を含む場合、`return true` を返してチャネルを開いたまま保持すること。** これを忘れると popup 側の `sendMessage` が `undefined` で即解決し、無言の失敗になる。

```js
// 正しい実装パターン
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // 非同期レスポンスを保持
});
```

---

## background の fetch ラッパ

全 fetch に共通の処理を集約する fetch ラッパを background に用意する。

- `Authorization: Bearer <token>` ヘッダを付与
- **401 レスポンスを横断的に捕捉し、`{ok: false, status: 401, error: "トークンが不正です。設定を確認してください"}` を返す**（`getTags`・`POST /api/tags`・`POST /api/bookmarks` どこで発生しても同じ処理）
- `storage.local` から baseUrl/token を都度読み込む（event page の再起動後も正しく動くよう、リスナー内で毎回取得する）
- fetch 自体の失敗（ネットワークエラー等）は `{ok: false, error: "接続に失敗しました"}` で返す

```js
async function apiFetch(path, options = {}) {
  const { baseUrl, apiToken } = await browser.storage.local.get(["baseUrl", "apiToken"]);
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiToken}`,
      ...options.headers,
    },
  });
  return res;
}
```

---

## 設定（options page）

（上記「設定」セクション参照）

---

## popup の挙動

### 起動時

1. `tabs.query({active:true, currentWindow:true})` で現在タブの `url` と `title` を取得して表示
   - **title は input で編集可能**（長いタイトルを縮めたいケースに対応）
   - title が空の場合は空文字のまま表示し、ユーザーが手入力できるようにする
   - **url は表示のみ**（編集不可）
   - **url が `http` / `https` 以外（`about:`・`moz-extension:` 等）の場合は登録ボタンを無効化**し「このページは登録できません」と表示する
2. background に `{type:"getTags"}` を送信 → タグ一覧（`[{id,name}]`）を受け取り、サジェスト用にメモリ保持
   - `getTags` が失敗した場合（401・ネットワークエラー等）はエラーメッセージを表示し、設定または接続テストへ誘導する。タグサジェストは空で動作継続する。
3. 設定（baseUrl/token）未設定なら登録 UI を出さず設定誘導

### 入力欄

- メモ（`excerpt` にマップ、任意）
- タグ入力（任意、複数）

### タグ入力 UI（サジェスト機能）

- 入力中に保持済みタグ一覧からインクリメンタルにサジェスト（例: `b` と打つと `book` が候補に出る）
- タグ名の一致判定は**大文字小文字を区別しない前方一致**とする
- 同じタグを 2 回追加しようとした場合は無視する（大文字小文字を区別しない）
- 候補選択 or 自由入力でタグを追加（チップ/ピル表示で複数タグを可視化）
- 既存タグ（一覧に名前が一致）は ID 既知、新規タグは名前のみ保持

### 登録ボタン

- background に `{type:"save", url, title, excerpt, tags}` を送信（tags はタグ名の配列でよい）
- **送信中は登録ボタンを無効化し二重送信を防ぐ**
- background からの結果でメッセージ表示（下記エラーハンドリング）

---

## background の挙動

トップレベルで `runtime.onMessage` リスナーを登録。上記 fetch ラッパ経由で全リクエストを送る。

### `getTags`

- `GET {baseUrl}/api/tags?all=1` → タグ一覧 `[{id,name}]` を popup に返す
- `all=1` で未使用タグも含める

### `save`（A2 方式：タグ ID 解決をクライアント側で行う）

タグ名 → ID 解決のロジックが肝。`POST /api/tags` は冪等（同名なら既存タグを返す）なので、これを利用する。

1. **タグ ID 解決**: 受け取ったタグ名それぞれについて
   - 保持済み一覧に**名前が一致するものがあれば、その ID を使う**（API を叩かない）
   - 一覧に**ない新規タグだけ** `POST {baseUrl}/api/tags`（body: `{"name":"..."}`）を叩いて ID を取得
   - `POST /api/tags` の成否は **`res.ok` で判定する**（冪等のため既存返却時に `200` / `201` どちらが返っても正しく動くよう、ステータスコードの厳密比較は行わない）
   - **タグ ID 解決が 1 件でも失敗した場合は、ブックマーク登録に進まず中断し popup にエラーを返す**

2. **登録**: 全タグの ID が揃ったら
   - `POST {baseUrl}/api/bookmarks`
   - body: `{ "url", "title", "excerpt", "tags": [{"id":N}, ...] }`

3. レスポンスのステータスを popup に返す

> **A2 方式の安全網**: popup 起動時のタグキャッシュは最新でない可能性があるが、`POST /api/tags` の冪等性により、キャッシュに存在しない既存タグを新規扱いで叩いても正しい ID が返る。この冪等性を前提として A2 方式は成り立つ。
>
> この A2 方式は v2 で本体に「タグ名対応（A1）」が入れば不要になり、タグ名をそのまま `POST /api/bookmarks` に渡せるようになる。

---

## エラーハンドリング（案A：登録ボタン押下後に分岐表示）

`POST /api/bookmarks` のレスポンスで分岐:

| ステータス | popup の表示 |
|-----------|-------------|
| 201 | 「保存しました」 |
| 409 | 「このページは登録済みです」 |
| 401 | 「トークンが不正です。設定を確認してください」 |
| その他 | 「保存に失敗しました」（ステータス/メッセージを添える） |

- 起動時の登録済み事前チェックは v1 では**やらない**（二重登録は 409 で確実に防げる。事前チェックは URL 正規化が必要で、v2 のアイコンバッジとまとめて対応）

---

## API リファレンス（本体側、抜粋）

詳細は shirushi の API リファレンス参照。拡張が使うのは以下:

### `GET /api/tags?all=1`
→ `200` `[{ "id":1, "name":"go" }, ...]`（0 件なら `[]`）

### `POST /api/tags`（冪等）
body: `{ "name": "newtag" }`
→ `res.ok` であればタグ取得成功（`{ "id":5, "name":"newtag" }`）。同名既存タグの場合も既存タグを返す。ステータスコード（200/201）は問わない。

### `POST /api/bookmarks`
body: `{ "url", "title", "excerpt", "author", "image_url", "tags":[{"id":N}] }`
（`url` 以外は任意。`url` は http/https のみ）
→ `201` 作成された bookmark / `400` URL 不正 / `409` URL 重複

全エンドポイントに `Authorization: Bearer <token>` が必要。

---

## v1 完成の定義

1. options に baseUrl/token を設定できる（`Bearer ` プレフィックス自動除去付き）
2. 任意のページでアイコンをクリック → popup に url/title が出る（title 編集可）
3. 非 http/https ページでは登録ボタンが無効になる
4. メモ・タグ（サジェスト付き）を入れて登録ボタン → shirushi に登録される
5. 既存タグは API を増やさず ID 解決、新規タグのみ `POST /api/tags`（失敗時は中断）
6. 201/409/401/その他 が popup に適切に表示される
7. 本番（harakara.site）・開発（localhost）の両方に向けられる

---

## v2（将来の方針・今回は実装しない）

### 1. タグ名対応（A1）への移行

本体に `POST /api/bookmarks` のタグ名対応が入ったら、background の「タグ ID 解決」ロジックを削除し、タグ名をそのまま渡す形に簡素化する。

### 2. アイコンバッジ（登録済み表示）

shiori の拡張のように、開いているページが登録済みならツールバーアイコンの見た目を変えて一目で分かるようにする。

- 監視: `tabs.onUpdated` と `tabs.onActivated`（**リスナーはトップレベル登録**。MV3 event page で取りこぼさないため）
- 判定: 本体の `GET /api/bookmarks/exists?url=`（v2 で追加するエンドポイント）で登録有無を取得
- 表示: 登録済みなら `action.setBadgeText({text:"✓"})` + `action.setBadgeBackgroundColor()`、未登録ならバッジを消す（または `action.setIcon()` でアイコン差し替え）
- 注意: 全タブで頻繁に走るため、URL 正規化のブレで誤判定すると逆にストレスになる。本体の exists エンドポイントが正規化を担保する前提

### 3. Chrome/Edge 対応

WebExtensions API ベースなので、manifest の差分（Chrome は background を `service_worker` 指定）程度で展開可能。`web-ext` のビルドターゲット切り替えで対応する。

### 4. OGP メタデータの活用

`POST /api/fetch-metadata` を使い、タブの title よりクオリティの高い og:title・og:description を自動取得してフォームに反映する。

### 5. 限定スコープトークン（backend 要望）

現在のトークンは全 API（削除・インポート含む）に対して有効。拡張が使うのは読み取り＋作成のみなので、本体側で権限を限定したトークンを発行できると理想的。

---

## 参考リンク

- WebExtensions API 一覧: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API
- tabs API: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs
- MV3 移行ガイド（background 経由 fetch の項）: https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/
- web-ext（ビルド/署名 CLI）: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
- storage.local: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local
- action.setBadgeText: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action/setBadgeText
- tabs.onUpdated: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onUpdated
