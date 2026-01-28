const DRAFT_KEY = "robot_fqa_admin_draft_v2";

let data = null;
let selectedFaq = null;
let pendingDataUrl = null;

const els = {
  faqSelect: document.getElementById("faqSelect"),
  faqId: document.getElementById("faqId"),

  fileInput: document.getElementById("fileInput"),
  imgIdInput: document.getElementById("imgIdInput"),

  capZh: document.getElementById("capZh"),
  capZhCN: document.getElementById("capZhCN"),
  capTh: document.getElementById("capTh"),
  capEn: document.getElementById("capEn"),

  addImageBtn: document.getElementById("addImageBtn"),
  exportBtn: document.getElementById("exportBtn"),
  saveDraftBtn: document.getElementById("saveDraftBtn"),
  loadDraftBtn: document.getElementById("loadDraftBtn"),

  preview: document.getElementById("preview"),
  status: document.getElementById("status"),
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
    .replaceAll("'", "&#39;");
}

async function loadJson() {
  const res = await fetch("./assets/faqs.json", { cache: "no-store" });
  data = await res.json();
}

function populateFaqSelect() {
  els.faqSelect.innerHTML = data.faqs
    .map((f) => {
      const title = f.question?.zh || f.question?.en || "";
      return `<option value="${escapeHtml(f.id)}">${escapeHtml(f.id)} — ${escapeHtml(title)}</option>`;
    })
    .join("");

  els.faqSelect.addEventListener("change", () => {
    selectFaqById(els.faqSelect.value);
  });

  selectFaqById(data.faqs[0]?.id);
}

function selectFaqById(id) {
  selectedFaq = data.faqs.find((f) => f.id === id) || null;
  els.faqId.value = selectedFaq?.id || "";

  pendingDataUrl = null;
  els.fileInput.value = "";
  els.imgIdInput.value = "";

  els.capZh.value = "";
  els.capZhCN.value = "";
  els.capTh.value = "";
  els.capEn.value = "";

  renderPreview();
  setStatus("");
}

function renderPreview() {
  if (!selectedFaq) return;

  const imgs = selectedFaq.images || [];
  els.preview.innerHTML = imgs
    .map((img, idx) => {
      const capZh = img.caption?.zh || "";
      const capZhCN = img.caption?.["zh-CN"] || "";
      const capTh = img.caption?.th || "";
      const capEn = img.caption?.en || "";

      return `
        <div class="preview-item">
          <img src="${escapeHtml(img.src || "")}" alt="">
          <div class="cap">
            <div><b>ID:</b> ${escapeHtml(img.id || "")}</div>
            <div><b>zh:</b> ${escapeHtml(capZh)}</div>
            <div><b>zh-CN:</b> ${escapeHtml(capZhCN)}</div>
            <div><b>th:</b> ${escapeHtml(capTh)}</div>
            <div><b>en:</b> ${escapeHtml(capEn)}</div>
            <div style="margin-top:10px;">
              <button class="btn small ghost" data-action="remove" data-idx="${idx}">移除</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  els.preview.querySelectorAll("[data-action='remove']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      if (!Number.isFinite(idx)) return;
      selectedFaq.images = selectedFaq.images || [];
      selectedFaq.images.splice(idx, 1);
      renderPreview();
      setStatus("已移除圖片（尚未匯出）");
    });
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

els.fileInput.addEventListener("change", async () => {
  const file = els.fileInput.files?.[0];
  if (!file) {
    pendingDataUrl = null;
    return;
  }
  pendingDataUrl = await readFileAsDataURL(file);
  setStatus("圖片已載入（尚未加入 FAQ）");
});

els.addImageBtn.addEventListener("click", () => {
  if (!selectedFaq) return;

  if (!pendingDataUrl) {
    setStatus("請先選擇圖片檔案");
    return;
  }

  const imgId = (els.imgIdInput.value || "").trim() || uid();

  const cap = {
    zh: (els.capZh.value || "").trim(),
    "zh-CN": (els.capZhCN.value || "").trim(),
    th: (els.capTh.value || "").trim(),
    en: (els.capEn.value || "").trim(),
  };

  selectedFaq.images = selectedFaq.images || [];
  selectedFaq.images.push({
    id: imgId,
    src: pendingDataUrl,
    caption: cap,
  });

  // reset inputs
  pendingDataUrl = null;
  els.fileInput.value = "";
  els.imgIdInput.value = "";
  els.capZh.value = "";
  els.capZhCN.value = "";
  els.capTh.value = "";
  els.capEn.value = "";

  renderPreview();
  setStatus("已加入圖片（請記得匯出 JSON）");
});

els.exportBtn.addEventListener("click", () => {
  if (!data) return;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "faqs.json";
  a.click();
  URL.revokeObjectURL(a.href);

  setStatus("已匯出 faqs.json（請將下載檔案 commit 回 repo 的 assets/faqs.json）");
});

els.saveDraftBtn.addEventListener("click", () => {
  if (!data) return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  setStatus("已儲存草稿到本機（localStorage）");
});

els.loadDraftBtn.addEventListener("click", () => {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) {
    setStatus("找不到草稿");
    return;
  }
  try {
    data = JSON.parse(raw);
    populateFaqSelect();
    setStatus("已載入草稿（localStorage）");
  } catch {
    setStatus("草稿格式錯誤，無法載入");
  }
});

(async function main() {
  await loadJson();
  populateFaqSelect();
  setStatus("已載入 assets/faqs.json");
})();
