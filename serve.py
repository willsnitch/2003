#!/usr/bin/env python3
"""Static dev server for the room. Sends no-store so edited modules always reload."""
import json
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


SOUNDS = Path(__file__).resolve().parent / "assets" / "sounds"
AUDIO = {".ogg", ".mp3", ".wav", ".m4a", ".flac"}


def write_sound_list():
    """A published site can't list a folder, so there the game reads this file instead."""
    names = sorted(f.name for f in SOUNDS.iterdir() if f.suffix.lower() in AUDIO)
    (SOUNDS / "list.json").write_text(json.dumps(names, indent=1) + "\n")


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # every time the game looks at the sound folder, the list follows what is in it
        if self.path.split("?")[0].rstrip("/") == "/assets/sounds":
            write_sound_list()
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    # the preview app passes PORT when it had to move the server off the configured port
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8141))
    root = str(Path(__file__).resolve().parent)
    write_sound_list()
    ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=root)).serve_forever()
