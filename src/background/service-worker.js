const CONTENT_FILES = [
  "src/content/element-snapshot.js",
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

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isInspectableUrl(tab.url)) {
    return;
  }

  try {
    await ensureContentScripts(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "WHYDOM_START_PICKER" });
  } catch (error) {
    console.error("WhyDOM could not start on this page.", error);
  }
});
