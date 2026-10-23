# Jontai Energy's object, sealed in its bead (spec section 2.4; concept frame docs/design/bob-compass/b02-bead-jontai.webp):
# a solar module of 16 cells on a post at the left, tilted back as a tracker holds it, with its junction box hanging
# under its frame on three leads and one output cable running from the box down to the floor and along it to a connector
# lying in front; and the website on the bead's own display, bead_jontai-energy_display (not a node of its own: code
# finds every bead's screen by that name), standing on the floor at the right. b02's arrangement and materials, not its
# pixels: the porthole here is smaller than the frame's and the screen is the real landscape screenshot, so every part is
# sized to the room the bead gives it.
#
# What each part stands for, as docs/projects-discovery.md (02 JONTAI ENERGY: its Proposal and its test points) gives it;
# nothing here carries a meaning the discovery does not give:
# - the 16 cells, 4 x 4, are the site's 16 pages, one cell per page (TP1, 16 PAGES: the home page and 15 more), in page
#   order left to right, then top to bottom. The discovery ties no page to a given cell, so neither does the file:
#   jontai_cell_k is the k-th in page order;
# - the silver busbars running across every cell are the one shared design system (TP2, DESIGN SYSTEM);
# - the junction box's three leads are the three languages, EN, ES and 中 (TP3, THREE LANGUAGES), left to right;
# - the one output cable ending in a connector is the quote path, "where the energy goes" (TP4, QUOTE PATH);
# - the materials are the discovery's: blue-black monocrystalline cells under anti-reflective glass (here the cells' own
#   dim reflection: no glass sheet of its own), a satin anodised aluminium frame and a white backsheet at its edge. The
#   cells' silver fingers are finer than this scale shows and are not modelled;
# - carrying no meaning, construction only: the frame, the backsheet and the box itself; the hinge (a pin along the tilt
#   axis and two ears up into the frame), the post that holds it and the floor everything stands on (b02 has a floor
#   and a post too). The floor is not a second Funcial platter: it is the bead's own lacquer, and dark.
#
# Called by tools/blender/export_beads.py (fill_slots) as build(kit); `kit` is documented there. Everything is authored
# in three's frame (x right, y up, z out of the porthole), in metres, and turned into Blender's frame (x, -z, y) as each
# object is made (bead_kit.py), so the numbers below are the GLB's. The "bead frame" is the bead's root's. The slot,
# bead_jontai-energy_object, stands on the axis at z 0.30 with no turn; the parts under it are placed from it.
#
# What the file holds (tests/unit/bob/beads-glb.test.ts pins it) and how code moves it (Task 8, jontaiMotion). The group
# is staged across the middle of the opening, as b02 stages it: the room is a circle of 0.5 about the porthole's axis,
# so a floor low in the hollow shrinks everything, and this one is raised to just under the middle. The floor leans LEAN
# (10 degrees) toward the porthole about x, as Funcial's platter does, so the shots, looking along the porthole's axis,
# see its top; the module's mount is built square to it, turned YAW (5 degrees) toward the axis.
# - jontai_floor (under the slot): a disc of radius 0.465, 0.02 thick, its top edge rounded by normals and widest there,
#   its skirt sloping in 0.016 to the underside (so at the sides, this high, the rim stays inside the room's circle); its
#   top the node's y = 0. Its node is at bead frame (0, -0.16, 0.22), its rotation the lean, Rx(10 deg). It wears
#   bead:lacquer with every UV on one point, the middle of the vein map's cavity square (kit.CAVITY_UV): no veins and no
#   metal there, and the hollow's baked occlusion, so it is the hollow's own dark floor. Not moved by code.
# - jontai_post (under the slot): a flange on the floor, a column (radius 0.0095) and at its top a collar round the
#   hinge pin, 0.045 from the floor to the tilt axis. Its foot is at (-0.248, 0) on the floor, bead frame
#   (-0.248, -0.160, 0.220); its rotation Rx(10) Ry(5), square to the floor and turned with the module. Satin. Not moved.
# - jontai_module (under the slot): the frame, 0.401 square and 0.020 deep (rails 0.013 wide, its lip 0.0018 proud of
#   the cells), the backsheet (its face behind the cells, showing 0.005 between them and 0.010 round them, and the
#   module's back), eight busbars (0.0022 wide, two over each column, 0.021 either side of its middle, each running the
#   whole grid, 0.0003 over the cells) and the hinge. Its own frame: x along the tilt axis, y up its face, z out of its
#   face; the frame's lower edge 0.039 up the face from the axis, the grid's middle at (0, 0.2395). Materials
#   bead:satin (frame, hinge), bead:backsheet, bead:silver (busbars). Its node's translation is bead frame
#   (-0.208, -0.115, 0.224) (the post's axis meets the tilt axis 0.040 left of it); its rotation Rx(10) Ry(5) Rx(-52),
#   the quaternion (-0.3580, 0.0374, 0.0225, 0.9327): its face looks (0.054, 0.670, 0.741), pitched back 42 degrees from
#   upright in the bead frame (b02's foreshortening) and turned a little toward the axis. PIVOT: its node's origin, on
#   the tilt axis. AXIS: its node's local +x, which is (0.996, 0.015, -0.086) in the bead frame. Code tilts it about that
#   axis, by one rotation: module.quaternion = rest * Rx(tilt), |tilt| <= 4 degrees (three: module.rotateX(tilt) from
#   the rest quaternion; not module.rotation.x, as the rest turn has y and z parts). A positive tilt brings the top edge
#   forward (the face turns down toward the porthole), a negative one turns the face up. The cells, the box and the
#   leads it carries tilt with it; the cable does not move, and leaves the box on the tilt axis, so no tilt opens a gap.
#   - jontai_cell_1 .. jontai_cell_16 (under the module): one shared mesh, a pseudo-square 0.085 across with its corners
#     cut 0.009 (a monocrystalline wafer's), flat and facing +z, centred on its node (its pivot, for a later turn-over),
#     UV 0..1 over it. Each node has a translation (x, y, 0.0082) in the module's frame and no turn: x = (col - 1.5) *
#     0.090, y = 0.2395 + (1.5 - row) * 0.090, cell k at row (k - 1) // 4 (0 the top) and col (k - 1) % 4 (0 the left),
#     so cell 1 is top left (-0.135, 0.3745) and cell 16 bottom right (0.135, 0.1045) as the porthole sees them.
#     bead:cell, which all sixteen share: code charges them one by one with a material of its own each (a clone at load).
#   - jontai_box (under the module): the junction box, 0.060 x 0.034 x 0.020 (its edges rounded by normals), centred on
#     the tilt axis at (0.065, 0, 0) in the module's frame, no turn: under the frame, a 0.022 gap between its top and the
#     frame's lower edge, beside the post; its cable gland (radius 0.0064, 0.010 long) on its right end, along the axis,
#     ending at box-local (0.040, 0, 0). bead:polymer.
#     - jontai_lead_1 .. jontai_lead_3 (under the box): one shared mesh, a flat ribbon 0.006 wide and 0.0012 thick from
#       0.0015 into the box's top across the gap to 0.0015 into the frame; nodes at box-local (-0.017 | 0 | 0.017, 0.017,
#       0), no turn: EN, ES, 中, left to right. bead:silver (the busbars' own, so their glow can run to the box).
# - jontai_cable (under the slot): a tube of radius 0.0045 (8 sides, 46 segments) along its centre line: out of the
#   gland along the tilt axis, down 0.045 to the floor, along it, and up into the connector's back. Its node is the
#   floor's own frame (the same translation and rotation). UV: u runs 0..1 along it by length, 0 at the gland and 1 in
#   the connector; v runs 0..1 round it. bead:polymer. Not moved by code (a glow along it can run on u).
#   - jontai_connector (under the cable): the connector, lying on the floor: along its node's local +y from its back
#     (where the cable enters, 0.004 in) to its open end (0.0448), its coupling nut (radius 0.0085) resting on the floor,
#     a silver contact inside its open end. Its node is at (0.03, 0.0085, 0.24) in the floor's frame, its rotation
#     Ry(24.2) Rx(90), so its axis lies on the floor heading (0.41, 0, 0.91), toward the porthole. bead:polymer, the
#     contact bead:silver. Not moved.
# - bead_jontai-energy_display (the website; a child of the bead's root, as export_beads.py made it): its mesh scaled
#   x0.8206 about its middle to 0.430 wide and 0.2823 tall (the screen 0.3939 x 0.2462; 0.226 of the bead's 1.9 wide),
#   stood upright on the floor's back right (its foot at (0.2446, -0.04) on the floor, turned 8 degrees toward the
#   axis), its node translation (0.2480, -0.0141, 0.1805), right of the axis (x 0.031 to 0.465, y -0.160 to 0.132) and of
#   the module: beside it, across the opening's middle. Not moved by code.
# - bead_jontai-energy_inner (the bead's light, export_beads.py's, kit.inner): moved to INNER (0.25, 0.22, 0.50), right,
#   lower and forward, over the display (see INNER).
# - Materials, five of their own beside bead:lacquer (the floor):
#   - bead:cell: blue-black (0.006, 0.010, 0.032), metal 0, roughness 0.35, a dim reflection (Specular IOR Level 0.25:
#     the anti-reflective glass), glowing in the site's own glow green (#00d16a, its --accent-green) at CELL_GLOW, dim
#     at rest; code's charge brightens each cell;
#   - bead:silver: the busbars, the leads and the connector's contact, neutral silver, metal 1, roughness 0.35;
#   - bead:satin: satin anodised aluminium for the frame, the hinge and the post, metal 1, roughness 0.55;
#   - bead:backsheet: the white backsheet, a matte pale grey white (0.42) so it never glares, metal 0, roughness 0.8;
#   - bead:polymer: the black box, cable and connector body, metal 0, roughness 0.35.
#   All single-sided. No texture of their own.
#
# The shape helpers are bead_kit.py's (shared with the other beads' objects): every face carries its own corner normals,
# so a rounded edge is a bevel of normals, not more polygons. The export stays deterministic: no randomness anywhere.
import math

from mathutils import Vector

from bead_kit import (ALONG_X, Shape, bezier, box, floor_disc, lathe, material, rect_lathe, stand_display, to_blender,
                      tube, turn, under, under_slot)

# ---------------------------------------------------------------- the object
LEAN = 10.0                     # degrees: the floor's up leans from up toward the porthole (about x), as Funcial's does
FLOOR = dict(at=(0.0, -0.16, 0.22), radius=0.465, thickness=0.02, bevel=0.004, skirt=0.016, seg=48)
# The module's mount, in the floor's frame: the post's foot (x, z on the floor) and its height to the tilt axis; the
# assembly's turn toward the porthole's axis about the floor's up, and the module's face pitched back from upright.
POST = dict(foot=(-0.248, 0.0), height=0.045, radius=0.0095, flange=0.022, flange_h=0.004, seg=16,
            collar=(0.0085, 0.020))
YAW = 5.0
PITCH = 52.0
# The module (its own frame: x along the tilt axis, y up its face, z out of its face; origin on the tilt axis).
CELL = 0.085                    # a cell's side (a pseudo-square: its corners cut by CHAMFER)
CHAMFER = 0.009
GAP = 0.005                     # between cells: the backsheet shows through
MARGIN = 0.010                  # round the cells to the frame: the backsheet's white edge
RAIL = 0.013                    # the frame's face, each side
DEPTH = 0.020                   # the frame's depth (the module's thickness)
LIP = 0.0018                    # the frame's lip stands this far proud of the cells
FRAME_BEVEL = 0.002
BUSBAR = dict(width=0.0022, offset=0.021, lift=0.0003)   # two per column, offset either side of its middle
STEP = CELL + GAP
GRID = 4 * CELL + 3 * GAP
OUTER = GRID + 2 * (MARGIN + RAIL)
CELL_Z = DEPTH / 2 - LIP
SHEET_Z = CELL_Z - 0.0004
# The junction box: its size (x, y, z), centred on the tilt axis at x along it; the gap under the frame its leads cross;
# its cable gland on its right end (radius, length).
BOX = dict(size=(0.060, 0.034, 0.020), bevel=0.003, x=0.065, gap=0.022, gland=(0.0064, 0.010))
FRAME_Y = BOX["size"][1] / 2 + BOX["gap"]          # the frame's lower edge, up the module's face from the tilt axis
LEAD = dict(width=0.006, thickness=0.0012, spacing=0.017, sink=0.0015)
POST_X = -0.040                 # where the post holds the module, along its tilt axis from the module's middle
TUBE = dict(radius=0.0045, x0=-0.070, seg=12)      # the hinge pin, along the tilt axis from x0 into the box
EAR = dict(at=0.016, size=(0.006, 0.010))          # the two hinge ears either side of the post's collar
# The cable and its connector, in the floor's frame.
CABLE = dict(radius=0.0045, sides=8)
CONNECTOR = dict(at=(0.03, 0.24), heading=(0.45, 1.0), radius=0.0085, seg=12)
# The display: its foot's middle (x, z on the floor), its turn toward the axis (degrees) and its whole width.
DISPLAY = dict(foot=(0.2446, -0.04), turn=-8.0, width=0.43)
# The bead's inner light (export_beads.py's INNER, on the axis above the slot) mirrored in the module's face as a hot
# spot on its lower edge and the leads: any face pitched up toward the porthole mirrors it there. Moved here, right,
# lower and forward, over the display, its mirror image falls in the empty hollow right of the box, and the module,
# farther from it, is lit softly.
INNER = (0.25, 0.22, 0.50)

# colours, linear


def srgb(hex_rgb):
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 if c / 255 > 0.04045 else c / 255 / 12.92
                 for c in bytes.fromhex(hex_rgb))


GLOW = srgb("00d16a")            # the Jontai site's --accent-green, its glow (docs/projects-discovery.md, its palette)
CELL_GLOW = 0.012                # the cells' resting charge, times GLOW: code's charge brightens each
CELL_BLUE = (0.006, 0.010, 0.032)
SILVER = (0.80, 0.80, 0.82)
SATIN = (0.42, 0.42, 0.44)
WHITE = (0.42, 0.42, 0.41)
POLYMER = (0.020, 0.020, 0.024)


# ---------------------------------------------------------------- the module
def module_mesh(mats):
    """The frame (satin), the backsheet (white: its face behind the cells and the module's back), the busbars (silver)
    and the hinge (satin: the pin along the tilt axis and the two ears up into the frame). Origin on the tilt axis."""
    s = Shape()
    yc = FRAME_Y + OUTER / 2
    d2, bv = DEPTH / 2, FRAME_BEVEL
    rect_lathe(s, OUTER, OUTER, [
        ((0.0, -d2, (1, -0.5)), (0.0, d2 - bv, (1, 0.5))),         # the outer wall, rounded by its normals
        ((0.0, d2 - bv, (1, 0.5)), (bv, d2, (0.4, 1))),            # the lip's outer edge
        ((bv, d2, (0, 1)), (RAIL, d2, (0, 1))),                    # the lip
        ((RAIL, d2, (-1, 0.4)), (RAIL, SHEET_Z, (-1, 0))),         # its inner wall, down to the backsheet
    ], mat=0, at=(0.0, yc, 0.0))
    inner, outer = OUTER / 2 - RAIL, OUTER / 2
    s.face([s.vert((x, yc + y, SHEET_Z)) for x, y in ((-inner, -inner), (inner, -inner), (inner, inner), (-inner, inner))],
           (0, 0, 1), mat=1)
    s.face([s.vert((x, yc + y, -d2)) for x, y in ((-outer, -outer), (outer, -outer), (outer, outer), (-outer, outer))],
           (0, 0, -1), mat=1)
    w, z = BUSBAR["width"] / 2, CELL_Z + BUSBAR["lift"]
    y0, y1 = yc - GRID / 2, yc + GRID / 2
    for col in range(4):
        for side in (-1, 1):
            x = (col - 1.5) * STEP + side * BUSBAR["offset"]
            s.face([s.vert(p) for p in ((x - w, y0, z), (x + w, y0, z), (x + w, y1, z), (x - w, y1, z))], (0, 0, 1), mat=2)
    # the hinge: the pin, a cylinder along the tilt axis from TUBE["x0"] into the box, capped at its free end
    pin = Shape()
    r, x1 = TUBE["radius"], BOX["x"] - BOX["size"][0] / 2 + 0.002
    lathe(pin, [((0.0, TUBE["x0"], (0, -1)), (r, TUBE["x0"], (0, -1))), ((r, TUBE["x0"], (1, 0)), (r, x1, (1, 0)))],
          TUBE["seg"], mat=0)
    s.add(pin, ALONG_X)
    ew, ed = EAR["size"]
    for side in (-1, 1):
        box(s, (ew, FRAME_Y + 0.007, ed), at=(POST_X + side * EAR["at"], (FRAME_Y - 0.001) / 2, 0.0), mat=0)
    return s.mesh("jontai_module", [mats["satin"], mats["backsheet"], mats["silver"]])


def cell_centres():
    """Each cell's middle in the module's frame, in page order: left to right along a row, the rows top to bottom."""
    yc = FRAME_Y + OUTER / 2
    return [((col - 1.5) * STEP, yc + (1.5 - row) * STEP, CELL_Z) for row in range(4) for col in range(4)]


def cell_mesh(mats):
    """A cell: a pseudo-square (a monocrystalline wafer's cut corners), flat, facing +z, centred; UV 0..1 over it."""
    s = Shape()
    h, c = CELL / 2, CHAMFER
    outline = [(h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c), (-h + c, -h), (h - c, -h)]
    uv = lambda x, y: ((x + h) / CELL, (y + h) / CELL)
    centre = s.vert((0.0, 0.0, 0.0))
    ring = [s.vert((x, y, 0.0)) for x, y in outline]
    for k in range(len(outline)):
        m = (k + 1) % len(outline)
        s.face([centre, ring[k], ring[m]], (0, 0, 1), [uv(0, 0), uv(*outline[k]), uv(*outline[m])])
    return s.mesh("jontai_cell", [mats["cell"]])


def box_mesh(mats):
    """The junction box, centred on its node (on the tilt axis), with its cable gland on its right end, along x."""
    s = Shape()
    box(s, BOX["size"], bevel=BOX["bevel"])
    gr, gl = BOX["gland"]
    rc = CABLE["radius"]
    gland = Shape()
    lathe(gland, [
        ((gr, -0.001, (1, 0)), (gr, gl - 0.003, (1, 0.4))),
        ((gr, gl - 0.003, (0.4, 1)), (gr - 0.0012, gl, (0.2, 1))),
        ((gr - 0.0012, gl, (0, 1)), (rc, gl, (0, 1))),
    ], 12)
    s.add(gland, ALONG_X, (BOX["size"][0] / 2, 0.0, 0.0))
    return s.mesh("jontai_box", [mats["polymer"]])


def lead_xs():
    """The leads' x on the box, left to right: EN, ES, 中."""
    return [(k - 1) * LEAD["spacing"] for k in range(3)]


def lead_mesh(mats):
    """A lead: a flat tinned ribbon from the box's top (its foot, the origin, sunk a little in) up into the frame."""
    s = Shape()
    sink, gap = LEAD["sink"], BOX["gap"]
    box(s, (LEAD["width"], gap + 2 * sink, LEAD["thickness"]), at=(0.0, gap / 2, 0.0))
    return s.mesh("jontai_lead", [mats["silver"]])


# ---------------------------------------------------------------- the mount, the floor
def post_mesh(mats):
    """The post: a flange on the floor, a column, and at its top the collar round the module's hinge pin, along x."""
    s = Shape()
    r, f, fh, h = POST["radius"], POST["flange"], POST["flange_h"], POST["height"]
    cr, cl = POST["collar"]
    lathe(s, [
        ((f, 0.0, (1, 0)), (f, fh - 0.001, (1, 0.5))),
        ((f, fh - 0.001, (0.5, 1)), (f - 0.002, fh, (0, 1))),
        ((f - 0.002, fh, (0, 1)), (r, fh, (0, 1))),
        ((r, fh, (1, 0)), (r, h - cr + 0.0015, (1, 0))),
    ], POST["seg"], mat=0)
    collar = Shape()
    tr = TUBE["radius"]
    lathe(collar, [
        ((tr, -cl / 2, (0, -1)), (cr - 0.0012, -cl / 2, (0, -1))),
        ((cr - 0.0012, -cl / 2, (0.4, -1)), (cr, -cl / 2 + 0.0012, (1, -0.4))),
        ((cr, -cl / 2 + 0.0012, (1, -0.4)), (cr, cl / 2 - 0.0012, (1, 0.4))),
        ((cr, cl / 2 - 0.0012, (1, 0.4)), (cr - 0.0012, cl / 2, (0.4, 1))),
        ((cr - 0.0012, cl / 2, (0, 1)), (tr, cl / 2, (0, 1))),
    ], 16, mat=0)
    s.add(collar, ALONG_X, (0.0, h, 0.0))
    return s.mesh("jontai_post", [mats["satin"]])


def floor_mesh(mats, uv):
    """The floor: bead_kit.py's lacquer disc (its top at y = 0, its skirt sloping in), every UV on `uv`."""
    return floor_disc("jontai_floor", FLOOR["radius"], FLOOR["thickness"], FLOOR["bevel"], FLOOR["skirt"], FLOOR["seg"],
                      uv, mats["lacquer"])


# ---------------------------------------------------------------- the cable, the connector
def connector_mesh(mats):
    """The connector, along its own +y from its back (y = 0, where the cable enters) to its open end, the silver contact
    inside it. Its widest, the coupling nut, is CONNECTOR["radius"]."""
    s = Shape()
    nr = CONNECTOR["radius"]
    lathe(s, [
        ((0.0052, 0.0, (1, -0.3)), (0.0062, 0.012, (1, -0.1))),       # the strain relief, tapering into the nut
        ((0.0062, 0.012, (0, -1)), (nr, 0.012, (0, -1))),
        ((nr, 0.012, (1, -0.4)), (nr, 0.026, (1, 0.4))),               # the coupling nut
        ((nr, 0.026, (0, 1)), (0.0076, 0.026, (0, 1))),
        ((0.0076, 0.026, (1, 0)), (0.0076, 0.044, (1, 0.3))),          # the body
        ((0.0076, 0.044, (0.3, 1)), (0.0058, 0.0448, (0, 1))),         # its open end's lip
        ((0.0058, 0.0448, (-1, 0)), (0.0058, 0.040, (-1, 0))),         # the socket
        ((0.0058, 0.040, (0, 1)), (0.0, 0.040, (0, 1))),
    ], CONNECTOR["seg"], mat=0)
    lathe(s, [
        ((0.0016, 0.040, (1, 0)), (0.0016, 0.0432, (1, 0.3))),         # the contact
        ((0.0016, 0.0432, (0.5, 1)), (0.0, 0.0442, (0, 1))),
    ], 8, mat=1)
    return s.mesh("jontai_connector", [mats["polymer"], mats["silver"]])


def cable_path(start, along):
    """The cable's centre line in the floor's frame: out of the gland along the tilt axis, down to the floor, along it,
    and up a little into the connector's back, on its axis."""
    rc, hc = CABLE["radius"], CONNECTOR["radius"]
    hx, hz = CONNECTOR["heading"]
    heading = Vector((hx, 0.0, hz)).normalized()
    c = Vector((CONNECTOR["at"][0], hc, CONNECTOR["at"][1]))
    end = c + heading * 0.004                                          # into the strain relief
    rest = Vector((c.x, rc, c.z)) - heading * 0.03                     # where it last lies on the floor
    land = Vector((start.x + 0.045, rc, start.z + 0.07))               # where it first meets the floor
    lay = Vector((0.3, 0.0, 1.0)).normalized()
    drop = bezier(start, start + along * 0.04, land - lay * 0.06, land, 16)
    floor = bezier(land, land + lay * 0.08, rest - heading * 0.06, rest, 24)
    rise = bezier(rest, rest + heading * 0.012, end - heading * 0.012, end, 6)
    return drop + floor[1:] + rise[1:], c, heading


# ---------------------------------------------------------------- build
def build(kit):
    mats = dict(
        cell=material("bead:cell", CELL_BLUE, 0.0, 0.35, GLOW, CELL_GLOW, specular=0.25),
        silver=material("bead:silver", SILVER, 1.0, 0.35),
        satin=material("bead:satin", SATIN, 1.0, 0.55),
        backsheet=material("bead:backsheet", WHITE, 0.0, 0.8),
        polymer=material("bead:polymer", POLYMER, 0.0, 0.35),
        lacquer=kit.materials["lacquer"],
    )
    centre, lean = Vector(FLOOR["at"]), turn((1, 0, 0), LEAN)
    yaw = turn((0, 1, 0), YAW)
    to_bead = lambda p: centre + lean @ Vector(p)

    # the floor: the lacquer's one texel in the middle of the cavity's square (no veins; the hollow's occlusion)
    u0, u1 = kit.CAVITY_UV
    under_slot(kit, "jontai_floor", floor_mesh(mats, ((u0 + u1) / 2, (u0 + u1) / 2)), centre, lean)

    # the post, square to the floor, turned with the module
    foot = Vector((POST["foot"][0], 0.0, POST["foot"][1]))
    under_slot(kit, "jontai_post", post_mesh(mats), to_bead(foot), lean @ yaw)

    # the module: its origin on the tilt axis, POST_X along it from the post; its turn the assembly's, pitched back
    axis_at = foot + Vector((0.0, POST["height"], 0.0)) + yaw @ Vector((-POST_X, 0.0, 0.0))
    module = under_slot(kit, "jontai_module", module_mesh(mats), to_bead(axis_at), lean @ yaw @ turn((1, 0, 0), -PITCH))
    cell = cell_mesh(mats)
    for k, at in enumerate(cell_centres()):
        under(kit, module, f"jontai_cell_{k + 1}", cell, at)
    box_ob = under(kit, module, "jontai_box", box_mesh(mats), (BOX["x"], 0.0, 0.0))
    lead = lead_mesh(mats)
    for k, x in enumerate(lead_xs()):
        under(kit, box_ob, f"jontai_lead_{k + 1}", lead, (x, BOX["size"][1] / 2, 0.0))

    # the cable, in the floor's frame, from the gland's end (on the tilt axis) to the connector
    gland_end = axis_at + yaw @ Vector((BOX["x"] + BOX["size"][0] / 2 + BOX["gland"][1], 0.0, 0.0))
    path, c, heading = cable_path(gland_end, yaw @ Vector((1.0, 0.0, 0.0)))
    s = Shape()
    tube(s, path, CABLE["radius"], CABLE["sides"])
    cable = under_slot(kit, "jontai_cable", s.mesh("jontai_cable", [mats["polymer"]]), centre, lean)
    toward = math.degrees(math.atan2(heading.x, heading.z))
    under(kit, cable, "jontai_connector", connector_mesh(mats), c, turn((0, 1, 0), toward) @ turn((1, 0, 0), 90.0))

    # the display: the bead's own, sized and stood on the floor right of the axis
    scale, (w, h) = stand_display(kit.display, FLOOR["at"], LEAN, DISPLAY["foot"], DISPLAY["turn"], width=DISPLAY["width"])
    kit.inner.location = to_blender(INNER)
    print("EXPORT_BEADS jontai-energy: display scaled", round(scale, 4), "to", round(w, 4), "x", round(h, 4),
          f"({round(w / 1.9, 3)} of the bead wide); module", round(OUTER, 4), "square, cells", CELL, "step", STEP)
