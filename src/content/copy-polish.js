(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.copyPolishInstalled || !WhyDOM.captureElement) return;
  WhyDOM.copyPolishInstalled = true;

  const originalCaptureElement = WhyDOM.captureElement;

  WhyDOM.captureElement = function captureElementWithCopyPolish(element) {
    const snapshot = originalCaptureElement(element);
    const position = snapshot.layoutFacts?.layout?.position;

    // Insets have no layout effect on a statically positioned element.
    // Keep them in authored-rule evidence for WHY diagnostics, but do not
    // present them as useful CSS to copy.
    if (position === "static" && snapshot.copyCss) {
      snapshot.copyCss = snapshot.copyCss.replace(/^\s{2}(?:top|right|bottom|left):[^\n]*;\n?/gm, "");
    }

    snapshot.version = Math.max(Number(snapshot.version) || 0, 6);
    return snapshot;
  };
})();
