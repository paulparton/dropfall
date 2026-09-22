"""Original Dropfall cosmetics. Run in a separate factory-startup Blender process.
Metres, Z up, +X forward; FBX -Y forward / Z up. Render geometry only.
The game retains its existing exact spherical physics body for every skin.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1.0
bpy.context.preferences.filepaths.save_version = 0
shell = bpy.data.materials.new('Shell')
shell.diffuse_color = (.18, .22, .25, 1)
team = bpy.data.materials.new('Team')
team.diffuse_color = (.02, .8, 1, 1)

def point(lat, lon, r=.5):
    return (r*math.cos(lat)*math.cos(lon), r*math.cos(lat)*math.sin(lon), r*math.sin(lat))

names = ['SM_ForgeSphere', 'SM_TurbineSphere', 'SM_OrbitSphere']
for theme, name in enumerate(names):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, radius=.477)
    core = bpy.context.object
    core.name = name
    core.data.name = name + '_Core'
    core.data.materials.append(team)
    parts = [core]
    # Individually curved armour plates leave luminous team-colour channels.
    vertices, faces = [], []
    columns = [8, 12, 6][theme]
    rows = [4, 3, 5][theme]
    for row in range(rows):
        for col in range(columns):
            start = len(vertices)
            for v in range(6):
                lat = -math.pi/2 + (row + .07 + .86*v/5)*math.pi/rows
                for u in range(6):
                    lon = (col + .08 + .84*u/5)*2*math.pi/columns
                    if theme == 1: lon += .5*lat
                    if theme == 2: lon += (row % 2)*math.pi/columns
                    vertices.append(point(lat, lon))
            for v in range(5):
                for u in range(5):
                    a = start + v*6 + u
                    faces.append((a, a+1, a+7, a+6))
    mesh = bpy.data.meshes.new(name + '_Panels')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    panels = bpy.data.objects.new(name + '_Armour', mesh)
    bpy.context.collection.objects.link(panels)
    panels.data.materials.append(shell)
    parts.append(panels)
    if theme == 0:
        for lat in [-.7, 0, .7]:
            for col in range(8):
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.018, location=point(lat, (col+.5)*math.pi/4, .499))
                bolt = bpy.context.object
                bolt.data.materials.append(shell)
                parts.append(bolt)
    if theme == 2:
        for angle in [0, math.pi/2]:
            bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=6, major_radius=.498, minor_radius=.009, rotation=(angle, .45, 0))
            ring = bpy.context.object
            ring.data.materials.append(team)
            parts.append(ring)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active = core
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Correct patch winding without relying on hand-authored normals.
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    for face in core.data.polygons: face.use_smooth = True
    assert tuple(core.scale) == (1, 1, 1)
    assert max(core.dimensions) < 1.05
    bpy.ops.export_scene.fbx(filepath=str(root / (name + '.fbx')), use_selection=True,
        object_types={'MESH'}, axis_forward='-Y', axis_up='Z', apply_unit_scale=True,
        use_mesh_modifiers=True, mesh_smooth_type='FACE', add_leaf_bones=False, bake_anim=False)
bpy.ops.wm.save_as_mainfile(filepath=str(root / 'DropfallSpheres.blend'))
# Round trip exports in fresh scenes, checking scale, material contract and geometry.
for name in names:
    scene = bpy.data.scenes.new('Verify_' + name)
    bpy.context.window.scene = scene
    bpy.ops.import_scene.fbx(filepath=str(root / (name + '.fbx')))
    meshes = [o for o in scene.objects if o.type == 'MESH']
    assert len(meshes) == 1
    obj = meshes[0]
    assert .94 < min(obj.dimensions) < 1.05 and max(obj.dimensions) < 1.05
    assert {m.name.split('.')[0] for m in obj.data.materials} == {'Shell', 'Team'}
    assert len(obj.data.uv_layers) == 1
    print('ROUNDTRIP_OK', name, tuple(obj.dimensions), len(obj.data.polygons))
