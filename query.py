from typing import Callable, Optional

import dotenv
from openai import AsyncOpenAI

from input import decode_input
from utils import NamedTemporaryFile, file_to_data_uri, timed

# Load OpenAI API key from .env file
dotenv.load_dotenv()


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
                            "text": "The images are frames of a video at 2 frames per second. "
                            "The user doesn't know the video is split into frames, ",
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
        )

        callback("Encoding audio")
        # TODO: Use correct file extension based on mime type
        with NamedTemporaryFile(suffix=".mp3", delete_on_close=False) as file:
            file.close()
            audio.write_to_file(file.name)
            return file_to_data_uri(file.name, "audio/mpeg")
