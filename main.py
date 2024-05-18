import os
import sys
import tempfile

import dotenv
from openai import OpenAI

from input import decode_input
from utils import file_to_data_uri, timed

dotenv.load_dotenv()  # take environment variables from .env.

client = OpenAI()

if len(sys.argv) < 2:
    print("Usage: python main.py <input-video-file>", file=sys.stderr)
    sys.exit(1)

with timed("Parse input using ffmpeg"):
    input = decode_input(sys.argv[1], fps=2)

# os.system(f"afplay {str(input.audio)}")

with input:

    with timed("Speech-to-text"):
        audio_file = open(str(input.audio), "rb")
        transcription = client.audio.transcriptions.create(
            model="whisper-1", file=audio_file
        )

        print("  Transcription: " + transcription.text)

    with timed("Convert images to data URIs"):
        images = [file_to_data_uri(filename, "image/jpeg") for filename in input.images]

    with timed("Query GPT"):
        response = client.chat.completions.create(
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
                            "The user doesn't know the video is split into frames, "
                            "so make sure your video refers to these images collectively as "
                            '"the video", not "the images" or "the video frames".',
                        }
                    ],
                },
            ],
            max_tokens=300,
        )

        print("  Response: " + response.choices[0].message.content)

    with timed("Text-to-speech"):
        audio = client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=response.choices[0].message.content,
        )

    with tempfile.NamedTemporaryFile(suffix=".mp3") as file:
        audio.write_to_file(file.name)
        os.system(f"afplay {file.name}")
