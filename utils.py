import base64
import contextlib
import os
import time

import colorama

__all__ = (
    "timed",
    "file_to_data_uri",
)


@contextlib.contextmanager
def timed(msg):
    start = time.perf_counter()
    print(colorama.Style.DIM + f"╔ {msg}" + colorama.Style.RESET_ALL)
    yield
    elapsed = time.perf_counter() - start
    print(
        colorama.Style.DIM + f"╚ Finished in {elapsed:.3f}s" + colorama.Style.RESET_ALL
    )


def file_to_data_uri(file_path, mime_type):
    with open(file_path, "rb") as file:
        encoded_string = base64.b64encode(file.read()).decode("utf-8")
        return f"data:{mime_type};base64,{encoded_string}"
