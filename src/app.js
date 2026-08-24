(() => {
  const data = window.GECKO_SITE_DATA;
  if (!data) {
    document.body.innerHTML = '<p class="fatal-error">找不到網站資料，請先執行 npm run build。</p>';
    return;
  }

  const { config, series } = data;
  const pets = new Map(config.pets.map((pet) => [pet.id, pet]));
  const petIds = [...pets.keys()];
  const query = new URLSearchParams(window.location.search);
  const initialPet = query.get("pet");

  const state = {
    pet: initialPet && petIds.includes(initialPet) ? initialPet : "all",
    from: /^\d{4}-\d{2}-\d{2}$/.test(query.get("from") || "") ? query.get("from") : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(query.get("to") || "") ? query.get("to") : "",
  };

  const elements = {
    profiles: document.querySelector("#pet-profiles"),
    petFilters: document.querySelector("#pet-filters"),
    dateFrom: document.querySelector("#date-from"),
    dateTo: document.querySelector("#date-to"),
    clear: document.querySelector("#clear-filters"),
    emptyClear: document.querySelector("#empty-clear"),
    timeline: document.querySelector("#timeline"),
    empty: document.querySelector("#empty-state"),
    count: document.querySelector("#result-count"),
    dialog: document.querySelector("#series-dialog"),
    dialogContent: document.querySelector("#dialog-content"),
    dialogClose: document.querySelector("#dialog-close"),
    imageViewer: document.querySelector("#image-viewer"),
    imageViewerPhoto: document.querySelector("#image-viewer-photo"),
    imageViewerCaption: document.querySelector("#image-viewer-caption"),
    imageViewerClose: document.querySelector("#image-viewer-close"),
  };

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatDate = (date) => date.replaceAll("-", ".");

  const mediaMarkup = (item, pet) => {
    if (item.coverSrc) {
      return `<img src="${escapeHtml(item.coverSrc)}" alt="${escapeHtml(`${pet.name}・${item.title}`)}" loading="lazy" decoding="async">`;
    }

    return `
      <div class="cover-placeholder cover-placeholder--${escapeHtml(pet.accent)}">
        <span>${escapeHtml(pet.name)}</span>
        <small>IMAGEKIT PHOTO</small>
      </div>`;
  };

  function renderProfiles() {
    elements.profiles.innerHTML = config.pets
      .map(
        (pet) => `
          <article class="pet-profile pet-profile--${escapeHtml(pet.accent)} glass-panel">
            <h2>${escapeHtml(pet.name)}</h2>
          </article>`,
      )
      .join("");
  }

  function renderPetFilters() {
    const allButton = `
      <button type="button" data-pet="all" aria-pressed="${state.pet === "all"}">
        All <span>${series.length}</span>
      </button>`;

    const petButtons = config.pets
      .map((pet) => {
        const count = series.filter((item) => item.pet === pet.id).length;
        return `
          <button type="button" data-pet="${escapeHtml(pet.id)}" aria-pressed="${state.pet === pet.id}">
            ${escapeHtml(pet.name)} <span>${count}</span>
          </button>`;
      })
      .join("");

    elements.petFilters.innerHTML = allButton + petButtons;
    elements.petFilters.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.pet = button.dataset.pet;
        renderPetFilters();
        renderTimeline();
      });
    });
  }

  function syncQuery() {
    const params = new URLSearchParams();
    if (state.pet !== "all") params.set("pet", state.pet);
    if (state.from) params.set("from", state.from);
    if (state.to) params.set("to", state.to);
    const next = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState({}, "", next);
  }

  function filteredSeries() {
    return series.filter((item) => {
      if (state.pet !== "all" && item.pet !== state.pet) return false;
      if (state.from && item.date < state.from) return false;
      if (state.to && item.date > state.to) return false;
      return true;
    });
  }

  function albumCard(item) {
    const pet = pets.get(item.pet);
    const tags = [pet.name]
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");
    const photoText = `${item.photoCount} ${item.photoCount === 1 ? "PHOTO" : "PHOTOS"}`;

    return `
      <article class="timeline-entry" data-pet="${escapeHtml(item.pet)}">
        <div class="timeline-date">
          <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</time>
          <span aria-hidden="true"></span>
        </div>
        <button class="album-card glass-panel" type="button" data-open-series="${escapeHtml(item.slug)}">
          <div class="album-cover">${mediaMarkup(item, pet)}</div>
          <div class="album-content">
            <div class="album-meta">${tags}${item.sample ? '<span class="sample-tag">SAMPLE</span>' : ""}</div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.summary)}</p>
            <div class="album-footer">
              <span>${photoText}</span>
              <span class="open-label">Open <b aria-hidden="true">↗</b></span>
            </div>
          </div>
        </button>
      </article>`;
  }

  function renderTimeline() {
    const visible = filteredSeries();
    let currentYear = "";
    const markup = [];

    for (const item of visible) {
      const year = item.date.slice(0, 4);
      if (year !== currentYear) {
        currentYear = year;
        markup.push(`<div class="year-divider"><span>${year}</span></div>`);
      }
      markup.push(albumCard(item));
    }

    elements.timeline.innerHTML = markup.join("");
    elements.timeline.hidden = visible.length === 0;
    elements.empty.hidden = visible.length !== 0;
    elements.count.textContent = `${visible.length} SERIES`;

    elements.timeline.querySelectorAll("[data-open-series]").forEach((button) => {
      button.addEventListener("click", () => openSeries(button.dataset.openSeries));
    });

    syncQuery();
  }

  function openSeries(slug) {
    const item = series.find((entry) => entry.slug === slug);
    if (!item) return;
    const pet = pets.get(item.pet);

    elements.dialogContent.innerHTML = `
      <article class="dialog-article" data-pet="${escapeHtml(item.pet)}">
        <header class="dialog-header">
          <p class="dialog-kicker">${escapeHtml(pet.name)}・${escapeHtml(formatDate(item.date))}</p>
          <h2 id="dialog-title">${escapeHtml(item.title)}</h2>
          <p>${escapeHtml(item.summary)}</p>
        </header>
        <div class="story-content">
          ${item.bodyHtml || '<p class="story-empty">No story yet.</p>'}
          ${item.photoCount === 0 ? '<div class="story-empty"><strong>NO PHOTOS YET</strong></div>' : ""}
        </div>
      </article>`;

    elements.dialog.showModal();
    elements.dialogContent.scrollTop = 0;

    elements.dialogContent.querySelectorAll(".story-photo img").forEach((image) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `放大照片：${image.alt}`);
      image.addEventListener("click", () => openImageViewer(image));
      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openImageViewer(image);
        }
      });
    });
  }

  function openImageViewer(image) {
    const caption = image.closest("figure")?.querySelector("figcaption")?.textContent || image.alt;
    elements.imageViewerPhoto.src = image.src;
    elements.imageViewerPhoto.alt = image.alt;
    elements.imageViewerCaption.textContent = caption;
    elements.imageViewer.hidden = false;
    elements.imageViewerClose.focus();
  }

  function closeImageViewer() {
    elements.imageViewer.hidden = true;
    elements.imageViewerPhoto.src = "";
  }

  function clearFilters() {
    state.pet = "all";
    state.from = "";
    state.to = "";
    elements.dateFrom.value = "";
    elements.dateTo.value = "";
    renderPetFilters();
    renderTimeline();
  }

  const dates = series.map((item) => item.date).sort();
  if (dates.length) {
    elements.dateFrom.min = dates[0];
    elements.dateFrom.max = dates.at(-1);
    elements.dateTo.min = dates[0];
    elements.dateTo.max = dates.at(-1);
  }

  elements.dateFrom.value = state.from;
  elements.dateTo.value = state.to;
  elements.dateFrom.addEventListener("change", () => {
    state.from = elements.dateFrom.value;
    if (state.to && state.from > state.to) {
      state.to = state.from;
      elements.dateTo.value = state.to;
    }
    renderTimeline();
  });

  elements.dateTo.addEventListener("change", () => {
    state.to = elements.dateTo.value;
    if (state.from && state.to < state.from) {
      state.from = state.to;
      elements.dateFrom.value = state.from;
    }
    renderTimeline();
  });

  elements.clear.addEventListener("click", clearFilters);
  elements.emptyClear.addEventListener("click", clearFilters);
  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  elements.imageViewerClose.addEventListener("click", closeImageViewer);
  elements.imageViewer.addEventListener("click", (event) => {
    if (event.target === elements.imageViewer) closeImageViewer();
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && !elements.imageViewer.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closeImageViewer();
      }
    },
    true,
  );

  renderProfiles();
  renderPetFilters();
  renderTimeline();
})();
