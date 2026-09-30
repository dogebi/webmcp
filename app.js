// WebMCP 가이드의 API 탭, 도식 로딩과 섹션 이동을 관리합니다.
const tabs = [...document.querySelectorAll("[role='tab']")];
const panels = [...document.querySelectorAll("[role='tabpanel']")];
const toast = document.querySelector(".toast");
let toastTimer;

function announce(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function selectTab(tab) {
  tabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  panels.forEach((panel) => {
    panel.hidden = panel.id !== tab.getAttribute("aria-controls");
  });
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + tabs.length - 1) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    selectTab(tabs[next]);
    tabs[next].focus();
  });
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const code = document.querySelector(`#${button.dataset.copy} code`);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent);
      announce("코드를 복사했습니다.");
    } catch {
      announce("브라우저에서 클립보드 접근을 허용하지 않았습니다.");
    }
  });
});

function revealDiagram(frame) {
  const page = frame.contentDocument;
  if (!page?.querySelector("svg")) return;
  const embed = frame.parentElement;
  embed.style.height = "380px";
  embed.style.height = `${Math.max(380, page.documentElement.scrollHeight + 8)}px`;
  embed.classList.add("is-ready");
}

document.querySelectorAll(".archify-diagram").forEach((frame) => {
  frame.addEventListener("load", () => revealDiagram(frame));
});
window.addEventListener("resize", () => {
  document.querySelectorAll(".archify-diagram").forEach(revealDiagram);
});

const rail = document.querySelector(".section-rail");
const sectionLinks = [...rail.querySelectorAll("a:not(.back-to-top)")];
const sections = sectionLinks.map((link) => document.querySelector(link.getAttribute("href")));
let scrollPending = false;

function updateSectionRail() {
  rail.classList.toggle("is-visible", window.scrollY > 320);
  const marker = Math.min(window.innerHeight * 0.3, 220);
  let current = -1;
  sections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= marker) current = index;
  });
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
    current = sections.length - 1;
  }
  sectionLinks.forEach((link, index) => {
    if (index === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  scrollPending = false;
}

window.addEventListener("scroll", () => {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(updateSectionRail);
}, { passive: true });
window.addEventListener("resize", updateSectionRail);
window.addEventListener("load", updateSectionRail);
updateSectionRail();
