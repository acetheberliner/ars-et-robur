const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const navbar = $("#navbar");
const menuBtn = $("#menuBtn");
const mobileMenu = $("#mobileMenu");
const lightbox = $("#lightbox");
const lightboxImage = $("#lightboxImage");
const lightboxClose = $("#lightboxClose");

const brandLogo = document.querySelector("#brandLogo");

const whiteLogo = "./assets/images/LogoArs-removebg.webp";
const blackLogo = "./assets/images/Ars_tras.webp";

function updateNavbar() {
  const isScrolled = window.scrollY > 20;

  navbar.classList.toggle("is-scrolled", isScrolled);

  if (brandLogo) {
    brandLogo.src = isScrolled
      ? blackLogo
      : whiteLogo;
  }
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

async function loadGallery() {
  const track = document.querySelector("#galleryTrack");
  const prev = document.querySelector("#galleryPrev");
  const next = document.querySelector("#galleryNext");

  if (!track) return;

  try {
    const response = await fetch("./assets/gallery/gallery.json");

    if (!response.ok) {
      throw new Error("gallery.json non trovato");
    }

    const images = await response.json();

    if (!images.length) return;

   // --- RIGA AGGIUNTA: Mescola le immagini in modo casuale ---
    images.sort(() => Math.random() - 0.5);
    // ---------------------------------------------------------

    track.innerHTML = "";

    images.forEach((image) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "gallery-card";
      card.dataset.src = `./assets/gallery/${image.file}`;

      const img = document.createElement("img");
      img.src = `./assets/gallery/${image.file}`;
      img.alt = image.alt || "foto ars et robur";
      img.loading = "lazy";

      img.onerror = () => {
        card.remove();
      };

      card.appendChild(img);
      track.appendChild(card);
    });

    track.querySelectorAll(".gallery-card").forEach((card) => {
      card.addEventListener("click", () => {
        openLightbox(card.dataset.src, card.querySelector("img")?.alt || "");
      });
    });

    const getStep = () => {
      const firstCard = track.querySelector(".gallery-card");
      if (!firstCard) return 320;

      const gap = parseInt(getComputedStyle(track).gap || 22, 10);
      return firstCard.offsetWidth + gap;
    };

    const scrollGallery = (direction) => {
      const left = track.scrollLeft + (getStep() * direction);

      if (typeof track.scrollTo === "function") {
        track.scrollTo({ left, behavior: "smooth" });
        return;
      }

      track.scrollLeft = left;
    };

    prev?.addEventListener("click", () => {
      scrollGallery(-1);
    });

    next?.addEventListener("click", () => {
      scrollGallery(1);
    });

// --- ABILITA LO SCORRIMENTO CON LE DITA (TOUCH SWIPE) ---
    let isDown = false;
    let startX;
    let scrollLeft;

    track.addEventListener("touchstart", (e) => {
      isDown = true;
      // Registra la posizione iniziale del dito e dello scroll attuale
      startX = e.touches[0].pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    }, { passive: true });

    track.addEventListener("touchend", () => {
      isDown = false;
    });

    track.addEventListener("touchmove", (e) => {
      if (!isDown) return;
      
      // Calcola quanto si è spostato il dito
      const x = e.touches[0].pageX - track.offsetLeft;
      const walk = (x - startX) * 1.5; // Il moltiplicatore (1.5) regola la reattività
      
      // Aggiorna lo scroll della galleria
      track.scrollLeft = scrollLeft - walk;
    }, { passive: true });
    // --------------------------------------------------------

  } catch (error) {
    console.error("errore caricamento gallery:", error);
  }
}

async function loadSponsors() {
  const track = document.querySelector("#sponsorTrack");

  if (!track) return;

  try {
    const response = await fetch("./assets/images/sponsor/sponsor.json");

    if (!response.ok) {
      throw new Error("sponsor.json non trovato");
    }

    const sponsors = await response.json();

    if (!sponsors.length) return;

    const duplicatedSponsors = [...sponsors, ...sponsors];

    track.innerHTML = "";

    duplicatedSponsors.forEach((sponsor) => {
      const logo = document.createElement("div");
      logo.className = "sponsor-logo";

      const img = document.createElement("img");
      img.src = `./assets/images/sponsor/${sponsor.file}`;
      img.alt = sponsor.alt || "Logo sponsor";
      img.loading = "eager";
      img.decoding = "async";

      img.onerror = () => {
        logo.remove();
      };

      logo.appendChild(img);
      track.appendChild(logo);
    });

    startSponsorMarquee(track);
  } catch (error) {
    console.error("errore caricamento sponsor:", error);
  }
}

function startSponsorMarquee(track) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let position = 0;
  let previousTime = performance.now();
  let frameId;

  const getLimit = () => track.scrollWidth / 2;

  const animate = (currentTime) => {
    const elapsed = currentTime - previousTime;
    const speed = window.matchMedia("(max-width: 640px)").matches ? 110 : 72;
    const limit = getLimit();

    previousTime = currentTime;
    position = limit ? (position + (elapsed * speed / 1000)) % limit : 0;
    track.style.transform = `translate3d(${-position}px, 0, 0)`;
    frameId = requestAnimationFrame(animate);
  };

  const restart = () => {
    cancelAnimationFrame(frameId);
    position = 0;
    previousTime = performance.now();
    track.style.animation = "none";
    track.style.transform = "translate3d(0, 0, 0)";
    frameId = requestAnimationFrame(animate);
  };

  restart();
  window.addEventListener("resize", restart);
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

// -------------------------------------------------------
updateNavbar();

initReveal();

initGallery();

initPdfLightbox();

window.addEventListener("load", () => {
  loadWeeklyPosters();
  loadGallery();
  loadSponsors();
});

if (window.lucide) lucide.createIcons();
