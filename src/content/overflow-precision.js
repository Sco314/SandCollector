(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.overflowPrecisionInstalled || !WhyDOM.captureElement) return;
  WhyDOM.overflowPrecisionInstalled = true;

  const previousCaptureElement = WhyDOM.captureElement;
  const SVG_NS = "http://www.w3.org/2000/svg";

  function px(value) {
    return `${Math.round(Number(value || 0) * 100) / 100}px`;
  }

  function isSvgGraphicsWithoutClientBox(element, metrics) {
    if (!(element instanceof Element) || element.namespaceURI !== SVG_NS) return false;
    if ((element.localName || "").toLowerCase() === "svg") return false;
    return metrics.clientWidth === 0 && metrics.clientHeight === 0 && (metrics.rectWidth > 0 || metrics.rectHeight > 0);
  }

  function isLikelyIconGlyph(element, style, metrics) {
    const tag = (element.localName || "").toLowerCase();
    const classText = typeof element.className === "string"
      ? element.className.toLowerCase()
      : String(element.getAttribute("class") || "").toLowerCase();
    const fontFamily = String(style.fontFamily || "").toLowerCase();
    const text = (element.textContent || "").trim();

    const iconSignal = tag === "mat-icon"
      || classText.includes("material-icons")
      || classText.includes("mat-icon")
      || fontFamily.includes("symbol")
      || fontFamily.includes("icon");

    if (!iconSignal || !text || text.length > 40) return false;

    const yExcess = Number(metrics.contentOverflowY || 0);
    const xExcess = Number(metrics.contentOverflowX || 0);
    const outsideY = Number(metrics.outsideParentY || 0);
    const outsideX = Number(metrics.outsideParentX || 0);
    const allowedGlyphExcess = Math.max(2.5, Number(metrics.rectHeight || 0) * 0.12);

    return yExcess > 0
      && yExcess <= allowedGlyphExcess
      && xExcess <= 1.5
      && outsideX <= 1.5
      && outsideY <= 1.5;
  }

  function svgEvidence(metrics) {
    const evidence = [
      { label: "Rendered bounds", value: `${px(metrics.rectWidth)} × ${px(metrics.rectHeight)}` },
      { label: "Measurement mode", value: "SVG rendered geometry" }
    ];
    if (metrics.parentAvailableWidth !== null && metrics.parentAvailableWidth !== undefined) {
      evidence.push({ label: "Parent available width", value: `${metrics.parentAvailableWidth}px` });
    }
    return evidence;
  }

  function iconEvidence(style, metrics) {
    const evidence = [
      { label: "Rendered size", value: `${px(metrics.rectWidth)} × ${px(metrics.rectHeight)}` },
      { label: "Client area", value: `${metrics.clientWidth}px × ${metrics.clientHeight}px` },
      { label: "Scroll area", value: `${metrics.scrollWidth}px × ${metrics.scrollHeight}px` },
      { label: "Glyph metric excess", value: px(metrics.contentOverflowY) },
      { label: "Font", value: style.fontFamily || "icon font" }
    ];
    if (metrics.parentAvailableWidth !== null && metrics.parentAvailableWidth !== undefined) {
      evidence.push({ label: "Parent available width", value: `${metrics.parentAvailableWidth}px` });
    }
    return evidence;
  }

  WhyDOM.captureElement = function captureWithOverflowPrecision(element) {
    const snapshot = previousCaptureElement(element);
    const diagnostic = snapshot?.diagnostics?.overflow;
    const metrics = diagnostic?.metrics;

    if (!diagnostic || !metrics || !(element instanceof Element)) return snapshot;

    if (isSvgGraphicsWithoutClientBox(element, metrics)) {
      const outsideX = Number(metrics.outsideParentX || 0);
      const outsideY = Number(metrics.outsideParentY || 0);
      const hasRenderedOverflow = outsideX > 1.5 || outsideY > 1.5;

      diagnostic.status = hasRenderedOverflow ? "problem" : "ok";
      diagnostic.kind = hasRenderedOverflow ? "svg-rendered-overflow" : "svg-rendered-bounds";
      diagnostic.confidence = "medium";
      diagnostic.axes = { x: outsideX > 1.5, y: outsideY > 1.5 };
      diagnostic.summary = hasRenderedOverflow
        ? "This SVG graphics element extends outside its parent bounds. SVG child graphics do not expose normal client/scroll box metrics, so WhyDOM is using rendered geometry for this diagnosis."
        : "No rendered overflow is visible for this SVG graphics element. SVG child graphics do not expose normal client/scroll box metrics, so WhyDOM used rendered geometry instead of treating 0 × 0 client metrics as a normal box.";
      diagnostic.evidence = svgEvidence(metrics);
      diagnostic.fixes = [];
      return snapshot;
    }

    const style = getComputedStyle(element);
    if (diagnostic.status === "problem" && isLikelyIconGlyph(element, style, metrics)) {
      diagnostic.status = "ok";
      diagnostic.kind = "icon-glyph-metrics";
      diagnostic.confidence = "high";
      diagnostic.axes = { x: false, y: false };
      diagnostic.summary = "No actionable layout overflow is detected. The small scroll-height excess is consistent with icon-font glyph metrics inside a clipped icon box, not a layout element escaping its container.";
      diagnostic.evidence = iconEvidence(style, metrics);
      diagnostic.fixes = [];
    }

    snapshot.version = Math.max(Number(snapshot.version) || 0, 8);
    return snapshot;
  };
})();
