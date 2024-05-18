import base64
from pathlib import Path

from htmltools import HTMLDependency
from openai import AsyncOpenAI
from shiny import reactive
from shiny.express import input, render, ui

from query import process_video
from utils import NamedTemporaryFile

client = AsyncOpenAI()

HTMLDependency(
    "multimodal",
    "0.0.1",
    source={
        "subdir": str(Path(__file__).parent / "dist"),
    },
    script={"src": "index.js"},
)

ui.Tag("video-clipper", id="clip", style="width: 600px; margin: 1em auto;")


@render.ui
async def show_clip():
    clip = input.clip()
    mime_type = clip["type"]
    bytes = base64.b64decode(clip["bytes"])
    with NamedTemporaryFile(suffix=".mkv", delete_on_close=False) as file:
        file.write(bytes)
        file.close()

        with ui.Progress() as p:

            mp3_data_uri = await process_video(
                client,
                file.name,
                callback=lambda status: p.set(message=status),
            )
            return ui.tags.audio(
                src=mp3_data_uri,
                controls=True,
                autoplay=True,
                style="display: block; margin: 0 auto; visibility: hidden;",
            )
