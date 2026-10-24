"""ReportLab PDF: a companion document organized by Maryland form sections."""
import io
from datetime import date
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from .. import costs
from ..config import DISCLAIMER, OVERALL_RULE
from ..grading import LETTER_WORD
from . import mapping

ACCENT = colors.HexColor("#1a4fb0")
GREY = colors.HexColor("#555555")


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=base["Title"], fontSize=22, textColor=ACCENT,
                                alignment=0, spaceAfter=6),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=13, spaceBefore=14,
                             spaceAfter=6),
        "body": ParagraphStyle("b", parent=base["BodyText"], fontSize=10, leading=14),
        "small": ParagraphStyle("s", parent=base["BodyText"], fontSize=8.5, leading=11,
                                textColor=GREY),
        "bold": ParagraphStyle("bo", parent=base["BodyText"], fontSize=10.5, leading=14,
                               fontName="Helvetica-Bold"),
    }


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GREY)
    canvas.drawString(0.75 * inch, 0.5 * inch, DISCLAIMER)
    canvas.drawRightString(letter[0] - 0.75 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def _p(text, style):
    return Paragraph(escape(str(text)), style)


def _finding_block(f, photo_path, st):
    grade = f["grade"]
    if grade:
        grade_line = f"Grade {grade['text']} — {grade['word']}"
    else:
        grade_line = "No grade — can't tell from this photo"
    rows = [
        [_p(f["label"], st["bold"])],
        [_p(grade_line, st["body"])],
        [_p(f"Urgency: {f['urgency_label']}", st["body"])],
        [_p(f["reason"], st["body"])],
    ]
    if f["cost"]:
        rows.append([_p(f"Estimated cost: {f['cost']['text']} ({costs.region()}). "
                        "Estimate — varies by region and contractor.", st["body"])])
    if f["pro"]:
        rows.append([_p(f"Recommended professional: {f['pro']}", st["body"])])
    if f["evaluation"]:
        rows.append([_p(f["evaluation"], st["bold"])])
    if f["edited"]:
        rows.append([_p("Type or severity edited by the seller.", st["small"])])
    text_tbl = Table(rows, colWidths=[4.2 * inch])
    text_tbl.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0),
                                  ("TOPPADDING", (0, 0), (-1, -1), 1),
                                  ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
    try:
        img = Image(str(photo_path))
        scale = min(2.2 * inch / img.imageWidth, 2.2 * inch / img.imageHeight)
        img.drawWidth, img.drawHeight = img.imageWidth * scale, img.imageHeight * scale
    except Exception:
        img = _p("(photo unavailable)", st["small"])
    block = Table([[img, text_tbl]], colWidths=[2.4 * inch, 4.3 * inch])
    block.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([block, Spacer(1, 8)])


def build_pdf(zip_code, findings, overall_letter, photo_path_for) -> bytes:
    """findings: confirmed enriched findings. photo_path_for(photo_id) -> Path."""
    st = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.9 * inch,
        title="Disclosure report", author="Disclosure",
    )
    story = [
        _p("Disclosure report", st["title"]),
        _p(f"Prepared {date.today().isoformat()}"
           + (f" · ZIP {zip_code}" if zip_code else ""), st["small"]),
        Spacer(1, 6),
        _p(DISCLAIMER, st["bold"]),
        Spacer(1, 4),
        _p("This is a companion document organized by the sections of the "
           f"{mapping.form_title()}. It is not the official form and does not replace it. "
           "Every finding below was confirmed by the seller after an AI-assisted first pass "
           "on a single photo.", st["body"]),
        _p("Overall grade", st["h2"]),
    ]
    if overall_letter:
        story.append(_p(f"{overall_letter} — {LETTER_WORD[overall_letter]}", st["title"]))
    else:
        story.append(_p("No graded findings — get a licensed home inspector.", st["bold"]))
    story.append(_p(OVERALL_RULE, st["small"]))

    for heading, items in mapping.group_findings(findings):
        story.append(_p(heading, st["h2"]))
        for f in items:
            story.append(_finding_block(f, photo_path_for(f["id"]), st))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
