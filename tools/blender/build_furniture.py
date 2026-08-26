from pathlib import Path
import math

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = ROOT / "assets/models/workstation-furniture.blend"
GLB_PATH = ROOT / "public/models/workstation-furniture.glb"
RENDER_DIR = ROOT / "assets/renders"
WALLPAPER_PATH = ROOT / "assets/models/textures/monitor-wallpaper.png"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if getattr(datablock, "users", 1) == 0:
                datablocks.remove(datablock)


def material(name, color, metallic, roughness, alpha=1.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Coat Weight"].default_value = coat
    if alpha < 1:
        shader.inputs["Alpha"].default_value = alpha
        mat.surface_render_method = "DITHERED"
    return mat


def screen_material():
    mat = material("Furniture_Screen", (0.839, 0.875, 0.792), 0.0, 0.42, coat=0.04)
    image = bpy.data.images.load(str(WALLPAPER_PATH), check_existing=True)
    image.name = "MonitorWallpaper"
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "MonitorWallpaperTexture"
    texture.image = image
    texture.interpolation = "Linear"
    links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    emission = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
    links.new(texture.outputs["Color"], emission)
    shader.inputs["Emission Strength"].default_value = 0.18
    return mat


def map_front_uv(obj):
    uv_layer = obj.data.uv_layers.active or obj.data.uv_layers.new(name="MonitorWallpaperUV")
    minimum_x = min(vertex.co.x for vertex in obj.data.vertices)
    maximum_x = max(vertex.co.x for vertex in obj.data.vertices)
    minimum_z = min(vertex.co.z for vertex in obj.data.vertices)
    maximum_z = max(vertex.co.z for vertex in obj.data.vertices)
    for polygon in obj.data.polygons:
        for loop_index in polygon.loop_indices:
            vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index]
            uv_layer.data[loop_index].uv = (
                (vertex.co.x - minimum_x) / (maximum_x - minimum_x),
                (vertex.co.z - minimum_z) / (maximum_z - minimum_z),
            )


def empty(name, parent=None, location=(0, 0, 0), role=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.04
    obj.parent = parent
    obj.location = location
    if role:
        obj["fit_role"] = role
    return obj


def finish(obj, name, mat, parent=None, location=None, role=None):
    obj.name = name
    obj.data.name = f"{name}Mesh"
    obj.data.materials.append(mat)
    obj.parent = parent
    if location is not None:
        obj.location = location
    if role:
        obj["fit_role"] = role
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth_by_angle()
    obj.select_set(False)
    return obj


def rounded_box(name, size, location, mat, radius=0.015, parent=None, role=None):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Soft edges", "BEVEL")
    bevel.width = min(radius, min(size) * 0.45)
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish(obj, name, mat, parent, location, role)


def cylinder(name, radius, depth, location, mat, parent=None, vertices=20, role=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.object
    bevel = obj.modifiers.new("Soft edges", "BEVEL")
    bevel.width = min(radius * 0.18, 0.008)
    bevel.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish(obj, name, mat, parent, location, role)


def orient_between(obj, start, end):
    start = Vector(start)
    end = Vector(end)
    direction = end - start
    obj.location = (start + end) * 0.5
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())


def solve_elbow(base, target, lower_length, upper_length):
    base = Vector(base)
    target = Vector(target)
    delta = target - base
    horizontal = Vector((delta.x, delta.y, 0))
    horizontal_length = horizontal.length
    reach = max(0.001, delta.length)
    along = (lower_length * lower_length - upper_length * upper_length + reach * reach) / (2 * reach)
    lift = math.sqrt(max(0, lower_length * lower_length - along * along))
    horizontal_direction = horizontal.normalized() if horizontal_length else Vector((1, 0, 0))
    reach_direction = delta / reach
    perpendicular = Vector(
        (
            -horizontal_direction.x * delta.z / reach,
            -horizontal_direction.y * delta.z / reach,
            horizontal_length / reach,
        )
    )
    return base + reach_direction * along + perpendicular * lift


def build_furniture():
    warm_white = material("Furniture_WarmWhite", (0.78, 0.77, 0.72), 0.04, 0.72)
    graphite = material("Furniture_Graphite", (0.12, 0.14, 0.13), 0.58, 0.4, coat=0.08)
    aluminum = material("Furniture_SatinAluminum", (0.62, 0.64, 0.61), 0.72, 0.3, coat=0.12)
    screen = screen_material()
    chair_shell = material("Furniture_ChairShell", (0.30, 0.34, 0.31), 0.12, 0.72)
    chair_mesh = material("Furniture_ChairMesh", (0.32, 0.38, 0.34), 0.05, 0.82, alpha=0.18)
    chair_thread = material("Furniture_ChairThread", (0.27, 0.33, 0.29), 0.04, 0.9)
    seat_fabric = material("Furniture_SeatFabric", (0.40, 0.44, 0.41), 0.02, 0.9)

    root = empty("FurnitureRoot", role="furniture-rig")

    desk = empty("DeskRoot", root, (0, -0.28, 0), "dual-column-desk")
    top = empty("DeskTopAssembly", desk, (0, 0, 0.705), "desk-height")
    rounded_box("DeskTop", (1.20, 0.65, 0.03), (0, 0, 0), warm_white, 0.025, top)
    rounded_box("DeskCrossbar", (1.00, 0.07, 0.08), (0, 0.02, -0.07), graphite, 0.018, top)

    for side, suffix in ((-1, "L"), (1, "R")):
        x = side * 0.48
        rounded_box(f"DeskFoot_{suffix}", (0.09, 0.60, 0.055), (x, 0, 0.0325), graphite, 0.025, desk)
        rounded_box(f"DeskColumnOuter_{suffix}", (0.105, 0.09, 0.48), (x, 0, 0.28), graphite, 0.018, desk)
        rounded_box(f"DeskColumnMiddle_{suffix}", (0.087, 0.073, 0.48), (x, 0, 0.36), aluminum, 0.015, desk, "desk-telescope-middle")
        rounded_box(f"DeskColumnUpper_{suffix}", (0.069, 0.057, 0.48), (x, 0, 0.44), graphite, 0.012, desk, "desk-telescope-upper")

    clamp = rounded_box("MonitorClamp", (0.085, 0.075, 0.18), (0.20, -0.302, 0.71), graphite, 0.018, desk, "monitor-anchor")
    rounded_box("MonitorClampJaw", (0.085, 0.115, 0.025), (0.20, -0.282, 0.615), graphite, 0.01, desk)
    base_point = Vector((0.20, -0.285, 0.78))
    head_point = Vector((0.0, -0.10, 1.015))
    elbow_point = solve_elbow(base_point, head_point, 0.40, 0.40)
    lower_arm = rounded_box("MonitorLowerArm", (0.072, 0.055, 0.40), (0, 0, 0), graphite, 0.026, desk, "monitor-link")
    upper_arm = rounded_box("MonitorUpperArm", (0.066, 0.052, 0.40), (0, 0, 0), graphite, 0.024, desk, "monitor-link")
    orient_between(lower_arm, base_point, elbow_point)
    orient_between(upper_arm, elbow_point, head_point)
    for name, point in (
        ("MonitorPivotBase", base_point),
        ("MonitorPivotElbow", elbow_point),
        ("MonitorPivotHead", head_point),
    ):
        cylinder(name, 0.052, 0.038, point, aluminum, desk, 24, "monitor-pivot")

    monitor_screen = rounded_box(
        "MonitorScreen",
        (0.61, 0.045, 0.36),
        (0, -0.033, 1.015),
        aluminum,
        0.025,
        desk,
        "monitor-screen",
    )
    monitor_panel = rounded_box("MonitorPanel", (0.565, 0.006, 0.315), (0, -0.008, 1.015), screen, 0.012, desk)
    map_front_uv(monitor_panel)
    rounded_box("MonitorVesaMount", (0.115, 0.04, 0.115), (0, -0.075, 1.015), graphite, 0.025, desk)

    chair = empty("ChairRoot", root, (0, 0.288, 0), "ergonomic-chair")
    base = cylinder("ChairBase", 0.085, 0.075, (0, 0, 0.105), graphite, chair, 24)
    for index in range(5):
        angle = math.radians(90 + index * 72)
        arm = rounded_box(
            f"ChairBaseSpoke_{index + 1}",
            (0.31, 0.052, 0.035),
            (math.cos(angle) * 0.155, math.sin(angle) * 0.155, 0.085),
            graphite,
            0.017,
            chair,
        )
        arm.rotation_euler.z = angle
        cylinder(
            f"ChairCasterStem_{index + 1}",
            0.012,
            0.07,
            (math.cos(angle) * 0.30, math.sin(angle) * 0.30, 0.055),
            graphite,
            chair,
            12,
        )
        fork = rounded_box(
            f"ChairCasterFork_{index + 1}",
            (0.06, 0.025, 0.025),
            (math.cos(angle) * 0.325, math.sin(angle) * 0.325, 0.072),
            graphite,
            0.01,
            chair,
        )
        fork.rotation_euler.z = angle
        caster = cylinder(
            f"ChairCaster_{index + 1}",
            0.035,
            0.034,
            (math.cos(angle) * 0.34, math.sin(angle) * 0.34, 0.035),
            graphite,
            chair,
            16,
        )
        caster.rotation_euler = (math.pi / 2, 0, angle)

    cylinder("ChairGasOuter", 0.055, 0.18, (0, 0, 0.165), graphite, chair, 24)
    cylinder("ChairGasMiddle", 0.044, 0.13, (0, 0, 0.27), aluminum, chair, 20, "seat-height-middle")
    cylinder("ChairGasInner", 0.034, 0.14, (0, 0, 0.355), graphite, chair, 20, "seat-height-inner")
    upper = empty("ChairUpper", chair, (0, 0, 0.48), "chair-upper")
    rounded_box("ChairSeat", (0.54, 0.48, 0.085), (0, -0.025, 0), seat_fabric, 0.055, upper)
    rounded_box("ChairSeatShell", (0.50, 0.44, 0.035), (0, -0.005, -0.055), graphite, 0.025, upper)

    back_frame = empty("ChairBackFrame", upper, (0, 0, 0), "chair-back")
    for name, size, location in (
        ("ChairBackRail_L", (0.045, 0.045, 0.62), (-0.235, 0.205, 0.37)),
        ("ChairBackRail_R", (0.045, 0.045, 0.62), (0.235, 0.205, 0.37)),
        ("ChairBackRail_Top", (0.47, 0.045, 0.045), (0, 0.205, 0.67)),
        ("ChairBackRail_Bottom", (0.47, 0.045, 0.045), (0, 0.205, 0.08)),
    ):
        rounded_box(name, size, location, graphite, 0.02, back_frame)
    rounded_box("ChairBackMesh", (0.42, 0.018, 0.54), (0, 0.19, 0.37), chair_mesh, 0.035, back_frame)
    for index in range(11):
        x = -0.18 + index * 0.036
        rounded_box(f"ChairBackThreadV_{index + 1}", (0.0025, 0.008, 0.50), (x, 0.178, 0.37), chair_thread, 0.001, back_frame)
    for index in range(15):
        z = 0.14 + index * 0.033
        rounded_box(f"ChairBackThreadH_{index + 1}", (0.40, 0.008, 0.0025), (0, 0.178, z), chair_thread, 0.001, back_frame)
    rounded_box("ChairLumbar", (0.37, 0.065, 0.13), (0, 0.145, 0.27), chair_shell, 0.05, upper)

    for side, suffix in ((-1, "L"), (1, "R")):
        x = side * 0.335
        rounded_box(f"ChairArmSupport_{suffix}", (0.045, 0.06, 0.22), (x, 0.06, 0.105), graphite, 0.02, upper)
        rounded_box(f"ChairArmrest_{suffix}", (0.075, 0.31, 0.055), (x, -0.02, 0.235), chair_shell, 0.025, upper)

    return root


def setup_render_scene(root):
    floor_mat = material("PreviewFloor", (0.85, 0.84, 0.80), 0.0, 0.9)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.001))
    floor = bpy.context.object
    floor.data.materials.append(floor_mat)

    world = bpy.context.scene.world
    world.color = (0.055, 0.065, 0.06)
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.78, 0.77, 0.72, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55

    bpy.ops.object.light_add(type="AREA", location=(2.6, 2.8, 3.4))
    key = bpy.context.object
    key.data.energy = 650
    key.data.shape = "DISK"
    key.data.size = 3.0
    key.rotation_euler = (math.radians(25), 0, math.radians(140))
    bpy.ops.object.light_add(type="AREA", location=(-2.8, -1.5, 2.2))
    fill = bpy.context.object
    fill.data.energy = 400
    fill.data.size = 2.5

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"

    def aim(point):
        direction = Vector(point) - camera.location
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    views = {
        "furniture-preview-three-quarter.png": ((2.25, 2.65, 1.85), (0, 0, 0.62)),
        "furniture-preview-front.png": ((0, 3.4, 1.35), (0, 0, 0.58)),
        "furniture-preview-side.png": ((2.9, 0.05, 1.35), (0, 0, 0.58)),
        "furniture-preview-rear.png": ((-2.2, -2.65, 1.65), (0, 0, 0.65)),
    }
    for filename, (camera_location, target) in views.items():
        camera.location = camera_location
        aim(target)
        scene.render.filepath = str(RENDER_DIR / filename)
        bpy.ops.render.render(write_still=True)


def export_asset(root):
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_extras=True,
        export_yup=True,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


clear_scene()
furniture_root = build_furniture()
export_asset(furniture_root)
setup_render_scene(furniture_root)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
