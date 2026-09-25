# Converts the Albert OBJ into models/albert.glb for the web intro.
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python make_albert.py
# The OBJ has no .mtl, so colours are set here. Arms get their pivot at the shoulder (for flapping),
# eyes at their centre (for blinking). The 2x2 slab is dropped: the intro builds its own platforms.
import os
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'models', 'source', 'albert_model_a.obj')
OUT = os.path.join(HERE, '..', 'models', 'albert.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=SRC)

for name in ('slab', 'slab_outline'):
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)

COLORS = {  # material name -> sRGB hex
    'albert_shell': '#f4f1ec',
    'albert_limb': '#d9d4cc',
    'ink': '#151515',
    'stitch': '#9c9289',
    'tag_frame': '#c9c3ba',
    'tag_label': '#dcd8d1',  # the text is painted on at runtime
}
MATERIAL_FOR = {'body': 'albert_shell', 'arm': 'albert_limb', 'leg': 'albert_limb', 'eye': 'ink', 'mouth': 'ink',
                'stitch': 'stitch', 'tag_frame': 'tag_frame', 'tag_label': 'tag_label'}


def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    h = COLORS[name]
    bsdf.inputs['Base Color'].default_value = (*(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)), 1)
    bsdf.inputs['Roughness'].default_value = 0.85
    return m


def set_origin(ob, point):
    bpy.context.scene.cursor.location = point
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')


for ob in list(bpy.data.objects):
    if ob.type != 'MESH':
        continue
    key = next(k for k in MATERIAL_FOR if ob.name.startswith(k))
    ob.data.materials.clear()
    ob.data.materials.append(material(MATERIAL_FOR[key]))
    corners = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    mid = (lo + hi) / 2
    if ob.name.startswith('arm'):
        set_origin(ob, Vector((mid.x, mid.y, hi.z)))  # shoulder (Blender is Z-up)
    elif ob.name.startswith(('eye', 'mouth')):
        set_origin(ob, mid)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True)
print('exported', os.path.abspath(OUT))
