/* Robot FQA Static Site (MVP) - Delta + MS2 + DRAStudio Pro */

const state = {
  lang: "zh", // "zh" | "en"
  data: null,
  query: "",
  filter: { category: null, subcategory: null, faqId: null },
  expandedIds: new Set()
};

const els = {};
const $ = (id) => document.getElementById(id);

function normalizeText(s) {
  if (!s) return "";
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function debounce(fn, delay = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function getLangObj(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[state.lang] ?? obj.zh ?? obj.en ?? "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function clearTocActive() {
  document
    .querySelectorAll(".toc-link.active, .toc-q.active")
    .forEach(el => el.classList.remove("active"));
}

function setTocActiveByFilter() {
  clearTocActive();

  const { category, subcategory, faqId } = state.filter;

  // Priority: faqId > subcategory > category
  let selector = null;

  if (faqId) {
    selector = `.toc-q[data-id="${CSS.escape(faqId)}"]`;
  } else if (subcategory && category) {
    selector = `.toc-link[data-cat="${CSS.escape(category)}"][data-sub="${CSS.escape(subcategory)}"]`;
  } else if (category) {
    selector = `.toc-link[data-cat="${CSS.escape(category)}"][data-sub=""]`;
  }

  if (!selector) return;

  const el = document.querySelector(selector);
  if (el) {
    el.classList.add("active");

    // 確保在側欄可見
    el.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  }
}

function buildSearchHaystack(faq) {
  const fields = [
    // bilingual category/subcategory/question to support cross-language search
    faq.category?.zh || "", faq.category?.en || "",
    faq.subcategory?.zh || "", faq.subcategory?.en || "",
    faq.question?.zh || "", faq.question?.en || "",

    ...(faq.tags || []),
    ...(faq.keywords || []),
    ...(faq.errorCodes || []),

    ...(faq.symptoms ? [...(faq.symptoms.zh || []), ...(faq.symptoms.en || [])] : []),
    ...(faq.rootCauses ? [...(faq.rootCauses.zh || []), ...(faq.rootCauses.en || [])] : []),
    ...(faq.solutionSteps ? [...(faq.solutionSteps.zh || []), ...(faq.solutionSteps.en || [])] : []),
    ...(faq.notes ? [...(faq.notes.zh || []), ...(faq.notes.en || [])] : []),

    // image captions also searchable
    ...(faq.images ? faq.images.flatMap(img => [img.caption?.zh || "", img.caption?.en || ""]) : [])
  ];

  return normalizeText(fields.join(" | "));
}

function scoreFaq(faq, qNorm) {
  if (!qNorm) return 0;
  const q = qNorm;

  let score = 0;

  const errorCodes = (faq.errorCodes || []).map(normalizeText);
  const tags = (faq.tags || []).map(normalizeText);
  const keywords = (faq.keywords || []).map(normalizeText);

  const qZh = normalizeText(faq.question?.zh || "");
  const qEn = normalizeText(faq.question?.en || "");

  // 1) errorCodes exact / contains
  if (errorCodes.some((c) => c === q || c.includes(q))) score += 100;

  // 2) question match
  if (qZh.includes(q) || qEn.includes(q)) score += 60;

  // 3) tags
  if (tags.some((t) => t === q || t.includes(q))) score += 40;

  // 4) keywords
  if (keywords.some((k) => k === q || k.includes(q))) score += 25;

  // 5) broader content
  const hay = buildSearchHaystack(faq);
  if (hay.includes(q)) score += 10;

  // Bonus: multiple tokens
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    let hits = 0;
    for (const t of tokens) if (hay.includes(t)) hits++;
    score += Math.min(20, hits * 5);
  }

  return score;
}

function groupToTree(faqs) {
  const tree = new Map();
  for (const f of faqs) {
    const catKey = getLangObj(f.category);
    const subKey = getLangObj(f.subcategory) || "—";
    if (!tree.has(catKey)) tree.set(catKey, new Map());
    const subMap = tree.get(catKey);
    if (!subMap.has(subKey)) subMap.set(subKey, []);
    subMap.get(subKey).push(f);
  }
  return tree;
}

function countFaqsInSubMap(subMap) {
  let n = 0;
  for (const arr of subMap.values()) n += arr.length;
  return n;
}

function renderSubcategories(cat, subMap) {
  const parts = [];

  // category-level filter
  parts.push(`
    <div class="toc-sub">
      <button class="toc-link" data-action="filter"
              data-cat="${escapeHtml(cat)}" data-sub="" data-id="">
        查看全部：${escapeHtml(cat)}
      </button>
    </div>
  `);

  for (const [sub, faqs] of subMap.entries()) {
    parts.push(`
      <div class="toc-sub">
        <button class="toc-link" data-action="filter"
                data-cat="${escapeHtml(cat)}" data-sub="${escapeHtml(sub)}" data-id="">
          ${escapeHtml(sub)}
          <span class="toc-count small">${faqs.length}</span>
        </button>
        <div class="toc-questions">
          ${faqs.map(f => `
            <button class="toc-q" data-action="filter"
                    data-cat="${escapeHtml(cat)}" data-sub="${escapeHtml(sub)}" data-id="${escapeHtml(f.id)}">
              ${escapeHtml(getLangObj(f.question))}
            </button>
          `).join("")}
        </div>
      </div>
    `);
  }

  return parts.join("");
}

function renderTOC(faqsForToc) {
  const toc = els.toc;
  const tree = groupToTree(faqsForToc);

  const html = [];
  for (const [cat, subMap] of tree.entries()) {
    html.push(`
      <details class="toc-cat" open>
        <summary class="toc-cat-summary">
          <span class="toc-cat-title">${escapeHtml(cat)}</span>
          <span class="toc-count">${countFaqsInSubMap(subMap)}</span>
        </summary>
        <div class="toc-sublist">
          ${renderSubcategories(cat, subMap)}
        </div>
      </details>
    `);
  }

  toc.innerHTML = html.join("") || `<div class="muted">目前沒有可顯示的目錄。</div>`;

  toc.querySelectorAll("[data-action='filter']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.getAttribute("data-cat") || "";
      const sub = btn.getAttribute("data-sub") || "";
      const id = btn.getAttribute("data-id") || "";
      applyFilterAndAnchor({
        category: cat || null,
        subcategory: sub || null,
        faqId: id || null
      });
    });
  });
}

function setActiveFilterText() {
  const { category, subcategory, faqId } = state.filter;
  const parts = [];
  if (category) parts.push(category);
  if (subcategory) parts.push(subcategory);
  if (faqId) parts.push(`#${faqId}`);
  els.activeFilter.textContent = parts.length ? `目前篩選：${parts.join(" / ")}` : "";
}

function section(labelZh, labelEn, items) {
  const label = state.lang === "zh" ? labelZh : labelEn;
  if (!items || !items.length) return "";
  return `
    <div class="faq-section">
      <div class="faq-section-title">${escapeHtml(label)}</div>
      <ul class="faq-ul">
        ${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderFaqList(faqsVisible) {
  const list = els.faqList;

  if (!faqsVisible.length) {
    list.innerHTML = "";
    els.noResults.classList.remove("hidden");
    els.resultMeta.textContent = "";
    return;
  }
  els.noResults.classList.add("hidden");

  const html = faqsVisible.map((faq) => {
    const isOpen = state.expandedIds.has(faq.id);
    const anchorId = `faq_${faq.id}`;

    const title = getLangObj(faq.question);
    const cat = getLangObj(faq.category);
    const sub = getLangObj(faq.subcategory);

    const errCodes = (faq.errorCodes || [])
      .map((c) => `<span class="pill danger">${escapeHtml(c)}</span>`)
      .join("");

    const tags = (faq.tags || [])
      .slice(0, 8)
      .map((t) => `<span class="pill">${escapeHtml(t)}</span>`)
      .join("");

    const updated = faq.lastUpdated
      ? `<span class="muted">更新：${escapeHtml(faq.lastUpdated)}</span>`
      : "";

    const symptoms = faq.symptoms?.[state.lang] || [];
    const causes = faq.rootCauses?.[state.lang] || [];
    const steps = faq.solutionSteps?.[state.lang] || [];
    const notes = faq.notes?.[state.lang] || [];

    const related = (faq.relatedFaqIds || []).filter(Boolean);

    const images = (faq.images || []);

    const imagesBlock = images.length ? `
      <div class="faq-section">
        <div class="faq-section-title">${escapeHtml(state.lang === "zh" ? "圖片" : "Images")}</div>
        <div class="img-grid">
          ${images.map(img => `
            <figure class="img-item">
              <img class="img-thumb"
                   src="${escapeHtml(img.dataUrl)}"
                   alt="${escapeHtml(getLangObj(img.caption))}"
                   data-action="img"
                   data-src="${escapeHtml(img.dataUrl)}"
                   data-cap="${escapeHtml(getLangObj(img.caption))}" />
              <figcaption class="img-cap">${escapeHtml(getLangObj(img.caption))}</figcaption>
            </figure>
          `).join("")}
        </div>
      </div>
    ` : "";

    return `
      <article class="faq-card" id="${escapeHtml(anchorId)}" data-faqid="${escapeHtml(faq.id)}"
               data-category="${escapeHtml(cat)}" data-subcategory="${escapeHtml(sub)}">
        <button class="faq-head" type="button" aria-expanded="${isOpen ? "true" : "false"}"
                data-action="toggle" data-id="${escapeHtml(faq.id)}">
          <div class="faq-title">
            <span class="faq-q">Q</span>
            <span>${escapeHtml(title)}</span>
          </div>
          <div class="faq-meta">
            <span class="pill subtle">${escapeHtml(cat)}</span>
            <span class="pill subtle">${escapeHtml(sub)}</span>
            ${errCodes}
            ${updated}
          </div>
        </button>

        <div class="faq-body ${isOpen ? "" : "hidden"}" data-body="${escapeHtml(faq.id)}">
          <div class="faq-pills">${tags}</div>

          ${section("症狀", "Symptoms", symptoms)}
          ${section("可能原因（分析）", "Possible Root Causes (Analysis)", causes)}
          ${section("解決步驟", "Solution Steps", steps)}
          ${section("注意事項", "Notes", notes)}

          ${imagesBlock}

          ${related.length ? `
            <div class="faq-section">
              <div class="faq-section-title">${escapeHtml(state.lang === "zh" ? "相關問題" : "Related FAQs")}</div>
              <div class="related">
                ${related.map((rid) => `
                  <button class="link-btn" type="button" data-action="jump" data-id="${escapeHtml(rid)}">
                    #${escapeHtml(rid)}
                  </button>
                `).join("")}
              </div>
            </div>
          ` : ""}

          <div class="faq-actions">
            <button class="btn small" type="button" data-action="copy" data-id="${escapeHtml(faq.id)}">
              ${escapeHtml(state.lang === "zh" ? "複製解法" : "Copy Solution")}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  list.innerHTML = html;

  // Bind actions
  list.querySelectorAll("[data-action='toggle']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      toggleFaq(id);
    });
  });

  list.querySelectorAll("[data-action='jump']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      applyFilterAndAnchor({ category: null, subcategory: null, faqId: id }, true);
    });
  });

  list.querySelectorAll("[data-action='copy']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const faq = state.data.faqs.find((f) => f.id === id);
      if (!faq) return;

      const lines = [];
      lines.push(`Q: ${getLangObj(faq.question)}`);

      const steps = faq.solutionSteps?.[state.lang] || [];
      if (steps.length) {
        lines.push(state.lang === "zh" ? "解決步驟：" : "Solution Steps:");
        steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      }
      const codes = faq.errorCodes || [];
      if (codes.length) {
        lines.push(`${state.lang === "zh" ? "錯誤碼" : "Error Codes"}: ${codes.join(", ")}`);
      }

      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        btn.textContent = state.lang === "zh" ? "已複製" : "Copied";
        setTimeout(() => (btn.textContent = state.lang === "zh" ? "複製解法" : "Copy Solution"), 900);
      } catch {
        alert(state.lang === "zh" ? "無法複製（瀏覽器權限限制）" : "Copy failed (browser permission).");
      }
    });
  });

  list.querySelectorAll("[data-action='img']").forEach((imgEl) => {
    imgEl.addEventListener("click", () => {
      openLightbox(imgEl.getAttribute("data-src"), imgEl.getAttribute("data-cap"));
    });
  });

  // Meta
  els.resultMeta.textContent = state.lang === "zh"
    ? `顯示 ${faqsVisible.length} 筆`
    : `Showing ${faqsVisible.length} items`;
}

function toggleFaq(id) {
  if (!id) return;
  if (state.expandedIds.has(id)) state.expandedIds.delete(id);
  else state.expandedIds.add(id);
  rerender();
}

function expandAll() {
  state.data.faqs.forEach(f => state.expandedIds.add(f.id));
  rerender();
}

function collapseAll() {
  state.expandedIds.clear();
  rerender();
}

function applyFilterAndAnchor({ category, subcategory, faqId }, keepQuery = false) {
  state.filter.category = category || null;
  state.filter.subcategory = subcategory || null;
  state.filter.faqId = faqId || null;

  // keepQuery means do not change search; directory click combines with search naturally
  if (!keepQuery) { /* noop */ }

  setActiveFilterText();
  rerender(() => {
    let target = null;

    if (state.filter.faqId) {
      target = document.querySelector(`#faq_${CSS.escape(state.filter.faqId)}`);
    } else if (state.filter.subcategory) {
      target = [...document.querySelectorAll(".faq-card")].find(
        el => el.getAttribute("data-subcategory") === state.filter.subcategory
      );
    } else if (state.filter.category) {
      target = [...document.querySelectorAll(".faq-card")].find(
        el => el.getAttribute("data-category") === state.filter.category
      );
    }

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("flash");
      setTimeout(() => target.classList.remove("flash"), 650);
    }
  });
}

function resetFilter() {
  state.filter = { category: null, subcategory: null, faqId: null };
  setActiveFilterText();
  rerender();
}

function filterFaqs() {
  const q = normalizeText(state.query);
  const all = state.data.faqs.slice();

  // directory filter
  let filtered = all;
  if (state.filter.category) {
    filtered = filtered.filter((f) => getLangObj(f.category) === state.filter.category);
  }
  if (state.filter.subcategory) {
    filtered = filtered.filter((f) => getLangObj(f.subcategory) === state.filter.subcategory);
  }
  if (state.filter.faqId) {
    filtered = filtered.filter((f) => f.id === state.filter.faqId);
  }

  // search filter
  if (q) {
    filtered = filtered
      .map((f) => ({ f, s: scoreFaq(f, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => {
        if (b.s !== a.s) return b.s - a.s;
        return normalizeText(b.f.lastUpdated || "").localeCompare(normalizeText(a.f.lastUpdated || ""));
      })
      .map((x) => x.f);
  } else {
    filtered.sort((a, b) => {
      const ca = normalizeText(getLangObj(a.category));
      const cb = normalizeText(getLangObj(b.category));
      if (ca !== cb) return ca.localeCompare(cb);

      const sa = normalizeText(getLangObj(a.subcategory));
      const sb = normalizeText(getLangObj(b.subcategory));
      if (sa !== sb) return sa.localeCompare(sb);

      return normalizeText(b.lastUpdated || "").localeCompare(normalizeText(a.lastUpdated || ""));
    });
  }

  return filtered;
}

function rerender(afterRender) {
  const visible = filterFaqs();

  // TOC strategy:
  // - If there are visible results, TOC follows visible set
  // - If none (no results), show full TOC
  const tocSet = visible.length ? visible : state.data.faqs;
  renderTOC(tocSet);
  renderFaqList(visible);
  setTocActiveByFilter();
  
  if (typeof afterRender === "function") afterRender();
}

/* Lightbox (image viewer) */
function openLightbox(src, caption) {
  let box = document.querySelector(".lightbox");
  if (!box) {
    box = document.createElement("div");
    box.className = "lightbox hidden";
    box.innerHTML = `
      <div class="lightbox-backdrop" data-action="close"></div>
      <div class="lightbox-panel" role="dialog" aria-modal="true">
        <button class="lightbox-close" type="button" data-action="close">✕</button>
        <img class="lightbox-img" alt="" />
        <div class="lightbox-cap muted"></div>
      </div>
    `;
    document.body.appendChild(box);

    box.addEventListener("click", (e) => {
      const a = e.target.getAttribute?.("data-action");
      if (a === "close") closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLightbox();
    });
  }

  box.querySelector(".lightbox-img").src = src;
  box.querySelector(".lightbox-cap").textContent = caption || "";
  box.classList.remove("hidden");
}

function closeLightbox() {
  const box = document.querySelector(".lightbox");
  if (box) box.classList.add("hidden");
}

async function init() {
  els.searchInput = $("searchInput");
  els.clearBtn = $("clearBtn");
  els.resetFilterBtn = $("resetFilterBtn");
  els.expandAllBtn = $("expandAllBtn");
  els.collapseAllBtn = $("collapseAllBtn");
  els.toc = $("toc");
  els.faqList = $("faqList");
  els.noResults = $("noResults");
  els.activeFilter = $("activeFilter");
  els.resultMeta = $("resultMeta");

  // Load data
  const res = await fetch("./assets/faqs.json", { cache: "no-store" });
  state.data = await res.json();

  // Default collapsed
  state.expandedIds.clear();

  // Search
  const onSearch = debounce(() => {
    state.query = els.searchInput.value || "";
    rerender();
  }, 200);
  els.searchInput.addEventListener("input", onSearch);

  els.clearBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    state.query = "";
    rerender();
    els.searchInput.focus();
  });

  els.resetFilterBtn.addEventListener("click", resetFilter);
  els.expandAllBtn.addEventListener("click", expandAll);
  els.collapseAllBtn.addEventListener("click", collapseAll);

  // Language toggle
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.lang = btn.getAttribute("data-lang") || "zh";
      rerender();
    });
  });

  setActiveFilterText();
  rerender();
}

document.addEventListener("DOMContentLoaded", init);
