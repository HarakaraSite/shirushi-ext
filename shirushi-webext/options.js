const elBaseUrl = document.getElementById("base-url");
const elApiToken = document.getElementById("api-token");
const elSave = document.getElementById("save-settings");
const elTest = document.getElementById("test-conn");
const elStatus = document.getElementById("options-status");

function showStatus(msg, type) {
  elStatus.textContent = msg;
  elStatus.className = type;
}

function normalizeBaseUrl(val) {
  return val.trim().replace(/\/+$/, "");
}

function normalizeToken(val) {
  return val.trim().replace(/^bearer\s+/i, "").trim();
}

async function load() {
  const { baseUrl, apiToken } = await browser.storage.local.get(["baseUrl", "apiToken"]);
  elBaseUrl.value = baseUrl || "";
  elApiToken.value = apiToken || "";
}

async function onSave() {
  const baseUrl = normalizeBaseUrl(elBaseUrl.value);
  const apiToken = normalizeToken(elApiToken.value);

  if (!baseUrl) {
    showStatus("接続先 URL を入力してください", "error");
    return;
  }

  await browser.storage.local.set({ baseUrl, apiToken });
  elBaseUrl.value = baseUrl;
  elApiToken.value = apiToken;
  showStatus("保存しました", "success");
}

async function onTestConnection() {
  const baseUrl = normalizeBaseUrl(elBaseUrl.value);
  const apiToken = normalizeToken(elApiToken.value);

  if (!baseUrl || !apiToken) {
    showStatus("先に保存してからテストしてください", "error");
    return;
  }

  // 未保存の値があれば先に保存する
  const { baseUrl: savedUrl, apiToken: savedToken } = await browser.storage.local.get(["baseUrl", "apiToken"]);
  if (baseUrl !== savedUrl || apiToken !== savedToken) {
    await browser.storage.local.set({ baseUrl, apiToken });
    elBaseUrl.value = baseUrl;
    elApiToken.value = apiToken;
  }

  elTest.disabled = true;
  showStatus("接続中...", "info");

  const res = await browser.runtime.sendMessage({ type: "getTags" });

  elTest.disabled = false;

  if (res.needsSetup) {
    showStatus("URL またはトークンが未設定です", "error");
  } else if (res.status === 401) {
    showStatus("トークンが不正です。設定を確認してください", "error");
  } else if (res.ok) {
    showStatus(`接続成功（タグ ${res.tags.length} 件）`, "success");
  } else {
    showStatus(res.error || "接続に失敗しました", "error");
  }
}

elSave.addEventListener("click", onSave);
elTest.addEventListener("click", onTestConnection);

load();
