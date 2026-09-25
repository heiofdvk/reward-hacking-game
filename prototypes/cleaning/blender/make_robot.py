# Builds a low-poly robot vacuum and exports it as models/robotVacuum.glb.
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python make_robot.py
# Same scale as the Kenney kit (a desk is ~0.4 tall). Blender is Z-up; the robot's front
# points along +Y, which becomes -Z after the glTF exporter converts to Y-up.
# The side brush is an empty named "SideBrush" so the game can spin it.
import os
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(HERE, '..', 'models', 'robotVacuum.glb')
OUT_BLEND = os.path.join(HERE, 'robot.blend')

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, hex_color, roughness=0.6, emission=0.0):
    m = bpy.data.materials.new(name)
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = (r ** 2.2, g ** 2.2, b ** 2.2, 1)  # sRGB -> linear
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = lin
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = lin
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


SHELL = material('Shell', '#2b2f36', 0.45)
TOP = material('Top', '#d7dbe2', 0.35)
BUMPER = material('Bumper', '#1a1c20', 0.8)
TURRET = material('Turret', '#3b414b', 0.4)
LED = material('Led', '#45ff8a', 0.3, emission=4.0)
BRISTLE = material('Bristle', '#e0b040', 0.9)


def bevel(ob, width, segments=2):
    mod = ob.modifiers.new('Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'


def cylinder(name, radius, depth, z, mat, xy=(0, 0), verts=28, bevel_w=0.004):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=(xy[0], xy[1], z + depth / 2))
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    if bevel_w:
        bevel(ob, bevel_w)
    return ob


def box(name, size, center, mat, parent=None, bevel_w=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if bevel_w:
        bevel(ob, bevel_w)
    if parent:
        ob.parent = parent
    return ob


R = 0.17  # body radius

cylinder('Bumper', R, 0.036, 0.012, BUMPER, bevel_w=0.006)
cylinder('Body', R - 0.006, 0.05, 0.016, SHELL, bevel_w=0.01)
cylinder('TopPlate', R - 0.035, 0.006, 0.064, TOP, bevel_w=0.002)
cylinder('Turret', 0.042, 0.022, 0.066, TURRET, xy=(0, 0.055), verts=20, bevel_w=0.006)
cylinder('Button', 0.022, 0.006, 0.068, SHELL, xy=(0, -0.045), verts=16, bevel_w=0.002)
box('Led', (0.05, 0.012, 0.006), (0, R - 0.03, 0.071), LED, bevel_w=0.002)

# Side brush: three bristles on a spinning pivot at the front-right, just under the rim
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.105, 0.105, 0.006))
brush = bpy.context.active_object
brush.name = 'SideBrush'
for i in range(3):
    b = box(f'Bristle{i}', (0.012, 0.075, 0.004), (0, 0, 0), BRISTLE, parent=brush)
    # shift the mesh so the pivot sits at one end of the bristle, then fan the three out
    for v in b.data.vertices:
        v.co.y += 0.035
    b.rotation_euler[2] = i * 2.094

for ob in bpy.data.objects:
    if ob.type == 'MESH':
        for poly in ob.data.polygons:
            poly.use_smooth = False

os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True)
print('exported', os.path.abspath(OUT_GLB))
