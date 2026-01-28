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
    copyFail: "Copy failed (browser perm
