# Animates the loader -> home sequence on top of bob_build.py (run that first in the same namespace).
# Every animated value is baked per frame with linear keys, so the easing lives in this file.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

sc = bpy.data.scenes["BOB_previs"]
F_END = 300
sc.frame_start, sc.frame_end = 1, F_END
prefs = bpy.context.preferences.edit
old_interp = prefs.keyframe_new_interpolation_type
prefs.keyframe_new_interpolation_type = 'LINEAR'


def clamp01(x):
    return max(0.0, min(1.0, x))


def ease_io(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def ease_in(x):
    x = clamp01(x)
    return x ** 3


def span(f, f0, f1):
    return clamp01((f - f0) / float(f1 - f0))


def lerp(a, b, t):
    return a + (b - a) * t


def path_point(pts, u):
    pts = [Vector((p[0], p[1])) for p in pts]
    seg = [(b - a).length for a, b in zip(pts[:-1], pts[1:])]
    total = sum(seg)
    d = clamp01(u) * total
    for (a, b), L in zip(zip(pts[:-1], pts[1:]), seg):
        if d <= L or L == 0:
            return a.lerp(b, d / L if L else 0)
        d -= L
    return pts[-1]


# ---------------------------------------------------------------- the strokes, in cutting order
circle = circle_pts(CIRCLE_R)
STROKES = [  # curve object, points, first frame, last frame
    ("bob_B_left", lb_outline, 18, 66),
    ("bob_B_left_bar", lb_bar, 74, 84),
    ("bob_B_right", rb_outline, 96, 144),
    ("bob_B_right_bar", rb_bar, 152, 162),
    ("bob_circle", circle, 174, 222),
]
CUT_Z, LIFT = 0.012, 0.35

# ---------------------------------------------------------------- laser probe
M_PROBE = mat_gold_emit("bob_probe_gold", 0.12)
M_TIP = mat_gold_emit("bob_probe_tip", 0.0)
tip_b = next(n for n in M_TIP.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
tip_b.inputs['Emission Color'].default_value = (1.0, 0.86, 0.6, 1)

pm = bpy.data.meshes.new("bob_probe")
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.003, radius2=0.018, depth=0.22,
                      matrix=Matrix.Translation((0, 0, 0.11)))
bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.018, radius2=0.018, depth=9.0,
                      matrix=Matrix.Translation((0, 0, 0.22 + 4.5)))
bm.to_mesh(pm)
bm.free()
for p in pm.polygons:
    p.use_smooth = True
probe = link(bpy.data.objects.new("bob_probe", pm))
probe.data.materials.append(M_PROBE)

tm = bpy.data.meshes.new("bob_probe_tip")
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.014)
bm.to_mesh(tm)
bm.free()
tip = link(bpy.data.objects.new("bob_probe_tip", tm))
tip.data.materials.append(M_TIP)
tip.parent = probe

tl = bpy.data.lights.new("bob_probe_light", 'POINT')
tl.color = (1.0, 0.78, 0.5)
tl.shadow_soft_size = 0.02
tl.volume_factor = 1.0
tip_light = link(bpy.data.objects.new("bob_probe_light", tl))
tip_light.parent = probe
tip_light.location = (0, 0, 0.04)


def probe_state(f):
    """(x, y, z, cutting) for frame f."""
    first = Vector(path_point(STROKES[0][1], 0))
    if f < STROKES[0][2]:
        t = ease_out(span(f, 1, STROKES[0][2]))
        return first.x, first.y, lerp(6.0, CUT_Z, t), False
    for i, (_, pts, f0, f1) in enumerate(STROKES):
        if f0 <= f <= f1:
            p = path_point(pts, span(f, f0, f1))
            return p.x, p.y, CUT_Z, True
        nxt = STROKES[i + 1] if i + 1 < len(STROKES) else None
        if nxt and f1 < f < nxt[2]:
            a = path_point(pts, 1.0)
            b = path_point(nxt[1], 0.0)
            t = ease_io(span(f, f1, nxt[2]))
            p = a.lerp(b, t)
            return p.x, p.y, CUT_Z + LIFT * math.sin(math.pi * t), False
    end = path_point(STROKES[-1][1], 1.0)
    t = ease_in(span(f, STROKES[-1][3], STROKES[-1][3] + 24))
    return end.x, end.y, lerp(CUT_Z, 7.5, t), False


# ---------------------------------------------------------------- camera path
cam = sc.camera
cam.data.dof.focus_object = None
WIDE = dict(dist=13.8, elev=14.0, tz=0.2)
HOME = dict(dist=HOME_DIST, elev=HOME_ELEV, tz=ARM_Z)


def cam_state(f):
    t = ease_io(span(f, 228, 292))
    drift = 0.35 * (1 - span(f, 1, 228))  # slow dolly while engraving
    d = lerp(WIDE["dist"] + drift, HOME["dist"], t)
    e = lerp(WIDE["elev"], HOME["elev"], t)
    tz = lerp(WIDE["tz"], HOME["tz"], t)
    loc = Vector((0, -d * math.cos(math.radians(e)), tz + d * math.sin(math.radians(e))))
    return loc, Vector((0, 0, tz)), d


# ---------------------------------------------------------------- materials and lights to animate
def emit_input(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Emission Strength']

ticks_in, outer_in, trace_in, pad_in = emit_input(M_TICKS), emit_input(M_OUTER), emit_input(M_TRACE), emit_input(M_TRACE)
glow_in = emit_input(M_GLOW)
tip_in = emit_input(M_TIP)
smoke_mat = bpy.data.materials["bob_smoke"]
smoke_dens = smoke_mat.node_tree.nodes["smoke_density"].inputs[1]
smoke_noise_w = smoke_mat.node_tree.nodes["smoke_noise"].inputs['W']
well_light = sc.objects["bob_well_light"].data
well_emit = bpy.data.materials["bob_well_glow"].node_tree.nodes["well_emit"].outputs[0]
key_light = sc.objects["bob_key_rim"].data
lip = sc.objects["bob_lip"]
cap = sc.objects["bob_cap"]
cap.hide_viewport = False
arm = sc.objects["bob_armillary"]
needle = sc.objects["bob_needle"]
rings = [sc.objects[f"bob_ring_{i + 1}"] for i in range(4)]
ring_rest = [r.rotation_euler.copy() for r in rings]
ARM_LOW = -2.7

curves = {name: sc.objects[name].data for name, *_ in STROKES}
ticks_ob, outer_ob = sc.objects["bob_ticks"], sc.objects["bob_outer_circle"]
ticks_cu, outer_cu = ticks_ob.data, outer_ob.data

for f in range(1, F_END + 1):
    # engraving reveal
    for name, pts, f0, f1 in STROKES:
        cu = curves[name]
        cu.bevel_factor_end = span(f, f0, f1)
        cu.keyframe_insert("bevel_factor_end", frame=f)
    # probe
    x, y, z, cutting = probe_state(f)
    probe.location = (x, y, z)
    probe.keyframe_insert("location", frame=f)
    tl.energy = 35.0 if cutting else 0.0
    tl.keyframe_insert("energy", frame=f)
    tip_in.default_value = 40.0 if cutting else 2.0
    tip_in.keyframe_insert("default_value", frame=f)
    # camera
    loc, tgt, dist = cam_state(f)
    cam.location = loc
    cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_euler", frame=f)
    cam.data.dof.focus_distance = dist
    cam.data.dof.keyframe_insert("focus_distance", frame=f)
    # fade in from black, smoke drift
    sc.view_settings.exposure = lerp(-7.0, -0.35, ease_out(span(f, 1, 16)))
    sc.view_settings.keyframe_insert("exposure", frame=f)
    smoke_dens.default_value = lerp(0.0, 0.9, ease_io(span(f, 1, 60)))
    smoke_dens.keyframe_insert("default_value", frame=f)
    smoke_noise_w.default_value = f / F_END * 1.4
    smoke_noise_w.keyframe_insert("default_value", frame=f)
    trace_in.default_value = lerp(0.0, 0.09, ease_io(span(f, 4, 40)))
    trace_in.keyframe_insert("default_value", frame=f)
    # once the circle is closed the ticks grow outward and the outer ring draws itself
    ticks_cu.bevel_factor_end = ease_out(span(f, 220, 234))
    ticks_cu.keyframe_insert("bevel_factor_end", frame=f)
    outer_cu.bevel_factor_end = ease_io(span(f, 222, 244))
    outer_cu.keyframe_insert("bevel_factor_end", frame=f)
    ticks_ob.hide_render = f < 220
    ticks_ob.keyframe_insert("hide_render", frame=f)
    outer_ob.hide_render = f < 222
    outer_ob.keyframe_insert("hide_render", frame=f)
    # the glass inside the circle opens like an iris
    s = 1.0 - ease_in(span(f, 228, 244))
    cap.scale = (max(s, 0.001),) * 3
    cap.keyframe_insert("scale", frame=f)
    cap.hide_render = f > 244
    cap.keyframe_insert("hide_render", frame=f)
    lip.hide_render = f < 228
    lip.keyframe_insert("hide_render", frame=f)
    glow_in.default_value = lerp(0.0, 0.5, ease_io(span(f, 226, 252)))
    glow_in.keyframe_insert("default_value", frame=f)
    well_emit.default_value = lerp(0.0, 1.1, ease_io(span(f, 226, 256)))
    well_emit.keyframe_insert("default_value", frame=f)
    well_light.energy = lerp(0.0, 90.0, ease_io(span(f, 226, 252)))
    well_light.keyframe_insert("energy", frame=f)
    key_light.energy = lerp(180.0, 650.0, ease_io(span(f, 230, 280)))
    key_light.keyframe_insert("energy", frame=f)
    # rings surface, each band turning slowly on its own axis
    arm.location = (0, 0, lerp(ARM_LOW, ARM_Z, ease_out(span(f, 236, 288))))
    arm.rotation_euler = (0, 0, math.radians(lerp(-50.0, 0.0, ease_out(span(f, 236, 292)))))
    arm.keyframe_insert("location", frame=f)
    arm.keyframe_insert("rotation_euler", frame=f)
    for k, (r, rest) in enumerate(zip(rings, ring_rest)):
        r.rotation_euler = rest
        spin = math.radians((f - F_END) * (0.25 + 0.1 * k) * (1 if k % 2 else -1))
        r.rotation_euler.rotate_axis('Z', spin)
        r.keyframe_insert("rotation_euler", frame=f)
    # the needle swings in and settles
    t = span(f, 250, F_END)
    swing = 110.0 * math.exp(-4.0 * t) * math.cos(9.0 * t) if f >= 250 else 110.0
    needle.rotation_euler = (0, math.radians(38 + swing), 0)
    needle.keyframe_insert("rotation_euler", frame=f)

prefs.keyframe_new_interpolation_type = old_interp
sc.frame_set(F_END)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "bob-previs.blend"))
result = {"frames": F_END, "strokes": [(s[0], s[2], s[3]) for s in STROKES]}
