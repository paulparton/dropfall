"""Run with UnrealEditor -run=pythonscript -script=... in the Arena project."""
import unreal
from pathlib import Path

root = Path(__file__).resolve().parent
tools = unreal.AssetToolsHelpers.get_asset_tools()
path = '/Game/Arena/Materials/M_ArenaSurface'
mat = unreal.load_asset(path)
if not mat:
    mat = tools.create_asset('M_ArenaSurface', '/Game/Arena/Materials', unreal.Material, unreal.MaterialFactoryNew())
    lib = unreal.MaterialEditingLibrary
    color = lib.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, -600, 0)
    color.set_editor_property('parameter_name', 'Color')
    color.set_editor_property('default_value', unreal.LinearColor(.2, .25, .3, 1))
    lib.connect_material_property(color, '', unreal.MaterialProperty.MP_BASE_COLOR)
    params = {}
    for name, default, prop in [('Metallic', .45, unreal.MaterialProperty.MP_METALLIC), ('Roughness', .42, unreal.MaterialProperty.MP_ROUGHNESS), ('Glow', 0, None)]:
        node = lib.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -600, 180+len(params)*120)
        node.set_editor_property('parameter_name', name)
        node.set_editor_property('default_value', default)
        if prop is not None: lib.connect_material_property(node, '', prop)
        params[name] = node
    multiply = lib.create_material_expression(mat, unreal.MaterialExpressionMultiply, -200, 400)
    lib.connect_material_expressions(color, '', multiply, 'A')
    lib.connect_material_expressions(params['Glow'], '', multiply, 'B')
    lib.connect_material_property(multiply, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    lib.recompile_material(mat)
unreal.EditorAssetLibrary.save_loaded_asset(mat)

for name in ['SM_ForgeSphere', 'SM_TurbineSphere', 'SM_OrbitSphere']:
    task = unreal.AssetImportTask()
    task.filename = str(root / (name + '.fbx'))
    task.destination_path = '/Game/Arena/Meshes'
    task.destination_name = name
    task.automated = True
    task.replace_existing = True
    task.save = True
    options = unreal.FbxImportUI()
    options.import_mesh = True
    options.import_materials = False
    options.import_textures = False
    options.import_as_skeletal = False
    options.mesh_type_to_import = unreal.FBXImportType.FBXIT_STATIC_MESH
    options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.auto_generate_collision = False
    task.options = options
    tools.import_asset_tasks([task])
    mesh = unreal.load_asset('/Game/Arena/Meshes/' + name)
    assert mesh, name
    bounds = mesh.get_bounds()
    assert 47 < bounds.box_extent.x < 54, str(bounds)
    slots = mesh.get_editor_property('static_materials')
    assert {str(s.material_slot_name) for s in slots} == {'Team', 'Shell'}, str(slots)
    for i in range(len(slots)): mesh.set_material(i, mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
    unreal.log('ARENA_ASSET_OK ' + name + ' ' + str(bounds.box_extent))
