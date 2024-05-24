from typing import Callable, Optional

import dotenv
from openai import AsyncOpenAI

from .input import decode_input
from .utils import bytes_to_data_uri, file_to_data_uri

# Load OpenAI API key from .env file
dotenv.load_dotenv()

TERSE_PROMPT = """
The user you're responding to is EXTREMELY busy and cannot waste a single
second. Above all, answers must be as concise as possible. Every wasted word
will result in a huge deduction of points. In fact, use the absolute minimum
number of words while still technically answering the question. Avoid
adjectives, adverbs, fill words, and qualifiers.
"""

EXTRA_TERSE_PROMPT = """
Definitely don't restate any part of the question in your answer, if it can
possibly be avoided. Don't speak in complete sentences. Just get to the point as
quickly as possible.
"""

SUBJECT_PROMPT = """
If the user refers to "I" or "me" in the text input, you should assume that's
referring to the most prominent person in the video.

If the user refers to "you" in the text input, you should assume that's
referring to you, the AI model.
"""

VIDEO_PROMPT = """
The images are frames of a video at 2 frames per second. The user doesn't know
the video is split into frames, so make sure your video refers to these images
collectively as "the video", not "the images" or "the video frames".
"""

SPEAKING_PROMPT = """
The user is asking you to speak the answer. Make sure your response is in the
form of a friendly, casual spoken answer, not a formal written one.
"""

SYSTEM_PROMPT = (
    VIDEO_PROMPT
    + SUBJECT_PROMPT
    + SPEAKING_PROMPT
    # + TERSE_PROMPT
    # + EXTRA_TERSE_PROMPT
)


async def process_video(
    client: AsyncOpenAI, filepath: str, callback: Optional[Callable[[str], None]]
) -> None:
    if callback is None:
        callback = lambda _: None

    callback("Decoding input")
    input = decode_input(filepath, fps=2)

    with input:
        callback("Decoding speech")
        with open(str(input.audio), "rb") as audio_file:
            transcription = await client.audio.transcriptions.create(
                model="whisper-1", file=audio_file
            )

        callback("Processing video")
        images = [file_to_data_uri(filename, "image/jpeg") for filename in input.images]

        callback("Querying")
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": transcription.text},
                        *[
                            {
                                "type": "image_url",
                                "image_url": {"url": image, "detail": "auto"},
                            }
                            for image in images
                        ],
                    ],
                },
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "text",
                            "text": SYSTEM_PROMPT,
                        }
                    ],
                },
            ],
        )

        callback("Converting to speech")
        audio = await client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=response.choices[0].message.content,
            response_format="mp3",
        )
        return bytes_to_data_uri(audio.read(), "audio/mpeg")
