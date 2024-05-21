import base64
import tempfile

from faicons import icon_svg
from openai import AsyncOpenAI
from shiny.express import input, render, ui

from videoinput import input_video_clip, process_video

client = AsyncOpenAI()

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

            mp3_data_uri = await process_video(
                client,
                filename,
                callback=lambda status: p.set(message=status),
            )
            return ui.tags.audio(
                src=mp3_data_uri,
                controls=True,
                autoplay=True,
                style="display: block; margin: 0 auto; visibility: hidden;",
            )


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
