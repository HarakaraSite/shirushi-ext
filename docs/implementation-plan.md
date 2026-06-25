# shirushi Firefox 拡張 実装計画

## 0. 全体方針と着手前の確認事項

- **ビルドツールなし・Vanilla JS・ファイル直書き**
- 配置は `shirushi-webext/`（`docs/` と並列）
- `browser.*`（Promiseベース）に統一。Chrome互換は今回スコープ外

着手前の確認事項:

- `GET /api/tags` のサジェスト用途では **`?all=1`** を付ける（未使用タグも含める）。接続テストも同パスでよい
- `browser` 名前空間と `chrome` 名前空間は混在させず `browser.*` に統一

---

## 1. ファイル構成と各ファイルの責務

```
shirushi-webext/
├── manifest.json
├── background.js
├── popup.html
├── popup.js
├── options.html
├── options.js
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-96.png
```

### manifest.json

要件書のJSONをそのまま採用。`action.default_icon` と `icons` も追加。
本番ビルドでは `http://localhost:8181/*` を `host_permissions` から除外する（後述）。

### background.js（ネットワークの単一窓口）

全 fetch を集約。popup/options からのメッセージを受けて処理し、応答を返す。

| 関数 | 役割 |
|------|------|
| `apiFetch(path, options)` | `storage.local` から `baseUrl`/`apiToken` を読み、ヘッダ付与して `fetch`。返り値は `Response` |
| `getSettings()` | `baseUrl`/`apiToken` を取得し、未設定判定（どちらか空なら未設定） |
| `handleGetTags()` | `GET /api/tags?all=1` を叩き `{ ok, tags }` を返す。成功時はタグを **メモリキャッシュ `tagCache`（Map<lowercase name, {id,name}>）** に格納 |
| `resolveTagIds(tagNames)` | 各タグ名について `tagCache` を引き、なければ `POST /api/tags` → `res.ok` 判定 → キャッシュ更新。1件でも失敗で中断 |
| `handleSave({url,title,excerpt,tags})` | `resolveTagIds` でタグID解決 → `POST /api/bookmarks` 送信 |
| `classifyError(res)` | 401横断捕捉・ネットワーク例外捕捉の共通処理 |

主要状態変数: `let tagCache = new Map();`（event page は揮発しうるが、消えても `getTags`/`POST /api/tags` で再構築されるため機能上問題なし）

`browser.runtime.onMessage.addListener` はトップレベルで登録。非同期なので **`return true`** を返す（後述）。

### popup.html

| 要素ID | 役割 |
|--------|------|
| `#page-title` | input（タイトル編集可） |
| `#page-url` | 表示専用（非httpなら警告） |
| `#excerpt` | textarea（メモ） |
| `#tag-input` | タグ入力 |
| `#tag-suggest` | サジェスト候補リスト |
| `#tag-chips` | 選択済みタグのチップ表示エリア |
| `#save-btn` | 登録ボタン |
| `#status` | 結果・エラー・設定誘導の表示領域 |
| `#open-options` | 設定ページを開くリンク/ボタン |

### popup.js（UIロジックのみ、fetchしない）

| 関数 | 役割 |
|------|------|
| `init()` | DOMContentLoaded で実行。tabs取得・URLスキーム判定・getTags送信 |
| `isSavableUrl(url)` | `http:`/`https:` のみ true |
| `onTagInput()` | 前方一致フィルタ（大文字小文字無視）でサジェスト描画 |
| `addTag(name)` | 小文字比較で重複チェック後チップ追加 |
| `removeTag(name)` | チップ削除 |
| `renderChips()` | `selectedTags` を元にチップ再描画 |
| `onSave()` | 二重送信防止 → `sendMessage({type:"save",...})` → 結果分岐表示 |
| `showResult(response)` | status/ok/error に応じてメッセージ表示 |
| `openOptions()` | `runtime.openOptionsPage()` |

主要状態変数: `let allTags = [];`（getTags 結果）、`let selectedTags = [];`（選択済みタグ名配列）

### options.html

| 要素ID | 役割 |
|--------|------|
| `#base-url` | input（baseUrl） |
| `#api-token` | input type=password（apiToken） |
| `#save-settings` | 保存ボタン |
| `#test-conn` | 接続テストボタン |
| `#options-status` | 保存結果・接続テスト結果の表示 |

### options.js

| 関数 | 役割 |
|------|------|
| `load()` | `storage.local.get` でフォーム初期化 |
| `onSave()` | baseUrl/apiToken を正規化して `storage.local.set` |
| `onTestConnection()` | `sendMessage({type:"getTags"})` で疎通確認 |

---

## 2. 実装順序

```
1. manifest.json + icons + 空 background.js
        ↓  web-ext run でロード確認（土台）
2. options.html / options.js
        ↓  設定保存・正規化を完成（疎通の前提）
3. background.js — apiFetch → handleGetTags
        ↓  接続テストで 401/ネットワークエラー/正常の3経路確認
4. background.js — handleSave / resolveTagIds
        ↓  POST /api/tags の冪等性と POST /api/bookmarks の 201/409 確認
5. popup.html / popup.js
           tabs取得 → タグUI → save → エラー分岐
```

この順なら「ネットワーク層が動く」ことを早期に確定でき、UIの不具合と通信の不具合を切り分けやすい。

---

## 3. 各ファイルの実装ポイントと注意点

### background.js

**onMessage の非同期応答**

非同期処理を含む場合、以下のどちらかに統一する（混在禁止）。

```js
// パターンA: return true + sendResponse
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

// パターンB: Promise を直接返す（Firefox MV3 推奨）
browser.runtime.onMessage.addListener((message) => {
  return handleMessage(message);
});
```

**401横断捕捉**

`apiFetch` 直後に全ハンドラ共通で処理する:

```js
if (res.status === 401) {
  return { ok: false, status: 401, error: "トークンが不正です。設定を確認してください" };
}
```

**ネットワーク例外**

全ハンドラを try/catch で囲む:

```js
} catch (e) {
  return { ok: false, error: "接続に失敗しました" };
}
```

**未設定ガード**

`baseUrl`/`apiToken` が空なら fetch せず返す:

```js
return { ok: false, error: "未設定", needsSetup: true };
```

**resolveTagIds の注意点**

- キャッシュキーは **タグ名の小文字** で統一（GET のキャッシュ格納も save 時の解決も同じ正規化）
- `POST /api/tags` の成否は **`res.ok`（200–299）で判定**（`status === 201` 固定は不可）
- 1件でも失敗したら **ブックマーク登録せず中断**してエラーを返す
- タグ0件のブックマークも許容（`tags:[]` で送信、API は省略可）

**POST /api/bookmarks ボディ**

```js
{ url, title, excerpt, author: "", image_url: "", tags: [{id}, ...] }
```

**エラーメッセージの集約**

文言は background か popup のどちらか一方に集約して二重管理を避ける（background で `error` 文字列を組み立てて返す方式を推奨）。

### popup.js

**URLスキーム判定**

```js
function isSavableUrl(url) {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
```

非対応の場合は `#save-btn.disabled = true` + 「このページは登録できません」を `#status` に表示。

**getTags 失敗時もUI継続**

サジェストは空配列で動作、チップ追加・手入力は可能。エラー＋設定誘導だけ表示する。

**タグ前方一致サジェスト**

```js
allTags.filter(t => t.name.toLowerCase().startsWith(input.toLowerCase()))
```

重複追加は `selectedTags.some(t => t.toLowerCase() === name.toLowerCase())` で無視。

**未確定のタグ入力**

`#tag-input` に入力途中のテキストが残っている場合は、登録ボタン押下時に確定タグとして含める（入力取りこぼし防止）。

**二重送信防止**

```js
async function onSave() {
  saveBtn.disabled = true;
  try {
    const res = await browser.runtime.sendMessage({...});
    showResult(res);
  } finally {
    // 成功時は復帰しない（または window.close()）、失敗時は復帰
    if (!res?.ok) saveBtn.disabled = false;
  }
}
```

### options.js

**token 正規化の順序**

```js
apiToken.trim().replace(/^bearer\s+/i, "").trim()
```

**baseUrl 正規化**

```js
baseUrl.trim().replace(/\/+$/, "")
```

**接続テスト**

- 直接 fetch 禁止。必ず `sendMessage({type:"getTags"})` で background 経由
- 「保存してからテスト」を促すか、テストボタンが保存も兼ねる設計に統一

### manifest.json / ビルド

本番ビルドでは `host_permissions` から `http://localhost:8181/*` を除外。
バンドラ不使用なので `manifest.prod.json` を用意してビルド時にコピーする運用が単純:

```bash
cp manifest.prod.json manifest.json
web-ext build
```

---

## 4. テスト・動作確認手順

### 準備

```bash
npm install -g web-ext
cd shirushi-webext
web-ext lint          # manifest/構文チェック
```

### 開発ループ

```bash
web-ext run --verbose
# ファイル変更で自動リロード
```

- **background ログ**: `about:debugging#/runtime/this-firefox` → 拡張の「検査」
- **popup ログ**: popup を開いた状態で「検査」

### 動作確認シナリオ（v1完成の定義に対応）

ローカルの shirushi を `SHIRUSHI_API_TOKEN` 付きで起動しておく（`http://localhost:8181`）。

| # | シナリオ | 期待結果 |
|---|---------|---------|
| 1 | options で `baseUrl=http://localhost:8181`、token を `Bearer xxx` 形式で貼り付け → 保存 | storage に `Bearer ` 除去済みの値が入っている |
| 2 | 接続テスト | 「接続成功（タグN件）」 |
| 3 | わざと誤ったtokenで接続テスト | 401「トークンが不正です」 |
| 4 | 通常ページで popup を開く | url/title 表示、title 編集可 |
| 5 | `about:config` を開いた状態で popup | 登録ボタン無効 + 「このページは登録できません」 |
| 6 | 既存タグ名を途中まで入力 | 大文字小文字無視の前方一致でサジェスト表示、重複追加無視 |
| 7 | メモ + 既存タグ + 新規タグで登録 | 新規タグのみ `POST /api/tags` が走り、201「保存しました」 |
| 8 | 同じURLを再登録 | 409「このページは登録済みです」 |
| 9 | tokenを一時無効化して新規タグ付き登録 | タグ解決で中断、ブックマーク未登録、401表示 |
| 10 | baseUrl を本番に変えて疎通 | 正常登録 |

---

## 5. 要件書・APIリファレンスとの差分メモ（実装者向け）

| 項目 | 補足 |
|------|------|
| `GET /api/tags` | 要件書の擬似コードはクエリなしだが、**`?all=1`** を使う（未使用タグもサジェストに出すため） |
| `POST /api/tags` 判定 | **`res.ok` で判定**。`status === 201` 固定は不可（api.md で明記済み） |
| `POST /api/bookmarks` 400 | popupで http/https を弾いているので通常到達しないが、「保存に失敗しました（status付記）」で受ける |
| `401` | 全エンドポイント共通。background の fetch ラッパで横断捕捉 |
| `POST /api/tags` 冪等性 | A2方式の安全網。キャッシュにない既存タグを新規扱いで叩いても正しいIDが返る前提 |
