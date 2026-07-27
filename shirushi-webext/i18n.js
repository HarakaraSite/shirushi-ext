function t(key, substitutions) {
  const message = browser.i18n.getMessage(key, substitutions);
  return message || key;
}

function localizeDocument() {
  const uiLanguage = browser.i18n.getUILanguage().toLowerCase();
  document.documentElement.lang = uiLanguage.startsWith("ja") ? "ja" : "en";

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
}

localizeDocument();
