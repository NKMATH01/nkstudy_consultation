export async function downloadElementAsPdf(element: HTMLElement, filename: string) {
  const html2pdf = (await import("html2pdf.js")).default;

  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(element)
    .save();
}

// ========== 보고서 페이지 렌더링 공통 유틸 ==========

async function renderReportPage(
  reportHtml: string,
  pageNum: 1 | 2
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;

  const styleMatches = reportHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
  const styles = styleMatches ? styleMatches.join("") : "";

  const pageRegex = new RegExp(
    `<div class="page" id="page${pageNum}">[\\s\\S]*?<footer class="footer">[\\s\\S]*?</footer>`,
    "i"
  );
  const pageMatch = reportHtml.match(pageRegex);

  if (!pageMatch) {
    throw new Error(`페이지 ${pageNum}을 찾을 수 없습니다`);
  }

  const container = document.createElement("div");
  container.innerHTML = `${styles}<div style="width:210mm;min-height:297mm;height:297mm;background:white;padding:12mm 15mm;display:flex;flex-direction:column;position:relative;overflow:hidden;font-family:'Pretendard',sans-serif;color:#1f2937;box-sizing:border-box;">${pageMatch[0].replace(/<div class="page"[^>]*>/, "")}</div>`;
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css";
  document.head.appendChild(link);

  await new Promise((r) => setTimeout(r, 500));

  try {
    const pageEl = container.firstElementChild?.nextElementSibling as HTMLElement
      || container.querySelector("div[style]") as HTMLElement;
    if (!pageEl) throw new Error("페이지 요소를 찾을 수 없습니다");

    return await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: pageEl.scrollWidth,
      height: pageEl.scrollHeight,
    });
  } finally {
    document.body.removeChild(container);
    if (link.parentNode) document.head.removeChild(link);
  }
}

// ========== 이미지 다운로드 ==========

export async function downloadReportPageAsImage(
  reportHtml: string,
  pageNum: 1 | 2,
  filename: string
) {
  const canvas = await renderReportPage(reportHtml, pageNum);
  const imgData = canvas.toDataURL("image/jpeg", 0.9);
  const a = document.createElement("a");
  a.download = `${filename}_${pageNum}페이지.jpg`;
  a.href = imgData;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadHtmlAsPdf(htmlString: string, filename: string) {
  const html2pdf = (await import("html2pdf.js")).default;

  const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : htmlString;

  const styleMatches = htmlString.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
  const styles = styleMatches ? styleMatches.join("") : "";

  const container = document.createElement("div");
  container.innerHTML = styles + content;
  container.style.width = "190mm";
  container.style.padding = "10mm";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.background = "white";
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: [5, 5, 5, 5],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
