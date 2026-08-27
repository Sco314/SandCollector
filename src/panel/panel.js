const $ = (id) => document.getElementById(id);

let activeTabId = null;
let currentSnapshot = null;

function setText(id, value, fallback = "-") {
  $(id).textContent = value ?? fallback;
}

function showToast(message) {
  const toast = $("panelToast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 1500);
}

async function copyText(text, label) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied`);
  } catch (error) {
    showToast(`Could not copy ${label.toLowerCase()}`);
  }
}

function prettyNumber(value) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value * 100) / 100}px`;
}

function titleCase(value = "") {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function qualityLabel(snapshot) {
  const quality = snapshot?.selectorQuality || {};
  return titleCase(quality.confidence || "unknown");
}

function qualitySource(snapshot) {
  const quality = snapshot?.selectorQuality || {};
  return quality.reason ? titleCase(quality.reason) : "Unknown source";
}

function formatLayout(snapshot) {
  if (!snapshot) return "";
  const facts = snapshot.layoutFacts || {};
  const rect = facts.rect || {};
  const layout = facts.layout || {};

  return [
    "LAYOUT",
    `Width: ${prettyNumber(rect.width)}`,
    `Height: ${prettyNumber(rect.height)}`,
    `Display: ${layout.display || "-"}`,
    `Position: ${layout.position || "-"}`,
    `Box sizing: ${layout.boxSizing || "-"}`,
    `Min width: ${layout.minWidth || "-"}`,
    `Max width: ${layout.maxWidth || "-"}`,
    `Overflow X: ${layout.overflowX || "-"}`,
    `Overflow Y: ${layout.overflowY || "-"}`,
    `Z index: ${layout.zIndex || "-"}`
  ].join("\n");
}

function formatParentLayout(snapshot) {
  if (!snapshot) return "";
  const parent = snapshot.layoutFacts?.parentLayout || {};

  return [
    "PARENT LAYOUT",
    `Selector: ${parent.selector || "-"}`,
    `Display: ${parent.display || "-"}`,
    `Width: ${parent.width || "-"}`,
    `Gap: ${parent.gap || "-"}`,
    `Align: ${parent.alignItems || "-"}`
  ].join("\n");
}

function formatSelectorDetails(snapshot) {
  if (!snapshot) return "";
  const quality = snapshot.selectorQuality || {};
  const lines = [
    "SELECTOR",
    snapshot.selector || "-",
    `Unique: ${quality.unique === false ? "No" : quality.unique === true ? "Yes" : "Unknown"}`,
    `Quality: ${qualityLabel(snapshot)}`,
    `Source: ${qualitySource(snapshot)}`
  ];
  return lines.join("\n");
}

function formatStacking(snapshot) {
  const reasons = snapshot?.layoutFacts?.stackingContextReasons || [];
  if (!reasons.length) return "";
  return ["STACKING CONTEXT", ...reasons.map((reason) => `- ${reason}`)].join("\n");
}

function formatCopyAll(snapshot) {
  if (!snapshot) return "";

  const sections = [
    "WhyDOM Element Snapshot",
    snapshot.url ? `URL: ${snapshot.url}` : "",
    formatSelectorDetails(snapshot),
    formatLayout(snapshot),
    formatParentLayout(snapshot),
    formatStacking(snapshot),
    snapshot.copyCss ? `CSS\n${snapshot.copyCss}` : "",
    `ELEMENT\nText: ${snapshot.dom?.textPreview || "No text content."}`,
    `Authored rules: ${snapshot.authoredRules?.length || 0}`,
    snapshot.inaccessibleStylesheets
      ? `Inaccessible stylesheets: ${snapshot.inaccessibleStylesheets}`
      : ""
  ].filter(Boolean);

  return sections.join("\n\n");
}

function renderSelectorQuality(snapshot) {
  const quality = snapshot?.selectorQuality;
  const meta = $("selectorMeta");

  if (!quality) {
    meta.classList.add("hidden");
    return;
  }

  meta.classList.remove("hidden");

  const unique = $("selectorUnique");
  if (quality.unique === true) {
    unique.textContent = "✓ Unique";
    unique.dataset.state = "good";
  } else if (quality.unique === false) {
    unique.textContent = "Not unique";
    unique.dataset.state = "bad";
  } else {
    unique.textContent = "Uniqueness unknown";
    unique.dataset.state = "neutral";
  }

  const qualityEl = $("selectorQuality");
  qualityEl.textContent = `${qualityLabel(snapshot)} quality`;
  qualityEl.dataset.quality = quality.confidence || "unknown";
  setText("selectorSource", qualitySource(snapshot));
}

function renderSnapshot(snapshot) {
  currentSnapshot = snapshot;

  if (!snapshot) {
    $("emptyState").classList.remove("hidden");
    $("inspector").classList.add("hidden");
    return;
  }

  $("emptyState").classList.add("hidden");
  $("inspector").classList.remove("hidden");

  const facts = snapshot.layoutFacts || {};
  const rect = facts.rect || {};
  const layout = facts.layout || {};
  const scroll = facts.scroll || {};
  const parent = facts.parentLayout || {};

  setText("selector", snapshot.selector);
  renderSelectorQuality(snapshot);
  setText("metricWidth", prettyNumber(rect.width));
  setText("metricHeight", prettyNumber(rect.height));
  setText("metricDisplay", layout.display);
  setText("metricPosition", layout.position);

  setText("boxSizing", layout.boxSizing);
  setText("minWidth", layout.minWidth);
  setText("maxWidth", layout.maxWidth);
  setText("overflowX", layout.overflowX);
  setText("overflowY", layout.overflowY);
  setText("zIndex", layout.zIndex);

  setText("parentSelector", parent.selector);
  setText("parentDisplay", parent.display);
  setText("parentWidth", parent.width);
  setText("parentGap", parent.gap);
  setText("parentAlign", parent.alignItems);

  const overflowsX = Boolean(scroll.overflowsX);
  const overflowsY = Boolean(scroll.overflowsY);
  const warningCard = $("warningCard");

  if (overflowsX || overflowsY) {
    warningCard.classList.remove("hidden");
    setText("warningTitle", overflowsX && overflowsY ? "Horizontal and vertical overflow detected" : overflowsX ? "Horizontal overflow detected" : "Vertical overflow detected");
    setText(
      "warningText",
      `${Math.round(scroll.scrollWidth || 0)} × ${Math.round(scroll.scrollHeight || 0)} scroll area inside ${Math.round(scroll.clientWidth || 0)} × ${Math.round(scroll.clientHeight || 0)} client area. WHY diagnosis is the next engine.`
    );
  } else {
    warningCard.classList.add("hidden");
  }

  const reasons = facts.stackingContextReasons || [];
  const stackingSection = $("stackingSection");
  const list = $("stackingReasons");
  list.replaceChildren();

  if (reasons.length) {
    stackingSection.classList.remove("hidden");
    for (const reason of reasons) {
      const item = document.createElement("li");
      item.textContent = reason;
      list.appendChild(item);
    }
  } else {
    stackingSection.classList.add("hidden");
  }

  setText("cssOutput", snapshot.copyCss || "");
  setText("textPreview", snapshot.dom?.textPreview || "No text content.");

  const ruleCount = snapshot.authoredRules?.length || 0;
  const inaccessible = snapshot.inaccessibleStylesheets || 0;
  setText(
    "sourceStats",
    `${ruleCount} matching authored rule${ruleCount === 1 ? "" : "s"}${inaccessible ? ` · ${inaccessible} stylesheet${inaccessible === 1 ? "" : "s"} inaccessible` : ""}`
  );
}

async function refreshPickerStatus(tabId) {
  if (!tabId) return;
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "WHYDOM_PING" });
    $("sessionStatus").textContent = response?.active ? "ACTIVE" : "READY";
  } catch (error) {
    $("sessionStatus").textContent = "READY";
  }
}

async function loadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id ?? null;

  if (!activeTabId) {
    renderSnapshot(null);
    return;
  }

  await refreshPickerStatus(activeTabId);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "WHYDOM_GET_SNAPSHOT",
      tabId: activeTabId
    });
    renderSnapshot(response?.snapshot || null);
  } catch (error) {
    renderSnapshot(null);
  }
}

$("copyAll").addEventListener("click", () => copyText(formatCopyAll(currentSnapshot), "All details"));
$("copyLayout").addEventListener("click", () => copyText(formatLayout(currentSnapshot), "Layout"));
$("copyParentLayout").addEventListener("click", () => copyText(formatParentLayout(currentSnapshot), "Parent layout"));
$("copyCss").addEventListener("click", () => copyText(currentSnapshot?.copyCss, "CSS"));
$("copySelector").addEventListener("click", () => copyText(currentSnapshot?.selector, "Selector"));
$("copyHtml").addEventListener("click", () => copyText(currentSnapshot?.dom?.outerHTML, "HTML"));

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "WHYDOM_SNAPSHOT_UPDATED") return;
  if (message.tabId !== activeTabId) return;
  renderSnapshot(message.snapshot);
  $("sessionStatus").textContent = "ACTIVE";
});

chrome.tabs.onActivated.addListener(() => loadActiveTab());
chrome.windows.onFocusChanged.addListener(() => loadActiveTab());

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadActiveTab();
});

loadActiveTab();
