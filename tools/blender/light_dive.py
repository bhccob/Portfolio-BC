# The light dive and the ring of projects, built on the previs scene (docs/superpowers/specs/2026-10-25-bob-light-dive-
# design.md). Run by run_light_dive.py after bob_build.py, bob_animate.py and bob_scroll.py, in their namespace, which
# passes LD = {part, size, out, frames, mockup}.
#
# The way: 300 frames at 24 fps.
# - 1-60, the way in. BOB seen from above, as bob_scroll.py's rise ends (its frame 362, TOP_FRAME): the needle's pivot
#   at the O's centre lights up into the light over 1-8. From 8 the camera follows it straight down through the O, the
#   light held at the centre of the frame; the B letters, the compass and the glass slide out past the edges, blurred
#   by the camera's motion and focus, and are gone by 40. Below the glass sky the camera swings round to the light's
#   side (46-84), and the void (its violet mist band, its gold dust, the traces on the glass sky) fades in from 20.
# - 61-260, the fall. The light falls through the void, swaying on the frame as x = 0.5 + 0.04 sin(2 pi (f - 61) / 80),
#   its tapered trail streaming up above it along its own past positions (a soft S). Bob's facts ride beside it in the
#   page: they are data here, not pixels.
# - 261-300, the landing. The ring's three beads rise into view, the camera eases back and levels into the ring
#   camera, and the light slows over the ring's centre and stretches into the needle (285-300), pointing at Funcial in
#   front. Frame 300 is the ring's frame 0: RING_*, ring_bead_position() and ring_camera_pose() are what Task 2's
#   turntable starts from, unchanged.
#
# The ring: 240 frames, numbered from 0, as a turntable that loops (frame 239 runs on into frame 0).
# - Ring frame f is the way's frame 300 with the ring turned 1.5 f degrees about the needle's axis: frame 0 is the way's
#   last frame, the same camera, objects, glow and void. The ring turns so Jontai Energy (back left) comes round to
#   the front at 80 and Cookies Clicker at 160; those are the rests, with Funcial in front at 0 (and again at 240).
# - The camera holds the ring pose. The needle stays at the exact centre, pointing at the front direction, so it
#   points at the bead nearest the front as the ring turns under it; nothing joins it to a bead. The bead passing
#   straight behind the pivot rises a little (ring_lift), so it never stands on the needle's back tip in the picture.
# - The ring's data gives each frame { f, angle, front } and, under `proj`, where the needle's tips and the beads'
#   outlines fall on the picture, so the checks can hold the needle clear of every bead.
# - Each bead keeps its porthole to the camera and its objects still (the site moves only the selected bead's). Its
#   halo band and porthole rim glow with its closeness to the front, eased (ring_closeness): the front bead at a rest
#   glows as Funcial does at the way's frame 300, the others as the GLB's gold; between rests the two nearest cross-fade.
# - The void runs on a looping clock (ring_void_state): frame 0 is void_state(300) exactly and the mist and dust leave
#   it at the way's own drift, but they sway back by frame 240, so the wrap from 239 to 0 does not pop.
#
# The beads are the site's own (public/models/bob-beads.glb, imported), with their objects and real screens, not
# bob_scroll.py's preview beads, which are hidden: the ring must show what the site will show (and lightdive-ring2.webp
# shows the objects inside).
#
# Every frame's state is a function of the frame alone. The camera and the light are keyed per frame (so EEVEE's
# motion blur sees the camera move past the glass while the light it holds stays sharp); the rest is set per frame
# before each render. The per-frame data (the light's projected centre, its glow, the fact riding with it, the phase)
# comes from the same state, projected through the camera with world_to_camera_view. The void's own clock
# (void_state) is defined for any frame. The ring reads its drifting fields (the wisps' drift and noise W, the dust's
# drift) off a looping clock, 300 + (240 / 2 pi) sin(2 pi f / 240), and the rest off frame 300 (ring_void_state):
# ring frame 0 is the way's frame 300 exactly, and the turntable loops from 239 to 0 with no pop.
#
# Borrowed from the previs namespace (bob_build.py, bob_animate.py, bob_scroll.py): sc (the BOB_previs scene); the
# easing helpers lerp, ease_io, ease_in, ease_out, span, clamp01; mat_gold_emit; the materials M_GLASS, M_LETTER,
# M_CIRCLE, M_TICKS, M_OUTER, M_LIP, M_TRACE, M_RIM and M_CEIL_TRACE; bob_scroll.py's preview beads (`beads`); CEIL_Z
# (the glass sky's height). LD comes from run_light_dive.py.
import bpy, bmesh, json, math, os, random, shutil, subprocess, time
from mathutils import Euler, Matrix, Vector
from mathutils.kdtree import KDTree
from bpy_extras.object_utils import world_to_camera_view

PART, SIZE, OUT, ONLY, MOCKUP = LD["part"], LD["size"], LD["out"], LD["frames"], LD["mockup"]
assert PART in ("way", "ring"), PART

LD_SCENE = bpy.data.scenes["BOB_previs"]
LD_COL = bpy.data.collections["bob_scene"]
LD_CAM = LD_SCENE.camera
BEADS_GLB = os.path.join(LD["repo"], "public", "models", "bob-beads.glb")
BEAD_SHOTS = os.path.join(LD["repo"], "src", "assets", "beads")

# ---------------------------------------------------------------- timing (frames)
TOP_FRAME = 362        # bob_scroll.py: the rise to BOB seen from above ends here (held to 372)
F_IGNITE = 8           # the pivot has become the light
F_PASS = 46            # the camera is under the glass sky; it starts to swing to the light's side
F_SIDE = 84            # the camera is beside the light
F_FALL, F_LAND, F_END = 61, 261, 300
F_STOP = 286           # the light comes to rest at the ring's centre
F_NEEDLE = 285         # and stretches into the needle from here to F_END
FPS = 24

# ---------------------------------------------------------------- the two sizes
# The desk keeps the previs camera (12.6 m above, 50 mm on 36 mm: BOB across the frame). The phone frames BOB to its
# width as the site's portrait framing does (src/engine/bob/shots.ts, FRAMES.top and MAX_VFOV): half-width 4.6 at the
# glass, the vertical field held at 50 degrees, so the camera stands back to 21.35 m; 83.5 mm on 36 mm is that field.
SIZES = {
    "desk": dict(res=(1440, 900), lens=50.0, top=12.6, fstop_way=1.6, fstop_fall=2.2),
    "phone": dict(res=(585, 1266), lens=83.5, top=21.35, fstop_way=4.5, fstop_fall=6.0),
}
SZ = SIZES[SIZE]
RES_X, RES_Y = SZ["res"]


def tan_h(lens):
    return 18.0 / lens          # half the horizontal field, sensor 36 mm wide, fitted to the frame's width


def tan_v_of(size, lens):
    w, h = SIZES[size]["res"]
    return tan_h(lens) * h / w


# ---------------------------------------------------------------- the ring (Task 2 reuses these unchanged)
RING_HEIGHT = -11.0                            # the ring's plane, under the glass sky (z -1.2) in the void
RING_CENTER = Vector((0.0, 0.0, RING_HEIGHT))  # the needle's pivot, straight under the O, where the light lands
RING_RADIUS = 5.5                              # from the pivot to each bead's centre
RING_BEADS = (("funcial", 0.0), ("jontai-energy", 120.0), ("cookies-clicker", 240.0))   # id, angle; index 0 in front
RING_RISE = 6.0                                # the beads rise this far into the ring's plane over the landing
RING_NEEDLE_SCALE = 2.0                        # the compass needle (bob_build.py) at this scale, tip toward the front
# The ring camera: outside the ring on the front bead's side (-Y), `height` above its plane, looking down `pitch`
# degrees, as in lightdive-ring2.webp (the front bead near and low, the other two behind, smaller, to the sides).
# - desk: the pivot at (0.5, 0.44), the front bead about 18 % of the width, the back beads at x 0.25 and 0.75.
# - phone (the controller's ruling 4): it looks straight at the pivot, which sits at the frame's centre (0.5, 0.5),
#   the front bead 30 % of the width at y 0.67, the back beads whole at x 0.11 and 0.89, y 0.46. That needs 47 mm
#   (a vertical field of 79 degrees): at the site's portrait cap of 50 degrees a front bead that size would put the
#   back beads' centres on the frame's edges.
RING_CAM = {
    "desk": dict(distance=15.0, height=4.5, pitch=19.0, lens=35.0, fstop=5.6),
    "phone": dict(distance=12.1, height=5.64, pitch=25.0, lens=47.0, fstop=5.6),
}
# How the ring looks at frame 300: the needle's gold glow; the beads' gold glow (the GLB's: its halo, rim and display
# edges glow at 0.2 of the gold light) and the front bead's answering glow on its halo and rim, as an emission
# strength on the gold light (1.0, 0.52, 0.16); the warm directional key on the beads (energy, the direction its light
# travels); the bead's inner light (export_beads.py's site intensity 0.25, in preview watts).
RING_NEEDLE_GLOW = 0.5
RING_BEAD_GLOW = 0.2
RING_FRONT_GLOW = 0.8
RING_KEY = dict(energy=2.5, direction=(0.42, 0.7, -0.58))
RING_INNER_W = 0.25 / (1.7 / 90.0)


def ring_bead_position(angle_deg, turn_deg=0.0):
    """A bead's centre at `angle_deg` round the pivot (0 = in front, toward the ring camera; 120 = back left; 240 =
    back right, seen from the camera), the ring turned by `turn_deg` (turning by -120 brings index 1 to the front)."""
    a = math.radians(angle_deg + turn_deg)
    return RING_CENTER + Vector((-RING_RADIUS * math.sin(a), -RING_RADIUS * math.cos(a), 0.0))


def ring_camera_pose(size):
    """The ring camera of `size`: location, rotation (XYZ Euler; it only pitches), lens, focus distance, f-stop."""
    c = RING_CAM[size]
    loc = RING_CENTER + Vector((0.0, -c["distance"], c["height"]))
    return dict(loc=loc, th=math.radians(90.0 - c["pitch"]), lens=c["lens"], focus=(RING_CENTER - loc).length,
                fstop=c["fstop"])


def bead_facing(pos, cam_loc):
    """The bead's turn: its porthole (local -Y) toward the camera, its up (local Z) up, as bob_scroll.py's beads."""
    look = (cam_loc - pos).normalized()
    return (-look).to_track_quat('Y', 'Z')


# ---------------------------------------------------------------- the ring's turntable (the ring part)
RING_FRAMES = 240                           # a full turn, frames 0..239; frame 240 would be frame 0 again
RING_STEP = 360.0 / RING_FRAMES             # 1.5 degrees a frame
RING_SPACING = 360.0 / len(RING_BEADS)      # 120 degrees between beads: the rests are frames 0, 80 and 160


def ring_turn(f):
    """How far the ring has turned at ring frame f, in degrees. The beads stand at ring_bead_position(angle, -turn):
    at 80 Jontai Energy (120) is in front, at 160 Cookies Clicker (240)."""
    return RING_STEP * f


def ring_front(f):
    """The index of the bead nearest the front at ring frame f; halfway between two beads, the one coming in."""
    return int(math.floor((ring_turn(f) + RING_SPACING / 2.0) / RING_SPACING)) % len(RING_BEADS)


def ring_rel(angle_deg, f):
    """The bead at `angle_deg`'s angle from the front at ring frame f, in -180 .. 180."""
    return (angle_deg - ring_turn(f) + 180.0) % 360.0 - 180.0


def ring_closeness(angle_deg, f):
    """How near the bead at `angle_deg` is to the front at ring frame f, eased: 1 in front, 0 a bead's spacing or more
    away; the two beads either side of the front always sum to 1, so the answering glow hands over without a dip."""
    return ease_io(1.0 - abs(ring_rel(angle_deg, f)) / RING_SPACING)


# The bead passing straight behind the pivot (at 40, 120 and 200) would stand on the needle's back tip in the picture
# (desk: its outline 4 px over the tip at 40): the needle would read as stuck into it. So that bead alone rises a
# little as it passes behind, RING_LIFT at the back (|rel| 180), eased from nothing at a bead's spacing from the front
# (|rel| 120, where the back beads rest): the rests, frame 0 and the seam are untouched, and ease_io's flat ends leave
# no kink. With RING_LIFT the back tip clears every outline by 19 px at least on desk and 28 px on phone.
RING_LIFT = 0.35


def ring_lift(angle_deg, f):
    return RING_LIFT * ease_io((abs(ring_rel(angle_deg, f)) - RING_SPACING) / (180.0 - RING_SPACING))


def ring_bead_at(angle_deg, f):
    """The centre of the bead at `angle_deg` at ring frame f: on the ring turned by ring_turn(f), lifted as it passes
    behind the pivot."""
    return ring_bead_position(angle_deg, -ring_turn(f)) + Vector((0.0, 0.0, ring_lift(angle_deg, f)))


# ---------------------------------------------------------------- freeze the previs at BOB seen from above
def fcurves_of(ad):
    act = ad.action
    if act is None:
        return []
    try:
        from bpy_extras.anim_utils import action_get_channelbag_for_slot
        bag = action_get_channelbag_for_slot(act, ad.action_slot)
        return list(bag.fcurves) if bag else []
    except Exception:
        return list(getattr(act, "fcurves", []))


def split_path(dp):
    depth, quote = 0, False
    for i in range(len(dp) - 1, -1, -1):
        ch = dp[i]
        if ch == '"':
            quote = not quote
        elif not quote and ch == ']':
            depth += 1
        elif not quote and ch == '[':
            depth -= 1
        elif not quote and depth == 0 and ch == '.':
            return dp[:i], dp[i + 1:]
    return None, dp


def set_path(idb, dp, idx, v):
    owner_path, attr = split_path(dp)
    owner = idb.path_resolve(owner_path) if owner_path else idb
    cur = getattr(owner, attr)
    if isinstance(cur, bool):
        setattr(owner, attr, v >= 0.5)
    elif isinstance(cur, int):
        setattr(owner, attr, int(round(v)))
    elif isinstance(cur, float):
        setattr(owner, attr, v)
    else:
        cur[idx] = v


def freeze_at(frame):
    """Every keyed value at `frame`, then no keys: the scene holds that state, and the way's own keys start clean."""
    ids = []
    for coll in (bpy.data.objects, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.curves,
                 bpy.data.meshes, bpy.data.scenes, bpy.data.worlds, bpy.data.node_groups):
        for idb in coll:
            ids.append(idb)
            nt = getattr(idb, "node_tree", None)
            if nt is not None:
                ids.append(nt)
    count = 0
    for idb in ids:
        ad = idb.animation_data
        if ad is None:
            continue
        vals = [(fc.data_path, fc.array_index, fc.evaluate(frame)) for fc in fcurves_of(ad)]
        idb.animation_data_clear()
        for dp, idx, v in vals:
            set_path(idb, dp, idx, v)
            count += 1
    return count


LD_FROZEN = freeze_at(TOP_FRAME)
LD_SCENE.frame_start, LD_SCENE.frame_end = 1, F_END
LD_SCENE.render.fps = FPS
LD_SCENE.frame_set(1)
P0 = sc.objects["bob_pivot"].matrix_world.translation.copy()   # the pivot at the O's centre, in the tunnel
assert abs(P0.x) < 1e-6 and abs(P0.y) < 1e-6, P0
assert abs(LD_CAM.location.z - 12.6) < 1e-6 and abs(LD_CAM.rotation_euler.x) < 1e-9, (LD_CAM.location, LD_CAM.rotation_euler)

# ---------------------------------------------------------------- the light's path and the camera's
V_PEAK = 0.13      # m a frame, the light sinking through the O


def speed_table(v_fall):
    s = [0.0] * (F_END + 1)
    for f in range(1, F_END + 1):
        if f <= F_IGNITE:
            v = 0.0
        elif f <= 22:
            v = V_PEAK * ease_io((f - F_IGNITE) / (22 - F_IGNITE))
        elif f <= 36:
            v = V_PEAK
        elif f <= 80:
            v = lerp(V_PEAK, v_fall, ease_io((f - 36) / 44.0))
        elif f <= 260:
            v = v_fall
        elif f <= F_STOP:
            v = v_fall * (1.0 - ease_io((f - 260) / float(F_STOP - 260)))
        else:
            v = 0.0
        s[f] = v
    return s


def anchor_table(v_fall):
    s = speed_table(v_fall)
    z = [P0.z] * (F_END + 1)
    for f in range(2, F_END + 1):
        z[f] = z[f - 1] - s[f]
    return z


lo, hi = 0.0005, 0.3                 # the fall's speed that lands the light on the ring's plane at F_STOP
for _ in range(80):
    mid = 0.5 * (lo + hi)
    if anchor_table(mid)[F_STOP] > RING_HEIGHT:
        lo = mid
    else:
        hi = mid
V_FALL = 0.5 * (lo + hi)
ANCHOR_Z = anchor_table(V_FALL)
for f in range(F_STOP, F_END + 1):
    ANCHOR_Z[f] = RING_HEIGHT

D_PASS, D_FALL = 2.4, 5.0     # the camera's distance from the light under the glass, and in the fall
THETA_FALL = 95.0             # degrees from straight above: beside the light, a little under it, looking up
Y_FALL = 0.56                 # the light's place on the frame in the fall (from the top): the trail gets the room above
SWAY, SWAY_PERIOD = 0.04, 80.0


def sway_x(f):
    return 0.5 + SWAY * math.sin(2.0 * math.pi * (f - F_FALL) / SWAY_PERIOD)


def track_pose(f, size):
    """The camera following the light: distance d, position angle th (0 = straight above), aim tilt dl, lens."""
    sz = SIZES[size]
    lens = sz["lens"]
    d0 = sz["top"] - P0.z
    if f <= F_IGNITE:
        d = d0
    elif f <= F_PASS:
        d = lerp(d0, D_PASS, ease_io(span(f, F_IGNITE, F_PASS)))
    else:
        d = lerp(D_PASS, D_FALL, ease_io(span(f, F_PASS, F_SIDE)))
    th = math.radians(THETA_FALL) * ease_io(span(f, F_PASS, F_SIDE))
    dl_full = math.atan((Y_FALL - 0.5) * 2.0 * tan_v_of(size, lens))
    dl = dl_full * ease_io(span(f, F_FALL, F_FALL + 32))
    anchor = Vector((0.0, 0.0, ANCHOR_Z[f]))
    loc = anchor + d * Vector((0.0, -math.sin(th), math.cos(th)))
    depth = d * math.cos(dl)
    focus = lerp(sz["top"], depth, ease_io(span(f, 1, 20)))
    fstop = lerp(sz["fstop_way"], sz["fstop_fall"], ease_io(span(f, F_PASS, F_SIDE)))
    return dict(loc=loc, th=th + dl, lens=lens, focus=focus, fstop=fstop, d=d, dl=dl)


def anchor_y(loc, th, lens, size, anchor):
    """Where `anchor` sits on the frame (from the top) for a camera at `loc` pitched `th` (Euler X)."""
    rel = anchor - loc
    beta = math.atan2(-rel.z, rel.y)                    # below the camera's horizontal
    return 0.5 + math.tan(beta - (math.pi / 2 - th)) / (2.0 * tan_v_of(size, lens))


def cam_pose(f, size):
    """The camera at frame f. In the landing it eases back to the ring camera, and pitches so the light's place on the
    frame moves straight from where the fall held it to where the ring camera sees the pivot."""
    tp = track_pose(f, size)
    if f <= 260:
        return tp
    t = ease_io(span(f, 260, F_END))
    tf = ease_io(span(f, 260, 284))
    rp = ring_camera_pose(size)
    loc = tp["loc"].lerp(rp["loc"], t)
    lens = lerp(tp["lens"], rp["lens"], t)
    y_s = lerp(Y_FALL, anchor_y(rp["loc"], rp["th"], rp["lens"], size, RING_CENTER), t)
    rel = Vector((0.0, 0.0, ANCHOR_Z[f])) - loc
    beta = math.atan2(-rel.z, rel.y)
    th = math.pi / 2 - (beta - math.atan((y_s - 0.5) * 2.0 * tan_v_of(size, lens)))
    return dict(loc=loc, th=th, lens=lens, focus=lerp(tp["focus"], rp["focus"], tf),
                fstop=lerp(tp["fstop"], rp["fstop"], tf), d=tp["d"], dl=tp["dl"])


def sway_dx(f, size, d, dl):
    lens = SIZES[size]["lens"]
    return (sway_x(f) - 0.5) * 2.0 * d * math.cos(dl) * tan_h(lens)


def light_path(size):
    """The light's centre, frame by frame (index 0 unused)."""
    pts = [None] * (F_END + 1)
    tp260 = track_pose(260, size)
    for f in range(1, F_END + 1):
        if f < F_FALL:
            dx = 0.0
        elif f <= 260:
            tp = track_pose(f, size)
            dx = sway_dx(f, size, tp["d"], tp["dl"])
        else:
            dx = sway_dx(f, size, tp260["d"], tp260["dl"]) * (1.0 - ease_io(span(f, 260, 284)))
        pts[f] = Vector((dx, 0.0, ANCHOR_Z[f]))
    return pts


LIGHT_POS = light_path(SIZE)

# the light's size: a share of the frame's width while the camera follows it (kept so as it comes down through the O,
# so the eye sees one steady light), then a fixed size from the landing on (it moves away from the camera, as it is).
LIGHT_ALPHA = {"desk": (0.011, 0.025), "phone": (0.022, 0.05)}    # at F_IGNITE, and from F_SIDE on


def light_radius(f, size=SIZE):
    a8, af = LIGHT_ALPHA[size]
    ff = min(f, 260)
    if ff <= F_IGNITE:
        a = a8 * ease_out(span(ff, 1, F_IGNITE))
    else:
        a = lerp(a8, af, ease_io(span(ff, F_IGNITE, F_SIDE)))
    tp = track_pose(ff, size)
    return max(a, 1e-4) * 2.0 * tp["d"] * math.cos(tp["dl"]) * tan_h(SIZES[size]["lens"])


def glow_at(f):
    """The light's brightness, filaments included: lit over 1-8, a slow breath, out as it becomes the needle."""
    if f <= 1:
        return 0.0
    g = ease_io(span(f, 1, F_IGNITE))
    if f > F_IGNITE:
        g *= 1.0 - 0.08 * (0.5 - 0.5 * math.cos(2.0 * math.pi * (f - F_IGNITE) / 48.0))
    g *= 1.0 - ease_io(span(f, 287, F_END))
    return clamp01(g)


def fact_at(f):
    """The fact riding with the light (index, opacity): fact i over 61 + 40i .. 100 + 40i, 6 frames in, 6 out."""
    if not (F_FALL <= f <= 260):
        return None, 0.0
    i = (f - F_FALL) // 40
    k = (f - F_FALL) % 40
    op = ease_io(min(1.0, (k + 1) / 6.0)) * ease_io(min(1.0, (40 - k) / 6.0))
    return int(i), round(op, 4)


def phase_at(f):
    return "way-in" if f < F_FALL else "fall" if f < F_LAND else "landing"


# ---------------------------------------------------------------- materials
def node_mat(name, method='DITHERED'):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes.clear()
    m.surface_render_method = method
    return m, m.node_tree.nodes.new, m.node_tree.links.new


def math_node(N, L, op, a, b=None, clamp=False):
    n = N('ShaderNodeMath')
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            L(v, n.inputs[i])
    return n.outputs[0]


def mat_emit_solid(name, colour, strength):
    m, N, L = node_mat(name)
    out = N('ShaderNodeOutputMaterial')
    em = N('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*colour, 1)
    em.inputs['Strength'].default_value = strength
    L(em.outputs[0], out.inputs['Surface'])
    return m, em.inputs['Strength']


def mat_additive(name, colour, build_strength):
    """Additive light: the surface lets everything behind it through and adds its emission (soft, no edge)."""
    m, N, L = node_mat(name, 'BLENDED')
    m.use_backface_culling = True
    out = N('ShaderNodeOutputMaterial')
    em = N('ShaderNodeEmission')
    if isinstance(colour, tuple):
        em.inputs['Color'].default_value = (*colour, 1)
    else:
        L(colour(N, L), em.inputs['Color'])
    level = N('ShaderNodeValue')
    level.name = "level"
    level.outputs[0].default_value = 1.0
    L(math_node(N, L, 'MULTIPLY', build_strength(N, L), level.outputs[0]), em.inputs['Strength'])
    tr = N('ShaderNodeBsdfTransparent')
    add = N('ShaderNodeAddShader')
    L(tr.outputs[0], add.inputs[0])
    L(em.outputs[0], add.inputs[1])
    L(add.outputs[0], out.inputs['Surface'])
    return m, level.outputs[0]


# AgX desaturates bright light toward white, so the light's golds go in deeper than they come out: these read as the
# concept frames' gold (v1: about (255, 201, 84)) near the light, with the white-hot core at its middle.
WHITE_GOLD = (1.0, 0.62, 0.25)       # the core: white-hot where it clips, its bloom gold
LIGHT_GOLD = (1.0, 0.40, 0.04)
TRAIL_GOLD = (1.0, 0.33, 0.02)
AMBER = (0.8, 0.2, 0.0)

M_CORE, CORE_LEVEL = mat_emit_solid("ld_core", WHITE_GOLD, 1.0)


def shell_strength(N, L):
    lw = N('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.5
    rim = math_node(N, L, 'POWER', lw.outputs['Facing'], 2.2)
    return math_node(N, L, 'ADD', math_node(N, L, 'MULTIPLY', rim, 0.85), 0.12)    # a glassy rim, a faint face


M_SHELL, SHELL_LEVEL = mat_additive("ld_shell", (1.0, 0.40, 0.05), shell_strength)


def halo_strength(N, L):
    tc = N('ShaderNodeTexCoord')
    vl = N('ShaderNodeVectorMath')
    vl.operation = 'LENGTH'
    L(tc.outputs['Object'], vl.inputs[0])
    inv = math_node(N, L, 'SUBTRACT', 1.0, vl.outputs['Value'], clamp=True)
    return math_node(N, L, 'POWER', inv, 3.2)


M_HALO, HALO_LEVEL = mat_additive("ld_halo", (1.0, 0.38, 0.04), halo_strength)


def trail_colour(N, L):
    uv = N('ShaderNodeUVMap')
    sep = N('ShaderNodeSeparateXYZ')
    L(uv.outputs['UV'], sep.inputs[0])
    ramp = N('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*LIGHT_GOLD, 1)
    e = ramp.color_ramp.elements.new(0.15)
    e.color = (*TRAIL_GOLD, 1)
    ramp.color_ramp.elements[-1].position = 1.0
    ramp.color_ramp.elements[-1].color = (*AMBER, 1)
    L(sep.outputs['X'], ramp.inputs['Fac'])
    return ramp.outputs['Color']


def trail_strength(N, L):
    uv = N('ShaderNodeUVMap')
    sep = N('ShaderNodeSeparateXYZ')
    L(uv.outputs['UV'], sep.inputs[0])
    age = math_node(N, L, 'POWER', math_node(N, L, 'SUBTRACT', 1.0, sep.outputs['X'], clamp=True), 1.7)
    lw = N('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.5
    core = math_node(N, L, 'POWER', math_node(N, L, 'SUBTRACT', 1.0, lw.outputs['Facing'], clamp=True), 1.6)
    return math_node(N, L, 'MULTIPLY', age, core)


M_TRAIL, TRAIL_LEVEL = mat_additive("ld_trail", trail_colour, trail_strength)
M_STRAND, STRAND_LEVEL = mat_additive("ld_strand", trail_colour, trail_strength)

# ---------------------------------------------------------------- the light: core, shell, halo, filaments, glow
def link_new(name, data, parent=None):
    ob = bpy.data.objects.new(name, data)
    LD_COL.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def sphere_mesh(name, radius, u=48, v=24):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=radius)
    for fc in bm.faces:
        fc.smooth = True
    bm.to_mesh(me)
    bm.free()
    return me


light_root = link_new("ld_light", None)
light_root.empty_display_size = 1.0
core = link_new("ld_light_core", sphere_mesh("ld_light_core", 0.32, 32, 16), light_root)
core.data.materials.append(M_CORE)
shell = link_new("ld_light_shell", sphere_mesh("ld_light_shell", 1.0), light_root)
shell.data.materials.append(M_SHELL)
hm = bpy.data.meshes.new("ld_light_halo")
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
bm.to_mesh(hm)
bm.free()
HALO_R = 5.0
halo = link_new("ld_light_halo", hm, light_root)
halo.data.materials.append(M_HALO)
halo.scale = (HALO_R,) * 3
glow_ld = bpy.data.lights.new("ld_light_glow", 'POINT')
glow_ld.color = (1.0, 0.7, 0.4)
glow_ld.energy = 0.0
glow_ld.volume_factor = 1.0
link_new("ld_light_glow", glow_ld, light_root)

# filaments: thin electric threads round the light, in units of its radius; each takes a new shape every
# FIL_STEP frames and eases into it, so they crawl and never flicker
FIL_STEP = 6
FIL_N = 10
FILAMENTS = ("tendril", "tendril", "tendril", "tendril", "tendril", "arc", "arc", "arc")
fil_objs, fil_levels = [], []
for k, kind in enumerate(FILAMENTS):
    cu = bpy.data.curves.new(f"ld_filament_{k}", 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.018
    cu.bevel_resolution = 1
    sp = cu.splines.new('POLY')
    sp.points.add(FIL_N - 1)
    m, lvl = mat_emit_solid(f"ld_filament_{k}", (1.0, 0.45, 0.08), 0.0)
    cu.materials.append(m)
    fil_objs.append(link_new(f"ld_filament_{k}", cu, light_root))
    fil_levels.append(lvl)


def unit(rng):
    while True:
        v = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
        if v.length > 1e-3:
            return v.normalized()


def basis(d):
    p = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    return p, d.cross(p).normalized()


def filament_shape(k, n):
    rng = random.Random(9173 * (k + 1) + 31 * n)
    kind = FILAMENTS[k]
    pts = []
    if kind == "tendril":
        d = unit(rng)
        p, q = basis(d)
        reach = rng.uniform(1.6, 2.5)
        for i in range(FIL_N):
            t = i / (FIL_N - 1)
            j = 0.0 if i == 0 else 0.17 * t ** 0.6
            pts.append(d * lerp(0.9, reach, t) + p * j * rng.uniform(-1, 1) + q * j * rng.uniform(-1, 1))
    else:
        a = unit(rng)
        p, q = basis(a)
        ang = math.radians(rng.uniform(50, 85))
        b = (a * math.cos(ang) + p * math.sin(ang)).normalized()
        for i in range(FIL_N):
            t = i / (FIL_N - 1)
            dirv = a.slerp(b, t)
            rad = 1.03 + 0.32 * math.sin(math.pi * t) + (0.0 if i in (0, FIL_N - 1) else rng.uniform(-0.06, 0.06))
            pts.append(dirv.normalized() * rad + q * rng.uniform(-0.05, 0.05) * math.sin(math.pi * t))
    return pts


def filament_at(k, f):
    n = int(f // FIL_STEP)
    t = ease_io((f - n * FIL_STEP) / float(FIL_STEP))
    a, b = filament_shape(k, n), filament_shape(k, n + 1)
    return [pa.lerp(pb, t) for pa, pb in zip(a, b)]


def filament_brightness(k, f):
    return 0.55 + 0.45 * math.sin(2.0 * math.pi * f / (37.0 + 6.0 * k) + 1.7 * k)


# the trail: a tapered tube along the light's past positions, rebuilt each frame in world space. It fades with age
# (TRAIL_FRAMES) and with length (TRAIL_LENGTH m), whichever comes first, so the quick way down through the O leaves a
# short trail, not a pillar.
TRAIL_FRAMES = 110
TRAIL_LENGTH = 2.8
TRAIL_W = 0.5
TRAIL_SIDES = 10
trail_me = bpy.data.meshes.new("ld_trail")
trail = link_new("ld_trail", trail_me)
trail.data.materials.append(M_TRAIL)
trail.data.materials.append(M_STRAND)


def build_trail(f, r_now):
    pts = []
    run = 0.0
    for k in range(0, TRAIL_FRAMES + 1):
        g = f - k
        if g < F_IGNITE:
            break
        p = LIGHT_POS[g]
        if pts:
            step = (p - pts[-1][0]).length
            if step < 1e-5:
                continue
            run += step
        u = max(k / float(TRAIL_FRAMES), run / TRAIL_LENGTH)
        if u > 1.0:
            break
        pts.append((p, u))
    me = trail.data
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    if len(pts) >= 3:
        tangents = []
        for i in range(len(pts)):
            a = pts[max(i - 1, 0)][0]
            b = pts[min(i + 1, len(pts) - 1)][0]
            tangents.append((b - a).normalized())
        nrm = tangents[0].cross(Vector((1, 0, 0)))
        if nrm.length < 1e-3:
            nrm = tangents[0].cross(Vector((0, 1, 0)))
        nrm.normalize()
        frames = []
        for t in tangents:
            nrm = (nrm - t * nrm.dot(t)).normalized()
            frames.append((nrm.copy(), t.cross(nrm).normalized()))

        def tube(radius_of, offset_of, sides, mat_index):
            rings = []
            for i, ((p, u), (n, b)) in enumerate(zip(pts, frames)):
                c = p + offset_of(i, u, n, b)
                rad = radius_of(u)
                rings.append([bm.verts.new(c + (n * math.cos(2 * math.pi * s / sides) + b * math.sin(2 * math.pi * s / sides)) * rad)
                              for s in range(sides)])
            for i in range(len(rings) - 1):
                u0, u1 = pts[i][1], pts[i + 1][1]
                for s in range(sides):
                    s1 = (s + 1) % sides
                    fc = bm.faces.new((rings[i][s], rings[i][s1], rings[i + 1][s1], rings[i + 1][s]))
                    fc.smooth = True
                    fc.material_index = mat_index
                    for lp, uu in zip(fc.loops, (u0, u0, u1, u1)):
                        lp[uvl].uv = (uu, 0.0)

        tube(lambda u: r_now * TRAIL_W * (1.0 - u) ** 1.35 + 1e-5, lambda i, u, n, b: Vector(), TRAIL_SIDES, 0)
        for j in range(2):   # two fine strands winding slowly round the trail
            ph = 2.0 * math.pi * j / 2 + 0.035 * f

            def off(i, u, n, b, ph=ph):
                w = r_now * 0.75 * (1.0 - u) ** 0.7 * min(1.0, u * 8.0)
                a = ph + 2.0 * math.pi * 2.2 * u
                return (n * math.cos(a) + b * math.sin(a)) * w
            tube(lambda u: r_now * 0.07 * (1.0 - u) + 1e-5, off, 6, 1)
        bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.update()


# ---------------------------------------------------------------- the void: its mist band, more dust, clear paths
# The mist band: a violet haze held behind the light at a set place on the frame (a backdrop on the camera), wisps
# drifting through it. lightdive-v1 and -ring2 have it across the upper middle of the frame.
BAND = {"desk": dict(y=0.40, sigma=0.075, strength=0.55), "phone": dict(y=0.40, sigma=0.045, strength=0.55)}
# It hangs BAND_D in front of the camera: near in the way and the fall, so the glass sky never cuts it (it adds light
# and hides nothing behind it), and behind the ring in the landing (the camera looks down there), so the beads stand
# in front of it, as in lightdive-ring2.
BAND_D = 12.0
BAND_D_RING = {"desk": 26.0, "phone": 30.0}
mist_me = bpy.data.meshes.new("ld_mist")
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
bm.to_mesh(mist_me)
bm.free()
mist = link_new("ld_mist", mist_me, LD_CAM)
mist.location = (0.0, 0.0, -BAND_D)


def mist_strength(N, L):
    tc = N('ShaderNodeTexCoord')
    sep = N('ShaderNodeSeparateXYZ')
    L(tc.outputs['Object'], sep.inputs[0])
    c = N('ShaderNodeValue'); c.name = "band_c"
    w = N('ShaderNodeValue'); w.name = "band_w"
    z = math_node(N, L, 'DIVIDE', math_node(N, L, 'SUBTRACT', sep.outputs['Y'], c.outputs[0]), w.outputs[0])
    band = math_node(N, L, 'EXPONENT', math_node(N, L, 'MULTIPLY', math_node(N, L, 'MULTIPLY', z, z), -1.0))
    mp = N('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.6, 5.0, 1.0)
    L(tc.outputs['Object'], mp.inputs['Vector'])
    drift = N('ShaderNodeValue'); drift.name = "drift"
    comb = N('ShaderNodeCombineXYZ')
    L(drift.outputs[0], comb.inputs['X'])
    L(comb.outputs[0], mp.inputs['Location'])
    nz = N('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = 1.4
    nz.inputs['Detail'].default_value = 7.0
    nz.inputs['Roughness'].default_value = 0.62
    nz.inputs['Distortion'].default_value = 0.6
    wv = N('ShaderNodeValue'); wv.name = "w"
    L(mp.outputs['Vector'], nz.inputs['Vector'])
    L(wv.outputs[0], nz.inputs['W'])
    mr = N('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.36
    mr.inputs['From Max'].default_value = 0.72
    L(nz.outputs['Fac'], mr.inputs['Value'])
    wisps = math_node(N, L, 'ADD', math_node(N, L, 'MULTIPLY', mr.outputs['Result'], 0.75), 0.25)
    # fade at the plane's sides, which sit past the frame's edges
    ax = math_node(N, L, 'ABSOLUTE', sep.outputs['X'])
    side = math_node(N, L, 'SUBTRACT', 1.0, math_node(N, L, 'POWER', ax, 6.0), clamp=True)
    return math_node(N, L, 'MULTIPLY', math_node(N, L, 'MULTIPLY', band, wisps), side)


M_MIST, MIST_LEVEL = mat_additive("ld_mist", (0.42, 0.24, 1.0), mist_strength)
M_MIST.use_backface_culling = False
mist.data.materials.append(M_MIST)
mist_nodes = M_MIST.node_tree.nodes


def all_camera_paths():
    """Where the camera goes, for both sizes, and where the light goes: the dust keeps clear of them."""
    pts = []
    for size in SIZES:
        for f in range(1, F_END + 1):
            pts.append(("cam", cam_pose(f, size)["loc"]))
        for p in light_path(size)[1:]:
            pts.append(("light", p))
    return pts


PATHS = all_camera_paths()
CLEAR = {"cam": 1.7, "light": 0.9}
path_tree = {}
for kind in CLEAR:
    sel = [p for k, p in PATHS if k == kind]
    t = KDTree(len(sel))
    for i, p in enumerate(sel):
        t.insert(p, i)
    t.balance()
    path_tree[kind] = t


def too_close(c, margin=0.0):
    return any(path_tree[k].find(c)[2] < CLEAR[k] + margin for k in CLEAR)


# bob_scroll.py's dust, less the specks the camera's new path would pass through (they would blow up into discs)
old_dust = sc.objects["bob_void_dust"]
bm = bmesh.new()
bm.from_mesh(old_dust.data)
bm.verts.ensure_lookup_table()
seen, drop = set(), []
LD_OLD_DUST_DROPPED = 0
for v in bm.verts:
    if v.index in seen:
        continue
    island, stack = [], [v]
    seen.add(v.index)
    while stack:
        a = stack.pop()
        island.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen:
                seen.add(b.index)
                stack.append(b)
    c = sum((x.co for x in island), Vector()) / len(island)
    if too_close(old_dust.matrix_world @ c):
        drop.extend(island)
        LD_OLD_DUST_DROPPED += 1
bmesh.ops.delete(bm, geom=drop, context='VERTS')
bm.to_mesh(old_dust.data)
bm.free()

# more dust through the depth of the fall, fading in with the void
random.seed(25)
dm = bpy.data.meshes.new("ld_dust")
bm = bmesh.new()
placed = 0
DUST_DRIFT = Vector((0.0012, 0.0, 0.0016))       # m a frame
while placed < 340:
    c = Vector((random.uniform(-14, 14), random.uniform(-9, 32), random.uniform(RING_HEIGHT - 7.0, -1.7)))
    if too_close(c, 0.6):
        continue
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=random.uniform(0.007, 0.024), matrix=Matrix.Translation(c))
    placed += 1
bm.to_mesh(dm)
bm.free()
ld_dust = link_new("ld_dust", dm)
M_LD_DUST = mat_gold_emit("ld_dust", 0.0, base_metal=False)
ld_dust.data.materials.append(M_LD_DUST)
LD_DUST_EMIT = next(n for n in M_LD_DUST.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Emission Strength']
OLD_DUST_EMIT = next(n for n in bpy.data.materials["bob_dust"].node_tree.nodes
                     if n.type == 'BSDF_PRINCIPLED').inputs['Emission Strength']
OLD_DUST_REST = OLD_DUST_EMIT.default_value

# The void's clock. The mist band fades in round the light from 20. The dust waits until the passage's motion blur is
# off (BLUR_FRAMES, which ends with the glass top at 28): under the blur, dust rushing past a held light is drawn into
# dashes converging on it, the warp look Bob turned down. bob_scroll.py's dust, a few specks through the O at BOB seen
# from above, goes dark before the blur starts and comes back with the rest. Past frame 300 the band holds its place,
# its wisps and the dust drift on: Task 2 evaluates void_state(300 + its frame) and carries on with no seam.
VOID_IN = (20, 60)
DUST_IN = (28, 60)
OLD_DUST_OUT = (6, 11)


def void_state(f, size=SIZE):
    """The void at frame f (any frame, past 300 too): the mist band's place on the frame (from the top), width,
    distance from the camera and strength, its wisps' drift and noise W, and the dust's drift and glow."""
    b = BAND[size]
    dust_in = ease_io(span(f, *DUST_IN))
    old = 1.0 - ease_io(span(f, *OLD_DUST_OUT)) if f < DUST_IN[0] else dust_in
    return dict(
        band_y=lerp(b["y"] + 0.02, b["y"] - 0.04, span(f, F_FALL, F_END)),
        band_sigma=b["sigma"],
        band_d=lerp(BAND_D, BAND_D_RING[size], ease_io(span(f, 258, 272))),
        band_strength=b["strength"] * ease_io(span(f, *VOID_IN)),
        drift=0.0025 * f,
        w=0.004 * f,
        dust_offset=DUST_DRIFT * f,
        dust_emit=2.4 * dust_in,
        old_dust_emit=OLD_DUST_REST * old,
    )


# The ring's void. Past frame 300 only the wisps' drift and noise W and the dust's drift move, each straight on with the
# frame; the band and the glows hold. Run straight on (void_state(300 + f)), the dust would stand 239 frames' drift
# away from frame 0's at the wrap and jump back, and the wisps would change. So the ring reads them off a looping
# clock, 300 + (240 / 2 pi) sin(2 pi f / 240): frame 0 is frame 300 exactly, the drift leaves it at the way's own
# speed (the clock's slope there is 1), sways forward to 300 + 38 at 60 and back through 300 at 120 to 300 - 38 at
# 180, and is at frame 0's state again at 240.
RING_VOID_SWING = RING_FRAMES / (2.0 * math.pi)
RING_VOID_MOVING = ("drift", "w", "dust_offset")


def ring_void_state(f, size=SIZE):
    vs = void_state(F_END, size)
    moving = void_state(F_END + RING_VOID_SWING * math.sin(2.0 * math.pi * f / RING_FRAMES), size)
    for k in RING_VOID_MOVING:
        vs[k] = moving[k]
    return vs


# Over the clock's whole range (300 - 38.2 .. 300 + 38.2, sampled from 262 to 338): the drifting fields run straight
# on with the clock, so reading them below 300 picks up none of the landing's transitions; and from 300 on the rest
# holds frame 300's, so the ring's band and glows are the ones the way leaves.
def _comps(v):
    return tuple(v) if hasattr(v, "__len__") else (v,)


_v0, _v1 = void_state(F_END), void_state(F_END + 1)
for _c in (262.0, 275.0, 288.0, 300.0, 313.0, 326.0, 338.0):
    _v = void_state(_c)
    for _k in RING_VOID_MOVING:
        assert all(abs(a - a0 - (_c - F_END) * (a1 - a0)) < 1e-5          # mathutils vectors are float32
                   for a, a0, a1 in zip(_comps(_v[_k]), _comps(_v0[_k]), _comps(_v1[_k]))), (_c, _k)
    if _c >= F_END:
        assert all(_v[_k] == _v0[_k] for _k in _v0 if _k not in RING_VOID_MOVING), _c

# ---------------------------------------------------------------- the beads, from the site's GLB, in the ring
for root, _m in beads:                                   # bob_scroll.py's preview beads give way to the site's
    for ob in [root] + list(root.children_recursive):
        ob.hide_render = True
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=BEADS_GLB)
imported = [o for o in bpy.data.objects if o not in before]
for ob in imported:
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    LD_COL.objects.link(ob)
ring_beads = []
for idx, (bid, angle) in enumerate(RING_BEADS):
    root = bpy.data.objects[f"bead_{bid}"]
    root.rotation_mode = 'QUATERNION'
    inner = bpy.data.objects[f"bead_{bid}_inner"].data
    inner.energy = RING_INNER_W
    disp = bpy.data.objects[f"bead_{bid}_display"]
    screen = bpy.data.materials["bead:display"].copy()
    screen.name = f"ld_screen_{bid}"
    nt = screen.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(BEAD_SHOTS, f"{bid}.webp"), check_existing=True)
    tex.extension = 'CLIP'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 0.6
    disp.material_slots[1].link = 'OBJECT'
    disp.material_slots[1].material = screen
    ring_beads.append((root, angle))
# the front bead answers the needle: its own gold for its halo and rim, which glows up as the needle points at it
FUNCIAL_GOLD = bpy.data.materials["bead:gold"].copy()
FUNCIAL_GOLD.name = "ld_funcial_gold"
for part in ("halo", "rim"):
    ob = bpy.data.objects[f"bead_funcial_{part}"]
    for slot in ob.material_slots:
        if slot.material and slot.material.name == "bead:gold":
            slot.link = 'OBJECT'
            slot.material = FUNCIAL_GOLD
# The GLB carries the gold's glow in its emission colour (the gold light times 0.2, strength 1): Funcial's copy takes
# the full gold light as its colour and the glow as its strength, so RING_BEAD_GLOW is the others' and the GLB's.
FUNCIAL_BSDF = next(n for n in FUNCIAL_GOLD.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
FUNCIAL_BSDF.inputs['Emission Color'].default_value = (1.0, 0.52, 0.16, 1.0)
FUNCIAL_EMIT = FUNCIAL_BSDF.inputs['Emission Strength']
FUNCIAL_EMIT.default_value = RING_BEAD_GLOW
# In the ring every bead answers in turn, so each has its own copy, made as Funcial's. At RING_BEAD_GLOW the copy is the
# GLB's gold exactly (its emission colour is the gold light times 0.2 at strength 1), so frame 0 is the way's frame 300.
BEAD_GLOW = {"funcial": FUNCIAL_EMIT}
if PART == "ring":
    _glb_gold = next(n for n in bpy.data.materials["bead:gold"].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    assert all(abs(_glb_gold.inputs['Emission Color'].default_value[i] - RING_BEAD_GLOW * c) < 1e-6
               for i, c in enumerate((1.0, 0.52, 0.16))) and _glb_gold.inputs['Emission Strength'].default_value == 1.0
    for bid, _angle in RING_BEADS[1:]:
        gold = bpy.data.materials["bead:gold"].copy()
        gold.name = f"ld_{bid}_gold"
        for part in ("halo", "rim"):
            ob = bpy.data.objects[f"bead_{bid}_{part}"]
            for slot in ob.material_slots:
                if slot.material and slot.material.name == "bead:gold":
                    slot.link = 'OBJECT'
                    slot.material = gold
        bsdf = next(n for n in gold.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Emission Color'].default_value = (1.0, 0.52, 0.16, 1.0)
        bsdf.inputs['Emission Strength'].default_value = RING_BEAD_GLOW
        BEAD_GLOW[bid] = bsdf.inputs['Emission Strength']
GLASS_MAT = bpy.data.materials["bead:glass"]        # as export_beads.py makes it: traced refraction, a thin slab
GLASS_MAT.surface_render_method = 'DITHERED'
GLASS_MAT.use_raytrace_refraction = True
GLASS_MAT.thickness_mode = 'SLAB'

# the bead key: the site's key is directional; warm, from the camera's side, above and to the left
kd2 = bpy.data.lights.new("ld_bead_key", 'SUN')
kd2.energy, kd2.angle, kd2.color, kd2.volume_factor = 0.0, math.radians(1.0), (1.0, 0.75, 0.48), 0.0
bead_key2 = link_new("ld_bead_key", kd2)
bead_key2.rotation_euler = Vector(RING_KEY["direction"]).to_track_quat('-Z', 'Y').to_euler()

# the needle at the ring's centre: the compass needle and pivot, free, nothing holding them
M_RING_NEEDLE = mat_gold_emit("ld_needle_gold", RING_NEEDLE_GLOW)
RING_NEEDLE_EMIT = next(n for n in M_RING_NEEDLE.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Emission Strength']
ring_needle = link_new("ld_ring_needle", sc.objects["bob_needle"].data.copy())
ring_needle.data.materials.clear()
ring_needle.data.materials.append(M_RING_NEEDLE)
ring_needle.location = RING_CENTER
ring_needle.rotation_euler = (math.pi / 2, 0.0, 0.0)          # tip (local +Z) toward the front bead (-Y)
ring_pivot = link_new("ld_ring_pivot", sc.objects["bob_pivot"].data.copy())
ring_pivot.data.materials.clear()
ring_pivot.data.materials.append(M_RING_NEEDLE)
ring_pivot.location = RING_CENTER

# ---------------------------------------------------------------- render settings
r = LD_SCENE.render
r.resolution_x, r.resolution_y, r.resolution_percentage = RES_X, RES_Y, 100
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGB'
r.image_settings.color_depth = '8'
r.use_motion_blur = True
r.motion_blur_shutter = 0.5
LD_CAM.data.sensor_fit = 'HORIZONTAL'
LD_CAM.data.sensor_width = 36.0
LD_CAM.data.dof.use_dof = True
LD_CAM.data.dof.focus_object = None
rt = LD_SCENE.eevee.ray_tracing_options
rt.resolution_scale = '1'

# ---------------------------------------------------------------- keys: the camera and the light, every frame
prefs = bpy.context.preferences.edit
old_interp = prefs.keyframe_new_interpolation_type
prefs.keyframe_new_interpolation_type = 'LINEAR'
LIGHT_R = [0.0] * (F_END + 1)
for f in range(1, F_END + 1):
    cp = cam_pose(f, SIZE)
    LD_CAM.location = cp["loc"]
    LD_CAM.rotation_euler = Euler((cp["th"], 0.0, 0.0))
    LD_CAM.data.lens = cp["lens"]
    LD_CAM.data.dof.focus_distance = cp["focus"]
    LD_CAM.data.dof.aperture_fstop = cp["fstop"]
    LD_CAM.keyframe_insert("location", frame=f)
    LD_CAM.keyframe_insert("rotation_euler", frame=f)
    LD_CAM.data.keyframe_insert("lens", frame=f)
    LD_CAM.data.dof.keyframe_insert("focus_distance", frame=f)
    LD_CAM.data.dof.keyframe_insert("aperture_fstop", frame=f)
    rr = light_radius(f)
    LIGHT_R[f] = rr
    light_root.location = LIGHT_POS[f]
    s = ease_io(span(f, F_NEEDLE, F_END))                # the light stretches along the needle (toward -Y)
    light_root.scale = (rr * (1 - 0.65 * s), rr * (1 + 5.0 * s), rr * (1 - 0.65 * s))
    light_root.keyframe_insert("location", frame=f)
    light_root.keyframe_insert("scale", frame=f)
prefs.keyframe_new_interpolation_type = old_interp

# ---------------------------------------------------------------- the frame's state
SMOKE_DENS = bpy.data.materials["bob_smoke"].node_tree.nodes["smoke_density"].inputs[1]
SMOKE_REST = SMOKE_DENS.default_value
WELL_EMIT = bpy.data.materials["bob_well_glow"].node_tree.nodes["well_emit"].outputs[0]
WELL_REST = WELL_EMIT.default_value
WELL_LIGHT = sc.objects["bob_well_light"].data
WELL_LIGHT_REST = WELL_LIGHT.energy
OLD_NEEDLE = [sc.objects[n] for n in ("bob_needle", "bob_pivot", "bob_axis")]
OLD_NEEDLE_SCALE = [ob.scale.copy() for ob in OLD_NEEDLE]
CORE_W, SHELL_W, HALO_W, FIL_W, TRAIL_W_EM, STRAND_W, LIGHT_W = 18.0, 1.4, 0.75, 2.2, 1.6, 1.0, 30.0
LIGHT_OBJS = [core, shell, halo, trail] + fil_objs
# the traces on the glass sky are faint from under it (bob_scroll.py lights them for its overview, from further off)
CEIL_TRACE_EMIT = next(n for n in M_CEIL_TRACE.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Emission Strength']
CEIL_TRACE_EMIT.default_value = 0.11
# Out of the previs's own frame but in the phone's taller one, which stands further back: the loader's probe, lifted
# clear of the glass, and the front fill's mirror image in the glass. The site has neither at BOB seen from above.
for n in ("bob_probe", "bob_probe_tip", "bob_probe_light"):
    sc.objects[n].hide_render = True
sc.objects["bob_front_soft"].data.specular_factor = 0.0
# The glass top goes dark as the camera comes down to it: its lights, the engraving's and the rings' glow and the
# tunnel's. The letters and the compass slide out past the edges dimming, so they never stand round the light as a
# bright frame; by the time the camera is in the O there is only the light and the void opening round it.
TOP_FADE = (14, 28)
# The camera's motion blur is for the glass top rushing past, and ends with it. No dust is lit while it is on
# (void_state).
BLUR_FRAMES = (12, TOP_FADE[1])
assert BLUR_FRAMES[1] <= DUST_IN[0] and OLD_DUST_OUT[1] < BLUR_FRAMES[0]


def emission_inputs(mat):
    return [n.inputs['Emission Strength'] for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']


TOP_EMIT = []
for m in [M_LETTER, M_CIRCLE, M_TICKS, M_OUTER, M_LIP, M_TRACE, M_RIM] + \
        [bpy.data.materials[f"bob_ring_mat_{i + 1}"] for i in range(4)]:
    for inp in emission_inputs(m):
        TOP_EMIT.append((inp, inp.default_value))
TOP_LIGHTS = [(sc.objects[n].data, sc.objects[n].data.energy)
              for n in ("bob_key_rim", "bob_front_soft", "bob_violet_left", "bob_violet_right")]
# The floor's black glass and the tunnel dissolve as they dim, so the void opens all round the light, never only
# through the hole (a dark glass rim round a lit hole would be a porthole). The glass sky keeps an opaque copy of the
# glass, and is out of the picture while the camera is above it (seen from above it would be a second rim).
M_SKY_GLASS = M_GLASS.copy()
M_SKY_GLASS.name = "ld_sky_glass"
sc.objects["bob_void_ceiling"].material_slots[0].material = M_SKY_GLASS


def add_dissolve(mat):
    nt = mat.node_tree
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    src = out.inputs['Surface'].links[0].from_socket
    mix = nt.nodes.new('ShaderNodeMixShader')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    val = nt.nodes.new('ShaderNodeValue')
    val.name = "dissolve"
    val.outputs[0].default_value = 0.0
    nt.links.new(val.outputs[0], mix.inputs['Fac'])
    nt.links.new(src, mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return val.outputs[0]


DISSOLVE = [add_dissolve(M_GLASS), add_dissolve(bpy.data.materials["bob_well_glow"])]
TOP_HIDDEN = [(ob, ob.hide_render) for ob in LD_SCENE.objects if ob.name.startswith("bob_")   # as frozen at TOP_FRAME
              and not ob.name.startswith(("bob_void", "bob_ceiling", "bob_bead", "bob_camera"))
              and ob.name not in ("bob_needle", "bob_pivot", "bob_axis")]
SKY_OBJECTS = [sc.objects[n] for n in ("bob_void_ceiling", "bob_ceiling_traces", "bob_ceiling_ring")]
SKY_Z = CEIL_Z - 0.1          # the camera is under the glass sky below this


def set_void(vs, lens):
    """The void as `vs` (void_state's fields) for a camera of `lens` mm: the mist band on the camera, the dust."""
    bd = vs["band_d"]
    mist.location = (0.0, 0.0, -bd)
    mist.scale = (bd * tan_h(lens) * 1.15, bd * tan_v_of(SIZE, lens) * 1.15, 1.0)
    mist_nodes["band_c"].outputs[0].default_value = (1.0 - 2.0 * vs["band_y"]) / 1.15
    mist_nodes["band_w"].outputs[0].default_value = 2.0 * vs["band_sigma"] / 1.15
    mist_nodes["drift"].outputs[0].default_value = vs["drift"]
    mist_nodes["w"].outputs[0].default_value = vs["w"]
    MIST_LEVEL.default_value = vs["band_strength"]
    mist.hide_render = vs["band_strength"] <= 0.0
    LD_DUST_EMIT.default_value = vs["dust_emit"]
    ld_dust.location = vs["dust_offset"]
    ld_dust.hide_render = vs["dust_emit"] <= 0.0
    OLD_DUST_EMIT.default_value = vs["old_dust_emit"]
    old_dust.hide_render = vs["old_dust_emit"] <= 0.0


def apply_frame(f):
    LD_SCENE.frame_set(f)
    LD_SCENE.render.use_motion_blur = BLUR_FRAMES[0] <= f <= BLUR_FRAMES[1]
    cp = cam_pose(f, SIZE)
    g = glow_at(f)
    rr = LIGHT_R[f]
    # the compass's needle gives itself to the light
    k = 1.0 - ease_io(span(f, 2, F_IGNITE))
    for ob, s0 in zip(OLD_NEEDLE, OLD_NEEDLE_SCALE):
        ob.scale = s0 * max(k, 1e-4)
        ob.hide_render = k <= 0.0
    # the light
    CORE_LEVEL.default_value = CORE_W * g
    SHELL_LEVEL.default_value = SHELL_W * g
    HALO_LEVEL.default_value = HALO_W * g
    halo.rotation_euler = Euler((cp["th"], 0.0, 0.0))
    glow_ld.energy = LIGHT_W * g
    glow_ld.shadow_soft_size = rr
    fade_fil = 1.0 - ease_io(span(f, 282, 294))
    for i, (ob, lvl) in enumerate(zip(fil_objs, fil_levels)):
        sp = ob.data.splines[0]
        for p, co in zip(sp.points, filament_at(i, f)):
            p.co = (co.x, co.y, co.z, 1.0)
        lvl.default_value = FIL_W * g * fade_fil * filament_brightness(i, f)
    trail_on = ease_io(span(f, 40, F_SIDE)) * (1.0 - ease_io(span(f, 272, 296)))
    TRAIL_LEVEL.default_value = TRAIL_W_EM * g * trail_on
    STRAND_LEVEL.default_value = STRAND_W * g * trail_on
    build_trail(f, rr)
    for ob in LIGHT_OBJS:
        ob.hide_render = f >= F_END or g <= 0.0
    # the void
    set_void(void_state(f), cp["lens"])
    # the glass top dims, its haze and the tunnel's glow step aside as the camera comes through
    k_top = 1.0 - ease_io(span(f, *TOP_FADE))
    for inp, rest in TOP_EMIT:
        inp.default_value = rest * k_top
    for ld, rest in TOP_LIGHTS:
        ld.energy = rest * k_top
    for val in DISSOLVE:
        val.default_value = ease_io(span(f, TOP_FADE[0] + 2, TOP_FADE[1]))
    for ob, hidden in TOP_HIDDEN:
        ob.hide_render = hidden or f >= TOP_FADE[1]
    for ob in SKY_OBJECTS:
        ob.hide_render = f >= TOP_FADE[0] and cp["loc"].z > SKY_Z
    SMOKE_DENS.default_value = SMOKE_REST * (1.0 - ease_io(span(f, 12, 28)))
    WELL_EMIT.default_value = WELL_REST * (1.0 - ease_io(span(f, 10, 26)))
    WELL_LIGHT.energy = WELL_LIGHT_REST * (1.0 - ease_io(span(f, 10, 26)))
    # the ring rises into view, faces its camera, the needle is drawn out of the light
    rise = ease_out(span(f, 256, 292))
    rp = ring_camera_pose(SIZE)
    for root, angle in ring_beads:
        pos = ring_bead_position(angle) + Vector((0.0, 0.0, -RING_RISE * (1.0 - rise)))
        root.location = pos
        root.rotation_quaternion = bead_facing(pos, rp["loc"])
        hidden = f < 250
        for ob in [root] + list(root.children_recursive):
            ob.hide_render = hidden
    kd2.energy = RING_KEY["energy"] * ease_io(span(f, 256, 286))
    FUNCIAL_EMIT.default_value = lerp(RING_BEAD_GLOW, RING_FRONT_GLOW, ease_io(span(f, 288, F_END)))
    t = ease_io(span(f, F_NEEDLE, F_END))
    ring_needle.hide_render = ring_pivot.hide_render = f < F_NEEDLE
    sN = RING_NEEDLE_SCALE
    ring_needle.scale = (sN * (0.45 + 0.55 * t), sN * (0.45 + 0.55 * t), sN * max(ease_out(t), 1e-3))
    ring_pivot.scale = (sN * max(ease_out(span(f, F_NEEDLE, F_NEEDLE + 8)), 1e-3),) * 3
    RING_NEEDLE_EMIT.default_value = lerp(6.0, RING_NEEDLE_GLOW, ease_io(span(f, F_NEEDLE + 3, F_END)))
    LD_SCENE.view_layers[0].update()


def apply_ring(f):
    """Ring frame f: the way's frame 300 (the scene's clock held there, so the camera keeps the ring pose and nothing
    keyed moves), the ring turned ring_turn(f) under the needle with the bead behind the pivot lifted (ring_bead_at),
    each bead's answering glow, the void's looping clock."""
    apply_frame(F_END)
    rp = ring_camera_pose(SIZE)
    for root, angle in ring_beads:
        pos = ring_bead_at(angle, f)
        root.location = pos
        root.rotation_quaternion = bead_facing(pos, rp["loc"])
    for bid, angle in RING_BEADS:
        BEAD_GLOW[bid].default_value = lerp(RING_BEAD_GLOW, RING_FRONT_GLOW, ring_closeness(angle, f))
    set_void(ring_void_state(f), rp["lens"])
    LD_SCENE.view_layers[0].update()


def frame_data(f):
    co = world_to_camera_view(LD_SCENE, LD_CAM, LIGHT_POS[f])
    fact, op = fact_at(f)
    return {"f": f, "light": {"x": round(co.x, 5), "y": round(1.0 - co.y, 5)}, "glow": round(glow_at(f), 4),
            "fact": fact, "factOpacity": op, "phase": phase_at(f)}


def bead_outline(root):
    """The bead's outline radius (m): the furthest of its meshes' vertices from its centre."""
    c = root.matrix_world.translation
    r = 0.0
    for ob in [root] + list(root.children_recursive):
        if ob.type == 'MESH':
            mw = ob.matrix_world
            r = max([r] + [(mw @ v.co - c).length for v in ob.data.vertices])
    return r


def ring_projection(f, outline, tips):
    """Where the needle's tips and the beads' outlines fall on ring frame f's picture (the camera at the ring pose):
    x, y from the top left in shares of the width and height; a bead's outline radius in shares of the width."""
    right = LD_CAM.matrix_world.to_3x3() @ Vector((1.0, 0.0, 0.0))

    def scr(p):
        co = world_to_camera_view(LD_SCENE, LD_CAM, p)
        return co.x, 1.0 - co.y

    beads = []
    for bid, angle in RING_BEADS:
        c = ring_bead_at(angle, f)
        x, y = scr(c)
        x1, y1 = scr(c + right * outline[bid])
        beads.append([round(x, 5), round(y, 5), round(math.hypot((x1 - x) * RES_X, (y1 - y) * RES_Y) / RES_X, 5)])
    return {"needle": {k: [round(v, 5) for v in scr(p)] for k, p in tips.items()}, "beads": beads}


def ring_data(f, outline, tips):
    return {"f": f, "angle": ring_turn(f), "front": ring_front(f), "proj": ring_projection(f, outline, tips)}


def tip_gaps(entry):
    """The gap (px) from each needle tip to the nearest bead outline on a ring frame's projection."""
    p = entry["proj"]
    return {k: min(math.hypot((t[0] - b[0]) * RES_X, (t[1] - b[1]) * RES_Y) - b[2] * RES_X for b in p["beads"])
            for k, t in p["needle"].items()}


# ---------------------------------------------------------------- render
os.makedirs(OUT, exist_ok=True)
if PART == "way":
    frames = ONLY or list(range(1, F_END + 1))
    print(f"LIGHT_DIVE way {SIZE}: frozen {LD_FROZEN} keyed values at {TOP_FRAME}; V_FALL {V_FALL:.4f} m/frame; "
          f"old dust dropped {LD_OLD_DUST_DROPPED}; samples {LD_SCENE.eevee.taa_render_samples}")
    print("LIGHT_DIVE camera z / light z:", ", ".join(f"{f}: {cam_pose(f, SIZE)['loc'].z:.2f}/{LIGHT_POS[f].z:.2f}"
                                                      for f in (8, 16, 20, 24, 28, 30, 32, 36, 38, 40, 42, 46, 60, 84)))
    data = []
    for f in range(1, F_END + 1):
        LD_SCENE.frame_set(f)
        data.append(frame_data(f))
    apply = apply_frame
else:
    frames = ONLY if ONLY is not None else list(range(RING_FRAMES))
    assert all(0 <= f < RING_FRAMES for f in frames), frames
    print(f"LIGHT_DIVE ring {SIZE}: {RING_FRAMES} frames, {RING_STEP} degrees a frame, rests at "
          f"{[f for f in range(RING_FRAMES) if ring_turn(f) % RING_SPACING == 0.0]}; frozen {LD_FROZEN} keyed values; "
          f"samples {LD_SCENE.eevee.taa_render_samples}")
    apply_ring(0)        # the ring pose and the needle at its full size: the outlines and tips the data projects
    outline = {bid: bead_outline(root) for (bid, _a), (root, _b) in zip(RING_BEADS, ring_beads)}
    nv = ring_needle.data.vertices
    tips = {"front": ring_needle.matrix_world @ max(nv, key=lambda v: v.co.z).co,
            "back": ring_needle.matrix_world @ min(nv, key=lambda v: v.co.z).co}
    data = [ring_data(f, outline, tips) for f in range(RING_FRAMES)]
    gaps = [tip_gaps(e) for e in data]
    for k in ("back", "front"):
        g, at = min((g[k], f) for f, g in enumerate(gaps))
        print(f"LIGHT_DIVE ring {SIZE}: the needle's {k} tip clears every bead outline by {g:.1f} px at least (frame {at})")
    print("LIGHT_DIVE ring outlines (m):", {k: round(v, 3) for k, v in outline.items()}, "lift", RING_LIFT)
    apply = apply_ring
t_all = time.time()
times = []
for f in frames:
    apply(f)
    LD_SCENE.render.filepath = os.path.join(OUT, f"{f:04d}.png")
    t0 = time.time()
    bpy.ops.render.render(write_still=True, scene=LD_SCENE.name)
    times.append(time.time() - t0)
    print(f"LIGHT_DIVE frame {f} {times[-1]:.2f} s")
print(f"LIGHT_DIVE rendered {len(frames)} frames in {time.time() - t_all:.1f} s (mean {sum(times) / len(times):.2f} s)")

# ---------------------------------------------------------------- measure what the fixes promise
# The way, on frame 120: the shell's ring and the trail just above the light (it should read gold, not cream). On its
# frame 300 and on the ring's frames: each bead's halo band and porthole rim (the front one should be the brightest),
# and, for the ring, each bead's answering glow and where it stands on the frame (its centre from the top left and its
# halo's radius, in shares of the width and height). Mean sRGB 0..255 over an annulus projected from the scene, and
# over its brightest third (the band itself, not the dark round it).
def measure(f):
    import numpy as np
    path = os.path.join(OUT, f"{f:04d}.png")
    if not os.path.exists(path):
        return None
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = 'Non-Color'
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[:, :, :3] * 255.0
    bpy.data.images.remove(img)
    apply(f)
    yy, xx = np.mgrid[0:h, 0:w]

    def screen(p):
        co = world_to_camera_view(LD_SCENE, LD_CAM, p)
        return co.x * w, co.y * h, co.z

    def radius_px(p, rad):
        x0, y0, _ = screen(p)
        x1, y1, _ = screen(p + LD_CAM.matrix_world.to_3x3() @ Vector((rad, 0.0, 0.0)))
        return math.hypot(x1 - x0, y1 - y0)

    def ring_stats(p, r_in, r_out):
        x0, y0, _ = screen(p)
        d = np.hypot(xx - x0, yy - y0)
        sel = px[(d >= r_in) & (d <= r_out)]
        if len(sel) == 0:
            return None
        lum = sel @ np.array([0.2126, 0.7152, 0.0722])
        top = sel[lum >= np.quantile(lum, 2.0 / 3.0)]
        return {"mean": [round(float(v)) for v in sel.mean(0)], "top_third": [round(float(v)) for v in top.mean(0)]}

    out = {"frame": f}
    if PART == "way" and f < F_END:
        c = LIGHT_POS[f]
        rr = LIGHT_R[f]
        rp = radius_px(c, rr)
        out["shell"] = ring_stats(c, 0.8 * rp, 1.0 * rp)
        far = [LIGHT_POS[f - k] for k in range(4, 40) if (LIGHT_POS[f - k] - c).length > 1.8 * rr][:10]
        samples = []
        for p in far:
            x0, y0, _ = screen(p)
            d = np.hypot(xx - x0, yy - y0)
            samples.append(px[d <= 1.5].mean(0))
        out["trail"] = [round(float(v)) for v in np.mean(samples, 0)] if samples else None
    else:
        for (bid, _angle), (root, angle) in zip(RING_BEADS, ring_beads):
            m = root.matrix_world
            centre = m.translation.copy()
            rim_c = m @ Vector((0.0, -0.95 * math.cos(math.radians(40.0)), 0.0))
            hr = radius_px(centre, 0.962)
            rr2 = radius_px(rim_c, 0.95 * math.sin(math.radians(40.0)))
            out[root.name] = {"halo": ring_stats(centre, 0.95 * hr, 1.04 * hr), "rim": ring_stats(rim_c, 0.88 * rr2, 1.1 * rr2)}
            if PART == "ring":
                x0, y0, _ = screen(centre)
                out[root.name].update(glow=round(BEAD_GLOW[bid].default_value, 4),
                                      at=[round(x0 / w, 4), round(1.0 - y0 / h, 4)], halo_r=round(hr / w, 4))
    return out


MEASURE_FRAMES = (120, F_END) if PART == "way" else (0, 20, 40, 60, 80, 120, 160, 200, 239)
MEASURED = [m for m in (measure(f) for f in MEASURE_FRAMES if f in frames) if m]
if MEASURED:
    with open(os.path.join(OUT, f"measure-{PART}-{SIZE}.json"), "w", encoding="utf-8") as fh:
        json.dump(MEASURED, fh, indent=1)
    for m in MEASURED:
        print("LIGHT_DIVE measure", json.dumps(m))

whole = ONLY is None
data_path = os.path.join(MOCKUP, "data", f"{PART}-{SIZE}.json") if whole else os.path.join(OUT, f"{PART}-{SIZE}.json")
os.makedirs(os.path.dirname(data_path), exist_ok=True)
with open(data_path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=1)
print("LIGHT_DIVE data", data_path)

if whole:
    webp_dir = os.path.join(MOCKUP, "frames", f"{PART}-{SIZE}")
    os.makedirs(webp_dir, exist_ok=True)
    js = os.path.join(OUT, "_to_webp.cjs")
    with open(js, "w", encoding="utf-8") as fh:
        fh.write(
            "const sharp = require(require.resolve('sharp', { paths: %s }));\n"
            "const fs = require('fs'), path = require('path');\n"
            "const [src, dst] = process.argv.slice(2);\n"
            "(async () => {\n"
            "  const names = fs.readdirSync(src).filter((n) => /^\\d{4}\\.png$/.test(n)).sort();\n"
            "  for (const n of names) await sharp(path.join(src, n)).webp({ quality: 82 }).toFile(path.join(dst, n.replace('.png', '.webp')));\n"
            "  console.log('webp', names.length, dst);\n"
            "})().catch((e) => { console.error(e); process.exit(1); });\n" % json.dumps(LD["node_paths"]))
    node = shutil.which("node") or r"C:\Program Files\nodejs\node.exe"
    subprocess.run([node, js, OUT, webp_dir], check=True)
    print("LIGHT_DIVE frames", webp_dir)
