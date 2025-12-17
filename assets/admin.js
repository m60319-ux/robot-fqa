const DRAFT_KEY = "robot_fqa_admin_draft_v1";

let data = null;
let selectedFaq = null;
let pendingDataUrl = null;

const els = {
  faqSelect: document.getElementById("faqSelect"),
  faqId: document.getElementById("faqId"),
  fileInput: document.getElementById("fileInput"),
  imgIdInput: document.getElementById("imgIdInput"),
  capZh: document.getElementById("capZh"),
  capEn: document.getElementById("capEn"),
  addImageBtn: document.getElementById("addImageBtn"),
  exportBtn: document.getElementById("exportBtn"),
  saveDraftBtn: document.getElementById("saveDraftBtn"),
  loadDraftBtn: document.getElementById("loadDraftBtn"),
  preview: document.getElementById("preview"),
  status: document.getElementById("status")
};

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function uid() {
  return "img-" + Math.random().toString(16).slice(2, 10);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadJson() {
  const res = await fetch("./assets/faqs.json", { cache: "no-store" });
  data = await res.json();
}

function populateFaqSelect() {
  els.faqSelect.innerHTML = data.faqs.map(f =>
    `<option value="${escapeHtml(f.id)}">${escapeHtml(f.id)} — ${escapeHtml(f.question?.zh || f.question?.en || "")}</option>`
  ).join("");

  els.faqSelect.addEventListener("change", () => {
    selectFaqById(els.faqSelect.value);
  });

  selectFaqById(data.faqs[0]?.id);
}

function selectFaqById(id) {
  selectedFaq = data.faqs.find(f => f.id === id) || null;
  els.faqId.value = selectedFaq?.id || "";
  pendingDataUrl = null;
  els.fileInput.value = "";
  els.imgIdInput.value = "";
  els.capZh.value = "";
  els.capEn.value = "";
  renderPreview();
  setStatus("");
}

function renderPreview() {
  if (!selectedFaq) return;

  const imgs = selectedFaq.images || [];
  els.preview.innerHTML = imgs.map(img => `
    <figure class="img-item">
      <button class="rm-btn" type="button" data-action="rm" data-id="${escapeHtml(img.id)}">移除</button>
      <img class="img-thumb" src="${escapeHtml(img.dataUrl)}" alt="${escapeHtml(img.caption?.zh || img.caption?.en || "")}" />
      <figcaption class="img-cap">
        <div><b>ZH:</b> ${escapeHtml(img.caption?.zh || "")}</div>
        <div><b>EN:</b> ${escapeHtml(img.caption?.en || "")}</div>
        <div class="muted mono" style="margin-top:4px;">${escapeHtml(img.id)}</div>
      </figcaption>
    </figure>
  `).join("") || `<div class="hint">此題目前沒有圖片。</div>`;

  els.preview.querySelectorAll("[data-action='rm']").forEach(btn => {
    btn.addEventListener("click", () => {
      const imgId = btn.getAttribute("data-id");
      selectedFaq.images = (selectedFaq.images || []).filter(x => x.id !== imgId);
      renderPreview();
      setStatus(`已移除圖片：${imgId}`);
    });
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

els.fileInput.addEventListener("change", async () => {
  const file = els.fileInput.files?.[0];
  if (!file) {
    pendingDataUrl = null;
    return;
  }

  // basic size guidance (still allow)
  const kb = Math.round(file.size / 1024);
  setStatus(`已選擇檔案：${file.name}（約 ${kb} KB）→ 轉換中…`);

  try {
    pendingDataUrl = await readFileAsDataUrl(file);
    setStatus(`已完成 Base64 轉換：${file.name}（約 ${kb} KB）。`);
  } catch {
    pendingDataUrl = null;
    setStatus("讀取圖片失敗（FileReader error）。");
  }
});

els.addImageBtn.addEventListener("click", () => {
  if (!selectedFaq) return;
  if (!pendingDataUrl) {
    setStatus("請先選擇圖片檔（上傳後才會轉成 Base64）。");
    return;
  }

  const imgId = (els.imgIdInput.value || "").trim() || uid();
  const capZh = (els.capZh.value || "").trim();
  const capEn = (els.capEn.value || "").trim();

  selectedFaq.images = selectedFaq.images || [];
  selectedFaq.images.push({
    id: imgId,
    dataUrl: pendingDataUrl,
    caption: { zh: capZh, en: capEn }
  });

  // reset input for next add
  pendingDataUrl = null;
  els.fileInput.value = "";
  els.imgIdInput.value = "";
  els.capZh.value = "";
  els.capEn.value = "";

  renderPreview();
  setStatus(`已加入圖片：${imgId}`);
});

els.saveDraftBtn.addEventListener("click", () => {
  if (!data) return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  setStatus("已儲存草稿到 LocalStorage。");
});

els.loadDraftBtn.addEventListener("click", () => {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) {
    setStatus("LocalStorage 沒有草稿可載入。");
    return;
  }
  try {
    data = JSON.parse(raw);
    populateFaqSelect();
    setStatus("已從 LocalStorage 載入草稿。");
  } catch {
    setStatus("草稿格式錯誤，無法載入。");
  }
});

els.exportBtn.addEventListener("click", () => {
  if (!data) return;

  // ensure structure
  data.meta = data.meta || {};
  data.meta.lastUpdated = new Date().toISOString().slice(0, 10);

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "faqs.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setStatus("已匯出 faqs.json（下載完成後，用它覆蓋 assets/faqs.json 即可發布）。");
});

(async function init() {
  await loadJson();
  populateFaqSelect();
  setStatus("已載入 faqs.json。選一題開始加圖片吧。");
})();
