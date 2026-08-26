(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.pickerRegistered) {
    return;
  }
  WhyDOM.pickerRegistered = true;

  const state = {
    active: false,
    target: null,
    highlight: null,
    label: null,
    toast: null
  };

  function createUiElement(id) {
    let element = document.getElementById(id);
    if (!element) {
      element = document.createElement("div");
      element.id = id;
      element.setAttribute("data-whydom-ui", "true");
      document.documentElement.appendChild(element);
    }
    return element;
  }

  function ensureUi() {
    state.highlight = createUiElement("__whydom-highlight");
    state.label = createUiElement("__whydom-label");
    state.toast = createUiElement("__whydom-toast");
  }

  function isWhyDomUi(element) {
    return element instanceof Element && Boolean(element.closest("[data-whydom-ui='true']"));
  }

  function describeElement(element) {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classes = [...element.classList].slice(0, 2).map((name) => `.${name}`).join("");
    return `${tag}${id}${classes}`;
  }

  function moveHighlight(element) {
    const rect = element.getBoundingClientRect();
    const highlight = state.highlight;
    const label = state.label;

    highlight.style.display = "block";
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;

    label.textContent = `${describeElement(element)}  ${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    label.style.display = "block";

    const labelRect = label.getBoundingClientRect();
    const preferredTop = rect.top - labelRect.height - 6;
    const top = preferredTop >= 4 ? preferredTop : Math.min(rect.bottom + 6, innerHeight - labelRect.height - 4);
    const left = Math.max(4, Math.min(rect.left, innerWidth - labelRect.width - 4));

    label.style.top = `${top}px`;
    label.style.left = `${left}px`;
  }

  function clearHighlight() {
    if (state.highlight) state.highlight.style.display = "none";
    if (state.label) state.label.style.display = "none";
    state.target = null;
  }

  function showToast(message, kind = "success") {
    ensureUi();
    state.toast.textContent = message;
    state.toast.dataset.kind = kind;
    state.toast.classList.add("__whydom-toast-visible");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      state.toast.classList.remove("__whydom-toast-visible");
    }, 2200);
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.setAttribute("data-whydom-ui", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.documentElement.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    }
  }

  function onPointerMove(event) {
    if (!state.active) return;

    const candidate = document.elementFromPoint(event.clientX, event.clientY);
    if (!(candidate instanceof Element) || isWhyDomUi(candidate)) return;
    if (candidate === state.target) return;

    state.target = candidate;
    moveHighlight(candidate);
  }

  async function onClick(event) {
    if (!state.active) return;

    const target = state.target || event.target;
    if (!(target instanceof Element) || isWhyDomUi(target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    stopPicker();

    try {
      const snapshot = WhyDOM.captureElement(target);
      WhyDOM.lastSnapshot = snapshot;
      const copied = await writeClipboard(snapshot.copyCss);
      const width = Math.round(snapshot.layoutFacts.rect.width);
      const height = Math.round(snapshot.layoutFacts.rect.height);
      const overflow = snapshot.layoutFacts.scroll.overflowsX || snapshot.layoutFacts.scroll.overflowsY;
      const suffix = overflow ? " · overflow detected" : "";

      showToast(
        copied
          ? `CSS copied · ${width} × ${height}${suffix}`
          : "Element captured, but clipboard copy failed",
        copied ? "success" : "error"
      );

      console.debug("WhyDOM element snapshot", snapshot);
    } catch (error) {
      console.error("WhyDOM capture failed", error);
      showToast("WhyDOM could not capture this element", "error");
    }
  }

  function onKeyDown(event) {
    if (!state.active) return;
    if (event.key !== "Escape") return;

    event.preventDefault();
    stopPicker();
    showToast("WhyDOM picker cancelled", "neutral");
  }

  function startPicker() {
    ensureUi();
    if (state.active) return;

    state.active = true;
    document.documentElement.classList.add("__whydom-picking");
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    showToast("WhyDOM active · click an element · Esc to cancel", "neutral");
  }

  function stopPicker() {
    if (!state.active) return;

    state.active = false;
    document.documentElement.classList.remove("__whydom-picking");
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    clearHighlight();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "WHYDOM_PING") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "WHYDOM_START_PICKER") {
      startPicker();
      sendResponse({ ok: true });
    }
  });

  WhyDOM.startPicker = startPicker;
  WhyDOM.stopPicker = stopPicker;
})();
