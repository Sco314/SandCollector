(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.overflowDiagnosticInstalled || !WhyDOM.captureElement) return;
  WhyDOM.overflowDiagnosticInstalled = true;

  const previousCaptureElement = WhyDOM.captureElement;
  const TOLERANCE = 1.5;
  const REPLACED_TAGS = new Set(["IMG", "VIDEO", "CANVAS", "SVG", "IFRAME", "OBJECT", "EMBED", "TABLE"]);

  const state = {
    selected: null,
    diagnostic: null,
    fixes: [],
    trial: null
  };

  function px(value) {
    return `${Math.round(Number(value || 0) * 100) / 100}px`;
  }

  function isConnectedElement(element) {
    return element instanceof Element && element.isConnected && element.ownerDocument === document;
  }

  function parentContentBounds(parent) {
    if (!parent) return null;
    const rect = parent.getBoundingClientRect();
    return {
      left: rect.left + parent.clientLeft,
      right: rect.left + parent.clientLeft + parent.clientWidth,
      top: rect.top + parent.clientTop,
      bottom: rect.top + parent.clientTop + parent.clientHeight,
      width: parent.clientWidth,
      height: parent.clientHeight
    };
  }

  function measureOverflow(element) {
    if (!isConnectedElement(element)) return null;

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement;
    const parentBounds = parentContentBounds(parent);
    const inlineLike = style.display === "inline";

    const contentOverflowX = !inlineLike && element.clientWidth > 0
      ? Math.max(0, element.scrollWidth - element.clientWidth)
      : 0;
    const contentOverflowY = !inlineLike && element.clientHeight > 0
      ? Math.max(0, element.scrollHeight - element.clientHeight)
      : 0;

    let outsideParentX = 0;
    let outsideParentY = 0;
    if (parentBounds) {
      outsideParentX = Math.max(0, parentBounds.left - rect.left) + Math.max(0, rect.right - parentBounds.right);
      outsideParentY = Math.max(0, parentBounds.top - rect.top) + Math.max(0, rect.bottom - parentBounds.bottom);
    }

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
      parentAvailableWidth: parentBounds?.width ?? null,
      parentAvailableHeight: parentBounds?.height ?? null
    };
  }

  function findWidestDescendant(element) {
    const baseWidth = element.clientWidth || element.getBoundingClientRect().width;
    let widest = null;
    let count = 0;

    for (const child of element.querySelectorAll("*")) {
      if (++count > 120) break;
      if (!(child instanceof Element) || child.hasAttribute("data-whydom-ui")) continue;
      const rect = child.getBoundingClientRect();
      if (!(rect.width > baseWidth + TOLERANCE)) continue;
      if (!widest || rect.width > widest.width) {
        widest = { element: child, width: rect.width };
      }
    }

    return widest;
  }

  function hasAuthoredWidth(snapshot) {
    if (snapshot.inlineStyle && /(?:^|;)\s*width\s*:/i.test(snapshot.inlineStyle)) return true;
    return (snapshot.authoredRules || []).some((rule) => Boolean(rule.declarations?.width?.value));
  }

  function publicFix(fix, index) {
    return {
      id: `overflow-fix-${index}`,
      title: fix.title,
      targetSelector: fix.targetSelector,
      property: fix.property,
      value: fix.value,
      css: `${fix.targetSelector} {\n  ${fix.property}: ${fix.value};\n}`
    };
  }

  function analyzeOverflow(element, snapshot) {
    const metrics = measureOverflow(element);
    if (!metrics) {
      return {
        diagnostic: {
          id: "overflow",
          status: "unknown",
          summary: "The selected element changed before overflow could be measured.",
          confidence: "low",
          evidence: [],
          fixes: []
        },
        fixes: []
      };
    }

    const style = getComputedStyle(element);
    const parent = element.parentElement;
    const parentStyle = parent ? getComputedStyle(parent) : null;
    const x = metrics.overflowX > TOLERANCE;
    const y = metrics.overflowY > TOLERANCE;

    const baseEvidence = [
      { label: "Rendered size", value: `${px(metrics.rectWidth)} × ${px(metrics.rectHeight)}` },
      { label: "Client area", value: `${metrics.clientWidth}px × ${metrics.clientHeight}px` },
      { label: "Scroll area", value: `${metrics.scrollWidth}px × ${metrics.scrollHeight}px` }
    ];

    if (metrics.parentAvailableWidth !== null) {
      baseEvidence.push({ label: "Parent available width", value: `${metrics.parentAvailableWidth}px` });
    }

    if (!x && !y) {
      return {
        diagnostic: {
          id: "overflow",
          status: "ok",
          summary: "No measurable overflow is affecting this element right now.",
          confidence: "high",
          axes: { x: false, y: false },
          metrics,
          evidence: baseEvidence,
          fixes: []
        },
        fixes: []
      };
    }

    const fixes = [];
    let kind = "overflow-unresolved";
    let confidence = "medium";
    let summary = x ? "Horizontal overflow is present, but the first-pass engine cannot isolate one dominant cause yet." : "Vertical overflow is present, but the first-pass engine cannot isolate one dominant cause yet.";
    const evidence = [...baseEvidence];

    if (x && parentStyle?.display?.includes("flex") && style.minWidth === "auto" && metrics.outsideParentX > TOLERANCE) {
      kind = "flex-min-width-auto";
      confidence = "high";
      summary = "This flex item is wider than the space its parent can give it, and its automatic minimum size is preventing it from shrinking.";
      evidence.push(
        { label: "Parent display", value: parentStyle.display },
        { label: "Selected min-width", value: style.minWidth },
        { label: "Outside parent", value: px(metrics.outsideParentX) }
      );
      fixes.push({
        title: "Allow the flex item to shrink",
        target: element,
        targetSelector: snapshot.selector,
        property: "min-width",
        value: "0"
      });
    } else if (x && parentStyle?.display?.includes("grid") && style.minWidth === "auto" && metrics.outsideParentX > TOLERANCE) {
      kind = "grid-min-width-auto";
      confidence = "high";
      summary = "This grid item is wider than its available track because its automatic minimum size is preventing it from shrinking.";
      evidence.push(
        { label: "Parent display", value: parentStyle.display },
        { label: "Selected min-width", value: style.minWidth },
        { label: "Outside parent", value: px(metrics.outsideParentX) }
      );
      fixes.push({
        title: "Allow the grid item to shrink",
        target: element,
        targetSelector: snapshot.selector,
        property: "min-width",
        value: "0"
      });
    } else if (x && ["nowrap", "pre"].includes(style.whiteSpace) && metrics.contentOverflowX > TOLERANCE) {
      kind = "white-space-nowrap";
      confidence = "high";
      summary = "The element's text is not allowed to wrap, so its content requires more horizontal space than the box provides.";
      evidence.push(
        { label: "white-space", value: style.whiteSpace },
        { label: "Content overflow", value: px(metrics.contentOverflowX) }
      );
      fixes.push({
        title: "Allow text to wrap",
        target: element,
        targetSelector: snapshot.selector,
        property: "white-space",
        value: "normal"
      });
    } else if (x) {
      const widest = findWidestDescendant(element);
      if (widest && REPLACED_TAGS.has(widest.element.tagName)) {
        kind = "oversized-replaced-child";
        confidence = "high";
        const childSelector = WhyDOM.buildSelector?.(widest.element) || widest.element.tagName.toLowerCase();
        summary = `A ${widest.element.tagName.toLowerCase()} inside this element is wider than the available content box.`;
        evidence.push(
          { label: "Wide child", value: childSelector },
          { label: "Child width", value: px(widest.width) },
          { label: "Available width", value: `${metrics.clientWidth}px` }
        );
        fixes.push({
          title: "Constrain the oversized child",
          target: widest.element,
          targetSelector: childSelector,
          property: "max-width",
          value: "100%"
        });
      } else if (hasAuthoredWidth(snapshot) && metrics.outsideParentX > TOLERANCE) {
        kind = "fixed-width-overflow";
        confidence = "medium";
        summary = "The selected element has an authored width and renders wider than the space available in its parent.";
        evidence.push(
          { label: "Computed width", value: style.width },
          { label: "Outside parent", value: px(metrics.outsideParentX) }
        );
        fixes.push({
          title: "Constrain the element to its parent",
          target: element,
          targetSelector: snapshot.selector,
          property: "max-width",
          value: "100%"
        });
      } else if (widest) {
        const childSelector = WhyDOM.buildSelector?.(widest.element) || widest.element.tagName.toLowerCase();
        kind = "wide-descendant";
        confidence = "medium";
        summary = "A descendant is wider than this element's available content box and is the strongest visible overflow contributor.";
        evidence.push(
          { label: "Wide descendant", value: childSelector },
          { label: "Descendant width", value: px(widest.width) },
          { label: "Available width", value: `${metrics.clientWidth}px` }
        );
      }
    }

    const publicFixes = fixes.map(publicFix);
    return {
      diagnostic: {
        id: "overflow",
        status: "problem",
        kind,
        summary,
        confidence,
        axes: { x, y },
        metrics,
        evidence,
        fixes: publicFixes
      },
      fixes
    };
  }

  function waitForPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function restoreTrial() {
    const trial = state.trial;
    if (!trial) return false;
    const { target, property, previousValue, previousPriority } = trial;
    if (isConnectedElement(target)) {
      if (previousValue) target.style.setProperty(property, previousValue, previousPriority);
      else target.style.removeProperty(property);
    }
    state.trial = null;
    return true;
  }

  WhyDOM.captureElement = function captureWithOverflowDiagnostic(element) {
    restoreTrial();
    const snapshot = previousCaptureElement(element);
    const result = analyzeOverflow(element, snapshot);

    snapshot.version = Math.max(Number(snapshot.version) || 0, 7);
    snapshot.diagnostics = snapshot.diagnostics || {};
    snapshot.diagnostics.overflow = result.diagnostic;

    state.selected = element;
    state.diagnostic = result.diagnostic;
    state.fixes = result.fixes;
    state.trial = null;

    return snapshot;
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "WHYDOM_APPLY_OVERFLOW_FIX") {
      (async () => {
        const index = Number(message.fixIndex || 0);
        const fix = state.fixes[index];
        if (!fix || !isConnectedElement(state.selected) || !isConnectedElement(fix.target)) {
          sendResponse({ ok: false, error: "The selected element changed. Pick it again before trying the fix." });
          return;
        }

        restoreTrial();
        const before = measureOverflow(state.selected);
        const previousValue = fix.target.style.getPropertyValue(fix.property);
        const previousPriority = fix.target.style.getPropertyPriority(fix.property);
        fix.target.style.setProperty(fix.property, fix.value, "important");
        state.trial = { ...fix, previousValue, previousPriority };

        await waitForPaint();
        const after = measureOverflow(state.selected);
        const axisX = Boolean(state.diagnostic?.axes?.x);
        const axisY = Boolean(state.diagnostic?.axes?.y);
        const resolved = Boolean(after) && (!axisX || after.overflowX <= TOLERANCE) && (!axisY || after.overflowY <= TOLERANCE);

        sendResponse({
          ok: true,
          resolved,
          before,
          after,
          fix: publicFix(fix, index)
        });
      })().catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    }

    if (message?.type === "WHYDOM_UNDO_OVERFLOW_FIX") {
      (async () => {
        const undone = restoreTrial();
        await waitForPaint();
        sendResponse({ ok: undone, after: state.selected ? measureOverflow(state.selected) : null });
      })().catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    }
  });
})();
