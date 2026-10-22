# The two B letters come in on the scroll (Bob, 2026-10-22: "when its zoomed into the (transition) it then shows the
# 2 B beside it"), on top of bob_build.py, bob_animate_o.py and tools/blender/bob_scroll.py in one namespace. The
# camera rises from the home (frame 300) to look straight down on the name (frame 362); the letters arrive on the
# way, one of two ways, `REVEAL`:
#   'laser': the laser comes back and cuts both B letters quickly, left then right, as the camera rises.
#   'glow':  the letters are already cut into the glass but dark; light runs out of the O into them, from the edge
#            nearest the compass to the far edge.
import bpy, math
from mathutils import Vector

sc = bpy.data.scenes["BOB_previs"]
prefs = bpy.context.preferences.edit
old_interp = prefs.keyframe_new_interpolation_type
prefs.keyframe_new_interpolation_type = 'LINEAR'
B_CURVES = ["bob_B_left", "bob_B_left_bar", "bob_B_right", "bob_B_right_bar"]
R0, R1 = 300, 380

if REVEAL == 'laser':
    B_STROKES = [  # curve, points, first frame, last frame: the scroll's own pace, about twice the loader's
        ("bob_B_left", lb_outline, 320, 336),
        ("bob_B_left_bar", lb_bar, 337, 340),
        ("bob_B_right", rb_outline, 342, 357),
        ("bob_B_right_bar", rb_bar, 358, 361),
    ]
    parked = Vector((*path_point(circle, 1.0), 7.5))

    def laser_state(f):
        first = Vector(path_point(B_STROKES[0][1], 0))
        if f < B_STROKES[0][2]:
            t = ease_out(span(f, R0, B_STROKES[0][2]))
            p = parked.to_2d().lerp(first, t)
            return p.x, p.y, lerp(parked.z, CUT_Z, t), False
        for i, (_, pts, f0, f1) in enumerate(B_STROKES):
            if f0 <= f <= f1:
                p = path_point(pts, span(f, f0, f1))
                return p.x, p.y, CUT_Z, True
            nxt = B_STROKES[i + 1] if i + 1 < len(B_STROKES) else None
            if nxt and f1 < f < nxt[2]:
                a, b = path_point(pts, 1.0), path_point(nxt[1], 0.0)
                t = ease_io(span(f, f1, nxt[2]))
                p = a.lerp(b, t)
                return p.x, p.y, CUT_Z + LIFT * math.sin(math.pi * t), False
        end = path_point(B_STROKES[-1][1], 1.0)
        t = ease_in(span(f, B_STROKES[-1][3], B_STROKES[-1][3] + 16))
        return end.x, end.y, lerp(CUT_Z, 7.5, t), False

    curves = {name: sc.objects[name].data for name, *_ in B_STROKES}
    for f in range(R0 + 1, R1 + 1):
        for name, pts, f0, f1 in B_STROKES:
            curves[name].bevel_factor_end = span(f, f0, f1)
            curves[name].keyframe_insert("bevel_factor_end", frame=f)
        x, y, z, cutting = laser_state(f)
        probe.location = (x, y, z)
        probe.keyframe_insert("location", frame=f)
        tl.energy = 35.0 if cutting else 0.0
        tl.keyframe_insert("energy", frame=f)
        tip_in.default_value = 40.0 if cutting else 2.0
        tip_in.keyframe_insert("default_value", frame=f)

elif REVEAL == 'glow':
    # The letters' material gains a front: transparent beyond it, gold behind it, brightest at it. The front is a
    # distance from the centre line (|x| - 1.9: 0.25 at the letters' inner edges, 2.35 at their outer ones).
    nt = M_LETTER.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    def math_node(op, a=None, b=None, clamp=False):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]
    front = nt.nodes.new('ShaderNodeValue')
    front.name = 'b_front'
    dist = math_node('SUBTRACT', math_node('ABSOLUTE', sep.outputs['X']), 1.9)
    mask = math_node('DIVIDE', math_node('SUBTRACT', front.outputs[0], dist), 0.45, clamp=True)
    edge = math_node('MULTIPLY', math_node('MULTIPLY', mask, math_node('SUBTRACT', 1.0, mask)), 10.0)
    nt.links.new(math_node('ADD', math_node('MULTIPLY', mask, 3.0), edge), bsdf.inputs['Emission Strength'])
    transparent = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mask, mix.inputs['Fac'])
    nt.links.new(transparent.outputs[0], mix.inputs[1])
    nt.links.new(bsdf.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    for name in B_CURVES:
        cu = sc.objects[name].data
        cu.bevel_factor_end = 1.0
        cu.keyframe_insert("bevel_factor_end", frame=R0 + 1)
    for f in range(R0 - 1, R1 + 1):
        front.outputs[0].default_value = lerp(-0.6, 2.9, ease_io(span(f, 318, 358)))
        front.outputs[0].keyframe_insert("default_value", frame=f)
else:
    raise ValueError(REVEAL)

prefs.keyframe_new_interpolation_type = old_interp
