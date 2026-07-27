const elSearchInput = document.getElementById("search-input");
const elSearchStatus = document.getElementById("search-status");
const elResults = document.getElementById("results");
const elBack = document.getElementById("back");

let debounceTimer;
let searchVersion = 0;

function domainFromURL(rawURL) {
  try {
    return new URL(rawURL).hostname;
  } catch {
    return rawURL;
  }
}

function renderTags(tags) {
  const list = document.createElement("div");
  list.className = "tag-list";
  for (const tag of (tags || []).slice(0, 3)) {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag.name;
    list.appendChild(chip);
  }
  if ((tags || []).length > 3) {
    const more = document.createElement("span");
    more.className = "tag";
    more.textContent = `+${tags.length - 3}`;
    list.appendChild(more);
  }
  return list;
}

function renderResults(bookmarks) {
  elResults.replaceChildren();
  for (const bookmark of bookmarks) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.title = t("openOriginalPage");

    const title = document.createElement("span");
    title.className = "result-title";
    title.textContent = bookmark.title || bookmark.url;
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "result-meta";
    const domain = document.createElement("span");
    domain.className = "result-domain";
    domain.textContent = domainFromURL(bookmark.url);
    meta.appendChild(domain);
    card.appendChild(meta);

    if ((bookmark.tags || []).length > 0) {
      card.appendChild(renderTags(bookmark.tags));
    }
    if (bookmark.excerpt) {
      const excerpt = document.createElement("p");
      excerpt.className = "excerpt";
      excerpt.textContent = bookmark.excerpt;
      card.appendChild(excerpt);
    }

    card.addEventListener("click", async () => {
      await browser.tabs.create({ url: bookmark.url });
      window.close();
    });
    elResults.appendChild(card);
  }
}

async function search() {
  const query = elSearchInput.value.trim();
  const version = ++searchVersion;
  elResults.replaceChildren();

  if (!query) {
    elSearchStatus.textContent = t("enterSearchQuery");
    return;
  }

  elSearchStatus.textContent = t("searching");
  let result;
  try {
    result = await browser.runtime.sendMessage({ type: "searchBookmarks", query });
  } catch {
    if (version === searchVersion) {
      elSearchStatus.textContent = t("searchFailed");
    }
    return;
  }
  if (version !== searchVersion) return;

  if (result.needsSetup) {
    elSearchStatus.textContent = t("serverURLOrTokenMissing");
    return;
  }
  if (!result.ok) {
    elSearchStatus.textContent = result.error || t("searchFailed");
    return;
  }
  if (result.total === 0) {
    elSearchStatus.textContent = t("noSearchResults");
    return;
  }

  elSearchStatus.textContent = result.total > result.bookmarks.length
    ? t("searchResultsLimited", [String(result.total), String(result.bookmarks.length)])
    : t("searchResultsFound", String(result.total));
  renderResults(result.bookmarks);
}

elSearchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(search, 220);
});

elBack.addEventListener("click", () => {
  window.location.assign(browser.runtime.getURL("popup.html"));
});

elSearchInput.focus();
