import os
import tempfile
from pathlib import PurePath, Path

import ffmpeg


class DecodedInput:
    audio: PurePath
    images: tuple[PurePath, ...]

    def __init__(
        self,
        audio: PurePath,
        images: tuple[PurePath, ...],
        tmpdir: tempfile.TemporaryDirectory,
    ):
        self.audio = audio
        self.images = images
        self.tmpdir = tmpdir

    def dispose(self):
        self.audio.unlink()
        for image in self.images:
            image.unlink()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.tmpdir.cleanup()


def decode_input(input_path: PurePath, fps: int = 2) -> DecodedInput:
    outdir = tempfile.TemporaryDirectory()
    audio = PurePath(outdir.name) / "audio.mp3"
    (
        ffmpeg.input(
            str(input_path),
        )
        .output(
            str(audio),
            loglevel="quiet",
            **{
                # Use 64k bitrate for smaller file
                "b:a": "64k",
                # Only output one channel, again for smaller file
                "ac": "1",
            },
        )
        .run()
    )
    (
        ffmpeg.input(str(input_path))
        .output(
            str(PurePath(outdir.name) / "frame-%04d.jpg"),
            loglevel="quiet",
            **{
                # Use fps as specified, scale image to fit within 512x512
                "vf": f"fps={fps},scale='if(gt(iw,ih),512,-1)':'if(gt(ih,iw),512,-1)'",
                "q:v": "20",
            },
        )
        .run()
    )
    images = tuple(Path(outdir.name).glob("*.jpg"))
    return DecodedInput(audio, images, outdir)


if __name__ == "__main__":
    with decode_input(PurePath("data/question.mov")) as input:
        print(input.audio)
        print(input.images)
