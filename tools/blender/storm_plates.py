# Renders the storm's plates from real volume clouds, moonlit (round 8, spec 2026-10-30-bob-moonlit-3d-design.md: Bob
# picked "B · moonlit storm" from test renders of the site's own compass in Cycles volumes). Each plate is a panorama
# from where the compass stands, in the sky's mapping (src/engine/bob/build/storm.ts):
#   u 0..1  azimuth -112.5..+112.5 degrees from straight behind the compass (three's -z) toward +x;
#   v 0..1  elevation -0.32..0.48 rad (wall, bank, wall-flash, bank-flash) or -0.48..0.32 rad (sea).
# Run headless, from the repository root:
#   blender -b --factory-startup --python tools/blender/storm_plates.py -- <plate> <out.png> [samples] [scale%] [marker]
# <plate> is wall | sea | bank | wall-flash | bank-flash; `marker` adds a small glowing cube at three's (+30, 4, -30), to
# check the panorama's orientation (it must land right of the middle, above the horizon).
# Blender's axes: three's (x, y, z) is Blender's (x, -z, y); the compass stands at the origin, the camera 1 m up.
import bpy, math, sys

args = sys.argv[sys.argv.index("--") + 1:]
PLATE, OUT = args[0], args[1]
SAMPLES = int(args[2]) if len(args) > 2 else 256
SCALE = int(args[3]) if len(args) > 3 else 100
MARKER = len(args) > 4 and args[4] == "marker"
assert PLATE in ("wall", "sea", "bank", "wall-flash", "bank-flash"), PLATE
FLASH = PLATE.endswith("-flash")
KIND = PLATE.replace("-flash", "")

# ---------------------------------------------------------------- the B render's look
CLOUD = (0.46, 0.36, 0.78, 1)
GLOW = (1.0, 0.5, 0.16, 1)
MOON = (1.6, 2.6, 0.9)          # the moon behind the storm and the one to its side (the B render's), and a soft front one
LON = math.radians(112.5)
LAT = {"wall": (-0.32, 0.48), "bank": (-0.32, 0.48), "sea": (-0.48, 0.32)}[KIND]
SIZE = (2688, 1152)
# Seven places the lightning may glow, across the arc (three's azimuths, degrees), and how deep in the storm.
FLASH_AZ = (-90, -60, -30, 0, 30, 60, 90)
FLASH_AT = {"wall": (45.0, 9.0), "bank": (38.0, 6.0)}   # (distance from the compass, height), m
FLASH_R, FLASH_K = 5.0, (1.0, 0.9)

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
sc = bpy.context.scene


def nodes_of(m):
    m.use_nodes = True
    t = m.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    return t, t.nodes.new('ShaderNodeOutputMaterial')


def math_node(t, op, a, b=None):
    n = t.nodes.new('ShaderNodeMath')
    n.operation = op
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            t.links.new(x, n.inputs[i])
    return n.outputs[0]


def storm_material(name, seed, scale, cover, dens, radial, flashes=(), mass=None):
    """The B render's cloud: world-space noise carved into billows, faded at the box's walls, cleared round the compass
    within `radial` (r0, r1: clear inside r0, whole past r1; and, if given, gone again past r2 > r1 at r3), and glowing
    gold round each flash (only in the flash plates). `mass` is the scale of a broad noise that breaks the storm into
    separate towering masses with sky between them."""
    m = bpy.data.materials.new(name)
    t, out = nodes_of(m)
    v = t.nodes.new('ShaderNodeVolumePrincipled')
    v.inputs['Color'].default_value = CLOUD
    v.inputs['Anisotropy'].default_value = 0.35
    geo = t.nodes.new('ShaderNodeNewGeometry')
    mp = t.nodes.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (seed, seed * 0.7, 0)
    mp.inputs['Scale'].default_value = (scale, scale, scale * 1.6)
    nz = t.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Detail'].default_value = 15
    nz.inputs['Roughness'].default_value = 0.68
    nz.inputs['Distortion'].default_value = 0.35
    t.links.new(geo.outputs['Position'], mp.inputs['Vector'])
    t.links.new(mp.outputs[0], nz.inputs['Vector'])
    carve = t.nodes.new('ShaderNodeMapRange')
    carve.inputs['From Min'].default_value = cover
    carve.inputs['From Max'].default_value = cover + 0.07
    carve.inputs['To Max'].default_value = dens * 2.5
    t.links.new(nz.outputs['Fac'], carve.inputs['Value'])
    density = carve.outputs[0]
    if mass is not None:
        mp2 = t.nodes.new('ShaderNodeMapping')
        mp2.inputs['Location'].default_value = (seed * 3.0, -seed, seed * 0.5)
        mp2.inputs['Scale'].default_value = (mass, mass, mass * 0.7)
        nz2 = t.nodes.new('ShaderNodeTexNoise')
        nz2.inputs['Detail'].default_value = 2
        nz2.inputs['Roughness'].default_value = 0.5
        t.links.new(geo.outputs['Position'], mp2.inputs['Vector'])
        t.links.new(mp2.outputs[0], nz2.inputs['Vector'])
        masses = t.nodes.new('ShaderNodeMapRange')
        masses.interpolation_type = 'SMOOTHSTEP'
        masses.inputs['From Min'].default_value = 0.44
        masses.inputs['From Max'].default_value = 0.6
        t.links.new(nz2.outputs['Fac'], masses.inputs['Value'])
        density = math_node(t, 'MULTIPLY', density, masses.outputs[0])
    # Fade toward the box's walls, so no edge shows.
    tc = t.nodes.new('ShaderNodeTexCoord')
    sep = t.nodes.new('ShaderNodeSeparateXYZ')
    t.links.new(tc.outputs['Generated'], sep.inputs[0])
    for axis in ('X', 'Y', 'Z'):
        e = math_node(t, 'PINGPONG', sep.outputs[axis], 0.5)
        s = t.nodes.new('ShaderNodeMapRange')
        s.inputs['From Max'].default_value = 0.18
        s.interpolation_type = 'SMOOTHSTEP'
        t.links.new(e, s.inputs['Value'])
        density = math_node(t, 'MULTIPLY', density, s.outputs[0])
    # Round the compass: clear near it, and (for the bank) gone again far out.
    pos = t.nodes.new('ShaderNodeSeparateXYZ')
    t.links.new(geo.outputs['Position'], pos.inputs[0])
    flat = t.nodes.new('ShaderNodeCombineXYZ')
    t.links.new(pos.outputs['X'], flat.inputs['X'])
    t.links.new(pos.outputs['Y'], flat.inputs['Y'])
    rr = t.nodes.new('ShaderNodeVectorMath')
    rr.operation = 'LENGTH'
    t.links.new(flat.outputs[0], rr.inputs[0])
    ramp_in = t.nodes.new('ShaderNodeMapRange')
    ramp_in.interpolation_type = 'SMOOTHSTEP'
    ramp_in.inputs['From Min'].default_value = radial[0]
    ramp_in.inputs['From Max'].default_value = radial[1]
    t.links.new(rr.outputs['Value'], ramp_in.inputs['Value'])
    density = math_node(t, 'MULTIPLY', density, ramp_in.outputs[0])
    if len(radial) == 4:
        ramp_out = t.nodes.new('ShaderNodeMapRange')
        ramp_out.interpolation_type = 'SMOOTHSTEP'
        ramp_out.inputs['From Min'].default_value = radial[2]
        ramp_out.inputs['From Max'].default_value = radial[3]
        ramp_out.inputs['To Min'].default_value = 1.0
        ramp_out.inputs['To Max'].default_value = 0.0
        t.links.new(rr.outputs['Value'], ramp_out.inputs['Value'])
        density = math_node(t, 'MULTIPLY', density, ramp_out.outputs[0])
    t.links.new(density, v.inputs['Density'])
    # The lightning: a soft gold glow round each flash, only where there is cloud.
    glow = None
    for c in flashes:
        dist = t.nodes.new('ShaderNodeVectorMath')
        dist.operation = 'DISTANCE'
        dist.inputs[1].default_value = c
        t.links.new(geo.outputs['Position'], dist.inputs[0])
        q = math_node(t, 'DIVIDE', dist.outputs['Value'], FLASH_R)
        sq = math_node(t, 'MULTIPLY', q, q)
        ex = math_node(t, 'EXPONENT', math_node(t, 'MULTIPLY', sq, -FLASH_K[0]))
        one = math_node(t, 'MULTIPLY', ex, FLASH_K[1])
        glow = one if glow is None else math_node(t, 'ADD', glow, one)
    if glow is not None:
        v.inputs['Emission Color'].default_value = GLOW
        t.links.new(math_node(t, 'MULTIPLY', glow, density), v.inputs['Emission Strength'])
    t.links.new(v.outputs[0], out.inputs['Volume'])
    return m


def box(name, centre, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    ob.data.materials.append(mat)
    return ob


def flash_sites(kind):
    if not FLASH:
        return ()
    r, h = FLASH_AT[kind]
    # Three's azimuth a (from -z toward +x) is Blender's direction (sin a, cos a, 0).
    return [(r * math.sin(math.radians(a)), r * math.cos(math.radians(a)), 1.0 + h) for a in FLASH_AZ]


if KIND == "wall":
    # A ring of storm round the compass, 24 to 95 m out, from just under the horizon to 30 m up; a far layer behind.
    box("storm:wall", (0, 0, 14), (200, 200, 32), storm_material("storm:wall", 1.9, 0.06, 0.5, 0.9, (24.0, 30.0), flash_sites("wall"), mass=0.025))
    box("storm:far", (0, 0, 22), (300, 300, 40), storm_material("storm:far", 7.7, 0.03, 0.5, 0.45, (90.0, 110.0)))
elif KIND == "sea":
    # A slab of storm 2 to 22 m under the camera, clear right under it.
    box("storm:sea", (0, 0, -11), (220, 220, 18), storm_material("storm:sea", 3.1, 0.05, 0.5, 0.7, (6.0, 12.0), mass=0.03))
else:
    # The bank for the flats: one ring 30 to 48 m out, standing from the glass, its towers up to 22 m.
    box("storm:bank", (0, 0, 11), (110, 110, 22), storm_material("storm:bank", 4.4, 0.085, 0.48, 0.9, (30.0, 34.0, 44.0, 48.0), flash_sites("bank"), mass=0.035))

if MARKER:
    bpy.ops.mesh.primitive_cube_add(size=2, location=(30, 30, 1 + 4))
    cube = bpy.context.active_object
    mm = bpy.data.materials.new("marker")
    t, out = nodes_of(mm)
    em = t.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 40
    t.links.new(em.outputs[0], out.inputs['Surface'])
    cube.data.materials.append(mm)


def sun(name, strength, colour, rot, angle):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = strength
    d.color = colour
    d.angle = math.radians(angle)
    ob = bpy.data.objects.new(name, d)
    ob.rotation_euler = [math.radians(a) for a in rot]
    sc.collection.objects.link(ob)


world = bpy.data.worlds.new("storm:world")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
if FLASH:
    bg.inputs[1].default_value = 0.0
else:
    bg.inputs[0].default_value = (0.004, 0.003, 0.009, 1)
    # The moon low behind the storm (its clouds' rims), one to its side, and a soft one from behind the compass, so the
    # faces turned to it show their billows.
    sun("moon", MOON[0], (0.55, 0.5, 1.0), (-75, 0, 0), 4)
    sun("moon:front", MOON[2], (0.5, 0.42, 0.9), (40, 0, 0), 6)
    sun("moon:side", MOON[1], (0.55, 0.45, 1.0), (55, 0, -125), 3)

# ---------------------------------------------------------------- the panorama
cam_d = bpy.data.cameras.new("plate")
cam_d.type = 'PANO'
target = cam_d if hasattr(cam_d, "panorama_type") else cam_d.cycles
target.panorama_type = 'EQUIRECTANGULAR'
target.longitude_min, target.longitude_max = -LON, LON
target.latitude_min, target.latitude_max = LAT
cam_d.clip_end = 1000
cam = bpy.data.objects.new("plate", cam_d)
cam.location = (0, 0, 1)
cam.rotation_euler = (math.radians(90), 0, 0)   # looking along Blender +y, three's -z
sc.collection.objects.link(cam)
sc.camera = cam

r = sc.render
r.engine = 'CYCLES'
r.resolution_x, r.resolution_y = SIZE
r.resolution_percentage = SCALE
r.film_transparent = KIND == "bank"
r.image_settings.color_mode = 'RGBA' if KIND == "bank" else 'RGB'
cy = sc.cycles
cy.samples = SAMPLES
cy.use_denoising = True
cy.volume_bounces = 1
cy.volume_step_rate = 2.0
cy.volume_max_steps = 512
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'OPTIX'
    cy.device = 'GPU'
    cy.denoiser = 'OPTIX'
except Exception as e:  # no GPU: Cycles renders on the CPU, slower, the same picture
    print("storm_plates: gpu", e)
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
# Rendered bright, so 8-bit WebP keeps the dark clouds' gradations; the site's levels (STORM_SKY, STORM.sky) bring it down.
sc.view_settings.exposure = -0.4 if FLASH else 1.2
r.filepath = OUT
bpy.ops.render.render(write_still=True)
print("storm_plates: wrote", PLATE, OUT)
