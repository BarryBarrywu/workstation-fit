from pathlib import Path
import math
import random

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = ROOT / "assets/models/workstation-guide.blend"
GLB_PATH = ROOT / "public/models/workstation-guide.glb"
RENDER_DIR = ROOT / "assets/renders"
TEXTURE_DIR = ROOT / "assets/models/textures"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(
    name,
    color,
    metallic,
    roughness,
    emission=None,
    color_texture=None,
    roughness_texture=None,
    normal_texture=None,
    normal_strength=0.2,
    coat_weight=0.0,
    coat_roughness=0.3,
):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if color_texture:
        texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = color_texture
        mat.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    if roughness_texture:
        texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = roughness_texture
        separate = mat.node_tree.nodes.new("ShaderNodeSeparateColor")
        mat.node_tree.links.new(texture.outputs["Color"], separate.inputs["Color"])
        mat.node_tree.links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    if normal_texture:
        texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = normal_texture
        normal = mat.node_tree.nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = normal_strength
        mat.node_tree.links.new(texture.outputs["Color"], normal.inputs["Color"])
        mat.node_tree.links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    shader.inputs["Coat Weight"].default_value = coat_weight
    shader.inputs["Coat Roughness"].default_value = coat_roughness
    if emission:
        emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        emission_input.default_value = (*emission, 1)
        shader.inputs["Emission Strength"].default_value = 1.2
    return mat


def empty(name, parent=None, location=(0, 0, 0), role=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.06
    obj.parent = parent
    obj.location = location
    if role:
        obj["fit_role"] = role
    return obj


def finish_mesh(obj, mat, parent, role=None):
    obj.data.materials.append(mat)
    obj.parent = parent
    if role:
        obj["fit_role"] = role
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle()
    if mat.name == "Shell_GreyGreen":
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.025)
        bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def shell_texture():
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    path = TEXTURE_DIR / "shell-basecolor.png"
    size = 256
    rng = random.Random(17)
    pixels = []
    for y in range(size):
        for x in range(size):
            broad = (math.sin(x * 0.071) + math.sin(y * 0.053) + math.sin((x + y) * 0.031)) / 3
            grain = rng.uniform(-1, 1)
            fleck = rng.random()
            variation = broad * 0.016 + grain * 0.005
            if fleck > 0.997:
                variation += 0.035
            elif fleck < 0.002:
                variation -= 0.028
            pixels.extend((0.43 + variation, 0.47 + variation, 0.43 + variation * 0.9, 1.0))
    image = bpy.data.images.new("ShellBaseColor", width=size, height=size)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def shell_roughness_texture():
    path = TEXTURE_DIR / "shell-roughness.png"
    size = 256
    rng = random.Random(29)
    pixels = []
    for y in range(size):
        for x in range(size):
            broad = (math.sin(x * 0.047 + 1.3) + math.sin(y * 0.061 + 0.4) + math.sin((x - y) * 0.037)) / 3
            grain = rng.uniform(-1, 1)
            value = 0.49 + broad * 0.065 + grain * 0.03
            pixels.extend((value, value, value, 1.0))
    image = bpy.data.images.new("ShellRoughness", width=size, height=size)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def shell_normal_texture():
    path = TEXTURE_DIR / "shell-normal.png"
    size = 512
    rng = random.Random(43)
    heights = []
    for y in range(size):
        row = []
        for x in range(size):
            broad = (
                math.sin(x * 0.035 + y * 0.019)
                + math.sin(y * 0.043 - x * 0.013)
                + math.sin((x + y) * 0.071) * 0.45
            ) / 2.45
            fine = math.sin(x * 0.31) * math.sin(y * 0.27) * 0.10
            row.append(broad * 0.32 + fine + rng.uniform(-0.09, 0.09))
        heights.append(row)

    pixels = []
    for y in range(size):
        for x in range(size):
            left = heights[y][(x - 1) % size]
            right = heights[y][(x + 1) % size]
            down = heights[(y - 1) % size][x]
            up = heights[(y + 1) % size][x]
            normal = Vector((-(right - left) * 0.75, -(up - down) * 0.75, 1.0)).normalized()
            pixels.extend((normal.x * 0.5 + 0.5, normal.y * 0.5 + 0.5, normal.z * 0.5 + 0.5, 1.0))

    image = bpy.data.images.new("ShellNormal", width=size, height=size)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def rounded_box(name, dimensions, location, radius, mat, parent, role=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Soft bevel", "BEVEL")
    bevel.width = radius
    bevel.segments = 4
    bevel.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish_mesh(obj, mat, parent, role)


def tapered_box(name, bottom, top, depth_bottom, depth_top, height, location, radius, mat, parent, role=None):
    z = height / 2
    vertices = [
        (-bottom / 2, -depth_bottom / 2, -z), (bottom / 2, -depth_bottom / 2, -z),
        (bottom / 2, depth_bottom / 2, -z), (-bottom / 2, depth_bottom / 2, -z),
        (-top / 2, -depth_top / 2, z), (top / 2, -depth_top / 2, z),
        (top / 2, depth_top / 2, z), (-top / 2, depth_top / 2, z),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    bevel = obj.modifiers.new("Soft bevel", "BEVEL")
    bevel.width = radius
    bevel.segments = 4
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish_mesh(obj, mat, parent, role)


def ellipsoid(name, dimensions, location, mat, parent, role=None, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_mesh(obj, mat, parent, role)


def super_shell(name, dimensions, location, mat, parent, role=None, exponent=0.56, bottom_scale=(1, 1), top_scale=(1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    width, depth, height = dimensions

    def signed_power(value):
        return math.copysign(abs(value) ** exponent, value)

    for vertex in obj.data.vertices:
        source = vertex.co.normalized()
        x = signed_power(source.x)
        y = signed_power(source.y)
        z = signed_power(source.z)
        mix = (z + 1) * 0.5
        scale_x = bottom_scale[0] + (top_scale[0] - bottom_scale[0]) * mix
        scale_y = bottom_scale[1] + (top_scale[1] - bottom_scale[1]) * mix
        vertex.co = (x * width * 0.5 * scale_x, y * depth * 0.5 * scale_y, z * height * 0.5)
    return finish_mesh(obj, mat, parent, role)


def cylinder(name, radius, depth, location, rotation, mat, parent, role=None, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    bevel = obj.modifiers.new("Edge bevel", "BEVEL")
    bevel.width = min(radius * 0.16, depth * 0.16)
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish_mesh(obj, mat, parent, role)


def make_arm(side, root, shell, joint, joint_accent):
    suffix = "L" if side > 0 else "R"
    shoulder = empty(f"Shoulder_{suffix}", root, (0.238 * side, 0, 1.43), "shoulder")
    ellipsoid(f"ShoulderShell_{suffix}", (0.13, 0.16, 0.16), (-0.012 * side, 0, -0.02), shell, shoulder, "shoulder_shell")
    super_shell(f"UpperArmShell_{suffix}", (0.105, 0.125, 0.275), (0, 0, -0.165), shell, shoulder, "upper_arm_shell", exponent=0.68, bottom_scale=(0.80, 0.84))

    elbow = empty(f"Elbow_{suffix}", shoulder, (0, 0, -0.305), "elbow")
    cylinder(f"ElbowJoint_{suffix}", 0.038, 0.070, (0, 0, 0), (0, math.pi / 2, 0), joint, elbow)
    cylinder(f"ElbowCap_{suffix}", 0.030, 0.009, (0.039 * side, 0, 0), (0, math.pi / 2, 0), joint_accent, elbow)
    super_shell(f"ForearmShell_{suffix}", (0.118, 0.135, 0.285), (0, 0, -0.148), shell, elbow, "forearm_shell", exponent=0.68, bottom_scale=(0.70, 0.76))

    hand = empty(f"Hand_{suffix}", elbow, (0, 0, -0.305), "hand")
    super_shell(f"HandClamp_{suffix}", (0.10, 0.105, 0.16), (0, 0, -0.06), shell, hand, "hand_clamp", exponent=0.78, bottom_scale=(0.92, 0.92), top_scale=(0.72, 0.74))


def make_leg(side, root, shell, joint, joint_accent, sole):
    suffix = "L" if side > 0 else "R"
    hip = empty(f"Hip_{suffix}", root, (0.11 * side, 0, 0.965), "hip")
    super_shell(f"ThighShell_{suffix}", (0.16, 0.175, 0.365), (0, 0, -0.205), shell, hip, "thigh_shell", exponent=0.68, bottom_scale=(0.70, 0.74), top_scale=(1.0, 1.0))

    knee = empty(f"Knee_{suffix}", hip, (0, 0, -0.425), "knee")
    cylinder(f"KneeJoint_{suffix}", 0.041, 0.072, (0, 0, 0), (0, math.pi / 2, 0), joint, knee)
    cylinder(f"KneeCap_{suffix}", 0.031, 0.009, (0.041 * side, 0, 0), (0, math.pi / 2, 0), joint_accent, knee)
    super_shell(f"CalfShell_{suffix}", (0.135, 0.15, 0.40), (0, 0, -0.210), shell, knee, "calf_shell", exponent=0.70, bottom_scale=(0.68, 0.72), top_scale=(0.94, 0.96))

    ankle = empty(f"Ankle_{suffix}", knee, (0, 0, -0.415), "ankle")
    cylinder(f"AnkleJoint_{suffix}", 0.030, 0.060, (0, 0, 0), (0, math.pi / 2, 0), joint, ankle)
    cylinder(f"AnkleCap_{suffix}", 0.023, 0.008, (0.034 * side, 0, 0), (0, math.pi / 2, 0), joint_accent, ankle)
    super_shell(f"FootShell_{suffix}", (0.16, 0.30, 0.11), (0, -0.065, -0.060), shell, ankle, "foot_shell", exponent=0.66, bottom_scale=(0.96, 0.98), top_scale=(0.82, 0.72))
    rounded_box(f"FootSole_{suffix}", (0.168, 0.305, 0.024), (0, -0.065, -0.122), 0.009, sole, ankle, "foot_sole")


def build_robot():
    shell = material(
        "Shell_GreyGreen",
        (0.43, 0.47, 0.43),
        0.28,
        0.49,
        color_texture=shell_texture(),
        roughness_texture=shell_roughness_texture(),
        normal_texture=shell_normal_texture(),
        normal_strength=0.34,
        coat_weight=0.12,
        coat_roughness=0.36,
    )
    joint = material("Joint_Graphite", (0.035, 0.04, 0.037), 0.68, 0.31, coat_weight=0.12, coat_roughness=0.22)
    joint_accent = material("Joint_Accent", (0.09, 0.105, 0.095), 0.56, 0.29, coat_weight=0.10, coat_roughness=0.24)
    sole = material("Sole_Graphite", (0.045, 0.052, 0.048), 0.30, 0.66)
    shell_accent = material("Shell_Accent", (0.45, 0.49, 0.45), 0.20, 0.62)
    amber = material("Sensor_Amber", (0.88, 0.46, 0.08), 0.1, 0.3, (0.9, 0.30, 0.03))

    root = empty("RobotRoot", location=(0, 0, 0.009), role="robot_root")
    root["design_language"] = "functional_minimalism"
    root["reference_height_m"] = 1.73

    body = empty("Body", root, role="body")
    tapered_box("TorsoShell", 0.31, 0.37, 0.20, 0.225, 0.37, (0, 0, 1.29), 0.06, shell, body, "torso_shell")
    super_shell("PelvisShell", (0.30, 0.205, 0.19), (0, 0, 1.005), shell, body, "pelvis_shell", exponent=0.66, bottom_scale=(0.72, 0.80), top_scale=(1.0, 1.0))
    cylinder("WaistSleeve", 0.118, 0.048, (0, 0, 1.105), (0, 0, 0), joint, body, "waist")

    cylinder("ChestSocket", 0.030, 0.016, (-0.072, -0.119, 1.33), (math.pi / 2, 0, 0), joint, body)
    cylinder("ChestLight", 0.019, 0.021, (-0.072, -0.128, 1.33), (math.pi / 2, 0, 0), amber, body, "chest_light")

    head = empty("Head", root, (0, 0, 1.635), "head")
    cylinder("NeckCore", 0.048, 0.085, (0, 0, -0.118), (0, 0, 0), joint, head, "neck")
    for z in (-0.140, -0.125, -0.110):
        cylinder(f"NeckRing_{abs(int(z * 1000))}", 0.062, 0.022, (0, 0, z), (0, 0, 0), joint, head, "neck")
    super_shell("HeadShell", (0.41, 0.255, 0.225), (0, 0, 0), shell, head, "head_shell", exponent=0.46)
    ellipsoid("HeadSidePanel_R", (0.014, 0.15, 0.125), (-0.201, 0.015, 0), shell_accent, head, "head_panel")
    cylinder("EyeSocket", 0.038, 0.020, (0.085, -0.128, 0.005), (math.pi / 2, 0, 0), joint, head)
    cylinder("EyeSensor", 0.022, 0.025, (0.085, -0.142, 0.005), (math.pi / 2, 0, 0), amber, head, "eye_sensor")

    make_arm(1, root, shell, joint, joint_accent)
    make_arm(-1, root, shell, joint, joint_accent)
    make_leg(1, root, shell, joint, joint_accent, sole)
    make_leg(-1, root, shell, joint, joint_accent, sole)
    return root


def add_preview_scene():
    ground_mat = material("PreviewGround", (0.88, 0.865, 0.83), 0.0, 0.92)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground.data.materials.append(ground_mat)

    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.96, 0.90, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55

    def area(name, energy, size, location):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        look_at(obj, (0, 0, 0.9))

    area("KeyLight", 680, 4.5, (-3.5, -4.0, 5.2))
    area("FillLight", 310, 3.5, (3.2, -1.8, 3.5))
    area("RimLight", 460, 3.0, (0.8, 3.2, 4.0))

    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.lens = 68
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    return camera


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def export_robot(root):
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.object.select_all(action="DESELECT")
    robot_objects = [root, *list(root.children_recursive)]
    for obj in robot_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )


def render_views(camera, root):
    views = {
        "front": ((0, -4.1, 1.08), (0, 0, 0.85)),
        "side": ((4.1, 0, 1.08), (0, 0, 0.85)),
        "rear": ((0, 4.1, 1.08), (0, 0, 0.85)),
        "three-quarter": ((2.8, -3.4, 1.55), (0, 0, 0.88)),
        "material-detail": ((1.15, -2.25, 1.58), (0, 0, 1.38)),
        "feet-detail": ((0.90, -1.80, 0.38), (0, -0.03, 0.24)),
    }
    for name, (position, target) in views.items():
        camera.location = position
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(RENDER_DIR / f"robot-preview-{name}.png")
        bpy.ops.render.render(write_still=True)

    root.location.z = -0.43
    for suffix in ("L", "R"):
        bpy.data.objects[f"Hip_{suffix}"].rotation_euler.x = -math.radians(90)
        bpy.data.objects[f"Knee_{suffix}"].rotation_euler.x = math.radians(90)
        bpy.data.objects[f"Shoulder_{suffix}"].rotation_euler.x = -math.radians(8)
        bpy.data.objects[f"Elbow_{suffix}"].rotation_euler.x = -math.radians(72)

    stool_mat = material("PreviewStool", (0.72, 0.69, 0.63), 0.0, 0.9)
    rounded_box("PreviewStool", (0.58, 0.48, 0.52), (0, 0.25, 0.26), 0.025, stool_mat, None)
    camera.location = (4.1, -0.15, 1.0)
    look_at(camera, (0, -0.10, 0.72))
    bpy.context.scene.render.filepath = str(RENDER_DIR / "robot-preview-seated.png")
    bpy.ops.render.render(write_still=True)


clear_scene()
robot_root = build_robot()
preview_camera = add_preview_scene()
export_robot(robot_root)
render_views(preview_camera, robot_root)
print(f"BLEND={BLEND_PATH}")
print(f"GLB={GLB_PATH}")
