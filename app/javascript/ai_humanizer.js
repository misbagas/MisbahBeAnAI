(() => {
  const root = document.querySelector("[data-ai-humanizer]");
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const originalText = $("originalText");
  const outputText = $("outputText");
  const statusPill = $("statusPill");
  const toast = $("toast");
  const historyModal = $("historyModal");
  const versionList = $("versionList");
  const humanizeButton = $("humanizeBtn");
  const regenerateButton = $("regenerateBtn");
  const placeholderText = "Your humanized result will appear here.";
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  let activeIntensity = "balanced";
  let toastTimer;
  let draftTimer;
  let highlightEnabled = false;
  let busy = false;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
  }

  function countStats(text) {
    const clean = text.trim();
    return { words: clean ? clean.split(/\s+/).length : 0, chars: clean.length };
  }

  function currentOutput() {
    const text = (outputText.innerText || outputText.textContent || "").trim();
    return text === placeholderText ? "" : text;
  }

  function renderOutput(text, highlight = highlightEnabled) {
    outputText.replaceChildren();
    if (!text.trim()) {
      const paragraph = document.createElement("p");
      const placeholder = document.createElement("span");
      placeholder.textContent = placeholderText;
      placeholder.style.color = "#9b9eaa";
      paragraph.appendChild(placeholder);
      outputText.appendChild(paragraph);
      updateStats();
      return;
    }

    const sourceWords = new Set((originalText.value.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) || []));
    text.trim().split(/\n\s*\n/).forEach((paragraphText) => {
      const paragraph = document.createElement("p");
      const tokens = paragraphText.match(/\s+|[^\s]+/g) || [];
      tokens.forEach((token) => {
        const normalized = token.toLocaleLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
        if (highlight && normalized && !sourceWords.has(normalized)) {
          const mark = document.createElement("em");
          mark.textContent = token;
          paragraph.appendChild(mark);
        } else {
          paragraph.appendChild(document.createTextNode(token));
        }
      });
      outputText.appendChild(paragraph);
    });
    updateStats();
  }

  function setStatus(label, isBusy = false) {
    statusPill.textContent = label;
    statusPill.classList.toggle("busy", isBusy);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function updateStats() {
    const sourceStats = countStats(originalText.value);
    const outputStats = countStats(currentOutput());
    $("sourceStats").textContent = `${sourceStats.words.toLocaleString()} words · ${sourceStats.chars.toLocaleString()} characters`;
    $("outputStats").textContent = `${outputStats.words.toLocaleString()} words · ${outputStats.chars.toLocaleString()} characters`;
    const wordsRemaining = Math.max(0, 5000 - sourceStats.words);
    $("creditsText").textContent = `${wordsRemaining.toLocaleString()} words remaining`;
  }

  function updateInsights(text) {
    const stats = countStats(text);
    if (!stats.words) {
      $("readabilityValue").textContent = "Waiting for text";
      $("readabilityDesc").textContent = "Add text to see writing insights";
      $("toneValue").textContent = "Not set";
      $("toneDesc").textContent = "Choose a writing tone above";
      $("meaningValue").textContent = "Message not analyzed";
      $("meaningDesc").textContent = "Humanize a draft to review its meaning";
      return;
    }

    const sentenceCount = Math.max(1, text.split(/[.!?]+/).filter(Boolean).length);
    const easy = stats.words / sentenceCount <= 19;
    $("readabilityValue").textContent = easy ? "Easy to read" : "Clearer to read";
    $("readabilityDesc").textContent = easy ? "Clear sentences with less jargon" : "Shorter flow and improved phrasing";

    const toneInfo = {
      "Conversational": ["Natural & conversational", "Warm, confident, and approachable"],
      "Professional": ["Professional & polished", "Clear, credible, and focused"],
      "Academic": ["Structured & academic", "Precise, formal, and objective"],
      "Friendly": ["Warm & friendly", "Approachable, upbeat, and human"],
      "Concise": ["Concise & direct", "Focused, compact, and efficient"],
      "Persuasive": ["Persuasive & confident", "Action-oriented and compelling"]
    }[$("tone").value] || ["Natural & conversational", "Warm, confident, and approachable"];
    $("toneValue").textContent = toneInfo[0];
    $("toneDesc").textContent = toneInfo[1];
    $("meaningValue").textContent = $("preserveMeaning").checked ? "Your message, preserved" : "Meaning, lightly reframed";
    $("meaningDesc").textContent = $("preserveMeaning").checked ? "Core ideas stay true to your original" : "Wording can introduce small creative changes";
  }

  function saveDraftLocally() {
    try {
      localStorage.setItem("aiHumanizerDraft", JSON.stringify({
        source: originalText.value,
        output: currentOutput(),
        tone: $("tone").value,
        language: $("language").value,
        intensity: activeIntensity,
        preserve: $("preserveMeaning").checked
      }));
    } catch {
      showToast("This browser could not save your draft.");
    }
  }

  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraftLocally, 300);
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem("aiHumanizerDraft"));
      if (!draft) return false;
      if (typeof draft.source === "string") originalText.value = draft.source;
      if (draft.tone) $("tone").value = draft.tone;
      if (draft.language) $("language").value = draft.language;
      if (["light", "balanced", "creative"].includes(draft.intensity)) activeIntensity = draft.intensity;
      $("preserveMeaning").checked = draft.preserve !== false;
      document.querySelectorAll(".segment").forEach((button) => {
        button.classList.toggle("active", button.dataset.intensity === activeIntensity);
      });
      renderOutput(typeof draft.output === "string" ? draft.output : "");
      return true;
    } catch {
      return false;
    }
  }

  async function humanize() {
    const text = originalText.value.trim();
    if (!text) {
      originalText.focus();
      showToast("Add some text first.");
      return;
    }
    if (countStats(text).words > 5000) {
      showToast("Your text is over the 5,000 word limit.");
      return;
    }
    if (text.length > 50000) {
      showToast("Your text is over the 50,000 character limit.");
      return;
    }

    busy = true;
    humanizeButton.disabled = true;
    regenerateButton.disabled = true;
    setStatus("Humanizing…", true);
    try {
      const response = await fetch(root.dataset.humanizeUrl, {
        method: "POST",
        headers: {
          "X-CSRF-Token": csrfToken,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          tone: $("tone").value,
          language: $("language").value,
          intensity: activeIntensity,
          preserve_meaning: $("preserveMeaning").checked
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not rewrite this text.");
      renderOutput(data.text || "");
      updateInsights(currentOutput());
      setStatus("Ready");
      saveDraftLocally();
      showToast("Your rewrite is ready.");
    } catch (error) {
      setStatus("Could not finish");
      showToast(error.message || "Could not reach the rewrite service.");
    } finally {
      busy = false;
      humanizeButton.disabled = false;
      regenerateButton.disabled = false;
    }
  }

  function getHistory() {
    try {
      const history = JSON.parse(localStorage.getItem("aiHumanizerHistory"));
      return Array.isArray(history) ? history : [];
    } catch {
      return [];
    }
  }

  function saveVersion() {
    const output = currentOutput();
    if (!output) {
      showToast("Generate a result before saving.");
      return;
    }
    try {
      const history = getHistory();
      history.unshift({
        id: Date.now(),
        savedAt: new Date().toISOString(),
        source: originalText.value,
        output,
        tone: $("tone").value,
        language: $("language").value,
        intensity: activeIntensity,
        preserve: $("preserveMeaning").checked
      });
      localStorage.setItem("aiHumanizerHistory", JSON.stringify(history.slice(0, 20)));
      saveDraftLocally();
      showToast("Version saved to history.");
    } catch {
      showToast("This browser could not save the version.");
    }
  }

  function renderHistory() {
    const history = getHistory();
    if (!history.length) {
      versionList.innerHTML = '<div class="empty-state">No saved versions yet. Generate a result, then choose Save.</div>';
      return;
    }
    versionList.innerHTML = history.map((item, index) => {
      const savedAt = new Date(item.savedAt);
      const time = Number.isNaN(savedAt.getTime()) ? "" : savedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
      return `<div class="version-item">
        <div class="version-item-top"><span class="version-title">Version ${history.length - index}</span><span class="version-time">${escapeHtml(time)}</span></div>
        <div class="version-preview">${escapeHtml(item.output || "")}</div>
        <button class="version-load" type="button" data-load-id="${Number(item.id)}">Restore this version</button>
      </div>`;
    }).join("");
  }

  function openHistory() {
    renderHistory();
    historyModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeHistory() {
    historyModal.hidden = true;
    document.body.style.overflow = "";
  }

  $("historyBtn").addEventListener("click", openHistory);
  $("closeHistoryBtn").addEventListener("click", closeHistory);
  $("closeHistoryFooterBtn").addEventListener("click", closeHistory);
  historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) closeHistory();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !historyModal.hidden) closeHistory();
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (!busy) humanize();
    }
  });

  $("pasteBtn").addEventListener("click", async () => {
    try {
      originalText.value = await navigator.clipboard.readText();
      updateStats();
      updateInsights(originalText.value);
      scheduleDraftSave();
      showToast("Text pasted from clipboard.");
    } catch {
      originalText.focus();
      showToast("Clipboard access was blocked. Paste with Ctrl/Cmd + V.");
    }
  });

  $("clearBtn").addEventListener("click", () => {
    originalText.value = "";
    renderOutput("");
    updateInsights("");
    setStatus("Ready");
    saveDraftLocally();
    showToast("Editor cleared.");
  });

  $("uploadBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      originalText.value = await file.text();
      updateStats();
      updateInsights(originalText.value);
      saveDraftLocally();
      showToast(`${file.name} loaded.`);
    } catch {
      showToast("Could not read that text file.");
    }
    event.target.value = "";
  });

  originalText.addEventListener("input", () => {
    updateStats();
    updateInsights(currentOutput() || originalText.value);
    scheduleDraftSave();
  });
  outputText.addEventListener("input", () => {
    updateStats();
    updateInsights(currentOutput());
    scheduleDraftSave();
  });

  humanizeButton.addEventListener("click", humanize);
  regenerateButton.addEventListener("click", humanize);
  $("copyBtn").addEventListener("click", async () => {
    const text = currentOutput();
    if (!text) {
      showToast("Nothing to copy yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Humanized text copied.");
    } catch {
      showToast("Copy was blocked by your browser.");
    }
  });

  $("saveBtn").addEventListener("click", saveVersion);
  $("highlightBtn").addEventListener("click", () => {
    highlightEnabled = !highlightEnabled;
    $("output-card").classList.toggle("highlight-mode", highlightEnabled);
    renderOutput(currentOutput(), highlightEnabled);
    showToast(highlightEnabled ? "New wording highlighted." : "Highlights hidden.");
  });

  $("outputMenuBtn").addEventListener("click", (event) => {
    event.stopPropagation();
    $("outputMenu").hidden = !$("outputMenu").hidden;
  });
  document.addEventListener("click", () => { $("outputMenu").hidden = true; });
  $("outputMenu").addEventListener("click", (event) => event.stopPropagation());

  $("downloadBtn").addEventListener("click", () => {
    const text = currentOutput();
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "humanized-text.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Downloaded humanized-text.txt.");
  });

  $("resetOutputBtn").addEventListener("click", () => {
    renderOutput("");
    updateInsights(originalText.value);
    saveDraftLocally();
    showToast("Output cleared.");
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      activeIntensity = button.dataset.intensity;
      document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("active", item === button));
      updateInsights(currentOutput() || originalText.value);
      scheduleDraftSave();
    });
  });

  $("tone").addEventListener("change", () => {
    updateInsights(currentOutput() || originalText.value);
    scheduleDraftSave();
  });
  $("language").addEventListener("change", () => {
    showToast(`Language set to ${$("language").value}.`);
    scheduleDraftSave();
  });
  $("preserveMeaning").addEventListener("change", () => {
    updateInsights(currentOutput() || originalText.value);
    scheduleDraftSave();
  });

  versionList.addEventListener("click", (event) => {
    const id = Number(event.target.dataset.loadId);
    if (!id) return;
    const item = getHistory().find((entry) => Number(entry.id) === id);
    if (!item) return;
    originalText.value = item.source || "";
    $("tone").value = item.tone || "Conversational";
    $("language").value = item.language || "English (US)";
    activeIntensity = item.intensity || "balanced";
    $("preserveMeaning").checked = item.preserve !== false;
    document.querySelectorAll(".segment").forEach((button) => button.classList.toggle("active", button.dataset.intensity === activeIntensity));
    renderOutput(item.output || "");
    updateInsights(currentOutput());
    closeHistory();
    saveDraftLocally();
    showToast("Version restored.");
  });

  $("clearHistoryBtn").addEventListener("click", () => {
    localStorage.removeItem("aiHumanizerHistory");
    renderHistory();
    showToast("History cleared.");
  });

  if (!restoreDraft()) renderOutput("");
  updateStats();
  updateInsights(currentOutput() || originalText.value);
})();
