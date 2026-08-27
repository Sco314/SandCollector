(() => {
  const WhyDOM = (globalThis.WhyDOM = globalThis.WhyDOM || {});

  if (WhyDOM.selectorConsistencyInstalled || !WhyDOM.captureElement) return;
  WhyDOM.selectorConsistencyInstalled = true;

  const previousCaptureElement = WhyDOM.captureElement;

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
  const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

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

  function isWhyDomClass(name) {
    return /^__whydom(?:-|$)/i.test(String(name || ""));
  }

  function isGeneratedClass(name) {
    const text = String(name || "");
    if (isWhyDomClass(text)) return true;
    if (/^__variable_[a-z0-9_-]+$/i.test(text)) return true;
    if (/^__className_[a-z0-9_-]+$/i.test(text)) return true;
    if (/^(?:css|jsx|sc)-?[a-z0-9]{6,}$/i.test(text)) return true;
    if (/[a-f0-9]{12,}/i.test(text)) return true;
    return false;
  }

  function isStableId(id) {
    const text = String(id || "");
    if (!text || text.length > 120) return false;
    if (/^__whydom/i.test(text)) return false;
    if (UUID_PATTERN.test(text)) return false;
    if (/^_?R_[a-z0-9]+/i.test(text)) return false;
    if (/^:r[0-9a-z]+:$/i.test(text)) return false;
    return true;
  }

  function normalizeUtilityClass(name) {
    return String(name || "").replace(/^-/, "");
  }

  function isUtilityClass(name) {
    const normalized = normalizeUtilityClass(name);
    if (!normalized) return true;
    if (GENERIC_UTILITY_CLASSES.has(normalized)) return true;
    return UTILITY_PREFIX.test(normalized);
  }

  function usableClass(name) {
    return Boolean(name)
      && name.length <= 80
      && /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(name)
      && !isGeneratedClass(name);
  }

  function candidate(selector, score, kind, reason) {
    return { selector, score, kind, reason };
  }

  function directCandidates(element) {
    const tag = element.localName || element.tagName.toLowerCase();
    const candidates = [];

    if (isStableId(element.id)) {
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

    const classes = [...element.classList]
      .filter(usableClass)
      .map((className) => ({ className, utility: isUtilityClass(className) }));

    const semanticClasses = classes.filter((item) => !item.utility).slice(0, 5);
    const utilityClasses = classes.filter((item) => item.utility).slice(0, 4);

    for (const item of semanticClasses) {
      const cls = `.${escapeIdentifier(item.className)}`;
      candidates.push(candidate(`${tag}${cls}`, 72, "class", "semantic class"));
      candidates.push(candidate(cls, 70, "class", "semantic class"));
    }

    for (let i = 0; i < Math.min(semanticClasses.length, 4); i += 1) {
      for (let j = i + 1; j < Math.min(semanticClasses.length, 4); j += 1) {
        const pair = `.${escapeIdentifier(semanticClasses[i].className)}.${escapeIdentifier(semanticClasses[j].className)}`;
        candidates.push(candidate(`${tag}${pair}`, 74, "class", "semantic class pair"));
        candidates.push(candidate(pair, 73, "class", "semantic class pair"));
      }
    }

    for (const item of utilityClasses) {
      const cls = `.${escapeIdentifier(item.className)}`;
      candidates.push(candidate(`${tag}${cls}`, 35, "utility", "utility class"));
      candidates.push(candidate(cls, 30, "utility", "utility class"));
    }

    return candidates.sort((a, b) => b.score - a.score || a.selector.length - b.selector.length);
  }

  function uniqueStableDirectSelector(element) {
    for (const item of directCandidates(element)) {
      if (item.score < 65) continue;
      if (isUnique(item.selector)) return item;
    }
    return null;
  }

  function bestSemanticSegment(element) {
    const semantic = directCandidates(element).find((item) => item.score >= 65);
    return semantic?.selector || (element.localName || element.tagName.toLowerCase());
  }

  function relativeChildSegment(element) {
    const parent = element.parentElement;
    const tag = element.localName || element.tagName.toLowerCase();
    if (!parent) return tag;

    const semantic = directCandidates(element).find((item) => item.score >= 65);
    if (semantic) {
      try {
        const siblings = [...parent.children].filter((child) => child.matches(semantic.selector));
        if (siblings.length === 1) return semantic.selector;
      } catch (error) {
        // Fall through to structural child segment.
      }
    }

    const sameTag = [...parent.children].filter((child) => child.localName === element.localName);
    if (sameTag.length === 1) return tag;
    return `${tag}:nth-of-type(${sameTag.indexOf(element) + 1})`;
  }

  function anchoredPath(element, maxDepth = 10) {
    const descendants = [];
    let current = element;

    for (let depth = 0; current && current instanceof Element && depth <= maxDepth; depth += 1) {
      const anchor = uniqueStableDirectSelector(current);
      if (anchor) {
        let selector = anchor.selector;
        for (const descendant of [...descendants].reverse()) {
          selector += ` > ${relativeChildSegment(descendant)}`;
        }
        if (isUnique(selector)) {
          return {
            selector,
            quality: {
              confidence: depth <= 2 ? "medium" : "low",
              kind: "structural",
              reason: "stable anchored path",
              unique: true
            }
          };
        }
      }

      descendants.push(current);
      current = current.parentElement;
    }

    return null;
  }

  function absolutePositionalPath(element) {
    const parts = [];
    let current = element;

    while (current && current instanceof Element) {
      const tag = current.localName || current.tagName.toLowerCase();
      if (current === document.documentElement) {
        parts.unshift("html");
        break;
      }

      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }

      const sameTag = [...parent.children].filter((child) => child.localName === current.localName);
      const segment = sameTag.length <= 1
        ? tag
        : `${tag}:nth-of-type(${sameTag.indexOf(current) + 1})`;
      parts.unshift(segment);
      current = parent;
    }

    const selector = parts.join(" > ");
    return {
      selector,
      quality: {
        confidence: "low",
        kind: "positional",
        reason: "absolute positional fallback",
        unique: isUnique(selector)
      }
    };
  }

  function buildSelectorInfo(element) {
    if (!(element instanceof Element)) {
      return { selector: "", quality: { confidence: "low", kind: "none", reason: "not an element", unique: false } };
    }

    const direct = uniqueStableDirectSelector(element);
    if (direct) {
      return {
        selector: direct.selector,
        quality: {
          confidence: direct.score >= 85 ? "high" : "medium",
          kind: direct.kind,
          reason: direct.reason,
          unique: true
        }
      };
    }

    const tag = element.localName || element.tagName.toLowerCase();
    if (["video", "canvas", "main", "header", "footer", "nav"].includes(tag) && isUnique(tag)) {
      return {
        selector: tag,
        quality: { confidence: "low", kind: "tag", reason: "unique semantic tag", unique: true }
      };
    }

    const anchored = anchoredPath(element);
    if (anchored) return anchored;

    for (const item of directCandidates(element)) {
      if (item.kind !== "utility") continue;
      if (isUnique(item.selector)) {
        return {
          selector: item.selector,
          quality: { confidence: "low", kind: "utility", reason: "unique utility fallback", unique: true }
        };
      }
    }

    return absolutePositionalPath(element);
  }

  function rewriteCssSelector(cssText, selector) {
    if (!cssText || !selector) return cssText || "";
    const brace = cssText.indexOf("{");
    if (brace < 0) return cssText;
    return `${selector} ${cssText.slice(brace)}`;
  }

  WhyDOM.captureElement = function captureWithConsistentSelectors(element) {
    const snapshot = previousCaptureElement(element);
    const selected = buildSelectorInfo(element);

    snapshot.version = Math.max(Number(snapshot.version) || 0, 7);
    snapshot.selector = selected.selector;
    snapshot.selectorQuality = selected.quality;
    snapshot.copyCss = rewriteCssSelector(snapshot.copyCss, selected.selector);

    const parent = element.parentElement;
    if (parent && snapshot.layoutFacts?.parentLayout) {
      const parentInfo = buildSelectorInfo(parent);
      snapshot.layoutFacts.parentLayout.selector = parentInfo.selector;
      snapshot.layoutFacts.parentLayout.selectorQuality = parentInfo.quality;
    }

    let current = parent;
    for (let index = 0; current && snapshot.ancestors?.[index]; index += 1) {
      const info = buildSelectorInfo(current);
      snapshot.ancestors[index].selector = info.selector;
      snapshot.ancestors[index].selectorQuality = info.quality;
      current = current.parentElement;
    }

    return snapshot;
  };

  WhyDOM.buildSelector = (element) => buildSelectorInfo(element).selector;
  WhyDOM.buildSelectorInfo = buildSelectorInfo;
})();
