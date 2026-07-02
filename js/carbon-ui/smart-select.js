class CarbonSmartSelect {
  constructor(inputId, data, config = {}) {
    this.input = document.getElementById(inputId);
    this.data = data || [];
    this.config = config;
    this.activeIndex = -1;

    if (!this.input) return;

    this.init();
  }

  init() {
    this.input.setAttribute("autocomplete", "off");

    this.wrapper = document.createElement("div");
    this.wrapper.className = "ca-select";

    this.input.parentNode.insertBefore(this.wrapper, this.input);
    this.wrapper.appendChild(this.input);

    this.dropdown = document.createElement("div");
    this.dropdown.className = "ca-select-dropdown";
    this.wrapper.appendChild(this.dropdown);

    this.input.addEventListener("input", () => this.search());
    this.input.addEventListener("focus", () => this.search());

    this.input.addEventListener("keydown", (e) => {
      const items = this.dropdown.querySelectorAll(".ca-select-item");

      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
        this.highlight(items);
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, 0);
        this.highlight(items);
      }

      if (e.key === "Enter") {
        if (this.dropdown.classList.contains("active") && this.activeIndex >= 0) {
          e.preventDefault();
          items[this.activeIndex].click();
        }
      }

      if (e.key === "Escape") {
        this.close();
      }
    });

    document.addEventListener("click", (e) => {
      if (!this.wrapper.contains(e.target)) {
        this.close();
      }
    });
  }

  getLabel(item) {
    return typeof item === "string" ? item : item.name;
  }

  search() {
    const value = this.input.value.toLowerCase().trim();
    this.dropdown.innerHTML = "";
    this.activeIndex = -1;

    if (!value) {
      this.close();
      return;
    }

    const results = this.data
      .filter((item) => {
        const label = this.getLabel(item).toLowerCase();
        return label.includes(value);
      })
      .slice(0, 10);

    if (!results.length) {
      this.close();
      return;
    }

    results.forEach((item) => this.renderItem(item));
    this.open();
  }

  renderItem(item) {
    const label = this.getLabel(item);

    const row = document.createElement("div");
    row.className = "ca-select-item";

    if (item.flag || item.code) {
      row.innerHTML = `
        <span class="ca-select-left">
          <span class="ca-select-flag">${item.flag || ""}</span>
          <span>${label}</span>
        </span>
        <span class="ca-select-code">${item.code || ""}</span>
      `;
    } else {
      row.innerText = label;
    }

    row.addEventListener("click", () => {
      this.input.value = label;
      this.close();

      if (this.config.onSelect) {
        this.config.onSelect(item);
      }
    });

    this.dropdown.appendChild(row);
  }

  highlight(items) {
    items.forEach((item) => item.classList.remove("active"));

    if (items[this.activeIndex]) {
      items[this.activeIndex].classList.add("active");
    }
  }

  open() {
    this.dropdown.classList.add("active");
  }

  close() {
    this.dropdown.classList.remove("active");
    this.activeIndex = -1;
  }
}