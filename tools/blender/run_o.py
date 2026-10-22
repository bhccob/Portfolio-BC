# Builds one variant of the O-only previs headless and saves it as its own .blend:
#   blender -b --factory-startup --python tools/blender/run_o.py -- glow <out_dir>
# <laser|glow> is how the B letters arrive on the scroll; <out_dir> is where the .blend goes (bob-o-<variant>.blend).
# It runs bob_build.py (output folder moved to <out_dir>, so nothing is written next to the scripts),
# bob_animate_o.py, bob_scroll.py and bob_reveal_b.py, all from this folder, in one namespace, as the GUI runs did.
import bpy, os, sys

args = sys.argv[sys.argv.index("--") + 1:]
assert len(args) == 2 and args[0] in ("laser", "glow"), "usage: run_o.py -- <laser|glow> <out_dir>"
REVEAL = args[0]
OUT = os.path.abspath(args[1])
TOOLS = os.path.dirname(os.path.abspath(__file__))
OLD_OUT = r'OUT_DIR = r"C:\Users\bhcco\Downloads\Portfolio-bob\.superpowers\brainstorm\bob-wordmark-2026-10-21\blender"'

os.makedirs(OUT, exist_ok=True)
ns = {"__name__": "__previs__", "REVEAL": REVEAL}


def run(path, patches=()):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    for a, b in patches:
        assert a in src, (path, a)
        src = src.replace(a, b)
    exec(compile(src, path, "exec"), ns)


run(os.path.join(TOOLS, "bob_build.py"), [
    (OLD_OUT, f'OUT_DIR = r"{OUT}"'),
    ("bpy.context.window.scene = sc", "if bpy.context.window: bpy.context.window.scene = sc"),
])
run(os.path.join(TOOLS, "bob_animate_o.py"))
run(os.path.join(TOOLS, "bob_scroll.py"))
run(os.path.join(TOOLS, "bob_reveal_b.py"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"bob-o-{REVEAL}.blend"))
print("saved", REVEAL)
