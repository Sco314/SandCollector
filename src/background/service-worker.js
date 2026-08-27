const CONTENT_FILES = [
  "src/content/element-snapshot.js",
  "src/content/capture-quality.js",
  "src/content/capture-safety.js",
  "src/content/copy-polish.js",
  "src/content/selector-consistency.js",
  "src/content/overflow-diagnostic.js",
  "src/content/picker.js"
];

const CONTENT_CSS = "src/content/picker.css";

function isInspectableUrl(url = "") {
  return /^(https?|file):/i.test(url);
}

async function ensureContentScripts(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "WHYDOM_PING" });
    return;
  } catch (error) {
    // No listener yet. Inject the isolated-world inspector on demand.
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: [CONTENT_CSS]
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: CONTENT_FILES
  });
}

function snapshotKey(tabId) {
  return `whydom:snapshot:${tabId}`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isInspectableUrl(tab.url)) {
    return;
  }

  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    await ensureContentScripts(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "WHYDOM_TOGGLE_PICKER" });
  } catch (error) {
    console.error("WhyDOM could not start on this page.", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "WHYDOM_CAPTURED" && sender.tab?.id && message.snapshot) {
    const tabId = sender.tab.id;
    const key = snapshotKey(tabId);

    chrome.storage.session
      .set({ [key]: message.snapshot })
      .then(() => {
        chrome.runtime.sendMessage({
          type: "WHYDOM_SNAPSHOT_UPDATED",
          tabId,
          snapshot: message.snapshot
        }).catch(() => {});
      })
      .catch((error) => console.error("WhyDOM could not store snapshot.", error));

    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "WHYDOM_GET_SNAPSHOT" && Number.isInteger(message.tabId)) {
    const key = snapshotKey(message.tabId);
    chrome.storage.session
      .get(key)
      .then((result) => sendResponse({ ok: true, snapshot: result[key] || null }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(snapshotKey(tabId)).catch(() => {});
});
