"""ReportLab PDF: a companion document organized by Maryland form sections.

Same look as the in-app report (frontend/src/lib/disclosure/report.ts): Work Sans,
the app's blue, its grade colors and its logo. Keep the colors in sync with that file.
Layout is drawn straight onto the canvas with y measured from the top of the page.
"""
import io
import re
from datetime import date

from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas

from .. import costs
from ..config import DISCLAIMER, ROOT
from ..grading import LETTER_WORD, LETTERS, URGENCY_LABEL
from . import mapping

INK = (14, 27, 45)
BLUE = (19, 81, 166)
MUTED = (80, 89, 102)
SOFT = (98, 107, 120)
RULE = (221, 226, 230)
TINT = (237, 240, 244)
WHITE = (255, 255, 255)
GRADE_FILL = {"A": (36, 144, 87), "B": (124, 157, 48), "C": (240, 187, 59),
              "D": (238, 122, 31), "F": (208, 29, 33)}
# Text colour that stays readable on each grade fill.
GRADE_INK = {"A": WHITE, "B": (29, 42, 0), "C": (43, 29, 0), "D": (43, 19, 0), "F": WHITE}

GRADING_RULE = "Overall grade = the worst confirmed finding's worst-end letter. Never an average."
COST_CAPTION = "Estimate — varies by region and contractor."

FONT_DIR = ROOT / "frontend" / "public" / "fonts"
_FONT_FILES = {"r": ("WorkSans", "WorkSans-Regular.ttf", "Helvetica"),
               "s": ("WorkSans-SemiBold", "WorkSans-SemiBold.ttf", "Helvetica-Bold"),
               "b": ("WorkSans-Bold", "WorkSans-Bold.ttf", "Helvetica-Bold"),
               "x": ("WorkSans-ExtraBold", "WorkSans-ExtraBold.ttf", "Helvetica-Bold")}
_FONTS = None


def _fonts() -> dict:
    """Embed Work Sans if its files are present; otherwise fall back to Helvetica."""
    global _FONTS
    if _FONTS is None:
        try:
            for name, file, _ in _FONT_FILES.values():
                if name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
            _FONTS = {k: v[0] for k, v in _FONT_FILES.items()}
        except Exception:
            _FONTS = {k: v[2] for k, v in _FONT_FILES.items()}
    return _FONTS


def _fade(c, a):
    return tuple(round(v * a + 255 * (1 - a)) for v in c)


def _range_letters(f):
    """['C', 'D'] for a graded finding (best..worst), None when it can't be graded."""
    g = f["grade"]
    if not g:
        return None
    best = g["text"][0]
    return [best] if best == g["worst"] else [best, g["worst"]]


def _price(f):
    return f["cost"]["text"] if f["cost"] else "No estimate"


class _Page:
    """Canvas wrapper with top-origin coordinates and the report's drawing primitives."""

    def __init__(self, buf):
        self.W, self.H = letter
        self.c = rl_canvas.Canvas(buf, pagesize=letter, pageCompression=1)
        self.c.setTitle("Disclosure report")
        self.c.setAuthor("Disclosure")
        self.f = _fonts()
        self.M = 42
        self.CW = self.W - 2 * self.M
        self.TOP = 39
        self.BOTTOM = self.H - 62
        self.TRACK = 0.7

    # -- primitives --------------------------------------------------------
    def fill(self, c):
        self.c.setFillColorRGB(*(v / 255 for v in c))

    def stroke(self, c):
        self.c.setStrokeColorRGB(*(v / 255 for v in c))

    def font(self, size, w="r", color=INK):
        self.cur = (self.f[w], size)
        self.c.setFont(*self.cur)
        self.fill(color)

    def width(self, s, track=0.0):
        return pdfmetrics.stringWidth(s, *self.cur) + track * len(s)

    def text(self, s, x, y, align="left", track=0.0, middle=False):
        if middle:  # jsPDF's baseline:"middle"
            y += self.cur[1] * 0.35
        w = self.width(s, track)
        x = x - w if align == "right" else x - w / 2 if align == "center" else x
        t = self.c.beginText(x, self.H - y)
        t.setFont(*self.cur)
        t.setCharSpace(track)
        t.textOut(s)
        self.c.drawText(t)

    def lines(self, ls, x, y, lh):
        for i, s in enumerate(ls):
            self.text(s, x, y + i * lh)

    def wrap(self, s, w):
        return simpleSplit(str(s), *self.cur, w) or [""]

    def clip(self, s, w, track=0.0):
        """Single line that fits in w points, ending in an ellipsis if it had to be cut."""
        s = str(s)
        if self.width(s, track) <= w:
            return s
        while s and self.width(s + "…", track) > w:
            s = s[:-1]
        return s.rstrip() + "…"

    def hline(self, y, color, width, x1=None, x2=None):
        self.stroke(color)
        self.c.setLineWidth(width)
        self.c.line(self.M if x1 is None else x1, self.H - y, self.W - self.M if x2 is None else x2, self.H - y)

    def vline(self, x, y1, y2, color=RULE, width=0.75):
        self.stroke(color)
        self.c.setLineWidth(width)
        self.c.line(x, self.H - y1, x, self.H - y2)

    def rrect(self, x, top, w, h, r, fill=None, stroke=None, sw=0.75):
        if fill:
            self.fill(fill)
        if stroke:
            self.stroke(stroke)
            self.c.setLineWidth(sw)
        self.c.roundRect(x, self.H - top - h, w, h, r, stroke=1 if stroke else 0, fill=1 if fill else 0)

    def label(self, s, x, y, color=MUTED, size=7.1, align="left"):
        """Small uppercase label with letter-spacing, like the app's section labels."""
        self.font(size, "s", color)
        self.text(s.upper(), x, y, align=align, track=self.TRACK)

    # -- shared pieces -----------------------------------------------------
    def logo(self, x, top, s):
        """The app's logo: rounded blue square, house outline, check."""
        k = s / 32
        self.rrect(x, top, s, s, 10 * k, fill=BLUE)
        self.stroke(WHITE)
        self.c.setLineWidth(2.2 * k)
        self.c.setLineCap(1)
        self.c.setLineJoin(1)

        def poly(pts, closed):
            p = self.c.beginPath()
            p.moveTo(x + pts[0][0] * k, self.H - top - pts[0][1] * k)
            for px, py in pts[1:]:
                p.lineTo(x + px * k, self.H - top - py * k)
            if closed:
                p.close()
            self.c.drawPath(p, stroke=1, fill=0)

        poly([(7, 15), (16, 7.5), (25, 15), (25, 24.5), (7, 24.5)], True)
        poly([(12.2, 16.6), (15, 19.4), (20, 14.4)], False)
        self.c.setLineCap(0)
        self.c.setLineJoin(0)

    def header(self, logo_size, name_size, right, rule_w):
        """Logo + wordmark on the left, running label on the right. Returns the rule's y."""
        self.logo(self.M, self.TOP, logo_size)
        self.font(name_size, "x")
        self.text("Disclosure", self.M + logo_size + 7.5, self.TOP + logo_size / 2, middle=True)
        self.label(right, self.W - self.M, self.TOP + logo_size / 2 + 2.5, MUTED, 7.5, "right")
        rule_y = self.TOP + logo_size + (12 if logo_size > 20 else 9)
        self.hline(rule_y, INK, rule_w)
        return rule_y

    def new_page(self):
        self.c.showPage()
        return self.header(16.5, 11.25, "Seller Defect Documentation", 0.75)

    def tiles(self, x, top, size, letters):
        """One filled tile per letter in the range. Returns the width used."""
        if not letters:
            self.font(size * 0.3, "s", MUTED)
            w = self.width("Can't grade") + size * 0.5
            self.rrect(x, top, w, size, 3, fill=RULE)
            self.font(size * 0.3, "s", MUTED)  # rrect changed the fill color
            self.text("Can't grade", x + w / 2, top + size / 2, align="center", middle=True)
            return w
        cx = x
        for ltr in letters:
            self.rrect(cx, top, size, size, 3, fill=GRADE_FILL[ltr])
            self.font(size * 0.58, "x", GRADE_INK[ltr])
            self.text(ltr, cx + size / 2, top + size / 2, align="center", middle=True)
            cx += size + 2
        return cx - x - 2

    def footer(self, page, total):
        self.hline(self.H - 48, RULE, 0.75)
        self.font(7.1, "r", MUTED)
        self.text(DISCLAIMER, self.M, self.H - 34)
        self.font(7.1, "s", MUTED)
        self.text(f"Page {page} of {total}", self.W - self.M, self.H - 34, align="right")


def _cover(p, zip_code, findings, items, overall):
    M, CW, W = p.M, p.CW, p.W
    y = p.header(23, 16, "Property Condition Report", 1.5)

    p.label("Companion report", M, y + 38, BLUE, 7.9)
    h1 = 33
    p.font(h1, "x")
    while p.width("Seller Defect Documentation") > CW and h1 > 20:
        h1 -= 0.5
        p.font(h1, "x")
    p.text("Seller Defect Documentation", M, y + 38 + 9 + h1 * 0.85)
    p.font(9.75, "r", MUTED)
    p.text(mapping.form_title(), M, y + 38 + 9 + h1 * 0.85 + 19)
    y = y + 38 + 9 + h1 * 0.85 + 19 + 21

    # Prepared for / Property / Generated (the backend only knows the ZIP)
    meta = [("Prepared for", "Not provided", False),
            ("Property", f"ZIP {zip_code}" if zip_code else "Not provided", bool(zip_code)),
            ("Generated", f"{date.today():%B} {date.today().day}, {date.today().year}", True)]
    col_w = CW / 3
    p.hline(y, RULE, 0.75)
    for i, (k, v, given) in enumerate(meta):
        x = M + i * col_w + (12 if i else 0)
        if i:
            p.vline(M + i * col_w, y, y + 44)
        p.label(k, x, y + 18)
        p.font(9.75, "s", INK if given else SOFT)
        p.text(p.clip(v, col_w - 16), x, y + 34)
    y += 44
    p.hline(y, RULE, 0.75)

    # Overall grade card
    y += 21
    card_h = 135
    p.rrect(M, y, CW, card_h, 3, fill=TINT)
    tx, ty, ts = M + 18, y + 18, 99
    color = GRADE_FILL[overall] if overall else RULE
    ink = GRADE_INK[overall] if overall else MUTED
    p.rrect(tx, ty, ts, ts, 3, fill=color)
    p.font(57, "x", ink)
    p.text(overall or "–", tx + ts / 2, ty + 44, align="center", middle=True)
    p.label(LETTER_WORD[overall] if overall else "No grade", tx + ts / 2, ty + 85, ink, 8.25, "center")

    rx = tx + ts + 21
    rw = M + CW - 18 - rx
    cy = y + card_h / 2
    p.font(13.5, "b")
    p.text("Overall grade", rx, cy - 30)
    p.font(7.9, "r", MUTED)
    n = len(findings)
    p.text(f"{n} confirmed finding{'' if n == 1 else 's'}", rx + rw, cy - 30, align="right")
    p.font(9.4, "r", MUTED)
    p.lines(p.wrap(GRADING_RULE, rw), rx, cy - 12, 9.4 * 1.55)
    cell_w = (rw - 4 * 3) / 5
    for i, ltr in enumerate(LETTERS):
        on = overall == ltr
        cx = rx + i * (cell_w + 3)
        p.rrect(cx, cy + 14, cell_w, 18, 2.5, fill=GRADE_FILL[ltr] if on else _fade(GRADE_FILL[ltr], 0.2))
        p.font(8.25, "x" if on else "b", GRADE_INK[ltr] if on else MUTED)
        p.text(ltr, cx + cell_w / 2, cy + 23, align="center", middle=True)
    y += card_h + 30

    # Summary table
    p.font(18, "b")
    p.text("Summary of findings", M, y)
    y += 14
    cols = [("#", M, 21), ("Finding", M + 21, 135), ("Form section", M + 156, 120),
            ("Grade", M + 276, 62), ("Urgency", M + 338, 85)]

    def table_head(y):
        for i, (h, x, _) in enumerate(cols):
            p.label(h, x + (6 if i else 0), y + 14)
        p.label("Est. cost", W - M, y + 14, MUTED, 7.1, "right")
        y += 22
        p.hline(y, INK, 0.75)
        return y

    y = table_head(y)
    row = 30
    for i, f in enumerate(items):
        if y + row > p.BOTTOM:
            y = p.new_page() + 20
            y = table_head(y)
        base = y + 19
        p.font(9, "r", MUTED)
        p.text(str(i + 1), cols[0][1], base)
        p.font(9, "s")
        p.text(p.clip(f["label"], cols[1][2] - 10), cols[1][1] + 6, base)
        p.font(9, "r", MUTED)
        p.text(p.clip(mapping.section_short(f["defect_type"]), cols[2][2] - 10), cols[2][1] + 6, base)
        p.tiles(cols[3][1] + 6, y + 6, 18, _range_letters(f))
        p.font(9, "r")
        p.text(p.clip(f["urgency_label"], cols[4][2] - 8), cols[4][1] + 6, base)
        p.text(_price(f), W - M, base, align="right")
        y += row
        p.hline(y, RULE, 0.75)
    if not items:
        p.font(9.75, "r", MUTED)
        p.text("No confirmed findings.", M, y + 19)
        y += row
        p.hline(y, RULE, 0.75)
    priced = [f["cost"] for f in items if f["cost"]]
    if priced and y + 32 <= p.BOTTOM:
        low, high = sum(c["low"] for c in priced), sum(c["high"] for c in priced)
        p.font(9.75, "s")
        p.text("Total estimated cost", M, y + 20)
        p.font(10, "b")
        p.text(costs.format_range({"low": low, "high": high}), W - M, y + 20, align="right")
        y += 32
        p.hline(y, INK, 1.5)
    if y + 40 <= p.BOTTOM:
        p.font(7.9, "r", MUTED)
        p.lines(p.wrap(f"{COST_CAPTION} Cost ranges come from a fixed regional table, not a "
                       "contractor quote. Findings without an estimate are left out of the total.", 420),
                M, y + 16, 7.9 * 1.55)


def _finding_page(p, n, f, photo_path):
    M, CW, W = p.M, p.CW, p.W
    y = p.new_page() + 24
    letters = _range_letters(f)
    worst = letters[-1] if letters else None
    accent = GRADE_FILL[worst] if worst else MUTED

    # Eyebrow, title, grade tiles
    section = mapping.section_short(f["defect_type"])
    m = re.match(r"^(\d+)\.\s*(.*)$", section)
    eyebrow = f"Section {m.group(1)} · {m.group(2)}" if m else section
    p.font(7.9, "s", BLUE)
    p.label(p.clip(eyebrow.upper(), CW, p.TRACK), M, y + 8, BLUE, 7.9)
    p.font(25.5, "x")
    title = p.wrap(f"Finding {n}: {f['label']}", CW - 130)
    p.lines(title, M, y + 8 + 8 + 20, 25.5 * 1.1)
    title_bottom = y + 8 + 8 + 20 + (len(title) - 1) * 28 + 7
    size = 36
    tiles_w = len(letters) * size + (len(letters) - 1) * 2 if letters else 80
    p.tiles(W - M - tiles_w, title_bottom - size, size, letters)
    if worst:
        p.label(LETTER_WORD[worst], W - M - tiles_w - 8, title_bottom - size / 2 + 2.5, MUTED, 7.5, "right")
    y = title_bottom + 15

    # Photo (aspect-preserving, centered in a bordered frame)
    fh = 250
    p.rrect(M, y, CW, fh, 3, fill=TINT, stroke=RULE)
    try:
        img = ImageReader(str(photo_path))
        iw0, ih0 = img.getSize()
        k = min((CW - 8) / iw0, (fh - 8) / ih0)
        iw, ih = iw0 * k, ih0 * k
        p.c.drawImage(img, M + (CW - iw) / 2, p.H - y - fh + (fh - ih) / 2, iw, ih)
    except Exception:
        p.font(8.25, "r", MUTED)
        p.text("Photo unavailable", M + CW / 2, y + fh / 2, align="center")
    y += fh + 18

    # Severity / Urgency / Estimated cost
    sh = 62
    p.hline(y, INK, 0.75)
    p.hline(y + sh, RULE, 0.75)
    c3 = CW / 3
    p.vline(M + c3, y, y + sh)
    p.vline(M + 2 * c3, y, y + sh)
    p.label("Severity", M, y + 19)
    sev = f["severity"] or 0
    for s in range(5):
        on = s < sev
        p.rrect(M + s * 12.75, y + 30, 10.5, 10.5, 1.5, fill=accent if on else TINT,
                stroke=_fade(GRADE_INK[worst] if worst else INK, 0.35) if on else RULE, sw=0.5)
    p.font(11.25, "s")
    p.text(f"{sev} of 5", M + 5 * 12.75 + 8, y + 39)

    p.label("Urgency", M + c3 + 12, y + 19)
    u_label = f["urgency_label"]
    if f["urgency"] == "immediate":
        p.font(9, "s", WHITE)
        uw = p.width(u_label) + 16
        p.rrect(M + c3 + 12, y + 27, uw, 17, 8.5, fill=GRADE_FILL["F"])
        p.font(9, "s", WHITE)
        p.text(u_label, M + c3 + 12 + uw / 2, y + 35.5, align="center", middle=True)
    else:
        p.font(11.25, "s")
        p.text(u_label, M + c3 + 12, y + 39)

    p.label("Estimated cost", M + 2 * c3 + 12, y + 19)
    p.font(11.25, "s")
    p.text(_price(f), M + 2 * c3 + 12, y + 37)
    p.font(7.5, "r", MUTED)
    p.text(p.clip(COST_CAPTION, c3 - 18), M + 2 * c3 + 12, y + 49)
    y += sh

    # What the photo shows
    text_x = M + 144
    p.label("What the photo shows", M, y + 30)
    p.font(12, "r")
    reason = p.wrap(f["reason"], CW - 144)
    p.lines(reason, text_x, y + 30, 12 * 1.55)
    y += 18 + len(reason) * 18.6 + 18
    p.hline(y, RULE, 0.75)

    # Professional
    pro = f["pro"] or ""
    p.label("Recommendation" if f["evaluation"] else "Typical professional", M, y + 25)
    p.font(9.75, "s")
    rec = f["evaluation"] or (f"{pro}." if pro else "")
    rec_lines = p.wrap(rec, CW - 144)
    p.lines(rec_lines, text_x, y + 25, 9.75 * 1.5)
    y += 18 + len(rec_lines) * 14.6 + 10
    p.hline(y, RULE, 0.75)
    if f["edited"]:
        p.font(7.9, "r", MUTED)
        p.text("Type or severity edited by the seller.", M, y + 18)


def build_pdf(zip_code, findings, overall_letter, photo_path_for) -> bytes:
    """findings: confirmed enriched findings. photo_path_for(photo_id) -> Path."""
    # Footers need the page total, so lay out once to count pages, then draw for real.
    buf = io.BytesIO()
    p = _Page(buf)
    items = [f for _, group in mapping.group_findings(findings) for f in group]
    pages = _count_pages(zip_code, findings, items, overall_letter, photo_path_for)
    # Real pass: draw each page, stamping the footer just before it is closed.
    _stamp = p.new_page

    page_no = [1]

    def new_page():
        p.footer(page_no[0], pages)
        page_no[0] += 1
        return _stamp()

    p.new_page = new_page
    _cover(p, zip_code, findings, items, overall_letter)
    for n, f in enumerate(items, 1):
        _finding_page(p, n, f, photo_path_for(f["id"]))
    p.footer(page_no[0], pages)
    p.c.showPage()
    p.c.save()
    return buf.getvalue()


def _count_pages(zip_code, findings, items, overall_letter, photo_path_for) -> int:
    p = _Page(io.BytesIO())
    count = [1]
    orig = p.new_page

    def new_page():
        count[0] += 1
        return orig()

    p.new_page = new_page
    _cover(p, zip_code, findings, items, overall_letter)
    for n, f in enumerate(items, 1):
        _finding_page(p, n, f, photo_path_for(f["id"]))
    return count[0]
