import io

from PIL import Image, ImageOps, UnidentifiedImageError

from .config import MAX_IMAGE_EDGE


class BadImage(ValueError):
    pass


def sanitize(raw: bytes) -> bytes:
    """Strip EXIF (GPS, timestamps, device) and resize to max 1024 px on the long edge.

    Applies the EXIF orientation first, then rebuilds the image from pixels only,
    so no metadata survives. Returns JPEG bytes.
    """
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise BadImage("That file is not a readable image.") from exc
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    img.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE), Image.LANCZOS)
    clean = Image.new("RGB", img.size)
    clean.paste(img)
    out = io.BytesIO()
    clean.save(out, format="JPEG", quality=88)
    return out.getvalue()
