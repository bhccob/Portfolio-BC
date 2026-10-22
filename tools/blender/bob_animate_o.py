# The O-only loader (Bob, 2026-10-22: "only the O ... the compass is the only thing in homescreen"), on top of
# bob_build.py (run that first in the same namespace). The laser cuts the circle alone, the glass opens, the compass
# rises and the camera pushes in to the home: 150 frames, 6.25 s at 24 fps. The B letters exist (bob_reveal_b.py
# brings them in on the scroll) but are not drawn here. Every animated value is baked per frame with linear keys.
# Derived from tools/blender/bob_animate.py: the same probe, easings and home; new frame numbers and the wide shot.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

sc = bpy.data.scenes["BOB_previs"]
F_END = 150
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


# ---------------------------------------------------------------- the one stroke: the circle
circle = circle_pts(CIRCLE_R)
CIRCLE_F0, CIRCLE_F1 = 26, 74          # 2 s, the same speed as the old loader's circle
STROKES = [("bob_circle", circle, CIRCLE_F0, CIRCLE_F1)]
B_CURVES = ["bob_B_left", "bob_B_left_bar", "bob_B_right", "bob_B_right_bar"]
CUT_Z, LIFT = 0.012, 0.35

# ---------------------------------------------------------------- laser probe (as bob_animate.py)
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
    """(x, y, z, cutting) for frame f: down onto the circle, round it once, up and away."""
    first = Vector(path_point(circle, 0))
    if f < CIRCLE_F0:
        t = ease_out(span(f, 1, CIRCLE_F0))
        return first.x, first.y, lerp(6.0, CUT_Z, t), False
    if f <= CIRCLE_F1:
        p = path_point(circle, span(f, CIRCLE_F0, CIRCLE_F1))
        return p.x, p.y, CUT_Z, True
    end = path_point(circle, 1.0)
    t = ease_in(span(f, CIRCLE_F1, CIRCLE_F1 + 20))
    return end.x, end.y, lerp(CUT_Z, 7.5, t), False


# ---------------------------------------------------------------- camera: a closer wide shot (only the O to frame)
cam = sc.camera
cam.data.dof.focus_object = None
WIDE = dict(dist=11.2, elev=19.0, tz=0.1)
HOME = dict(dist=HOME_DIST, elev=HOME_ELEV, tz=ARM_Z)
PUSH_F0, PUSH_F1 = 80, 140


def cam_state(f):
    t = ease_io(span(f, PUSH_F0, PUSH_F1))
    drift = 0.3 * (1 - span(f, 1, PUSH_F0))  # slow dolly while engraving
    d = lerp(WIDE["dist"] + drift, HOME["dist"], t)
    e = lerp(WIDE["elev"], HOME["elev"], t)
    tz = lerp(WIDE["tz"], HOME["tz"], t)
    loc = Vector((0, -d * math.cos(math.radians(e)), tz + d * math.sin(math.radians(e))))
    return loc, Vector((0, 0, tz)), d


# ---------------------------------------------------------------- materials and lights to animate
def emit_input(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Emission Strength']

trace_in = emit_input(M_TRACE)
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

circle_cu = sc.objects["bob_circle"].data
ticks_ob, outer_ob = sc.objects["bob_ticks"], sc.objects["bob_outer_circle"]
ticks_cu, outer_cu = ticks_ob.data, outer_ob.data

# The B letters are not drawn in the loader or at home: no geometry until the scroll brings them in.
for name in B_CURVES:
    cu = sc.objects[name].data
    for f in (1, 300):
        cu.bevel_factor_end = 0.0
        cu.keyframe_insert("bevel_factor_end", frame=f)

for f in range(1, F_END + 1):
    circle_cu.bevel_factor_end = span(f, CIRCLE_F0, CIRCLE_F1)
    circle_cu.keyframe_insert("bevel_factor_end", frame=f)
    x, y, z, cutting = probe_state(f)
    probe.location = (x, y, z)
    probe.keyframe_insert("location", frame=f)
    tl.energy = 35.0 if cutting else 0.0
    tl.keyframe_insert("energy", frame=f)
    tip_in.default_value = 40.0 if cutting else 2.0
    tip_in.keyframe_insert("default_value", frame=f)
    loc, tgt, dist = cam_state(f)
    cam.location = loc
    cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_euler", frame=f)
    cam.data.dof.focus_distance = dist
    cam.data.dof.keyframe_insert("focus_distance", frame=f)
    sc.view_settings.exposure = lerp(-7.0, -0.35, ease_out(span(f, 1, 16)))
    sc.view_settings.keyframe_insert("exposure", frame=f)
    smoke_dens.default_value = lerp(0.0, 0.9, ease_io(span(f, 1, 48)))
    smoke_dens.keyframe_insert("default_value", frame=f)
    smoke_noise_w.default_value = f / 300 * 1.4
    smoke_noise_w.keyframe_insert("default_value", frame=f)
    trace_in.default_value = lerp(0.0, 0.09, ease_io(span(f, 4, 36)))
    trace_in.keyframe_insert("default_value", frame=f)
    # once the circle is closed the ticks grow outward and the outer ring draws itself
    ticks_cu.bevel_factor_end = ease_out(span(f, 72, 86))
    ticks_cu.keyframe_insert("bevel_factor_end", frame=f)
    outer_cu.bevel_factor_end = ease_io(span(f, 74, 96))
    outer_cu.keyframe_insert("bevel_factor_end", frame=f)
    ticks_ob.hide_render = f < 72
    ticks_ob.keyframe_insert("hide_render", frame=f)
    outer_ob.hide_render = f < 74
    outer_ob.keyframe_insert("hide_render", frame=f)
    # the glass inside the circle opens like an iris
    s = 1.0 - ease_in(span(f, 80, 96))
    cap.scale = (max(s, 0.001),) * 3
    cap.keyframe_insert("scale", frame=f)
    cap.hide_render = f > 96
    cap.keyframe_insert("hide_render", frame=f)
    lip.hide_render = f < 80
    lip.keyframe_insert("hide_render", frame=f)
    glow_in.default_value = lerp(0.0, 0.5, ease_io(span(f, 78, 104)))
    glow_in.keyframe_insert("default_value", frame=f)
    well_emit.default_value = lerp(0.0, 1.1, ease_io(span(f, 78, 108)))
    well_emit.keyframe_insert("default_value", frame=f)
    well_light.energy = lerp(0.0, 90.0, ease_io(span(f, 78, 104)))
    well_light.keyframe_insert("energy", frame=f)
    key_light.energy = lerp(180.0, 650.0, ease_io(span(f, 82, 132)))
    key_light.keyframe_insert("energy", frame=f)
    # the compass surfaces, each band turning slowly on its own axis
    arm.location = (0, 0, lerp(ARM_LOW, ARM_Z, ease_out(span(f, 88, 140))))
    arm.rotation_euler = (0, 0, math.radians(lerp(-50.0, 0.0, ease_out(span(f, 88, 144)))))
    arm.keyframe_insert("location", frame=f)
    arm.keyframe_insert("rotation_euler", frame=f)
    for k, (r, rest) in enumerate(zip(rings, ring_rest)):
        r.rotation_euler = rest
        spin = math.radians((f - F_END) * (0.25 + 0.1 * k) * (1 if k % 2 else -1))
        r.rotation_euler.rotate_axis('Z', spin)
        r.keyframe_insert("rotation_euler", frame=f)
    # the needle swings in and settles
    t = span(f, 100, F_END)
    swing = 110.0 * math.exp(-4.0 * t) * math.cos(9.0 * t) if f >= 100 else 110.0
    needle.rotation_euler = (0, math.radians(38 + swing), 0)
    needle.keyframe_insert("rotation_euler", frame=f)

# The home holds from here to the scroll (frame 300): the same pose keyed again, so nothing drifts in between.
for f in (F_END, 300):
    sc.frame_set(F_END)
    for ob in (cam, arm, needle, *rings, probe):
        ob.keyframe_insert("location", frame=f)
        ob.keyframe_insert("rotation_euler", frame=f)

prefs.keyframe_new_interpolation_type = old_interp
sc.frame_set(F_END)
result = {"frames": F_END}
