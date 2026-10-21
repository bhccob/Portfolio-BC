# Scroll from home into the projects: frames 301-480, on top of bob_build.py + bob_animate.py
# (run in the same namespace). The rings open like an iris, the camera rises to look straight down
# on BOB, dives through the O and comes out in the void inside the chip, where the projects float.
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, Euler

sc = bpy.data.scenes["BOB_previs"]
REPO = r"C:\Users\bhcco\Downloads\Portfolio-bob"
S0, S_END = 300, 480
sc.frame_end = S_END
prefs = bpy.context.preferences.edit
old_interp = prefs.keyframe_new_interpolation_type
prefs.keyframe_new_interpolation_type = 'LINEAR'

# ---------------------------------------------------------------- the void below the tunnel
CEIL_Z = WELL_BOTTOM


def annulus_down(name, z, r_in, radii, seg=256):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = [[bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)]
             for r in [r_in] + radii]
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((a[i], a[j], b[j], b[i]))  # normal -Z: seen from below
    bm.to_mesh(me)
    bm.free()
    return me

ceiling = link(bpy.data.objects.new("bob_void_ceiling", annulus_down("bob_void_ceiling", CEIL_Z, HOLE_R, [2.5, 4, 7, 12, 20, 35, 60])))
ceiling.data.materials.append(M_GLASS)
M_CEIL_TRACE = mat_gold_emit("bob_ceiling_traces", 0.35)
poly_curve("bob_ceiling_traces", [[(p[0], p[1]) for p in t] for t in traces], 0.006, M_CEIL_TRACE, CEIL_Z - 0.01, res=1)
poly_curve("bob_ceiling_ring", [circle_pts(HOLE_R + 0.05)], 0.02, M_LIP, CEIL_Z - 0.01)

# faint violet fog and a scatter of gold dust
vm = bpy.data.meshes.new("bob_void_fog")
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
bm.to_mesh(vm)
bm.free()
fog = link(bpy.data.objects.new("bob_void_fog", vm))
fog.scale = (70, 70, 28)
fog.location = (0, 8, CEIL_Z - 0.15 - 14)
fm = bpy.data.materials.new("bob_void_fog")
fm.use_nodes = True
fm.node_tree.nodes.clear()
fv = fm.node_tree.nodes.new('ShaderNodeVolumePrincipled')
fv.inputs['Color'].default_value = (0.45, 0.3, 0.9, 1)
fv.inputs['Density'].default_value = 0.012
fv.inputs['Anisotropy'].default_value = 0.2
fo = fm.node_tree.nodes.new('ShaderNodeOutputMaterial')
fm.node_tree.links.new(fv.outputs[0], fo.inputs['Volume'])
fog.data.materials.append(fm)

def dist_to_segment(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length

random.seed(7)
dm = bpy.data.meshes.new("bob_void_dust")
bm = bmesh.new()
placed = 0
while placed < 320:
    c = Vector((random.uniform(-16, 16), random.uniform(-8, 26), random.uniform(-18, CEIL_Z - 0.6)))
    # keep dust off the camera's path, where it would blow up into bokeh
    if dist_to_segment(c, Vector((0, 0, 2.0)), Vector((0, 0, -3.0))) < 2.2 or \
       dist_to_segment(c, Vector((0, 0, -2.6)), Vector((0, -4.0, -5.5))) < 2.2:
        continue
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=random.uniform(0.008, 0.026), matrix=Matrix.Translation(c))
    placed += 1
bm.to_mesh(dm)
bm.free()
dust = link(bpy.data.objects.new("bob_void_dust", dm))
dust.data.materials.append(mat_gold_emit("bob_dust", 3.0, base_metal=False))

# ---------------------------------------------------------------- project beads
def mat_lacquer(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes.new, nt.links.new
    out = N('ShaderNodeOutputMaterial')
    lac = N('ShaderNodeBsdfPrincipled')
    lac.inputs['Roughness'].default_value = 0.28
    lac.inputs['Coat Weight'].default_value = 1.0
    lac.inputs['Coat Roughness'].default_value = 0.04
    tc = N('ShaderNodeTexCoord')
    nz = N('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 2.2
    nz.inputs['Detail'].default_value = 8.0
    nz.inputs['Distortion'].default_value = 2.0
    L(tc.outputs['Object'], nz.inputs['Vector'])
    mix = N('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs[6].default_value = (0.06, 0.015, 0.14, 1)
    mix.inputs[7].default_value = (0.3, 0.1, 0.55, 1)
    L(nz.outputs['Fac'], mix.inputs[0])
    L(mix.outputs[2], lac.inputs['Base Color'])
    vor = N('ShaderNodeTexVoronoi')
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = 3.2
    L(nz.outputs['Color'], vor.inputs['Vector'])
    vein = N('ShaderNodeMath'); vein.operation = 'LESS_THAN'
    vein.inputs[1].default_value = 0.018
    L(vor.outputs['Distance'], vein.inputs[0])
    gold = N('ShaderNodeBsdfPrincipled')
    gold.inputs['Base Color'].default_value = (*GOLD, 1)
    gold.inputs['Metallic'].default_value = 1.0
    gold.inputs['Roughness'].default_value = 0.25
    gold.inputs['Emission Color'].default_value = (*GOLD_EMIT, 1)
    gold.inputs['Emission Strength'].default_value = 0.5
    ms = N('ShaderNodeMixShader')
    L(vein.outputs[0], ms.inputs['Fac'])
    L(lac.outputs[0], ms.inputs[1])
    L(gold.outputs[0], ms.inputs[2])
    L(ms.outputs[0], out.inputs['Surface'])
    return m


def mat_screen(name, img_path):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0, 0, 0, 1)
    b.inputs['Roughness'].default_value = 0.3
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(img_path, check_existing=True)
    tex.extension = 'CLIP'
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
    level = nt.nodes.new('ShaderNodeValue'); level.name = "screen_level"
    level.outputs[0].default_value = 0.55
    nt.links.new(level.outputs[0], b.inputs['Emission Strength'])
    return m, tex.image


def screen_mesh(name, r, aspect, v_center, bulge=0.12, rings=24, seg=64):
    """Domed disk facing local -Y, UVs cropped from an image of the given aspect (w/h)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new()
    Rc = (r * r + bulge * bulge) / (2 * bulge)
    center = bm.verts.new((0, -bulge, 0))
    grid = []
    for k in range(1, rings + 1):
        rr = r * k / rings
        dy = Rc - math.sqrt(Rc * Rc - rr * rr)
        grid.append([bm.verts.new((rr * math.cos(2 * math.pi * i / seg), -bulge + dy, rr * math.sin(2 * math.pi * i / seg))) for i in range(seg)])

    def uv(v):
        x, zv = v.co.x, v.co.z
        if aspect < 1:   # portrait: width fills the circle
            return (0.5 + x / (2 * r), v_center + zv * aspect / (2 * r))
        return (0.5 + x / (2 * r * aspect), v_center + zv / (2 * r))

    for i in range(seg):
        j = (i + 1) % seg
        f = bm.faces.new((center, grid[0][j], grid[0][i]))
        for lp in f.loops:
            lp[uv_layer].uv = uv(lp.vert)
        for k in range(rings - 1):
            f = bm.faces.new((grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i]))
            for lp in f.loops:
                lp[uv_layer].uv = uv(lp.vert)
    bm.normal_update()
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    if me.polygons[0].normal.y > 0:
        me.flip_normals()
    return me

M_BEAD_GOLD = mat_gold_emit("bob_bead_gold", 0.2)
PROJECTS = [  # name, image, world position, screen v centre
    ("funcial", os.path.join(REPO, r".superpowers\brainstorm\58680-1792519498\content\g-funcial-app-home.webp"), (1.2, 3.6, -6.9), 0.7),
    ("jontai", os.path.join(REPO, r"src\assets\jontai-energy.png"), (-5.0, 9.5, -5.7), 0.5),
    ("cookies", os.path.join(REPO, r"src\assets\cookies.png"), (5.4, 13.0, -8.7), 0.5),
]
FINAL_CAM = Vector((0.0, -4.0, -5.5))
beads = []
for idx, (pname, img_path, pos, vcen) in enumerate(PROJECTS):
    root = link(bpy.data.objects.new(f"bob_bead_{pname}", None))
    root.location = pos
    root.empty_display_size = 1.0
    look = (FINAL_CAM - Vector(pos)).normalized()
    root.rotation_euler = (-look).to_track_quat('Y', 'Z').to_euler()  # local -Y faces the camera
    sm = bpy.data.meshes.new(f"bob_bead_{pname}_shell")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=0.95)
    # open the porthole: drop the shell faces in front of the screen
    cut = [f for f in bm.faces if f.calc_center_median().y < 0 and math.hypot(f.calc_center_median().x, f.calc_center_median().z) < 0.6]
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(sm)
    bm.free()
    shell = link(bpy.data.objects.new(f"bob_bead_{pname}_shell", sm))
    shell.data.materials.append(mat_lacquer(f"bob_lacquer_{pname}"))
    shell.parent = root
    rim_y = -math.sqrt(0.95 ** 2 - 0.6 ** 2)
    rim = poly_curve(f"bob_bead_{pname}_rim", [[(0.6 * math.cos(2 * math.pi * i / 128), 0, 0.6 * math.sin(2 * math.pi * i / 128)) for i in range(129)]],
                     0.07, M_BEAD_GOLD, res=3)
    rim.parent = root
    rim.location = (0, rim_y, 0)
    bezel = poly_curve(f"bob_bead_{pname}_bezel", [[(0.53 * math.cos(2 * math.pi * i / 128), 0, 0.53 * math.sin(2 * math.pi * i / 128)) for i in range(129)]],
                       0.022, M_BEAD_GOLD, res=2)
    bezel.parent = root
    bezel.location = (0, rim_y + 0.05, 0)
    mat, img = mat_screen(f"bob_screen_{pname}", img_path)
    aspect = img.size[0] / max(img.size[1], 1)
    scr = link(bpy.data.objects.new(f"bob_bead_{pname}_screen", screen_mesh(f"bob_bead_{pname}_screen", 0.53, aspect, vcen)))
    scr.data.materials.append(mat)
    scr.parent = root
    scr.location = (0, rim_y + 0.16, 0)
    halo = link(bpy.data.objects.new(f"bob_bead_{pname}_halo", band_mesh(f"bob_bead_{pname}_halo", 0.975, 0.07, t=0.02, seg=192)))
    halo.data.materials.append(M_BEAD_GOLD)
    halo.parent = root
    halo.rotation_euler = (math.radians(90), 0, 0)
    beads.append((root, mat))

# void lighting
ld = bpy.data.lights.new("bob_void_fill", 'AREA')
ld.shape, ld.size, ld.energy, ld.color, ld.specular_factor = 'DISK', 24, 600, VIOLET, 0.4
vf = link(bpy.data.objects.new("bob_void_fill", ld))
vf.location = (0, 8, -22)
look_at(vf, (0, 8, -6))
kd = bpy.data.lights.new("bob_bead_key", 'AREA')
kd.shape, kd.size, kd.energy, kd.color = 'DISK', 2.0, 0.0, (1.0, 0.75, 0.48)
bead_key = link(bpy.data.objects.new("bob_bead_key", kd))
bead_key.location = (-2.4, -1.5, -3.6)

# ---------------------------------------------------------------- scroll keys
rings = [sc.objects[f"bob_ring_{i + 1}"] for i in range(4)]
ring_home = [Euler([math.radians(a) for a in rot]) for _, _, rot in RINGS]
IRIS_R = [1.66, 1.74, 1.82, 1.9]
arm = sc.objects["bob_armillary"]
needle = sc.objects["bob_needle"]
pivot = sc.objects["bob_pivot"]
cam = sc.camera
funcial_root, funcial_mat = beads[0]
f_start, f_end = Vector(PROJECTS[0][2]), Vector(PROJECTS[0][2]) + Vector((-0.4, -1.4, 0.4))
TOP_D = 12.6
OVER_LOC, OVER_TGT = Vector((0.0, -5.5, -4.4)), Vector((0.0, 9.0, -7.2))
ARM_FLAT_Z = 0.09


def cam_pose(f):
    """location, euler, focus distance, lens."""
    if f <= 372:
        t = ease_io(span(f, S0, 362))
        e = lerp(HOME_ELEV, 90.0, t)
        d = lerp(HOME_DIST, TOP_D, t)
        tz = lerp(ARM_Z, 0.0, t)
        loc = Vector((0, -d * math.cos(math.radians(e)), tz + d * math.sin(math.radians(e))))
        return loc, Euler((math.radians(90 - e), 0, 0)), d, 50.0
    if f <= 420:
        t = ease_io(span(f, 372, 420))
        z = lerp(TOP_D, -2.6, t)
        return Vector((0, 0, z)), Euler((0, 0, 0)), max(1.5, z + 7.0), lerp(50.0, 32.0, t)
    over_look = (OVER_TGT - OVER_LOC).to_track_quat('-Z', 'Y').to_euler()
    if f <= 442:  # come out of the tunnel and look across the void: all projects in view
        t = ease_io(span(f, 420, 442))
        loc = Vector((0, 0, -2.6)).lerp(OVER_LOC, t)
        eul = Euler((lerp(0.0, over_look.x, t), lerp(0.0, over_look.y, t), lerp(0.0, over_look.z, t)))
        return loc, eul, lerp(4.4, (OVER_TGT - OVER_LOC).length * 0.6, t), lerp(32.0, 30.0, t)
    t = ease_io(span(f, 446, 472))  # glide to the first project
    look = (f_end - FINAL_CAM).to_track_quat('-Z', 'Y').to_euler()
    loc = OVER_LOC.lerp(FINAL_CAM, t)
    eul = Euler((lerp(over_look.x, look.x, t), lerp(over_look.y, look.y, t), lerp(over_look.z, look.z, t)))
    return loc, eul, lerp((OVER_TGT - OVER_LOC).length * 0.6, (f_end - FINAL_CAM).length, t), lerp(30.0, 40.0, t)


prev_eul = None
key_l = sc.objects["bob_key_rim"].data
for f in range(S0 + 1, S_END + 1):
    # iris: the rings swing flat and slide out to the rim of the opening
    t_iris = ease_io(span(f, S0, 346))
    for k, r in enumerate(rings):
        home = ring_home[k]
        r.rotation_euler = Euler((lerp(home.x, 0.0, t_iris), lerp(home.y, 0.0, t_iris), lerp(home.z, k * 0.4, t_iris)))
        s = lerp(1.0, IRIS_R[k] / RINGS[k][0], t_iris)
        r.scale = (s, s, 1.0)
        r.keyframe_insert("rotation_euler", frame=f)
        r.keyframe_insert("scale", frame=f)
    arm.location = (0, 0, lerp(ARM_Z, ARM_FLAT_Z, t_iris))
    arm.rotation_euler = (0, 0, 0)
    arm.keyframe_insert("location", frame=f)
    arm.keyframe_insert("rotation_euler", frame=f)
    # needle: turns to point down, sinks into the tunnel, leads the dive, then points at the first project
    t_turn = ease_io(span(f, S0, 340))
    nz = lerp(0.0, -1.0, ease_io(span(f, 330, 362)))
    nz = lerp(nz, -9.5, ease_io(span(f, 376, 424)))
    nloc = Vector((0, 0, nz)).lerp(Vector((-1.4, 0.8, -7.9)), ease_io(span(f, 424, 466)))
    rot_down = Euler((lerp(0.0, math.pi, t_turn), lerp(math.radians(38), 0.0, t_turn), 0))
    n_world = Vector((0, 0, ARM_FLAT_Z)) + nloc
    aim = (f_end - n_world).normalized()
    q_aim = Vector((0, 0, 1)).rotation_difference(aim)
    t_aim = ease_io(span(f, 424, 466))
    q = rot_down.to_quaternion().slerp(q_aim, t_aim)
    prev_eul = q.to_euler('XYZ', prev_eul) if f > S0 + 1 else q.to_euler('XYZ', needle.rotation_euler)
    needle.rotation_euler = prev_eul
    needle.location = nloc
    sc_n = lerp(1.0, 1.9, ease_io(span(f, 400, 450)))
    needle.scale = (sc_n,) * 3
    needle.keyframe_insert("rotation_euler", frame=f)
    needle.keyframe_insert("location", frame=f)
    needle.keyframe_insert("scale", frame=f)
    pivot.location = nloc
    pivot.scale = (sc_n,) * 3
    pivot.keyframe_insert("location", frame=f)
    pivot.keyframe_insert("scale", frame=f)
    # camera
    loc, eul, focus, lens = cam_pose(f)
    cam.location = loc
    cam.rotation_euler = eul
    cam.data.lens = lens
    cam.data.dof.focus_distance = focus
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_euler", frame=f)
    cam.data.keyframe_insert("lens", frame=f)
    cam.data.dof.keyframe_insert("focus_distance", frame=f)
    # the first project drifts closer and lights up
    t_sel = ease_io(span(f, 448, 476))
    funcial_root.location = f_start.lerp(f_end, t_sel)
    funcial_root.keyframe_insert("location", frame=f)
    lvl = funcial_mat.node_tree.nodes["screen_level"].outputs[0]
    lvl.default_value = lerp(0.55, 0.9, t_sel)
    lvl.keyframe_insert("default_value", frame=f)
    kd.energy = lerp(0.0, 260.0, t_sel)
    kd.keyframe_insert("energy", frame=f)
    # the key light's mirror image would enter the frame once the camera rises
    t_key = ease_io(span(f, S0, 330))
    key_l.specular_factor = lerp(1.0, 0.0, t_key)
    key_l.energy = lerp(650.0, 300.0, t_key)
    key_l.keyframe_insert("specular_factor", frame=f)
    key_l.keyframe_insert("energy", frame=f)

prefs.keyframe_new_interpolation_type = old_interp
look_at(bead_key, tuple(f_end))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "bob-previs.blend"))
result = {"scroll_frames": [S0 + 1, S_END], "beads": [p[0] for p in PROJECTS]}
