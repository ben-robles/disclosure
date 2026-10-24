import mimetypes
import sys

from google import genai
from google.genai import types

MODEL = "gemma-4-26b-a4b-it"

path = sys.argv[1] if len(sys.argv) > 1 else "test_photo.jpg"
mime_type = mimetypes.guess_type(path)[0] or "image/jpeg"

client = genai.Client()  # reads GEMINI_API_KEY

with open(path, "rb") as f:
    img = types.Part.from_bytes(data=f.read(), mime_type=mime_type)

resp = client.models.generate_content(
    model=MODEL,
    contents=[img, "Describe any visible home defects."],
)
print(resp.text)
