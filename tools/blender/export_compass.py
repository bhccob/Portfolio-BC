# Exports the BOB armillary compass as one GLB: four smoked-glass bands with gold
# rims, the needle, the pivot and the axis, plus a `rise` animation on the
# armillary. The site loads the file in three.js and applies every material in
# code, so the GLB carries geometry, UVs and the animation, and no materials.
#
# Run headless, from the repository root:
#   blender -b --factory-startup --python tools/blender/export_compass.py -- public/models/bob-compass.glb
#
# The geometry is the approved preview's (tools/blender/bob_build.py, after its
# detail pass), copied here because that file builds the whole preview scene
# when it is imported. The preview's armillary stands at ARM_Z = 0.55 and its
# needle leans 38 degrees; here the armillary rests at the origin (code adds the
# home height) and the needle stands straight up its local +Z, three's +Y
# (code sets the angle).
#
# Blender's Z is three's Y after the exporter's Y-up conversion, so the rise
# below, written about Z, arrives in the file as a translation in y and a
# rotation about Y.
#
# What the file holds (tests/unit/bob/compass-glb.test.ts pins it):
# - nodes `armillary` (an empty at the origin, no static translation or rotation),
#   `band_1`..`band_4` (children of it), `rim_1`..`rim_4` (children of their
#   bands), `needle`, `pivot` and `axis`;
# - TEXCOORD_0 on the bands: u from 0 to 1 round the band starting at local +X,
#   v from 0 at the bottom edge to 1 at the top edge;
# - one animation, `rise`, 52 frames at 24 fps, on the armillary's translation
#   and rotation.
import bmesh, json, math, os, struct, sys

import bpy

# ---------------------------------------------------------------- budget knobs
# The GLB must stay within COMPASS_GLB_BUDGET (src/engine/bob/glb.ts, 700 000
# bytes). The preview's values are in the comments: at 256 / 3 / 256 / 2 the file
# came to 2.0 MB, and the values below bring it to about 665 kB. The bands weigh
# most, since the exporter splits a vertex wherever its normal or UV differs, and
# every bevel segment adds a row of those; a 0.007 bevel is about a pixel on
# screen, so the bevel and the segment counts are what to lower, in that order.
BAND_SEG = 128          # quads around each band (preview: 256)
BEVEL_SEGMENTS = 2      # segments of the band-edge bevel (preview: 3)
RIM_SEG = 96            # segments around each gold rim (preview: 256)
RIM_RES = 1             # bevel resolution of the rim and axis tubes, 4 + 4 * res sides (preview: 2 for the rims, 1 for the axis)
PIVOT_SEGMENTS = (48, 24)

BAND_T = 0.045          # band thickness
BEVEL_WIDTH = 0.007
RIM_BEVEL = 0.016
AXIS_BEVEL = 0.0022

# radius, band height, rotation (degrees)
RINGS = [
    (1.52, 0.18, (90, 0, 62)),
    (1.46, 0.16, (90, 0, -35)),
    (1.40, 0.15, (55, 0, -20)),
    (1.56, 0.14, (14, -6, 0)),
]
L_N, W_N, T_N = 1.15, 0.07, 0.022    # needle: length, half width, half thickness
PIVOT_R = 0.085
AXIS_Z = (-1.5, 1.6)

# the rise
FPS = 24
RISE_FRAMES = 52
RISE_FROM_Z = -3.25
RISE_FROM_ROT = -50.0                # degrees about Z


# ---------------------------------------------------------------- fresh scene
def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.lights, bpy.data.cameras, bpy.data.materials, bpy.data.actions):
        for d in list(coll):
            coll.remove(d)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.fps_base = 1.0
    sc.frame_start = 0
    sc.frame_end = RISE_FRAMES
    return sc


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------- band
def band_mesh(name, R, h, t=BAND_T, seg=BAND_SEG):
    """A hollow ring of thickness t and height h around Z, smooth on its two big faces.

    UVs: u runs 0..1 around the band from local +X, and v (as the FILE holds it) runs 0 at the
    bottom edge to 1 at the top edge: v = (z + h/2) / h. The outer and inner faces take them
    exactly; the thin top and bottom faces take v = 1 and v = 0.

    The glTF exporter writes v as 1 - v (glTF puts the texture origin at the top left), so the
    layer here holds the flipped v and the file ends up with the values above. Three.js reads
    the file's values as they are, and the strip painter (src/engine/bob/paintBand.ts) paints
    for v = 1 at the top edge.
    """
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    loops = {}
    for key, r, z in (("OB", R + t / 2, -h / 2), ("OT", R + t / 2, h / 2), ("IT", R - t / 2, h / 2), ("IB", R - t / 2, -h / 2)):
        loops[key] = [bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)]
    OB, OT, IT, IB = loops["OB"], loops["OT"], loops["IT"], loops["IB"]

    def face(verts, smooth, uvs):
        """A face whose corners take these (u, v) as the file will hold them."""
        f = bm.faces.new(verts)
        f.smooth = smooth
        for loop, (u, v) in zip(f.loops, uvs):
            loop[uv].uv = (u, 1 - v)
        return f

    for i in range(seg):
        j = (i + 1) % seg
        u0, u1 = i / seg, (i + 1) / seg    # the last quad ends at u = 1, not 0: the seam
        face((OB[i], OB[j], OT[j], OT[i]), True, ((u0, 0), (u1, 0), (u1, 1), (u0, 1)))     # outer
        face((OT[i], OT[j], IT[j], IT[i]), False, ((u0, 1), (u1, 1), (u1, 1), (u0, 1)))    # top
        face((IT[i], IT[j], IB[j], IB[i]), True, ((u0, 1), (u1, 1), (u1, 0), (u0, 0)))     # inner
        face((IB[i], IB[j], OB[j], OB[i]), False, ((u0, 0), (u1, 0), (u1, 0), (u0, 0)))    # bottom
    for e in bm.edges:
        e.smooth = not all(abs(abs(v.co.z) - h / 2) < 1e-6 for v in e.verts) or \
            abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6
    bm.to_mesh(me)
    bm.free()
    return me


# ---------------------------------------------------------------- curves
def poly_curve(name, splines, bevel, res):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    cu.bevel_factor_mapping_start = 'SPLINE'
    cu.bevel_factor_mapping_end = 'SPLINE'
    for pts in splines:
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            sp.points[i].co = (p[0], p[1], p[2], 1.0)
    return link(bpy.data.objects.new(name, cu))


def curve_to_mesh(ob):
    """Replace a curve object by a mesh object of its evaluated tube, same name, parent and place.

    The glTF exporter's handling of curve objects varies by version; a mesh is the sure way.
    The tubes carry no UVs: the site paints no texture on them.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    name, parent, matrix = ob.name, ob.parent, ob.matrix_parent_inverse.copy()
    data = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(data)
    me.name = name
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    for p in me.polygons:
        p.use_smooth = True
    out = link(bpy.data.objects.new(name, me))
    out.parent = parent
    out.matrix_parent_inverse = matrix
    return out


# ---------------------------------------------------------------- build
def build():
    arm = link(bpy.data.objects.new("armillary", None))
    arm.empty_display_type = 'SPHERE'
    arm.empty_display_size = 0.2

    curves = []
    for idx, (R, h, rot) in enumerate(RINGS, start=1):
        band = link(bpy.data.objects.new(f"band_{idx}", band_mesh(f"band_{idx}", R, h)))
        band.parent = arm
        band.rotation_euler = [math.radians(a) for a in rot]
        bev = band.modifiers.new("edges", 'BEVEL')
        bev.width = BEVEL_WIDTH
        bev.segments = BEVEL_SEGMENTS
        bev.limit_method = 'ANGLE'
        bev.harden_normals = True
        # gold rims wrapped over both glass edges
        rim_pts = lambda z: [(R * math.cos(2 * math.pi * i / RIM_SEG), R * math.sin(2 * math.pi * i / RIM_SEG), z) for i in range(RIM_SEG + 1)]
        rim = poly_curve(f"rim_{idx}", [rim_pts(h / 2), rim_pts(-h / 2)], RIM_BEVEL, RIM_RES)
        rim.parent = band
        curves.append(rim)

    # needle: a slim double diamond, resting straight up its local +Z (three's +Y)
    nm = bpy.data.meshes.new("needle")
    bm = bmesh.new()
    tip_a = bm.verts.new((0, 0, L_N))
    tip_b = bm.verts.new((0, 0, -L_N * 0.85))
    ring = [bm.verts.new(v) for v in ((W_N, 0, 0), (0, -T_N, 0), (-W_N, 0, 0), (0, T_N, 0))]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((tip_a, ring[i], ring[j]))
        bm.faces.new((tip_b, ring[j], ring[i]))
    bm.normal_update()
    bm.to_mesh(nm)
    bm.free()
    needle = link(bpy.data.objects.new("needle", nm))
    needle.parent = arm

    pm = bpy.data.meshes.new("pivot")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=PIVOT_SEGMENTS[0], v_segments=PIVOT_SEGMENTS[1], radius=PIVOT_R, calc_uvs=False)
    bm.to_mesh(pm)
    bm.free()
    for p in pm.polygons:
        p.use_smooth = True
    pivot = link(bpy.data.objects.new("pivot", pm))
    pivot.parent = arm

    axis = poly_curve("axis", [[(0, 0, AXIS_Z[0]), (0, 0, AXIS_Z[1])]], AXIS_BEVEL, RIM_RES)
    axis.parent = arm
    curves.append(axis)

    for c in curves:
        curve_to_mesh(c)
    return arm


# ---------------------------------------------------------------- the rise
def fcurves_of(ob):
    """The F-curves of the object's action, on the layered actions of 4.4 and later or the old flat ones."""
    ad = ob.animation_data
    act = ad.action
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    from bpy_extras import anim_utils
    return list(anim_utils.action_get_channelbag_for_slot(act, ad.action_slot).fcurves)


def key_rise(arm):
    """Key the armillary: it rises out of the dark and turns to rest, over frames 0..52.

    Both curves are cubic Beziers shaped as the preview's ease-out, 1 - (1 - x)^3: the first
    key's handle reaches the end value a third of the way along, the second key's handle sits
    at the end value two thirds along, so the curve starts fast and settles to a stop.
    """
    last = RISE_FRAMES
    arm.location = (0, 0, RISE_FROM_Z)
    arm.rotation_euler = (0, 0, math.radians(RISE_FROM_ROT))
    arm.keyframe_insert("location", index=2, frame=0)
    arm.keyframe_insert("rotation_euler", index=2, frame=0)
    arm.location = (0, 0, 0)
    arm.rotation_euler = (0, 0, 0)
    arm.keyframe_insert("location", index=2, frame=last)
    arm.keyframe_insert("rotation_euler", index=2, frame=last)
    arm.animation_data.action.name = "rise"
    for fc in fcurves_of(arm):
        a, b = fc.keyframe_points
        end = b.co[1]
        a.interpolation = 'BEZIER'
        for kp in (a, b):
            kp.handle_left_type = 'FREE'
            kp.handle_right_type = 'FREE'
        a.handle_left = (a.co[0] - last / 3, a.co[1])
        a.handle_right = (a.co[0] + last / 3, end)
        b.handle_left = (a.co[0] + 2 * last / 3, end)
        b.handle_right = (b.co[0] + last / 3, end)
        fc.update()


# ---------------------------------------------------------------- export
def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_materials='NONE',
        export_cameras=False,
        export_lights=False,
    )


def rest_the_armillary(path):
    """Take the armillary's static translation and rotation out of the GLB's JSON.

    The exporter sets the scene to frame 0 before it writes the nodes, so the armillary node
    carries the rise's first pose (down at y -3.25, turned -50 degrees). The file should hold
    the compass at rest, at the origin, so that a page which does not play the rise (reduced
    motion) shows it standing in place; the rise's channels still run from the first pose.
    Only the JSON chunk changes; the rest of the file is copied through.
    """
    with open(path, 'rb') as f:
        data = f.read()
    magic, version, _ = struct.unpack_from('<III', data, 0)
    json_len, json_type = struct.unpack_from('<II', data, 12)
    doc = json.loads(data[20:20 + json_len])
    rest = data[20 + json_len:]
    arm = [n for n in doc['nodes'] if n.get('name') == 'armillary']
    assert len(arm) == 1, "the GLB must hold one armillary node"
    for key in ('translation', 'rotation', 'scale', 'matrix'):
        arm[0].pop(key, None)
    text = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    text += b' ' * (-len(text) % 4)    # chunks are padded to four bytes, JSON with spaces
    head = struct.pack('<III', magic, version, 12 + 8 + len(text) + len(rest)) + struct.pack('<II', len(text), json_type)
    with open(path, 'wb') as f:
        f.write(head + text + rest)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    path = os.path.abspath(argv[0] if argv else os.path.join("public", "models", "bob-compass.glb"))
    reset_scene()
    arm = build()
    key_rise(arm)
    # the evaluated meshes, for the report on the budget
    dg = bpy.context.evaluated_depsgraph_get()
    counts = {}
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            ev = ob.evaluated_get(dg)
            m = ev.to_mesh()
            counts[ob.name] = (len(m.vertices), len(m.polygons))
            ev.to_mesh_clear()
    export(path)
    rest_the_armillary(path)
    print("EXPORT_COMPASS", path, os.path.getsize(path), "bytes")
    print("EXPORT_COMPASS meshes (verts, faces):", counts)


main()
