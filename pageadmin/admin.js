(() => {
  "use strict";

  const config = window.ARS_ADMIN_CONFIG || {};
  const API_BASE = "https://api.github.com";
  const SESSION_KEY = "ars-admin-github-token";
  const PERSISTENT_KEY = "ars-admin-github-token-persistent";
  const MAX_SOURCE_SIZE = 12 * 1024 * 1024;
  const MAX_PDF_SIZE = 25 * 1024 * 1024;
  const PDF_TYPE = "application/pdf";
  const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const SITE_CONTENT_SECTIONS = [
    {
      id: "hero",
      label: "Hero",
      description: "Il primo messaggio percepito da chi apre il sito.",
      theme: "dark",
      fields: [
        ["hero.tagline", "Sovratitolo", 90],
        ["hero.manifesto", "Manifesto", 80],
        ["hero.intro", "Presentazione", 360, true],
        ["hero.primaryAction", "Pulsante principale", 40],
        ["hero.secondaryAction", "Collegamento secondario", 40]
      ],
      preview: ["hero.tagline", "hero.manifesto", "hero.intro"]
    },
    {
      id: "about",
      label: "Chi siamo",
      description: "Presentazione della squadra e messaggio distintivo.",
      theme: "light",
      fields: [
        ["about.eyebrow", "Etichetta sezione", 40],
        ["about.title", "Titolo", 100],
        ["about.body", "Testo introduttivo", 520, true],
        ["about.cardTitle", "Titolo approfondimento", 120],
        ["about.cardBody", "Testo approfondimento", 320, true]
      ],
      preview: ["about.eyebrow", "about.title", "about.body"]
    },
    {
      id: "gallery",
      label: "Gallery",
      description: "Introduzione alle fotografie della squadra.",
      theme: "dark",
      fields: [
        ["gallery.eyebrow", "Etichetta sezione", 40],
        ["gallery.title", "Titolo", 110],
        ["gallery.body", "Descrizione", 420, true]
      ],
      preview: ["gallery.eyebrow", "gallery.title", "gallery.body"]
    },
    {
      id: "weekly",
      label: "Uscite settimanali",
      description: "Testi che accompagnano le locandine.",
      theme: "light",
      fields: [
        ["weekly.eyebrow", "Etichetta sezione", 50],
        ["weekly.title", "Titolo", 100],
        ["weekly.body", "Descrizione", 420, true],
        ["weekly.helper", "Messaggio di supporto", 120],
        ["weekly.action", "Pulsante Facebook", 50]
      ],
      preview: ["weekly.eyebrow", "weekly.title", "weekly.body"]
    },
    {
      id: "activities",
      label: "Attività",
      description: "Titolo della sezione e contenuti delle quattro card.",
      theme: "dark",
      fields: [
        ["activities.eyebrow", "Etichetta sezione", 40],
        ["activities.title", "Titolo sezione", 100],
        ["activities.cards.0.title", "Card 1 · Titolo", 90],
        ["activities.cards.0.body", "Card 1 · Testo", 320, true],
        ["activities.cards.1.title", "Card 2 · Titolo", 90],
        ["activities.cards.1.body", "Card 2 · Testo", 320, true],
        ["activities.cards.2.title", "Card 3 · Titolo", 90],
        ["activities.cards.2.body", "Card 3 · Testo", 320, true],
        ["activities.cards.3.title", "Card 4 · Titolo", 90],
        ["activities.cards.3.body", "Card 4 · Testo", 320, true]
      ],
      preview: ["activities.eyebrow", "activities.title", "activities.cards.0.body"]
    },
    {
      id: "sponsors",
      label: "Sponsor",
      description: "Presentazione delle realtà che sostengono la squadra.",
      theme: "light",
      fields: [
        ["sponsors.eyebrow", "Etichetta sezione", 40],
        ["sponsors.title", "Titolo", 100],
        ["sponsors.body", "Descrizione", 420, true],
        ["sponsors.prompt", "Invito", 100],
        ["sponsors.action", "Pulsante sponsor", 50]
      ],
      preview: ["sponsors.eyebrow", "sponsors.title", "sponsors.body"]
    },
    {
      id: "contact",
      label: "Contatti",
      description: "Invito finale prima dei canali di contatto.",
      theme: "dark",
      fields: [
        ["contact.eyebrow", "Etichetta sezione", 40],
        ["contact.title", "Titolo", 120],
        ["contact.body", "Descrizione", 420, true]
      ],
      preview: ["contact.eyebrow", "contact.title", "contact.body"]
    },
    {
      id: "footer",
      label: "Footer",
      description: "Breve descrizione della squadra a fondo pagina.",
      theme: "light",
      fields: [
        ["footer.description", "Descrizione", 180, true]
      ],
      preview: ["", "footer.description", ""]
    }
  ];

  const PDF_LIBRARY =
    window.pdfjsLib || window["pdfjs-dist/build/pdf"] || null;

  if (PDF_LIBRARY) {
    PDF_LIBRARY.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.min.js";
  }

  const state = {
    token:
      sessionStorage.getItem(SESSION_KEY) ||
      localStorage.getItem(PERSISTENT_KEY) ||
      "",
    user: null,
    baseCommitSha: "",
    gallery: [],
    posters: [],
    siteContent: {},
    initialGallery: [],
    initialPosters: [],
    initialSiteContent: {},
    uploads: new Map(),
    deletedPaths: new Set(),
    existingPaths: new Set(),
    previewUrls: new Map(),
    isPublishing: false,
    isRefreshing: false
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
    refreshButton: document.querySelector("#refreshButton"),
    publishButton: document.querySelector("#publishButton"),
    changeCount: document.querySelector("#changeCount"),
    connectionStatus: document.querySelector("#connectionStatus"),
    repositoryName: document.querySelector("#repositoryName"),
    branchName: document.querySelector("#branchName"),
    globalNotice: document.querySelector("#globalNotice"),
    galleryTab: document.querySelector("#galleryTab"),
    postersTab: document.querySelector("#postersTab"),
    textsTab: document.querySelector("#textsTab"),
    galleryPanel: document.querySelector("#galleryPanel"),
    postersPanel: document.querySelector("#postersPanel"),
    textsPanel: document.querySelector("#textsPanel"),
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
    siteContentEditor: document.querySelector("#siteContentEditor"),
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
    elements.refreshButton.hidden = view !== "workspace";
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
    elements.publishButton.disabled = isBusy || state.isRefreshing || !getChangeCount();
    elements.publishButton.querySelector("span:nth-child(2)").textContent = isBusy
      ? "Pubblicazione…"
      : "Pubblica modifiche";
  }

  function setRefreshing(isRefreshing) {
    state.isRefreshing = isRefreshing;
    document.body.classList.toggle("is-busy", isRefreshing);
    elements.refreshButton.disabled = isRefreshing || state.isPublishing;
    elements.refreshButton.querySelector("span:nth-child(2)").textContent = isRefreshing
      ? "Aggiornamento…"
      : "Aggiorna";
    elements.publishButton.disabled = isRefreshing || state.isPublishing || !getChangeCount();
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
      ...(item.pdf ? { pdf: String(item.pdf) } : {}),
      ...(item.title ? { title: String(item.title) } : {})
    }));
  }

  function stableJson(value) {
    return JSON.stringify(value);
  }

  function getNestedValue(object, path) {
    if (!path) return "";
    return path.split(".").reduce((value, key) => value?.[key], object);
  }

  function setNestedValue(object, path, nextValue) {
    const keys = path.split(".");
    const finalKey = keys.pop();
    const target = keys.reduce((value, key) => value[key], object);
    target[finalKey] = nextValue;
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

    if (stableJson(state.siteContent) !== stableJson(state.initialSiteContent)) {
      count += 1;
    }

    return count;
  }

  function updateDirtyState() {
    const count = getChangeCount();

    elements.changeCount.textContent = String(count);
    elements.changeCount.hidden = !count;
    elements.publishButton.disabled = !count || state.isPublishing || state.isRefreshing;
    elements.refreshButton.disabled = state.isPublishing || state.isRefreshing;
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
      cache: "no-store",
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

  async function readJsonFile(path, ref) {
    const payload = await githubFetch(
      repoPath(`/contents/${encodeGitPath(path)}?ref=${encodeURIComponent(ref)}`)
    );
    return JSON.parse(decodeBase64Utf8(payload.content));
  }

  async function readLocalSiteContent() {
    const response = await fetch(`../${config.siteContentJsonPath}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        "Il file iniziale dei testi del sito non è disponibile. Aggiorna i file del progetto e riprova."
      );
    }

    return response.json();
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

  async function loadWorkspace({ isRefresh = false } = {}) {
    setConnectionStatus("Caricamento contenuti…", "warning");

    try {
      const [user, repository, branch] = await Promise.all([
        githubFetch("/user"),
        githubFetch(repoPath("")),
        getBranchState()
      ]);
      const hasPublishedSiteContent = branch.paths.has(config.siteContentJsonPath);
      const [gallery, posters, siteContent] = await Promise.all([
        readJsonFile(config.galleryJsonPath, branch.commitSha),
        readJsonFile(config.postersJsonPath, branch.commitSha),
        hasPublishedSiteContent
          ? readJsonFile(config.siteContentJsonPath, branch.commitSha)
          : readLocalSiteContent()
      ]);

      if (!repository.permissions?.push) {
        throw new Error("L’account collegato non ha il permesso di scrivere in questa repository.");
      }

      state.user = user;
      state.baseCommitSha = branch.commitSha;
      state.existingPaths = branch.paths;
      state.gallery = normalizeGallery(gallery);
      state.posters = normalizePosters(posters);
      state.siteContent = cloneJson(siteContent);
      state.initialGallery = cloneJson(state.gallery);
      state.initialPosters = cloneJson(state.posters);
      state.initialSiteContent = hasPublishedSiteContent
        ? cloneJson(state.siteContent)
        : {};
      state.uploads.clear();
      state.deletedPaths.clear();
      state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
      state.previewUrls.clear();
      elements.galleryQueue.replaceChildren();
      elements.postersQueue.replaceChildren();

      elements.repositoryName.textContent = `${config.owner}/${config.repository}`;
      elements.branchName.textContent = `Branch ${config.branch}`;
      elements.logoutButton.hidden = false;

      renderAll();
      setVisibleView("workspace");
      setConnectionStatus(`Collegato come ${user.login}`, "success");
      return true;
    } catch (error) {
      if (error.status === 401) {
        logout(false);
        showLoginError("La chiave GitHub non è valida oppure è scaduta. Inseriscine una nuova.");
        return false;
      }

      if (isRefresh) {
        updateDirtyState();
        showNotice(
          error.message || "Non è stato possibile recuperare i contenuti più recenti.",
          "error",
          "Aggiornamento non riuscito"
        );
        showToast("I contenuti aperti non sono stati modificati.", "error");
        return false;
      }

      logout(false);
      showLoginError(
        error.status === 403
          ? "La chiave non dispone del permesso Contents: Read and write per questa repository."
          : error.message
      );
      return false;
    }
  }

  async function refreshWorkspace() {
    if (state.isPublishing || state.isRefreshing) return;

    if (getChangeCount()) {
      const confirmed = await confirmAction({
        title: "Scartare le modifiche non pubblicate?",
        description:
          "Il pannello ricaricherà i contenuti da GitHub. Le modifiche presenti solo in questa pagina andranno perse.",
        confirmLabel: "Scarta e aggiorna",
        destructive: true
      });
      if (!confirmed) return;
    }

    setRefreshing(true);
    hideNotice();

    try {
      const refreshed = await loadWorkspace({ isRefresh: true });
      if (refreshed) showToast("Contenuti aggiornati all’ultima versione.", "success");
    } finally {
      setRefreshing(false);
      updateDirtyState();
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
    const tabs = [
      ["gallery", elements.galleryTab, elements.galleryPanel],
      ["posters", elements.postersTab, elements.postersPanel],
      ["texts", elements.textsTab, elements.textsPanel]
    ];

    tabs.forEach(([name, tab, panel]) => {
      const isActive = name === tabName;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      panel.hidden = !isActive;
    });
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

    form.appendChild(
      createElement(
        "span",
        "file-meta",
        item.pdf ? `${item.file} · PDF originale incluso` : item.file
      )
    );

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

  function createPreviewContent(tag, className, path) {
    return createElement(
      tag,
      className,
      String(getNestedValue(state.siteContent, path) || "")
    );
  }

  function createPreviewAction(path, secondary = false) {
    return createPreviewContent(
      "span",
      `preview-action${secondary ? " preview-action-secondary" : ""}`,
      path
    );
  }

  function renderSectionPreview(preview, section) {
    const canvas = createElement("div", "preview-canvas");
    const label = createElement("span", "preview-label", "Anteprima completa");
    preview.replaceChildren(label, canvas);

    if (section.id === "hero") {
      canvas.append(
        createPreviewContent("p", "preview-kicker preview-highlight", "hero.tagline"),
        createElement("p", "preview-brand", "ARS ET ROBUR"),
        createPreviewContent("p", "preview-manifesto", "hero.manifesto"),
        createPreviewContent("p", "preview-body", "hero.intro")
      );
      const actions = createElement("div", "preview-actions");
      actions.append(
        createPreviewAction("hero.primaryAction"),
        createPreviewAction("hero.secondaryAction", true)
      );
      canvas.appendChild(actions);
      return;
    }

    canvas.append(
      createPreviewContent("p", "preview-eyebrow", `${section.id}.eyebrow`),
      createPreviewContent("h3", "", `${section.id}.title`),
      createPreviewContent("p", "preview-body", `${section.id}.body`)
    );

    if (section.id === "about") {
      const feature = createElement("div", "preview-feature");
      feature.append(
        createPreviewContent("h4", "", "about.cardTitle"),
        createPreviewContent("p", "", "about.cardBody")
      );
      canvas.appendChild(feature);
    }

    if (section.id === "weekly") {
      canvas.append(
        createPreviewContent("p", "preview-support", "weekly.helper"),
        createPreviewAction("weekly.action")
      );
    }

    if (section.id === "activities") {
      const cards = createElement("div", "preview-mini-grid");
      state.siteContent.activities.cards.forEach((_, index) => {
        const card = createElement("article", "preview-mini-card");
        card.append(
          createPreviewContent("h4", "", `activities.cards.${index}.title`),
          createPreviewContent("p", "", `activities.cards.${index}.body`)
        );
        cards.appendChild(card);
      });
      canvas.appendChild(cards);
    }

    if (section.id === "sponsors") {
      const prompt = createElement("div", "preview-prompt");
      prompt.append(
        createPreviewContent("strong", "", "sponsors.prompt"),
        createPreviewAction("sponsors.action")
      );
      canvas.appendChild(prompt);
    }

    if (section.id === "footer") {
      canvas.replaceChildren(
        createElement("p", "preview-brand preview-brand-small", "ARS ET ROBUR"),
        createPreviewContent("p", "preview-body", "footer.description")
      );
    }
  }

  function renderSiteContentEditor() {
    elements.siteContentEditor.replaceChildren();

    SITE_CONTENT_SECTIONS.forEach((section, sectionIndex) => {
      const card = createElement("section", "text-section-card");
      card.dataset.section = section.id;
      const fields = createElement("div", "text-section-fields");
      const heading = createElement("div", "text-section-heading");
      const sectionMarker = createElement(
        "span",
        "text-section-marker",
        String(sectionIndex + 1).padStart(2, "0")
      );
      const headingCopy = createElement("div");
      headingCopy.append(
        createElement("h3", "", section.label),
        createElement("p", "", section.description)
      );
      heading.append(sectionMarker, headingCopy);
      fields.appendChild(heading);

      const preview = createElement("aside", "text-preview");
      preview.dataset.theme = section.theme;
      preview.dataset.section = section.id;
      preview.setAttribute("aria-label", `Anteprima sezione ${section.label}`);

      const updatePreview = () => {
        renderSectionPreview(preview, section);
      };

      section.fields.forEach(([path, label, maxLength, multiline = false]) => {
        const field = createField(label, getNestedValue(state.siteContent, path), {
          multiline,
          maxLength,
          placeholder: "Inserisci il testo mostrato sul sito"
        });

        field.input.classList.add("site-content-field");
        field.input.required = true;
        field.input.addEventListener("input", () => {
          setNestedValue(state.siteContent, path, field.input.value);
          updatePreview();
          updateDirtyState();
        });
        fields.appendChild(field.wrapper);
      });

      updatePreview();
      card.append(fields, preview);
      elements.siteContentEditor.appendChild(card);
    });
  }

  function renderAll() {
    renderContentList("gallery");
    renderContentList("posters");
    renderSiteContentEditor();
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
    const relatedPaths = [
      path,
      ...(type === "posters" && item.pdf ? [`${mediaRoot}/${item.pdf}`] : [])
    ];

    relatedPaths.forEach((relatedPath) => {
      if (state.uploads.has(relatedPath)) {
        state.uploads.delete(relatedPath);
        const previewUrl = state.previewUrls.get(relatedPath);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        state.previewUrls.delete(relatedPath);
      } else if (state.existingPaths.has(relatedPath)) {
        state.deletedPaths.add(relatedPath);
      }
    });

    renderContentList(type);
    updateDirtyState();
    showToast("Contenuto rimosso dalla prossima pubblicazione.", "success");
  }

  let dialogResolver = null;
  let dialogPreviousFocus = null;

  function confirmAction({
    title,
    description,
    confirmLabel = "Conferma",
    destructive = false
  }) {
    elements.dialogTitle.textContent = title;
    elements.dialogDescription.textContent = description;
    elements.dialogConfirm.textContent = confirmLabel;
    elements.dialogConfirm.className = `button ${destructive ? "button-danger" : "button-primary"}`;
    elements.confirmDialog.hidden = false;
    dialogPreviousFocus = document.activeElement;
    elements.dialogCancel.focus();

    return new Promise((resolve) => {
      dialogResolver = resolve;
    });
  }

  function confirmRemoval(title, description) {
    return confirmAction({
      title,
      description,
      confirmLabel: "Elimina",
      destructive: true
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
        validateSourceFile(file, type);
        queueItem.status.textContent = isPdfFile(file)
          ? "Conversione PDF ad alta qualità…"
          : "Ottimizzazione in corso…";

        const sourceIsPdf = isPdfFile(file);
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
          const poster = { file: filename };

          if (sourceIsPdf) {
            const pdfFilename = filename.replace(/\.[^.]+$/, ".pdf");
            state.uploads.set(`${mediaRoot}/${pdfFilename}`, file);
            poster.pdf = pdfFilename;
          }

          list.unshift(poster);
        }

        queueItem.image.src = previewUrl;
        queueItem.status.textContent = sourceIsPdf
          ? `Pronto · anteprima ${formatBytes(processed.blob.size)} + PDF originale`
          : `Pronto · ${formatBytes(processed.blob.size)}`;
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

  function isPdfFile(file) {
    return file.type === PDF_TYPE || file.name.toLowerCase().endsWith(".pdf");
  }

  function validateSourceFile(file, type) {
    const isPdf = isPdfFile(file);

    if (isPdf && type !== "posters") {
      throw new Error("I PDF possono essere usati soltanto per le locandine.");
    }

    if (!isPdf && !SUPPORTED_TYPES.has(file.type)) {
      throw new Error("Formato non supportato. Usa PDF, JPG, PNG o WebP.");
    }

    const sizeLimit = isPdf ? MAX_PDF_SIZE : MAX_SOURCE_SIZE;
    if (file.size > sizeLimit) {
      throw new Error(`Il file supera il limite di ${isPdf ? 25 : 12} MB.`);
    }
  }

  async function optimizeImage(file, type) {
    if (isPdfFile(file)) {
      return renderPdfPoster(file);
    }

    const bitmap = await createImageBitmap(file);
    const maxDimension = type === "gallery" ? 2400 : 3600;
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
    const quality = type === "gallery" ? 0.86 : 0.97;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));

    if (!blob) {
      throw new Error("Il browser non è riuscito a convertire l’immagine.");
    }

    return {
      blob,
      extension: type === "gallery" ? "webp" : "jpg"
    };
  }

  async function renderPdfPoster(file) {
    if (!PDF_LIBRARY) {
      throw new Error("Il convertitore PDF non è disponibile. Ricarica la pagina e riprova.");
    }

    const documentTask = PDF_LIBRARY.getDocument({
      data: await file.arrayBuffer()
    });
    const pdf = await documentTask.promise;

    try {
      const page = await pdf.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const targetLongSide = 3600;
      const scale = Math.min(6, targetLongSide / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
        background: "#ffffff"
      }).promise;

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.97)
      );

      if (!blob) {
        throw new Error("Il browser non è riuscito a convertire il PDF.");
      }

      return {
        blob,
        extension: "jpg"
      };
    } finally {
      await pdf.destroy();
    }
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
    if (!getChangeCount() || state.isPublishing || state.isRefreshing) return;

    const invalidTextField = elements.siteContentEditor.querySelector(".site-content-field:invalid");
    if (invalidTextField) {
      switchTab("texts");
      invalidTextField.reportValidity();
      invalidTextField.focus();
      showNotice(
        "Completa il campo evidenziato prima di pubblicare.",
        "error",
        "Testo mancante"
      );
      return;
    }

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
      const siteContentChanged =
        stableJson(state.siteContent) !== stableJson(state.initialSiteContent);

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

      if (siteContentChanged) {
        const created = await createBlob(
          `${JSON.stringify(state.siteContent, null, 2)}\n`,
          "utf-8"
        );
        treeEntries.push({
          path: config.siteContentJsonPath,
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
      state.initialSiteContent = cloneJson(state.siteContent);
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
    const siteContentChanged =
      stableJson(state.siteContent) !== stableJson(state.initialSiteContent);

    if (siteContentChanged && (galleryChanged || postersChanged)) return "Aggiorna contenuti del sito";
    if (galleryChanged && postersChanged) return "Aggiorna gallery e locandine";
    if (galleryChanged) return "Aggiorna gallery";
    if (postersChanged) return "Aggiorna locandine";
    if (siteContentChanged) return "Aggiorna testi del sito";
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
    elements.refreshButton.addEventListener("click", refreshWorkspace);
    elements.publishButton.addEventListener("click", publishChanges);
    elements.galleryTab.addEventListener("click", () => switchTab("gallery"));
    elements.postersTab.addEventListener("click", () => switchTab("posters"));
    elements.textsTab.addEventListener("click", () => switchTab("texts"));
    const tabs = [
      ["gallery", elements.galleryTab],
      ["posters", elements.postersTab],
      ["texts", elements.textsTab]
    ];
    tabs.forEach(([name, tab], index) => {
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const [nextName, nextTab] = tabs[(index + direction + tabs.length) % tabs.length];
        switchTab(nextName);
        nextTab.focus();
      });
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
