from shiny import reactive, req
from shiny.express import input, render, ui, session
from shinymedia import input_video_clip, audio_spinner
from query import chat

input_video_clip(
    "clip", reset_on_record=True, class_="mt-5 mx-auto", style="max-width: 600px;"
)

messages = []


@reactive.extended_task
async def chat_task(video_clip, messages, session):
    with ui.Progress(session=session) as p:
        return await chat(video_clip, messages, p)


@reactive.effect
@reactive.event(input.clip, ignore_none=False)
def start_chat():
    chat_task.cancel()
    req(input.clip())
    chat_task(input.clip(), messages, session)


# Show the chat response
@render.express
def response():
    if chat_task.status() == "initial":
        ui.p(
            ui.strong("Instructions:"),
            " Record a short video clip to start chatting.",
            class_="mt-4 text-center",
        )
        return

    with ui.hold():
        req(input.clip())

    if chat_task.status() == "running":
        req(False)

    audio_spinner(src=chat_task.result())
