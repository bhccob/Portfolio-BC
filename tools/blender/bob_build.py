# Builds the BOB previs scene (home state) in its own scene "BOB_previs".
# Run inside Blender: exec(open(path).read())
import bpy, bmesh, math, os, random
from mathutils import Vector

OUT_DIR = r"C:\Users\bhcco\Downloads\Portfolio-bob\.superpowers\brainstorm\bob-wordmark-2026-10-21\blender"
SCENE_NAME = "BOB_previs"
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------------- dimensions
B_H, B_W = 3.4, 2.1            # letter cap height (runs away from camera) and width
B_LEFT_X, B_RIGHT_X = -4.25, 2.15
B_Y0 = -B_H / 2
HOLE_R = 1.585                  # opening in the glass
CIRCLE_R = 1.66                 # main engraved circle
OUTER_R = 1.88
ARM_Z = 0.55                    # armillary centre height (home)
GOLD = (1.0, 0.62, 0.26)
GOLD_EMIT = (1.0, 0.52, 0.16)
VIOLET = (0.55, 0.36, 1.0)

# ---------------------------------------------------------------- scene reset
sc = bpy.data.scenes.get(SCENE_NAME) or bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene = sc
for ob in list(sc.collection.all_objects):
    bpy.data.objects.remove(ob, do_unlink=True)
for c in list(sc.collection.children):
    bpy.data.collections.remove(c)
for coll_name in ("meshes", "curves", "materials", "lights", "cameras", "node_groups", "worlds"):
    coll_data = getattr(bpy.data, coll_name)
    for d in list(coll_data):
        if d.name.startswith("bob_") and d.users == 0:
            coll_data.remove(d)
col = bpy.data.collections.new("bob_scene")
sc.collection.children.link(col)


def link(ob):
    col.objects.link(ob)
    return ob


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


# ---------------------------------------------------------------- materials
def principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    return m, nt, bsdf


def mat_gold_emit(name, strength, base_metal=True):
    m, nt, b = principled(name)
    b.inputs['Base Color'].default_value = (*GOLD, 1)
    b.inputs['Metallic'].default_value = 1.0 if base_metal else 0.0
    b.inputs['Roughness'].default_value = 0.25
    b.inputs['Emission Color'].default_value = (*GOLD_EMIT, 1)
    b.inputs['Emission Strength'].default_value = strength
    return m


def mat_black_glass():
    m, nt, b = principled("bob_black_glass")
    b.inputs['Base Color'].default_value = (0.004, 0.0032, 0.006, 1)
    b.inputs['Roughness'].default_value = 0.08
    b.inputs['Specular IOR Level'].default_value = 0.6
    b.inputs['Coat Weight'].default_value = 1.0
    b.inputs['Coat Roughness'].default_value = 0.025
    n1 = nt.nodes.new('ShaderNodeTexNoise')
    n1.inputs['Scale'].default_value = 9.0
    n1.inputs['Detail'].default_value = 12.0
    n1.inputs['Roughness'].default_value = 0.7
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.06
    bump.inputs['Distance'].default_value = 0.01
    nt.links.new(n1.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    rr = nt.nodes.new('ShaderNodeMapRange')
    rr.inputs['To Min'].default_value = 0.05
    rr.inputs['To Max'].default_value = 0.16
    nt.links.new(n1.outputs['Fac'], rr.inputs['Value'])
    # fine scratches: thin streaks of rougher glass, all running roughly one way
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value = (0, 0, math.radians(28))
    mp.inputs['Scale'].default_value = (0.35, 22.0, 1.0)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    sn = nt.nodes.new('ShaderNodeTexNoise')
    sn.inputs['Scale'].default_value = 3.0
    sn.inputs['Detail'].default_value = 4.0
    nt.links.new(mp.outputs['Vector'], sn.inputs['Vector'])
    sr = nt.nodes.new('ShaderNodeValToRGB')
    sr.color_ramp.elements[0].position = 0.62
    sr.color_ramp.elements[1].position = 0.66
    nt.links.new(sn.outputs['Fac'], sr.inputs['Fac'])
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'MULTIPLY_ADD'
    add.inputs[1].default_value = 0.22
    nt.links.new(sr.outputs['Color'], add.inputs[0])
    nt.links.new(rr.outputs['Result'], add.inputs[2])
    nt.links.new(add.outputs[0], b.inputs['Roughness'])
    nt.links.new(add.outputs[0], b.inputs['Coat Roughness'])
    return m


def mat_matte(name, rgb, emit=0.0):
    m, nt, b = principled(name)
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = 0.8
    if emit:
        b.inputs['Emission Color'].default_value = (*GOLD_EMIT, 1)
        b.inputs['Emission Strength'].default_value = emit
    return m


def mat_ring(name, half_h):
    """Smoked violet glass band with gold rims and engraved tick marks (ring-local coords)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.surface_render_method = 'DITHERED'
    m.use_raytrace_refraction = True
    m.thickness_mode = 'SLAB'
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    L = nt.links.new
    out = N('ShaderNodeOutputMaterial')
    tc = N('ShaderNodeTexCoord')
    sep = N('ShaderNodeSeparateXYZ')
    L(tc.outputs['Object'], sep.inputs[0])

    def math_node(op, a=None, b=None, c=None):
        n = N('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L(v, n.inputs[i])
        return n.outputs[0]

    ang = math_node('ARCTAN2', sep.outputs['Y'], sep.outputs['X'])
    a01 = math_node('MULTIPLY_ADD', ang, 1 / (2 * math.pi), 0.5)
    zl = math_node('DIVIDE', sep.outputs['Z'], half_h)          # -1 .. 1 across the band
    # fine ticks along the top edge, longer ticks every 10 degrees
    fine = math_node('MULTIPLY', math_node('LESS_THAN', math_node('FRACT', math_node('MULTIPLY', a01, 180.0)), 0.07),
                     math_node('GREATER_THAN', zl, 0.6))
    coarse = math_node('MULTIPLY', math_node('LESS_THAN', math_node('FRACT', math_node('MULTIPLY', a01, 36.0)), 0.045),
                       math_node('GREATER_THAN', zl, 0.3))
    # eight trigrams (three bars, some broken) between the long ticks
    pos8 = math_node('ADD', math_node('MULTIPLY', a01, 8.0), 0.5)
    local = math_node('SUBTRACT', math_node('FRACT', pos8), 0.5)
    idx = math_node('FLOOR', pos8)
    alocal = math_node('ABSOLUTE', local)
    in_sym = math_node('LESS_THAN', alocal, 0.03)
    gap = math_node('LESS_THAN', alocal, 0.007)
    bars = None
    for c, prime in ((-0.55, 0.37), (-0.15, 0.53), (0.25, 0.71)):
        bar = math_node('LESS_THAN', math_node('ABSOLUTE', math_node('SUBTRACT', zl, c)), 0.085)
        broken = math_node('MULTIPLY', math_node('GREATER_THAN', math_node('FRACT', math_node('MULTIPLY', idx, prime)), 0.5), gap)
        bar = math_node('MULTIPLY', bar, math_node('SUBTRACT', 1.0, broken))
        bars = bar if bars is None else math_node('MAXIMUM', bars, bar)
    sym = math_node('MULTIPLY', in_sym, bars)
    mask = math_node('MAXIMUM', math_node('MAXIMUM', fine, coarse), sym)
    glass = N('ShaderNodeBsdfPrincipled')
    glass.inputs['Base Color'].default_value = (0.52, 0.4, 0.86, 1)
    glass.inputs['Transmission Weight'].default_value = 1.0
    glass.inputs['Roughness'].default_value = 0.04
    glass.inputs['IOR'].default_value = 1.5
    glass.inputs['Coat Weight'].default_value = 0.5
    glass.inputs['Thin Film Thickness'].default_value = 260.0
    glass.inputs['Specular Tint'].default_value = (0.75, 0.6, 1.0, 1)
    glass.inputs['Emission Color'].default_value = (0.42, 0.26, 0.9, 1)
    glass.inputs['Emission Strength'].default_value = 0.06
    gold = N('ShaderNodeBsdfPrincipled')
    gold.inputs['Base Color'].default_value = (*GOLD, 1)
    gold.inputs['Metallic'].default_value = 1.0
    gold.inputs['Roughness'].default_value = 0.22
    gold.inputs['Emission Color'].default_value = (*GOLD_EMIT, 1)
    gold.inputs['Emission Strength'].default_value = 0.45
    mix = N('ShaderNodeMixShader')
    L(mask, mix.inputs['Fac'])
    L(glass.outputs[0], mix.inputs[1])
    L(gold.outputs[0], mix.inputs[2])
    L(mix.outputs[0], out.inputs['Surface'])
    return m


def mat_smoke():
    m = bpy.data.materials.new("bob_smoke")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    L = nt.links.new
    out = N('ShaderNodeOutputMaterial')
    vol = N('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.5, 0.36, 0.9, 1)
    vol.inputs['Anisotropy'].default_value = 0.3
    geo = N('ShaderNodeNewGeometry')
    mp = N('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.32, 0.32, 1.1)
    L(geo.outputs['Position'], mp.inputs['Vector'])
    noise = N('ShaderNodeTexNoise')
    noise.noise_dimensions = '4D'
    noise.inputs['Scale'].default_value = 1.0
    noise.inputs['Detail'].default_value = 10.0
    noise.inputs['Roughness'].default_value = 0.62
    noise.inputs['Distortion'].default_value = 1.1
    noise.name = "smoke_noise"
    L(mp.outputs['Vector'], noise.inputs['Vector'])
    ramp = N('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.5
    ramp.color_ramp.elements[1].position = 0.74
    L(noise.outputs['Fac'], ramp.inputs['Fac'])
    tc = N('ShaderNodeTexCoord')
    sep = N('ShaderNodeSeparateXYZ')
    L(tc.outputs['Generated'], sep.inputs[0])
    fall = N('ShaderNodeMath'); fall.operation = 'SUBTRACT'
    fall.inputs[0].default_value = 1.0
    L(sep.outputs['Z'], fall.inputs[1])
    powr = N('ShaderNodeMath'); powr.operation = 'POWER'
    powr.inputs[1].default_value = 1.8
    L(fall.outputs[0], powr.inputs[0])
    mul = N('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    L(ramp.outputs['Color'], mul.inputs[0])
    L(powr.outputs[0], mul.inputs[1])
    dens = N('ShaderNodeMath'); dens.operation = 'MULTIPLY'
    dens.name = "smoke_density"
    dens.inputs[1].default_value = 0.9
    L(mul.outputs[0], dens.inputs[0])
    L(dens.outputs[0], vol.inputs['Density'])
    L(vol.outputs[0], out.inputs['Volume'])
    return m


M_GLASS = mat_black_glass()
M_LETTER = mat_gold_emit("bob_engrave_letters", 3.0)
M_CIRCLE = mat_gold_emit("bob_engrave_circle", 3.2)
M_TICKS = mat_gold_emit("bob_engrave_ticks", 1.8)
M_OUTER = mat_gold_emit("bob_engrave_outer", 1.2)
M_TRACE = mat_gold_emit("bob_traces", 0.09)
M_LIP = mat_gold_emit("bob_lip", 0.5)
M_NEEDLE = mat_gold_emit("bob_needle_gold", 0.15)
M_WELL = mat_matte("bob_well", (0.006, 0.004, 0.008))
M_GLOW = mat_matte("bob_glow", (0.0, 0.0, 0.0), emit=1.2)


# ---------------------------------------------------------------- curves
def poly_curve(name, splines, bevel, mat, z=0.0, res=3):
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
            sp.points[i].co = (p[0], p[1], p[2] if len(p) > 2 else z, 1.0)
    cu.materials.append(mat)
    return link(bpy.data.objects.new(name, cu))


def b_paths(ox, oy, H=B_H, W=B_W, mid_ratio=0.53, n=56):
    mid = H * mid_ratio
    r_b = mid / 2
    a_b = W - r_b
    r_t = (H - mid) / 2
    a_t = W - 0.1 - r_t
    pts = [(0, 0), (0, H), (a_t, H)]
    for i in range(1, n + 1):
        t = math.pi / 2 - math.pi * i / n
        pts.append((a_t + r_t * math.cos(t), (H - r_t) + r_t * math.sin(t)))
    if abs(a_b - a_t) > 1e-4:
        pts.append((a_b, mid))
    for i in range(1, n + 1):
        t = math.pi / 2 - math.pi * i / n
        pts.append((a_b + r_b * math.cos(t), (mid - r_b) + r_b * math.sin(t)))
    pts.append((0, 0))
    bar = [(0, mid), (min(a_t, a_b), mid)]
    to_w = lambda p: (ox + p[0], oy + p[1])
    return [to_w(p) for p in pts], [to_w(p) for p in bar]


def circle_pts(r, n=240, start=math.radians(45)):
    pts = [(r * math.cos(start + 2 * math.pi * i / n), r * math.sin(start + 2 * math.pi * i / n)) for i in range(n)]
    return pts + [pts[0]]


ENGRAVE_Z = 0.0
lb_outline, lb_bar = b_paths(B_LEFT_X, B_Y0)
rb_outline, rb_bar = b_paths(B_RIGHT_X, B_Y0)
poly_curve("bob_B_left", [lb_outline], 0.011, M_LETTER, ENGRAVE_Z)
poly_curve("bob_B_left_bar", [lb_bar], 0.011, M_LETTER, ENGRAVE_Z)
poly_curve("bob_B_right", [rb_outline], 0.011, M_LETTER, ENGRAVE_Z)
poly_curve("bob_B_right_bar", [rb_bar], 0.011, M_LETTER, ENGRAVE_Z)
poly_curve("bob_circle", [circle_pts(CIRCLE_R)], 0.011, M_CIRCLE, ENGRAVE_Z)
poly_curve("bob_outer_circle", [circle_pts(OUTER_R)], 0.0055, M_OUTER, ENGRAVE_Z)
poly_curve("bob_lip", [circle_pts(HOLE_R + 0.012)], 0.02, M_LIP, -0.004)

ticks = []
for k in range(144):
    a = 2 * math.pi * k / 144
    r1 = CIRCLE_R + 0.03
    r2 = r1 + (0.16 if k % 12 == 0 else 0.1 if k % 6 == 0 else 0.055)
    ticks.append([(r1 * math.cos(a), r1 * math.sin(a)), (r2 * math.cos(a), r2 * math.sin(a))])
poly_curve("bob_ticks", ticks, 0.0045, M_TICKS, ENGRAVE_Z, res=1)

# circuit traces: 45-degree walks that keep clear of the letters and the circle
random.seed(2006)
def blocked(p):
    x, y = p
    if math.hypot(x, y) < OUTER_R + 0.25:
        return True
    for ox in (B_LEFT_X, B_RIGHT_X):
        if ox - 0.25 < x < ox + B_W + 0.25 and B_Y0 - 0.25 < y < B_Y0 + B_H + 0.25:
            return True
    return False

traces, pads = [], []
dirs = [Vector((math.cos(math.radians(a)), math.sin(math.radians(a)))) for a in range(0, 360, 45)]
tries = 0
while len(traces) < 70 and tries < 4000:
    tries += 1
    p = Vector((random.uniform(-15, 15), random.uniform(-7, 22)))
    if blocked(p):
        continue
    d = random.choice(dirs[::2])
    pts = [p.copy()]
    for _ in range(random.randint(3, 7)):
        seg = random.uniform(0.5, 2.6)
        q = p + d * seg
        mid = (p + q) / 2
        if blocked(q) or blocked(mid):
            break
        pts.append(q.copy())
        p = q
        k = dirs.index(min(dirs, key=lambda v: (v - d).length))
        d = dirs[(k + random.choice((1, -1))) % 8]
    if len(pts) >= 3:
        traces.append([tuple(v) for v in pts])
        for end in (pts[0], pts[-1]):
            pads.append([(end.x + 0.045 * math.cos(2 * math.pi * i / 16), end.y + 0.045 * math.sin(2 * math.pi * i / 16)) for i in range(17)])
poly_curve("bob_traces", traces, 0.004, M_TRACE, 0.0, res=1)
poly_curve("bob_trace_pads", pads, 0.004, M_TRACE, 0.0, res=1)


# ---------------------------------------------------------------- glass floor with the opening
def annulus_mesh(name, r_in, radii, seg=256):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for r in [r_in] + radii:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), 0)) for i in range(seg)])
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((a[i], b[i], b[j], a[j]))  # normal +Z
    bm.to_mesh(me)
    bm.free()
    return me

floor = link(bpy.data.objects.new("bob_floor", annulus_mesh("bob_floor", HOLE_R, [2.2, 3, 4.5, 7, 11, 18, 30, 60])))
floor.data.materials.append(M_GLASS)
sol = floor.modifiers.new("thick", 'SOLIDIFY')
sol.thickness = 0.08
sol.offset = -1

# closed glass cap over the opening (used by the loader; hidden at home)
cap_me = bpy.data.meshes.new("bob_cap")
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, segments=256, radius=HOLE_R)
bm.to_mesh(cap_me)
bm.free()
cap = link(bpy.data.objects.new("bob_cap", cap_me))
cap.data.materials.append(M_GLASS)
cap.hide_render = True
cap.hide_viewport = True

# the short tunnel below the opening; its walls glow warm, brightest at the bottom
WELL_BOTTOM = -1.2


def mat_well():
    m = bpy.data.materials.new("bob_well_glow")
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.01, 0.006, 0.004, 1)
    b.inputs['Roughness'].default_value = 0.5
    b.inputs['Emission Color'].default_value = (*GOLD_EMIT, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs['Z'], inv.inputs[1])
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'
    pw.inputs[1].default_value = 3.0
    nt.links.new(inv.outputs[0], pw.inputs[0])
    level = nt.nodes.new('ShaderNodeValue'); level.name = "well_emit"
    level.outputs[0].default_value = 1.6
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    nt.links.new(pw.outputs[0], mul.inputs[0])
    nt.links.new(level.outputs[0], mul.inputs[1])
    nt.links.new(mul.outputs[0], b.inputs['Emission Strength'])
    return m

well_me = bpy.data.meshes.new("bob_well")
bm = bmesh.new()
top = [bm.verts.new((HOLE_R * math.cos(2 * math.pi * i / 128), HOLE_R * math.sin(2 * math.pi * i / 128), -0.08)) for i in range(128)]
bot = [bm.verts.new((HOLE_R * math.cos(2 * math.pi * i / 128), HOLE_R * math.sin(2 * math.pi * i / 128), WELL_BOTTOM)) for i in range(128)]
for i in range(128):
    j = (i + 1) % 128
    bm.faces.new((top[j], top[i], bot[i], bot[j]))
bm.to_mesh(well_me)
bm.free()
for p in well_me.polygons:
    p.use_smooth = True
well = link(bpy.data.objects.new("bob_well", well_me))
well.data.materials.append(mat_well())

glow_me = bpy.data.meshes.new("bob_glow")
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, segments=64, radius=HOLE_R)
bm.to_mesh(glow_me)
bm.free()
glow = link(bpy.data.objects.new("bob_glow", glow_me))
glow.location = (0, 0, -2.9)
glow.data.materials.append(M_GLOW)
glow.hide_render = True  # superseded by the glowing tunnel; the void opens below it


# ---------------------------------------------------------------- armillary compass
arm = link(bpy.data.objects.new("bob_armillary", None))
arm.empty_display_type = 'SPHERE'
arm.empty_display_size = 0.2
arm.location = (0, 0, ARM_Z)


def band_mesh(name, R, h, t=0.045, seg=256):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    loops = {}
    for key, r, z in (("OB", R + t / 2, -h / 2), ("OT", R + t / 2, h / 2), ("IT", R - t / 2, h / 2), ("IB", R - t / 2, -h / 2)):
        loops[key] = [bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)]
    OB, OT, IT, IB = loops["OB"], loops["OT"], loops["IT"], loops["IB"]
    for i in range(seg):
        j = (i + 1) % seg
        f = bm.faces.new((OB[i], OB[j], OT[j], OT[i])); f.smooth = True
        f = bm.faces.new((OT[i], OT[j], IT[j], IT[i])); f.smooth = False
        f = bm.faces.new((IT[i], IT[j], IB[j], IB[i])); f.smooth = True
        f = bm.faces.new((IB[i], IB[j], OB[j], OB[i])); f.smooth = False
    for e in bm.edges:
        e.smooth = not all(abs(abs(v.co.z) - h / 2) < 1e-6 for v in e.verts) or \
            abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6
    bm.to_mesh(me)
    bm.free()
    return me

RINGS = [  # radius, band height, rotation (deg)
    (1.52, 0.18, (90, 0, 62)),
    (1.46, 0.16, (90, 0, -35)),
    (1.40, 0.15, (55, 0, -20)),
    (1.56, 0.14, (14, -6, 0)),
]
M_RIM = mat_gold_emit("bob_ring_rim", 0.25)
for idx, (R, h, rot) in enumerate(RINGS):
    ob = link(bpy.data.objects.new(f"bob_ring_{idx + 1}", band_mesh(f"bob_ring_{idx + 1}", R, h)))
    ob.data.materials.append(mat_ring(f"bob_ring_mat_{idx + 1}", h / 2))
    ob.parent = arm
    ob.rotation_euler = [math.radians(a) for a in rot]
    bev = ob.modifiers.new("edges", 'BEVEL')
    bev.width = 0.007
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bev.harden_normals = True
    # gold rims wrapped over both glass edges
    rim_pts = lambda z: [(R * math.cos(2 * math.pi * i / 256), R * math.sin(2 * math.pi * i / 256), z) for i in range(257)]
    rim = poly_curve(f"bob_ring_rim_{idx + 1}", [rim_pts(h / 2), rim_pts(-h / 2)], 0.016, M_RIM, res=2)
    rim.parent = ob

# needle: a slim double diamond lying in the plane that faces the camera
nm = bpy.data.meshes.new("bob_needle")
bm = bmesh.new()
L_N, W_N, T_N = 1.15, 0.07, 0.022
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
needle = link(bpy.data.objects.new("bob_needle", nm))
needle.data.materials.append(M_NEEDLE)
needle.parent = arm
needle.rotation_euler = (0, math.radians(38), 0)

piv_me = bpy.data.meshes.new("bob_pivot")
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.085)
bm.to_mesh(piv_me)
bm.free()
for p in piv_me.polygons:
    p.use_smooth = True
pivot = link(bpy.data.objects.new("bob_pivot", piv_me))
pivot.data.materials.append(M_NEEDLE)
pivot.parent = arm

axis = poly_curve("bob_axis", [[(0, 0, -1.5), (0, 0, 1.6)]], 0.0022, M_NEEDLE, res=1)
axis.parent = arm


# ---------------------------------------------------------------- smoke
sm_me = bpy.data.meshes.new("bob_smoke")
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
bm.to_mesh(sm_me)
bm.free()
smoke = link(bpy.data.objects.new("bob_smoke", sm_me))
smoke.scale = (30, 26, 1.7)
smoke.location = (0, 5, 0.75)
smoke.data.materials.append(mat_smoke())


# ---------------------------------------------------------------- lights
def light(name, kind, loc, color, energy, size=1.0, target=(0, 0, ARM_Z), volume=1.0, spec=1.0):
    ld = bpy.data.lights.new(name, kind)
    ld.color = color
    ld.energy = energy
    ld.specular_factor = spec
    if kind == 'AREA':
        ld.shape = 'DISK'
        ld.size = size
    elif kind == 'POINT':
        ld.shadow_soft_size = size
    ld.volume_factor = volume
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = loc
    if kind != 'POINT':
        look_at(ob, target)
    return ob

# high enough that its mirror image in the glossy floor falls below the frame
light("bob_key_rim", 'AREA', (0.5, 3.5, 7.5), (1.0, 0.74, 0.45), 650, size=3.0, volume=0.6)
light("bob_front_soft", 'AREA', (-3.0, -6.0, 4.5), (1.0, 0.8, 0.6), 40, size=4.0, volume=0.0)
# no specular: they light the smoke, and their mirror images would sit in the floor at the frame edges
light("bob_violet_left", 'AREA', (-10, 7, 1.2), VIOLET, 520, size=7.0, target=(0, 2, 0.4), spec=0.0)
light("bob_violet_right", 'AREA', (10, 7, 1.2), VIOLET, 520, size=7.0, target=(0, 2, 0.4), spec=0.0)
light("bob_well_light", 'POINT', (0, 0, -0.9), (1.0, 0.62, 0.3), 90, size=1.0, volume=0.0, spec=0.3)

world = bpy.data.worlds.get("bob_world") or bpy.data.worlds.new("bob_world")
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.0012, 0.0008, 0.0022, 1)
bg.inputs['Strength'].default_value = 1.0
sc.world = world


# ---------------------------------------------------------------- camera (home framing = the approved crop)
cam_d = bpy.data.cameras.new("bob_camera")
cam_d.lens = 50
cam_d.sensor_width = 36
cam_d.clip_end = 300
cam_d.dof.use_dof = True
cam_d.dof.focus_object = arm
cam_d.dof.aperture_fstop = 1.6
cam_d.dof.aperture_blades = 7
cam = link(bpy.data.objects.new("bob_camera", cam_d))
HOME_TARGET = (0, 0, ARM_Z)
HOME_DIST, HOME_ELEV = 8.8, 13.0
cam.location = (0, -HOME_DIST * math.cos(math.radians(HOME_ELEV)), ARM_Z + HOME_DIST * math.sin(math.radians(HOME_ELEV)))
look_at(cam, HOME_TARGET)
sc.camera = cam


# ---------------------------------------------------------------- render settings
r = sc.render
r.engine = 'BLENDER_EEVEE'
r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
r.fps = 24
ee = sc.eevee
ee.taa_render_samples = 64
ee.use_raytracing = True
ee.ray_tracing_method = 'SCREEN'
ee.use_shadows = True
ee.volumetric_start = 0.5
ee.volumetric_end = 45.0
ee.volumetric_tile_size = '4'
ee.volumetric_samples = 96
ee.use_volumetric_shadows = True
for vt, look in (("AgX", "AgX - Medium High Contrast"), ("AgX", "Medium High Contrast"), ("AgX", "None")):
    try:
        sc.view_settings.view_transform = vt
        sc.view_settings.look = look
        break
    except TypeError:
        continue
sc.view_settings.exposure = -0.35

# compositor: soft bloom
comp = bpy.data.node_groups.get("bob_comp")
if comp:
    bpy.data.node_groups.remove(comp)
comp = bpy.data.node_groups.new("bob_comp", 'CompositorNodeTree')
comp.interface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
rl = comp.nodes.new('CompositorNodeRLayers')
rl.scene = sc
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
r.use_compositing = True

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "bob-previs.blend"))
result = {"objects": len(col.objects), "traces": len(traces), "glare_type": str(gl.inputs['Type'].default_value),
          "view": (sc.view_settings.view_transform, sc.view_settings.look)}
