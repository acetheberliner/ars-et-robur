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

if (window.lucide) lucide.createIcons();