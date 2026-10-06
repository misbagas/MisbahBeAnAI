(() => {
  const root = document.querySelector("[data-ai-checker]");
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const editor = $("editor");
  const wordCount = $("wordCount");
  const checkButton = $("checkBtn");
  const fileInput = $("fileInput");
  const uploadPanel = $("uploadPanel");
  const textPanel = $("textPanel");
  const fileMeta = $("fileMeta");
  const toast = $("toast");
  const historyModal = $("pastChecksModal");
  const historyList = $("pastChecksList");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  const maxWords = 10000;
  const maxChars = 120000;
  let busy = false;
  let latestResult = null;
  let toastTimer;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
  }

  function countWords(text) {
    return (text.trim().match(/\S+/g) || []).length;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function updateWordCount() {
    const count = countWords(editor.value);
    wordCount.textContent = `${count.toLocaleString()} words`;
    wordCount.classList.toggle("below-minimum", count > 0 && count < 80);
    wordCount.title = count > 0 && count < 80 ? "Short samples can produce less reliable signals." : "Recommended minimum: 80 words.";
  }

  function setMode(mode) {
    const isText = mode === "text";
    textPanel.classList.toggle("hidden", !isText);
    uploadPanel.classList.toggle("hidden", isText);
    document.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function resetResults() {
    latestResult = null;
    $("scoreRing").style.setProperty("--score", 0);
    $("scoreValue").textContent = "—";
    $("statusPill").textContent = "No analysis yet";
    $("statusPill").className = "status-pill is-neutral";
    $("humanCount").textContent = "— sentences";
    $("mixedCount").textContent = "— sentences";
    $("aiCount").textContent = "— sentences";
    document.querySelector(".result-summary").textContent = "Run a check to see writing-style signals. These results cannot verify who wrote the text.";
    $("closerText").textContent = "A stylistic estimate can point out patterns, but it cannot establish authorship.";
    $("exportBtn").disabled = true;
  }

  function renderResults(result) {
    const score = Math.max(0, Math.min(100, Number(result.score) || 0));
    const statusPill = $("statusPill");
    $("scoreRing").style.setProperty("--score", score);
    $("scoreValue").textContent = `${score}%`;
    $("humanCount").textContent = `${result.human} ${result.human === 1 ? "sentence" : "sentences"}`;
    $("mixedCount").textContent = `${result.mixed} ${result.mixed === 1 ? "sentence" : "sentences"}`;
    $("aiCount").textContent = `${result.ai} ${result.ai === 1 ? "sentence" : "sentences"}`;

    if (score >= 80) {
      statusPill.textContent = "Mostly human-style signals";
      statusPill.className = "status-pill";
    } else if (score >= 55) {
      statusPill.textContent = "Mixed style signals";
      statusPill.className = "status-pill is-mixed";
    } else {
      statusPill.textContent = "More AI-like signals";
      statusPill.className = "status-pill is-ai";
    }

    document.querySelector(".result-summary").textContent = result.summary || "The writing shows a mix of stylistic signals.";
    $("closerText").textContent = result.closer_look || "Review the examples in context; style alone does not establish authorship.";
    $("exportBtn").disabled = false;
    latestResult = result;
  }

  function getHistory() {
    try {
      const entries = JSON.parse(localStorage.getItem("aiCheckerHistory"));
      return Array.isArray(entries) ? entries : [];
    } catch {
      return [];
    }
  }

  function saveHistory(entry) {
    try {
      const entries = getHistory();
      entries.unshift(entry);
      localStorage.setItem("aiCheckerHistory", JSON.stringify(entries.slice(0, 10)));
    } catch {
      showToast("This browser could not save the check to history.");
    }
  }

  function renderHistory() {
    const entries = getHistory();
    if (!entries.length) {
      historyList.innerHTML = '<div class="past-check-empty">No saved checks yet. Run an analysis to add one.</div>';
      return;
    }
    historyList.innerHTML = entries.map((entry, index) => {
      const date = new Date(entry.savedAt);
      const dateLabel = Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
      const preview = (entry.text || "").replace(/\s+/g, " ").slice(0, 180);
      return `<article class="past-check-item">
        <header><strong>Check ${entries.length - index} · ${Number(entry.result?.score) || 0}% style signal</strong><time>${escapeHtml(dateLabel)}</time></header>
        <div class="past-check-preview">${escapeHtml(preview)}</div>
        <button type="button" data-restore-check="${index}">Restore this check</button>
      </article>`;
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

  async function readJson(response) {
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response.");
    }
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    return data;
  }

  async function checkText() {
    const text = editor.value.trim();
    const words = countWords(text);
    if (!words) return showToast("Enter some text before checking.");
    if (words > maxWords) return showToast("Text must be 10,000 words or fewer.");
    if (text.length > maxChars) return showToast("Text must be 120,000 characters or fewer.");

    busy = true;
    checkButton.disabled = true;
    checkButton.classList.add("is-busy");
    try {
      const response = await fetch(root.dataset.checkUrl, {
        method: "POST",
        headers: {
          "X-CSRF-Token": csrfToken,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });
      const result = await readJson(response);
      renderResults(result);
      saveHistory({ text, result, savedAt: new Date().toISOString() });
      showToast(words < 80 ? "Check complete. Short-text signals can be less reliable." : "Analysis complete.");
    } catch (error) {
      showToast(error.message || "Could not reach the analysis service.");
    } finally {
      busy = false;
      checkButton.disabled = false;
      checkButton.classList.remove("is-busy");
    }
  }

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return showToast("Documents must be 25 MB or smaller.");

    const body = new FormData();
    body.append("file", file);
    fileMeta.classList.remove("hidden");
    fileMeta.textContent = `Reading ${file.name}…`;
    busy = true;
    checkButton.disabled = true;
    try {
      const response = await fetch(root.dataset.extractUrl, {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken, "Accept": "application/json" },
        body
      });
      const data = await readJson(response);
      editor.value = data.text;
      fileMeta.textContent = `${data.filename} · ${Number(data.word_count).toLocaleString()} words · ${(file.size / 1024).toFixed(1)} KB`;
      updateWordCount();
      resetResults();
      showToast("Document text is ready to check.");
    } catch (error) {
      fileMeta.textContent = error.message || "Could not read this document.";
      showToast(fileMeta.textContent);
    } finally {
      busy = false;
      checkButton.disabled = false;
      fileInput.value = "";
    }
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  editor.addEventListener("input", () => {
    updateWordCount();
    resetResults();
  });

  $("clearBtn").addEventListener("click", () => {
    editor.value = "";
    fileMeta.textContent = "";
    fileMeta.classList.add("hidden");
    updateWordCount();
    resetResults();
    editor.focus();
    showToast("Text cleared.");
  });

  $("pasteBtn").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return showToast("Clipboard is empty.");
      editor.value = text;
      setMode("text");
      updateWordCount();
      resetResults();
      showToast("Text pasted.");
    } catch {
      editor.focus();
      showToast("Clipboard access was blocked by your browser.");
    }
  });

  fileInput.addEventListener("change", () => handleFile(fileInput.files?.[0]));
  const dropzone = document.querySelector(".dropzone");
  ["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((name) => dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
  }));
  dropzone.addEventListener("drop", (event) => handleFile(event.dataTransfer.files?.[0]));

  checkButton.addEventListener("click", checkText);
  $("pastChecksBtn").addEventListener("click", openHistory);
  $("closePastChecksBtn").addEventListener("click", closeHistory);
  $("donePastChecksBtn").addEventListener("click", closeHistory);
  historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) closeHistory();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !historyModal.hidden) closeHistory();
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !busy) {
      event.preventDefault();
      checkText();
    }
  });

  historyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-restore-check]");
    if (!button) return;
    const entry = getHistory()[Number(button.dataset.restoreCheck)];
    if (!entry) return;
    editor.value = entry.text || "";
    setMode("text");
    updateWordCount();
    renderResults(entry.result);
    closeHistory();
    showToast("Past check restored.");
  });

  $("clearPastChecksBtn").addEventListener("click", () => {
    localStorage.removeItem("aiCheckerHistory");
    renderHistory();
    showToast("Past checks cleared.");
  });

  $("exportBtn").addEventListener("click", () => {
    if (!latestResult) return;
    const report = [
      "AI CHECKER STYLE SIGNAL REPORT",
      "==============================",
      `Human-style signal: ${latestResult.score}%`,
      `Likely human-style sentences: ${latestResult.human}`,
      `Mixed-signal sentences: ${latestResult.mixed}`,
      `AI-like sentences: ${latestResult.ai}`,
      "",
      "SUMMARY",
      "-------",
      latestResult.summary || "",
      "",
      "CLOSER LOOK",
      "-----------",
      latestResult.closer_look || "",
      "",
      "This is a probabilistic stylistic estimate, not proof of authorship.",
      "",
      "TEXT",
      "----",
      editor.value
    ].join("\n");
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-checker-report.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Report exported.");
  });

  updateWordCount();
  resetResults();
})();
