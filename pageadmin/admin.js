(() => {
  "use strict";

  const config = window.ARS_ADMIN_CONFIG || {};
  const API_BASE = "https://api.github.com";
  const SESSION_KEY = "ars-admin-github-token";
  const PERSISTENT_KEY = "ars-admin-github-token-persistent";
  const MAX_SOURCE_SIZE = 12 * 1024 * 1024;
  const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const state = {
    token:
      sessionStorage.getItem(SESSION_KEY) ||
      localStorage.getItem(PERSISTENT_KEY) ||
      "",
    user: null,
    baseCommitSha: "",
    gallery: [],
    posters: [],
    initialGallery: [],
    initialPosters: [],
    uploads: new Map(),
    deletedPaths: new Set(),
    existingPaths: new Set(),
    previewUrls: new Map(),
    isPublishing: false
  };

  const elements = {
    setupView: document.querySelector("#setupView"),
    loginView: document.querySelector("#loginView"),
    workspaceView: document.querySelector("#workspaceView"),
    loginForm: document.querySelector("#loginForm"),
    loginButton: document.querySelector("#loginButton"),
    accessToken: document.querySelector("#accessToken"),
    rememberToken: document.querySelector("#rememberToken"),
    loginNotice: document.querySelector("#loginNotice"),
    logoutButton: document.querySelector("#logoutButton"),
    publishButton: document.querySelector("#publishButton"),
    changeCount: document.querySelector("#changeCount"),
    connectionStatus: document.querySelector("#connectionStatus"),
    repositoryName: document.querySelector("#repositoryName"),
    branchName: document.querySelector("#branchName"),
    globalNotice: document.querySelector("#globalNotice"),
    galleryTab: document.querySelector("#galleryTab"),
    postersTab: document.querySelector("#postersTab"),
    galleryPanel: document.querySelector("#galleryPanel"),
    postersPanel: document.querySelector("#postersPanel"),
    galleryCount: document.querySelector("#galleryCount"),
    postersCount: document.querySelector("#postersCount"),
    galleryInput: document.querySelector("#galleryInput"),
    postersInput: document.querySelector("#postersInput"),
    galleryDropzone: document.querySelector("#galleryDropzone"),
    postersDropzone: document.querySelector("#postersDropzone"),
    galleryQueue: document.querySelector("#galleryQueue"),
    postersQueue: document.querySelector("#postersQueue"),
    galleryList: document.querySelector("#galleryList"),
    postersList: document.querySelector("#postersList"),
    galleryEmpty: document.querySelector("#galleryEmpty"),
    postersEmpty: document.querySelector("#postersEmpty"),
    confirmDialog: document.querySelector("#confirmDialog"),
    dialogTitle: document.querySelector("#dialogTitle"),
    dialogDescription: document.querySelector("#dialogDescription"),
    dialogCancel: document.querySelector("#dialogCancel"),
    dialogConfirm: document.querySelector("#dialogConfirm"),
    toastRegion: document.querySelector("#toastRegion")
  };

  function isConfigured() {
    return Boolean(
      config.owner &&
      config.repository &&
      config.branch
    );
  }

  function setVisibleView(view) {
    elements.setupView.hidden = view !== "setup";
    elements.loginView.hidden = view !== "login";
    elements.workspaceView.hidden = view !== "workspace";
    elements.publishButton.hidden = view !== "workspace";
  }

  function setConnectionStatus(label, status = "neutral") {
    elements.connectionStatus.dataset.state = status;
    elements.connectionStatus.querySelector("span:last-child").textContent = label;
  }

  function showNotice(message, status = "neutral", title = "") {
    elements.globalNotice.className = `notice${status !== "neutral" ? ` notice-${status}` : ""}`;
    elements.globalNotice.replaceChildren();

    if (title) {
      const strong = document.createElement("strong");
      strong.textContent = title;
      elements.globalNotice.appendChild(strong);
    }

    const span = document.createElement("span");
    span.textContent = message;
    elements.globalNotice.appendChild(span);
    elements.globalNotice.hidden = false;
  }

  function hideNotice() {
    elements.globalNotice.hidden = true;
  }

  function showToast(message, status = "neutral") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.state = status;
    toast.textContent = message;
    elements.toastRegion.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 4200);
  }

  function setBusy(isBusy) {
    document.body.classList.toggle("is-busy", isBusy);
    elements.publishButton.disabled = isBusy || !getChangeCount();
    elements.publishButton.querySelector("span:nth-child(2)").textContent = isBusy
      ? "Pubblicazione…"
      : "Pubblica modifiche";
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeGallery(items) {
    return items.map((item) => ({
      file: String(item.file || ""),
      alt: String(item.alt || ""),
      description: String(item.description || "")
    }));
  }

  function normalizePosters(items) {
    return items.map((item) => ({
      file: String(item.file || ""),
      ...(item.title ? { title: String(item.title) } : {})
    }));
  }

  function stableJson(value) {
    return JSON.stringify(value);
  }

  function getChangeCount() {
    let count = state.uploads.size + state.deletedPaths.size;
    const galleryHasFileChanges =
      [...state.uploads.keys(), ...state.deletedPaths].some((path) =>
        path.startsWith(`${config.galleryMediaPath}/`)
      );
    const postersHaveFileChanges =
      [...state.uploads.keys(), ...state.deletedPaths].some((path) =>
        path.startsWith(`${config.postersMediaPath}/`)
      );

    if (
      !galleryHasFileChanges &&
      stableJson(normalizeGallery(state.gallery)) !== stableJson(state.initialGallery)
    ) {
      count += 1;
    }

    if (
      !postersHaveFileChanges &&
      stableJson(normalizePosters(state.posters)) !== stableJson(state.initialPosters)
    ) {
      count += 1;
    }

    return count;
  }

  function updateDirtyState() {
    const count = getChangeCount();

    elements.changeCount.textContent = String(count);
    elements.changeCount.hidden = !count;
    elements.publishButton.disabled = !count || state.isPublishing;
    setConnectionStatus(
      count ? `${count} modifiche da pubblicare` : `Collegato come ${state.user?.login || "admin"}`,
      count ? "warning" : "success"
    );
  }

  async function githubFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");

    if (state.token) {
      headers.set("Authorization", `Bearer ${state.token}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload.message || `GitHub ha risposto con errore ${response.status}.`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    if (response.status === 204) return null;
    return response.json();
  }

  function repoPath(path) {
    return `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}${path}`;
  }

  function encodeGitPath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  function rawMediaUrl(path) {
    const cacheKey = state.baseCommitSha || config.branch;
    return `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}/${encodeURIComponent(config.branch)}/${encodeGitPath(path)}?v=${encodeURIComponent(cacheKey)}`;
  }

  function decodeBase64Utf8(value) {
    const binary = atob(value.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function readJsonFile(path) {
    const payload = await githubFetch(
      repoPath(`/contents/${encodeGitPath(path)}?ref=${encodeURIComponent(config.branch)}`)
    );
    return JSON.parse(decodeBase64Utf8(payload.content));
  }

  async function getBranchState() {
    const branchPath = encodeGitPath(config.branch);
    const reference = await githubFetch(repoPath(`/git/ref/heads/${branchPath}`));
    const commitSha = reference.object.sha;
    const commit = await githubFetch(repoPath(`/git/commits/${commitSha}`));
    const tree = await githubFetch(repoPath(`/git/trees/${commit.tree.sha}?recursive=1`));

    return {
      commitSha,
      treeSha: commit.tree.sha,
      paths: new Set(tree.tree.filter((item) => item.type === "blob").map((item) => item.path))
    };
  }

  async function loadWorkspace() {
    setConnectionStatus("Caricamento contenuti…", "warning");

    try {
      const [user, repository, branch, gallery, posters] = await Promise.all([
        githubFetch("/user"),
        githubFetch(repoPath("")),
        getBranchState(),
        readJsonFile(config.galleryJsonPath),
        readJsonFile(config.postersJsonPath)
      ]);

      if (!repository.permissions?.push) {
        throw new Error("L’account collegato non ha il permesso di scrivere in questa repository.");
      }

      state.user = user;
      state.baseCommitSha = branch.commitSha;
      state.existingPaths = branch.paths;
      state.gallery = normalizeGallery(gallery);
      state.posters = normalizePosters(posters);
      state.initialGallery = cloneJson(state.gallery);
      state.initialPosters = cloneJson(state.posters);
      state.uploads.clear();
      state.deletedPaths.clear();

      elements.repositoryName.textContent = `${config.owner}/${config.repository}`;
      elements.branchName.textContent = `Branch ${config.branch}`;
      elements.logoutButton.hidden = false;

      renderAll();
      setVisibleView("workspace");
      setConnectionStatus(`Collegato come ${user.login}`, "success");
    } catch (error) {
      if (error.status === 401) {
        logout(false);
        showLoginError("La chiave GitHub non è valida oppure è scaduta. Inseriscine una nuova.");
        return;
      }

      logout(false);
      showLoginError(
        error.status === 403
          ? "La chiave non dispone del permesso Contents: Read and write per questa repository."
          : error.message
      );
    }
  }

  function showLoginError(message) {
    setVisibleView("login");
    setConnectionStatus("Collegamento non riuscito", "error");
    elements.loginNotice.textContent = message;
    elements.loginNotice.hidden = false;
    showToast(message, "error");
  }

  async function loginWithToken(event) {
    event.preventDefault();
    const token = elements.accessToken.value.trim();

    if (!token) {
      elements.accessToken.focus();
      return;
    }

    elements.loginButton.disabled = true;
    elements.loginButton.textContent = "Verifica in corso…";
    elements.loginNotice.hidden = true;
    setConnectionStatus("Verifica accesso…", "warning");

    try {
      state.token = token;

      if (elements.rememberToken.checked) {
        localStorage.setItem(PERSISTENT_KEY, token);
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY, token);
        localStorage.removeItem(PERSISTENT_KEY);
      }

      await loadWorkspace();
    } catch (error) {
      showLoginError(error.message || "Impossibile verificare la chiave GitHub.");
    } finally {
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = "Accedi al pannello";
    }
  }

  function logout(showMessage = true) {
    state.token = "";
    state.user = null;
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PERSISTENT_KEY);
    elements.accessToken.value = "";
    elements.rememberToken.checked = false;
    elements.loginNotice.hidden = true;
    elements.logoutButton.hidden = true;
    setVisibleView("login");
    setConnectionStatus("Non collegato", "neutral");

    if (showMessage) showToast("Sessione GitHub chiusa.", "success");
  }

  function switchTab(tabName) {
    const isGallery = tabName === "gallery";
    elements.galleryTab.classList.toggle("is-active", isGallery);
    elements.galleryTab.setAttribute("aria-selected", String(isGallery));
    elements.postersTab.classList.toggle("is-active", !isGallery);
    elements.postersTab.setAttribute("aria-selected", String(!isGallery));
    elements.galleryPanel.hidden = !isGallery;
    elements.postersPanel.hidden = isGallery;
  }

  function createElement(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function createIconButton(label, icon, className = "") {
    const button = createElement("button", `icon-button ${className}`.trim(), icon);
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    return button;
  }

  function createField(labelText, value, options = {}) {
    const wrapper = createElement("div", "field");
    const label = createElement("label", "", labelText);
    const input = options.multiline
      ? createElement("textarea")
      : createElement("input");

    input.value = value || "";
    input.placeholder = options.placeholder || "";
    input.maxLength = options.maxLength || (options.multiline ? 180 : 120);

    const id = `field-${crypto.randomUUID()}`;
    input.id = id;
    label.htmlFor = id;

    wrapper.append(label, input);

    if (options.helper) {
      wrapper.appendChild(createElement("span", "field-helper", options.helper));
    }

    return { wrapper, input };
  }

  function createContentCard(item, type, index) {
    const isGallery = type === "gallery";
    const list = isGallery ? state.gallery : state.posters;
    const mediaRoot = isGallery ? config.galleryMediaPath : config.postersMediaPath;
    const path = `${mediaRoot}/${item.file}`;
    const isNew = state.uploads.has(path);
    const card = createElement("article", "content-card");
    card.dataset.new = String(isNew);

    const preview = createElement("div", "content-preview");
    const image = document.createElement("img");
    image.alt = isGallery ? (item.alt || "Anteprima fotografia") : (item.title || "Anteprima locandina");
    image.loading = "lazy";
    image.src = state.previewUrls.get(path) || rawMediaUrl(path);
    if (!isNew && !state.existingPaths.has(path)) {
      preview.classList.add("is-missing");
    }
    image.addEventListener("error", () => preview.classList.add("is-missing"), { once: true });
    preview.appendChild(image);

    if (isNew) {
      preview.appendChild(createElement("span", "new-badge", "Nuovo"));
    }

    const form = createElement("div", "card-form");

    if (isGallery) {
      const altField = createField("Testo alternativo", item.alt, {
        placeholder: "Es. Gruppo durante l’uscita a Cesena",
        helper: "Descrive la foto a chi non può vederla.",
        maxLength: 140
      });
      const descriptionField = createField("Descrizione facoltativa", item.description, {
        multiline: true,
        placeholder: "Aggiungi una breve didascalia…",
        maxLength: 180
      });

      altField.input.addEventListener("input", () => {
        item.alt = altField.input.value;
        updateDirtyState();
      });
      descriptionField.input.addEventListener("input", () => {
        item.description = descriptionField.input.value;
        updateDirtyState();
      });

      form.append(altField.wrapper, descriptionField.wrapper);
    } else {
      const titleField = createField("Titolo facoltativo", item.title || "", {
        placeholder: "Es. Uscita di domenica 26 luglio",
        maxLength: 120
      });

      titleField.input.addEventListener("input", () => {
        const value = titleField.input.value.trim();
        if (value) item.title = titleField.input.value;
        else delete item.title;
        updateDirtyState();
      });

      form.appendChild(titleField.wrapper);
    }

    form.appendChild(createElement("span", "file-meta", item.file));

    const actions = createElement("div", "card-actions");
    const orderActions = createElement("div", "order-actions");
    const moveUp = createIconButton("Sposta prima", "↑");
    const moveDown = createIconButton("Sposta dopo", "↓");
    const remove = createIconButton("Elimina contenuto", "×", "icon-button-danger");

    moveUp.disabled = index === 0;
    moveDown.disabled = index === list.length - 1;

    moveUp.addEventListener("click", () => moveItem(type, index, -1));
    moveDown.addEventListener("click", () => moveItem(type, index, 1));
    remove.addEventListener("click", async () => {
      const confirmed = await confirmRemoval(
        isGallery ? "Eliminare questa fotografia?" : "Eliminare questa locandina?",
        "La rimozione sarà applicata soltanto quando pubblicherai le modifiche."
      );
      if (confirmed) removeItem(type, index);
    });

    orderActions.append(moveUp, moveDown);
    actions.append(orderActions, remove);
    card.append(preview, form, actions);
    return card;
  }

  function renderContentList(type) {
    const isGallery = type === "gallery";
    const list = isGallery ? state.gallery : state.posters;
    const container = isGallery ? elements.galleryList : elements.postersList;
    const empty = isGallery ? elements.galleryEmpty : elements.postersEmpty;
    const counter = isGallery ? elements.galleryCount : elements.postersCount;

    container.replaceChildren();
    empty.hidden = Boolean(list.length);
    counter.textContent = String(list.length);

    list.forEach((item, index) => {
      container.appendChild(createContentCard(item, type, index));
    });
  }

  function renderAll() {
    renderContentList("gallery");
    renderContentList("posters");
    updateDirtyState();
  }

  function moveItem(type, index, direction) {
    const list = type === "gallery" ? state.gallery : state.posters;
    const destination = index + direction;
    if (destination < 0 || destination >= list.length) return;

    [list[index], list[destination]] = [list[destination], list[index]];
    renderContentList(type);
    updateDirtyState();
  }

  function removeItem(type, index) {
    const list = type === "gallery" ? state.gallery : state.posters;
    const mediaRoot = type === "gallery" ? config.galleryMediaPath : config.postersMediaPath;
    const [item] = list.splice(index, 1);
    const path = `${mediaRoot}/${item.file}`;

    if (state.uploads.has(path)) {
      state.uploads.delete(path);
      const previewUrl = state.previewUrls.get(path);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      state.previewUrls.delete(path);
    } else if (state.existingPaths.has(path)) {
      state.deletedPaths.add(path);
    }

    renderContentList(type);
    updateDirtyState();
    showToast("Contenuto rimosso dalla prossima pubblicazione.", "success");
  }

  let dialogResolver = null;
  let dialogPreviousFocus = null;

  function confirmRemoval(title, description) {
    elements.dialogTitle.textContent = title;
    elements.dialogDescription.textContent = description;
    elements.confirmDialog.hidden = false;
    dialogPreviousFocus = document.activeElement;
    elements.dialogCancel.focus();

    return new Promise((resolve) => {
      dialogResolver = resolve;
    });
  }

  function closeDialog(result) {
    elements.confirmDialog.hidden = true;
    dialogResolver?.(result);
    dialogResolver = null;
    dialogPreviousFocus?.focus();
  }

  async function handleFiles(files, type) {
    const queue = type === "gallery" ? elements.galleryQueue : elements.postersQueue;
    const list = type === "gallery" ? state.gallery : state.posters;
    const mediaRoot = type === "gallery" ? config.galleryMediaPath : config.postersMediaPath;
    const validFiles = [...files].filter(Boolean);

    for (const file of validFiles) {
      const queueItem = createQueueItem(file);
      queue.appendChild(queueItem.element);

      try {
        validateSourceFile(file);
        queueItem.status.textContent = "Ottimizzazione in corso…";

        const processed = await optimizeImage(file, type);
        const filename = createFilename(type, processed.extension);
        const path = `${mediaRoot}/${filename}`;
        const previewUrl = URL.createObjectURL(processed.blob);

        state.uploads.set(path, processed.blob);
        state.previewUrls.set(path, previewUrl);

        if (type === "gallery") {
          list.unshift({
            file: filename,
            alt: "Foto della squadra Ars et Robur",
            description: ""
          });
        } else {
          list.unshift({
            file: filename
          });
        }

        queueItem.image.src = previewUrl;
        queueItem.status.textContent = `Pronto · ${formatBytes(processed.blob.size)}`;
        renderContentList(type);
        updateDirtyState();
      } catch (error) {
        queueItem.element.dataset.state = "error";
        queueItem.status.textContent = error.message;
        showToast(`${file.name}: ${error.message}`, "error");
      }
    }
  }

  function createQueueItem(file) {
    const element = createElement("div", "queue-item");
    const image = document.createElement("img");
    image.alt = "";
    const details = createElement("div");
    const name = createElement("strong", "", file.name);
    const status = createElement("span", "", "In attesa…");

    details.append(name, status);
    element.append(image, details);

    return { element, image, status };
  }

  function validateSourceFile(file) {
    if (!SUPPORTED_TYPES.has(file.type)) {
      throw new Error("Formato non supportato. Usa JPG, PNG o WebP.");
    }

    if (file.size > MAX_SOURCE_SIZE) {
      throw new Error("Il file supera il limite di 12 MB.");
    }
  }

  async function optimizeImage(file, type) {
    const bitmap = await createImageBitmap(file);
    const maxDimension = type === "gallery" ? 2400 : 2200;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: type === "gallery" });

    canvas.width = width;
    canvas.height = height;

    if (type === "posters") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const mimeType = type === "gallery" ? "image/webp" : "image/jpeg";
    const quality = type === "gallery" ? 0.86 : 0.9;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));

    if (!blob) {
      throw new Error("Il browser non è riuscito a convertire l’immagine.");
    }

    return {
      blob,
      extension: type === "gallery" ? "webp" : "jpg"
    };
  }

  function createFilename(type, extension) {
    const date = new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("");
    const random = crypto.randomUUID().slice(0, 8);
    const prefix = type === "gallery" ? "foto" : "locandina";
    return `${prefix}-${stamp}-${random}.${extension}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function setupDropzone(dropzone, input, type) {
    input.addEventListener("change", async () => {
      await handleFiles(input.files, type);
      input.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", async (event) => {
      await handleFiles(event.dataTransfer.files, type);
    });
  }

  async function blobToBase64(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunks = [];
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
    }

    return btoa(chunks.join(""));
  }

  async function createBlob(content, encoding) {
    return githubFetch(repoPath("/git/blobs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, encoding })
    });
  }

  async function publishChanges() {
    if (!getChangeCount() || state.isPublishing) return;

    state.isPublishing = true;
    setBusy(true);
    hideNotice();
    setConnectionStatus("Pubblicazione in corso…", "warning");

    try {
      const latest = await getBranchState();

      if (latest.commitSha !== state.baseCommitSha) {
        throw new Error(
          "La repository è cambiata dopo l’apertura del pannello. Ricarica i contenuti per evitare di sovrascrivere modifiche altrui."
        );
      }

      const treeEntries = [];
      const galleryChanged =
        stableJson(normalizeGallery(state.gallery)) !== stableJson(state.initialGallery);
      const postersChanged =
        stableJson(normalizePosters(state.posters)) !== stableJson(state.initialPosters);

      const uploadEntries = await Promise.all(
        [...state.uploads.entries()].map(async ([path, blob]) => {
          const created = await createBlob(await blobToBase64(blob), "base64");
          return {
            path,
            mode: "100644",
            type: "blob",
            sha: created.sha
          };
        })
      );

      treeEntries.push(...uploadEntries);

      if (galleryChanged) {
        const created = await createBlob(
          `${JSON.stringify(normalizeGallery(state.gallery), null, 2)}\n`,
          "utf-8"
        );
        treeEntries.push({
          path: config.galleryJsonPath,
          mode: "100644",
          type: "blob",
          sha: created.sha
        });
      }

      if (postersChanged) {
        const created = await createBlob(
          `${JSON.stringify(normalizePosters(state.posters), null, 2)}\n`,
          "utf-8"
        );
        treeEntries.push({
          path: config.postersJsonPath,
          mode: "100644",
          type: "blob",
          sha: created.sha
        });
      }

      state.deletedPaths.forEach((path) => {
        treeEntries.push({
          path,
          mode: "100644",
          type: "blob",
          sha: null
        });
      });

      const tree = await githubFetch(repoPath("/git/trees"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_tree: latest.treeSha,
          tree: treeEntries
        })
      });

      const commit = await githubFetch(repoPath("/git/commits"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: createCommitMessage(),
          tree: tree.sha,
          parents: [latest.commitSha]
        })
      });

      await githubFetch(repoPath(`/git/refs/heads/${encodeGitPath(config.branch)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sha: commit.sha,
          force: false
        })
      });

      state.baseCommitSha = commit.sha;
      state.uploads.forEach((_, path) => state.existingPaths.add(path));
      state.deletedPaths.forEach((path) => state.existingPaths.delete(path));
      state.initialGallery = cloneJson(normalizeGallery(state.gallery));
      state.initialPosters = cloneJson(normalizePosters(state.posters));
      state.uploads.clear();
      state.deletedPaths.clear();

      state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
      state.previewUrls.clear();
      elements.galleryQueue.replaceChildren();
      elements.postersQueue.replaceChildren();

      renderAll();
      showNotice(
        "GitHub ha ricevuto il nuovo commit. La pubblicazione del sito può richiedere qualche minuto.",
        "success",
        "Modifiche pubblicate"
      );
      showToast("Contenuti pubblicati correttamente.", "success");
    } catch (error) {
      showNotice(error.message, "error", "Pubblicazione non riuscita");
      showToast("Nessuna modifica è stata applicata al sito.", "error");
      setConnectionStatus("Pubblicazione da riprovare", "error");
    } finally {
      state.isPublishing = false;
      setBusy(false);
      updateDirtyState();
    }
  }

  function createCommitMessage() {
    const galleryChanged =
      stableJson(normalizeGallery(state.gallery)) !== stableJson(state.initialGallery);
    const postersChanged =
      stableJson(normalizePosters(state.posters)) !== stableJson(state.initialPosters);

    if (galleryChanged && postersChanged) return "Aggiorna gallery e locandine";
    if (galleryChanged) return "Aggiorna gallery";
    if (postersChanged) return "Aggiorna locandine";
    return "Aggiorna contenuti multimediali";
  }

  function handleBeforeUnload(event) {
    if (!getChangeCount()) return;
    event.preventDefault();
    event.returnValue = "";
  }

  function initializeEvents() {
    elements.loginForm.addEventListener("submit", loginWithToken);
    elements.logoutButton.addEventListener("click", () => {
      if (getChangeCount() && !window.confirm("Ci sono modifiche non pubblicate. Uscire comunque?")) {
        return;
      }
      logout();
    });
    elements.publishButton.addEventListener("click", publishChanges);
    elements.galleryTab.addEventListener("click", () => switchTab("gallery"));
    elements.postersTab.addEventListener("click", () => switchTab("posters"));
    elements.galleryTab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        switchTab("posters");
        elements.postersTab.focus();
      }
    });
    elements.postersTab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        switchTab("gallery");
        elements.galleryTab.focus();
      }
    });
    elements.dialogCancel.addEventListener("click", () => closeDialog(false));
    elements.dialogConfirm.addEventListener("click", () => closeDialog(true));
    elements.confirmDialog.addEventListener("click", (event) => {
      if (event.target === elements.confirmDialog) closeDialog(false);
    });
    document.addEventListener("keydown", (event) => {
      if (!elements.confirmDialog.hidden && event.key === "Escape") {
        closeDialog(false);
      }
    });
    setupDropzone(elements.galleryDropzone, elements.galleryInput, "gallery");
    setupDropzone(elements.postersDropzone, elements.postersInput, "posters");
    window.addEventListener("beforeunload", handleBeforeUnload);
  }

  async function initialize() {
    initializeEvents();

    if (!isConfigured()) {
      setVisibleView("setup");
      setConnectionStatus("Configurazione richiesta", "warning");
      return;
    }

    if (!state.token) {
      setVisibleView("login");
      setConnectionStatus("Non collegato", "neutral");
      return;
    }

    setVisibleView("workspace");
    await loadWorkspace();
  }

  initialize();
})();
