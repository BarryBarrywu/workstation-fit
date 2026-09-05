from pathlib import Path
import math
import os
import random

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = ROOT / "assets/models/workstation-guide.blend"
GLB_PATH = ROOT / "public/models/workstation-guide.glb"
RENDER_DIR = Path(os.environ.get("ROBOT_RENDER_DIR", ROOT / "assets/renders"))
TEXTURE_DIR = ROOT / "assets/models/textures"
TEX_SIZE = 512


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for datablock in list(datablocks):
            if getattr(datablock, "users", 1) == 0:
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
    specular_ior=1.45,
    use_vertex_wear=False,
):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    ior_input = shader.inputs.get("IOR") or shader.inputs.get("Specular IOR")
    if ior_input:
        ior_input.default_value = specular_ior

    if color_texture:
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = color_texture
        texture.name = "BaseColorTex"
        texture.extension = "REPEAT"
        color_socket = texture.outputs["Color"]
        if use_vertex_wear:
            attr = nodes.new("ShaderNodeVertexColor")
            attr.layer_name = "PaintWear"
            mix = nodes.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs[0].default_value = 1.0
            links.new(color_socket, mix.inputs[1])
            links.new(attr.outputs["Color"], mix.inputs[2])
            links.new(mix.outputs["Color"], shader.inputs["Base Color"])
        else:
            links.new(color_socket, shader.inputs["Base Color"])

    if roughness_texture:
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = roughness_texture
        texture.name = "RoughnessTex"
        texture.extension = "REPEAT"
        separate = nodes.new("ShaderNodeSeparateColor")
        links.new(texture.outputs["Color"], separate.inputs["Color"])
        links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    if normal_texture:
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = normal_texture
        texture.name = "NormalTex"
        texture.extension = "REPEAT"
        normal = nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = normal_strength
        links.new(texture.outputs["Color"], normal.inputs["Color"])
        links.new(normal.outputs["Normal"], shader.inputs["Normal"])
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


def finish_mesh(obj, mat, parent, role=None, uv_project=True):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.parent = parent
    if role:
        obj["fit_role"] = role
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle()
    if role == "foot_shell":
        for face in obj.data.polygons:
            face.use_smooth = len(face.vertices) == 4
    elif any(len(face.vertices) > 4 for face in obj.data.polygons):
        normal = obj.modifiers.new("Face normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=normal.name)
    if uv_project and mat.name == "Shell_GreyGreen":
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def blank_image(name, path, size=TEX_SIZE, non_color=False, fill=(0.5, 0.5, 0.5, 1.0)):
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    image = bpy.data.images.new(name, width=size, height=size)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    pixels = list(fill) * (size * size)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    return image


def _hash2(x, y, seed):
    n = math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return n - math.floor(n)


def _value_noise(x, y, seed):
    x0 = math.floor(x)
    y0 = math.floor(y)
    fx = x - x0
    fy = y - y0
    ux = fx * fx * (3 - 2 * fx)
    uy = fy * fy * (3 - 2 * fy)
    a = _hash2(x0, y0, seed)
    b = _hash2(x0 + 1, y0, seed)
    c = _hash2(x0, y0 + 1, seed)
    d = _hash2(x0 + 1, y0 + 1, seed)
    return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy


def _fbm(x, y, seed, octaves=4):
    value = 0.0
    amplitude = 0.5
    frequency = 1.0
    for i in range(octaves):
        value += amplitude * _value_noise(x * frequency, y * frequency, seed + i * 17)
        frequency *= 2.0
        amplitude *= 0.5
    return value


def shell_objects(root):
    shells = []
    for obj in [root, *list(root.children_recursive)]:
        if obj.type != "MESH":
            continue
        if not obj.data.materials:
            continue
        if obj.data.materials[0] and obj.data.materials[0].name == "Shell_GreyGreen":
            shells.append(obj)
    return shells


def paint_mesh_wear_attributes(obj):
    """Store true edge curvature + cavity AO in vertex colors (0-1)."""
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    # --- Edge curvature from face-angle at edges, averaged to verts ---
    edge_sharp = {}
    for edge in bm.edges:
        if edge.is_boundary or len(edge.link_faces) < 2:
            edge_sharp[edge.index] = 0.0
            continue
        angle = edge.calc_face_angle(0.0)  # 0 = flat, up to pi
        # High angle = sharp crease / outer edge wear candidate
        edge_sharp[edge.index] = min(1.0, angle / (math.pi * 0.55))

    vert_edge = [0.0] * len(bm.verts)
    vert_edge_w = [0.0] * len(bm.verts)
    for edge in bm.edges:
        s = edge_sharp[edge.index]
        for vert in edge.verts:
            vert_edge[vert.index] += s
            vert_edge_w[vert.index] += 1.0
    for i in range(len(bm.verts)):
        if vert_edge_w[i] > 0:
            vert_edge[i] /= vert_edge_w[i]

    # --- Cavity AO: verts surrounded by faces pointing inward-ish ---
    # Average neighbor normal vs vertex normal; deep pockets score high.
    vert_ao = [0.0] * len(bm.verts)
    for vert in bm.verts:
        if not vert.link_faces:
            continue
        n = vert.normal.normalized()
        # Sample along -normal and sideways for occlusion proxy
        center = vert.co
        occluded = 0.0
        samples = 0
        directions = [n]
        if vert.link_edges:
            for edge in list(vert.link_edges)[:6]:
                other = edge.other_vert(vert)
                tangent = (other.co - center).normalized()
                directions.append((n + tangent * 0.65).normalized())
                directions.append((n - tangent * 0.35).normalized())
        for direction in directions:
            origin = center + direction * 0.0015
            # Object-space ray: (result, location, normal, face_index)
            hit = obj.ray_cast(origin, direction, distance=0.08)
            if hit[0]:
                dist = (hit[1] - origin).length
                occluded += 1.0 - min(1.0, dist / 0.08)
            samples += 1
        vert_ao[vert.index] = occluded / max(samples, 1)

    # Smooth both fields one pass
    def smooth(values, strength=0.45):
        out = values[:]
        for vert in bm.verts:
            if not vert.link_edges:
                continue
            acc = values[vert.index]
            w = 1.0
            for edge in vert.link_edges:
                other = edge.other_vert(vert)
                acc += values[other.index]
                w += 1.0
            out[vert.index] = values[vert.index] * (1 - strength) + (acc / w) * strength
        return out

    vert_edge = smooth(vert_edge, 0.35)
    vert_ao = smooth(vert_ao, 0.5)

    # Normalize edge field
    max_e = max(vert_edge) if vert_edge else 1.0
    if max_e > 1e-6:
        vert_edge = [min(1.0, v / max_e) for v in vert_edge]
    max_a = max(vert_ao) if vert_ao else 1.0
    if max_a > 1e-6:
        vert_ao = [min(1.0, v / max_a) for v in vert_ao]

    # Write COLOR_EDGE (R=edge, G=ao, B=combined wear)
    if "Wear" not in mesh.color_attributes:
        mesh.color_attributes.new(name="Wear", type="BYTE_COLOR", domain="CORNER")
    color_attr = mesh.color_attributes["Wear"]
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi = mesh.loops[li].vertex_index
            edge = vert_edge[vi]
            ao = vert_ao[vi]
            # Wear: edges high, cavities slightly scuffed
            wear = min(1.0, edge * 0.85 + max(0.0, ao - 0.45) * 0.35)
            color_attr.data[li].color = (edge, ao, wear, 1.0)

    bm.free()


def _tileable_fbm(x, y, size, seed, octaves=4):
    """Seamless FBM on a toroidal domain (no UV-edge dark stripe)."""
    u = (x % size) / size
    v = (y % size) / size
    # Embed circle in 2D via 4D-ish sampling of periodic noise
    ang_u = u * math.pi * 2
    ang_v = v * math.pi * 2
    px = math.cos(ang_u)
    py = math.sin(ang_u)
    pz = math.cos(ang_v)
    pw = math.sin(ang_v)
    # Project to 2D noise coords
    sx = (px + pz * 0.7) * 2.3 + seed * 0.1
    sy = (py + pw * 0.7) * 2.3 + seed * 0.17
    return _fbm(sx * 1.4, sy * 1.4, seed, octaves=octaves)


def compose_seamless_shell_textures(color_img, rough_img, normal_img):
    """Tileable low-sat sage spray — greener than pale grey, visible grain, no UV stripes."""
    size = color_img.size[0]
    rng = random.Random(17)
    # Restored grey-green satin (not washed white-grey)
    base = (0.390, 0.410, 0.370)
    dark = (0.350, 0.375, 0.320)
    warm = (0.400, 0.417, 0.355)

    color_px = []
    rough_px = []
    heights = []
    for y in range(size):
        row = []
        for x in range(size):
            spray = _tileable_fbm(x, y, size, 7, octaves=4)
            fine = _tileable_fbm(x * 2.2, y * 2.2, size, 19, octaves=3)
            micro = _tileable_fbm(x * 5.5, y * 5.1, size, 33, octaves=2)
            bowl = _tileable_fbm(x * 0.55, y * 0.52, size, 61, octaves=3)
            # Stronger spray mottling + orange-peel grain (previous visual layer)
            mottling = (spray - 0.5) * 0.032 + (fine - 0.5) * 0.012 + (micro - 0.5) * 0.006
            recess = max(0.0, 0.48 - bowl) * 0.10
            warm_mix = max(0.0, spray - 0.55) * 0.35
            grain = rng.uniform(-1, 1) * 0.008
            r = base[0] + (warm[0] - base[0]) * warm_mix + mottling + grain
            g = base[1] + (warm[1] - base[1]) * warm_mix + mottling * 0.95 + grain * 0.9
            b = base[2] + (warm[2] - base[2]) * warm_mix + mottling * 0.82 + grain * 0.75
            r += (dark[0] - r) * recess
            g += (dark[1] - g) * recess
            b += (dark[2] - b) * recess
            color_px.extend((max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b)), 1.0))

            rough = 0.52 + (spray - 0.5) * 0.14 + (fine - 0.5) * 0.03 - recess * 0.05 + rng.uniform(-1, 1) * 0.022
            rough = max(0.32, min(0.57, rough))
            rough_px.extend((rough, rough, rough, 1.0))

            peel = (fine - 0.5) * 0.16 + (micro - 0.5) * 0.10
            broad = (spray - 0.5) * 0.08
            row.append(broad + peel - recess * 0.05 + rng.uniform(-0.055, 0.055))
        heights.append(row)

    normal_px = []
    for y in range(size):
        for x in range(size):
            left = heights[y][(x - 1) % size]
            right = heights[y][(x + 1) % size]
            down = heights[(y - 1) % size][x]
            up = heights[(y + 1) % size][x]
            normal = Vector((-(right - left) * 1.55, -(up - down) * 1.55, 1.0)).normalized()
            normal_px.extend((normal.x * 0.5 + 0.5, normal.y * 0.5 + 0.5, normal.z * 0.5 + 0.5, 1.0))

    color_img.pixels.foreach_set(color_px)
    rough_img.pixels.foreach_set(rough_px)
    normal_img.pixels.foreach_set(normal_px)
    for img in (color_img, rough_img, normal_img):
        img.update()
        img.save()
        # Preview the same decoded PNGs that the browser receives in the GLB.
        img.source = "FILE"
        img.reload()
        img.pack()


def bake_shell_wear(root, color_img, rough_img, normal_img):
    compose_seamless_shell_textures(color_img, rough_img, normal_img)
    for obj in shell_objects(root):
        paint_mesh_wear_attributes(obj)
        mesh = obj.data
        wear = mesh.color_attributes["Wear"]
        paint = mesh.color_attributes.new(name="PaintWear", type="BYTE_COLOR", domain="CORNER")
        for loop in mesh.loops:
            co = obj.matrix_world @ mesh.vertices[loop.vertex_index].co
            patch = _fbm(co.x * 27 + co.z * 3, co.y * 27 + co.z * 11, 43)
            edge, cavity = wear.data[loop.index].color[:2]
            # Kept below one so glTF's vertex-color multiplication matches Blender.
            tone = min(1.0, max(0.60, 0.84 + edge * (0.12 + patch * 0.10)
                                - cavity * 0.15 + (patch - 0.45) * 0.07))
            paint.data[loop.index].color = (tone, tone, tone, 1)
        mesh.color_attributes.remove(wear)
        mesh.color_attributes.active_color = paint


def rounded_box(name, dimensions, location, radius, mat, parent, role=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Soft bevel", "BEVEL")
    bevel.width = radius
    bevel.segments = 8
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
    bevel.segments = 8
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


def super_shell(name, dimensions, location, mat, parent, role=None, exponent=0.56, bottom_scale=(1, 1), top_scale=(1, 1), cross_exponent=None, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=rings, location=location)
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
        if cross_exponent is not None:
            theta = math.atan2(source.y, source.x)
            radius = max(0, 1 - source.z ** 2) ** (exponent / 2)
            x = radius * math.copysign(abs(math.cos(theta)) ** cross_exponent, math.cos(theta))
            y = radius * math.copysign(abs(math.sin(theta)) ** cross_exponent, math.sin(theta))
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
    bevel.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish_mesh(obj, mat, parent, role, uv_project=False)


def groove_ring(name, radius, tube, location, rotation, mat, parent):
    """Thin recessed parting ring — industrial seam, not mecha greeble."""
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=tube,
        major_segments=36,
        minor_segments=6,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish_mesh(obj, mat, parent, uv_project=False)


def head_parting_line(parent, mat):
    curve = bpy.data.curves.new("HeadPartingLine", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.0007
    curve.bevel_resolution = 1
    spline = curve.splines.new("POLY")
    points = []
    for center_x, center_z, start in [(0.088, 0.018, 0), (-0.088, 0.018, 90),
                                       (-0.088, -0.018, 180), (0.088, -0.018, 270)]:
        for i in range(16):
            angle = math.radians(start + i * 90 / 15)
            x = center_x + 0.066 * math.cos(angle)
            z = center_z + 0.066 * math.sin(angle)
            dx, dz = max(abs(x) - 0.096, 0), max(abs(z) - 0.0225, 0)
            y = -0.046 - math.sqrt(max(0, 0.075 ** 2 - dx ** 2 - dz ** 2))
            points.append((x, y - 0.0003, z + 0.0125, 1))
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = co
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new("HeadPartingLine", curve)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    finish_mesh(bpy.context.object, mat, parent, uv_project=False)


def foot_outline(theta, width, length):
    c, sn = math.cos(theta), math.sin(theta)
    return (math.copysign(abs(c) ** 0.70, c) * width / 2 * (1 - max(0, -sn) * 0.08),
            math.copysign(abs(sn) ** 0.70, sn) * length / 2)


def foot_mesh(name, rings, mat, parent, role):
    segments = 32
    vertices = []
    for z, width, length, center_y in rings:
        for i in range(segments):
            x, y = foot_outline(i * math.tau / segments, width, length)
            vertices.append((x, y + center_y, z))
    faces = [tuple(reversed(range(segments)))]
    for j in range(len(rings) - 1):
        for i in range(segments):
            a = j * segments + i
            b = j * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple((len(rings) - 1) * segments + i for i in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish_mesh(obj, mat, parent, role)


def shoe_shell(name, mat, parent, role=None):
    return foot_mesh(name, [
        (-0.123, 0.129, 0.267, -0.061),
        (-0.118, 0.137, 0.274, -0.061),
        (-0.105, 0.139, 0.273, -0.060),
        (-0.083, 0.135, 0.265, -0.058),
        (-0.064, 0.128, 0.237, -0.047),
        (-0.042, 0.116, 0.184, -0.025),
        (-0.018, 0.095, 0.123, -0.002),
        (0.005, 0.078, 0.087, 0.008),
        (0.011, 0.065, 0.071, 0.008),
    ], mat, parent, role)


def shoe_sole(name, mat, parent, role=None):
    return foot_mesh(name, [
        (-0.134, 0.134, 0.272, -0.061),
        (-0.132, 0.144, 0.282, -0.061),
        (-0.124, 0.144, 0.282, -0.061),
        (-0.122, 0.135, 0.274, -0.061),
    ], mat, parent, role)


def profile_shell(name, dimensions, location, mat, parent, role=None,
                  bottom_scale=0.82, top_scale=1.0, exponent=0.88):
    # Broaden the end transitions while retaining the long, gently crowned walls.
    width, depth, height = dimensions
    profile = [(0.0, 0.70), (0.012, 0.82), (0.035, 0.92), (0.065, 0.97),
               (0.10, 0.99), (0.16, 1.0), (0.28, 1.012), (0.5, 1.02),
               (0.72, 1.012), (0.84, 1.0), (0.90, 0.99), (0.935, 0.97),
               (0.965, 0.92), (0.988, 0.82), (1.0, 0.70)]
    segments = 32
    vertices = []
    for t, roll in profile:
        taper = bottom_scale + (top_scale - bottom_scale) * t
        for i in range(segments):
            theta = i * math.tau / segments
            c, sn = math.cos(theta), math.sin(theta)
            vertices.append((math.copysign(abs(c) ** exponent, c) * width / 2 * taper * roll,
                             math.copysign(abs(sn) ** exponent, sn) * depth / 2 * taper * roll,
                             (t - 0.5) * height))
    faces = [tuple(reversed(range(segments)))]
    for j in range(len(profile) - 1):
        for i in range(segments):
            a = j * segments + i
            b = j * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple((len(profile) - 1) * segments + i for i in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return finish_mesh(obj, mat, parent, role)


def pivot(name, radius, width, parent, joint, accent):
    half = width / 2
    left = [(-half - 0.001, 0.63, 0), (-half - 0.005, 0.68, 1),
            (-half - 0.006, 0.86, 1), (-half - 0.003, 0.97, 1),
            (-half + 0.002, 1.0, 0), (-half + 0.009, 0.97, 0),
            (-half + 0.012, 0.77, 0), (-0.010, 0.77, 0),
            (-0.007, 0.86, 1)]
    profile = left + [(-x, r, m) for x, r, m in reversed(left)]
    segments = 32
    vertices = [(x, radius * r * math.cos(i * math.tau / segments),
                 radius * r * math.sin(i * math.tau / segments))
                for x, r, _ in profile for i in range(segments)]
    faces = [tuple(reversed(range(segments)))]
    materials = [0]
    for j in range(len(profile) - 1):
        for i in range(segments):
            a = j * segments + i
            b = j * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
            materials.append(profile[j][2])
    faces.append(tuple((len(profile) - 1) * segments + i for i in range(segments)))
    materials.append(0)
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    finish_mesh(obj, joint, parent, uv_project=False)
    mesh.materials.append(accent)
    for face, index in zip(mesh.polygons, materials):
        face.material_index = index


def make_arm(side, root, shell, joint, joint_accent, seam):
    suffix = "L" if side > 0 else "R"
    shoulder = empty(f"Shoulder_{suffix}", root, (0.238 * side, 0, 1.43), "shoulder")
    super_shell(f"ShoulderShell_{suffix}", (0.123, 0.154, 0.15),
                (-0.014 * side, 0, -0.018), shell, shoulder, "shoulder_shell",
                exponent=0.68, cross_exponent=0.82, rings=28)
    profile_shell(f"UpperArmShell_{suffix}", (0.106, 0.125, 0.224),
                  (0, 0, -0.174), shell, shoulder, "upper_arm_shell", bottom_scale=0.81)
    elbow = empty(f"Elbow_{suffix}", shoulder, (0, 0, -0.305), "elbow")
    pivot(f"ElbowJoint_{suffix}", 0.037, 0.076, elbow, joint, joint_accent)
    profile_shell(f"ForearmShell_{suffix}", (0.102, 0.118, 0.260),
                  (0, 0, -0.157), shell, elbow, "forearm_shell", bottom_scale=0.78)
    cylinder(f"WristSleeve_{suffix}", 0.033, 0.038, (0, 0, -0.296), (0, 0, 0), joint, elbow)
    hand = empty(f"Hand_{suffix}", elbow, (0, 0, -0.305), "hand")
    clamp = super_shell(f"HandClamp_{suffix}", (0.083, 0.085, 0.153),
                        (0, 0, -0.063), shell, hand, "hand_clamp", exponent=0.82,
                        bottom_scale=(0.81, 0.81), top_scale=(0.90, 0.90))
    # Separate the closed clamp into two rigid jaws with a narrow physical seam.
    for jaw_side in (-1, 1):
        jaw = clamp if jaw_side == -1 else clamp.copy()
        if jaw_side == 1:
            jaw.data = clamp.data.copy()
            bpy.context.collection.objects.link(jaw)
            jaw.name = f"HandClampInner_{suffix}"
        bm = bmesh.new()
        bm.from_mesh(jaw.data)
        if jaw_side == 1:
            # Mirror the first jaw so both halves retain the same capsule profile.
            for v in bm.verts:
                v.co.x = -v.co.x
        else:
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                  dist=0.00001, plane_co=(0, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
            boundary = [e for e in bm.edges if e.is_boundary]
            bmesh.ops.holes_fill(bm, edges=boundary)
        for v in bm.verts:
            v.co.x += jaw_side * 0.0007
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(jaw.data)
        bm.free()


def make_leg(side, root, shell, joint, joint_accent, sole, seam):
    suffix = "L" if side > 0 else "R"
    hip = empty(f"Hip_{suffix}", root, (0.11 * side, 0, 0.965), "hip")
    cylinder(f"HipBearing_{suffix}", 0.057, 0.110, (0, 0, 0), (0, math.pi / 2, 0), joint, hip)
    cylinder(f"HipCover_{suffix}", 0.063, 0.012, (0.061 * side, 0, 0), (0, math.pi / 2, 0), shell, hip)
    profile_shell(f"ThighShell_{suffix}", (0.155, 0.175, 0.391),
                  (0, 0.008, -0.200), shell, hip, "thigh_shell", bottom_scale=0.76, exponent=0.86)
    knee = empty(f"Knee_{suffix}", hip, (0, 0, -0.425), "knee")
    pivot(f"KneeJoint_{suffix}", 0.043, 0.098, knee, joint, joint_accent)
    profile_shell(f"CalfShell_{suffix}", (0.130, 0.148, 0.373),
                  (0, 0, -0.217), shell, knee, "calf_shell", bottom_scale=0.76, exponent=0.86)
    ankle = empty(f"Ankle_{suffix}", knee, (0, 0, -0.415), "ankle")
    pivot(f"AnkleJoint_{suffix}", 0.030, 0.072, ankle, joint, joint_accent)
    shoe_shell(f"FootShell_{suffix}", shell, ankle, "foot_shell")
    shoe_sole(f"FootSole_{suffix}", sole, ankle, "foot_sole")


def build_robot():
    color_img = blank_image("ShellBaseColor", TEXTURE_DIR / "shell-basecolor.png", fill=(0.425, 0.478, 0.432, 1))
    rough_img = blank_image("ShellRoughness", TEXTURE_DIR / "shell-roughness.png", non_color=True, fill=(0.48, 0.48, 0.48, 1))
    normal_img = blank_image("ShellNormal", TEXTURE_DIR / "shell-normal.png", non_color=True, fill=(0.5, 0.5, 1.0, 1))

    shell = material(
        "Shell_GreyGreen",
        (0.425, 0.478, 0.432),
        0.22,
        0.52,
        color_texture=color_img,
        roughness_texture=rough_img,
        normal_texture=normal_img,
        normal_strength=0.42,
        coat_weight=0.04,
        coat_roughness=0.42,
        specular_ior=1.48,
        use_vertex_wear=True,
    )
    joint = material("Joint_Graphite", (0.018, 0.022, 0.019), 0.48, 0.48, coat_weight=0.0, coat_roughness=0.4)
    joint_accent = material("Joint_Accent", (0.09, 0.105, 0.095), 0.45, 0.43, coat_weight=0.0, coat_roughness=0.4)
    sole = material("Sole_Graphite", (0.042, 0.048, 0.045), 0.28, 0.70)
    shell_accent = material("Shell_Accent", (0.122, 0.137, 0.112), 0.22, 0.52, coat_weight=0.04, coat_roughness=0.42)
    seam = material("Shell_Seam", (0.13, 0.15, 0.12), 0.12, 0.65, coat_weight=0.06, coat_roughness=0.38)
    amber = material("Sensor_Amber", (0.62, 0.255, 0.025), 0.25, 0.30, (0.40, 0.115, 0.008))
    sensor_rim = material("Sensor_Brass", (0.32, 0.205, 0.070), 0.65, 0.38)
    sensor_core = material("Sensor_Core", (0.90, 0.48, 0.085), 0.05, 0.26, (0.65, 0.25, 0.02))

    root = empty("RobotRoot", location=(0, 0, 0.009), role="robot_root")
    root["design_language"] = "functional_minimalism"
    root["reference_height_m"] = 1.73

    body = empty("Body", root, role="body")
    super_shell("TorsoShell", (0.365, 0.220, 0.37), (0, 0, 1.29), shell, body, "torso_shell",
                exponent=0.25, cross_exponent=0.55, bottom_scale=(0.822, 0.886), rings=28)
    # Pelvis: slightly longer vertical blend toward thighs, softer bottom taper
    super_shell(
        "PelvisShell",
        (0.305, 0.210, 0.205),
        (0, 0.01, 0.998),
        shell,
        body,
        "pelvis_shell",
        exponent=0.74,
        bottom_scale=(0.78, 0.86),
        top_scale=(1.0, 1.0),
    )
    waist = cylinder("WaistSleeve", 0.118, 0.048, (0, 0, 1.087), (0, 0, 0), joint, body, "waist")
    waist.scale.y = 0.74
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    cylinder("ChestSocket", 0.025, 0.010, (-0.072, -0.110, 1.33), (math.pi / 2, 0, 0), joint, body)
    cylinder("ChestRim", 0.021, 0.006, (-0.072, -0.117, 1.33), (math.pi / 2, 0, 0), sensor_rim, body)
    cylinder("ChestLight", 0.015, 0.004, (-0.072, -0.121, 1.33), (math.pi / 2, 0, 0), amber, body, "chest_light")
    cylinder("ChestCore", 0.008, 0.002, (-0.072, -0.124, 1.33), (math.pi / 2, 0, 0), sensor_core, body)

    head = empty("Head", root, (0, 0, 1.635), "head")
    cylinder("NeckCore", 0.048, 0.085, (0, 0, -0.118), (0, 0, 0), joint, head, "neck")
    for z in (-0.145, -0.127, -0.109):
        cylinder(f"NeckRing_{abs(int(z * 1000))}", 0.062, 0.010, (0, 0, z), (0, 0, 0), joint, head, "neck")
    rounded_box("HeadShell", (0.342, 0.242, 0.195), (0, 0, 0.0125), 0.075, shell, head, "head_shell")
    head_parting_line(head, seam)
    super_shell("HeadSidePanel_R", (0.006, 0.145, 0.110), (-0.169, 0.010, 0), shell_accent, head, "head_panel", exponent=0.55)
    cylinder("EyeSocket", 0.034, 0.010, (0.073, -0.120, 0.005), (math.pi / 2, 0, 0), joint, head)
    cylinder("EyeRim", 0.028, 0.006, (0.073, -0.125, 0.005), (math.pi / 2, 0, 0), sensor_rim, head)
    cylinder("EyeSensor", 0.021, 0.004, (0.073, -0.129, 0.005), (math.pi / 2, 0, 0), amber, head, "eye_sensor")
    cylinder("EyeCore", 0.011, 0.002, (0.073, -0.132, 0.005), (math.pi / 2, 0, 0), sensor_core, head)

    make_arm(1, root, shell, joint, joint_accent, seam)
    make_arm(-1, root, shell, joint, joint_accent, seam)
    make_leg(1, root, shell, joint, joint_accent, sole, seam)
    make_leg(-1, root, shell, joint, joint_accent, sole, seam)

    bake_shell_wear(root, color_img, rough_img, normal_img)
    return root


def add_preview_scene():
    ground_mat = material("PreviewGround", (0.88, 0.865, 0.83), 0.0, 0.92)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground.data.materials.append(ground_mat)

    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.96, 0.90, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.28

    def area(name, energy, size, location):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        look_at(obj, (0, 0, 0.9))

    area("KeyLight", 780, 3.0, (-3.5, -4.0, 5.2))
    area("FillLight", 160, 3.5, (3.2, -1.8, 3.5))
    area("RimLight", 460, 3.0, (0.8, 3.2, 4.0))

    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.lens = 68
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.05
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.0
    return camera


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def export_robot(root):
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    camera = bpy.context.scene.camera
    camera.location = (2.8, -3.4, 1.55)
    look_at(camera, (0, 0, 0.88))
    bpy.context.preferences.filepaths.save_version = 0
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
        export_vertex_color="NAME",
        export_vertex_color_name="PaintWear",
    )


def render_views(camera, root):
    views = {
        "front": ((0, -4.1, 0.88), (0, 0, 0.88)),
        "side": ((4.1, 0, 0.88), (0, 0, 0.88)),
        "rear": ((0, 4.1, 0.88), (0, 0, 0.88)),
        "three-quarter": ((2.8, -3.4, 1.55), (0, 0, 0.88)),
        "material-detail": ((1.15, -2.25, 1.58), (0, 0, 1.38)),
        "feet-detail": ((0.90, -1.80, 0.38), (0, -0.03, 0.24)),
    }
    requested = os.environ.get("ROBOT_RENDER_VIEWS", "").split(",")
    for name, (position, target) in views.items():
        if requested != [""] and name not in requested:
            continue
        camera.data.ortho_scale = 0.75 if "detail" in name else 2.05
        camera.location = position
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(RENDER_DIR / f"robot-preview-{name}.png")
        bpy.ops.render.render(write_still=True)

    if requested != [""] and "seated" not in requested:
        return

    root.location.z = -0.43
    for suffix in ("L", "R"):
        bpy.data.objects[f"Hip_{suffix}"].rotation_euler.x = -math.radians(90)
        bpy.data.objects[f"Knee_{suffix}"].rotation_euler.x = math.radians(90)
        bpy.data.objects[f"Shoulder_{suffix}"].rotation_euler.x = -math.radians(8)
        bpy.data.objects[f"Elbow_{suffix}"].rotation_euler.x = -math.radians(72)

    stool_mat = material("PreviewStool", (0.72, 0.69, 0.63), 0.0, 0.9)
    rounded_box("PreviewStool", (0.58, 0.48, 0.52), (0, 0.25, 0.26), 0.025, stool_mat, None)
    camera.data.ortho_scale = 1.75
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
