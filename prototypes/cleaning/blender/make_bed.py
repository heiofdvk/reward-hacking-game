# Builds a low-poly single bed and exports it as models/customBed.glb.
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python make_bed.py
# Units match the Kenney kit (a wall is ~1.3 tall, a desk ~0.4). Blender is Z-up; the bed
# runs along Y with the headboard at +Y. The glTF exporter converts to Y-up.
import os
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(HERE, '..', 'models', 'customBed.glb')
OUT_BLEND = os.path.join(HERE, 'bed.blend')

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, hex_color, roughness=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (r ** 2.2, g ** 2.2, b ** 2.2, 1)  # sRGB -> linear
    bsdf.inputs['Roughness'].default_value = roughness
    return m


WOOD = material('Wood', '#b9825a')
WOOD_DARK = material('WoodDark', '#8f5e3e')
SHEET = material('Sheet', '#f2efe8')
BLANKET = material('Blanket', '#4f7cc4')
BLANKET_FOLD = material('BlanketFold', '#e9c46a')
PILLOW = material('Pillow', '#fbf8f2')


def box(name, size, center, mat, bevel=0.01, segments=2):
    """Axis-aligned box: size=(x, y, z), center=(x, y, z), with softened edges."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    ob.data.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
    return ob


W, L = 0.9, 1.6  # outer width and length

# Frame, legs, head and foot boards
box('Frame', (W, L, 0.1), (0, 0, 0.13), WOOD, bevel=0.012)
for sx in (-1, 1):
    for sy in (-1, 1):
        box('Leg', (0.07, 0.07, 0.09), (sx * (W / 2 - 0.05), sy * (L / 2 - 0.05), 0.045), WOOD_DARK, bevel=0.006)
box('Headboard', (W, 0.06, 0.62), (0, L / 2 - 0.03, 0.31), WOOD, bevel=0.02, segments=3)
box('HeadboardPanel', (W - 0.16, 0.02, 0.26), (0, L / 2 - 0.065, 0.42), WOOD_DARK, bevel=0.008)
box('Footboard', (W, 0.05, 0.3), (0, -L / 2 + 0.025, 0.15), WOOD, bevel=0.015, segments=3)

# Mattress with sheet
box('Mattress', (W - 0.08, L - 0.14, 0.12), (0, 0, 0.24), SHEET, bevel=0.03, segments=3)

# Blanket covering the foot two-thirds, draping slightly over the sides, with a folded top edge
blanket_len = 0.95
blanket_y = -L / 2 + 0.07 + blanket_len / 2
box('Blanket', (W - 0.04, blanket_len, 0.1), (0, blanket_y, 0.265), BLANKET, bevel=0.03, segments=3)
box('BlanketFold', (W - 0.03, 0.1, 0.112), (0, blanket_y + blanket_len / 2 - 0.05, 0.27), BLANKET_FOLD, bevel=0.03, segments=3)

# Pillow near the headboard
box('Pillow', (0.58, 0.26, 0.08), (0, L / 2 - 0.22, 0.33), PILLOW, bevel=0.035, segments=4)

# Flat shading keeps the low-poly look of the Kenney models
for ob in bpy.data.objects:
    for poly in ob.data.polygons:
        poly.use_smooth = False

os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True)
print('exported', os.path.abspath(OUT_GLB))
