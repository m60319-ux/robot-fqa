/* Robot FQA Static Site (MVP) - Simplified i18n (zh / en) */

const state = {
  lang: "zh", // "zh" | "en"
  data: null,
  query: "",
  filter: { category: null, subcategory: null, faqId: null },
  expandedIds: new Set(),
};

const els = {};
const $ = (id) => document.getElementById(id);

function normalizeText(s) {
  if (!s) return "";
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}

function debounce(fn, delay = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/** Backward-compatible text getter:
 * - string -> string
 * - object -> obj[lang] || obj.zh || obj.en || ""
 */
function getLangObj(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[state.lang] ?? obj.zh ?? obj.en ?? "";
}

/** Backward-compatible list getter:
 * - array -> array
 * - object -> obj[lang] || obj.zh || obj.en || []
 */
function getLangList(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (typeof obj === "object") return obj[state.lang] ?? obj.zh ?? obj.en ?? [];
  return [];
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** UI text i18n (interface labels only) */
const UI = {
  zh: {
    toc: "目錄",
    reset: "重置",
    clearFilter: "清除篩選",
    expandAll: "展開全部",
    collapseAll: "收合全部",
    noResultsTitle: "找不到結果",
    noResultsHint: "請嘗試不同關鍵字，或清除篩選。",
    showing: (n) => `顯示 ${n} 筆`,
    filtered: (n, t) => `顯示 ${n} / ${t} 筆`,
    copy: "複製解法",
    copied: "已複製",
    images: "圖片",
    related: "相關問題",
    updated: (d) => `更新：${d}`,
    tocEmpty: "目前沒有可顯示的目錄。",
    viewAll: (cat) => `查看全部：${cat}`,
    searchPh: "搜尋…",
    solutionStepsLabel: "解決步驟：",
    copyFail: "無法複製（瀏覽器權限限制）",
  },
  en: {
    toc: "Contents",
    reset: "Reset",
    clearFilter: "Clear filter",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    noResultsTitle: "No results",
    noResultsHint: "Try another keyword, or clear filters.",
    showing: (n) => `Showing ${n} items`,
    filtered: (n, t) => `Showing ${n} / ${t}`,
    copy: "Copy Solution",
    copied: "Copied",
    images: "Images",
    related: "Related FAQs",
    updated: (d) => `Updated: ${d}`,
    tocEmpty: "No table of contents to show.",
    viewAll: (cat) => `View all: ${cat}`,
    searchPh: "Search…",
    solutionStepsLabel: "Solution Steps:",
    copyFail: "Copy failed (browser permission).",
  },
};

function ui() {
  return UI[state.lang] ?? UI.zh;
}

/** localStorage */
const LANG_KEY = "robot_fqa_lang_v1";

function normalizeLang(v) {
  return v === "en" ? "en" : "zh";
}

function loadLang() {
  const v = localStorage.getItem(LANG_KEY);
  return normalizeLang(v);
}

function saveLang(v) {
  localStorage.setItem(LANG_KEY, normalizeLang(v));
}

/** Fetch JSON */
async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return await res.json();
}

/** Load data: simplified files */
async function loadDataForLang(lang) {
  const l = normalizeLang(lang);
  const url = l === "en" ? "./assets/faqs.en.json" : "./assets/faqs.zh.json";
  return await fetchJson(url);
}

function clearTocActive() {
  document
    .querySelectorAll(".toc-link.active, .toc-q.active")
    .forEach((el) => el.classList.remove("active"));
}

function setTocActiveByFilter() {
  clearTocActive();
  const { category, subcategory, faqId } = state.filter;
  let selector = null;

  if (faqId) {
    selector = `.toc-q[data-id="${CSS.escape(faqId)}"]`;
  } else if (subcategory && category) {
    selector = `.toc-link[data-cat="${CSS.escape(category)}"][data-sub="${CSS.escape(
      subcategory
    )}"]`;
  } else if (category) {
    selector = `.toc-link[data-cat="${CSS.escape(category)}"][data-sub=""]`;
  }

  if (!selector) return;
  const el = document.querySelector(selector);
  if (el) {
    el.classList.add("active");
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function buildSearchHaystack(faq) {
  const fields = [
    getLangObj(faq.category),
    getLangObj(faq.subcategory),
    getLangObj(faq.question),
    ...(faq.tags || []),
    ...(faq.keywords || []),
    ...(faq.errorCodes || []),
    ...getLangList(faq.symptoms),
    ...getLangList(faq.rootCauses),
    ...getLangList(faq.solutionSteps),
    ...getLangList(faq.notes),
    ...(faq.images
      ? faq.images.flatMap((img) => [getLangObj(img.caption), img.src || ""])
      : []),
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
  const title = normalizeText(getLangObj(faq.question));

  if (errorCodes.some((c) => c === q || c.includes(q))) score += 100;
  if (title.includes(q)) score += 60;
  if (tags.some((t) => t === q || t.includes(q))) score += 40;
  if (keywords.some((k) => k === q || k.includes(q))) score += 25;

  const hay = buildSearchHaystack(faq);
  if (hay.includes(q)) score += 10;

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
  parts.push(`
    <div class="toc-subhead">
      <button class="toc-link" data-action="filter" data-cat="${escapeHtml(
        cat
      )}" data-sub="">
        ${escapeHtml(ui().viewAll(cat))}
        <span class="toc-count">${countFaqsInSubMap(subMap)}</span>
      </button>
    </div>
  `);

  for (const [sub, faqs] of subMap.entries()) {
    parts.push(`
      <div class="toc-subgroup">
        <button class="toc-link" data-action="filter" data-cat="${escapeHtml(
          cat
        )}" data-sub="${escapeHtml(sub)}">
          ${escapeHtml(sub)}
          <span class="toc-count">${faqs.length}</span>
        </button>

        <div class="toc-qs">
          ${faqs
            .map(
              (f) => `
                <button class="toc-q" data-action="filter" data-id="${escapeHtml(
                  f.id
                )}" data-cat="${escapeHtml(cat)}" data-sub="${escapeHtml(sub)}">
                  ${escapeHtml(getLangObj(f.question))}
                </button>
              `
            )
            .join("")}
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
      <div class="toc-cat">
        <div class="toc-cat-title">${escapeHtml(cat)}</div>
        ${renderSubcategories(cat, subMap)}
      </div>
    `);
  }

  toc.innerHTML =
    html.join("") ||
    `<div class="toc-empty">${escapeHtml(ui().tocEmpty)}</div>`;

  toc.querySelectorAll("[data-action='filter']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.getAttribute("data-cat") || "";
      const sub = btn.getAttribute("data-sub") || "";
      const id = btn.getAttribute("data-id") || "";
      applyFilterAndAnchor({
        category: cat || null,
        subcategory: sub || null,
        faqId: id || null,
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
  els.activeFilter.textContent = parts.length ? `Filter: ${parts.join(" / ")}` : "";
}

function section(labelZh, labelEn, items) {
  const label = state.lang === "en" ? labelEn : labelZh;
  if (!items || !items.length) return "";
  return `
    <div class="sec">
      <div class="sec-title">${escapeHtml(label)}</div>
      <ul class="sec-list">
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

  const html = faqsVisible
    .map((faq) => {
      const title = getLangObj(faq.question);
      const cat = getLangObj(faq.category);
      const sub = getLangObj(faq.subcategory);

      const errCodes = (faq.errorCodes || []).map(escapeHtml).join(" ");
      const tags = (faq.tags || [])
        .slice(0, 8)
        .map(escapeHtml)
        .map((t) => `<span class="tag">${t}</span>`)
        .join("");

      const updated = faq.lastUpdated ? escapeHtml(ui().updated(faq.lastUpdated)) : "";

      const symptoms = getLangList(faq.symptoms);
      const causes = getLangList(faq.rootCauses);
      const steps = getLangList(faq.solutionSteps);
      const notes = getLangList(faq.notes);

      const related = (faq.relatedFaqIds || []).filter(Boolean);
      const images = faq.images || [];

      const imagesBlock = images.length
        ? `
          <div class="sec">
            <div class="sec-title">${escapeHtml(ui().images)}</div>
            <div class="img-grid">
              ${images
                .map((img) => {
                  const cap = escapeHtml(getLangObj(img.caption));
                  const src = escapeHtml(img.src || "");
                  if (!src) return "";
                  return `<img class="img-thumb" data-action="img" data-src="${src}" data-cap="${cap}" src="${src}" alt="${cap}" />`;
                })
                .join("")}
            </div>
          </div>
        `
        : "";

      return `
        <article class="faq" id="faq_${escapeHtml(faq.id)}">
          <div class="faq-head">
            <button class="faq-toggle" data-action="toggle" data-id="${escapeHtml(faq.id)}">
              <span class="faq-q">Q</span>
              <span class="faq-title">${escapeHtml(title)}</span>
            </button>
            <div class="faq-meta">
              <span class="faq-cat">${escapeHtml(cat)}</span>
              <span class="faq-sub">${escapeHtml(sub)}</span>
              ${updated ? `<span class="faq-updated">${updated}</span>` : ""}
              ${errCodes ? `<span class="faq-codes">${errCodes}</span>` : ""}
            </div>
            <div class="faq-tags">${tags}</div>
          </div>

          <div class="faq-body ${state.expandedIds.has(faq.id) ? "" : "hidden"}" data-body="${escapeHtml(faq.id)}">
            ${section("症狀", "Symptoms", symptoms)}
            ${section("可能原因（分析）", "Root Causes", causes)}
            ${section("解決步驟", "Solution Steps", steps)}
            ${section("注意事項", "Notes", notes)}
            ${imagesBlock}

            ${
              related.length
                ? `
                  <div class="sec">
                    <div class="sec-title">${escapeHtml(ui().related)}</div>
                    <div class="related">
                      ${related
                        .map(
                          (rid) =>
                            `<button class="btn small ghost" data-action="jump" data-id="${escapeHtml(
                              rid
                            )}">#${escapeHtml(rid)}</button>`
                        )
                        .join("")}
                    </div>
                  </div>
                `
                : ""
            }

            <div class="faq-actions">
              <button class="btn small" data-action="copy" data-id="${escapeHtml(faq.id)}">${escapeHtml(ui().copy)}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  list.innerHTML = html;

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

      const steps = getLangList(faq.solutionSteps);
      if (steps.length) {
        lines.push(ui().solutionStepsLabel);
        steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      }

      const codes = faq.errorCodes || [];
      if (codes.length) lines.push(`Error Codes: ${codes.join(", ")}`);

      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        btn.textContent = ui().copied;
        setTimeout(() => (btn.textContent = ui().copy), 900);
      } catch {
        alert(ui().copyFail);
      }
    });
  });

  list.querySelectorAll("[data-action='img']").forEach((imgEl) => {
    imgEl.addEventListener("click", () => {
      openLightbox(imgEl.getAttribute("data-src"), imgEl.getAttribute("data-cap"));
    });
  });

  els.resultMeta.textContent = ui().showing(faqsVisible.length);
}

function toggleFaq(id) {
  if (!id) return;
  if (state.expandedIds.has(id)) state.expandedIds.delete(id);
  else state.expandedIds.add(id);

  const body = document.querySelector(`[data-body="${CSS.escape(id)}"]`);
  if (body) body.classList.toggle("hidden", !state.expandedIds.has(id));
}

function expandAll() {
  state.data.faqs.forEach((f) => state.expandedIds.add(f.id));
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
  if (!keepQuery) {
    /* keep search */
  }
  setActiveFilterText();
  rerender(() => {
    let target = null;
    if (state.filter.faqId) {
      target = document.querySelector(`#faq_${CSS.escape(state.filter.faqId)}`);
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
  let filtered = all;

  if (state.filter.category) {
    filtered = filtered.filter((f) => getLangObj(f.category) === state.filter.category);
  }
  if (state.filter.subcategory) {
    filtered = filtered.filter(
      (f) => getLangObj(f.subcategory) === state.filter.subcategory
    );
  }
  if (state.filter.faqId) {
    filtered = filtered.filter((f) => f.id === state.filter.faqId);
  }

  if (q) {
    filtered = filtered
      .map((f) => ({ f, s: scoreFaq(f, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
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
  const tocSet = visible.length ? visible : state.data.faqs;
  renderTOC(tocSet);
  renderFaqList(visible);
  setTocActiveByFilter();
  if (typeof afterRender === "function") afterRender();
}

/* Lightbox */
function openLightbox(src, caption) {
  let box = document.querySelector(".lightbox");
  if (!box) {
    box = document.createElement("div");
    box.className = "lightbox hidden";
    box.innerHTML = `
      <div class="lightbox-inner">
        <button class="lightbox-close" data-action="close">✕</button>
        <img id="lbImg" alt="" />
        <div id="lbCap" class="lightbox-cap"></div>
      </div>
    `;
    document.body.appendChild(box);
    box.querySelectorAll("[data-action='close']").forEach((x) => {
      x.addEventListener("click", () => box.classList.add("hidden"));
    });
    box.addEventListener("click", (e) => {
      if (e.target === box) box.classList.add("hidden");
    });
  }
  box.classList.remove("hidden");
  const img = box.querySelector("#lbImg");
  const cap = box.querySelector("#lbCap");
  img.src = src || "";
  cap.textContent = caption || "";
}

/** Apply UI language labels */
function applyUiTexts() {
  $("resetBtn").textContent = ui().reset;
  $("resetFilterBtn").textContent = ui().clearFilter;
  $("expandAllBtn").textContent = ui().expandAll;
  $("collapseAllBtn").textContent = ui().collapseAll;

  $("tocTitle").textContent = ui().toc;

  $("noResultsTitle").textContent = ui().noResultsTitle;
  $("noResultsHint").textContent = ui().noResultsHint;

  $("searchInput").placeholder = ui().searchPh;

  const meta = state.data?.meta;
  const scope = meta?.scope ?? "";
  $("footerLeft").textContent = scope ? `Scope: ${scope}` : "Static FAQ";
  $("footerRight").textContent = meta?.lastUpdated ? `Last updated: ${meta.lastUpdated}` : "";
}

/** Language segmented buttons */
function setLangButtonsActive() {
  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-lang") === state.lang);
  });
}

/** Set language and reload */
async function setLang(lang) {
  state.lang = normalizeLang(lang);
  saveLang(state.lang);
  setLangButtonsActive();
  state.data = await loadDataForLang(state.lang);
  applyUiTexts();
  rerender();
}

/** Init */
async function init() {
  els.toc = $("toc");
  els.faqList = $("faqList");
  els.noResults = $("noResults");
  els.resultMeta = $("resultMeta");
  els.activeFilter = $("activeFilter");

  $("searchInput").addEventListener(
    "input",
    debounce((e) => {
      state.query = e.target.value;
      rerender();
    }, 180)
  );

  $("resetBtn").addEventListener("click", () => {
    state.query = "";
    $("searchInput").value = "";
    rerender();
  });

  $("resetFilterBtn").addEventListener("click", () => resetFilter());
  $("expandAllBtn").addEventListener("click", () => expandAll());
  $("collapseAllBtn").addEventListener("click", () => collapseAll());

  // 只支援 zh/en；若你 index.html 還有 zh-CN/th 按鈕，點了會自動回到 zh
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang")));
  });

  await setLang(loadLang());
}

init();
