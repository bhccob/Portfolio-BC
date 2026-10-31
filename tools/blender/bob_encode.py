# Encodes a PNG frame folder into an H.264 MP4 through Blender's sequencer.
# blender -b --factory-startup --python bob_encode.py -- <frames_dir> <out.mp4>
import bpy, os, sys

frames_dir, out_path = sys.argv[sys.argv.index("--") + 1:][:2]
files = sorted(f for f in os.listdir(frames_dir) if f.lower().endswith(".png"))

sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, 100
sc.render.fps = 24
sc.frame_start, sc.frame_end = 1, len(files)
sc.view_settings.view_transform = 'Standard'  # frames are already tone-mapped
sed = sc.sequence_editor_create()
strips = sed.strips if hasattr(sed, "strips") else sed.sequences
st = strips.new_image(name="frames", filepath=os.path.join(frames_dir, files[0]), channel=1, frame_start=1)
for f in files[1:]:
    st.elements.append(f)

ims = sc.render.image_settings
try:
    ims.media_type = 'VIDEO'
except Exception:
    # A Blender without media_type: setting FFMPEG below is enough there.
    pass
ims.file_format = 'FFMPEG'
ff = sc.render.ffmpeg
ff.format = 'MPEG4'
ff.codec = 'H264'
ff.constant_rate_factor = 'HIGH'
ff.ffmpeg_preset = 'GOOD'
sc.render.use_sequencer = True
sc.render.filepath = out_path
bpy.ops.render.render(animation=True)
print("ENCODED", out_path, len(files))
