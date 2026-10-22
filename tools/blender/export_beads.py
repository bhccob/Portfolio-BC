# Exports the BOB project beads as one GLB: three lacquered beads with gold veins, each with a
# gold halo round its outline, a gold-rimmed porthole with curved glass, a hollow cavity behind
# it lit by its own dim warm light, a small black glass display for the project's real screen,
# and an empty slot for the project's object (spec section 2.4, concept frames
# docs/design/bob-compass/b01-b03). Unlike the compass, the file carries its materials: four,
# named, with the veins baked into a 1024 x 1024 image embedded in the file.
#
# Run headless, from the repository root:
#   blender -b --factory-startup --python tools/blender/export_beads.py -- public/models/bob-beads.glb
# and, to also render a check still of each bead (EEVEE, the preview's void lighting, the real
# screenshot on the display) into a folder, after the export:
#   blender -b --factory-startup --python tools/blender/export_beads.py -- public/models/bob-beads.glb --still <folder>
# (`--bead <id>` renders only that bead; `--angle <degrees>` turns it about its up axis, away from
# facing the camera). The still's lights, camera and screen are made after the export and are
# never in the file.
#
# Frames: Blender's (x, y, z) is three's (x, z, -y) after the exporter's +Y-up conversion. The
# porthole faces Blender -Y, which is three's +z; up is Blender +Z, three's +y. The numbers below
# are Blender's.
#
# What the file holds (tests/unit/bob/beads-glb.test.ts pins it), for each bead <id> in
# funcial, jontai-energy, cookies-clicker:
# - `bead_<id>`: the root, an empty at the origin with no transform. Code places it.
# - `bead_<id>_body`: the lacquer shell, a sphere of radius 0.95, open over the porthole (the
#   opening is 0.62 of the radius) onto a hollow cavity: a sphere of radius 0.72 that meets the
#   opening's edge and reaches back past the centre. UV-mapped for the baked veins (the layout is
#   under `shell_mesh`). The three bodies share one mesh; each is turned about the porthole's
#   axis by its own angle, so the veins differ from bead to bead.
# - `bead_<id>_halo`: the gold band round the outline (the circle the bead shows from the front).
# - `bead_<id>_rim`: the porthole's gold rim, a torus over the opening's edge.
# - `bead_<id>_glass`: the porthole's curved glass, a dome whose edge sits inside the rim and
#   whose crown stands a little proud of it.
# - `bead_<id>_display`: the small display beside the object slot, standing in the cavity and
#   turned a little toward the porthole's axis. Two primitives: the screen in `bead:display`, whose
#   UV runs 0..1 over the screen's bounding box with glTF's orientation (u = 0 at the left edge,
#   v = 0 at the TOP edge, so a texture with flipY off shows a screenshot upright), and the casing
#   round it (bezel, sides, back) in `bead:gold`. The screen is the shape of the bead's screenshot
#   (src/assets/beads/): a portrait phone for Funcial (780 x 1688), a landscape display for Jontai
#   Energy (1440 x 900) and a phone-sized landscape screen for Cookies Clicker (1440 x 900).
# - `bead_<id>_object`: an empty on the porthole's axis inside the cavity, its axes the bead's;
#   tools/blender/bead_funcial.py, bead_jontai.py and bead_cookies.py fill it (Tasks 5-7), and an
#   absent script leaves it empty. Each script has `build(kit)`; `kit` is the namespace made in
#   `fill_slots` (the bead's id, root, slot and display, the four materials, `link`, and CAVITY,
#   OPENING and SLOT_RADIUS, the room the object has: within 0.5 of the axis, behind the glass).
# - `bead_<id>_inner`: a dim warm point light in the cavity, in front of the slot.
# - Materials:
#   - `bead:lacquer`: deep purple, roughness 0.35. The baked vein mask (white veins on black) is
#     its emissive map, a grey 1024 x 1024 PNG, times the gold light (1.0, 0.52, 0.16) at 0.5; and
#     its metal map: glTF reads metal from the blue channel of the metallicRoughnessTexture and
#     roughness from its green, so the metal map is a second 1024 x 1024 PNG, the same mask in
#     blue with green full (so the roughness is the factor, everywhere). The veins are metal, the
#     lacquer between them is not. Both are embedded; the two cost about 400 kB.
#   - `bead:gold`: the rims, halo and display casings; the preview's bead gold, glowing at 0.2.
#   - `bead:glass`: clear, transmissive (KHR_materials_transmission), roughness 0.02.
#   - `bead:display`: black glass, glossy, no emission in the file: code puts the screenshot on it
#     as an emissive map and sets its level.
#
# The shapes start from the preview's bead (tools/blender/bob_scroll.py, the project beads): its
# shell radius 0.95, its porthole (0.6 there), its rim torus, its domed screen disk (here the
# glass), its halo band and its lacquer's vein network (noise-warped Voronoi edges), which is
# baked here. That file builds the whole previs scene when it runs, so the numbers are copied.
import bmesh, importlib.util, math, os, struct, sys, tempfile, types, zlib

import bpy
import numpy as np
from mathutils import Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

# ---------------------------------------------------------------- the bead
R = 0.95                              # shell radius
PORTHOLE = 0.62                       # the opening's radius as a share of R
OPEN_R = R * PORTHOLE                 # 0.589
OPEN_Y = -math.sqrt(R * R - OPEN_R * OPEN_R)   # -0.745: the opening's plane
SEG = 64                              # segments round the porthole's axis (shell and cavity)
SHELL_STEP = math.radians(4.0)        # about this much latitude per ring of the shell
CAVITY_R = 0.72
CAVITY_Y = OPEN_Y + math.sqrt(CAVITY_R ** 2 - OPEN_R ** 2)   # -0.331: the cavity's centre, so its wall meets the opening's edge
CAVITY_STEP = math.radians(5.0)

# The shell's UV layout (u, v as Blender holds them; centre (0.5, 0.5)). The front, from the
# opening's edge out to THETA_SEAM degrees from the porthole's axis (past the outline, which is at
# 90), is a ring from UV_IN to UV_OUT, the latitude running out evenly and the longitude round:
# the part the camera sees gets most of the texture, 2 to 4 mm a texel. The back, past the seam,
# is a disc of radius UV_BACK in the middle (the hole the porthole leaves), at about 8 mm a
# texel. The cavity's wall takes the square CAVITY_UV in a corner, which the bake leaves black:
# no veins inside.
THETA_SEAM = math.radians(112.0)
UV_IN, UV_OUT, UV_BACK = 0.17, 0.495, 0.15
CAVITY_UV = (0.012, 0.11)

HALO = dict(radius=0.962, height=0.07, thickness=0.02, seg=128)     # preview: 0.975, 0.07, 0.02, 192
RIM = dict(radius=0.61, tube=0.05, y=-0.725, seg=96, sides=12)      # preview: 0.6, 0.07 (a curve bevel)
GLASS = dict(radius=0.578, y=-0.722, bulge=0.10, seg=64, rings=8)   # preview's screen dome: bulge 0.12
SLOT_Y = -0.30                        # the object slot's centre on the axis
SLOT_RADIUS = 0.5                     # the object stays within this of the axis

# The inner light. `intensity` is the site's own unit (three's PointLight, decay 2), written to the
# file as is (the exporter's COMPAT mode divides by 4 pi, so the lamp holds it times 4 pi); the
# tunnel's light is 1.7 there (GLASS_LOOK.well.light). The still renders it at intensity /
# SITE_PER_WATT watts: the tunnel's light is 90 W in the preview and 1.7 on the site.
INNER = dict(location=(0.0, -0.45, 0.30), colour=(1.0, 0.72, 0.45), intensity=0.06, radius=0.05)
SITE_PER_WATT = 1.7 / 90.0

# colours, linear (the preview's: tools/blender/bob_build.py)
GOLD = (1.0, 0.62, 0.26)
GOLD_EMIT = (1.0, 0.52, 0.16)
VIOLET = (0.55, 0.36, 1.0)
LACQUER = (0.06, 0.017, 0.14)         # the preview's lacquer's darker purple
VEIN_GLOW = 0.5                       # the preview's vein gold emission
GOLD_GLOW = 0.2                       # the preview's bead gold (M_BEAD_GOLD)
LACQUER_ROUGHNESS = 0.35              # the preview's lacquer base is 0.28 under a 0.04 coat; one soft layer here

# the vein bake (the preview's network: noise 2.2 / detail 8 / distortion 2 warping a Voronoi of
# scale 3.2; a vein is where the distance to a cell edge is under 0.018). Here the edge is soft
# (smoothstep from VEIN_EDGE[0] to [1]) so the bake is antialiased, and a slow noise fades some
# veins to VEIN_FADE[0] of their strength, so the net is uneven rather than busy.
TEX = 1024
VEIN_EDGE = (0.008, 0.02)
VEIN_FADE = (0.35, 1.0)
BAKE_SAMPLES = 16
BAKE_MARGIN = 8

# per bead: id, object script, screenshot; the display's screen height (a phone) or width (a
# landscape screen), the other side following from the screenshot's own width / height; its
# bezel, outer corner radius and depth; its centre (x, y, z) and its turn about Z (degrees, toward
# the axis); and the body's turn about the porthole's axis (degrees).
BEADS = [
    dict(id="funcial", script="bead_funcial.py", shot="src/assets/beads/funcial.webp",
         screen_h=0.64, landscape=False, bezel=0.018, corner=0.048, depth=0.024,
         at=(0.235, -0.30, 0.0), turn=-12.0, roll=0.0),
    dict(id="jontai-energy", script="bead_jontai.py", shot="src/assets/beads/jontai-energy.webp",
         screen_w=0.48, landscape=True, bezel=0.022, corner=0.03, depth=0.03,
         at=(0.20, -0.26, -0.03), turn=-20.0, roll=120.0),
    dict(id="cookies-clicker", script="bead_cookies.py", shot="src/assets/beads/cookies-clicker.webp",
         screen_w=0.40, landscape=True, bezel=0.018, corner=0.045, depth=0.024,
         at=(0.235, -0.30, -0.02), turn=-14.0, roll=240.0),
]
CORNER_STEPS = 6                      # arc segments per rounded corner of a display


# ---------------------------------------------------------------- fresh scene
def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.lights, bpy.data.cameras, bpy.data.materials, bpy.data.images):
        for d in list(coll):
            coll.remove(d)
    return bpy.context.scene


def link(ob, parent=None):
    bpy.context.scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def webp_size(path):
    """A WebP's (width, height), from its first chunk (lossy VP8, lossless VP8L or extended VP8X)."""
    with open(path, 'rb') as f:
        b = f.read(32)
    chunk = b[12:16]
    if chunk == b'VP8 ':
        return struct.unpack_from('<H', b, 26)[0] & 0x3fff, struct.unpack_from('<H', b, 28)[0] & 0x3fff
    if chunk == b'VP8L':
        bits = struct.unpack_from('<I', b, 21)[0]
        return (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1
    if chunk == b'VP8X':
        return int.from_bytes(b[24:27], 'little') + 1, int.from_bytes(b[27:30], 'little') + 1
    raise ValueError(f"{path}: not a WebP")


# ---------------------------------------------------------------- mesh helper
class Builder:
    """A bmesh with one UV layer (optional) whose faces are wound to face a given way."""

    def __init__(self, uv=False):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap") if uv else None

    def vert(self, co):
        return self.bm.verts.new(co)

    def face(self, verts, facing, uvs=None, smooth=True, mat=0):
        """A face on these verts, flipped if needed so its normal has a positive part along `facing`."""
        f = self.bm.faces.new(verts)
        f.normal_update()
        if f.normal.dot(Vector(facing)) < 0:
            f.normal_flip()
        if self.uv is not None:
            by_vert = dict(zip(verts, uvs)) if uvs is not None else {}
            for loop in f.loops:
                loop[self.uv].uv = by_vert.get(loop.vert, (0.0, 0.0))
        f.smooth = smooth
        f.material_index = mat
        return f

    def mesh(self, name, sharp_angle=None):
        if sharp_angle is not None:
            for e in self.bm.edges:
                if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > sharp_angle:
                    e.smooth = False
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        return me


def rings(start, end, step):
    """Latitudes from start to end inclusive, evenly spaced, about `step` apart."""
    n = max(1, round((end - start) / step))
    return [start + (end - start) * i / n for i in range(n + 1)]


# ---------------------------------------------------------------- the body
def shell_point(theta, phi, radius=R, centre_y=0.0):
    """A point on a sphere about (0, centre_y, 0), `theta` from its front pole (-Y), `phi` round from +X toward +Z."""
    s = math.sin(theta)
    return (radius * s * math.cos(phi), centre_y - radius * math.cos(theta), radius * s * math.sin(phi))


def shell_mesh(name):
    """The shell (material slot 0) and the cavity's wall (slot 1), one mesh.

    The shell runs from the opening's edge (theta0, where its radius is OPEN_R) round to the back
    pole; the cavity runs from the same edge, on its own sphere (CAVITY_R about (0, CAVITY_Y, 0)),
    back to its own pole. The two meet at the edge without sharing vertices (a hard edge, under the
    rim). UVs: see THETA_SEAM above.
    """
    b = Builder(uv=True)
    theta0 = math.asin(PORTHOLE)
    front = rings(theta0, THETA_SEAM, SHELL_STEP)
    back = rings(THETA_SEAM, math.pi, SHELL_STEP)[1:]       # the last one is the back pole
    phis = [2 * math.pi * i / SEG for i in range(SEG)]

    def uv_front(theta, phi):
        r = UV_IN + (theta - theta0) / (THETA_SEAM - theta0) * (UV_OUT - UV_IN)
        return (0.5 + r * math.cos(phi), 0.5 + r * math.sin(phi))

    def uv_back(theta, phi):
        r = UV_BACK * (math.pi - theta) / (math.pi - THETA_SEAM)
        return (0.5 + r * math.cos(phi), 0.5 + r * math.sin(phi))

    thetas = front + back
    grid = [[b.vert(shell_point(t, p)) for p in phis] for t in thetas[:-1]]
    pole = b.vert(shell_point(math.pi, 0.0))
    for k in range(len(thetas) - 1):
        t0, t1 = thetas[k], thetas[k + 1]
        uvf = uv_front if t1 <= THETA_SEAM + 1e-9 else uv_back
        for i in range(SEG):
            j = (i + 1) % SEG
            p0, p1 = phis[i], phis[j] if j else 2 * math.pi
            centre = Vector(shell_point((t0 + t1) / 2, (p0 + p1) / 2))
            if k + 1 < len(thetas) - 1:
                vs = (grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i])
                uvs = (uvf(t0, p0), uvf(t0, p1), uvf(t1, p1), uvf(t1, p0))
            else:
                vs = (grid[k][i], grid[k][j], pole)
                uvs = (uvf(t0, p0), uvf(t0, p1), uvf(t1, 0.0))
            b.face(vs, centre, uvs, mat=0)

    # the cavity's wall, facing in, toward the hollow
    c0 = math.asin(OPEN_R / CAVITY_R)
    cav = rings(c0, math.pi, CAVITY_STEP)
    centre_c = Vector((0.0, CAVITY_Y, 0.0))
    lo, span = CAVITY_UV[0], CAVITY_UV[1] - CAVITY_UV[0]

    def uv_cav(k, i):
        return (lo + span * i / SEG, lo + span * k / (len(cav) - 1))

    cgrid = [[b.vert(shell_point(t, p, CAVITY_R, CAVITY_Y)) for p in phis] for t in cav[:-1]]
    cpole = b.vert(shell_point(math.pi, 0.0, CAVITY_R, CAVITY_Y))
    for k in range(len(cav) - 1):
        for i in range(SEG):
            j = (i + 1) % SEG
            mid = Vector(shell_point((cav[k] + cav[k + 1]) / 2, 2 * math.pi * (i + 0.5) / SEG, CAVITY_R, CAVITY_Y))
            inward = centre_c - mid
            if k + 1 < len(cav) - 1:
                vs = (cgrid[k][i], cgrid[k][j], cgrid[k + 1][j], cgrid[k + 1][i])
                uvs = (uv_cav(k, i), uv_cav(k, i + 1), uv_cav(k + 1, i + 1), uv_cav(k + 1, i))
            else:
                vs = (cgrid[k][i], cgrid[k][j], cpole)
                uvs = (uv_cav(k, i), uv_cav(k, i + 1), uv_cav(k + 1, i + 0.5))
            b.face(vs, inward, uvs, mat=1)
    return b.mesh(name)


# ---------------------------------------------------------------- halo, rim, glass
def halo_mesh(name):
    """The preview's halo band: a ring of rectangular section round the porthole's axis, in the outline's plane."""
    b = Builder()
    rad, h, t, seg = HALO["radius"], HALO["height"] / 2, HALO["thickness"] / 2, HALO["seg"]
    section = [(rad + t, -h), (rad + t, h), (rad - t, h), (rad - t, -h)]   # (r, y): outer front, outer back, inner back, inner front
    loops = [[b.vert((r * math.cos(2 * math.pi * i / seg), y, r * math.sin(2 * math.pi * i / seg))) for i in range(seg)] for r, y in section]
    for i in range(seg):
        j = (i + 1) % seg
        phi = 2 * math.pi * (i + 0.5) / seg
        out = Vector((math.cos(phi), 0, math.sin(phi)))
        for a, c, facing, smooth in ((0, 1, out, True), (1, 2, (0, 1, 0), False), (2, 3, -out, True), (3, 0, (0, -1, 0), False)):
            b.face((loops[a][i], loops[a][j], loops[c][j], loops[c][i]), facing, smooth=smooth)
    return b.mesh(name, sharp_angle=math.radians(30))


def rim_mesh(name):
    """A torus round the porthole's axis, over the opening's edge: half sunk in the lacquer, half proud of it."""
    b = Builder()
    rad, tube, y0, seg, sides = RIM["radius"], RIM["tube"], RIM["y"], RIM["seg"], RIM["sides"]
    grid = []
    for i in range(seg):
        phi = 2 * math.pi * i / seg
        grid.append([b.vert(((rad + tube * math.cos(2 * math.pi * k / sides)) * math.cos(phi),
                             y0 + tube * math.sin(2 * math.pi * k / sides),
                             (rad + tube * math.cos(2 * math.pi * k / sides)) * math.sin(phi))) for k in range(sides)])
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(sides):
            m = (k + 1) % sides
            phi = 2 * math.pi * (i + 0.5) / seg
            psi = 2 * math.pi * (k + 0.5) / sides
            facing = (math.cos(psi) * math.cos(phi), math.sin(psi), math.cos(psi) * math.sin(phi))
            b.face((grid[i][k], grid[j][k], grid[j][m], grid[i][m]), facing)
    return b.mesh(name)


def glass_mesh(name):
    """The porthole's curved glass: a spherical cap over the opening, its edge inside the rim, bulging out (-Y) by GLASS['bulge']."""
    b = Builder()
    a, y_edge, bulge, seg, nr = GLASS["radius"], GLASS["y"], GLASS["bulge"], GLASS["seg"], GLASS["rings"]
    rc = (a * a + bulge * bulge) / (2 * bulge)
    yc = y_edge - bulge + rc                       # the cap's sphere centre, behind it
    apex = b.vert((0.0, y_edge - bulge, 0.0))
    grid = []
    for k in range(1, nr + 1):
        rho = a * k / nr
        y = yc - math.sqrt(rc * rc - rho * rho)
        grid.append([b.vert((rho * math.cos(2 * math.pi * i / seg), y, rho * math.sin(2 * math.pi * i / seg))) for i in range(seg)])
    for i in range(seg):
        j = (i + 1) % seg
        b.face((apex, grid[0][i], grid[0][j]), (0, -1, 0))
        for k in range(nr - 1):
            b.face((grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i]), (0, -1, 0))
    return b.mesh(name)


# ---------------------------------------------------------------- the display
def rounded_rect(w, h, r, n=CORNER_STEPS):
    """The outline of a w x h rectangle with corners of radius r, as (x, z) points, counter-clockwise from the top right."""
    pts = []
    for cx, cz, start in ((w / 2 - r, h / 2 - r, 0.0), (-w / 2 + r, h / 2 - r, 90.0), (-w / 2 + r, -h / 2 + r, 180.0), (w / 2 - r, -h / 2 + r, 270.0)):
        for s in range(n + 1):
            a = math.radians(start + 90.0 * s / n)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def screen_size(spec):
    """The screen's (width, height): the screenshot's shape at the bead's size."""
    sw, sh = webp_size(os.path.join(REPO, spec["shot"]))
    aspect = sw / sh
    if spec["landscape"]:
        assert aspect > 1, f"{spec['id']}: a landscape display needs a landscape screenshot"
        return spec["screen_w"], spec["screen_w"] / aspect
    assert aspect < 1, f"{spec['id']}: a phone needs a portrait screenshot"
    return spec["screen_h"] * aspect, spec["screen_h"]


def display_mesh(name, spec):
    """A display facing -Y (three's +z): the screen (slot 1, UV 0..1) in a casing (slot 0) of bezel, sides and back.

    The screen and the bezel lie in the front plane, the screen inside the bezel's inner edge;
    the casing's outer corners have radius spec['corner'] and the screen's the same less the
    bezel, so the two outlines are concentric and are bridged point to point.
    """
    w, h = screen_size(spec)
    bz, rc, d = spec["bezel"], spec["corner"], spec["depth"]
    inner = rounded_rect(w, h, rc - bz)
    outer = rounded_rect(w + 2 * bz, h + 2 * bz, rc)
    yf, yb = -d / 2, d / 2
    b = Builder(uv=True)
    front = (0, -1, 0)
    # the screen: a fan from its centre; u from the left edge, v (Blender's) from the bottom edge
    uv = lambda x, z: ((x + w / 2) / w, (z + h / 2) / h)
    c = b.vert((0.0, yf, 0.0))
    sv = [b.vert((x, yf, z)) for x, z in inner]
    n = len(sv)
    for i in range(n):
        j = (i + 1) % n
        b.face((c, sv[i], sv[j]), front, (uv(0.0, 0.0), uv(*inner[i]), uv(*inner[j])), smooth=False, mat=1)
    # the casing
    iv = [b.vert((x, yf, z)) for x, z in inner]
    of = [b.vert((x, yf, z)) for x, z in outer]
    ob = [b.vert((x, yb, z)) for x, z in outer]
    for i in range(n):
        j = (i + 1) % n
        b.face((iv[i], of[i], of[j], iv[j]), front, smooth=False)                    # bezel
        mx, mz = (outer[i][0] + outer[j][0]) / 2, (outer[i][1] + outer[j][1]) / 2
        b.face((of[i], ob[i], ob[j], of[j]), (mx, 0, mz), smooth=True)               # side
    b.face(list(reversed(ob)), (0, 1, 0), smooth=False)                              # back
    return b.mesh(name, sharp_angle=math.radians(30)), (w, h)


# ---------------------------------------------------------------- materials
def principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    return m, nt, bsdf


def mat_lacquer(images):
    """Deep purple lacquer; the vein mask is its emission (times the gold light) and, from the metal image's blue, its metal.

    The exporter reads the metal image's green times LACQUER_ROUGHNESS as the roughness (a Math
    multiply by a constant is its factor) and the blue as the metal, and the colour Mix set to
    Multiply with one constant side as the emissive factor.
    """
    m, nt, b = principled("bead:lacquer")
    N, L = nt.nodes.new, nt.links.new
    b.inputs['Base Color'].default_value = (*LACQUER, 1)
    tex = N('ShaderNodeTexImage')
    tex.image = images["veins"]
    tex.interpolation = 'Linear'
    mr = N('ShaderNodeTexImage')
    mr.image = images["metal"]
    mr.interpolation = 'Linear'
    sep = N('ShaderNodeSeparateColor')
    L(mr.outputs['Color'], sep.inputs['Color'])
    L(sep.outputs['Blue'], b.inputs['Metallic'])
    rough = N('ShaderNodeMath')
    rough.operation = 'MULTIPLY'
    rough.inputs[1].default_value = LACQUER_ROUGHNESS
    L(sep.outputs['Green'], rough.inputs[0])
    L(rough.outputs[0], b.inputs['Roughness'])
    glow = N('ShaderNodeMix')
    glow.data_type = 'RGBA'
    glow.blend_type = 'MULTIPLY'
    sock = lambda sockets, ident: next(s for s in sockets if s.identifier == ident)
    sock(glow.inputs, 'Factor_Float').default_value = 1.0
    L(tex.outputs['Color'], sock(glow.inputs, 'A_Color'))
    sock(glow.inputs, 'B_Color').default_value = (*GOLD_EMIT, 1)
    L(sock(glow.outputs, 'Result_Color'), b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = VEIN_GLOW
    return m


def mat_gold():
    m, nt, b = principled("bead:gold")
    b.inputs['Base Color'].default_value = (*GOLD, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.25
    b.inputs['Emission Color'].default_value = (*GOLD_EMIT, 1)
    b.inputs['Emission Strength'].default_value = GOLD_GLOW
    return m


def mat_glass():
    m, nt, b = principled("bead:glass")
    b.inputs['Base Color'].default_value = (0.92, 0.88, 1.0, 1)
    b.inputs['Roughness'].default_value = 0.02
    b.inputs['IOR'].default_value = 1.5
    b.inputs['Transmission Weight'].default_value = 1.0
    m.surface_render_method = 'DITHERED'
    m.use_raytrace_refraction = True
    m.thickness_mode = 'SLAB'
    return m


def mat_display():
    m, nt, b = principled("bead:display")
    b.inputs['Base Color'].default_value = (0.004, 0.0032, 0.006, 1)
    b.inputs['Roughness'].default_value = 0.06
    b.inputs['Emission Strength'].default_value = 0.0
    return m


# ---------------------------------------------------------------- the vein bake
def bake_material(name, image, veins):
    """An emission-only material for the bake: the vein mask (or black, for the cavity), with the target image active."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes.new, nt.links.new
    out = N('ShaderNodeOutputMaterial')
    em = N('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.0
    if veins:
        tc = N('ShaderNodeTexCoord')
        nz = N('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = 2.2
        nz.inputs['Detail'].default_value = 8.0
        nz.inputs['Distortion'].default_value = 2.0
        L(tc.outputs['Object'], nz.inputs['Vector'])
        vor = N('ShaderNodeTexVoronoi')
        vor.feature = 'DISTANCE_TO_EDGE'
        vor.inputs['Scale'].default_value = 3.2
        L(nz.outputs['Color'], vor.inputs['Vector'])
        edge = N('ShaderNodeMapRange')
        edge.interpolation_type = 'SMOOTHSTEP'
        edge.inputs['From Min'].default_value = VEIN_EDGE[0]
        edge.inputs['From Max'].default_value = VEIN_EDGE[1]
        edge.inputs['To Min'].default_value = 1.0
        edge.inputs['To Max'].default_value = 0.0
        L(vor.outputs['Distance'], edge.inputs['Value'])
        fz = N('ShaderNodeTexNoise')
        fz.inputs['Scale'].default_value = 1.1
        fz.inputs['Detail'].default_value = 2.0
        L(tc.outputs['Object'], fz.inputs['Vector'])
        fade = N('ShaderNodeMapRange')
        fade.interpolation_type = 'SMOOTHSTEP'
        fade.inputs['From Min'].default_value = 0.38
        fade.inputs['From Max'].default_value = 0.62
        fade.inputs['To Min'].default_value = VEIN_FADE[0]
        fade.inputs['To Max'].default_value = VEIN_FADE[1]
        L(fz.outputs['Fac'], fade.inputs['Value'])
        mask = N('ShaderNodeMath')
        mask.operation = 'MULTIPLY'
        L(edge.outputs['Result'], mask.inputs[0])
        L(fade.outputs['Result'], mask.inputs[1])
        L(mask.outputs[0], em.inputs['Color'])
    else:
        em.inputs['Color'].default_value = (0, 0, 0, 1)
    L(em.outputs[0], out.inputs['Surface'])
    tex = N('ShaderNodeTexImage')
    tex.image = image
    nt.nodes.active = tex
    return m


def write_png(path, pixels, palette=None):
    """An 8-bit PNG of `pixels` (uint8, top row first), each row filtered the way that packs it smallest.

    `pixels` is (h, w) grey, or (h, w) indices into `palette` (256 (r, g, b) entries), or (h, w, 3) RGB.
    """
    h, w = pixels.shape[:2]
    c = 1 if pixels.ndim == 2 else pixels.shape[2]
    x = pixels.reshape(h, w * c).astype(np.int16)
    up = np.vstack([np.zeros((1, w * c), np.int16), x[:-1]])
    left = np.hstack([np.zeros((h, c), np.int16), x[:, :-c]])          # the same channel of the pixel to the left
    upleft = np.hstack([np.zeros((h, c), np.int16), up[:, :-c]])
    p = left + up - upleft
    pa, pb, pc = np.abs(p - left), np.abs(p - up), np.abs(p - upleft)
    paeth = np.where((pa <= pb) & (pa <= pc), left, np.where(pb <= pc, up, upleft))
    filtered = [x, x - left, x - up, x - (left + up) // 2, x - paeth]
    filtered = [(f % 256).astype(np.uint8) for f in filtered]
    cost = np.stack([np.minimum(f, 256 - f.astype(np.int16)).sum(axis=1) for f in filtered])
    best = cost.argmin(axis=0)
    raw = b''.join(bytes([int(best[y])]) + filtered[best[y]][y].tobytes() for y in range(h))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

    colour_type = 3 if palette is not None else 0 if c == 1 else 2
    plte = chunk(b'PLTE', bytes(v for rgb in palette for v in rgb)) if palette is not None else b''
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, colour_type, 0, 0, 0)) + plte + \
        chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def bake_veins(body, folder):
    """Bake the vein mask over the body's UVs into a TEX x TEX image and write it out twice, as PNGs loaded back.

    - `veins`: the mask, grey: the lacquer's emissive map.
    - `metal`: the same mask in blue, the metal channel of glTF's metallicRoughnessTexture, with
      the green (roughness) and red (unused) channels full, so the lacquer's roughness is its
      constant factor everywhere (an indexed PNG whose palette maps i to (255, 255, i), so its
      index data is the mask's own bytes): one image for both, read as glTF must (roughness from green,
      metal from blue), would have made the lacquer between the veins mirror-glossy, and every
      point light a hard clipped dot on it.
    The loaded images are files, so the exporter embeds the PNGs' own bytes. Returns the two
    images and the share of the front ring's texels that carry a vein (for the report).
    """
    sc = bpy.context.scene
    target = bpy.data.images.new("bead_veins_bake", TEX, TEX, alpha=False, is_data=True)
    me = body.data
    # a fresh mesh, no slots yet: appending keeps its faces' slots (clearing would reset them all to 0)
    assert not me.materials and any(p.material_index == 1 for p in me.polygons)
    me.materials.append(bake_material("bake:veins", target, True))
    me.materials.append(bake_material("bake:cavity", target, False))
    bpy.context.view_layer.update()
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = BAKE_SAMPLES
    sc.cycles.use_denoising = False
    sc.render.bake.margin = BAKE_MARGIN
    sc.render.bake.margin_type = 'EXTEND'
    sc.render.bake.use_clear = True
    bpy.ops.object.bake(type='EMIT')
    px = np.empty(TEX * TEX * 4, np.float32)
    target.pixels.foreach_get(px)
    grey = np.clip(px.reshape(TEX, TEX, 4)[:, :, 0], 0.0, 1.0)
    rows = np.round(grey * 255).astype(np.uint8)[::-1]        # Blender's rows run up from the bottom; a PNG's down from the top
    paths = dict(veins=os.path.join(folder, "bead-veins.png"), metal=os.path.join(folder, "bead-veins-metal.png"))
    write_png(paths["veins"], rows)
    # indexed: entry i is (255, 255, i), so the index data is the mask itself and packs as small as the grey
    write_png(paths["metal"], rows, palette=[(255, 255, i) for i in range(256)])
    # the share of veined texels within the front ring
    yy, xx = np.mgrid[0:TEX, 0:TEX]
    r = np.hypot((xx + 0.5) / TEX - 0.5, (yy + 0.5) / TEX - 0.5)
    ring = (r > UV_IN) & (r < UV_OUT)
    coverage = float((grey[ring] > 0.5).mean())
    for mat in list(me.materials):
        bpy.data.materials.remove(mat)
    bpy.data.images.remove(target)
    images = {}
    for key, path in paths.items():
        image = bpy.data.images.load(path)
        image.name = os.path.splitext(os.path.basename(path))[0]
        image.colorspace_settings.name = 'Non-Color'
        image.alpha_mode = 'NONE'
        images[key] = image
    return images, coverage


# ---------------------------------------------------------------- the beads
def build():
    """The three beads, their shared meshes and the four materials. Returns ({id: parts}, body object to bake)."""
    shell = shell_mesh("bead_body")
    halo = halo_mesh("bead_halo")
    rim = rim_mesh("bead_rim")
    glass = glass_mesh("bead_glass")
    beads = {}
    for spec in BEADS:
        bid = spec["id"]
        root = link(bpy.data.objects.new(f"bead_{bid}", None))
        root.empty_display_type = 'SPHERE'
        root.empty_display_size = R
        body = link(bpy.data.objects.new(f"bead_{bid}_body", shell), root)
        body.rotation_euler = (0.0, math.radians(spec["roll"]), 0.0)    # about the porthole's axis (Y)
        link(bpy.data.objects.new(f"bead_{bid}_halo", halo), root)
        link(bpy.data.objects.new(f"bead_{bid}_rim", rim), root)
        link(bpy.data.objects.new(f"bead_{bid}_glass", glass), root)
        dmesh, size = display_mesh(f"bead_{bid}_display", spec)
        display = link(bpy.data.objects.new(f"bead_{bid}_display", dmesh), root)
        display.location = spec["at"]
        display.rotation_euler = (0.0, 0.0, math.radians(spec["turn"]))
        slot = link(bpy.data.objects.new(f"bead_{bid}_object", None), root)
        slot.empty_display_type = 'CUBE'
        slot.empty_display_size = 0.1
        slot.location = (0.0, SLOT_Y, 0.0)
        ld = bpy.data.lights.new(f"bead_{bid}_inner", 'POINT')
        ld.color = INNER["colour"]
        ld.energy = INNER["intensity"] * 4 * math.pi          # COMPAT export: energy / (4 pi)
        ld.shadow_soft_size = INNER["radius"]
        # EEVEE would show the lamp itself through the glass's transmission lobe; three's transmission does not
        ld.transmission_factor = 0.0
        inner = link(bpy.data.objects.new(f"bead_{bid}_inner", ld), root)
        inner.location = INNER["location"]
        beads[bid] = dict(spec=spec, root=root, body=body, display=display, slot=slot, inner=inner, screen=size)
    return beads, beads[BEADS[0]["id"]]["body"]


def dress(beads, images):
    """The four materials on the parts. The shared meshes carry theirs; each display has gold (slot 0) and its screen (slot 1)."""
    mats = dict(lacquer=mat_lacquer(images), gold=mat_gold(), glass=mat_glass(), display=mat_display())
    any_bead = next(iter(beads.values()))
    body = any_bead["body"].data
    body.materials.clear()
    body.materials.append(mats["lacquer"])
    for p in body.polygons:
        p.material_index = 0
    for part, mat in (("halo", "gold"), ("rim", "gold"), ("glass", "glass")):
        bpy.data.objects[f"bead_{BEADS[0]['id']}_{part}"].data.materials.append(mats[mat])
    for b in beads.values():
        # fresh meshes: appending keeps the screen's faces on slot 1 (clearing would reset them to 0)
        me = b["display"].data
        me.materials.append(mats["gold"])
        me.materials.append(mats["display"])
        assert any(p.material_index == 1 for p in me.polygons)
    return mats


def fill_slots(beads, mats):
    """Run each bead's object script, if it exists, to fill its slot. Returns the ids that were filled."""
    filled = []
    for bid, b in beads.items():
        path = os.path.join(HERE, b["spec"]["script"])
        if not os.path.isfile(path):
            continue
        spec = importlib.util.spec_from_file_location(os.path.splitext(b["spec"]["script"])[0], path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        kit = types.SimpleNamespace(
            id=bid, root=b["root"], slot=b["slot"], display=b["display"], materials=mats, link=link,
            CAVITY=dict(radius=CAVITY_R, centre_y=CAVITY_Y), OPENING=dict(radius=OPEN_R, y=OPEN_Y),
            SLOT_RADIUS=SLOT_RADIUS, GOLD=GOLD, GOLD_EMIT=GOLD_EMIT)
        module.build(kit)
        filled.append(bid)
    return filled


# ---------------------------------------------------------------- export
def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_yup=True,
        export_apply=False,                 # no modifiers; off, so the beads' shared meshes stay shared
        export_animations=False,
        export_materials='EXPORT',
        export_image_format='AUTO',         # the vein PNG's own bytes
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_vertex_color='NONE',
        export_attributes=False,
        export_extras=False,
        export_cameras=False,
        export_lights=True,
        export_import_convert_lighting_mode='COMPAT',
        export_draco_mesh_compression_enable=False,
    )


# ---------------------------------------------------------------- the check still
def look_at(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat('-Z', 'Y').to_euler()


def render_stills(beads, folder, only=None, angle=0.0):
    """One EEVEE still per bead, framed as the concept frames, in the preview's void light (bob_scroll.py).

    `angle` turns the bead that many degrees about its up axis, away from facing the camera (the
    overview sees the outer beads about 25 to 30 degrees off their porthole's axis).
    """
    os.makedirs(folder, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1344, 752, 100
    sc.eevee.taa_render_samples = 64
    sc.eevee.use_raytracing = True
    # full-resolution, undenoised tracing: at the default half resolution the screen behind the glass came out blurred
    rt = sc.eevee.ray_tracing_options
    rt.resolution_scale = '1'
    rt.use_denoise = False
    rt.screen_trace_quality = 1.0
    for vt, lk in (("AgX", "AgX - Medium High Contrast"), ("AgX", "Medium High Contrast"), ("AgX", "None")):
        try:
            sc.view_settings.view_transform = vt
            sc.view_settings.look = lk
            break
        except TypeError:
            continue
    sc.view_settings.exposure = -0.35
    world = bpy.data.worlds.new("bead_still_world")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.0012, 0.0008, 0.0022, 1)
    sc.world = world
    try:
        comp = bpy.data.node_groups.new("bead_still_comp", 'CompositorNodeTree')
        comp.interface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = comp.nodes.new('CompositorNodeRLayers')
        gl = comp.nodes.new('CompositorNodeGlare')
        for v in ('BLOOM', 'Bloom'):
            try:
                gl.inputs['Type'].default_value = v
                break
            except Exception:
                pass
        gl.inputs['Threshold'].default_value = 0.7
        gl.inputs['Strength'].default_value = 0.55
        go = comp.nodes.new('NodeGroupOutput')
        comp.links.new(rl.outputs['Image'], gl.inputs['Image'])
        comp.links.new(gl.outputs['Image'], go.inputs[0])
        sc.compositing_node_group = comp
        sc.render.use_compositing = True
    except Exception as e:  # the still is a check, not the file
        print("EXPORT_BEADS still: no bloom", e)

    # the preview's void light: a wide violet fill from below and a warm key on the selected bead
    pos, cam_at = Vector((0.8, 2.2, -6.5)), Vector((0.0, -4.0, -5.5))
    fill = bpy.data.lights.new("still_void_fill", 'AREA')
    fill.shape, fill.size, fill.energy, fill.color, fill.specular_factor = 'DISK', 24, 600, VIOLET, 0.4
    fo = link(bpy.data.objects.new("still_void_fill", fill))
    fo.location = (0, 8, -22)
    look_at(fo, (0, 8, -6))
    key = bpy.data.lights.new("still_bead_key", 'AREA')
    key.shape, key.size, key.energy, key.color = 'DISK', 2.0, 260.0, (1.0, 0.75, 0.48)
    ko = link(bpy.data.objects.new("still_bead_key", key))
    ko.location = (-2.4, -1.5, -3.6)
    look_at(ko, pos)
    cam_d = bpy.data.cameras.new("still_camera")
    cam_d.lens = 40
    cam = link(bpy.data.objects.new("still_camera", cam_d))
    sc.camera = cam
    view = (cam_at - pos).normalized()
    cam.location = pos + view * 4.6        # the concept frames' framing: the bead about 0.83 of the height
    look_at(cam, pos)

    for b in beads.values():
        b["inner"].data.energy = INNER["intensity"] / SITE_PER_WATT
    rendered = []
    for bid, b in beads.items():
        if only and bid != only:
            continue
        for other in beads.values():
            hide = other is not b
            for ob in [other["root"]] + list(other["root"].children_recursive):
                ob.hide_render = hide
        root = b["root"]
        root.location = pos
        facing = (-view).to_track_quat('Y', 'Z')                            # local -Y, the porthole, to the camera
        root.rotation_euler = (facing @ Quaternion((0, 0, 1), math.radians(angle))).to_euler()
        # the real screen on the display, for the still only (the file's display has no screen)
        screen = bpy.data.materials["bead:display"].copy()
        screen.name = f"still_screen_{bid}"
        nt = screen.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(os.path.join(REPO, b["spec"]["shot"]), check_existing=True)
        tex.extension = 'CLIP'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = 0.6
        b["display"].material_slots[1].link = 'OBJECT'
        b["display"].material_slots[1].material = screen
        out = os.path.join(folder, f"bead-{bid}{f'-{angle:g}deg' if angle else ''}.png")
        sc.render.filepath = out
        bpy.ops.render.render(write_still=True)
        rendered.append(out)
    return rendered


# ---------------------------------------------------------------- main
def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    options = {k: argv[argv.index(k) + 1] for k in ("--still", "--bead", "--angle") if k in argv}
    still, only, angle = options.get("--still"), options.get("--bead"), float(options.get("--angle", 0))
    positional = [a for k, a in enumerate(argv) if not a.startswith("--") and (k == 0 or argv[k - 1] not in options)]
    path = os.path.abspath(positional[0] if positional else os.path.join(REPO, "public", "models", "bob-beads.glb"))
    reset_scene()
    beads, to_bake = build()
    with tempfile.TemporaryDirectory() as folder:
        images, coverage = bake_veins(to_bake, folder)
        mats = dress(beads, images)
        filled = fill_slots(beads, mats)
        dg = bpy.context.evaluated_depsgraph_get()
        counts = {}
        for ob in bpy.data.objects:
            if ob.type == 'MESH' and ob.data.name not in counts:
                m = ob.evaluated_get(dg).to_mesh()
                counts[ob.data.name] = (len(m.vertices), len(m.polygons))
                ob.evaluated_get(dg).to_mesh_clear()
        export(path)
        print("EXPORT_BEADS", path, os.path.getsize(path), "bytes")
        print("EXPORT_BEADS vein pngs", {k: os.path.getsize(bpy.path.abspath(im.filepath)) for k, im in images.items()},
              "bytes, veined share of the front ring", round(coverage, 4))
        print("EXPORT_BEADS meshes (verts, faces):", counts)
        print("EXPORT_BEADS screens (w, h):", {bid: tuple(round(v, 4) for v in b["screen"]) for bid, b in beads.items()})
        print("EXPORT_BEADS objects filled:", filled or "none")
        if still:
            for out in render_stills(beads, os.path.abspath(still), only, angle):
                print("EXPORT_BEADS still", out)


main()
