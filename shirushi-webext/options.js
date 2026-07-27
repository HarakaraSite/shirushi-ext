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
  const value = val.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    if (!allowedServerProtocols.has(url.protocol) || url.username || url.password) {
      return null;
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function normalizeToken(val) {
  return val.trim().replace(/^bearer\s+/i, "").trim();
}

async function load() {
  const { baseUrl, apiToken } = await browser.storage.local.get(["baseUrl", "apiToken"]);
  elBaseUrl.value = baseUrl || "";
  elApiToken.value = apiToken || "";
}

function permissionPatternFor(baseUrl) {
  const url = new URL(baseUrl);
  // Firefox の match pattern はポートを指定できないため、同じホスト・スキームを許可します。
  return `${url.protocol}//${url.hostname}/*`;
}

async function saveSettings(baseUrl, apiToken) {
  const granted = await browser.permissions.request({
    origins: [permissionPatternFor(baseUrl)],
  });
  if (!granted) {
    showStatus(t("serverPermissionDenied"), "error");
    return false;
  }

  await browser.storage.local.set({ baseUrl, apiToken });
  elBaseUrl.value = baseUrl;
  elApiToken.value = apiToken;
  return true;
}

async function onSave() {
  const baseUrl = normalizeBaseUrl(elBaseUrl.value);
  const apiToken = normalizeToken(elApiToken.value);
  if (!baseUrl) {
    showStatus(t(baseUrl === null ? "serverURLInvalid" : "serverURLRequired"), "error");
    return;
  }

  if (!await saveSettings(baseUrl, apiToken)) return;
  showStatus(t("settingsSaved"), "success");
}

async function onTestConnection() {
  const baseUrl = normalizeBaseUrl(elBaseUrl.value);
  const apiToken = normalizeToken(elApiToken.value);

  if (!baseUrl || !apiToken) {
    showStatus(t(baseUrl === null ? "serverURLInvalid" : "saveBeforeTesting"), "error");
    return;
  }

  // 接続テストも任意サーバーへの通信なので、ここでユーザーに権限を求めてから保存します。
  if (!await saveSettings(baseUrl, apiToken)) return;

  elTest.disabled = true;
  showStatus(t("connecting"), "info");

  const res = await browser.runtime.sendMessage({ type: "getTags" });

  elTest.disabled = false;

  if (res.needsSetup) {
    showStatus(t("serverURLOrTokenMissing"), "error");
  } else if (res.status === 401) {
    showStatus(t("invalidToken"), "error");
  } else if (res.ok) {
    showStatus(t("connectionSucceeded", String(res.tags.length)), "success");
  } else {
    showStatus(res.error || t("connectionFailed"), "error");
  }
}

elSave.addEventListener("click", onSave);
elTest.addEventListener("click", onTestConnection);

load();
