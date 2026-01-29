/* assets/app.js (Strict: plain string/array JSON only; zh/zh-CN/en/th) */

const LANGS = ["zh", "zh-CN", "en", "th"];
const LANG_KEY = "robot_fqa_lang_v3";

// ---------- State ----------
const state = {
  lang: "zh",
  data: null,
  query: "",
  selectedCategory: "",
  selectedSubcategory: "",
  expandedIds: new Set(),
};

// ---------- Utils ----------
function normalizeLang(v) {
  return LANGS.includes(v) ? v : "zh";
}

function loadLang() {
  return normalizeLang(localStorage.getItem(LANG_KEY) || "zh");
}

function saveLang(v) {
  localStorage.setItem(LANG_KEY, normalizeLang(v));
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asText(v) {
  // Strict: only accept string/number/bool; objects are treated as invalid
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // If someone accidentally puts {"zh-CN": "..."} here, we refuse and show empty.
  return "";
}

function asList(v) {
  // Strict: accept array or string (split by newline/|). Objects => invalid => []
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => asText(x).trim()).filter(Boolean);

  if (typeof v === "string") {
    return v
      .split(/\r?\n|\|/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch failed: ${url} (${r.status})`);
  return await r.json();
}

async function loadDataForLang(lang) {
  const l = normalizeLang(lang);
  const map = {
    "zh": "./assets/faqs.zh.json",
    "zh-CN": "./assets/faqs.zh-CN.json",
    "en": "./assets/faqs.en.json",
    "th": "./assets/faqs.th.json",
  };
  return await fetchJson(map[l]);
}

// ---------- DOM refs ----------
const el = {
  langBtns: () => document.querySelectorAll("[data-lang]"),
  search: () => document.getElementById("searchInput"),
  category: () => document.getElementById("categorySelect"),
  subcategory: () => document.getElementById("subcategorySelect"),
  list: () => document.getElementById("faqList"),
  headerTitle: () => document.getElementById("pageTitle"),
  headerDesc: () => document.getElementById("pageDesc"),
};

// ---------- Normalize FAQ object ----------
function normFaq(raw) {
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

    // optional
    tags: Array.isArray(f.tags) ? f.tags.map((x) => asText(x).trim()).filter(Boolean) : asList(f.tags),
    keywords: Array.isArray(f.keywords) ? f.keywords.map((x) => asText(x).trim()).filter(Boolean) : asList(f.keywords),
    errorCodes: Array.isArray(f.errorCodes) ? f.errorCodes.map((x) => asText(x).trim()).filter(Boolean) : asList(f.errorCodes),
    relatedFaqIds: Array.isArray(f.relatedFaqIds) ? f.relatedFaqIds.map((x) => asText(x).trim()).filter(Boolean) : asList(f.relatedFaqIds),

    images: Array.isArray(f.images) ? f.images : [],
    lastUpdated: asText(f.lastUpdated).trim(),
  };
}

function getFaqs() {
  const faqs = state.data && Array.isArray(state.data.faqs) ? state.data.faqs : [];
  return faqs.map(normFaq).filter((f) => f.id);
}

// ---------- UI texts ----------
function uiTexts(lang) {
  const dict = {
    "zh": {
      title: "Robot FAQ",
      desc: "搜尋常見問題，並依分類快速定位解法",
      searchPh: "Search",
      catAll: "全部分類",
      subAll: "全部子分類",
      empty: "沒有符合的結果",
      secSymptoms: "Symptoms",
      secRoot: "Root Causes",
      secSteps: "Solution Steps",
      secNotes: "Notes",
    },
    "zh-CN": {
      title: "Robot FAQ",
      desc: "搜索常见问题，并按分类快速定位解法",
      searchPh: "Search",
      catAll: "全部分类",
      subAll: "全部子分类",
      empty: "没有符合的结果",
      secSymptoms: "Symptoms",
      secRoot: "Root Causes",
      secSteps: "Solution Steps",
      secNotes: "Notes",
    },
    "en": {
      title: "Robot FAQ",
      desc: "Search FAQs and quickly find solutions by category",
      searchPh: "Search",
      catAll: "All Categories",
      subAll: "All Subcategories",
      empty: "No results",
      secSymptoms: "Symptoms",
      secRoot: "Root Causes",
      secSteps: "Solution Steps",
      secNotes: "Notes",
    },
    "th": {
      title: "Robot FAQ",
      desc: "ค้นหาคำถามที่พบบ่อย และค้นหาวิธีแก้ไขได้อย่างรวดเร็วตามหมวดหมู่",
      searchPh: "Search",
      catAll: "หมวดหมู่ทั้งหมด",
      subAll: "หมวดย่อยทั้งหมด",
      empty: "ไม่พบผลลัพธ์",
      secSymptoms: "Symptoms",
      secRoot: "Root Causes",
      secSteps: "Solution Steps",
      secNotes: "Notes",
    },
  };
  return dict[lang] || dict["zh"];
}

function applyUiTexts() {
  const t = uiTexts(state.lang);
  if (el.headerTitle()) el.headerTitle().textContent = t.title;
  if (el.headerDesc()) el.headerDesc().textContent = t.desc;
  if (el.search()) el.search().setAttribute("placeholder", t.searchPh);
}

// ---------- Filters ----------
function setLangButtonsActive() {
  el.langBtns().forEach((b) => {
    const v = normalizeLang(b.getAttribute("data-lang"));
    b.classList.toggle("active", v === state.lang);
  });
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function buildCategoryOptions(faqs) {
  const t = uiTexts(state.lang);
  const cats = uniqueSorted(faqs.map((f) => f.category));
  const select = el.category();
  if (!select) return;

  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = t.catAll;
  select.appendChild(opt0);

  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}

function buildSubcategoryOptions(faqs) {
  const t = uiTexts(state.lang);
  const select = el.subcategory();
  if (!select) return;

  const filtered = state.selectedCategory
    ? faqs.filter((f) => f.category === state.selectedCategory)
    : faqs;

  const subs = uniqueSorted(filtered.map((f) => f.subcategory));

  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = t.subAll;
  select.appendChild(opt0);

  subs.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

function filterFaqs(faqs) {
  const q = (state.query || "").trim().toLowerCase();

  return faqs.filter((f) => {
    if (state.selectedCategory && f.category !== state.selectedCategory) return false;
    if (state.selectedSubcategory && f.subcategory !== state.selectedSubcategory) return false;

    if (!q) return true;

    const blob = [
      f.id,
      f.category,
      f.subcategory,
      f.question,
      (f.symptoms || []).join(" "),
      (f.rootCauses || []).join(" "),
      (f.solutionSteps || []).join(" "),
      (f.notes || []).join(" "),
      (f.tags || []).join(" "),
      (f.keywords || []).join(" "),
      (f.errorCodes || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return blob.includes(q);
  });
}

// ---------- Render ----------
function renderList(faqs) {
  const container = el.list();
  if (!container) return;

  const t = uiTexts(state.lang);
  container.innerHTML = "";

  if (!faqs.length) {
    container.innerHTML = `<div class="empty">${escapeHtml(t.empty)}</div>`;
    return;
  }

  const sectionHtml = (title, items) => {
    if (!items || !items.length) return "";
    return `
      <div class="sec">
        <div class="sec-title">${escapeHtml(title)}</div>
        <ul class="sec-list">${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </div>
    `;
  };

  faqs.forEach((f) => {
    const isOpen = state.expandedIds.has(f.id);

    const card = document.createElement("div");
    card.className = "faq-card";

    const header = document.createElement("div");
    header.className = "faq-header";
    header.innerHTML = `
      <div class="faq-title">
        <div class="faq-q">${escapeHtml(f.question || "(No question)")}</div>
        <div class="faq-meta">
          ${escapeHtml(f.category)}${f.subcategory ? " / " + escapeHtml(f.subcategory) : ""}
          <span class="faq-id">#${escapeHtml(f.id)}</span>
        </div>
      </div>
      <button class="faq-toggle" aria-label="toggle">${isOpen ? "−" : "+"}</button>
    `;

    header.addEventListener("click", () => {
      if (state.expandedIds.has(f.id)) state.expandedIds.delete(f.id);
      else state.expandedIds.add(f.id);
      rerender();
    });

    const body = document.createElement("div");
    body.className = "faq-body";
    body.style.display = isOpen ? "block" : "none";
    body.innerHTML =
      sectionHtml(t.secSymptoms, f.symptoms) +
      sectionHtml(t.secRoot, f.rootCauses) +
      sectionHtml(t.secSteps, f.solutionSteps) +
      sectionHtml(t.secNotes, f.notes);

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });
}

function rerender() {
  const faqs = getFaqs();

  buildCategoryOptions(faqs);
  if (el.category()) el.category().value = state.selectedCategory || "";

  buildSubcategoryOptions(faqs);
  if (el.subcategory()) el.subcategory().value = state.selectedSubcategory || "";

  const filtered = filterFaqs(faqs);
  renderList(filtered);
}

// ---------- Events ----------
async function setLang(lang) {
  state.lang = normalizeLang(lang);
  saveLang(state.lang);
  setLangButtonsActive();

  state.data = await loadDataForLang(state.lang);
  applyUiTexts();

  // Reset filters (避免跨語言分類名稱不同造成空結果)
  state.selectedCategory = "";
  state.selectedSubcategory = "";
  state.query = "";
  state.expandedIds.clear();
  if (el.search()) el.search().value = "";

  rerender();
}

function bindEvents() {
  // lang buttons
  el.langBtns().forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang")));
  });

  // search
  if (el.search()) {
    el.search().addEventListener("input", (e) => {
      state.query = e.target.value || "";
      rerender();
    });
  }

  // category
  if (el.category()) {
    el.category().addEventListener("change", (e) => {
      state.selectedCategory = e.target.value || "";
      state.selectedSubcategory = "";
      rerender();
    });
  }

  // subcategory
  if (el.subcategory()) {
    el.subcategory().addEventListener("change", (e) => {
      state.selectedSubcategory = e.target.value || "";
      rerender();
    });
  }
}

// ---------- Init ----------
(async function init() {
  try {
    state.lang = loadLang();
    setLangButtonsActive();
    state.data = await loadDataForLang(state.lang);
    applyUiTexts();
    bindEvents();
    rerender();
  } catch (e) {
    console.error(e);
    alert("Failed to load FAQ data");
  }
})();
