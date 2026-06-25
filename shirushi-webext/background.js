// タグキャッシュ（小文字名 → {id, name}）
let tagCache = new Map();

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

async function handleSave({ url, title, excerpt, tags }) {
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
    return { ok: true, status: 201 };
  }
  return { ok: false, status: res.status, error: `保存に失敗しました（${res.status}）` };
}

async function handleMessage(message) {
  try {
    if (message.type === "getTags") {
      return await handleGetTags();
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
