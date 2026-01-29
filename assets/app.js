/* assets/app.js (Aligned with current index.html + styles.css)
 * - 4 languages: zh / zh-CN / en / th
 * - JSON format: STRICT plain string/array (NO wrapped object like {zh:..., en:...})
 * - UI: TOC + filter + search + expand/collapse + copy + related + images
 */

const LANGS = ["zh", "zh-CN", "en", "th"];
const LANG_KEY = "robot_fqa_lang_v4";

const state = {
  lang: "zh",
  data: null, // { faqs: [...] }
  query: "",
  filter: { category: null, subcategory: null, faqId: null },
  expandedIds: new Set(),
};

const els = {};
const $ = (id) => document.getElementById(id);

// ------------------------ Strict getters (NO wrapper object) ------------------------
function asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return ""; // object => invalid (strict)
}

function asList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(asText).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") {
    // accept manual entry with newline
    return v.split(/\r?\n/g).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeLang(v) {
  return LANGS.includes(v) ? v : "zh";
}

function loadLang() {
  return normalizeLang(localStorage.getItem(LANG_KEY) || "zh");
}

function saveLang(v) {
  localStorage.setItem(LANG_KEY, normalizeLang(v));
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(s) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function debounce(fn, delay = 220) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ------------------------ UI i18n (interface labels only) ------------------------
const UI = {
  zh: {
    reset: "重置",
    toc: "目錄",
    clearFilter: "清除篩選",
    expandAll: "展開全部",
    collapseAll: "收合全部",
    noResultsTitle: "找不到結果",
    noResultsHint: "請嘗試不同關鍵字，或清除篩選。",
    showing: (n) => `顯示 ${n} 筆`,
    filtered: (n, t) => `顯示 ${n} / ${t} 筆`,
    viewAll: (cat) => `查看全部：${cat}`,
    searchPh: "搜尋…",
    updated: (d) => `更新：${d}`,
    images: "圖片",
    related: "相關問題",
    copy: "複製解法",
    copied: "已複製",
    copyFail: "無法複製（瀏覽器權限限制）",
    secSymptoms: "症狀",
    secRoot: "可能原因（分析）",
    secSteps: "解決步驟",
    secNotes: "注意事項",
    pillCatSub: (cat, sub) => (sub ? `${cat} / ${sub}` : cat),
  },
  "zh-CN": {
    reset: "重置",
    toc: "目录",
    clearFilter: "清除筛选",
    expandAll: "展开全部",
    collapseAll: "收合全部",
    noResultsTitle: "找不到结果",
    noResultsHint: "请尝试不同关键字，或清除筛选。",
    showing: (n) => `显示 ${n} 条`,
    filtered: (n, t) => `显示 ${n} / ${t} 条`,
    viewAll: (cat) => `查看全部：${cat}`,
    searchPh: "搜索…",
    updated: (d) => `更新：${d}`,
    images: "图片",
    related: "相关问题",
    copy: "复制解法",
    copied: "已复制",
    copyFail: "无法复制（浏览器权限限制）",
    secSymptoms: "症状",
    secRoot: "可能原因（分析）",
    secSteps: "解决步骤",
    secNotes: "注意事项",
    pillCatSub: (cat, sub) => (sub ? `${cat} / ${sub}` : cat),
  },
  en: {
    reset: "Reset",
    toc: "Contents",
    clearFilter: "Clear filter",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    noResultsTitle: "No results",
    noResultsHint: "Try another keyword, or clear filters.",
    showing: (n) => `Showing ${n} items`,
    filtered: (n, t) => `Showing ${n} / ${t}`,
    viewAll: (cat) => `View all: ${cat}`,
    searchPh: "Search…",
    updated: (d) => `Updated: ${d}`,
    images: "Images",
    related: "Related FAQs",
    copy: "Copy Solution",
    copied: "Copied",
    copyFail: "Copy failed (browser permission).",
    secSymptoms: "Symptoms",
    secRoot: "Root Causes",
    secSteps: "Solution Steps",
    secNotes: "Notes",
    pillCatSub: (cat, sub) => (sub ? `${cat} / ${sub}` : cat),
  },
  th: {
    reset: "รีเซ็ต",
    toc: "สารบัญ",
    clearFilter: "ล้างตัวกรอง",
    expandAll: "ขยายทั้งหมด",
    collapseAll: "ย่อทั้งหมด",
    noResultsTitle: "ไม่พบผลลัพธ์",
    noResultsHint: "ลองคำค้นอื่น หรือ ล้างตัวกรอง",
    showing: (n) => `แสดง ${n} รายการ`,
    filtered: (n, t) => `แสดง ${n} / ${t}`,
    viewAll: (cat) => `ดูทั้งหมด: ${cat}`,
    searchPh: "ค้นหา…",
    updated: (d) => `อัปเดต: ${d}`,
    images: "รูปภาพ",
    related: "คำถามที่เกี่ยวข้อง",
    copy: "คัดลอกวิธีแก้ไข",
    copied: "คัดลอกแล้ว",
    copyFail: "คัดลอกไม่ได้ (สิทธิ์ของเบราว์เซอร์)",
    secSymptoms: "อาการ",
    secRoot: "สาเหตุที่เป็นไปได้",
    secSteps: "ขั้นตอนการแก้ไข",
    secNotes: "หมายเหตุ",
    pillCatSub: (cat, sub) => (sub ? `${cat} / ${sub}` : cat),
  },
};

function ui() {
  return UI[state.lang] || UI.zh;
}

// ------------------------ Data loading ------------------------
async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch failed: ${url} (${r.status})`);
  return await r.json();
}


const DATA_VER = "20260129"; // ★ 每次更新 JSON 就改這個

async function loadDataForLang(lang) {
  const l = normalizeLang(lang);
  const map = {
    zh: `./assets/faqs.zh.json?v=${DATA_VER}`,
    "zh-CN": `./assets/faqs.zh-CN.json?v=${DATA_VER}`,
    en: `./assets/faqs.en.json?v=${DATA_VER}`,
    th: `./assets/faqs.th.json?v=${DATA_VER}`,
  };
  return await fetchJson(map[l]);
}

function normalizeFaq(raw) {
  const f = raw || {};
  return {
    id: asText(f.id).trim(),
    category: asText(f.category).trim(),
    subcategory: asText(f.subcategory).trim(),
    question: asText(f.question).trim(),
    symptoms: asList(f.symptoms),
    rootCauses: asList(f.rootCauses),
    solutionSteps: asList(f.solutionSteps),
    notes: asList(f.notes),
    tags: Array.isArray(f.tags) ? f.tags.map(asText).map((s) => s.trim()).filter(Boolean) : asList(f.tags),
    keywords: Array.isArray(f.keywords) ? f.keywords.map(asText).map((s) => s.trim()).filter(Boolean) : asList(f.keywords),
    errorCodes: Array.isArray(f.errorCodes) ? f.errorCodes.map(asText).map((s) => s.trim()).filter(Boolean) : asList(f.errorCodes),
    relatedFaqIds: Array.isArray(f.relatedFaqIds) ? f.relatedFaqIds.map(asText).map((s) => s.trim()).filter(Boolean) : asList(f.relatedFaqIds),
    images: Array.isArray(f.images) ? f.images : [],
    lastUpdated: asText(f.lastUpdated).trim(),
  };
}

function getAllFaqs() {
  const faqs = state.data && Array.isArray(state.data.faqs) ? state.data.faqs : [];
  return faqs.map(normalizeFaq).filter((f) => f.id);
}

// ------------------------ Search scoring ------------------------
function buildHay(f) {
  const fields = [
    f.id,
    f.category,
    f.subcategory,
    f.question,
    ...(f.tags || []),
    ...(f.keywords || []),
    ...(f.errorCodes || []),
    ...(f.symptoms || []),
    ...(f.rootCauses || []),
    ...(f.solutionSteps || []),
    ...(f.notes || []),
    ...(f.images || []).flatMap((img) => [asText(img.caption), asText(img.src)]),
  ];
  return normalizeText(fields.join(" | "));
}

function scoreFaq(f, qNorm) {
  if (!qNorm) return 0;
  let s = 0;

  const title = normalizeText(f.question);
  const hay = buildHay(f);

  // strong signals
  if ((f.errorCodes || []).map(normalizeText).some((c) => c === qNorm || c.includes(qNorm))) s += 100;
  if (title.includes(qNorm)) s += 60;
  if ((f.tags || []).map(normalizeText).some((t) => t === qNorm || t.includes(qNorm))) s += 40;
  if ((f.keywords || []).map(normalizeText).some((k) => k === qNorm || k.includes(qNorm))) s += 25;
  if (hay.includes(qNorm)) s += 10;

  const tokens = qNorm.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    let hits = 0;
    for (const t of tokens) if (hay.includes(t)) hits++;
    s += Math.min(20, hits * 5);
  }

  return s;
}

// ------------------------ TOC grouping ------------------------
function groupToTree(faqs) {
  const tree = new Map(); // cat -> Map(sub -> faqs[])
  for (const f of faqs) {
    const cat = f.category || "—";
    const sub = f.subcategory || "—";
    if (!tree.has(cat)) tree.set(cat, new Map());
    const subMap = tree.get(cat);
    if (!subMap.has(sub)) subMap.set(sub, []);
    subMap.get(sub).push(f);
  }
  return tree;
}

function countFaqsInSubMap(subMap) {
  let n = 0;
  for (const arr of subMap.values()) n += arr.length;
  return n;
}

// ------------------------ Filter + active toc ------------------------
function clearTocActive() {
  document.querySelectorAll(".toc-link.active, .toc-q.active").forEach((el) => el.classList.remove("active"));
}

function setTocActiveByFilter() {
  clearTocActive();
  const { category, subcategory, faqId } = state.filter;

  let selector = null;
  if (faqId) selector = `.toc-q[data-id="${CSS.escape(faqId)}"]`;
  else if (category && subcategory) selector = `.toc-link[data-cat="${CSS.escape(category)}"][data-sub="${CSS.escape(subcategory)}"]`;
  else if (category) selector = `.toc-link[data-cat="${CSS.escape(category)}"][data-sub=""]`;

  if (!selector) return;
  const el = document.querySelector(selector);
  if (el) {
    el.classList.add("active");
    el.scrollIntoView({ block: "nearest" });
  }
}

function applyFilter(next, scrollToFaq = true) {
  state.filter = {
    category: next.category ?? null,
    subcategory: next.subcategory ?? null,
    faqId: next.faqId ?? null,
  };

  // If targeting single FAQ => ensure expanded
  if (state.filter.faqId) state.expandedIds.add(state.filter.faqId);

  rerender();

  if (scrollToFaq && state.filter.faqId) {
    const target = document.getElementById(`faq-${state.filter.faqId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("flash");
      setTimeout(() => target.classList.remove("flash"), 900);
    }
  }
}

// ------------------------ Render: TOC ------------------------
function renderTOC(faqsForToc) {
  const toc = els.toc;
  const tree = groupToTree(faqsForToc);
  const html = [];

  for (const [cat, subMap] of tree.entries()) {
    const total = countFaqsInSubMap(subMap);

    const subHtml = [];
    for (const [sub, faqs] of subMap.entries()) {
      const qs = faqs
        .map(
          (f) => `
          <button class="toc-q" type="button" data-action="filter" data-id="${escapeHtml(f.id)}" data-cat="${escapeHtml(cat)}" data-sub="${escapeHtml(sub)}">
            ${escapeHtml(f.question)}
          </button>`
        )
        .join("");

      subHtml.push(`
        <div class="toc-sub">
          <button class="toc-link" type="button" data-action="filter" data-cat="${escapeHtml(cat)}" data-sub="${escapeHtml(sub)}">
            <span>${escapeHtml(sub)}</span>
            <span class="toc-count small">${faqs.length}</span>
          </button>
          <div class="toc-questions">${qs}</div>
        </div>
      `);
    }

    html.push(`
      <div class="toc-cat">
        <div class="toc-cat-summary">
          <div class="toc-cat-title">${escapeHtml(cat)}</div>
          <div class="toc-count">${total}</div>
        </div>

        <div class="toc-sublist">
          <button class="toc-link" type="button" data-action="filter" data-cat="${escapeHtml(cat)}" data-sub="">
            <span>${escapeHtml(ui().viewAll(cat))}</span>
            <span class="toc-count small">${total}</span>
          </button>
          ${subHtml.join("")}
        </div>
      </div>
    `);
  }

  toc.innerHTML = html.join("") || `<div class="muted">${escapeHtml(ui().noResultsHint)}</div>`;

  // bind toc buttons
  toc.querySelectorAll("[data-action='filter']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cat = btn.getAttribute("data-cat") || "";
      const sub = btn.getAttribute("data-sub") || "";
      const id = btn.getAttribute("data-id") || "";
      applyFilter({ category: cat || null, subcategory: sub || null, faqId: id || null }, true);
    });
  });

  setTocActiveByFilter();
}

// ------------------------ Render: FAQ list ------------------------
function sectionBlock(title, items) {
  if (!items || !items.length) return "";
  return `
    <div class="faq-section">
      <div class="faq-section-title">${escapeHtml(title)}</div>
      <ul class="faq-ul">
        ${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderImages(images) {
  const imgs = (images || [])
    .map((img) => {
      const src = asText(img.src).trim();
      if (!src) return "";
      const cap = asText(img.caption).trim();
      return `
        <figure class="img-item">
          <img class="img-thumb" src="${escapeHtml(src)}" alt="${escapeHtml(cap)}" data-img="${escapeHtml(src)}" />
          ${cap ? `<figcaption class="img-cap">${escapeHtml(cap)}</figcaption>` : `<figcaption class="img-cap muted"></figcaption>`}
        </figure>
      `;
    })
    .filter(Boolean)
    .join("");

  if (!imgs) return "";
  return `
    <div class="faq-section">
      <div class="faq-section-title">${escapeHtml(ui().images)}</div>
      <div class="img-grid">${imgs}</div>
    </div>
  `;
}

function renderRelated(ids) {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return "";
  return `
    <div class="faq-section">
      <div class="faq-section-title">${escapeHtml(ui().related)}</div>
      <div class="related">
        ${list
          .map(
            (rid) => `
          <button class="btn small ghost" type="button" data-action="jump" data-id="${escapeHtml(rid)}">#${escapeHtml(rid)}</button>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderFaqList(faqsVisible, totalAll) {
  const list = els.faqList;

  if (!faqsVisible.length) {
    list.innerHTML = "";
    els.noResults.classList.remove("hidden");
    els.resultMeta.textContent = "";
    return;
  }
  els.noResults.classList.add("hidden");

  const html = faqsVisible
    .map((f) => {
      const open = state.expandedIds.has(f.id);

      const pills = [];
      pills.push(`<span class="pill">${escapeHtml(ui().pillCatSub(f.category, f.subcategory))}</span>`);
      if (f.lastUpdated) pills.push(`<span class="pill subtle">${escapeHtml(ui().updated(f.lastUpdated))}</span>`);
      (f.errorCodes || []).slice(0, 6).forEach((c) => pills.push(`<span class="pill danger">${escapeHtml(c)}</span>`));

      const tagPills = (f.tags || []).slice(0, 8).map((t) => `<span class="pill subtle">${escapeHtml(t)}</span>`).join("");

      return `
        <article class="faq-card" id="faq-${escapeHtml(f.id)}">
          <button class="faq-head" type="button" data-action="toggle" data-id="${escapeHtml(f.id)}">
            <div class="faq-title">
              <div class="faq-q" aria-hidden="true">Q</div>
              <div class="faq-title-text">${escapeHtml(f.question || "(No question)")}</div>
            </div>

            <div class="faq-meta">
              ${pills.join("")}
            </div>

            ${tagPills ? `<div class="faq-pills">${tagPills}</div>` : ""}
          </button>

          <div class="faq-body ${open ? "" : "hidden"}" data-body="${escapeHtml(f.id)}">
            ${sectionBlock(ui().secSymptoms, f.symptoms)}
            ${sectionBlock(ui().secRoot, f.rootCauses)}
            ${sectionBlock(ui().secSteps, f.solutionSteps)}
            ${sectionBlock(ui().secNotes, f.notes)}
            ${renderImages(f.images)}
            ${renderRelated(f.relatedFaqIds)}

            <div class="faq-actions">
              <button class="btn small" type="button" data-action="copy" data-id="${escapeHtml(f.id)}">${escapeHtml(ui().copy)}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  list.innerHTML = html;

  // bind list actions
  list.querySelectorAll("[data-action='toggle']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-id");
      toggleFaq(id);
    });
  });

  list.querySelectorAll("[data-action='jump']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-id");
      applyFilter({ category: null, subcategory: null, faqId: id }, true);
    });
  });

  list.querySelectorAll("[data-action='copy']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const f = getAllFaqs().find((x) => x.id === id);
      if (!f) return;

      const lines = [];
      lines.push(`Q: ${f.question}`);
      if (f.solutionSteps?.length) {
        lines.push(`\n${ui().secSteps}:`);
        f.solutionSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      }

      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        btn.textContent = ui().copied;
        setTimeout(() => (btn.textContent = ui().copy), 900);
      } catch {
        alert(ui().copyFail);
      }
    });
  });

  // image click => open new tab
  list.querySelectorAll("[data-img]").forEach((img) => {
    img.addEventListener("click", () => {
      const src = img.getAttribute("data-img");
      if (src) window.open(src, "_blank");
    });
  });

  // result meta
  const visible = faqsVisible.length;
  els.resultMeta.textContent =
    state.query.trim() ? ui().filtered(visible, totalAll) : ui().showing(visible);
}

// ------------------------ Expand / Collapse ------------------------
function toggleFaq(id) {
  if (!id) return;
  if (state.expandedIds.has(id)) state.expandedIds.delete(id);
  else state.expandedIds.add(id);

  const body = document.querySelector(`[data-body="${CSS.escape(id)}"]`);
  if (body) body.classList.toggle("hidden", !state.expandedIds.has(id));
}

function expandAll(ids) {
  ids.forEach((id) => state.expandedIds.add(id));
  rerender();
}
function collapseAll() {
  state.expandedIds.clear();
  rerender();
}

// ------------------------ Language UI ------------------------
function setLangButtonsActive() {
  document.querySelectorAll(".seg-btn[data-lang]").forEach((b) => {
    const v = normalizeLang(b.getAttribute("data-lang"));
    b.classList.toggle("active", v === state.lang);
  });
}

function applyUiTextsToStatic() {
  const t = ui();

  // placeholders / labels in static DOM
  if (els.searchInput) els.searchInput.placeholder = t.searchPh;

  if (els.resetBtn) els.resetBtn.textContent = t.reset;
  if (els.tocTitle) els.tocTitle.textContent = t.toc;
  if (els.resetFilterBtn) els.resetFilterBtn.textContent = t.clearFilter;
  if (els.expandAllBtn) els.expandAllBtn.textContent = t.expandAll;
  if (els.collapseAllBtn) els.collapseAllBtn.textContent = t.collapseAll;

  if (els.noResultsTitle) els.noResultsTitle.textContent = t.noResultsTitle;
  if (els.noResultsHint) els.noResultsHint.textContent = t.noResultsHint;
}

async function setLang(lang) {
  state.lang = normalizeLang(lang);
  saveLang(state.lang);
  setLangButtonsActive();

  state.data = await loadDataForLang(state.lang);

  // reset filter & query to avoid cross-language mismatch
  state.query = "";
  state.filter = { category: null, subcategory: null, faqId: null };
  state.expandedIds.clear();
  if (els.searchInput) els.searchInput.value = "";

  applyUiTextsToStatic();
  rerender();
}

// ------------------------ Main rerender pipeline ------------------------
function rerender() {
  const all = getAllFaqs();
  const q = normalizeText(state.query);

  // 1) search subset for TOC + list
  let scored = all.map((f) => ({ f, s: scoreFaq(f, q) }));
  let matched = q ? scored.filter((x) => buildHay(x.f).includes(q) || x.s > 0) : scored;
  matched.sort((a, b) => b.s - a.s);

  const forToc = matched.map((x) => x.f);

  // 2) apply category/sub/faqId filter to visible list
  let visible = forToc;

  if (state.filter.category) visible = visible.filter((f) => f.category === state.filter.category);
  if (state.filter.subcategory) visible = visible.filter((f) => f.subcategory === state.filter.subcategory);
  if (state.filter.faqId) visible = visible.filter((f) => f.id === state.filter.faqId);

  // active filter text
  const parts = [];
  if (state.filter.category) parts.push(state.filter.category);
  if (state.filter.subcategory) parts.push(state.filter.subcategory);
  if (state.filter.faqId) parts.push(`#${state.filter.faqId}`);
  els.activeFilter.textContent = parts.length ? `Filter: ${parts.join(" / ")}` : "";

  renderTOC(forToc);
  renderFaqList(visible, all.length);

  setTocActiveByFilter();
}

// ------------------------ Bind events ------------------------
function bindEvents() {
  // IMPORTANT: language buttons use event delegation => never "can't click"
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn[data-lang]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    setLang(btn.getAttribute("data-lang"));
  });

  els.searchInput.addEventListener(
    "input",
    debounce((e) => {
      state.query = e.target.value || "";
      rerender();
    }, 220)
  );

  els.resetBtn.addEventListener("click", () => {
    state.query = "";
    state.filter = { category: null, subcategory: null, faqId: null };
    state.expandedIds.clear();
    els.searchInput.value = "";
    rerender();
  });

  els.resetFilterBtn.addEventListener("click", () => {
    state.filter = { category: null, subcategory: null, faqId: null };
    rerender();
  });

  els.expandAllBtn.addEventListener("click", () => {
    const all = getAllFaqs().map((f) => f.id);
    expandAll(all);
  });

  els.collapseAllBtn.addEventListener("click", () => {
    collapseAll();
  });
}

// ------------------------ Init ------------------------
(async function init() {
  // cache DOM
  els.searchInput = $("searchInput");
  els.resetBtn = $("resetBtn");
  els.expandAllBtn = $("expandAllBtn");
  els.collapseAllBtn = $("collapseAllBtn");
  els.resetFilterBtn = $("resetFilterBtn");

  els.tocTitle = $("tocTitle");
  els.toc = $("toc");

  els.activeFilter = $("activeFilter");
  els.resultMeta = $("resultMeta");
  els.noResults = $("noResults");
  els.noResultsTitle = $("noResultsTitle");
  els.noResultsHint = $("noResultsHint");
  els.faqList = $("faqList");

  try {
    state.lang = loadLang();
    setLangButtonsActive();

    state.data = await loadDataForLang(state.lang);
    applyUiTextsToStatic();
    bindEvents();
    rerender();
  } catch (err) {
    console.error(err);
    alert("Failed to load FAQ data");
  }
})();
