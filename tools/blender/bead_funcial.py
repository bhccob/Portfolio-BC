# Funcial's object, sealed in its bead (spec section 2.4; concept frame docs/design/bob-compass/b01-bead-funcial.webp):
# a mirror aluminium hard-drive platter, the floor of the hollow, with one glowing track and four test pins standing
# on it; an upright lacquered abacus on the platter's left, whose five beads slide up gold rods; and the phone, the
# bead's own display (Ruling 14), standing on the platter's right. b01's arrangement and materials, not its pixels:
# the porthole here is smaller than the frame's, so every part is sized to the room the bead gives it.
#
# What each part stands for, as docs/projects-discovery.md (01 FUNCIAL: its architecture layers and its object)
# gives it; nothing here carries a meaning the discovery does not give:
# - the four pins are the test points, the app's four layers, left to right along the track: TP1 LOG, TP2 GAME
#   LAYER, TP3 MONEY RULES, TP4 VAULT;
# - the abacus beads are "the same layers shown a second way": beads 1-4 are TP1-TP4, bead 5 is RESULT, the
#   buy-meter verdict ("on focus, the fifth bead lights"), left to right;
# - the phone plays the app's real screen (the display; export_beads.py makes it, this file only sizes and stands it);
# - the platter and its track carry the pins: the platter turns, and a light pulse runs along the track from TP1 to
#   TP4 (the discovery's motion signature). The hub's six screws are the platter's own clamp, only so the turn shows.
#
# Called by tools/blender/export_beads.py (fill_slots) as build(kit); `kit` is documented there. Everything is
# authored in three's frame (x right, y up, z out of the porthole), in metres, and turned into Blender's frame
# (x, -z, y) as each object is made, so the numbers below are the GLB's. The "bead frame" is the bead's root's. The
# slot, bead_funcial_object, stands on the axis at z 0.30 with no turn; the parts under it are placed from it.
#
# What the file holds (tests/unit/bob/beads-glb.test.ts pins it) and how code moves it (Task 8, funcialMotion). The
# floor leans TILT (10 degrees) toward the porthole about x: the frames see the platter from above, and the shots look
# along the porthole's axis, where a level floor would show as a sliver.
# - funcial_platter (under the slot): the disc, 0.70 across and 0.012 thick, its rounded rim a bevel of normals, with
#   the spindle clamp in its middle (a 0.10 hub with a centre recess and six gold screws). Mirror aluminium; the
#   screws bead:gold. Its node's origin is the centre of its top face, the floor, at bead frame (0, -0.335, 0.30);
#   its rotation is the lean, Rx(10 deg). PIVOT: that origin. AXIS: its node's local +y, which is (0, 0.985, 0.174)
#   in the bead frame. Code turns it about that axis, by one rotation: platter.quaternion = rest * Ry(angle) (with
#   three's default XYZ order, `platter.rotation.y = angle` does the same: x keeps the lean). The disc lies on itself
#   at any angle; only the screws show the turn.
# - funcial_track (under the slot): the glowing track, a low half-round ribbon 0.012 wide on the floor, along an arc
#   of radius 0.24 about the platter's axis, across the floor's front: from TP1 (150 degrees round from +x toward
#   +z, the front left) to TP4 (70 degrees, the front, right of the hub). bead:track. Its node is the platter's own
#   frame (the same translation and rotation) and it does not turn: the platter turns under it, as a disc turns
#   under its read head. UV: u runs 0..1 along it, 0 at TP1's centre and 1 at TP4's, evenly by angle; v runs 0..1
#   across it. Code runs the pulse along u.
# - funcial_pin_1 .. funcial_pin_4 (under the slot): the test pins, gold, one shared shape 0.086 tall (a flange, a
#   body, a collar, a plunger and a point), standing square on the floor astride the track at u = 0, 1/3, 2/3 and 1.
#   Each node's origin is its foot on the floor; its rotation is the platter's lean. They do not move.
# - funcial_abacus (under the slot): the frame, 0.26 wide, 0.426 tall and 0.036 deep, in the bead's lacquer, its
#   UVs on the veined front of the vein map so it carries the bead's gold leaf, with five gold rods; its base rail is
#   deep (0.07), so the resting beads stand clear above the pins in front of it. It stands on the floor's back left,
#   turned 15 degrees toward the axis. Its node's origin is the middle of its foot; its rotation stands it upright on
#   the leaning floor (Rx(lean) Ry(turn) Rx(-lean): its foot lies along the floor, its back edge a hair under it, and
#   it leans 2.6 degrees to the left).
#   - funcial_bead_1 .. funcial_bead_5 (under the abacus): the beads, one shared shape (0.038 across, 0.030 tall),
#     in bead:abacus, resting on the base rail, one on each rod, left (1) to right (5). Each node has a translation
#     (x, 0.085, 0) in the abacus's frame and no turn. PIVOT: the bead's centre. AXIS: funcial_abacus's local +y.
#     Code slides bead k up its rod by one translation: bead.position.y = 0.085 + slide * ABACUS["travel"] (0.30),
#     slide 0..1, where it meets the top rail.
# - bead_funcial_display (the phone; a child of the bead's root, as export_beads.py made it): its mesh scaled to
#   0.76 tall (0.40 of the bead's diameter, from 0.356), square to the porthole as b01's, and stood upright on the
#   floor's back right. Not moved by code.
# - bead_funcial_inner (the bead's light, export_beads.py's): moved INNER_X (0.15) to the left, over the abacus, so
#   the phone's glossy front no longer mirrors it (see INNER_X).
# - Materials, three of its own beside bead:gold (screws, pins, rods) and bead:lacquer (the abacus's frame):
#   - bead:aluminium: mirror aluminium for the platter, near-neutral silver (art direction: #c9c3d6), metal 1,
#     roughness 0.1;
#   - bead:abacus: the abacus beads' glossy purple lacquer, metal 0, roughness 0.2;
#   - bead:track: dark, glowing in the gold light (the beads' GOLD_EMIT) at TRACK_GLOW, dim at rest; code's pulse
#     brightens it.
#   All single-sided. No texture of their own: the frame borrows the bead's vein map.
#
# Every face carries its own corner normals (`Shape`), so a rounded edge is a bevel of normals over one band of
# faces, not more polygons. The export stays deterministic: no randomness anywhere.
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

# ---------------------------------------------------------------- the object
TILT = 10.0                       # degrees: the floor's axis leans from up toward the porthole (about x)
PLATTER = dict(at=(0.0, -0.335, 0.30), radius=0.35, thickness=0.012, bevel=0.003, seg=64)
HUB = dict(radius=0.05, height=0.014, bevel=0.003, recess_radius=0.012, recess_depth=0.004, seg=32)
SCREWS = dict(count=6, at=0.032, radius=0.0055, height=0.004, seg=8)
# The track's arc about the platter's axis, `start` (TP1) to `end` (TP4) in degrees round from +x toward +z (the
# porthole): across the floor's front, so the four pins spread left to right as the porthole sees them, below the
# abacus's resting beads and the phone's screen.
TRACK = dict(radius=0.24, width=0.012, height=0.0035, lift=0.0008, start=150.0, end=70.0, seg=40, sides=4)
TRACK_GLOW = 0.6                  # the track's emission, times GOLD_EMIT (the veins glow at 0.5)
PINS = 4
# A test pin's profile, foot to point: (radius, height, normal (r, y)) at each ring; consecutive rings make a band.
PIN = dict(seg=12, bands=[
    ((0.016, 0.0, (1, 0)), (0.016, 0.006, (1, 0.3))),             # flange, its top edge a bevel of normals
    ((0.016, 0.006, (0.3, 1)), (0.011, 0.007, (0, 1))),           # flange top
    ((0.011, 0.007, (1, 0)), (0.011, 0.050, (1, 0))),             # body
    ((0.011, 0.050, (0, -1)), (0.0145, 0.050, (0, -1))),          # collar, underside
    ((0.0145, 0.050, (1, -0.3)), (0.0145, 0.057, (1, 0.3))),      # collar, side
    ((0.0145, 0.057, (0.3, 1)), (0.0058, 0.059, (0.1, 1))),       # collar, top
    ((0.0058, 0.059, (1, 0)), (0.0058, 0.077, (1, 0))),           # plunger
    ((0.0058, 0.077, (0.84, 0.54)), (0.0, 0.086, (0.84, 0.54))),  # point
])
# The abacus: its foot's middle on the floor (x, z in the platter's frame) and its turn toward the axis (degrees
# about its up); its frame (stiles at the sides; a deep base rail, as b01's has, so the resting beads stand clear
# above the pins in front of it; a top rail); five rods; the beads' half-width and half-height; and the slide, from
# resting on the base rail to meeting the top one, which sets the frame's height. `uv` is where the frame's box
# projection lands on the vein map (its centre, and UV units per metre): inside the map's veined front ring
# (export_beads.py's UV_IN..UV_OUT, 0.17..0.495 from the middle), the veins twice as fine as on the shell.
ABACUS = dict(foot=(-0.165, -0.12), turn=15.0, width=0.26, depth=0.036, stile=0.022, base=0.07, rail=0.026,
              rods=5, rod=0.0032, bead=(0.019, 0.015), travel=0.30, bead_seg=16, bead_rings=8, uv=((0.80, 0.50), 0.6))
ABACUS["height"] = ABACUS["base"] + ABACUS["travel"] + 2 * ABACUS["bead"][1] + ABACUS["rail"]     # 0.426
# The phone: its foot's middle (x, z in the platter's frame), its turn toward the axis (degrees; square to the
# porthole, as b01's) and its height (the display's whole height, bezel included: 0.40 of the bead's 1.9).
PHONE = dict(foot=(0.17, -0.07), turn=0.0, height=0.76)
# The bead's inner light (export_beads.py's INNER) stands on the axis above the slot, where the phone's glossy front
# mirrored it as a hot spot on its top-left edge: any face toward the porthole mirrors it near x = -0.025. Moved this
# far left, over the abacus, its mirror image falls in the empty hollow above the abacus and it lights the abacus.
INNER_X = -0.15

# colours, linear
ALUMINIUM = (0.584, 0.546, 0.672)     # the art direction's platter silver #c9c3d6
ABACUS_LACQUER = (0.14, 0.045, 0.28)  # purple lacquer, lighter than the shell's so the beads read on the frame
TRACK_BASE = (0.02, 0.012, 0.004)


# ---------------------------------------------------------------- three's frame and Blender's
TO_BLENDER = Matrix.Rotation(math.radians(90.0), 3, 'X')         # three (x, y, z) -> Blender (x, -z, y)


def to_blender(v):
    return TO_BLENDER @ Vector(v)


def to_three(v):
    return TO_BLENDER.transposed() @ Vector(v)


def turn(axis, degrees):
    """A turn in three's frame."""
    return Quaternion(Vector(axis), math.radians(degrees))


def place(ob, translation, rotation=None):
    """Set an object's translation (three's frame, from its parent) and its turn (a three-frame Quaternion)."""
    ob.location = to_blender(translation)
    ob.rotation_mode = 'QUATERNION'
    q = rotation if rotation is not None else Quaternion()
    ob.rotation_quaternion = (TO_BLENDER @ q.to_matrix() @ TO_BLENDER.transposed()).to_quaternion()


# ---------------------------------------------------------------- a mesh with its own normals
class Shape:
    """A mesh authored in three's frame, every face with a normal at each corner and an optional UV at each.

    A face is wound to face its normals (the materials are single-sided). Pieces share no vertices unless a face
    asks for them, so each band of faces carries its own normals: a rounded edge is a bevel of normals.
    """

    def __init__(self):
        self.verts, self.faces = [], []

    def vert(self, p):
        self.verts.append(Vector(p))
        return len(self.verts) - 1

    def face(self, idx, normals, uvs=None, mat=0):
        if not isinstance(normals[0], (tuple, list, Vector)):
            normals = [normals] * len(idx)
        normals = [Vector(n).normalized() for n in normals]
        pts = [self.verts[i] for i in idx]
        newell = Vector((0.0, 0.0, 0.0))
        for a, b in zip(pts, pts[1:] + pts[:1]):
            newell += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
        if newell.dot(sum(normals, Vector())) < 0:
            idx, normals = idx[::-1], normals[::-1]
            uvs = uvs[::-1] if uvs is not None else None
        self.faces.append((list(idx), normals, uvs, mat))

    def mesh(self, name, materials):
        me = bpy.data.meshes.new(name)
        me.from_pydata([to_blender(v) for v in self.verts], [], [f[0] for f in self.faces])
        assert len(me.polygons) == len(self.faces), f"{name}: a face was dropped"
        for poly, f in zip(me.polygons, self.faces):
            poly.material_index = f[3]
        if any(f[2] is not None for f in self.faces):
            layer = me.uv_layers.new(name="UVMap")
            for poly, f in zip(me.polygons, self.faces):
                for c, loop in enumerate(poly.loop_indices):
                    layer.data[loop].uv = f[2][c] if f[2] is not None else (0.0, 0.0)
        me.shade_smooth()
        me.normals_split_custom_set([to_blender(n) for f in self.faces for n in f[1]])
        for m in materials:
            me.materials.append(m)
        me.update()
        return me


def lathe(s, bands, seg, mat=0, at=(0.0, 0.0, 0.0)):
    """A surface of revolution about the +y axis through `at`: each band is ((r0, y0, n0), (r1, y1, n1)), n the
    normal in (r, y). A ring of radius 0 is a pole (the band is a fan of triangles), its normal taken mid-face."""
    ax, ay, az = at
    phis = [2 * math.pi * i / seg for i in range(seg)]

    def ring(r, y):
        if r == 0:
            return [s.vert((ax, ay + y, az))] * seg
        return [s.vert((ax + r * math.cos(p), ay + y, az + r * math.sin(p))) for p in phis]

    def normal(n, p):
        return (n[0] * math.cos(p), n[1], n[0] * math.sin(p))

    for (r0, y0, n0), (r1, y1, n1) in bands:
        a, b = ring(r0, y0), ring(r1, y1)
        for i in range(seg):
            j = (i + 1) % seg
            pi, pj = phis[i], phis[j] if j else 2 * math.pi
            mid = (pi + pj) / 2
            if r0 == 0:
                s.face([a[0], b[j], b[i]], [normal(n0, mid), normal(n1, pj), normal(n1, pi)], mat=mat)
            elif r1 == 0:
                s.face([a[i], a[j], b[0]], [normal(n0, pi), normal(n0, pj), normal(n1, mid)], mat=mat)
            else:
                s.face([a[i], a[j], b[j], b[i]], [normal(n0, pi), normal(n0, pj), normal(n1, pj), normal(n1, pi)], mat=mat)


def ellipse_bands(rx, ry, rings):
    """A lathe profile for a spheroid of half-width rx and half-height ry about its centre, pole to pole."""
    pts = []
    for k in range(rings + 1):
        t = -math.pi / 2 + math.pi * k / rings
        r = 0.0 if k in (0, rings) else rx * math.cos(t)
        pts.append((r, ry * math.sin(t), (math.cos(t) / rx, math.sin(t) / ry)))
    return list(zip(pts, pts[1:]))


# ---------------------------------------------------------------- materials
def material(name, base, metal, rough, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_backface_culling = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emission is not None:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


# ---------------------------------------------------------------- the parts
def platter_mesh(mats):
    """The disc (its top, the floor, at y = 0; its rim rounded by normals), the hub on it, and the hub's screws."""
    s = Shape()
    r, t, bv = PLATTER["radius"], PLATTER["thickness"], PLATTER["bevel"]
    hr, hh, hb = HUB["radius"], HUB["height"], HUB["bevel"]
    rr, rd = HUB["recess_radius"], HUB["recess_depth"]
    up, down, out = (0, 1), (0, -1), (1, 0)
    lathe(s, [
        ((hr, 0.0, up), (r - bv, 0.0, up)),                       # the floor, round the hub
        ((r - bv, 0.0, up), (r, -bv, (1, 0.6))),                  # the rim's top edge
        ((r, -bv, (1, 0.6)), (r, -t + bv, (1, -0.6))),            # the rim
        ((r, -t + bv, (1, -0.6)), (r - bv, -t, down)),            # its bottom edge
        ((r - bv, -t, down), (0.0, -t, down)),                    # the underside
        # the hub: the spindle clamp, with a recess in its middle
        ((hr, 0.0, out), (hr, hh - hb, (1, 0.3))),
        ((hr, hh - hb, (1, 0.3)), (hr - hb, hh, (0.3, 1))),
        ((hr - hb, hh, up), (rr, hh, up)),
        ((rr, hh, (-1, 0)), (rr, hh - rd, (-1, 0))),
        ((rr, hh - rd, up), (0.0, hh - rd, up)),
    ], PLATTER["seg"], mat=0)
    sr, sh = SCREWS["radius"], SCREWS["height"]
    for k in range(SCREWS["count"]):
        a = 2 * math.pi * (k + 0.5) / SCREWS["count"]
        lathe(s, [
            ((sr, hh, out), (sr, hh + sh * 0.5, (1, 0.4))),
            ((sr, hh + sh * 0.5, (0.6, 0.8)), (0.0, hh + sh, up)),
        ], SCREWS["seg"], mat=1, at=(SCREWS["at"] * math.cos(a), 0.0, SCREWS["at"] * math.sin(a)))
    return s.mesh("funcial_platter", [mats["aluminium"], mats["gold"]])


def track_points():
    """Where TP1..TP4 stand: (x, 0, z) in the platter's frame, evenly along the track, TP1 at its start."""
    a0, a1, r = TRACK["start"], TRACK["end"], TRACK["radius"]
    out = []
    for k in range(PINS):
        a = math.radians(a0 + (a1 - a0) * k / (PINS - 1))
        out.append((r * math.cos(a), 0.0, r * math.sin(a)))
    return out


def track_mesh(mats):
    """A low half-round ribbon along the track's arc, a hair above the floor; u along (TP1 0, TP4 1), v across."""
    s = Shape()
    r, w, h, lift = TRACK["radius"], TRACK["width"] / 2, TRACK["height"], TRACK["lift"]
    seg, sides = TRACK["seg"], TRACK["sides"]
    rows = []
    for i in range(seg + 1):
        a = math.radians(TRACK["start"] + (TRACK["end"] - TRACK["start"]) * i / seg)
        d = (math.cos(a), math.sin(a))
        row = []
        for k in range(sides + 1):
            t = -1 + 2 * k / sides                                  # across: the inner edge to the outer
            c = math.sqrt(max(0.0, 1 - t * t))
            nr, ny = t / w, c / h                                   # the half-ellipse's normal
            row.append((s.vert(((r + t * w) * d[0], lift + h * c, (r + t * w) * d[1])),
                        (nr * d[0], ny, nr * d[1]), (i / seg, k / sides)))
        rows.append(row)
    for i in range(seg):
        for k in range(sides):
            corners = (rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1])
            s.face([c[0] for c in corners], [c[1] for c in corners], [c[2] for c in corners])
    return s.mesh("funcial_track", [mats["track"]])


def pin_mesh(mats):
    s = Shape()
    lathe(s, PIN["bands"], PIN["seg"])
    return s.mesh("funcial_pin", [mats["gold"]])


def abacus_mesh(mats, lacquer):
    """The frame (slot 0, the bead's lacquer, box-projected onto the vein map's veined front) and its rods (slot 1, gold).

    Its foot's middle is the origin, its face toward +z. The frame is one ring of flat faces: the front and the back
    (the rectangle less its window), the outer sides and the window's reveals.
    """
    s = Shape()
    w, h, d, st = ABACUS["width"] / 2, ABACUS["height"], ABACUS["depth"] / 2, ABACUS["stile"]
    base, rl = ABACUS["base"], ABACUS["rail"]
    (u0, v0), k = ABACUS["uv"]

    def uv(p, n):
        a, b = (p[0], p[1]) if abs(n[2]) > 0.5 else (p[2], p[1]) if abs(n[0]) > 0.5 else (p[0], p[2])
        return (u0 + k * a, v0 + k * b)

    def quad(pts, n):
        s.face([s.vert(p) for p in pts], n, [uv(p, n) for p in pts], mat=0)

    outer = [(-w, 0.0), (w, 0.0), (w, h), (-w, h)]
    inner = [(-w + st, base), (w - st, base), (w - st, h - rl), (-w + st, h - rl)]
    sides_out = [(0, -1, 0), (1, 0, 0), (0, 1, 0), (-1, 0, 0)]      # below, right, above, left of the edge i -> i+1
    for i in range(4):
        j = (i + 1) % 4
        for z, n in ((d, (0, 0, 1)), (-d, (0, 0, -1))):
            quad([(*outer[i], z), (*outer[j], z), (*inner[j], z), (*inner[i], z)], n)
        quad([(*outer[i], d), (*outer[j], d), (*outer[j], -d), (*outer[i], -d)], sides_out[i])
        quad([(*inner[i], d), (*inner[j], d), (*inner[j], -d), (*inner[i], -d)], tuple(-c for c in sides_out[i]))
    for x in rod_xs():
        lathe(s, [((ABACUS["rod"], base - 0.004, (1, 0)), (ABACUS["rod"], h - rl + 0.004, (1, 0)))], 8, mat=1, at=(x, 0.0, 0.0))
    return s.mesh("funcial_abacus", [lacquer, mats["gold"]])


def rod_xs():
    """The rods' x in the abacus's frame, left to right, evenly across its window."""
    inside = ABACUS["width"] - 2 * ABACUS["stile"]
    n = ABACUS["rods"]
    return [-inside / 2 + inside * (k + 0.5) / n for k in range(n)]


def bead_mesh(mats):
    s = Shape()
    rx, ry = ABACUS["bead"]
    lathe(s, ellipse_bands(rx, ry, ABACUS["bead_rings"]), ABACUS["bead_seg"])
    return s.mesh("funcial_bead", [mats["abacus"]])


# ---------------------------------------------------------------- standing on the floor
def floor_frame():
    """The floor's frame in the bead frame: its centre (the platter's top, at its axis) and its lean."""
    return Vector(PLATTER["at"]), turn((1, 0, 0), TILT)


def stand(foot, turn_deg, depth):
    """Where a part stands on the floor: (the bead-frame point under its foot's middle, its turn).

    The turn is about the floor's own up, then tipped back to stand the part upright: Rx(lean) Ry(turn) Rx(-lean).
    Its foot then lies along the floor (each point of it z * sin(lean) above it, by its depth z in the part), and the
    part is let down by half its depth's rise, so its front edge touches the floor and its back is a hair under it.
    """
    centre, lean = floor_frame()
    up = lean @ Vector((0, 1, 0))
    rotation = lean @ turn((0, 1, 0), turn_deg) @ lean.inverted()
    at = centre + lean @ Vector((foot[0], 0.0, foot[1])) - up * (depth / 2) * math.sin(math.radians(TILT))
    return at, rotation


# ---------------------------------------------------------------- build
def build(kit):
    mats = dict(
        aluminium=material("bead:aluminium", ALUMINIUM, 1.0, 0.1),
        abacus=material("bead:abacus", ABACUS_LACQUER, 0.0, 0.2),
        track=material("bead:track", TRACK_BASE, 0.0, 0.6, kit.GOLD_EMIT, TRACK_GLOW),
        gold=kit.materials["gold"],
    )
    slot_at = to_three(kit.slot.location)
    assert kit.slot.rotation_euler.to_quaternion().angle < 1e-9, "the slot has the bead's axes"
    centre, lean = floor_frame()

    def under_slot(name, mesh, translation, rotation):
        ob = kit.link(bpy.data.objects.new(name, mesh), kit.slot)
        place(ob, Vector(translation) - slot_at, rotation)
        return ob

    under_slot("funcial_platter", platter_mesh(mats), centre, lean)
    under_slot("funcial_track", track_mesh(mats), centre, lean)
    pin = pin_mesh(mats)
    for k, p in enumerate(track_points()):
        under_slot(f"funcial_pin_{k + 1}", pin, centre + lean @ Vector(p), lean)

    at, rotation = stand(ABACUS["foot"], ABACUS["turn"], ABACUS["depth"])
    abacus = under_slot("funcial_abacus", abacus_mesh(mats, kit.materials["lacquer"]), at, rotation)
    bead = bead_mesh(mats)
    rest = ABACUS["base"] + ABACUS["bead"][1]
    for k, x in enumerate(rod_xs()):
        ob = kit.link(bpy.data.objects.new(f"funcial_bead_{k + 1}", bead), abacus)
        place(ob, (x, rest, 0.0))

    # The phone: the bead's display, its mesh scaled about its middle to PHONE["height"], stood on the floor.
    display = kit.display
    me = display.data
    zs = [v.co.z for v in me.vertices]                              # Blender z is three's y
    scale = PHONE["height"] / (max(zs) - min(zs))
    me.transform(Matrix.Scale(scale, 4))
    ys = [v.co.y for v in me.vertices]                              # Blender y is three's -z
    at, rotation = stand(PHONE["foot"], PHONE["turn"], max(ys) - min(ys))
    place(display, at + rotation @ Vector((0.0, PHONE["height"] / 2, 0.0)), rotation)
    inner = next(ob for ob in kit.root.children if ob.name == f"bead_{kit.id}_inner")
    inner.location.x = INNER_X                                       # Blender x is three's x
    print("EXPORT_BEADS funcial: phone scaled", round(scale, 4), "to", PHONE["height"], "tall,",
          round(PHONE["height"] / 1.9, 3), "of the bead; abacus", round(ABACUS["height"], 3), "tall, slide", ABACUS["travel"])
