document.addEventListener("DOMContentLoaded", () => {
  const headers = document.querySelectorAll(".accordion-header");

  headers.forEach(header => {
    header.addEventListener("click", () => {
      const openItem = document.querySelector(".accordion-content[style*='max-height']");
      const currentContent = header.nextElementSibling;

      if (openItem && openItem !== currentContent) {
        openItem.style.maxHeight = null;
      }

      if (currentContent.style.maxHeight) {
        currentContent.style.maxHeight = null;
      } else {
        currentContent.style.maxHeight = currentContent.scrollHeight + "px";
      }
    });
  });
});
