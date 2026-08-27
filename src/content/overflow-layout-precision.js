(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.overflowLayoutPrecisionInstalled || !WhyDOM.captureElement) return;
  WhyDOM.overflowLayoutPrecisionInstalled = true;

  const previousCaptureElement = WhyDOM.captureElement;
  const TOLERANCE = 1.5;
  const MANAGED_OVERFLOW = new Set(["auto", "scroll"]);
  const CLIPPED_OVERFLOW = new Set(["hidden", "clip"]);
  const TRACK_SIGNAL = /(?:carousel|slider|swiper|scroller|scroll-track|track|rail|filmstrip|marquee)/i;

  function px(value) {
    return `${Math.round(Number(value || 0) * 100) / 100}px`;
  }

  function isConnectedElement(element) {
    return element instanceof Element && element.isConnected && element.ownerDocument === document;
  }

  function createsContainingBlock(style) {
    if (!style) return false;
    if (style.position && style.position !== "static") return true;
    if (style.transform && style.transform !== "none") return true;
    if (style.filter && style.filter !== "none") return true;
    if (style.perspective && style.perspective !== "none") return true;
    if (style.backdropFilter && style.backdropFilter !== "none") return true;
    if (style.contain && /(?:layout|paint|strict|content)/.test(style.contain)) return true;
    if (style.willChange && /(?:transform|filter|perspective)/.test(style.willChange)) return true;
    return false;
  }

  function nearestBoxAncestor(element) {
    let current = element.parentElement;
    while (current) {
      const style = getComputedStyle(current);
      if (style.display !== "contents") return current;
      current = current.parentElement;
    }
    return null;
  }

  function layoutContainerFor(element, style) {
    if (!element || !style) return { element: null, mode: "none" };

    if (style.position === "fixed") {
      let current = element.parentElement;
      while (current) {
        const currentStyle = getComputedStyle(current);
        if (currentStyle.display !== "contents" && createsContainingBlock(currentStyle)) {
          return { element: current, mode: "fixed containing block" };
        }
        current = current.parentElement;
      }
      return { element: null, mode: "viewport" };
    }

    if (style.position === "absolute") {
      let current = element.parentElement;
      while (current) {
        const currentStyle = getComputedStyle(current);
        if (currentStyle.display !== "contents" && createsContainingBlock(currentStyle)) {
          return { element: current, mode: "absolute containing block" };
        }
        current = current.parentElement;
      }
      return { element: document.documentElement, mode: "initial containing block" };
    }

    const parent = nearestBoxAncestor(element);
    return {
      element: parent,
      mode: element.parentElement && parent !== element.parentElement
        ? "nearest box ancestor (display: contents skipped)"
        : "parent box"
    };
  }

  function boundsFor(containerInfo) {
    const container = containerInfo?.element;
    if (!container) {
      return {
        left: 0,
        top: 0,
        right: innerWidth,
        bottom: innerHeight,
        width: innerWidth,
        height: innerHeight
      };
    }

    const rect = container.getBoundingClientRect();
    const width = container.clientWidth || rect.width;
    const height = container.clientHeight || rect.height;
    const left = rect.left + (container.clientLeft || 0);
    const top = rect.top + (container.clientTop || 0);

    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    };
  }

  function correctedMetrics(element) {
    if (!isConnectedElement(element)) return null;

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const inlineLike = style.display === "inline";
    const containerInfo = layoutContainerFor(element, style);
    const bounds = boundsFor(containerInfo);

    const contentOverflowX = !inlineLike && element.clientWidth > 0
      ? Math.max(0, element.scrollWidth - element.clientWidth)
      : 0;
    const contentOverflowY = !inlineLike && element.clientHeight > 0
      ? Math.max(0, element.scrollHeight - element.clientHeight)
      : 0;

    const outsideParentX = Math.max(0, bounds.left - rect.left) + Math.max(0, rect.right - bounds.right);
    const outsideParentY = Math.max(0, bounds.top - rect.top) + Math.max(0, rect.bottom - bounds.bottom);

    return {
      rectWidth: rect.width,
      rectHeight: rect.height,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      contentOverflowX,
      contentOverflowY,
      outsideParentX,
      outsideParentY,
      overflowX: Math.max(contentOverflowX, outsideParentX),
      overflowY: Math.max(contentOverflowY, outsideParentY),
      parentAvailableWidth: bounds.width,
      parentAvailableHeight: bounds.height,
      layoutContainerMode: containerInfo.mode,
      layoutContainerSelector: containerInfo.element
        ? (WhyDOM.buildSelector?.(containerInfo.element) || containerInfo.element.localName || "container")
        : "viewport"
    };
  }

  function identityText(element) {
    const pieces = [];
    let current = element;
    let depth = 0;

    while (current && depth < 6) {
      pieces.push(
        current.localName || "",
        current.id || "",
        typeof current.className === "string" ? current.className : current.getAttribute?.("class") || "",
        current.getAttribute?.("data-testid") || "",
        current.getAttribute?.("aria-label") || ""
      );
      current = current.parentElement;
      depth += 1;
    }

    return pieces.join(" ");
  }

  function findOverflowController(element) {
    let current = element;
    let depth = 0;

    while (current && depth < 8) {
      const style = getComputedStyle(current);
      const overflowX = style.overflowX || style.overflow;
      if (MANAGED_OVERFLOW.has(overflowX) || CLIPPED_OVERFLOW.has(overflowX)) {
        return {
          element: current,
          overflowX,
          selector: WhyDOM.buildSelector?.(current) || current.localName || "container"
        };
      }
      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  function baseEvidence(metrics) {
    return [
      { label: "Rendered size", value: `${px(metrics.rectWidth)} × ${px(metrics.rectHeight)}` },
      { label: "Client area", value: `${metrics.clientWidth}px × ${metrics.clientHeight}px` },
      { label: "Scroll area", value: `${metrics.scrollWidth}px × ${metrics.scrollHeight}px` },
      { label: "Layout container", value: metrics.layoutContainerSelector },
      { label: "Container mode", value: metrics.layoutContainerMode },
      { label: "Available width", value: `${Math.round(metrics.parentAvailableWidth * 100) / 100}px` }
    ];
  }

  function applyNoOverflow(diagnostic, metrics) {
    diagnostic.status = "ok";
    diagnostic.kind = "no-overflow";
    diagnostic.confidence = "high";
    diagnostic.axes = { x: false, y: false };
    diagnostic.metrics = metrics;
    diagnostic.summary = "No measurable overflow is affecting this element right now.";
    diagnostic.evidence = baseEvidence(metrics);
    diagnostic.fixes = [];
  }

  function applyManagedTrack(diagnostic, metrics, controller) {
    diagnostic.status = "ok";
    diagnostic.kind = "managed-horizontal-track";
    diagnostic.confidence = "medium";
    diagnostic.axes = { x: false, y: false };
    diagnostic.metrics = metrics;
    diagnostic.summary = "This element has a much wider horizontal content track, but an overflow container is deliberately managing that track. WhyDOM is treating it as carousel/slider behavior rather than an actionable overflow bug.";
    diagnostic.evidence = [
      ...baseEvidence(metrics),
      { label: "Horizontal content excess", value: px(metrics.contentOverflowX) },
      { label: "Overflow controller", value: controller.selector },
      { label: "Controller overflow-x", value: controller.overflowX }
    ];
    diagnostic.fixes = [];
  }

  WhyDOM.captureElement = function captureWithLayoutPrecision(element) {
    const snapshot = previousCaptureElement(element);
    const diagnostic = snapshot?.diagnostics?.overflow;

    if (!diagnostic || !(element instanceof Element)) return snapshot;

    // SVG child graphics and icon-font glyphs have dedicated handling in the
    // preceding precision layer. Do not overwrite those specialized results.
    if (["svg-rendered-overflow", "svg-rendered-bounds", "icon-glyph-metrics"].includes(diagnostic.kind)) {
      return snapshot;
    }

    const metrics = correctedMetrics(element);
    if (!metrics) return snapshot;

    const x = metrics.overflowX > TOLERANCE;
    const y = metrics.overflowY > TOLERANCE;

    if (!x && !y) {
      applyNoOverflow(diagnostic, metrics);
      snapshot.version = Math.max(Number(snapshot.version) || 0, 9);
      return snapshot;
    }

    const controller = findOverflowController(element);
    const trackSignal = TRACK_SIGNAL.test(identityText(element));
    const intentionallyScrollable = controller && MANAGED_OVERFLOW.has(controller.overflowX);
    const intentionallyClippedTrack = controller && CLIPPED_OVERFLOW.has(controller.overflowX) && trackSignal;

    if (
      x
      && !y
      && metrics.contentOverflowX > TOLERANCE
      && metrics.outsideParentX <= TOLERANCE
      && (intentionallyScrollable || intentionallyClippedTrack)
    ) {
      applyManagedTrack(diagnostic, metrics, controller);
      snapshot.version = Math.max(Number(snapshot.version) || 0, 9);
      return snapshot;
    }

    // Keep a real diagnosis from the core engine, but replace misleading
    // immediate-parent measurements with the corrected layout-container view.
    diagnostic.metrics = metrics;
    diagnostic.axes = { x, y };
    diagnostic.evidence = baseEvidence(metrics);

    if (diagnostic.kind === "overflow-unresolved") {
      diagnostic.summary = x && y
        ? "Horizontal and vertical overflow are present, but the current engine cannot isolate one dominant cause yet."
        : x
          ? "Horizontal overflow is present, but the current engine cannot isolate one dominant cause yet."
          : "Vertical overflow is present, but the current engine cannot isolate one dominant cause yet.";
    }

    snapshot.version = Math.max(Number(snapshot.version) || 0, 9);
    return snapshot;
  };
})();
