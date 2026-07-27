// タグキャッシュ（小文字名 → {id, name}）
let tagCache = new Map();

// 未登録時は同じ「印」を抑えたグレーで、登録済み時は本体の赤い favicon で示します。
const actionIcons = {
  unsaved: "icons/shirushi-muted.svg",
  saved: "icons/shirushi.svg",
};

// 非同期の照会がページ遷移より後に完了して、古いURLの状態でアイコンを上書きしないための世代番号です。
const tabCheckVersions = new Map();

function isHTTPURL(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

async function setTabIcon(tabId, saved) {
  await browser.action.setIcon({
    tabId,
    path: saved ? actionIcons.saved : actionIcons.unsaved,
  });
  await browser.action.setTitle({
    tabId,
    title: saved ? "shirushi（登録済み）" : "shirushi",
  });
}

async function updateTabIcon(tabId, url) {
  const version = (tabCheckVersions.get(tabId) || 0) + 1;
  tabCheckVersions.set(tabId, version);

  // about: や file: など、Shirushiへ保存できないページは未登録表示に戻します。
  if (!isHTTPURL(url)) {
    await setTabIcon(tabId, false);
    return;
  }

  const { baseUrl, apiToken } = await getSettings();
  if (!baseUrl || !apiToken) {
    await setTabIcon(tabId, false);
    return;
  }

  try {
    const res = await apiFetch(`/api/bookmarks/by-url?url=${encodeURIComponent(url)}`);
    // より新しいページ遷移・保存処理があれば、この古い結果は反映しません。
    if (tabCheckVersions.get(tabId) !== version) return;
    await setTabIcon(tabId, res.status === 200);
  } catch {
    // 接続失敗時に登録済みと誤表示しないよう、未登録色へ戻します。
    if (tabCheckVersions.get(tabId) === version) {
      await setTabIcon(tabId, false);
    }
  }
}

async function updateActiveTabIcon(tabId) {
  try {
    const tab = await browser.tabs.get(tabId);
    await updateTabIcon(tabId, tab.url || "");
  } catch {
    // 閉じたタブなどは何もしません。
  }
}

async function refreshActiveTabIcons() {
  const tabs = await browser.tabs.query({ active: true });
  await Promise.all(tabs.map((tab) => {
    if (!Number.isInteger(tab.id)) return undefined;
    return updateTabIcon(tab.id, tab.url || "");
  }));
}

async function getSettings() {
  const { baseUrl, apiToken } = await browser.storage.local.get(["baseUrl", "apiToken"]);
  return { baseUrl: baseUrl || "", apiToken: apiToken || "" };
}

async function apiFetch(path, options = {}) {
  const { baseUrl, apiToken } = await getSettings();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiToken}`,
      ...(options.headers || {}),
    },
  });
  return res;
}

async function handleGetTags() {
  const { baseUrl, apiToken } = await getSettings();
  if (!baseUrl || !apiToken) {
    return { ok: false, error: "未設定", needsSetup: true };
  }

  const res = await apiFetch("/api/tags?all=1");

  if (res.status === 401) {
    return { ok: false, status: 401, error: "トークンが不正です。設定を確認してください" };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: `接続に失敗しました（${res.status}）` };
  }

  const tags = await res.json();
  tagCache = new Map(tags.map(t => [t.name.toLowerCase(), t]));
  return { ok: true, tags };
}

async function handleSearchBookmarks(query) {
  const { baseUrl, apiToken } = await getSettings();
  if (!baseUrl || !apiToken) {
    return { ok: false, error: "未設定", needsSetup: true };
  }

  const q = String(query || "").trim();
  if (!q) {
    return { ok: true, bookmarks: [], total: 0 };
  }

  const res = await apiFetch(`/api/bookmarks?q=${encodeURIComponent(q)}&page=1&limit=20`);
  if (res.status === 401) {
    return { ok: false, status: 401, error: "トークンが不正です。設定を確認してください" };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: `検索に失敗しました（${res.status}）` };
  }

  const result = await res.json();
  return { ok: true, bookmarks: result.bookmarks || [], total: result.total || 0 };
}

async function resolveTagIds(tagNames) {
  const ids = [];
  for (const name of tagNames) {
    const key = name.toLowerCase();
    if (tagCache.has(key)) {
      ids.push({ id: tagCache.get(key).id });
    } else {
      const res = await apiFetch("/api/tags", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (res.status === 401) {
        return { ok: false, status: 401, error: "トークンが不正です。設定を確認してください" };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: `タグの作成に失敗しました（${name}）` };
      }
      const tag = await res.json();
      tagCache.set(key, tag);
      ids.push({ id: tag.id });
    }
  }
  return { ok: true, ids };
}

async function handleSave({ url, title, excerpt, tags, tabId }) {
  const { baseUrl, apiToken } = await getSettings();
  if (!baseUrl || !apiToken) {
    return { ok: false, error: "未設定", needsSetup: true };
  }

  // タグID解決（1件でも失敗したら中断）
  const tagResult = await resolveTagIds(tags || []);
  if (!tagResult.ok) {
    return tagResult;
  }

  const res = await apiFetch("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      url,
      title,
      excerpt,
      author: "",
      image_url: "",
      tags: tagResult.ids,
    }),
  });

  if (res.status === 401) {
    return { ok: false, status: 401, error: "トークンが不正です。設定を確認してください" };
  }
  if (res.status === 409) {
    return { ok: false, status: 409, error: "このページは登録済みです" };
  }
  if (res.status === 201) {
    if (Number.isInteger(tabId)) {
      // 保存直後は次のタブ遷移を待たず、登録済みの favicon に切り替えます。
      tabCheckVersions.set(tabId, (tabCheckVersions.get(tabId) || 0) + 1);
      await setTabIcon(tabId, true);
    }
    return { ok: true, status: 201 };
  }
  return { ok: false, status: res.status, error: `保存に失敗しました（${res.status}）` };
}

async function handleMessage(message) {
  try {
    if (message.type === "getTags") {
      return await handleGetTags();
    }
    if (message.type === "searchBookmarks") {
      return await handleSearchBookmarks(message.query);
    }
    if (message.type === "save") {
      return await handleSave(message);
    }
    return { ok: false, error: "不明なメッセージタイプ" };
  } catch (e) {
    return { ok: false, error: "接続に失敗しました" };
  }
}

// トップレベルで登録（event page の取りこぼし防止）
browser.runtime.onMessage.addListener((message) => {
  return handleMessage(message);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    updateTabIcon(tabId, changeInfo.url).catch(() => {});
  }
});

browser.tabs.onActivated.addListener((activeInfo) => {
  updateActiveTabIcon(activeInfo.tabId).catch(() => {});
});

// 拡張を再読み込みした直後も、各ウィンドウのアクティブタブを表示更新します。
refreshActiveTabIcons().catch(() => {});

// 設定画面で接続先またはトークンを保存したら、開いているタブの表示も更新します。
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.baseUrl || changes.apiToken)) {
    refreshActiveTabIcons().catch(() => {});
  }
});
