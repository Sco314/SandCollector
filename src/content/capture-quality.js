(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.captureQualityInstalled || !WhyDOM.captureElement) return;
  WhyDOM.captureQualityInstalled = true;

  const originalCaptureElement = WhyDOM.captureElement;

  const GENERIC_UTILITY_CLASSES = new Set([
    "block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid", "hidden",
    "relative", "absolute", "fixed", "sticky", "static", "group", "container",
    "grow", "shrink", "truncate", "uppercase", "lowercase", "capitalize",
    "flex-none", "flex-auto", "flex-initial", "flex-wrap", "flex-nowrap",
    "ease-in", "ease-out", "ease-in-out", "transition", "transition-all",
    "items-start", "items-center", "items-end", "items-stretch",
    "justify-start", "justify-center", "justify-end", "justify-between",
    "text-left", "text-center", "text-right", "whitespace-nowrap"
  ]);

  const UTILITY_PREFIX = /^(?:m|mx|my|mt|mr|mb|ml|p|px|py|pt|pr|pb|pl|gap|space|w|h|size|min-w|max-w|min-h|max-h|leading|text|font|z|top|right|bottom|left|inset|rounded|bg|border|shadow|opacity|overflow|whitespace|items|justify|content|self|basis|flex|grid|col|row|order|object|aspect|transition|duration|delay|ease|cursor|outline|ring)-/;

  const DEFAULT_VALUES = {
    position: new Set(["static"]),
    top: new Set(["auto"]),
    right: new Set(["auto"]),
    bottom: new Set(["auto"]),
    left: new Set(["auto"]),
    "z-index": new Set(["auto"]),
    "min-width": new Set(["0px", "auto"]),
    "min-height": new Set(["0px", "auto"]),
    "max-width": new Set(["none"]),
    "max-height": new Set(["none"]),
    "margin-top": new Set(["0px"]),
    "margin-right": new Set(["0px"]),
    "margin-bottom": new Set(["0px"]),
    "margin-left": new Set(["0px"]),
    "padding-top": new Set(["0px"]),
    "padding-right": new Set(["0px"]),
    "padding-bottom": new Set(["0px"]),
    "padding-left": new Set(["0px"]),
    gap: new Set(["normal"]),
    "row-gap": new Set(["normal"]),
    "column-gap": new Set(["normal"]),
    overflow: new Set(["visible"]),
    "overflow-x": new Set(["visible"]),
    "overflow-y": new Set(["visible"]),
    "border-top-width": new Set(["0px"]),
    "border-right-width": new Set(["0px"]),
    "border-bottom-width": new Set(["0px"]),
    "border-left-width": new Set(["0px"]),
    "border-radius": new Set(["0px"]),
    "background-image": new Set(["none"]),
    "box-shadow": new Set(["none"]),
    "font-style": new Set(["normal"]),
    "letter-spacing": new Set(["normal"]),
    "text-decoration-line": new Set(["none"]),
    "text-transform": new Set(["none"]),
    "white-space": new Set(["normal"]),
    "word-break": new Set(["normal"]),
    opacity: new Set(["1"]),
    visibility: new Set(["visible"]),
    transform: new Set(["none"]),
    "flex-direction": new Set(["row"]),
    "flex-wrap": new Set(["nowrap"]),
    "flex-grow": new Set(["0"]),
    "flex-shrink": new Set(["1"]),
    "flex-basis": new Set(["auto"]),
    "justify-content": new Set(["normal"]),
    "align-items": new Set(["normal"]),
    "align-self": new Set(["auto"])
  };

  const COPY_PROPERTIES = [
    "box-sizing", "display", "position", "top", "right", "bottom", "left", "z-index",
    "width", "height", "min-width", "min-height", "max-width", "max-height",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "gap", "row-gap", "column-gap",
    "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
    "justify-content", "align-items", "align-self",
    "grid-template-columns", "grid-template-rows", "grid-column", "grid-row",
    "overflow", "overflow-x", "overflow-y",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-radius", "background-color", "background-image", "box-shadow",
    "color", "font-family", "font-size", "font-weight", "font-style", "line-height",
    "letter-spacing", "text-align", "text-decoration-line", "text-transform",
    "white-space", "word-break", "opacity", "visibility", "transform"
  ];

  const SOURCE_VALUE_PROPERTIES = new Set([
    "width", "height", "min-width", "min-height", "max-width", "max-height",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "gap", "row-gap", "column-gap", "top", "right", "bottom", "left"
  ]);

  function escapeIdentifier(value) {
    const text = String(value);
    if (/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(text)) return text;
    return globalThis.CSS?.escape ? CSS.escape(text) : text.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function escapeAttribute(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function isUnique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (error) {
      return false;
    }
  }

  function isHashedClass(name) {
    return /^(?:css|jsx|sc)-?[a-z0-9]{6,}$/i.test(name) || /[a-f0-9]{12,}/i.test(name);
  }

  function isUtilityClass(name) {
    if (!name) return true;
    if (GENERIC_UTILITY_CLASSES.has(name)) return true;
    if (UTILITY_PREFIX.test(name)) return true;
    return false;
  }

  function usableClass(name) {
    return Boolean(name) && name.length <= 80 && /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(name) && !isHashedClass(name);
  }

  function classInfo(element) {
    return [...element.classList]
      .filter(usableClass)
      .map((name) => ({ name, utility: isUtilityClass(name) }));
  }

  function candidate(selector, score, kind, reason) {
    return { selector, score, kind, reason };
  }

  function directCandidates(element) {
    const tag = element.localName || element.tagName.toLowerCase();
    const candidates = [];

    if (element.id) {
      candidates.push(candidate(`#${escapeIdentifier(element.id)}`, 100, "semantic", "unique id"));
    }

    for (const name of ["data-testid", "data-test", "data-qa"]) {
      const value = element.getAttribute(name);
      if (value && value.length <= 160) {
        candidates.push(candidate(`${tag}[${name}="${escapeAttribute(value)}"]`, 96, "semantic", name));
        candidates.push(candidate(`[${name}="${escapeAttribute(value)}"]`, 95, "semantic", name));
      }
    }

    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.length <= 160) {
      candidates.push(candidate(`${tag}[aria-label="${escapeAttribute(ariaLabel)}"]`, 92, "semantic", "aria-label"));
    }

    const name = element.getAttribute("name");
    if (name && name.length <= 120) {
      candidates.push(candidate(`${tag}[name="${escapeAttribute(name)}"]`, 88, "semantic", "name attribute"));
    }

    const href = element.getAttribute("href");
    if (tag === "a" && href && href.length <= 260 && !/^javascript:/i.test(href)) {
      candidates.push(candidate(`a[href="${escapeAttribute(href)}"]`, 78, "semantic", "href"));
    }

    const classes = classInfo(element);
    const semanticClasses = classes.filter((item) => !item.utility).slice(0, 5);
    const utilityClasses = classes.filter((item) => item.utility).slice(0, 4);

    for (const item of semanticClasses) {
      const cls = `.${escapeIdentifier(item.name)}`;
      candidates.push(candidate(`${tag}${cls}`, 72, "class", "semantic class"));
      candidates.push(candidate(cls, 70, "class", "semantic class"));
    }

    for (let i = 0; i < Math.min(semanticClasses.length, 4); i += 1) {
      for (let j = i + 1; j < Math.min(semanticClasses.length, 4); j += 1) {
        const pair = `.${escapeIdentifier(semanticClasses[i].name)}.${escapeIdentifier(semanticClasses[j].name)}`;
        candidates.push(candidate(`${tag}${pair}`, 74, "class", "semantic class pair"));
        candidates.push(candidate(pair, 73, "class", "semantic class pair"));
      }
    }

    for (const item of utilityClasses) {
      const cls = `.${escapeIdentifier(item.name)}`;
      candidates.push(candidate(`${tag}${cls}`, 35, "utility", "utility class"));
      candidates.push(candidate(cls, 30, "utility", "utility class"));
    }

    candidates.push(candidate(tag, 10, "tag", "tag name"));

    return candidates.sort((a, b) => b.score - a.score || a.selector.length - b.selector.length);
  }

  function bestSemanticSegment(element) {
    const direct = directCandidates(element);
    const semantic = direct.find((item) => item.score >= 65);
    if (semantic) return semantic.selector;
    return element.localName || element.tagName.toLowerCase();
  }

  function bestFallbackSegment(element) {
    const direct = directCandidates(element);
    const semantic = direct.find((item) => item.score >= 65);
    if (semantic) return semantic.selector;
    const utility = direct.find((item) => item.kind === "utility");
    if (utility) return utility.selector;
    return element.localName || element.tagName.toLowerCase();
  }

  function nthSegment(element) {
    const base = bestFallbackSegment(element);
    const parent = element.parentElement;
    if (!parent || base.startsWith("#") || base.includes("[")) return base;

    let matching = [];
    try {
      matching = [...parent.children].filter((child) => child.matches(base));
    } catch (error) {
      matching = [];
    }

    if (matching.length <= 1) return base;

    const sameTag = [...parent.children].filter((child) => child.localName === element.localName);
    return `${base}:nth-of-type(${sameTag.indexOf(element) + 1})`;
  }

  function buildBetterSelector(element) {
    if (!(element instanceof Element)) {
      return { selector: "", quality: { confidence: "low", kind: "none", reason: "not an element" } };
    }

    // Direct answers are accepted only when they carry semantic identity.
    // Utility classes are deferred until after short ancestor paths are tried.
    for (const item of directCandidates(element)) {
      if (item.score < 65) continue;
      if (isUnique(item.selector)) {
        return {
          selector: item.selector,
          quality: {
            confidence: item.score >= 85 ? "high" : "medium",
            kind: item.kind,
            reason: item.reason,
            unique: true
          }
        };
      }
    }

    // Prefer a stable semantic ancestor + plain child tags over a utility selector.
    const parts = [];
    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
      parts.unshift(bestSemanticSegment(current));
      const selector = parts.join(" > ");
      if (isUnique(selector)) {
        return {
          selector,
          quality: {
            confidence: depth <= 2 ? "medium" : "low",
            kind: "structural",
            reason: "semantic ancestor path",
            unique: true
          }
        };
      }
      current = current.parentElement;
    }

    // Only now allow a unique utility-class selector as a compact fallback.
    for (const item of directCandidates(element)) {
      if (item.kind !== "utility") continue;
      if (isUnique(item.selector)) {
        return {
          selector: item.selector,
          quality: { confidence: "low", kind: "utility", reason: "unique utility fallback", unique: true }
        };
      }
    }

    parts.length = 0;
    current = element;
    for (let depth = 0; current && depth < 8; depth += 1) {
      parts.unshift(nthSegment(current));
      const selector = parts.join(" > ");
      if (isUnique(selector)) {
        return {
          selector,
          quality: { confidence: "low", kind: "positional", reason: "positional fallback", unique: true }
        };
      }
      current = current.parentElement;
    }

    return {
      selector: parts.join(" > "),
      quality: { confidence: "low", kind: "fallback", reason: "best available fallback", unique: false }
    };
  }

  function declarationsFor(snapshot, property) {
    const declarations = [];
    for (const rule of snapshot.authoredRules || []) {
      const declaration = rule.declarations?.[property];
      if (!declaration?.value) continue;
      declarations.push({ value: declaration.value.trim(), important: Boolean(declaration.important) });
    }
    return declarations;
  }

  function preferredSourceValue(element, snapshot, property, computedValue) {
    if (!SOURCE_VALUE_PROPERTIES.has(property)) return computedValue;

    const inlineValue = element.style?.getPropertyValue(property)?.trim();
    if (inlineValue) return inlineValue.includes("var(") ? computedValue : inlineValue;

    const declarations = declarationsFor(snapshot, property);
    if (!declarations.length) return computedValue;

    const important = declarations.filter((item) => item.important);
    const pool = important.length ? important : declarations;
    const values = [...new Set(pool.map((item) => item.value))];

    if (values.length === 1 && !values[0].includes("var(")) return values[0];

    // auto margins resolve to pixel values in computed style; retain authored intent.
    if (["margin-left", "margin-right", "margin-top", "margin-bottom"].includes(property) && values.includes("auto")) {
      return "auto";
    }

    // Prefer the last non-variable authored value as a best-effort cascade approximation.
    const lastUsable = [...pool].reverse().find((item) => item.value && !item.value.includes("var("));
    return lastUsable?.value || computedValue;
  }

  function hasAuthoredProperty(element, snapshot, property) {
    if (element.style?.getPropertyValue(property)?.trim()) return true;
    return declarationsFor(snapshot, property).length > 0;
  }

  function borderSideFromProperty(property) {
    const match = /^border-(top|right|bottom|left)-(?:style|color)$/.exec(property);
    return match?.[1] || null;
  }

  function shouldInclude(element, snapshot, property, value, style, included) {
    if (!value) return false;
    if (DEFAULT_VALUES[property]?.has(value)) return false;

    if (["width", "height"].includes(property)) {
      if (!hasAuthoredProperty(element, snapshot, property)) return false;
      const sourceValues = declarationsFor(snapshot, property).map((item) => item.value);
      const inlineValue = element.style?.getPropertyValue(property)?.trim();
      if ((inlineValue === "auto" || (!inlineValue && sourceValues.length && sourceValues.every((item) => item === "auto")))) {
        return false;
      }
    }

    if (["top", "right", "bottom", "left"].includes(property) && value === "0px") {
      if (["static", "relative"].includes(style.position)) return false;
      if (!hasAuthoredProperty(element, snapshot, property)) return false;
    }

    if (property.startsWith("flex-") || ["justify-content", "align-items", "align-self"].includes(property)) {
      const parentDisplay = snapshot.layoutFacts.parentLayout?.display || "";
      const ownDisplay = style.display || "";
      if (!parentDisplay.includes("flex") && !ownDisplay.includes("flex")) return false;
    }

    if (property.startsWith("grid-") || property.startsWith("grid-template")) {
      const parentDisplay = snapshot.layoutFacts.parentLayout?.display || "";
      const ownDisplay = style.display || "";
      if (!parentDisplay.includes("grid") && !ownDisplay.includes("grid")) return false;
    }

    const borderSide = borderSideFromProperty(property);
    if (borderSide) {
      const width = Number.parseFloat(style[`border-${borderSide}-width`] || "0");
      if (!(width > 0)) return false;
      if (property.endsWith("-style") && value === "none") return false;
    }

    if (property === "background-color" && ["rgba(0, 0, 0, 0)", "transparent"].includes(value)) {
      if (!hasAuthoredProperty(element, snapshot, property)) return false;
    }

    // Avoid shorthand + longhand duplication in copied output.
    if (["row-gap", "column-gap"].includes(property) && included.has("gap")) return false;
    if (["overflow-x", "overflow-y"].includes(property) && included.has("overflow")) {
      const axisValue = property === "overflow-x" ? style["overflow-x"] : style["overflow-y"];
      if (axisValue === style.overflow) return false;
    }

    return true;
  }

  function formatCleanerCss(element, snapshot) {
    const style = snapshot.computedStyles || {};
    const lines = [];
    const included = new Set();

    for (const property of COPY_PROPERTIES) {
      const computedValue = style[property];
      if (!computedValue) continue;

      const value = preferredSourceValue(element, snapshot, property, computedValue);
      if (!shouldInclude(element, snapshot, property, value, style, included)) continue;
      lines.push(`  ${property}: ${value};`);
      included.add(property);
    }

    return `${snapshot.selector} {\n${lines.join("\n")}\n}`;
  }

  WhyDOM.captureElement = function captureElementWithQuality(element) {
    const snapshot = originalCaptureElement(element);
    const selectorResult = buildBetterSelector(element);

    snapshot.version = Math.max(Number(snapshot.version) || 0, 4);
    snapshot.selector = selectorResult.selector;
    snapshot.selectorQuality = selectorResult.quality;
    snapshot.copyCss = formatCleanerCss(element, snapshot);
    snapshot.copyCssMode = "clean-computed";

    return snapshot;
  };

  WhyDOM.buildSelector = (element) => buildBetterSelector(element).selector;
  WhyDOM.formatUsefulCss = (snapshot, element) => element ? formatCleanerCss(element, snapshot) : snapshot.copyCss;
})();
