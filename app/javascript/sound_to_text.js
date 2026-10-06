const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const root = $("[data-sound-to-text]");
if (root) {
  const state = {
    playing: false,
    currentSeconds: 64,
    duration: 522,
    speed: 1,
    muted: false,
    editing: false,
    searchOpen: false,
    timer: null,
  };

  const playBtn = $("#playBtn");
  const playIcon = $("#playIcon");
  const pauseIcon = $("#pauseIcon");
  const currentTime = $("#currentTime");
  const waveProgress = $("#waveProgress");
  const waveform = $("#waveform");
  const speedControl = $("#speedControl");
  const moreMenu = $("#moreMenu");
  const moreBtn = $("#moreBtn");
  const volumeIcon = $("#volumeIcon");
  const toast = $("#toast");
  const modal = $("#modal");
  const fileInput = $("#fileInput");
  const dropZone = $("#dropZone");

  function formatTime(total) {
    const seconds = Math.max(0, Math.round(total));
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function updatePlayer() {
    currentTime.textContent = formatTime(state.currentSeconds);
    waveProgress.style.width = `${Math.min(100, (state.currentSeconds / state.duration) * 100)}%`;
    waveform.setAttribute("aria-valuenow", String(Math.round(state.currentSeconds)));
  }

  function setPlaying(playing) {
    state.playing = playing;
    playIcon.classList.toggle("is-hidden", playing);
    pauseIcon.classList.toggle("is-hidden", !playing);
    playBtn.setAttribute("aria-label", playing ? "Pause sample timeline" : "Play sample timeline");
    clearInterval(state.timer);

    if (playing) {
      state.timer = setInterval(() => {
        state.currentSeconds += 0.25 * state.speed;
        if (state.currentSeconds >= state.duration) {
          state.currentSeconds = 0;
          setPlaying(false);
        }
        updatePlayer();
      }, 250);
    }
  }

  function seekTo(seconds) {
    state.currentSeconds = Math.min(state.duration, Math.max(0, seconds));
    updatePlayer();
  }

  playBtn.addEventListener("click", () => setPlaying(!state.playing));
  waveform.addEventListener("click", (event) => {
    const rect = waveform.getBoundingClientRect();
    seekTo(((event.clientX - rect.left) / rect.width) * state.duration);
  });
  waveform.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      seekTo(state.currentSeconds + (event.key === "ArrowRight" ? 5 : -5));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      seekTo(event.key === "Home" ? 0 : state.duration);
    }
  });

  moreBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = !moreMenu.classList.contains("open");
    moreMenu.classList.toggle("open", open);
    moreBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".player-menu")) return;
    moreMenu.classList.remove("open");
    moreBtn.setAttribute("aria-expanded", "false");
  });

  $$("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      state.speed = Number(button.dataset.speed);
      speedControl.textContent = `${state.speed}×`;
      moreMenu.classList.remove("open");
      moreBtn.setAttribute("aria-expanded", "false");
      showToast(`Sample timeline speed: ${state.speed}×`);
    });
  });

  function setMuted(muted) {
    state.muted = muted;
    volumeIcon.style.opacity = muted ? ".4" : "1";
    $("#muteLabelBtn").textContent = muted ? "🔇" : "🔊";
    $("#volumeBtn").setAttribute("aria-label", muted ? "Unmute sample timeline" : "Mute sample timeline");
    $("#muteLabelBtn").setAttribute("aria-label", muted ? "Unmute sample timeline" : "Mute sample timeline");
  }
  $("#volumeBtn").addEventListener("click", () => setMuted(!state.muted));
  $("#muteLabelBtn").addEventListener("click", () => setMuted(!state.muted));

  $("#syncBtn").addEventListener("click", () => {
    seekTo(64);
    $(".transcript-message.highlight")?.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("Sample timeline synced to 01:04");
  });
  $$(".timestamp").forEach((button) => {
    button.addEventListener("click", () => {
      seekTo(Number(button.dataset.time));
      button.closest(".transcript-message")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      showToast(`Sample timeline: ${button.textContent}`);
    });
  });

  const tabs = $$(".tab");
  const transcriptPanel = $("#transcriptPanel");
  const subtitlesPanel = $("#subtitlesPanel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      const showTranscript = tab.dataset.tab === "transcript";
      transcriptPanel.classList.toggle("is-hidden", !showTranscript);
      transcriptPanel.hidden = !showTranscript;
      subtitlesPanel.classList.toggle("is-hidden", showTranscript);
      subtitlesPanel.hidden = showTranscript;
    });
  });

  $("#editBtn").addEventListener("click", () => {
    state.editing = !state.editing;
    $$(".transcript-message .message-content p").forEach((paragraph) => {
      paragraph.contentEditable = String(state.editing);
      paragraph.setAttribute("aria-label", state.editing ? "Edit sample transcript text" : "Sample transcript text");
    });
    $("#editLabel").textContent = state.editing ? "Save transcript" : "Edit transcript";
    if (!state.editing) showToast("Sample transcript edits saved in this page");
  });

  const searchRow = $("#searchRow");
  const transcriptSearch = $("#transcriptSearch");
  $("#searchBtn").addEventListener("click", () => {
    state.searchOpen = !state.searchOpen;
    searchRow.classList.toggle("is-hidden", !state.searchOpen);
    $("#searchBtn").setAttribute("aria-expanded", String(state.searchOpen));
    if (state.searchOpen) transcriptSearch.focus();
    else {
      transcriptSearch.value = "";
      transcriptSearch.dispatchEvent(new Event("input"));
    }
  });
  transcriptSearch.addEventListener("input", () => {
    const query = transcriptSearch.value.trim().toLowerCase();
    let matches = 0;
    $$(".transcript-message").forEach((row) => {
      const visible = !query || row.innerText.toLowerCase().includes(query);
      row.hidden = !visible;
      row.classList.toggle("is-hidden", !visible);
      if (visible) matches += 1;
    });
    $("#searchCount").textContent = query ? `${matches} result${matches === 1 ? "" : "s"}` : "";
  });

  $("#continueBtn").addEventListener("click", () => {
    const visibleRows = $$(".transcript-message").filter((row) => !row.hidden);
    visibleRows.at(-1)?.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast(visibleRows.length ? "Showing the end of this sample transcript" : "No transcript matches this search");
  });

  const newTranscriptionBtn = $("#newTranscriptionBtn");
  function openModal() {
    modal.hidden = false;
    modal.classList.remove("is-hidden");
    document.body.style.overflow = "hidden";
    $("#modalBrowseBtn").focus();
  }
  function closeModal() {
    modal.hidden = true;
    modal.classList.add("is-hidden");
    document.body.style.overflow = "";
    newTranscriptionBtn.focus();
  }
  newTranscriptionBtn.addEventListener("click", openModal);
  $("#closeModalBtn").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  function formatFileSize(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  function acceptLocalFile(file) {
    if (!file) return;
    const supported = /\.(mp3|wav|m4a|mp4)$/i.test(file.name) || file.type.startsWith("audio/") || file.type === "video/mp4";
    if (!supported) {
      showToast("Choose an MP3, WAV, M4A, or MP4 file");
      fileInput.value = "";
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      showToast("Choose a file smaller than 500 MB");
      fileInput.value = "";
      return;
    }

    $("#fileName").textContent = file.name;
    $("#fileMeta").textContent = `${formatFileSize(file.size)} · Selected in this browser · No transcript generated`;
    const status = $("#transcriptionStatus");
    status.replaceChildren(Object.assign(document.createElement("span"), { className: "status-dot" }), document.createTextNode("Preview only"));
    status.classList.add("status-pill--preview");
    closeModal();
    showToast("File selected locally. Transcription is not connected yet.");
    fileInput.value = "";
  }

  $("#browseBtn").addEventListener("click", () => fileInput.click());
  $("#modalBrowseBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => acceptLocalFile(fileInput.files?.[0]));
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });
  dropZone.addEventListener("drop", (event) => acceptLocalFile(event.dataTransfer.files?.[0]));
  dropZone.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === dropZone) {
      event.preventDefault();
      fileInput.click();
    }
  });

  $("#language").addEventListener("change", () => showToast("Language preference changed for this preview only"));
  $("#speakers").addEventListener("change", () => showToast("Speaker preference changed for this preview only"));

  $("#exportBtn").addEventListener("click", () => {
    const text = $$(".transcript-message").map((row) => {
      const speaker = $(".message-heading strong", row)?.textContent.trim() || "Speaker";
      const time = $(".timestamp", row)?.textContent.trim() || "00:00";
      const body = $(".message-content p", row)?.innerText.trim() || "";
      return `[${time}] ${speaker}: ${body}`;
    }).join("\n\n");

    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "sample-transcript.txt" });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast("Sample transcript exported as TXT");
  });

  $("#downloadAudioBtn").addEventListener("click", () => showToast("The sample timeline has no downloadable audio file"));
  $("#addActionBtn").addEventListener("click", () => {
    const title = window.prompt("Action item name:");
    if (!title?.trim()) return;

    const row = document.createElement("label");
    row.className = "task-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const details = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = title.trim();
    const meta = document.createElement("small");
    meta.textContent = "Added in this preview";
    details.append(name, meta);
    row.append(checkbox, details);
    $("#actionItems").append(row);
    $("#actionCount").textContent = `· ${$$(".task-row", $("#actionItems")).length}`;
    showToast("Action item added to this preview");
  });

  updatePlayer();
}
