const elUrl = document.getElementById("page-url");
const elTitle = document.getElementById("page-title");
const elExcerpt = document.getElementById("excerpt");
const elTagInput = document.getElementById("tag-input");
const elTagSuggest = document.getElementById("tag-suggest");
const elTagChips = document.getElementById("tag-chips");
const elSaveBtn = document.getElementById("save-btn");
const elStatus = document.getElementById("status");
const elOpenOptions = document.getElementById("open-options");
const elOpenSearch = document.getElementById("open-search");

let currentUrl = "";
let currentTabId;
let allTags = [];
let selectedTags = [];

function isSavableUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function showStatus(msg, type) {
  elStatus.textContent = msg;
  elStatus.className = type || "";
}

function renderChips() {
  elTagChips.replaceChildren();
  for (const name of selectedTags) {
    const chip = document.createElement("span");
    chip.className = "chip";

    const label = document.createTextNode(name);
    const remove = document.createElement("span");
    remove.className = "chip-remove";
    remove.dataset.name = name;
    remove.textContent = "×";

    chip.appendChild(label);
    chip.appendChild(remove);
    elTagChips.appendChild(chip);
  }
}


function addTag(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (selectedTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) return;
  selectedTags.push(trimmed);
  renderChips();
}

function removeTag(name) {
  selectedTags = selectedTags.filter(t => t.toLowerCase() !== name.toLowerCase());
  renderChips();
}

function renderSuggest(input) {
  const val = input.trim().toLowerCase();
  elTagSuggest.replaceChildren();

  if (!val) {
    elTagSuggest.style.display = "none";
    return;
  }

  const matches = allTags.filter(t =>
    t.name.toLowerCase().startsWith(val) &&
    !selectedTags.some(s => s.toLowerCase() === t.name.toLowerCase())
  );

  if (matches.length === 0) {
    elTagSuggest.style.display = "none";
    return;
  }

  for (const tag of matches.slice(0, 8)) {
    const item = document.createElement("div");
    item.className = "suggest-item";
    item.textContent = tag.name;
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      addTag(tag.name);
      elTagInput.value = "";
      elTagSuggest.style.display = "none";
    });
    elTagSuggest.appendChild(item);
  }
  elTagSuggest.style.display = "block";
}

elTagInput.addEventListener("input", () => renderSuggest(elTagInput.value));
elTagInput.addEventListener("blur", () => {
  setTimeout(() => { elTagSuggest.style.display = "none"; }, 150);
});
elTagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const val = elTagInput.value.trim();
    if (val) {
      addTag(val);
      elTagInput.value = "";
      elTagSuggest.style.display = "none";
    }
  }
});

elTagChips.addEventListener("click", (e) => {
  if (e.target.classList.contains("chip-remove")) {
    removeTag(e.target.dataset.name);
  }
});

elSaveBtn.addEventListener("click", onSave);
elOpenOptions.addEventListener("click", () => browser.runtime.openOptionsPage());
elOpenSearch.addEventListener("click", () => {
  window.location.assign(browser.runtime.getURL("search.html"));
});

async function onSave() {
  // 入力途中のタグを確定
  const pending = elTagInput.value.trim();
  if (pending) {
    addTag(pending);
    elTagInput.value = "";
    elTagSuggest.style.display = "none";
  }

  elSaveBtn.disabled = true;
  showStatus(t("saving"), "info");

  const res = await browser.runtime.sendMessage({
    type: "save",
    url: currentUrl,
    title: elTitle.value.trim(),
    excerpt: elExcerpt.value.trim(),
    tags: [...selectedTags],
  });

  if (res.ok) {
    showStatus(t("saved"), "success");
    elSaveBtn.textContent = t("saveButtonSaved");
  } else if (res.needsSetup) {
    showStatus(t("setupRequired"), "error");
    elSaveBtn.disabled = false;
  } else {
    showStatus(res.error || t("saveFailed"), "error");
    elSaveBtn.disabled = false;
  }
}

async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;
  currentUrl = tab?.url || "";
  const title = tab?.title || "";

  elUrl.textContent = currentUrl;
  elTitle.value = title;

  if (!isSavableUrl(currentUrl)) {
    elSaveBtn.disabled = true;
    showStatus(t("pageCannotBeSaved"), "error");
    return;
  }

  const res = await browser.runtime.sendMessage({ type: "getTags" });

  if (res.needsSetup) {
    showStatus(t("setupRequired"), "error");
    elSaveBtn.disabled = true;
    return;
  }

  if (res.ok) {
    allTags = res.tags;
  } else {
    showStatus(res.error || t("tagsFetchFailed"), "error");
    // タグ取得失敗でも登録は継続できる
  }
}

init();
