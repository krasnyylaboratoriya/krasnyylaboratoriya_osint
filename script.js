let DORKS = {};
let LOC = {};
const LOCALES_CACHE = {};

document.addEventListener("DOMContentLoaded", async () => {
  const langSwitch = document.getElementById("language-switch");
  const input = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const consoleOut = document.getElementById("console-output");
  const exportPdfBtn = document.getElementById("export-pdf");
  const resultsInfo = document.getElementById("results-info");

  const safeText = (el, txt) => {
    if (!el) return;
    if (txt === undefined || txt === null) return;
    el.textContent = String(txt);
  };

  async function fetchJSON(path) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn("fetchJSON error", path, e);
      return null;
    }
  }

  async function loadDorks() {
    DORKS = (await fetchJSON("./dorks.json")) || {};
  }

  async function loadLanguage(lang) {
    if (LOCALES_CACHE[lang]) {
      LOC = LOCALES_CACHE[lang];
      LOC._lang = lang;
      return LOC;
    }
    const data = await fetchJSON(`./locales/${lang}.json`);
    if (data) {
      LOCALES_CACHE[lang] = data;
      LOC = data;
      LOC._lang = lang;
      return LOC;
    }
    LOC = {
      title: "Krasnyy Laboratoriya",
      subtitle: "Open Source Intelligence Tool",
      description: "Locale files missing.",
      searchBtn: "Search",
      searchPlaceholder: "enter target or username...",
      controls_export_pdf: "Export as PDF",
      results_none: "Henüz sonuç yok",
      results_found: "results found",
      results_processing: "Processing...",
      console_sending: ">> Starting dork analysis: ",
      console_warn_no_input: "⚠ Please enter a target!",
      console_dorks_missing: "Dork list missing.",
      console_done: "✔ Done."
    };
    LOC._lang = "fallback";
    return LOC;
  }

  function applyLocaleToUI() {
    document.title = LOC.title || document.title;
    const headerH1 = document.querySelector("header h1");
    if (headerH1) headerH1.textContent = LOC.title || headerH1.textContent;
    safeText(document.getElementById("subtitle"), LOC.subtitle);
    safeText(document.getElementById("description"), LOC.description);
    if (searchBtn && LOC.searchBtn) searchBtn.textContent = LOC.searchBtn;
    if (input && LOC.searchPlaceholder) input.placeholder = LOC.searchPlaceholder;
    if (exportPdfBtn && LOC.controls_export_pdf) exportPdfBtn.textContent = LOC.controls_export_pdf;
    if (resultsInfo) safeText(resultsInfo, LOC.results_none || "Henüz sonuç yok");
    const sectionsMap = LOC.sections || {};
    document.querySelectorAll(".section .section-header").forEach((hdr) => {
      const key = hdr.dataset?.key;
      if (key && sectionsMap[key]) hdr.textContent = sectionsMap[key];
    });
  }

  function buildUrl(template, query) {
    const raw = (query || "").trim();
    const query_nospace = raw.replace(/\s+/g, "");
    const query_plus = raw.split(/\s+/).filter(Boolean).join("+");
    const query_q = encodeURIComponent('"' + raw + '"');
    const query_enc = encodeURIComponent(raw);
    return template
      .replace(/\{query_q\}/g, query_q)
      .replace(/\{query_nospace\}/g, query_nospace)
      .replace(/\{query_plus\}/g, query_plus)
      .replace(/\{query\}/g, query_enc);
  }

  function appendTypedLine(text, speed = 6) {
    return new Promise((resolve) => {
      if (!consoleOut) return resolve();
      const p = document.createElement("div");
      p.className = "typed";
      consoleOut.appendChild(p);
      let i = 0;
      const t = setInterval(() => {
        if (i < text.length) {
          p.textContent += text.charAt(i++);
          consoleOut.scrollTop = consoleOut.scrollHeight;
        } else {
          clearInterval(t);
          resolve();
        }
      }, speed);
    });
  }

  async function handleSearch() {
    try {
      const query = input?.value.trim() || "";
      if (!query) {
        await appendTypedLine(LOC.console_warn_no_input || "⚠ Please enter a target!");
        return;
      }
      consoleOut.innerHTML = "";
      safeText(resultsInfo, LOC.results_processing || "Processing...");
      await appendTypedLine((LOC.console_sending || ">> Starting dork analysis: ") + query);
      if (!Object.keys(DORKS).length) {
        await appendTypedLine(LOC.console_dorks_missing || "Dork list missing.");
        safeText(resultsInfo, LOC.results_none || "Henüz sonuç yok");
        return;
      }
      const order = Array.isArray(DORKS.priority_order) ? DORKS.priority_order : Object.keys(DORKS);
      let total = 0;
      for (const section of order) {
        if (section === "priority_order") continue;
        const arr = DORKS[section];
        if (!Array.isArray(arr) || arr.length === 0) continue;
        const secEl = document.createElement("div");
        secEl.className = "section";
        const header = document.createElement("div");
        header.className = "section-header";
        header.dataset.key = section;
        header.textContent = LOC.sections?.[section] || section.toUpperCase();
        secEl.appendChild(header);
        const linksDiv = document.createElement("div");
        linksDiv.className = "section-links";
        const urls = arr.map((t) => buildUrl(t, query));
        for (const u of urls) {
          const a = document.createElement("a");
          a.href = u;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = u.length > 200 ? u.slice(0, 196) + "..." : u;
          linksDiv.appendChild(a);
        }
        secEl.appendChild(linksDiv);
        consoleOut.appendChild(secEl);
        total += urls.length;
        await new Promise((r) => setTimeout(r, 8));
      }
      safeText(resultsInfo, total ? `${total} ${LOC.results_found || "results found"}` : (LOC.results_none || "Henüz sonuç yok"));
      await appendTypedLine(LOC.console_done || "✔ Done.");
      if (input) input.value = "";
    } catch (err) {
      console.error("handleSearch error", err);
      alert("Search error — check console.");
    }
  }

  function exportPdf() {
    try {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) return alert("jsPDF not loaded.");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const beginPage = () => {
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, W, H, "F");
        doc.setTextColor(255, 0, 0);
        doc.setFont("Courier", "normal");
      };
      beginPage();
      let y = 40;
      doc.setFontSize(12);
      doc.text(LOC.title || "Krasnyy Laboratoriya", 40, y);
      const now = new Date();
      const dateStr = now.toLocaleString(LOC._lang || "tr", { dateStyle: "medium", timeStyle: "short" });
      doc.setFontSize(9);
      doc.text(dateStr, 40, y + 16);
      y += 40;
      const query = input?.value.trim() || "";
      const order = Array.isArray(DORKS.priority_order) ? DORKS.priority_order : Object.keys(DORKS);
      for (const section of order) {
        if (section === "priority_order") continue;
        const arr = DORKS[section];
        if (!arr?.length) continue;
        const sectionName = LOC.sections?.[section] || section.toUpperCase();
        doc.setFontSize(11);
        doc.text(sectionName, 40, y);
        y += 12;
        doc.setFontSize(9);
        for (const t of arr) {
          const u = buildUrl(t, query);
          const lines = doc.splitTextToSize(u, W - 80);
          for (const ln of lines) {
            if (y > H - 60) {
              doc.addPage();
              beginPage();
              y = 40;
            }
            doc.text(ln, 60, y);
            y += 12;
          }
          y += 6;
        }
        y += 8;
      }
      doc.save(`krasnyy_links_${LOC._lang || "lang"}.pdf`);
    } catch (err) {
      console.error("exportPdf error", err);
      alert("PDF export failed — check console.");
    }
  }

  await loadDorks();
  await loadLanguage(langSwitch?.value || "tr");
  applyLocaleToUI();

  langSwitch?.addEventListener("change", async (e) => {
    await loadLanguage(e.target.value);
    applyLocaleToUI();
  });

  searchBtn?.addEventListener("click", handleSearch);
  input?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });
  exportPdfBtn?.addEventListener("click", exportPdf);
});
       
