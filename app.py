import tempfile
import base64
import os
from pathlib import Path

from htmltools import HTMLDependency
from shiny import reactive
from shiny.express import input, render, ui

HTMLDependency(
    "multimodal",
    "0.0.1",
    source={
        "subdir": str(Path(__file__).parent / "dist"),
    },
    script={"src": "index.js"},
)

ui.Tag("video-clipper", id="clip", style="width: 600px; margin: 1em auto;")


@reactive.effect
def show_clip():
    clip = input.clip()
    mime_type = clip["type"]
    bytes = base64.b64decode(clip["bytes"])
    with tempfile.NamedTemporaryFile(suffix=".mkv") as file:
        file.write(bytes)
        file.flush()
        filename = file.name
        print("filename: " + filename)
        os.system(f"md5sum {filename}")
        with ui.Progress() as p:
            p.set(message="Processing...")
            os.system(f"python main.py {filename}")
