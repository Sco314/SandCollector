(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.copyPolishInstalled || !WhyDOM.captureElement) return;
  WhyDOM.copyPolishInstalled = true;

  const originalCaptureElement = WhyDOM.captureElement;
  const INSETS = ["top", "right", "bottom", "left"];

  function hasAuthoredDeclaration(snapshot, property) {
    if (!snapshot) return false;

    const inline = snapshot.inlineStyle || "";
    const propertyPattern = new RegExp(`(?:^|;)\\s*${property}\\s*:`, "i");
    if (propertyPattern.test(inline)) return true;

    // inset is the shorthand for all four physical inset properties.
    if (INSETS.includes(property) && /(?:^|;)\s*inset\s*:/i.test(inline)) return true;

    return (snapshot.authoredRules || []).some((rule) => {
      if (rule.declarations?.[property]?.value) return true;
      if (INSETS.includes(property) && rule.declarations?.inset?.value) return true;
      return false;
    });
  }

  function removeProperty(cssText, property) {
    if (!cssText) return cssText || "";
    const pattern = new RegExp(`^\\s{2}${property}:[^\\n]*;\\n?`, "gm");
    return cssText.replace(pattern, "");
  }

  WhyDOM.captureElement = function captureElementWithCopyPolish(element) {
    const snapshot = originalCaptureElement(element);
    const position = snapshot.layoutFacts?.layout?.position;

    // Browser computed style resolves unused/opposite inset values into pixels.
    // Only copy inset properties that were actually authored. Static elements
    // never get useful positioning from top/right/bottom/left, even when a rule
    // happened to declare them.
    for (const property of INSETS) {
      const useful = position !== "static" && hasAuthoredDeclaration(snapshot, property);
      if (!useful) snapshot.copyCss = removeProperty(snapshot.copyCss, property);
    }

    snapshot.version = Math.max(Number(snapshot.version) || 0, 8);
    return snapshot;
  };
})();
