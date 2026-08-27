(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.captureSafetyInstalled || !WhyDOM.captureElement) return;
  WhyDOM.captureSafetyInstalled = true;

  const originalCaptureElement = WhyDOM.captureElement;

  function cleanReasons(reasons) {
    return (Array.isArray(reasons) ? reasons : []).filter((reason) => {
      if (typeof reason !== "string") return false;
      const text = reason.trim();
      if (!text) return false;
      if (/^(?:transform|filter|perspective|mix-blend-mode|contain):\s*$/i.test(text)) return false;
      return true;
    });
  }

  function validateSnapshot(snapshot) {
    const layout = snapshot?.layoutFacts?.layout;
    const computedStyles = snapshot?.computedStyles;

    if (!snapshot || !layout?.display || !computedStyles || Object.keys(computedStyles).length === 0) {
      throw new Error("WhyDOM target changed before capture completed.");
    }

    snapshot.layoutFacts.stackingContextReasons = cleanReasons(
      snapshot.layoutFacts.stackingContextReasons
    );

    for (const ancestor of snapshot.ancestors || []) {
      ancestor.stackingContextReasons = cleanReasons(ancestor.stackingContextReasons);
    }

    return snapshot;
  }

  WhyDOM.captureElement = function captureConnectedElement(element) {
    if (!(element instanceof Element) || !element.isConnected || !document.documentElement.contains(element)) {
      throw new Error("WhyDOM cannot capture a detached element.");
    }

    return validateSnapshot(originalCaptureElement(element));
  };
})();
