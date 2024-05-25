import base64
import tempfile

from openai import AsyncOpenAI
from shiny.express import input, render, ui

from videoinput import (
    audio_spinner,
    input_video_clip,
    process_video,
    process_video_ollama,
)

client = AsyncOpenAI()

ui.page_opts(class_="py-5")

input_video_clip("clip")


@render.ui
async def show_clip():
    clip = input.clip()
    mime_type = clip["type"]
    bytes = base64.b64decode(clip["bytes"])
    # TODO: Use correct file extension based on mime type
    with tempfile.TemporaryDirectory() as tempdir:
        filename = tempfile.mktemp(dir=tempdir, suffix=get_video_extension(mime_type))
        with open(filename, "wb") as file:
            file.write(bytes)
            file.close()

        with ui.Progress() as p:

            mp3_data_uri = await process_video_ollama(
                client,
                filename,
                callback=lambda status: p.set(message=status),
            )
            return audio_spinner(src=mp3_data_uri)


def get_video_extension(mime_type: str) -> str:
    mime_type = mime_type.split(";")[0].strip()

    # Dictionary to map MIME types to file extensions
    mime_to_extension = {
        "video/webm": ".webm",
        "video/mp4": ".mp4",
        "video/ogg": ".ogv",
        "video/x-matroska": ".mkv",
        "video/avi": ".avi",
        "video/mpeg": ".mpeg",
        "video/quicktime": ".mov",
    }

    # Return the appropriate file extension for the given MIME type
    return mime_to_extension.get(mime_type, "")
