# Cookies Clicker's object, sealed in its bead (spec section 2.4; concept frame docs/design/bob-compass/b03-bead-cookies.webp):
# an open clockwork movement standing on the floor at the left, its copper wheels with ruby jewels on a dark bridge, and
# the game on the bead's own display, bead_cookies-clicker_display (not a node of its own: code finds every bead's
# screen by that name), standing on the floor at the right. b03's arrangement and materials, not its pixels: the dial on
# a raised block at the top, the train of wheels across the middle along the plate's top edge, the balance and the
# barrel below it and the crown on the right side. The porthole here is smaller than the frame's and the screen is the
# real landscape screenshot, so every part is sized to the room the bead gives it.
#
# What each part stands for, as docs/projects-discovery.md (03 COOKIES CLICKER: its Proposal and its test points) gives
# it; nothing here carries a meaning the discovery does not give:
# - the crown on its side is the click (TP1, CLICK LOOP);
# - the train of eight wheels growing in size is the eight producers (TP2, 8 PRODUCERS: one producer class, eight
#   instances). The discovery ties no producer to a given wheel, so neither does the file: cookies_wheel_k is the k-th by
#   size, the smallest first;
# - the escapement and the balance wheel are the production tick, which beats once a second (TP2's 1,000 ms tick; that
#   it beats twice as fast during a Chef Boost, TP3, is motion, not shape);
# - the mainspring barrel is the save: it holds the stored state (TP4, SAVE);
# - the dial with its sub-dials is the stats (TP5, STATS: the statistics window). It stands for the window as a whole,
#   not counter by counter (the window has 13): the number of sub-dials (two, as b03's) and the time the hands show
#   carry no meaning;
# - the materials are the discovery's: copper and caramel on a dark bridge, with ruby jewels, warm but clearly not the
#   void's gold. The caramel is the game's own, the dial's face;
# - carrying no meaning, construction only: the bridge itself and its block; the ruby jewels (each the bearing on its
#   part's axis); the wheels' crossings and hubs and the arbors into the bridge; the balance's hairspring; and the floor
#   everything stands on (b03 has a floor too). The escapement's pallet fork is finer than this scale shows and is not
#   modelled: the escapement here is its wheel, between wheel 1 and the balance.
#
# Called by tools/blender/export_beads.py (fill_slots) as build(kit); `kit` is documented there. Everything is authored
# in three's frame (x right, y up, z out of the porthole), in metres, and turned into Blender's frame (x, -z, y) as each
# object is made (bead_kit.py), so the numbers below are the GLB's. The "bead frame" is the bead's root's. The slot,
# bead_cookies-clicker_object, stands on the axis at z 0.30 with no turn; the parts under it are placed from it.
#
# What the file holds (tests/unit/bob/beads-glb.test.ts pins it) and how code moves it (Task 8, cookiesMotion). The group
# is staged across the middle of the opening, as b03 stages it: the room is a circle of 0.5 about the porthole's axis, so
# the floor is raised to just under the middle and leans LEAN (10 degrees) toward the porthole about x, as Jontai's does,
# so the shots, looking along the porthole's axis, see its top. The movement stands upright on it, turned 8 degrees
# toward the axis.
# - cookies_floor (under the slot): bead_kit.floor_disc, radius 0.465 and 0.02 thick, its top the node's y = 0; its node
#   at bead frame (0, -0.15, 0.22), its rotation the lean, Rx(10 deg). bead:lacquer, every UV on the middle of the vein
#   map's cavity square (kit.CAVITY_UV): no veins, no metal, the hollow's own dark floor. Not moved by code.
# - cookies_bridge (under the slot): the plate, 0.40 wide, 0.22 tall and 0.028 deep, and above its right half the block
#   the dial sits on (x 0 to 0.18 and y 0.17 to 0.36 in the bridge's frame, its face 0.0015 proud of the plate's), both
#   rounded by normals. Its own frame: x right, y up from its foot, z out of its face; the origin is the middle of its
#   foot, at mid-depth. Its node is at bead frame (-0.235, -0.147, 0.19), its rotation Rx(10) Ry(8) Rx(-10), the
#   quaternion (0, 0.0687, 0.0121, 0.9976): upright, its face looking (0.137, 0.002, 0.991). bead:bridge. Not moved.
#   Every part below hangs on it with no turn of its own, so each one's axes are the bridge's: in the bead frame its local
#   +x is (0.990, 0.024, -0.137) and its local +z (0.137, 0.002, 0.991).
#   - cookies_wheel_1 .. cookies_wheel_8 (under the bridge): the train, one row along the plate's top edge (half above
#     it, as b03's), wheel 1 at the left. Their tips grow evenly from 0.013 to 0.035 (0.013, 0.0161, 0.0193, 0.0224,
#     0.0256, 0.0287, 0.0319, 0.035) with 12, 15, 18, 21, 24, 27, 29 and 32 spur teeth (one about every PITCH round the
#     tip, 0.55 of that deep). Each is a rim on four crossings round a hub with its ruby jewel, 0.0035 thick, its back
#     0.003 off the plate's face and an arbor (radius 0.0015) back into it. Their centres lie on y 0.21 in the bridge's
#     frame, at x -0.187, -0.1564, -0.1194, -0.0762, -0.0267, 0.0291, 0.0911 and 0.1595: each the two tips and CLEARANCE
#     (0.0015) from the last, so neighbours read as meshed but their discs never meet, at any turn of either. Each node's
#     translation is (x, 0.21, 0.014), on the plate's face, with no turn. PIVOT: its node's origin, on the wheel's axis.
#     AXIS: its local +z, (0.137, 0.002, 0.991) in the bead frame. Code turns it in place by one rotation:
#     wheel.rotation.z = angle (the node has no turn of its own). In the bead frame wheel 1's pivot is at
#     (-0.4233, 0.0583, 0.2299) and wheel 8's at (-0.0802, 0.0666, 0.1824).
#   - cookies_escapement (under the bridge): the escape wheel, tip 0.016 with 15 pointed, raked teeth, on four crossings
#     with its hub and jewel; its node at (-0.1817, 0.18, 0.014), no turn, 0.0015 clear of wheel 1 above it. Pivot and
#     axis as a wheel's. cookiesMotion does not move it; one rotation about its z would step it in place.
#   - cookies_balance (under the bridge): the balance wheel, a plain rim (radius 0.056, 0.0065 wide, 0.0045 thick,
#     rounded by normals) on three arms, the hub and its jewel, and the hairspring, a flat spiral of three turns in front
#     of the arms; its node at (-0.137, 0.1161, 0.014), no turn, 0.006 clear of the escapement. Pivot and axis as a
#     wheel's: code swings it to and fro by one rotation, balance.rotation.z = angle, at any angle.
#   - cookies_barrel (under the bridge): the mainspring barrel, its 48 teeth (tip 0.064) round the back of a drum 0.0125
#     deep under a flat cover, with an arbor boss and its jewel; its node at (0.1251, 0.1156, 0.014), no turn, 0.0015
#     clear of wheel 8 above it. Pivot and axis as a wheel's. cookiesMotion does not move it.
#   - cookies_crown (under the bridge): the crown on its side. Its node is at (0.20, 0.1406, 0), on the plate's right side,
#     by the barrel it winds, with no turn. Along its local +x (the bridge's) run the stem (radius 0.0035), from 0.008
#     inside the side, and the fluted crown (radius 0.0115, 12 flutes, 0.014 long), standing 0.007 off the side. Code
#     presses it in along its local -x by up to 0.004 (the discovery's hover, "the crown presses in once"):
#     crown.position.x = 0.2 - press.
#   - cookies_dial (under the bridge): the dial on the block's face. Its node is at (0.09, 0.30, 0.0155), with no turn.
#     It has a caramel face (radius 0.048), a copper bezel out to 0.054, two copper sub-dial rings (radius 0.011) at
#     twelve and six, each with a hand, the hour and minute hands at ten past ten, and a ruby cap on them. Side by side
#     under the hands, the two sub-dials read as a face, so they sit one above the other. Not moved.
# - bead_cookies-clicker_display (the game; a child of the bead's root, as export_beads.py made it): its mesh is scaled
#   x0.8716 about its middle to 0.380 wide and 0.2493 tall, so the screen is 0.3486 x 0.2179, the shape of the
#   1440 x 900 screenshot, and the display is 0.20 of the bead's 1.9 wide. It stands upright on the floor's right, its
#   foot at (0.25, -0.04), turned 8 degrees toward the axis. Its node translation is (0.253, -0.0202, 0.1805): x 0.061 to
#   0.445 and y -0.149 to 0.108, beside the clockwork across the opening's middle. Not moved by code.
# - bead_cookies-clicker_inner (the bead's light, export_beads.py's, kit.inner): moved to INNER (0, 0.24, 0.56), a little
#   lower and forward (see INNER).
# - Materials, four of their own beside bead:lacquer (the floor):
#   - bead:copper: the wheels, the escapement, the balance, the barrel, the crown, and the dial's bezel, sub-dials and
#     hands. A warm, dim copper (0.40, 0.16, 0.08), metal 1, roughness 0.38, clearly not the void's gold: redder (its
#     green is 0.40 of its red, the gold's 0.62) and darker. No glow at rest.
#   - bead:caramel: the dial's face, the game's own caramel #c69255 in hue (linear (0.565, 0.287, 0.091)) at
#     CARAMEL_VALUE (half) of its value, metal 0, roughness 0.55. At full value, under the hollow's warm light, the dial
#     read salmon and was the brightest thing in the clockwork.
#   - bead:ruby: the jewels, a deep red (0.30, 0.004, 0.012), metal 0, roughness 0.22, with a faint red glow (0.03) so they
#     read in the dark hollow.
#   - bead:bridge: the bridge, a warm black (0.016, 0.012, 0.011), metal 0, roughness 0.6, its reflection dimmed
#     (Specular IOR Level 0.25), so its broad face does not read grey.
#   All single-sided. No texture of their own.
#
# The shape helpers are bead_kit.py's (shared with the other beads' objects); the toothed rims, the crossings and the
# hubs are this file's, as only the clockwork has them. Every face carries its own corner normals, so a rounded edge and
# a tooth's rounding are bevels of normals, not more polygons. The export stays deterministic: no randomness anywhere.
import math

from mathutils import Vector

from bead_kit import (ALONG_X, ALONG_Z, Shape, box, ellipse_bands, floor_disc, lathe, material, stand, stand_display,
                      to_blender, turn, under, under_slot)

# ---------------------------------------------------------------- the object
LEAN = 10.0                     # degrees: the floor's up leans from up toward the porthole (about x), as Jontai's does
FLOOR = dict(at=(0.0, -0.15, 0.22), radius=0.465, thickness=0.02, bevel=0.004, skirt=0.016, seg=48)
# The movement: its bridge's foot (x, z on the floor) and its turn toward the porthole's axis about the floor's up.
MOVEMENT = dict(foot=(-0.235, -0.03), turn=8.0)
# The bridge, in its own frame (x right, y up from its foot, z out of its face; origin the middle of its foot, mid-depth):
# a plate, and above its right half the raised block the dial sits on, a little proud of the plate.
PLATE = dict(width=0.40, height=0.22, depth=0.028, bevel=0.004)
BLOCK = dict(x=(0.0, 0.18), y=(0.17, 0.36), proud=0.0015, bevel=0.004)
FACE = PLATE["depth"] / 2                       # the plate's face: every turning part's node stands on it
BLOCK_FACE = FACE + BLOCK["proud"]
LIFT = 0.003                    # a turning part's back stands this far off the plate's face; its arbor reaches back in
ARBOR = dict(radius=0.0015, into=0.006, seg=6)
CLEARANCE = 0.0015              # between two neighbours' tips: close enough to read as meshed, never touching
# The train: eight wheels in a row, their tips growing evenly from the first to the eighth, a tooth every PITCH round
# each tip, their centres on one line from wheel 1's.
TRAIN = dict(first=(-0.187, 0.21), tips=(0.013, 0.035), thickness=0.0035, crossings=4)
PITCH = 0.0068
SPUR = [(0.0, -0.30), (1.0, -0.16), (1.0, 0.16), (0.0, 0.30)]   # a tooth, root to tip to root: (radius share, pitch share)
CLUB = [(0.0, -0.38), (1.0, 0.08), (0.75, 0.16), (0.0, 0.18)]   # an escape wheel's pointed, raked tooth
# The escapement's wheel, beside wheel 1 (its direction from wheel 1's centre, degrees), and the balance beside it.
ESCAPE = dict(tip=0.016, teeth=15, depth=0.0045, thickness=0.0035, crossings=4, toward=-80.0)
BALANCE = dict(radius=0.056, rim=0.0065, thickness=0.0045, arms=3, gap=0.006, toward=-55.0,
               spring=dict(turns=3.0, width=0.0018, seg=108))
# The barrel, below wheel 8 (its direction from wheel 8's centre), its teeth round the back of a drum under a cover.
BARREL = dict(tip=0.064, depth=0.0034, teeth=48, rim=0.004, drum=0.0125, toward=-110.0)
# The crown on the plate's right side: its stem into the side, the fluted crown standing `gap` off it.
CROWN = dict(above=0.025, z=0.0, stem=0.0035, into=0.008, gap=0.007, length=0.014, radius=0.0115, flute=0.0011,
             flutes=12, cap=0.003)
# The dial on the block: its face, the copper bezel round it, two sub-dials at twelve and six (side by side under the
# hands, the pair read as a face), the hands at ten past ten.
DIAL = dict(at=(0.09, 0.30), radius=0.048, lift=0.0005, seg=48,
            subdials=[(0.0, 0.022, 120.0), (0.0, -0.022, 40.0)], subdial=0.011, ring=0.0012)
# The display: its foot's middle (x, z on the floor), its turn toward the axis (degrees) and its whole width.
DISPLAY = dict(foot=(0.25, -0.04), turn=-8.0, width=0.38)
# The bead's inner light (export_beads.py's INNER, on the axis at (0, 0.30, 0.45)) hung just over the dial's block and
# lit the dial far above the rest. Moved a little lower and forward, it lights the whole movement from the front (moved
# right, over the display, it left the left half dark), and its mirror image in the display's glass still falls above
# the screen.
INNER = (0.0, 0.24, 0.56)


# colours, linear
def srgb(hex_rgb):
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 if c / 255 > 0.04045 else c / 255 / 12.92
                 for c in bytes.fromhex(hex_rgb))


CARAMEL = srgb("c69255")         # the game's own caramel, the first stop of its background (Cookies_Clicker.css)
CARAMEL_VALUE = 0.5             # the dial wears its hue at this share of its value, so it sits in the dark hollow
COPPER = (0.40, 0.16, 0.08)
RUBY = (0.30, 0.004, 0.012)
RUBY_GLOW = ((1.0, 0.03, 0.05), 0.03)
BRIDGE = (0.016, 0.012, 0.011)


# ---------------------------------------------------------------- shapes about +z
def lathe_z(s, bands, seg, mat=0, at=(0.0, 0.0)):
    """bead_kit.lathe's surface of revolution, about +z through (x, y) = `at` instead of about +y: each band is
    ((r0, z0, n0), (r1, z1, n1)), n the normal in (r, z)."""
    t = Shape()
    lathe(t, bands, seg, mat=mat)
    s.add(t, ALONG_Z, (at[0], at[1], 0.0))


def dome(s, r, h, z, seg, mat=0, at=(0.0, 0.0)):
    """A low dome of radius r and height h on the plane z, about +z: a jewel, a cap."""
    bands = [((a[0], a[1] + z, a[2]), (b[0], b[1] + z, b[2])) for a, b in ellipse_bands(r, h, [0.0, 35.0, 65.0, 90.0])]
    lathe_z(s, bands, seg, mat=mat, at=at)


def edge(tip, root, teeth, profile):
    """A toothed edge about +z: each tooth's profile (radius share, 0 the root and 1 the tip; share of the pitch round
    from the tooth's middle), counter-clockwise from +x."""
    pts = []
    pitch = 2 * math.pi / teeth
    for i in range(teeth):
        for share, along in profile:
            a = (i + along) * pitch
            r = root + (tip - root) * share
            pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def toothed(s, outline, per, z0, z1, inner, mat=0, lip=0.5, back=False):
    """A toothed rim about +z: its front at z1, one face a tooth from the circle `inner` out to the outline (its points
    counter-clockwise, `per` to a tooth, each tooth's face from the inner circle at its first point's angle to the next
    tooth's), and the outline's wall from z0 to z1, each point's normal the mean of its two sides' (the teeth rounded
    by normals), tipped `lip` toward +z along the front edge. `back` adds the same face at z0, facing -z."""
    n = len(outline)
    teeth = n // per
    starts = [math.atan2(outline[i * per][1], outline[i * per][0]) for i in range(teeth)]
    for z, facing in ((z1, (0, 0, 1)),) + (((z0, (0, 0, -1)),) if back else ()):
        fo = [s.vert((x, y, z)) for x, y in outline]
        fi = [s.vert((inner * math.cos(a), inner * math.sin(a), z)) for a in starts]
        for i in range(teeth):
            j = (i + 1) % teeth
            s.face([fi[i], fi[j], fo[j * per]] + [fo[i * per + m] for m in reversed(range(per))], facing, mat=mat)
    sides = []
    for j in range(n):
        p0, p1, p2 = (Vector(outline[i % n]) for i in (j - 1, j, j + 1))
        e0, e1 = (p1 - p0).normalized(), (p2 - p1).normalized()
        sides.append((Vector((e0.y, -e0.x)) + Vector((e1.y, -e1.x))).normalized())
    wb = [s.vert((x, y, z0)) for x, y in outline]
    wt = [s.vert((x, y, z1)) for x, y in outline]
    for j in range(n):
        k = (j + 1) % n
        s.face([wb[j], wb[k], wt[k], wt[j]],
               [(sides[j].x, sides[j].y, 0.0), (sides[k].x, sides[k].y, 0.0),
                (sides[k].x, sides[k].y, lip), (sides[j].x, sides[j].y, lip)], mat=mat)


def crossings(s, count, r0, r1, width, z0, z1, mat=0, phase=90.0):
    """`count` spokes from r0 (the hub) to r1 (the rim's inner edge), `width` wide, from z0 to z1: their fronts and
    their sides (the open spaces between them show the bridge behind)."""
    for i in range(count):
        a = math.radians(phase + 360.0 * i / count)
        d, q = Vector((math.cos(a), math.sin(a), 0.0)), Vector((-math.sin(a), math.cos(a), 0.0))

        def corner(r, side, z):
            return s.vert(d * r + q * (side * width / 2) + Vector((0.0, 0.0, z)))

        s.face([corner(r0, -1, z1), corner(r1, -1, z1), corner(r1, 1, z1), corner(r0, 1, z1)], (0, 0, 1), mat=mat)
        for side in (-1, 1):
            s.face([corner(r0, side, z0), corner(r1, side, z0), corner(r1, side, z1), corner(r0, side, z1)],
                   tuple(q * side), mat=mat)


def hub(s, r_hub, z0, z1, boss, jewel, seg=12):
    """The hub on the axis, from the back (z0) up `boss` past the front (z1), its edge rounded by normals; a ruby jewel
    (slot 1) domed on it; and the arbor behind, back into the plate."""
    bv = min(0.0006, boss / 2)
    lathe_z(s, [
        ((r_hub, z0, (1, 0)), (r_hub, z1 + boss - bv, (1, 0.3))),
        ((r_hub, z1 + boss - bv, (1, 0.3)), (r_hub - bv, z1 + boss, (0.3, 1))),
        ((r_hub - bv, z1 + boss, (0, 1)), (jewel, z1 + boss, (0, 1))),
    ], seg, mat=0)
    dome(s, jewel, 0.55 * jewel, z1 + boss, 8, mat=1)
    lathe_z(s, [((ARBOR["radius"], -ARBOR["into"], (1, 0)), (ARBOR["radius"], z0, (1, 0)))], ARBOR["seg"], mat=0)


def wheel_shape(tip, teeth, depth, thickness, spokes, profile=SPUR):
    """A wheel on its node, its axis the node's +z: a toothed rim (copper, slot 0) on `spokes` crossings round a hub
    with its ruby jewel (slot 1), its back LIFT off the plate. The rim, the crossings and the hub grow with the tip."""
    s = Shape()
    z0, z1 = LIFT, LIFT + thickness
    root = tip - depth
    r_in = root - (0.0018 + 0.05 * tip)
    r_hub = 0.0025 + 0.1 * tip
    toothed(s, edge(tip, root, teeth, profile), len(profile), z0, z1, r_in)
    lathe_z(s, [((r_in, z1, (-1, 0.4)), (r_in, z0, (-1, 0)))], 20, mat=0)                  # the rim's inner wall
    crossings(s, spokes, r_hub, r_in, 0.0014 + 0.04 * tip, z0, z1)
    hub(s, r_hub, z0, z1, 0.0012, 0.55 * r_hub)
    return s


def train():
    """The eight wheels' (tip, teeth, centre) in the bridge's frame, wheel 1 first: tips growing evenly, each centre
    its tips' and CLEARANCE from the last."""
    (t0, t1), (x, y) = TRAIN["tips"], TRAIN["first"]
    out = []
    for k in range(8):
        tip = t0 + (t1 - t0) * k / 7
        if out:
            x += out[-1][0] + tip + CLEARANCE
        out.append((tip, max(12, round(2 * math.pi * tip / PITCH)), (x, y)))
    return out


def beside(centre, r_a, r_b, gap, toward):
    """The centre of a disc of radius r_b, `gap` clear of the one of r_a at `centre`, in the direction `toward` (degrees)."""
    a = math.radians(toward)
    d = r_a + r_b + gap
    return (centre[0] + d * math.cos(a), centre[1] + d * math.sin(a))


# ---------------------------------------------------------------- the parts
def bridge_mesh(mats):
    """The bridge: the plate, its foot at y = 0, and the dial's raised block, both rounded by normals."""
    s = Shape()
    w, h, d = PLATE["width"], PLATE["height"], PLATE["depth"]
    box(s, (w, h, d), at=(0.0, h / 2, 0.0), bevel=PLATE["bevel"])
    (x0, x1), (y0, y1) = BLOCK["x"], BLOCK["y"]
    box(s, (x1 - x0, y1 - y0, BLOCK_FACE + d / 2), at=((x0 + x1) / 2, (y0 + y1) / 2, (BLOCK_FACE - d / 2) / 2),
        bevel=BLOCK["bevel"])
    return s.mesh("cookies_bridge", [mats["bridge"]])


def wheel_mesh(mats, name, tip, teeth):
    s = wheel_shape(tip, teeth, 0.55 * 2 * math.pi * tip / teeth, TRAIN["thickness"], TRAIN["crossings"])
    return s.mesh(name, [mats["copper"], mats["ruby"]])


def escapement_mesh(mats):
    e = ESCAPE
    s = wheel_shape(e["tip"], e["teeth"], e["depth"], e["thickness"], e["crossings"], CLUB)
    return s.mesh("cookies_escapement", [mats["copper"], mats["ruby"]])


def balance_mesh(mats):
    """The balance: a plain rim rounded by normals on three arms, the hub and its jewel, and the hairspring, a flat
    spiral in front of the arms from the hub out toward the rim."""
    b = BALANCE
    s = Shape()
    ro, ri, z0 = b["radius"], b["radius"] - b["rim"], LIFT
    z1, bv = LIFT + b["thickness"], 0.0012
    lathe_z(s, [
        ((ri, z0, (-1, 0)), (ri, z1, (-1, 0.3))),
        ((ri, z1, (-0.3, 1)), (ro - bv, z1, (0.3, 1))),
        ((ro - bv, z1, (0.4, 1)), (ro, z1 - bv, (1, 0.4))),
        ((ro, z1 - bv, (1, 0.2)), (ro, z0, (1, 0))),
    ], 48, mat=0)
    r_hub = 0.006
    crossings(s, b["arms"], r_hub, ri, 0.0032, z0, z1 - 0.001)
    hub(s, r_hub, z0, z1, 0.0012, 0.0034)
    sp = b["spring"]
    r0, r1, z = r_hub + 0.0025, ri - 0.004, z1 + 0.0006
    rows = []
    for i in range(sp["seg"] + 1):
        t = i / sp["seg"]
        a = 2 * math.pi * sp["turns"] * t
        r = r0 + (r1 - r0) * t
        c, si = math.cos(a), math.sin(a)
        rows.append((s.vert((c * (r - sp["width"] / 2), si * (r - sp["width"] / 2), z)),
                     s.vert((c * (r + sp["width"] / 2), si * (r + sp["width"] / 2), z))))
    for (a0, b0), (a1, b1) in zip(rows, rows[1:]):
        s.face([a0, b0, b1, a1], (0, 0, 1))
    return s.mesh("cookies_balance", [mats["copper"], mats["ruby"]])


def barrel_mesh(mats):
    """The mainspring barrel: its teeth round the back of a drum, the drum under a flat cover rounded by normals, an
    arbor boss and its jewel in the middle."""
    b = BARREL
    s = Shape()
    root = b["tip"] - b["depth"]
    rd = root - 0.0012
    z0, zt, zc, bv = LIFT, LIFT + b["rim"], LIFT + b["drum"], 0.0015
    toothed(s, edge(b["tip"], root, b["teeth"], SPUR), len(SPUR), z0, zt, rd - 0.001)
    lathe_z(s, [
        ((rd, zt, (1, 0)), (rd, zc - bv, (1, 0.3))),
        ((rd, zc - bv, (1, 0.3)), (rd - bv, zc, (0.3, 1))),
        ((rd - bv, zc, (0, 1)), (0.010, zc, (0, 1))),
    ], 48, mat=0)
    hub(s, 0.010, zc - 0.001, zc, 0.0015, 0.0042, seg=16)
    return s.mesh("cookies_barrel", [mats["copper"], mats["ruby"]])


def crown_mesh(mats):
    """The crown on its side, along its node's +x from the plate's side: the stem into the side, and the fluted crown
    standing CROWN["gap"] off it, its end flat with a small domed cap."""
    c = CROWN
    s = Shape()
    stem = Shape()
    lathe(stem, [((c["stem"], -c["into"], (1, 0)), (c["stem"], c["gap"] + 0.001, (1, 0)))], 12)
    s.add(stem, ALONG_X)
    body = Shape()
    x0, x1 = c["gap"], c["gap"] + c["length"]
    toothed(body, edge(c["radius"], c["radius"] - c["flute"], c["flutes"], SPUR), len(SPUR), x0, x1, c["cap"], back=True)
    dome(body, c["cap"], 0.0012, x1, 12)
    s.add(body, turn((0, 1, 0), 90.0))                                  # its +z laid along +x
    return s.mesh("cookies_crown", [mats["copper"]])


def hand(s, length, width, tail, angle, z, mat):
    """A flat tapered hand facing +z, from its tail through the middle out to its tip, `angle` degrees from +x."""
    a = math.radians(angle)
    d, q = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
    pts = [(-tail, -width / 2), (length, -width / 6), (length, width / 6), (-tail, width / 2)]
    s.face([s.vert((d[0] * u + q[0] * v, d[1] * u + q[1] * v, z)) for u, v in pts], (0, 0, 1), mat=mat)


def dial_mesh(mats):
    """The dial on its node (on the block's face): a caramel face (slot 0), its copper bezel (slot 1), two copper
    sub-dial rings, at twelve and six, each with a hand, the hour and minute hands, and a ruby cap (slot 2) on them."""
    d = DIAL
    s = Shape()
    rf, z = d["radius"], d["lift"]
    lathe_z(s, [((0.0, z, (0, 1)), (rf, z, (0, 1)))], d["seg"], mat=0)
    lathe_z(s, [
        ((rf, z, (-1, 0.5)), (rf + 0.0015, z + 0.002, (-0.3, 1))),
        ((rf + 0.0015, z + 0.002, (0, 1)), (rf + 0.0045, z + 0.002, (0, 1))),
        ((rf + 0.0045, z + 0.002, (0.5, 1)), (rf + 0.006, z + 0.0005, (1, 0.5))),
        ((rf + 0.006, z + 0.0005, (1, 0)), (rf + 0.006, 0.0, (1, 0))),
    ], d["seg"], mat=1)
    rs, w = d["subdial"], d["ring"]
    for cx, cy, angle in d["subdials"]:
        lathe_z(s, [((rs - w, z + 0.0003, (0, 1)), (rs, z + 0.0003, (0, 1)))], 24, mat=1, at=(cx, cy))
        sub = Shape()
        hand(sub, 0.8 * rs, 0.0012, 0.0015, angle, z + 0.0005, 1)
        s.add(sub, None, (cx, cy, 0.0))
    hand(s, 0.026, 0.0030, 0.005, 150.0, z + 0.0008, 1)                  # the hour hand, at ten
    hand(s, 0.038, 0.0022, 0.006, 30.0, z + 0.0012, 1)                   # the minute hand, at two
    dome(s, 0.0024, 0.0013, z + 0.0012, 10, mat=2)
    return s.mesh("cookies_dial", [mats["caramel"], mats["copper"], mats["ruby"]])


# ---------------------------------------------------------------- build
def build(kit):
    mats = dict(
        copper=material("bead:copper", COPPER, 1.0, 0.38),
        caramel=material("bead:caramel", tuple(c * CARAMEL_VALUE for c in CARAMEL), 0.0, 0.55),
        ruby=material("bead:ruby", RUBY, 0.0, 0.22, RUBY_GLOW[0], RUBY_GLOW[1]),
        bridge=material("bead:bridge", BRIDGE, 0.0, 0.6, specular=0.25),
        lacquer=kit.materials["lacquer"],
    )
    centre, lean = Vector(FLOOR["at"]), turn((1, 0, 0), LEAN)
    u0, u1 = kit.CAVITY_UV
    f = FLOOR
    under_slot(kit, "cookies_floor", floor_disc("cookies_floor", f["radius"], f["thickness"], f["bevel"], f["skirt"],
                                                f["seg"], ((u0 + u1) / 2, (u0 + u1) / 2), mats["lacquer"]), centre, lean)

    at, rotation = stand(FLOOR["at"], LEAN, MOVEMENT["foot"], MOVEMENT["turn"], PLATE["depth"])
    bridge = under_slot(kit, "cookies_bridge", bridge_mesh(mats), at, rotation)
    wheels = train()
    for k, (tip, teeth, (x, y)) in enumerate(wheels):
        under(kit, bridge, f"cookies_wheel_{k + 1}", wheel_mesh(mats, f"cookies_wheel_{k + 1}", tip, teeth), (x, y, FACE))
    first, last = wheels[0], wheels[-1]
    ex, ey = beside(first[2], first[0], ESCAPE["tip"], CLEARANCE, ESCAPE["toward"])
    under(kit, bridge, "cookies_escapement", escapement_mesh(mats), (ex, ey, FACE))
    bx, by = beside((ex, ey), ESCAPE["tip"], BALANCE["radius"], BALANCE["gap"], BALANCE["toward"])
    under(kit, bridge, "cookies_balance", balance_mesh(mats), (bx, by, FACE))
    rx, ry = beside(last[2], last[0], BARREL["tip"], CLEARANCE, BARREL["toward"])
    under(kit, bridge, "cookies_barrel", barrel_mesh(mats), (rx, ry, FACE))
    under(kit, bridge, "cookies_crown", crown_mesh(mats), (PLATE["width"] / 2, ry + CROWN["above"], CROWN["z"]))
    under(kit, bridge, "cookies_dial", dial_mesh(mats), (DIAL["at"][0], DIAL["at"][1], BLOCK_FACE))

    kit.inner.location = to_blender(INNER)
    scale, (w, h) = stand_display(kit.display, FLOOR["at"], LEAN, DISPLAY["foot"], DISPLAY["turn"], width=DISPLAY["width"])
    print("EXPORT_BEADS cookies-clicker: display scaled", round(scale, 4), "to", round(w, 4), "x", round(h, 4),
          f"({round(w / 1.9, 3)} of the bead wide); train tips", [round(t[0], 4) for t in wheels],
          "teeth", [t[1] for t in wheels], "centres", [tuple(round(c, 4) for c in t[2]) for t in wheels],
          "escapement", (round(ex, 4), round(ey, 4)), "balance", (round(bx, 4), round(by, 4)),
          "barrel", (round(rx, 4), round(ry, 4)))
