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
    showStatus(t("serverURLRequired"), "error");
    return;
  }

  await browser.storage.local.set({ baseUrl, apiToken });
  elBaseUrl.value = baseUrl;
  elApiToken.value = apiToken;
  showStatus(t("settingsSaved"), "success");
}

async function onTestConnection() {
  const baseUrl = normalizeBaseUrl(elBaseUrl.value);
  const apiToken = normalizeToken(elApiToken.value);

  if (!baseUrl || !apiToken) {
    showStatus(t("saveBeforeTesting"), "error");
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
