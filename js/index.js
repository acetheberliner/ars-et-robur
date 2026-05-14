const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const navbar = $("#navbar");
const menuBtn = $("#menuBtn");
const mobileMenu = $("#mobileMenu");
const lightbox = $("#lightbox");
const lightboxImage = $("#lightboxImage");
const lightboxClose = $("#lightboxClose");

function updateNavbar() {
  navbar?.classList.toggle("is-scrolled", window.scrollY > 24);
}

function toggleMobileMenu() {
  mobileMenu?.classList.toggle("is-open");

  const icon = menuBtn?.querySelector("i");
  if (!icon) return;

  icon.setAttribute(
    "data-lucide",
    mobileMenu.classList.contains("is-open") ? "x" : "menu"
  );

  lucide.createIcons();
}

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { threshold: 0.14 });

  $$(".reveal").forEach((el) => observer.observe(el));
}

function openLightbox(src, alt) {
  if (!lightbox || !lightboxImage) return;

  lightboxImage.src = src;
  lightboxImage.alt = alt || "";
  lightbox.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!lightbox || !lightboxImage) return;

  lightbox.classList.remove("is-open");
  document.body.style.overflow = "";

  setTimeout(() => {
    lightboxImage.src = "";
  }, 250);
}

function initGallery() {
  $$(".gallery-card").forEach((card) => {
    card.addEventListener("click", () => {
      const img = card.querySelector("img");
      openLightbox(card.dataset.src || img?.src, img?.alt);
    });
  });
}

const pdfLightbox = $("#pdfLightbox");
const pdfLightboxClose = $("#pdfLightboxClose");
const pdfFrame = $("#pdfFrame");

function openPdfLightbox(src) {
  if (!pdfLightbox || !pdfFrame || !src) return;

  pdfFrame.src = src;
  pdfLightbox.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closePdfLightbox() {
  if (!pdfLightbox || !pdfFrame) return;

  pdfLightbox.classList.remove("is-open");
  document.body.style.overflow = "";

  setTimeout(() => {
    pdfFrame.src = "";
  }, 250);
}

function initPdfLightbox() {
  $$("[data-pdf]").forEach((item) => {
    item.addEventListener("click", () => {
      openPdfLightbox(item.dataset.pdf);
    });
  });

  pdfLightboxClose?.addEventListener("click", closePdfLightbox);

  pdfLightbox?.addEventListener("click", (event) => {
    if (event.target === pdfLightbox) closePdfLightbox();
  });
}

async function loadWeeklyPosters() {
  const grid = document.querySelector("#weeklyGrid");
  const section = document.querySelector("#uscite");

  if (!grid) return;

  try {
    const response = await fetch("./assets/weekly/posters.json");

    if (!response.ok) {
      throw new Error("posters.json non trovato");
    }

    const posters = await response.json();

    if (!posters.length) {
      if (section) section.style.display = "none";
      return;
    }

    grid.innerHTML = "";

    posters.forEach((poster) => {
      const card = document.createElement("button");

      card.type = "button";
      card.className = "weekly-card";
      card.dataset.src = `./assets/weekly/${poster.file}`;

      card.addEventListener("click", () => {
        openLightbox(card.dataset.src, poster.title || "Locandina uscita");
      });

      const img = document.createElement("img");

      img.src = `./assets/weekly/${poster.file}`;
      img.alt = poster.title || "Locandina uscita";
      img.loading = "lazy";

      // se il file non esiste, sparisce
      img.onerror = () => {
        card.remove();

        // se non rimane nessuna locandina, nasconde tutta la sezione
        if (!grid.children.length && section) {
          section.style.display = "none";
        }
      };

      card.appendChild(img);
      grid.appendChild(card);
    });

  } catch (error) {
    console.error("errore caricamento locandine:", error);

    if (section) {
      section.style.display = "none";
    }
  }
}

menuBtn?.addEventListener("click", toggleMobileMenu);
lightboxClose?.addEventListener("click", closeLightbox);

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLightbox();
});

$$('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", () => {
    mobileMenu?.classList.remove("is-open");
  });
});

window.addEventListener("scroll", updateNavbar, { passive: true });

updateNavbar();
initReveal();
initGallery();
initPdfLightbox();
loadWeeklyPosters();

if (window.lucide) lucide.createIcons();