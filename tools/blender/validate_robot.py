from pathlib import Path
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
GLB_PATH = ROOT / "public/models/workstation-guide.glb"
REQUIRED_NODES = {
    "RobotRoot", "Body", "Head",
    "Shoulder_L", "Shoulder_R", "Elbow_L", "Elbow_R",
    "Hip_L", "Hip_R", "Knee_L", "Knee_R", "Ankle_L", "Ankle_R",
    "Hand_L", "Hand_R", "EyeSensor", "ChestLight",
    "WristSleeve_L", "WristSleeve_R", "HandClampInner_L", "HandClampInner_R",
    "TorsoShell", "PelvisShell", "NeckCore", "HeadShell",
    "ForearmShell_L", "HandClamp_L", "ThighShell_L",
    "FootShell_L", "FootShell_R", "AnkleJoint_L", "AnkleJoint_R",
    "FootSole_L", "FootSole_R", "HeadSidePanel_R",
}

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))

names = {obj.name for obj in bpy.context.scene.objects}
missing = sorted(REQUIRED_NODES - names)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
triangles = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes)
corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
height = maximum.z - minimum.z
size_bytes = GLB_PATH.stat().st_size

print(f"nodes={len(names)}")
print(f"meshes={len(meshes)}")
print(f"triangles={triangles}")
print(f"height_m={height:.3f}")
print(f"size_kb={size_bytes / 1024:.1f}")
print(f"missing={','.join(missing) if missing else 'none'}")

errors = []


def z_bounds(name):
    obj = bpy.data.objects[name]
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return min(point.z for point in points), max(point.z for point in points)


def x_bounds(name):
    obj = bpy.data.objects[name]
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return min(point.x for point in points), max(point.x for point in points)


torso_min, torso_max = z_bounds("TorsoShell")
neck_min, neck_max = z_bounds("NeckCore")
head_min, head_max = z_bounds("HeadShell")
forearm_l_min, forearm_l_max = z_bounds("ForearmShell_L")
hand_l_min, hand_l_max = z_bounds("HandClamp_L")
pelvis_x_min, pelvis_x_max = x_bounds("PelvisShell")
forearm_l_x_min, forearm_l_x_max = x_bounds("ForearmShell_L")
thigh_l_x_min, thigh_l_x_max = x_bounds("ThighShell_L")
hand_l_x_min, hand_l_x_max = x_bounds("HandClamp_L")
forearm_pelvis_clearance = forearm_l_x_min - pelvis_x_max
hand_thigh_clearance = hand_l_x_min - thigh_l_x_max

print(f"forearm_pelvis_clearance_cm={forearm_pelvis_clearance * 100:.1f}")
print(f"hand_thigh_clearance_cm={hand_thigh_clearance * 100:.1f}")

for suffix in ("L", "R"):
    _, foot_max = z_bounds(f"FootShell_{suffix}")
    sole_min, _ = z_bounds(f"FootSole_{suffix}")
    ankle_min, ankle_max = z_bounds(f"AnkleJoint_{suffix}")
    calf_min, _ = z_bounds(f"CalfShell_{suffix}")
    foot_overlap_mm = (foot_max - ankle_min) * 1000
    calf_overlap_mm = (ankle_max - calf_min) * 1000
    print(f"foot_ankle_overlap_{suffix}_mm={foot_overlap_mm:.1f}")
    print(f"calf_ankle_overlap_{suffix}_mm={calf_overlap_mm:.1f}")
    print(f"foot_sole_height_{suffix}_mm={sole_min * 1000:.1f}")
    if foot_max < ankle_min:
        errors.append(f"FootShell_{suffix} does not overlap AnkleJoint_{suffix}")
    if calf_min > ankle_max:
        errors.append(f"CalfShell_{suffix} does not overlap AnkleJoint_{suffix}")
    if abs(sole_min) > 0.005:
        errors.append(f"FootSole_{suffix} is not on the ground")

if missing:
    errors.append("required node names are missing")
if triangles > 40000:
    errors.append("triangle budget exceeded")
if size_bytes > 2 * 1024 * 1024:
    errors.append("GLB exceeds 2 MB")
if not 1.65 <= height <= 1.80:
    errors.append("reference height is outside the expected range")
if torso_max < neck_min or neck_max < head_min:
    errors.append("head, neck, and torso shells do not overlap")
for suffix in ("L", "R"):
    wrist_min, wrist_max = z_bounds(f"WristSleeve_{suffix}")
    forearm_min, _ = z_bounds(f"ForearmShell_{suffix}")
    _, hand_max = z_bounds(f"HandClamp_{suffix}")
    if wrist_max < forearm_min or hand_max < wrist_min:
        errors.append(f"wrist sleeve does not connect forearm and hand on {suffix}")
if forearm_pelvis_clearance < 0.01:
    errors.append("forearm and pelvis clearance is below 1 cm")
if hand_thigh_clearance < 0.01:
    errors.append("hand and thigh clearance is below 1 cm")

for obj in meshes:
    if any(mat and mat.name == "Shell_GreyGreen" for mat in obj.data.materials):
        colors = obj.data.color_attributes
        if not colors or not any(
            abs(item.color[0] - 1) > 0.03 for item in colors[0].data
        ):
            errors.append(f"{obj.name} is missing exported paint wear")

if errors:
    print("FAILED: " + "; ".join(errors))
    sys.exit(1)

print("VALID")
