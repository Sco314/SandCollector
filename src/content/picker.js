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
    const classes = [...element.classList]
      .filter((name) => !name.startsWith("__whydom"))
      .slice(0, 2)
      .map((name) => `.${name}`)
      .join("");
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
    }, 2600);
  }

  function hasRuntimeContext() {
    try {
      return Boolean(globalThis.chrome?.runtime?.id);
    } catch (error) {
      return false;
    }
  }

  function isInvalidatedContextError(error) {
    return /extension context invalidated/i.test(String(error?.message || error || ""));
  }

  function handleInvalidatedContext() {
    stopPicker();
    showToast("WhyDOM was updated or reloaded. Click the extension again to reconnect to this page.", "error");
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

    if (!hasRuntimeContext()) {
      handleInvalidatedContext();
      return;
    }

    const candidate = document.elementFromPoint(event.clientX, event.clientY);
    if (!(candidate instanceof Element) || isWhyDomUi(candidate)) return;
    if (candidate === state.target) return;

    state.target = candidate;
    moveHighlight(candidate);
  }

  function resolveLiveClickTarget(event) {
    const eventTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (eventTarget instanceof Element && eventTarget.isConnected && !isWhyDomUi(eventTarget)) {
      return eventTarget;
    }

    const hit = document.elementFromPoint(event.clientX, event.clientY);
    if (hit instanceof Element && hit.isConnected && !isWhyDomUi(hit)) {
      return hit;
    }

    if (state.target instanceof Element && state.target.isConnected && !isWhyDomUi(state.target)) {
      return state.target;
    }

    return null;
  }

  async function onClick(event) {
    if (!state.active) return;

    // Reloading/updating an unpacked extension invalidates already-injected
    // content-script contexts. Do not consume the page click or throw a noisy
    // runtime error from that orphaned script; end the stale picker instead.
    if (!hasRuntimeContext()) {
      handleInvalidatedContext();
      return;
    }

    const target = resolveLiveClickTarget(event);
    if (!(target instanceof Element)) {
      showToast("Page changed before WhyDOM could capture that element", "error");
      clearHighlight();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      const snapshot = WhyDOM.captureElement(target);
      WhyDOM.lastSnapshot = snapshot;

      const copied = await writeClipboard(snapshot.copyCss);
      const width = Math.round(snapshot.layoutFacts.rect.width);
      const height = Math.round(snapshot.layoutFacts.rect.height);
      const overflowDiagnostic = snapshot.diagnostics?.overflow;
      const overflow = overflowDiagnostic
        ? overflowDiagnostic.status === "problem"
        : snapshot.layoutFacts.scroll.overflowsX || snapshot.layoutFacts.scroll.overflowsY;
      const suffix = overflow ? " · overflow detected" : "";

      if (!hasRuntimeContext()) {
        handleInvalidatedContext();
        return;
      }

      await chrome.runtime.sendMessage({
        type: "WHYDOM_CAPTURED",
        snapshot
      });

      clearHighlight();
      showToast(
        copied
          ? `CSS copied · ${width} × ${height}${suffix} · picker still active`
          : "Element captured · picker still active · clipboard copy failed",
        copied ? "success" : "error"
      );

      console.debug("WhyDOM element snapshot", snapshot);
    } catch (error) {
      clearHighlight();
      if (isInvalidatedContextError(error) || !hasRuntimeContext()) {
        handleInvalidatedContext();
        return;
      }
      console.error("WhyDOM capture failed", error);
      showToast("Page changed before WhyDOM could capture that element", "error");
    }
  }

  function onKeyDown(event) {
    if (!state.active || event.key !== "Escape") return;

    event.preventDefault();
    stopPicker();
    showToast("WhyDOM inspection ended", "neutral");
  }

  function startPicker() {
    ensureUi();
    if (state.active) return;

    if (!hasRuntimeContext()) {
      showToast("WhyDOM needs to reconnect to this page. Click the extension again.", "error");
      return;
    }

    state.active = true;
    document.documentElement.classList.add("__whydom-picking");
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    showToast("WhyDOM active · pick as many elements as you want · Esc to exit", "neutral");
  }

  function stopPicker() {
    state.active = false;
    document.documentElement.classList.remove("__whydom-picking");
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    clearHighlight();
  }

  function togglePicker() {
    if (state.active) {
      stopPicker();
      showToast("WhyDOM inspection ended", "neutral");
      return false;
    }

    startPicker();
    return state.active;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "WHYDOM_PING") {
      sendResponse({ ok: true, active: state.active });
      return;
    }

    if (message?.type === "WHYDOM_START_PICKER") {
      startPicker();
      sendResponse({ ok: true, active: state.active });
      return;
    }

    if (message?.type === "WHYDOM_TOGGLE_PICKER") {
      sendResponse({ ok: true, active: togglePicker() });
    }
  });

  WhyDOM.startPicker = startPicker;
  WhyDOM.stopPicker = stopPicker;
  WhyDOM.togglePicker = togglePicker;
})();
