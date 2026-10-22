# The shape helpers the beads' object scripts share (tools/blender/bead_funcial.py, bead_jontai.py, bead_cookies.py):
# three's frame and Blender's, a mesh builder whose every face carries its own corner normals, surfaces of revolution,
# boxes, tubes, a material, and standing a part on a leaning floor. Imported by name (export_beads.py puts this folder on
# sys.path before it runs the object scripts); it builds nothing itself.
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
    """A new object (an empty when `mesh` is None) under the bead's slot, placed by its translation and turn in the bead
    frame."""
    ob = kit.link(bpy.data.objects.new(name, mesh), kit.slot)
    place(ob, Vector(translation) - slot_origin(kit), rotation)
    return ob


def under(kit, parent, name, mesh, translation=(0.0, 0.0, 0.0), rotation=None):
    """A new object (an empty when `mesh` is None) under `parent`, placed in the parent's own frame."""
    ob = kit.link(bpy.data.objects.new(name, mesh), parent)
    place(ob, translation, rotation)
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

    def add(self, other, rotation=None, offset=(0.0, 0.0, 0.0)):
        """Another shape's faces, turned (a three-frame Quaternion or 3x3 Matrix) about its origin and then moved."""
        m = Matrix.Identity(3) if rotation is None else rotation.to_matrix() if isinstance(rotation, Quaternion) else rotation
        base = len(self.verts)
        self.verts.extend(m @ v + Vector(offset) for v in other.verts)
        self.faces.extend(([base + i for i in idx], [m @ n for n in normals], uvs, mat) for idx, normals, uvs, mat in other.faces)

    def uv_all(self, uv):
        """Every face's UV at every corner the one point `uv` (Blender's u, v): the part samples one texel of its map."""
        self.faces = [(idx, normals, [tuple(uv)] * len(idx), mat) for idx, normals, _, mat in self.faces]

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


# The turn that lays a lathe's +y axis along +x (Rz(-90 degrees): y -> x), for parts that turn about a level axis.
ALONG_X = turn((0, 0, 1), -90.0)


def rect_lathe(s, w, h, bands, mat=0, at=(0.0, 0.0, 0.0)):
    """A lathe round a w x h rectangle instead of a circle (x across, y up, about +z through `at`), mitred at its
    corners: each band is ((d0, z0, n0), (d1, z1, n1)), d inward from the rectangle's edge, z along +z, n the normal in
    (out, z). Each of the four sides is its own strip of faces, so a side's normals are its own."""
    ax, ay, az = at
    outward = [(0, -1), (1, 0), (0, 1), (-1, 0)]                 # below, right, above, left
    for (d0, z0, n0), (d1, z1, n1) in bands:
        def corners(d):
            x, y = w / 2 - d, h / 2 - d
            return [(-x, -y), (x, -y), (x, y), (-x, y)]            # the edge k runs from corner k to k + 1
        c0, c1 = corners(d0), corners(d1)
        for k in range(4):
            m = (k + 1) % 4
            o = outward[k]
            na = (o[0] * n0[0], o[1] * n0[0], n0[1])
            nb = (o[0] * n1[0], o[1] * n1[0], n1[1])
            pts = [(c0[k], z0), (c0[m], z0), (c1[m], z1), (c1[k], z1)]
            idx = [s.vert((ax + p[0], ay + p[1], az + z)) for p, z in pts]
            s.face(idx, [na, na, nb, nb], mat=mat)


def box(s, size, at=(0.0, 0.0, 0.0), bevel=0.0, mat=0):
    """A box of `size` (x, y, z) about `at`. With a bevel, each face is inset by it, and a strip along each edge and a
    triangle at each corner join the faces, carrying the faces' own normals on their sides: a box rounded by its normals,
    flat-faced in its geometry."""
    h = [c / 2 for c in size]
    centre = Vector(at)
    b = bevel

    def vert(p):
        return s.vert(centre + Vector(p))

    def unit(k, sign):
        n = [0.0, 0.0, 0.0]
        n[k] = sign
        return tuple(n)

    for k in range(3):                                              # the six faces, inset by the bevel
        u, v = (k + 1) % 3, (k + 2) % 3
        for sk in (-1, 1):
            corners = []
            for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                p = [0.0, 0.0, 0.0]
                p[k], p[u], p[v] = sk * h[k], su * (h[u] - b), sv * (h[v] - b)
                corners.append(vert(p))
            s.face(corners, unit(k, sk), mat=mat)
    if b <= 0:
        return
    for k in range(3):                                              # the twelve edges, each along axis k
        u, v = (k + 1) % 3, (k + 2) % 3
        for su in (-1, 1):
            for sv in (-1, 1):
                quad = []
                for sk, on_u in ((-1, True), (1, True), (1, False), (-1, False)):
                    p = [0.0, 0.0, 0.0]
                    p[k] = sk * (h[k] - b)
                    p[u] = su * h[u] if on_u else su * (h[u] - b)
                    p[v] = sv * (h[v] - b) if on_u else sv * h[v]
                    quad.append(vert(p))
                s.face(quad, [unit(u, su), unit(u, su), unit(v, sv), unit(v, sv)], mat=mat)
    for sx in (-1, 1):                                              # the eight corners
        for sy in (-1, 1):
            for sz in (-1, 1):
                sign = (sx, sy, sz)
                pts, normals = [], []
                for k in range(3):
                    p = [sign[j] * (h[j] - b) for j in range(3)]
                    p[k] = sign[k] * h[k]
                    pts.append(vert(p))
                    normals.append(unit(k, sign[k]))
                s.face(pts, normals, mat=mat)


def bezier(p0, p1, p2, p3, n):
    """n + 1 points along the cubic Bezier p0 .. p3, evenly in its parameter."""
    p0, p1, p2, p3 = (Vector(p) for p in (p0, p1, p2, p3))
    out = []
    for i in range(n + 1):
        t = i / n
        a = 1 - t
        out.append(a * a * a * p0 + 3 * a * a * t * p1 + 3 * a * t * t * p2 + t * t * t * p3)
    return out


def tube(s, path, radius, sides, mat=0):
    """A round tube of `radius` along the points of `path`, open at both ends, its rings kept square to the path by
    parallel transport (no twist). UV: u runs 0..1 along it by length, v 0..1 round it."""
    path = [Vector(p) for p in path]
    tangents = []
    for k in range(len(path)):
        a, b = path[max(0, k - 1)], path[min(len(path) - 1, k + 1)]
        tangents.append((b - a).normalized())
    t0 = tangents[0]
    helper = Vector((0, 1, 0)) if abs(t0.y) < 0.9 else Vector((1, 0, 0))
    normal = t0.cross(helper).normalized()
    frames = []
    for k, t in enumerate(tangents):
        if k:
            axis = tangents[k - 1].cross(t)
            if axis.length > 1e-9:
                angle = tangents[k - 1].angle(t)
                normal = Quaternion(axis.normalized(), angle) @ normal
            normal = (normal - t * normal.dot(t)).normalized()
        frames.append((normal, t.cross(normal)))
    lengths = [0.0]
    for a, b in zip(path, path[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    rings = []
    for k, (p, (n, bn)) in enumerate(zip(path, frames)):
        ring = []
        for j in range(sides + 1):
            a = 2 * math.pi * j / sides
            d = n * math.cos(a) + bn * math.sin(a)
            ring.append((s.vert(p + d * radius), d, (lengths[k] / total, j / sides)))
        rings.append(ring)
    for k in range(len(path) - 1):
        for j in range(sides):
            corners = (rings[k][j], rings[k + 1][j], rings[k + 1][j + 1], rings[k][j + 1])
            s.face([c[0] for c in corners], [c[1] for c in corners], [c[2] for c in corners], mat=mat)


# ---------------------------------------------------------------- materials
def material(name, base, metal, rough, emission=None, strength=0.0, specular=None):
    """A single-sided Principled material. `specular` is its Specular IOR Level (0.5 is a dielectric's full 4 %),
    exported as KHR_materials_specular; left alone when None."""
    m = bpy.data.materials.new(name)
    m.use_backface_culling = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emission is not None:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = strength
    if specular is not None:
        b.inputs['Specular IOR Level'].default_value = specular
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
