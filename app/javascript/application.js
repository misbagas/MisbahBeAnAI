if (document.querySelector("[data-resume-builder]")) {
  import("resume_builder");
}

if (document.querySelector("[data-ai-humanizer]")) {
  import("ai_humanizer");
}

if (document.querySelector("[data-ai-checker]")) {
  import("ai_checker");
}

if (document.querySelector("[data-sound-to-text]")) {
  import("sound_to_text");
}

if (document.querySelector("[data-generate-photo]")) {
  import("generate_photo");
}

(() => {
  const root = document.querySelector("[data-chat-root]");
  if (!root) return;

  let conversationId = root.dataset.conversationId;
  const form = document.getElementById("message-form");
  const input = document.getElementById("message-input");
  const fileInput = document.getElementById("file-input");
  const preview = document.getElementById("file-preview");
  const messages = document.getElementById("messages");
  const sendButton = document.getElementById("send-button");
  const csrf = document.querySelector('meta[name="csrf-token"]').content;
  const conversationList = document.getElementById("conversation-list");
  let selectedFiles = [];

  const escapeHtml = (value) => value.replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function buildConversationItem(conversation, active = false) {
    const item = document.createElement("div");
    item.className = `conversation-item${active ? " active" : ""}`;
    item.dataset.conversationItem = "";
    item.dataset.conversationId = String(conversation.id);

    const link = document.createElement("a");
    link.href = conversation.url;
    link.className = "conversation-link";
    const title = document.createElement("span");
    title.className = "conversation-name";
    title.textContent = conversation.title;
    const count = document.createElement("small");
    count.textContent = `${conversation.message_count} msgs`;
    link.append(title, count);

    const actions = document.createElement("div");
    actions.className = "conversation-actions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "conversation-menu-toggle";
    toggle.dataset.conversationMenuToggle = "";
    toggle.setAttribute("aria-label", `Actions for ${conversation.title}`);
    toggle.setAttribute("aria-haspopup", "menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "...";

    const menu = document.createElement("div");
    menu.className = "conversation-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    [["rename", "Rename"], ["delete", "Delete"]].forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.conversationAction = action;
      button.setAttribute("role", "menuitem");
      if (action === "delete") button.className = "delete-action";
      button.textContent = label;
      menu.appendChild(button);
    });

    actions.append(toggle, menu);
    item.append(link, actions);
    return item;
  }

  function closeConversationMenus(exceptItem = null) {
    conversationList.querySelectorAll("[data-conversation-item]").forEach((item) => {
      if (item === exceptItem) return;
      const menu = item.querySelector(".conversation-menu");
      const toggle = item.querySelector("[data-conversation-menu-toggle]");
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  conversationList.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-conversation-menu-toggle]");
    if (toggle) {
      event.preventDefault();
      const item = toggle.closest("[data-conversation-item]");
      const menu = item.querySelector(".conversation-menu");
      const shouldOpen = menu.hidden;
      closeConversationMenus(item);
      menu.hidden = !shouldOpen;
      toggle.setAttribute("aria-expanded", String(shouldOpen));
      if (shouldOpen) {
        const buttonRect = toggle.getBoundingClientRect();
        const left = Math.max(8, Math.min(buttonRect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8));
        menu.style.top = `${buttonRect.bottom + 4}px`;
        menu.style.left = `${left}px`;
      }
      return;
    }

    const actionButton = event.target.closest("[data-conversation-action]");
    if (!actionButton) return;

    const item = actionButton.closest("[data-conversation-item]");
    const conversationIdForAction = item.dataset.conversationId;
    const titleElement = item.querySelector(".conversation-name");
    const currentTitle = titleElement.textContent;
    closeConversationMenus();

    if (actionButton.dataset.conversationAction === "rename") {
      const title = window.prompt("Rename chat", currentTitle);
      if (title === null) return;

      try {
        const response = await fetch(`/conversations/${conversationIdForAction}`, {
          method: "PATCH",
          headers: {
            "X-CSRF-Token": csrf,
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ title })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not rename chat.");

        titleElement.textContent = data.title;
        item.querySelector("[data-conversation-menu-toggle]").setAttribute("aria-label", `Actions for ${data.title}`);
        if (conversationIdForAction === root.dataset.conversationId) {
          document.querySelector(".chat-header h1").textContent = data.title;
        }
      } catch (error) {
        window.alert(error.message);
      }
      return;
    }

    if (!window.confirm(`Delete "${currentTitle}"? This will permanently delete the chat and its messages.`)) return;

    try {
      const response = await fetch(`/conversations/${conversationIdForAction}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrf, "Accept": "application/json" }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete chat.");

      item.remove();
      if (conversationIdForAction === root.dataset.conversationId) {
        window.location.assign(data.new_url);
      }
    } catch (error) {
      window.alert(error.message);
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".conversation-actions")) closeConversationMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openItem = conversationList.querySelector("[data-conversation-menu-toggle][aria-expanded='true']")?.closest("[data-conversation-item]");
    closeConversationMenus();
    openItem?.querySelector("[data-conversation-menu-toggle]").focus();
  });

  function renderFiles() {
    preview.innerHTML = "";
    preview.classList.toggle("hidden", selectedFiles.length === 0);
    selectedFiles.forEach((file, index) => {
      const chip = document.createElement("div");
      chip.className = "file-chip";
      chip.innerHTML = `<span>◫</span><strong>${escapeHtml(file.name)}</strong><span>${formatBytes(file.size)}</span><button type="button" data-index="${index}" aria-label="Remove">×</button>`;
      preview.appendChild(chip);
    });
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function addFiles(files) {
    const incoming = Array.from(files);
    if (selectedFiles.length + incoming.length > 11) {
      alert("Maximum 11 files per message.");
      return;
    }
    const oversized = incoming.find((file) => file.size > 25 * 1024 * 1024);
    if (oversized) {
      alert(`${oversized.name} is larger than 25 MB.`);
      return;
    }
    selectedFiles.push(...incoming);
    renderFiles();
  }

  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });

  preview.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    selectedFiles.splice(Number(button.dataset.index), 1);
    renderFiles();
  });

  document.querySelectorAll("[data-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.suggestion;
      input.focus();
    });
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    form.addEventListener(eventName, (event) => {
      event.preventDefault();
      root.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    form.addEventListener(eventName, (event) => {
      event.preventDefault();
      root.classList.remove("dragging");
    });
  });
  form.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

  const resizeInput = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 170)}px`;
  };
  input.addEventListener("input", resizeInput);
  resizeInput();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text && selectedFiles.length === 0) return;

    sendButton.disabled = true;
    const empty = document.getElementById("empty-state");
    if (empty) empty.remove();

    appendUserMessage(text || `Uploaded ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}.`, selectedFiles);
    const userFiles = [...selectedFiles];
    input.value = "";
    selectedFiles = [];
    renderFiles();
    input.style.height = "auto";

    const typing = appendTyping();
    const body = new FormData();
    body.append("content", text);
    userFiles.forEach((file) => body.append("files[]", file));

    try {
      const response = await fetch(`/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "X-CSRF-Token": csrf, "Accept": "application/json" },
        body
      });
      const data = await response.json();
      typing.remove();
      if (!response.ok) throw new Error(data.error || "Request failed");
      if (conversationId === "new") {
        conversationId = String(data.conversation.id);
        root.dataset.conversationId = conversationId;
        window.history.replaceState({}, "", data.conversation.url);

        const heading = document.querySelector(".chat-header h1");
        heading.textContent = data.conversation.title;

        conversationList.prepend(buildConversationItem(data.conversation, true));
      } else {
        const item = Array.from(conversationList.children).find((entry) => entry.dataset.conversationId === conversationId);
        if (item) {
          item.querySelector(".conversation-name").textContent = data.conversation.title;
          item.querySelector("small").textContent = `${data.conversation.message_count} msgs`;
          item.querySelector("[data-conversation-menu-toggle]").setAttribute("aria-label", `Actions for ${data.conversation.title}`);
        }
      }
      document.querySelector(".chat-header h1").textContent = data.conversation.title;
      appendAssistantMessage(data.assistant_message);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (error) {
      typing.remove();
      appendAssistantMessage({ content: `Error: ${error.message}`, citations: [] });
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  });

  function scrollMessages() {
    messages.scrollTop = messages.scrollHeight;
  }

  function appendUserMessage(text, files) {
    const article = document.createElement("article");
    article.className = "message user";
    article.innerHTML = `
      <div class="avatar">You</div>
      <div class="message-body">
        <div class="message-role">User</div>
        <div class="message-content"><p>${escapeHtml(text)}</p></div>
        ${files.length ? `<div class="attachments">${files.map((file) => `<div class="attachment-card"><span class="attachment-icon">◫</span><span class="attachment-meta"><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)}</small></span></div>`).join("")}</div>` : ""}
      </div>`;
    messages.appendChild(article);
    scrollMessages();
  }

  function appendTyping() {
    const article = document.createElement("article");
    article.className = "message assistant";
    article.innerHTML = `<div class="avatar">AI</div><div class="message-body"><div class="message-role">AI</div><div class="message-content"><p>Thinking…</p></div></div>`;
    messages.appendChild(article);
    scrollMessages();
    return article;
  }

  function appendAssistantMessage(message) {
    const article = document.createElement("article");
    article.className = "message assistant";
    const citations = (message.citations || []).length ? `<details class="citations"><summary>Sources from uploaded files (${message.citations.length})</summary><div class="citation-list">${message.citations.map((c) => `<div>${escapeHtml(JSON.stringify(c))}</div>`).join("")}</div></details>` : "";
    article.innerHTML = `<div class="avatar">AI</div><div class="message-body"><div class="message-role">AI</div><div class="message-content">${renderMarkdownLite(message.content || "")}</div>${citations}</div>`;
    messages.appendChild(article);
    scrollMessages();
  }

  function renderMarkdownLite(text) {
    const escaped = escapeHtml(text);
    return escaped.split(/\n\n+/).map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("");
  }
})();
