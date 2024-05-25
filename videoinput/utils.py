from __future__ import annotations

import base64
import contextlib
import os
import tempfile
import time
from pathlib import  PurePath
from types import TracebackType
from typing import IO

import colorama

__all__ = (
    "timed",
    "file_to_data_uri",
)


@contextlib.contextmanager
def timed(msg: str):
    start = time.perf_counter()
    print(colorama.Style.DIM + f"╔ {msg}" + colorama.Style.RESET_ALL)
    yield
    elapsed = time.perf_counter() - start
    print(
        colorama.Style.DIM + f"╚ Finished in {elapsed:.3f}s" + colorama.Style.RESET_ALL
    )


def file_to_data_uri(file_path: PurePath | str, mime_type: str):
    with open(file_path, "rb") as file:
        encoded_string = base64.b64encode(file.read()).decode("utf-8")
        return f"data:{mime_type};base64,{encoded_string}"


def bytes_to_data_uri(bytes: bytes, mime_type: str):
    encoded_string = base64.b64encode(bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded_string}"


class NamedTemporaryFile(contextlib.AbstractContextManager[IO[bytes]]):
    """
    tempfile.NamedTemporaryFile with an additional `delete_on_close` parameter.

    The `delete_on_close` parameter was only added in Python 3.12, but we badly
    need it on Windows: because file access on Windows is exclusive, we can't
    write to and then read from a file without closing it in between. But
    without `delete_on_close`, the file is deleted on close.

    This class is a thin shim around tempfile.NamedTemporaryFile that adds the
    parameter for older Python versions.
    """

    def __init__(
        self,
        mode: str = "w+b",
        buffering: int = -1,
        encoding: str | None = None,
        newline: str | None = None,
        suffix: str = "",
        prefix: str = "tmp",
        dir: str | None = None,
        delete: bool = True,
        *,
        errors: str | None = None,
        delete_on_close: bool = True,
    ):
        self._needs_manual_delete = delete and not delete_on_close
        self._file = tempfile.NamedTemporaryFile(
            mode=mode,
            buffering=buffering,
            encoding=encoding,
            newline=newline,
            suffix=suffix,
            prefix=prefix,
            dir=dir,
            delete=delete and delete_on_close,
            errors=errors,
        )

    def __enter__(self) -> IO[bytes]:
        return self._file.__enter__()

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ):
        self._file.__exit__(exc_type, exc_val, exc_tb)
        if self._needs_manual_delete:
            os.unlink(self._file.name)
