(() => {
  let whyActive = false;
  let trialActive = false;

  function getDiagnostic(snapshot = currentSnapshot) {
    return snapshot?.diagnostics?.overflow || null;
  }

  function prettyOverflow(value) {
    const number = Number(value || 0);
    return `${Math.round(number * 100) / 100}px`;
  }

  function formatWhy(snapshot) {
    const diagnostic = getDiagnostic(snapshot);
    if (!snapshot || !diagnostic) return "";

    const lines = [
      "WhyDOM WHY — Overflow",
      `Selector: ${snapshot.selector || "-"}`,
      `Status: ${diagnostic.status || "unknown"}`,
      `Confidence: ${diagnostic.confidence || "unknown"}`,
      "",
      diagnostic.summary || "No summary available."
    ];

    if (diagnostic.evidence?.length) {
      lines.push("", "EVIDENCE");
      for (const item of diagnostic.evidence) {
        lines.push(`${item.label}: ${item.value}`);
      }
    }

    const fix = diagnostic.fixes?.[0];
    if (fix) {
      lines.push("", "SUGGESTED FIX", fix.title, fix.css);
    }

    return lines.join("\n");
  }

  function renderEvidence(items = []) {
    const evidence = $("whyEvidence");
    evidence.replaceChildren();

    for (const item of items) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = item.label;
      dd.textContent = item.value;
      row.append(dt, dd);
      evidence.appendChild(row);
    }
  }

  function resetVerification() {
    trialActive = false;
    $("undoFix").classList.add("hidden");
    $("tryFix").classList.remove("hidden");
    $("whyVerification").classList.add("hidden");
    $("whyVerification").dataset.state = "";
    setText("verificationTitle", "");
    setText("verificationMetrics", "");
  }

  function renderWhy(snapshot = currentSnapshot) {
    resetVerification();
    const diagnostic = getDiagnostic(snapshot);

    setText("whySelector", snapshot?.selector || "Pick an element");

    if (!snapshot || !diagnostic) {
      $("whyNoSnapshot").classList.remove("hidden");
      $("whyResult").classList.add("hidden");
      return;
    }

    $("whyNoSnapshot").classList.add("hidden");
    $("whyResult").classList.remove("hidden");

    const status = $("whyStatus");
    status.dataset.state = diagnostic.status || "unknown";
    status.textContent = diagnostic.status === "problem"
      ? "Problem detected"
      : diagnostic.status === "ok"
        ? "No overflow"
        : "Unknown";

    const confidence = $("whyConfidence");
    confidence.dataset.confidence = diagnostic.confidence || "low";
    confidence.textContent = `${diagnostic.confidence || "low"} confidence`;

    setText("whySummary", diagnostic.summary || "No diagnosis available.");
    renderEvidence(diagnostic.evidence || []);

    const fix = diagnostic.fixes?.[0];
    if (fix) {
      $("whyFixCard").classList.remove("hidden");
      setText("whyFixTitle", fix.title);
      setText("whyFixCss", fix.css);
    } else {
      $("whyFixCard").classList.add("hidden");
      setText("whyFixTitle", "");
      setText("whyFixCss", "");
    }
  }

  function switchView(view) {
    whyActive = view === "why";
    $("inspectTab").classList.toggle("active", !whyActive);
    $("whyTab").classList.toggle("active", whyActive);

    if (whyActive) {
      $("emptyState").classList.add("hidden");
      $("inspector").classList.add("hidden");
      $("whyPane").classList.remove("hidden");
      renderWhy(currentSnapshot);
      return;
    }

    $("whyPane").classList.add("hidden");
    if (currentSnapshot) {
      $("emptyState").classList.add("hidden");
      $("inspector").classList.remove("hidden");
    } else {
      $("emptyState").classList.remove("hidden");
      $("inspector").classList.add("hidden");
    }
  }

  const baseRenderSnapshot = renderSnapshot;
  renderSnapshot = function renderSnapshotWithWhy(snapshot) {
    baseRenderSnapshot(snapshot);
    renderWhy(snapshot);
    if (whyActive) {
      $("emptyState").classList.add("hidden");
      $("inspector").classList.add("hidden");
      $("whyPane").classList.remove("hidden");
    }
  };

  $("inspectTab").addEventListener("click", () => switchView("inspect"));
  $("whyTab").addEventListener("click", () => switchView("why"));
  $("copyWhy").addEventListener("click", () => copyText(formatWhy(currentSnapshot), "WHY diagnosis"));
  $("copyFix").addEventListener("click", () => copyText(getDiagnostic()?.fixes?.[0]?.css, "Fix"));

  $("tryFix").addEventListener("click", async () => {
    if (!activeTabId) return;
    const fix = getDiagnostic()?.fixes?.[0];
    if (!fix) return;

    try {
      const result = await chrome.tabs.sendMessage(activeTabId, {
        type: "WHYDOM_APPLY_OVERFLOW_FIX",
        fixIndex: 0
      });

      if (!result?.ok) {
        showToast(result?.error || "Could not try this fix");
        return;
      }

      trialActive = true;
      $("tryFix").classList.add("hidden");
      $("undoFix").classList.remove("hidden");

      const verification = $("whyVerification");
      verification.classList.remove("hidden");
      verification.dataset.state = result.resolved ? "resolved" : "remaining";
      setText("verificationTitle", result.resolved ? "✓ Fix verified" : "Overflow remains after this trial");

      const beforeX = prettyOverflow(result.before?.overflowX);
      const afterX = prettyOverflow(result.after?.overflowX);
      const beforeY = prettyOverflow(result.before?.overflowY);
      const afterY = prettyOverflow(result.after?.overflowY);
      setText("verificationMetrics", `Before: X ${beforeX}, Y ${beforeY} · After: X ${afterX}, Y ${afterY}`);
    } catch (error) {
      showToast("Could not apply the trial fix");
    }
  });

  $("undoFix").addEventListener("click", async () => {
    if (!activeTabId || !trialActive) return;
    try {
      const result = await chrome.tabs.sendMessage(activeTabId, { type: "WHYDOM_UNDO_OVERFLOW_FIX" });
      if (!result?.ok) {
        showToast("Nothing to undo");
        return;
      }
      resetVerification();
      showToast("Trial fix undone");
    } catch (error) {
      showToast("Could not undo the trial fix");
    }
  });

  renderWhy(currentSnapshot);
})();
