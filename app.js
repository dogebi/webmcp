// WebMCP 가이드의 API 탭, 코드 복사, 이미지 미리보기를 관리합니다.
const tabs = [...document.querySelectorAll("[role='tab']")];
const panels = [...document.querySelectorAll("[role='tabpanel']")];
const dialog = document.querySelector(".image-dialog");
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

document.querySelectorAll("[data-image]").forEach((button) => {
  button.addEventListener("click", () => {
    const image = dialog.querySelector("img");
    image.src = button.dataset.image;
    image.alt = button.querySelector("img").alt;
    dialog.querySelector("figcaption").textContent = button.dataset.caption;
    dialog.showModal();
  });
});

dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  const image = dialog.querySelector("img");
  image.removeAttribute("src");
});
