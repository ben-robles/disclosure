"""Send a finished report PDF by email. The address and the PDF are never stored or logged."""
import re
import smtplib
import ssl
from email.message import EmailMessage

from . import config

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")


class MailError(Exception):
    pass


def configured() -> bool:
    return bool(config.SMTP_HOST and config.SMTP_FROM)


def valid_address(value: str) -> bool:
    return len(value) <= 254 and bool(EMAIL_RE.match(value))


def send_report(to: str, pdf: bytes, filename: str = "disclosure-report.pdf") -> None:
    msg = EmailMessage()
    msg["Subject"] = "Your Disclosure report"
    msg["From"] = config.SMTP_FROM
    msg["To"] = to
    msg.set_content(
        "Your Disclosure report is attached.\n\n"
        f"{config.DISCLAIMER}\n"
        "Disclosure does not keep a copy of this email or your address."
    )
    msg.add_attachment(pdf, maintype="application", subtype="pdf", filename=filename)
    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if config.SMTP_USER:
                smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise MailError(type(exc).__name__) from exc
