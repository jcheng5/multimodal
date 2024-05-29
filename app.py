from shiny import reactive, req
from shiny.express import input, render, ui, session
from shinymedia import input_video_clip, audio_spinner
from query import chat
from faicons import icon_svg
from htmltools import css

# This will hold the chat history for the current session, allowing us to chat
# with GPT-4o across multiple video clips.
messages = []

suggested_prompts = [
    "“What do you think of the outfit I'm wearing?”",
    "“Where does it look like I am right now?”",
    "“Tell me an interesting fact about an object you see in this video.”",
]

# Use `with ui.hold()` to save this UI for later. We'll use it 
with ui.hold() as instructions:
    with ui.card(class_="mt-3 mx-auto", style=css(width="600px", max_width="100%")):
        with ui.p():
            ui.strong("Instructions: ")
            "Record a short video clip to start chatting with GPT-4o. "
            "After it responds, you can record another clip to continue the "
            "conversation. Reload the browser to start a new conversation."
        with ui.p():
            "Some ideas to get you started:"
        with ui.tags.ul(class_="mb-0"):
            for suggestion in suggested_prompts:
                with ui.tags.li():
                    suggestion


# Add the video clip input control onto the page. We can access the video clip
# from within functions with @reactive.calc and @render.* decorators, by calling
# input.clip().
input_video_clip(
    "clip",
    reset_on_record=True,
    class_="mt-3 mx-auto",
    style=css(width="600px", max_width="100%"),
)


# A long-running task that actually does the chat with GPT-4o. It takes the
# video clip and a list of existing messages as input, and returns the chat
# response as a data URL of an audio file.
#
# We use a @reactive.extended_task decorator to make the task both cancellable
# and scaleable. Code inside of this extended task will not block this session
# nor the sessions of other users.
@reactive.extended_task
async def chat_task(video_clip, messages, session):
    with ui.Progress(session=session) as p:
        chat_output = await chat(video_clip, messages, p)
        return chat_output, messages


# When a new video clip is recorded, we start a chat operation with GPT-4o by
# invoking the chat_task. Note that we're passing in any data that the task
# needs.
@reactive.effect
@reactive.event(input.clip, ignore_none=False)
def start_chat():
    chat_task.cancel()
    req(input.clip())
    chat_task(input.clip(), messages[:], session)


# Show the chat response
@render.express
def response():
    # If the user hasn't started recording their first video clip, show the
    # instructions.
    if chat_task.status() == "initial":
        instructions
        return

    # If there is no video clip (either because the user hasn't recorded one or
    # because they've started recording a new one, which resets the input), or
    # if the chat task is still running, show nothing.
    if input.clip() is None or chat_task.status() == "running":
        return

    # This next line will return values if the chat task completed successfully.
    # If the chat task failed with an error, that error will be raised instead.
    chat_result_audio, chat_result_messages = chat_task.result()

    # Update the global messages variable with the new chat history after this
    # interaction.
    global messages
    messages = chat_result_messages[:]

    # Play the chat response audio, with a cool spinner visualization
    audio_spinner(src=chat_result_audio)


# Footer with credits and source code link
with ui.panel_fixed(bottom=0, left=0, right=0, height="auto", id="footer"):
    with ui.div(class_="mx-auto", style=css(width="600px", max_width="100%")):
        with ui.div(class_="float-left"):
            "Built in Python with "
            ui.a("Shiny", href="https://shiny.posit.co/py/")
        with ui.div(class_="float-right"):
            with ui.a(
                href="https://github.com/jcheng/multimodal", style="color: inherit;"
            ):
                icon_svg("github", margin_right="0.5em")
                "View source code"


# Bit of CSS to make the footer look okay
ui.head_content(
    ui.tags.style(
        """
        #footer {
            padding: 0.5em 0.7em;
            background-color: var(--bs-primary);
            color: white;
        }
        #footer a {
            color: white;
        }
        """
    )
)
