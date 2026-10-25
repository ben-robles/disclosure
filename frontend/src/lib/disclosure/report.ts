import { formatCost, lookupCost, COST_TABLE_META } from "./costs";
import { worstEnd, formatRange, GRADING_RULE, LETTER_WORD, needsPro, overallGrade, URGENCY_LABEL, type Letter } from "./grading";
import { JURISDICTION, MD_SECTIONS, sectionNumber } from "./jurisdiction";
import { DISCLAIMER, viewFinding, type Session } from "./store";

export function buildReport(session: Session) {
  const items = session.photos
    .filter((p) => p.confirmed && p.result)
    .map((p) => {
      const f = viewFinding(p);
      return { photo: p, ...f, cost: lookupCost(f.type, f.severity), section: MD_SECTIONS[f.type] };
    });
  const sections = new Map<string, typeof items>();
  for (const it of items) sections.set(it.section, [...(sections.get(it.section) ?? []), it]);
  return { items, sections: [...sections.entries()].sort((a, b) => sectionNumber(a[0]) - sectionNumber(b[0])), overall: overallGrade(items.map((i) => i.range)) };
}

/** Sum of the low and high ends over findings that have a cost estimate; null if none do. */
export function totalCost(items: { cost: { low: number; high: number } | null }[]) {
  const priced = items.filter((i) => i.cost);
  if (!priced.length) return null;
  return {
    low: priced.reduce((n, i) => n + i.cost!.low, 0),
    high: priced.reduce((n, i) => n + i.cost!.high, 0),
  };
}

type RGB = [number, number, number];
const TEAL: RGB = [0, 99, 100];
const INK: RGB = [28, 32, 36];
const MUTED: RGB = [105, 112, 120];
const RULE: RGB = [214, 218, 222];
const TINT: RGB = [237, 245, 245];
const TONE: Record<"good" | "mid" | "bad" | "none", RGB> = {
  good: [22, 101, 70], mid: [150, 94, 8], bad: [178, 38, 28], none: [105, 112, 120],
};
const toneFor = (range: Letter[] | null): RGB => {
  if (!range) return TONE.none;
  const w = worstEnd(range);
  return w === "A" || w === "B" ? TONE.good : w === "C" ? TONE.mid : TONE.bad;
};
const range$ = (r: { low: number; high: number } | null) => formatCost(r);

export async function generatePdf(session: Session): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { sections, overall, items: captured } = buildReport(session);
  // Same order everywhere: by form section, so table row N is "Finding N".
  const items = sections.flatMap(([, list]) => list);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CW = W - M * 2;
  const BOTTOM = H - 56;
  let y = 0;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (size: number, bold = false, color: RGB = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    ink(color);
  };
  const wrap = (s: string, w: number): string[] => doc.splitTextToSize(s, w);
  const clip = (s: string, w: number) => wrap(s, w)[0] ?? "";

  const runningHeader = () => {
    font(9, false, MUTED);
    doc.text(session.address || "Disclosure report", M, 32);
    doc.text("Seller Defect Documentation", W - M, 32, { align: "right" });
    stroke(RULE); doc.setLineWidth(0.5); doc.line(M, 40, W - M, 40);
    y = 60;
  };
  const newPage = () => { doc.addPage(); runningHeader(); };

  const badge = (x: number, top: number, w: number, h: number, label: string, word: string | null, c: RGB, size: number) => {
    fill(c); doc.roundedRect(x, top, w, h, 6, 6, "F");
    font(size, true, [255, 255, 255]);
    if (word) {
      doc.text(label, x + w / 2, top + h * 0.5, { align: "center" });
      font(Math.max(8, size * 0.38), false, [255, 255, 255]);
      doc.text(word, x + w / 2, top + h * 0.5 + size * 0.5, { align: "center" });
    } else {
      doc.text(label, x + w / 2, top + h / 2 + size * 0.35, { align: "center" });
    }
  };

  // ---- Cover ----
  fill(TEAL); doc.rect(0, 0, W, 120, "F");
  font(11, false, [200, 230, 230]); doc.text("DISCLOSURE", M, 48);
  font(24, true, [255, 255, 255]); doc.text("Seller Defect Documentation", M, 78);
  font(11, false, [220, 240, 240]);
  doc.text(`Companion report · ${JURISDICTION.name} ${JURISDICTION.form}`, M, 100);
  y = 150;

  const meta: [string, string][] = [
    ["Prepared for", session.sellerName || "—"],
    ["Property", [session.address, session.zip].filter(Boolean).join(", ") || "—"],
    ["Generated", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
  ];
  for (const [k, v] of meta) {
    font(9, true, MUTED); doc.text(k.toUpperCase(), M, y);
    font(12, false, INK); doc.text(clip(v, CW * 0.6), M + 90, y);
    y += 20;
  }

  // Overall grade card
  y += 10;
  fill(TINT); doc.roundedRect(M, y, CW, 92, 8, 8, "F");
  badge(M + 16, y + 14, 90, 64, overall ?? "–", overall ? LETTER_WORD[overall] : "No grade", toneFor(overall ? [overall] : null), 34);
  font(13, true); doc.text("Overall grade", M + 124, y + 32);
  font(9.5, false, MUTED);
  doc.text(wrap(GRADING_RULE, CW - 140), M + 124, y + 48);
  doc.text(`${captured.length} confirmed finding${captured.length === 1 ? "" : "s"}`, M + 124, y + 76);
  y += 92 + 28;

  // Summary table
  font(14, true); doc.text("Summary of findings", M, y); y += 14;
  const cols = [
    { h: "#", x: M, w: 22 },
    { h: "Finding", x: M + 22, w: 130 },
    { h: "Form section", x: M + 152, w: 130 },
    { h: "Grade", x: M + 282, w: 58 },
    { h: "Urgency", x: M + 340, w: 78 },
    { h: "Est. cost", x: M + 418, w: CW - 418 },
  ];
  const tableHead = () => {
    fill(TEAL); doc.rect(M, y, CW, 20, "F");
    font(9, true, [255, 255, 255]);
    for (const c of cols) doc.text(c.h, c.x + 6, y + 13.5);
    y += 20;
  };
  tableHead();
  items.forEach((it, i) => {
    if (y + 26 > BOTTOM) { newPage(); tableHead(); }
    if (i % 2) { fill([247, 248, 249]); doc.rect(M, y, CW, 26, "F"); }
    font(9.5, false);
    doc.text(String(i + 1), cols[0]!.x + 6, y + 16);
    doc.text(clip(it.title, cols[1]!.w - 10), cols[1]!.x + 6, y + 16);
    doc.text(clip(it.section, cols[2]!.w - 10), cols[2]!.x + 6, y + 16);
    const g = it.range ? formatRange(it.range) : "None";
    fill(toneFor(it.range)); doc.roundedRect(cols[3]!.x + 4, y + 5, 44, 16, 3, 3, "F");
    font(9, true, [255, 255, 255]); doc.text(g, cols[3]!.x + 26, y + 16.5, { align: "center" });
    font(9.5, false);
    doc.text(clip(URGENCY_LABEL[it.urgency], cols[4]!.w - 8), cols[4]!.x + 6, y + 16);
    doc.text(clip(range$(it.cost), cols[5]!.w - 8), cols[5]!.x + 6, y + 16);
    y += 26;
  });
  if (!items.length) { font(10, false, MUTED); doc.text("No confirmed findings.", M + 6, y + 16); y += 26; }
  const total = totalCost(items);
  if (total && y + 28 <= BOTTOM) {
    stroke(TEAL); doc.setLineWidth(1); doc.line(M, y, W - M, y);
    font(10, true); doc.text("Total estimated cost", M + 6, y + 18);
    doc.text(range$(total), W - M - 6, y + 18, { align: "right" });
    y += 28;
  }
  if (y + 40 <= BOTTOM) {
    font(8.5, false, MUTED);
    doc.text(wrap(`${COST_TABLE_META.caption} Cost ranges come from a fixed regional table, not a contractor quote. Findings without an estimate are left out of the total.`, CW), M, y + 12);
  }

  // ---- Findings: two per page, grouped by form section ----
  let n = 0;
  let onPage = 0;
  for (const [section, list] of sections) {
    for (const it of list) {
      if (onPage % 2 === 0) { newPage(); onPage = 0; }
      else { stroke(RULE); doc.setLineWidth(0.5); doc.line(M, y - 6, W - M, y - 6); }
      const top = y;
      n++;
      const c = toneFor(it.range);

      // Section label + heading
      font(9, true, TEAL); doc.text(section.toUpperCase(), M, top + 4);
      font(15, true); doc.text(clip(`Finding ${n} — ${it.title}`, CW - 110), M, top + 24);
      const gl = it.range ? formatRange(it.range) : "No grade";
      badge(W - M - 96, top + 8, 96, 26, gl, null, c, 13);

      // Photo (aspect-preserving, centered in a bordered frame)
      const fx = M, fy = top + 40, fw = 230, fh = 190;
      fill([245, 246, 247]); stroke(RULE); doc.setLineWidth(0.5); doc.rect(fx, fy, fw, fh, "FD");
      try {
        const props = doc.getImageProperties(it.photo.dataUrl);
        const k = Math.min((fw - 8) / props.width, (fh - 8) / props.height);
        const iw = props.width * k, ih = props.height * k;
        doc.addImage(it.photo.dataUrl, props.fileType, fx + (fw - iw) / 2, fy + (fh - ih) / 2, iw, ih);
      } catch {
        font(9, false, MUTED); doc.text("Photo unavailable", fx + fw / 2, fy + fh / 2, { align: "center" });
      }

      // Right column
      const rx = fx + fw + 20, rw = W - M - rx;
      let ry = fy + 10;
      font(8.5, true, MUTED); doc.text("SEVERITY", rx, ry); ry += 8;
      const segW = (rw - 4 * 3) / 5;
      for (let s = 0; s < 5; s++) {
        fill(s < it.severity ? c : RULE);
        doc.roundedRect(rx + s * (segW + 3), ry, segW, 8, 2, 2, "F");
      }
      font(9, false, MUTED); doc.text(`${it.severity} of 5`, rx, ry + 22);
      ry += 40;

      font(8.5, true, MUTED); doc.text("URGENCY", rx, ry); ry += 6;
      const urgent = it.urgency === "immediate";
      const uw = doc.getTextWidth(URGENCY_LABEL[it.urgency]) + 20;
      fill(urgent ? TONE.bad : TINT); doc.roundedRect(rx, ry, uw + 10, 18, 9, 9, "F");
      font(9.5, true, urgent ? [255, 255, 255] : TEAL);
      doc.text(URGENCY_LABEL[it.urgency], rx + (uw + 10) / 2, ry + 12.5, { align: "center" });
      ry += 36;

      font(8.5, true, MUTED); doc.text("ESTIMATED COST", rx, ry); ry += 15;
      font(14, true); doc.text(range$(it.cost), rx, ry); ry += 14;
      font(8, false, MUTED); doc.text(wrap(COST_TABLE_META.caption, rw), rx, ry);

      // Reason + recommendation under the photo
      let by = fy + fh + 18;
      font(8.5, true, MUTED); doc.text("WHAT THE PHOTO SHOWS", M, by); by += 14;
      font(10.5, false); const rl = wrap(it.reason, CW);
      doc.text(rl, M, by); by += rl.length * 14 + 6;

      const rec = needsPro(it.range) ? `Recommend evaluation by a licensed ${it.info.pro.toLowerCase()}.` : `Typical professional: ${it.info.pro}.`;
      fill(needsPro(it.range) ? [253, 240, 238] : TINT);
      doc.roundedRect(M, by, CW, 26, 4, 4, "F");
      fill(needsPro(it.range) ? TONE.bad : TEAL); doc.rect(M, by, 4, 26, "F");
      font(10, true, needsPro(it.range) ? TONE.bad : TEAL); doc.text(clip(rec, CW - 24), M + 14, by + 16.5);

      onPage++;
      y = top + 330;
    }
  }

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    stroke(RULE); doc.setLineWidth(0.5); doc.line(M, H - 44, W - M, H - 44);
    font(8.5, false, MUTED);
    doc.text(DISCLAIMER, M, H - 30);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 30, { align: "right" });
  }
  return doc.output("blob");
}
