(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.captureElement) return;

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

  const DEFAULT_VALUES = new Map([
    ["position", "static"], ["top", "auto"], ["right", "auto"], ["bottom", "auto"], ["left", "auto"],
    ["z-index", "auto"], ["min-width", "0px"], ["min-height", "0px"], ["max-width", "none"],
    ["max-height", "none"], ["margin-top", "0px"], ["margin-right", "0px"], ["margin-bottom", "0px"],
    ["margin-left", "0px"], ["padding-top", "0px"], ["padding-right", "0px"], ["padding-bottom", "0px"],
    ["padding-left", "0px"], ["gap", "normal"], ["row-gap", "normal"], ["column-gap", "normal"],
    ["overflow", "visible"], ["overflow-x", "visible"], ["overflow-y", "visible"],
    ["border-top-width", "0px"], ["border-right-width", "0px"], ["border-bottom-width", "0px"],
    ["border-left-width", "0px"], ["border-radius", "0px"], ["background-image", "none"],
    ["box-shadow", "none"], ["font-style", "normal"], ["letter-spacing", "normal"],
    ["text-decoration-line", "none"], ["text-transform", "none"], ["white-space", "normal"],
    ["word-break", "normal"], ["opacity", "1"], ["visibility", "visible"], ["transform", "none"]
  ]);

  function escapeIdentifier(value) {
    const text = String(value);
    if (/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(text)) return text;
    return globalThis.CSS?.escape ? CSS.escape(text) : text.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function uniqueSelector(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (error) {
      return false;
    }
  }

  function isStableClass(name) {
    if (!name || name.length > 80) return false;
    if (!/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(name)) return false;
    if (/^(css|jsx|sc)-?[a-z0-9]{6,}$/i.test(name)) return false;
    if (/[a-f0-9]{12,}/i.test(name)) return false;
    return true;
  }

  function stableClasses(element) {
    return [...element.classList].filter(isStableClass).slice(0, 5);
  }

  function attributeCandidates(element) {
    const candidates = [];
    for (const name of ["data-testid", "data-test", "data-qa"]) {
      const value = element.getAttribute(name);
      if (!value) continue;
      const escaped = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      candidates.push(`[${name}="${escaped}"]`);
    }
    return candidates;
  }

  function directCandidates(element) {
    const tag = element.localName || element.tagName.toLowerCase();
    const candidates = [];

    if (element.id) candidates.push(`#${escapeIdentifier(element.id)}`);
    candidates.push(...attributeCandidates(element));

    const classes = stableClasses(element);
    for (const className of classes) {
      const cls = `.${escapeIdentifier(className)}`;
      candidates.push(cls, `${tag}${cls}`);
    }

    for (let i = 0; i < Math.min(classes.length, 4); i += 1) {
      for (let j = i + 1; j < Math.min(classes.length, 4); j += 1) {
        const pair = `.${escapeIdentifier(classes[i])}.${escapeIdentifier(classes[j])}`;
        candidates.push(pair, `${tag}${pair}`);
      }
    }

    candidates.push(tag);
    return [...new Set(candidates)].sort((a, b) => a.length - b.length);
  }

  function bestSegment(element) {
    const tag = element.localName || element.tagName.toLowerCase();

    if (element.id) {
      const id = `#${escapeIdentifier(element.id)}`;
      if (uniqueSelector(id)) return id;
    }

    for (const candidate of attributeCandidates(element)) {
      if (uniqueSelector(candidate)) return candidate;
    }

    const classes = stableClasses(element);
    if (classes.length) return `${tag}.${escapeIdentifier(classes[0])}`;
    return tag;
  }

  function nthSegment(element) {
    let segment = bestSegment(element);
    const parent = element.parentElement;
    if (!parent || segment.startsWith("#") || segment.startsWith("[")) return segment;

    const matching = [...parent.children].filter((child) => {
      try {
        return child.matches(segment);
      } catch (error) {
        return false;
      }
    });

    if (matching.length <= 1) return segment;

    const sameTag = [...parent.children].filter((child) => child.localName === element.localName);
    return `${segment}:nth-of-type(${sameTag.indexOf(element) + 1})`;
  }

  function buildSelector(element) {
    if (!(element instanceof Element)) return "";

    for (const candidate of directCandidates(element)) {
      if (uniqueSelector(candidate)) return candidate;
    }

    const parts = [];
    let current = element;
    let depth = 0;

    while (current && current instanceof Element && depth < 6) {
      parts.unshift(bestSegment(current));
      const candidate = parts.join(" > ");
      if (uniqueSelector(candidate)) return candidate;
      current = current.parentElement;
      depth += 1;
    }

    parts.length = 0;
    current = element;
    depth = 0;

    while (current && current instanceof Element && depth < 8) {
      parts.unshift(nthSegment(current));
      const candidate = parts.join(" > ");
      if (uniqueSelector(candidate)) return candidate;
      current = current.parentElement;
      depth += 1;
    }

    return parts.join(" > ");
  }

  function styleObject(computedStyle, properties = COPY_PROPERTIES) {
    const result = {};
    for (const property of properties) {
      const value = computedStyle.getPropertyValue(property).trim();
      if (value) result[property] = value;
    }
    return result;
  }

  function getStackingContextReasons(style, element) {
    const reasons = [];
    if (element === document.documentElement) reasons.push("root element");
    if (["absolute", "relative"].includes(style.position) && style.zIndex !== "auto") {
      reasons.push(`${style.position} with z-index ${style.zIndex}`);
    }
    if (["fixed", "sticky"].includes(style.position)) reasons.push(`position: ${style.position}`);
    if (Number.parseFloat(style.opacity) < 1) reasons.push(`opacity: ${style.opacity}`);
    if (style.transform !== "none") reasons.push(`transform: ${style.transform}`);
    if (style.filter !== "none") reasons.push(`filter: ${style.filter}`);
    if (style.perspective !== "none") reasons.push(`perspective: ${style.perspective}`);
    if (style.isolation === "isolate") reasons.push("isolation: isolate");
    if (style.mixBlendMode !== "normal") reasons.push(`mix-blend-mode: ${style.mixBlendMode}`);
    if (style.contain.includes("paint") || style.contain.includes("layout")) reasons.push(`contain: ${style.contain}`);
    return reasons;
  }

  function captureLayoutFacts(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement;
    const parentStyle = parent ? getComputedStyle(parent) : null;

    return {
      rect: {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left
      },
      scroll: {
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        overflowsX: element.scrollWidth > element.clientWidth + 1,
        overflowsY: element.scrollHeight > element.clientHeight + 1
      },
      layout: {
        display: style.display,
        position: style.position,
        boxSizing: style.boxSizing,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        zIndex: style.zIndex,
        width: style.width,
        height: style.height,
        minWidth: style.minWidth,
        minHeight: style.minHeight,
        maxWidth: style.maxWidth,
        maxHeight: style.maxHeight,
        flexGrow: style.flexGrow,
        flexShrink: style.flexShrink,
        flexBasis: style.flexBasis,
        gridColumn: style.gridColumn,
        gridRow: style.gridRow,
        transform: style.transform,
        visibility: style.visibility,
        opacity: style.opacity
      },
      parentLayout: parentStyle ? {
        selector: buildSelector(parent),
        display: parentStyle.display,
        position: parentStyle.position,
        overflowX: parentStyle.overflowX,
        overflowY: parentStyle.overflowY,
        width: parentStyle.width,
        height: parentStyle.height,
        gridTemplateColumns: parentStyle.gridTemplateColumns,
        gridTemplateRows: parentStyle.gridTemplateRows,
        flexDirection: parentStyle.flexDirection,
        justifyContent: parentStyle.justifyContent,
        alignItems: parentStyle.alignItems,
        gap: parentStyle.gap
      } : null,
      stackingContextReasons: getStackingContextReasons(style, element)
    };
  }

  function captureAncestors(element, maxDepth = 12) {
    const ancestors = [];
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < maxDepth) {
      const style = getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      ancestors.push({
        selector: buildSelector(current),
        tagName: current.tagName.toLowerCase(),
        display: style.display,
        position: style.position,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        width: style.width,
        height: style.height,
        rect: { width: rect.width, height: rect.height },
        stackingContextReasons: getStackingContextReasons(style, current)
      });
      current = current.parentElement;
      depth += 1;
    }

    return ancestors;
  }

  function collectMatchedRules(element) {
    const matches = [];
    let inaccessibleStylesheets = 0;

    function visitRules(rules, source, conditions = []) {
      for (const rule of rules) {
        if (matches.length >= 100) return;

        if (rule.selectorText && rule.style) {
          let isMatch = false;
          try { isMatch = element.matches(rule.selectorText); } catch (error) { isMatch = false; }
          if (isMatch) {
            const declarations = {};
            for (const property of rule.style) {
              declarations[property] = {
                value: rule.style.getPropertyValue(property).trim(),
                important: rule.style.getPropertyPriority(property) === "important"
              };
            }
            matches.push({ selector: rule.selectorText, source, conditions, declarations });
          }
          continue;
        }

        if (rule.cssRules) {
          let label = rule.constructor?.name || "group";
          if (rule.conditionText) label += `: ${rule.conditionText}`;
          if (rule.name) label += `: ${rule.name}`;
          visitRules(rule.cssRules, source, [...conditions, label]);
        }
      }
    }

    for (const stylesheet of document.styleSheets) {
      const source = stylesheet.href || "inline stylesheet";
      try { visitRules(stylesheet.cssRules, source); } catch (error) { inaccessibleStylesheets += 1; }
    }

    return { matches, inaccessibleStylesheets };
  }

  function shouldInclude(property, value, style) {
    if (!value) return false;
    if (DEFAULT_VALUES.has(property) && DEFAULT_VALUES.get(property) === value) return false;

    if (property.startsWith("flex-") || ["justify-content", "align-items", "align-self"].includes(property)) {
      const parentDisplay = style.__parentDisplay || "";
      const ownDisplay = style.display || "";
      if (!parentDisplay.includes("flex") && !ownDisplay.includes("flex")) return false;
    }

    if (property.startsWith("grid-") || property.startsWith("grid-template")) {
      const parentDisplay = style.__parentDisplay || "";
      const ownDisplay = style.display || "";
      if (!parentDisplay.includes("grid") && !ownDisplay.includes("grid")) return false;
    }

    if (property.includes("border-") && property.endsWith("-style") && value === "none") return false;
    if (property.includes("border-") && property.endsWith("-color") && style[property.replace("color", "style")] === "none") return false;
    return true;
  }

  function formatUsefulCss(snapshot) {
    const style = {
      ...snapshot.computedStyles,
      __parentDisplay: snapshot.layoutFacts.parentLayout?.display || ""
    };
    const lines = [];
    for (const property of COPY_PROPERTIES) {
      const value = style[property];
      if (shouldInclude(property, value, style)) lines.push(`  ${property}: ${value};`);
    }
    return `${snapshot.selector} {\n${lines.join("\n")}\n}`;
  }

  function captureElement(element) {
    const style = getComputedStyle(element);
    const selector = buildSelector(element);
    const authored = collectMatchedRules(element);

    const snapshot = {
      version: 2,
      capturedAt: new Date().toISOString(),
      url: location.href,
      selector,
      identity: {
        tagName: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: [...element.classList],
        role: element.getAttribute("role"),
        ariaLabel: element.getAttribute("aria-label")
      },
      dom: {
        outerHTML: element.outerHTML,
        childElementCount: element.childElementCount,
        textPreview: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 240)
      },
      computedStyles: styleObject(style),
      authoredRules: authored.matches,
      inaccessibleStylesheets: authored.inaccessibleStylesheets,
      inlineStyle: element.getAttribute("style") || "",
      layoutFacts: captureLayoutFacts(element),
      ancestors: captureAncestors(element)
    };

    snapshot.copyCss = formatUsefulCss(snapshot);
    return snapshot;
  }

  WhyDOM.buildSelector = buildSelector;
  WhyDOM.captureElement = captureElement;
  WhyDOM.formatUsefulCss = formatUsefulCss;
})();
