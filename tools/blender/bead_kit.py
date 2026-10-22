# The shape helpers the beads' object scripts share (tools/blender/bead_funcial.py, bead_jontai.py, bead_cookies.py):
# three's frame and Blender's, a mesh builder whose every face carries its own corner normals, surfaces of revolution,
# a material, and standing a part on a leaning floor. Imported by name (export_beads.py puts this folder on sys.path
# before it runs the object scripts); it builds nothing itself.
#
# Frames: everything is authored in three's frame (x right, y up, z out of the porthole), in metres, and turned into
# Blender's (x, -z, y) as each object is made, so a script's numbers are the GLB's. Nothing here is random: the export
# stays deterministic.
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

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


def slot_origin(kit):
    """Where the bead's object slot stands in the bead frame (it has the bead's axes, so a slot child's turn is its own)."""
    assert kit.slot.rotation_euler.to_quaternion().angle < 1e-9, "the slot has the bead's axes"
    return to_three(kit.slot.location)


def under_slot(kit, name, mesh, translation, rotation=None):
    """A new object under the bead's slot, placed by its translation and turn in the bead frame."""
    ob = kit.link(bpy.data.objects.new(name, mesh), kit.slot)
    place(ob, Vector(translation) - slot_origin(kit), rotation)
    return ob


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


def lathe(s, bands, seg, mat=0, at=(0.0, 0.0, 0.0), arc=None):
    """A surface of revolution about the +y axis through `at`: each band is ((r0, y0, n0), (r1, y1, n1)), n the
    normal in (r, y). A ring of radius 0 is a pole (the band is a fan of triangles), its normal taken mid-face.
    `arc` (degrees from, to, round from +x toward +z) sweeps only that part of the turn, in `seg` steps."""
    ax, ay, az = at
    if arc is None:
        phis = [2 * math.pi * i / seg for i in range(seg)]
    else:
        phis = [math.radians(arc[0] + (arc[1] - arc[0]) * i / seg) for i in range(seg + 1)]

    def ring(r, y):
        if r == 0:
            return [s.vert((ax, ay + y, az))] * seg
        return [s.vert((ax + r * math.cos(p), ay + y, az + r * math.sin(p))) for p in phis]

    def normal(n, p):
        return (n[0] * math.cos(p), n[1], n[0] * math.sin(p))

    for (r0, y0, n0), (r1, y1, n1) in bands:
        a, b = ring(r0, y0), ring(r1, y1)
        for i in range(seg):
            j = (i + 1) % len(phis)
            pi, pj = phis[i], phis[j] if j else 2 * math.pi
            mid = (pi + pj) / 2
            if r0 == 0:
                s.face([a[0], b[j], b[i]], [normal(n0, mid), normal(n1, pj), normal(n1, pi)], mat=mat)
            elif r1 == 0:
                s.face([a[i], a[j], b[0]], [normal(n0, pi), normal(n0, pj), normal(n1, mid)], mat=mat)
            else:
                s.face([a[i], a[j], b[j], b[i]], [normal(n0, pi), normal(n0, pj), normal(n1, pj), normal(n1, pi)], mat=mat)


def ellipse_bands(rx, ry, latitudes):
    """A lathe profile for a spheroid of half-width rx and half-height ry about its centre, through these latitudes
    (degrees, rising); +-90 are its poles."""
    pts = []
    for deg in latitudes:
        t = math.radians(deg)
        r = 0.0 if abs(deg) == 90.0 else rx * math.cos(t)
        pts.append((r, ry * math.sin(t), (math.cos(t) / rx, math.sin(t) / ry)))
    return list(zip(pts, pts[1:]))


# ---------------------------------------------------------------- materials
def material(name, base, metal, rough, emission=None, strength=0.0):
    """A single-sided Principled material."""
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


# ---------------------------------------------------------------- standing on a leaning floor
def stand(centre, lean_deg, foot, turn_deg, depth):
    """Where a part stands on a floor: (the bead-frame point under its foot's middle, its turn).

    The floor's top is a plane through `centre` (bead frame) whose up leans `lean_deg` from up toward the porthole
    (about x); `foot` is (x, z) on it. The turn is about the floor's own up, then tipped back to stand the part upright:
    Rx(lean) Ry(turn) Rx(-lean). Its foot then lies along the floor (each point of it z * sin(lean) above it, by its
    depth z in the part), and the part is let down by half its depth's rise, so its front edge touches the floor and its
    back is a hair under it.
    """
    lean = turn((1, 0, 0), lean_deg)
    up = lean @ Vector((0, 1, 0))
    rotation = lean @ turn((0, 1, 0), turn_deg) @ lean.inverted()
    at = Vector(centre) + lean @ Vector((foot[0], 0.0, foot[1])) - up * (depth / 2) * math.sin(math.radians(lean_deg))
    return at, rotation


def stand_display(display, centre, lean_deg, foot, turn_deg, height=None, width=None):
    """Size the bead's display (export_beads.py's `bead_<id>_display`, centred on its origin, facing three's +z) and
    stand it upright on the floor: its mesh scaled about its middle to `height` tall or `width` wide (bezel and gold
    edge included), its foot's middle at `foot` turned `turn_deg` (as `stand`). The node keeps no scale. Returns the
    scale and the display's (width, height)."""
    me = display.data
    if height is not None:
        zs = [v.co.z for v in me.vertices]                          # Blender z is three's y
        scale = height / (max(zs) - min(zs))
    else:
        xs = [v.co.x for v in me.vertices]
        scale = width / (max(xs) - min(xs))
    me.transform(Matrix.Scale(scale, 4))
    xs, zs = [v.co.x for v in me.vertices], [v.co.z for v in me.vertices]
    if height is None:
        height = max(zs) - min(zs)
    ys = [v.co.y for v in me.vertices]                              # Blender y is three's -z
    at, rotation = stand(centre, lean_deg, foot, turn_deg, max(ys) - min(ys))
    place(display, at + rotation @ Vector((0.0, height / 2, 0.0)), rotation)
    return scale, (max(xs) - min(xs), height)
