const root = document.querySelector("[data-generate-photo]");

if (root) {
  const promptInput = root.querySelector("#prompt");
  const charCount = root.querySelector("#charCount");
  const imageCountSelect = root.querySelector("#images");
  const generateBtnText = root.querySelector("#generateBtnText");
  const gallery = root.querySelector("#gallery");
  const latestView = root.querySelector("#latestView");
  const historyView = root.querySelector("#historyView");
  const selectionBar = root.querySelector("#selectionBar");
  const modal = document.querySelector("#imageModal");
  const modalImage = document.querySelector("#modalImage");
  const modalClose = document.querySelector("#modalClose");
  const toast = document.querySelector("#toast");
  let lastModalTrigger = null;
  let toastTimer;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function updateCounter() {
    charCount.textContent = promptInput.value.length.toLocaleString();
  }

  function selectImage(card) {
    gallery.querySelectorAll(".image-card").forEach((item) => {
      const selected = item === card;
      item.classList.toggle("selected", selected);
      item.querySelector(".select-check").setAttribute("aria-pressed", String(selected));
    });
    root.querySelector("#selectionName").textContent = card.dataset.title;
    root.querySelector("#selectionTitle").textContent = "1 sample image selected";
  }

  function setResultsView(view) {
    const showingLatest = view === "latest";
    latestView.hidden = !showingLatest;
    historyView.hidden = showingLatest;
    root.querySelectorAll("[data-view]").forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    root.querySelector("#headerCount").textContent = showingLatest ? "4 sample images" : "No saved creations";
  }

  function openImage(card, trigger) {
    const image = card.querySelector("img");
    lastModalTrigger = trigger;
    modalImage.src = image.currentSrc || image.src;
    modalImage.alt = image.alt;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    modalClose.focus();
  }

  function closeImage() {
    if (modal.getAttribute("aria-hidden") === "true") return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modalImage.removeAttribute("src");
    lastModalTrigger?.focus();
  }

  updateCounter();
  promptInput.addEventListener("input", updateCounter);

  root.querySelector("#enhanceBtn").addEventListener("click", () => {
    const detail = " Ultra-detailed natural textures, cinematic composition, realistic reflections, subtle atmospheric depth, premium editorial photography.";
    const current = promptInput.value.trim();
    if (current.toLowerCase().includes("ultra-detailed")) {
      showToast("The sample detail is already in this prompt");
      return;
    }

    const addition = detail.slice(0, Math.max(0, 2000 - current.length));
    promptInput.value = `${current}${addition}`;
    promptInput.focus();
    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
    updateCounter();
    showToast("Added sample prompt details locally");
  });

  root.querySelector("#ratioGrid").addEventListener("click", (event) => {
    const button = event.target.closest(".ratio-btn");
    if (!button) return;
    root.querySelectorAll(".ratio-btn").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    root.style.setProperty("--preview-ratio", button.dataset.ratio);
  });

  imageCountSelect.addEventListener("change", () => {
    const count = Number(imageCountSelect.value);
    generateBtnText.textContent = `Generate ${count} ${count === 1 ? "image" : "images"}`;
  });

  const advancedToggle = root.querySelector("#advancedToggle");
  const advancedContent = root.querySelector("#advancedContent");
  advancedToggle.addEventListener("click", () => {
    const expanded = advancedToggle.getAttribute("aria-expanded") !== "true";
    advancedToggle.setAttribute("aria-expanded", String(expanded));
    advancedToggle.classList.toggle("open", expanded);
    advancedContent.hidden = !expanded;
    advancedContent.classList.toggle("show", expanded);
  });

  gallery.addEventListener("click", (event) => {
    const card = event.target.closest(".image-card");
    if (!card) return;
    const expandButton = event.target.closest(".expand-btn");
    if (expandButton) {
      openImage(card, expandButton);
      return;
    }
    selectImage(card);
  });
  gallery.querySelectorAll(".image-card").forEach((card) => {
    card.addEventListener("keydown", (event) => {
      if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      selectImage(card);
    });
  });

  root.querySelectorAll("[data-view]").forEach((tab) => {
    tab.addEventListener("click", () => setResultsView(tab.dataset.view));
  });
  root.querySelector("#creationsBtn").addEventListener("click", () => setResultsView("history"));

  root.querySelector("#generateBtn").addEventListener("click", () => {
    showToast("Image generation is not connected yet; the sample gallery stays unchanged");
  });

  root.querySelectorAll("[data-preview-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.previewAction;
      const message = action === "Download"
        ? "Sample photos are not available to download in this preview"
        : `${action} is not connected in this preview`;
      showToast(message);
    });
  });

  modalClose.addEventListener("click", closeImage);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeImage();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeImage();
  });

  setResultsView("latest");
}
