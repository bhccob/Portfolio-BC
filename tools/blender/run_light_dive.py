# Renders one part of the light dive mock-up headless, from the previs scripts in this folder:
#   blender -b --factory-startup --python-exit-code 1 --python tools/blender/run_light_dive.py -- \
#       --part way|ring --size desk|phone --out <png folder> [--frames 1,20,40] [--mockup <folder>]
# It runs bob_build.py (its output folder moved to <out>/_blend, so the approved previs .blend is left alone, and its
# window line guarded, as there is no window headless), bob_animate.py and bob_scroll.py in one namespace, as run_o.py
# does, then light_dive.py, which builds the light dive on that scene and renders the part asked for: the PNGs to
# <out>, then, for a whole part, the webp frames and the per-frame data to <mockup>/frames/<part>-<size>/ and
# <mockup>/data/<part>-<size>.json. `--frames` renders only those frames (a look at a few before the whole run); their
# data goes to <out> instead. <mockup> defaults to the main checkout's .superpowers/light-dive-mockup.
import argparse
import os
import sys

import bpy  # noqa: F401  (the scripts run inside Blender)

TOOLS = os.path.dirname(os.path.abspath(__file__))
MAIN_CHECKOUT = r"C:\Users\bhcco\Downloads\Portfolio-bob"
OLD_OUT = r'OUT_DIR = r"C:\Users\bhcco\Downloads\Portfolio-bob\.superpowers\brainstorm\bob-wordmark-2026-10-21\blender"'

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
parser = argparse.ArgumentParser(prog="run_light_dive.py", description="Render a part of the light dive mock-up.")
parser.add_argument("--part", choices=("way", "ring"), required=True)
parser.add_argument("--size", choices=("desk", "phone"), required=True)
parser.add_argument("--out", required=True, help="folder for the rendered PNGs")
parser.add_argument("--frames", default=None, help="comma-separated frames to render instead of the whole part")
parser.add_argument("--mockup", default=os.path.join(MAIN_CHECKOUT, ".superpowers", "light-dive-mockup"))
args = parser.parse_args(argv)

OUT = os.path.normpath(os.path.abspath(args.out))
BLEND_DIR = os.path.join(OUT, "_blend")
os.makedirs(BLEND_DIR, exist_ok=True)
ns = {
    "__name__": "__previs__",
    "LD": {
        "part": args.part,
        "size": args.size,
        "out": OUT,
        "frames": [int(x) for x in args.frames.split(",")] if args.frames else None,
        "mockup": os.path.normpath(os.path.abspath(args.mockup)),
    },
}


def run(path, patches=()):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    for a, b in patches:
        assert a in src, (path, a)
        src = src.replace(a, b)
    exec(compile(src, path, "exec"), ns)


run(os.path.join(TOOLS, "bob_build.py"), [
    (OLD_OUT, f'OUT_DIR = r"{BLEND_DIR}"'),
    ("bpy.context.window.scene = sc", "if bpy.context.window: bpy.context.window.scene = sc"),
])
run(os.path.join(TOOLS, "bob_animate.py"))
run(os.path.join(TOOLS, "bob_scroll.py"))
run(os.path.join(TOOLS, "light_dive.py"))
