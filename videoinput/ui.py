from pathlib import Path

from faicons import icon_svg
from htmltools import HTMLDependency
from shiny import module, ui

multimodal_dep = HTMLDependency(
    "multimodal",
    "0.0.1",
    source={
        "subdir": str(Path(__file__).parent / "dist"),
    },
    script={"src": "index.js"},
    stylesheet={"href": "index.css"},
)


def input_video_clip(id: str, **kwargs):
    id = module.resolve_id(id)

    return ui.Tag(
        "video-clipper",
        multimodal_dep,
        ui.Tag(
            "av-settings-menu",
            ui.div(
                ui.tags.button(
                    icon_svg("gear").add_class("fw"),
                    class_="btn btn-sm btn-secondary dropdown-toggle px-3 py-2",
                    type="button",
                    **{"data-bs-toggle": "dropdown"},
                ),
                ui.tags.ul(
                    ui.tags.li(
                        ui.tags.h6("Camera", class_="dropdown-header"),
                        class_="camera-header",
                    ),
                    # Camera items will go here
                    ui.tags.li(ui.tags.hr(class_="dropdown-divider")),
                    ui.tags.li(
                        ui.tags.h6("Microphone", class_="dropdown-header"),
                        class_="mic-header",
                    ),
                    # Microphone items will go here
                    class_="dropdown-menu",
                ),
                class_="btn-group",
            ),
            slot="settings",
        ),
        ui.div(
            ui.input_action_button(
                "record",
                ui.TagList(
                    ui.tags.div(
                        style="display: inline-block; background-color: red; width: 1rem; height: 1rem; border-radius: 100%; position: relative; top: 0.175rem; margin-right: 0.3rem;"
                    ),
                    "Record",
                ),
                style="display: block;",
                class_="record-button btn-secondary px-3 mx-auto",
                disabled=True,
            ),
            ui.input_action_button(
                "stop",
                ui.TagList(
                    ui.tags.div(
                        style="display: inline-block; background-color: currentColor; width: 1rem; height: 1rem; position: relative; top: 0.175rem; margin-right: 0.3rem;"
                    ),
                    "Stop",
                ),
                style="display: block;",
                class_="stop-button btn-secondary px-3 mx-auto",
                disabled=True,
            ),
            slot="recording-controls",
            class_="btn-group",
            **{"aria-label": "Recording controls"},
        ),
        id=id,
        **kwargs,
    )
