// タグキャッシュ（小文字名 → {id, name}）
let tagCache = new Map();

function t(key, substitutions) {
  return browser.i18n.getMessage(key, substitutions) || key;
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
    return { ok: false, error: t("notConfigured"), needsSetup: true };
  }

  const res = await apiFetch("/api/tags?all=1");

  if (res.status === 401) {
    return { ok: false, status: 401, error: t("invalidToken") };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: t("connectionFailedWithStatus", String(res.status)) };
  }

  const tags = await res.json();
  tagCache = new Map(tags.map(t => [t.name.toLowerCase(), t]));
  return { ok: true, tags };
}

async function handleSearchBookmarks(query) {
  const { baseUrl, apiToken } = await getSettings();
  if (!baseUrl || !apiToken) {
    return { ok: false, error: t("notConfigured"), needsSetup: true };
  }

  const q = String(query || "").trim();
  if (!q) {
    return { ok: true, bookmarks: [], total: 0 };
  }

  const res = await apiFetch(`/api/bookmarks?q=${encodeURIComponent(q)}&page=1&limit=20`);
  if (res.status === 401) {
    return { ok: false, status: 401, error: t("invalidToken") };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: t("searchFailedWithStatus", String(res.status)) };
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
        return { ok: false, status: 401, error: t("invalidToken") };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: t("tagCreateFailed", name) };
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
    return { ok: false, error: t("notConfigured"), needsSetup: true };
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
    return { ok: false, status: 401, error: t("invalidToken") };
  }
  if (res.status === 409) {
    return { ok: false, status: 409, error: t("bookmarkAlreadySaved") };
  }
  if (res.status === 201) return { ok: true, status: 201 };
  return { ok: false, status: res.status, error: t("saveFailedWithStatus", String(res.status)) };
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
    return { ok: false, error: t("unknownMessageType") };
  } catch (e) {
    return { ok: false, error: t("connectionFailed") };
  }
}

// トップレベルで登録（event page の取りこぼし防止）
browser.runtime.onMessage.addListener((message) => {
  return handleMessage(message);
});
