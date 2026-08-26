from pathlib import Path
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
GLB_PATH = ROOT / "public/models/workstation-furniture.glb"
REQUIRED_NODES = {
    "FurnitureRoot",
    "DeskRoot",
    "DeskTopAssembly",
    "DeskTop",
    "DeskCrossbar",
    "DeskColumnOuter_L",
    "DeskColumnOuter_R",
    "DeskColumnMiddle_L",
    "DeskColumnMiddle_R",
    "DeskColumnUpper_L",
    "DeskColumnUpper_R",
    "DeskFoot_L",
    "DeskFoot_R",
    "MonitorClamp",
    "MonitorClampJaw",
    "MonitorLowerArm",
    "MonitorUpperArm",
    "MonitorScreen",
    "MonitorPanel",
    "MonitorVesaMount",
    "MonitorPivotBase",
    "MonitorPivotElbow",
    "MonitorPivotHead",
    "ChairRoot",
    "ChairBase",
    "ChairGasOuter",
    "ChairGasMiddle",
    "ChairGasInner",
    "ChairUpper",
    "ChairSeat",
    "ChairBackFrame",
    "ChairBackMesh",
    "ChairLumbar",
    "ChairArmrest_L",
    "ChairArmrest_R",
    "ChairCaster_1",
    "ChairCaster_2",
    "ChairCaster_3",
    "ChairCaster_4",
    "ChairCaster_5",
    "ChairCasterFork_1",
    "ChairCasterFork_2",
    "ChairCasterFork_3",
    "ChairCasterFork_4",
    "ChairCasterFork_5",
}

if not GLB_PATH.exists():
    print(f"FAILED: missing {GLB_PATH}")
    sys.exit(1)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))

objects = {obj.name: obj for obj in bpy.context.scene.objects}
missing = sorted(REQUIRED_NODES - objects.keys())
meshes = [obj for obj in objects.values() if obj.type == "MESH"]
triangles = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes)
size_bytes = GLB_PATH.stat().st_size


def dimensions(name):
    obj = objects[name]
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[axis] for point in corners) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in corners) for axis in range(3)))
    return maximum - minimum


def world_location(name):
    return objects[name].matrix_world.translation


def z_bounds(name):
    obj = objects[name]
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return min(point.z for point in points), max(point.z for point in points)


def y_bounds(name):
    obj = objects[name]
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return min(point.y for point in points), max(point.y for point in points)


errors = []
if missing:
    errors.append("required node names are missing")
else:
    desk_size = dimensions("DeskTop")
    column_spacing = abs(world_location("DeskColumnOuter_L").x - world_location("DeskColumnOuter_R").x)
    screen_size = dimensions("MonitorScreen")
    caster_bottoms = [z_bounds(f"ChairCaster_{index}")[0] for index in range(1, 6)]
    panel_front = y_bounds("MonitorPanel")[1]
    hardware_front = max(y_bounds("MonitorPivotHead")[1], y_bounds("MonitorVesaMount")[1])
    monitor_front_clearance = panel_front - hardware_front
    panel_material = objects["MonitorPanel"].active_material
    panel_color = panel_material.diffuse_color[:3]
    panel_texture = next((node.image for node in panel_material.node_tree.nodes if node.type == "TEX_IMAGE"), None)

    print(f"desk_width_cm={desk_size.x * 100:.1f}")
    print(f"desk_depth_cm={desk_size.y * 100:.1f}")
    print(f"desk_column_spacing_cm={column_spacing * 100:.1f}")
    print(f"screen_width_cm={screen_size.x * 100:.1f}")
    print(f"screen_height_cm={screen_size.z * 100:.1f}")
    print(f"monitor_front_clearance_mm={monitor_front_clearance * 1000:.1f}")
    print(f"monitor_panel_rgb={','.join(f'{value:.3f}' for value in panel_color)}")
    print(f"monitor_panel_texture={panel_texture.name if panel_texture else 'none'}")
    print(f"caster_bottom_height_mm={max(caster_bottoms) * 1000:.1f}")

    if not 1.18 <= desk_size.x <= 1.22:
        errors.append("desk width is not 120 cm")
    if not 0.63 <= desk_size.y <= 0.67:
        errors.append("desk depth is not 65 cm")
    if not 0.94 <= column_spacing <= 0.98:
        errors.append("desk columns are not spaced 96 cm apart")
    if not 0.59 <= screen_size.x <= 0.63 or not 0.34 <= screen_size.z <= 0.38:
        errors.append("monitor is not approximately 27-inch 16:9")
    if monitor_front_clearance < 0.02:
        errors.append("monitor rear hardware protrudes through the front panel")
    if panel_material.name != "Furniture_Screen" or panel_texture is None:
        errors.append("monitor panel wallpaper material is missing")
    if min(panel_color) < 0.6:
        errors.append("monitor panel fallback color is too dark")
    if any(abs(height) > 0.005 for height in caster_bottoms):
        errors.append("chair casters are not grounded")

    scenarios = (
        ("145_sitting", 0.58, 1.005, 0.315),
        ("145_standing", 0.92, 1.325, 0.315),
        ("205_sitting", 0.82, 1.395, 0.555),
        ("205_standing", 1.18, 1.985, 0.555),
        ("145_sitting_calibration", 0.66, 0.925, 0.315),
        ("205_standing_calibration", 1.10, 2.065, 0.555),
    )
    for label, desk_surface, screen_top, seat_surface in scenarios:
        upper_center = desk_surface - 0.28
        middle_center = 0.28 + (upper_center - 0.28) * 0.5
        outer_middle_overlap = 0.52 - (middle_center - 0.24)
        middle_upper_overlap = middle_center + 0.24 - (upper_center - 0.24)
        upper_crossbar_overlap = upper_center + 0.24 - (desk_surface - 0.045)
        monitor_base = Vector((0.20, desk_surface + 0.06, 0.285))
        monitor_head = Vector((0, screen_top - 0.18, 0.23))
        monitor_reach = (monitor_head - monitor_base).length
        chair_upper = seat_surface - 0.0425
        gas_top = max(0.2175, chair_upper - 0.055)
        gas_extension = gas_top - 0.2175
        gas_middle_center = 0.14 + min(gas_extension, 0.13)
        gas_middle_bottom = gas_middle_center - 0.065
        gas_middle_top = gas_middle_center + 0.065
        gas_inner_bottom = gas_top - 0.14
        gas_outer_middle_overlap = 0.255 - gas_middle_bottom
        gas_middle_inner_overlap = gas_middle_top - gas_inner_bottom
        gas_seat_clearance = (chair_upper - 0.0425) - gas_top
        print(
            f"{label}=desk_overlap:{min(outer_middle_overlap, middle_upper_overlap, upper_crossbar_overlap) * 1000:.1f}mm,"
            f"monitor_reach:{monitor_reach * 100:.1f}cm,gas_overlap:"
            f"{min(gas_outer_middle_overlap, gas_middle_inner_overlap) * 1000:.1f}mm,gas_seat_clearance:"
            f"{gas_seat_clearance * 1000:.1f}mm"
        )
        if min(outer_middle_overlap, middle_upper_overlap, upper_crossbar_overlap) < 0:
            errors.append(f"desk telescoping shells disconnect at {label}")
        if monitor_reach > 0.40 * 1.98:
            errors.append(f"monitor arm cannot reach at {label}")
        if min(gas_outer_middle_overlap, gas_middle_inner_overlap) < 0:
            errors.append(f"chair gas lift disconnects at {label}")
        if gas_seat_clearance < 0:
            errors.append(f"chair gas lift pierces the seat at {label}")

print(f"nodes={len(objects)}")
print(f"meshes={len(meshes)}")
print(f"triangles={triangles}")
print(f"size_kb={size_bytes / 1024:.1f}")
print(f"missing={','.join(missing) if missing else 'none'}")

if triangles > 25000:
    errors.append("triangle budget exceeded")
if size_bytes > 1.5 * 1024 * 1024:
    errors.append("GLB exceeds 1.5 MB")

if errors:
    print("FAILED: " + "; ".join(errors))
    sys.exit(1)

print("VALID")
