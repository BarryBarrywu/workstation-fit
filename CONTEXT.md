# Workstation Fit

Workstation Fit turns a person's measurements into adjustable workstation starting ranges and a visual calibration scene.

## Language

**Fit estimate**:
A height-derived starting range for a workstation measurement that must be confirmed against the person's body.
_Avoid_: Ideal height, perfect height, medical recommendation

**Calibration**:
A user correction to a fit estimate based on observable contact points such as feet, elbows, knees, and eye line.
_Avoid_: Diagnosis, treatment

**Visual rig asset**:
The GLB containing the robot's original meshes, materials, and named articulated hierarchy; it does not decide fitted poses.
_Avoid_: Animated character, complete scene

**Furniture rig asset**:
The GLB containing the desk, monitor arm, and ergonomic chair as named adjustable assemblies; it provides their visual form but does not decide fitted measurements.
_Avoid_: Procedural furniture, static furniture model

**Fit pose**:
A sitting or standing robot pose derived by the browser from the current body and workstation measurements.
_Avoid_: GLB animation, fixed pose

**Concept sheet**:
An original multi-view visual reference used to agree on the robot's form, materials, and proportions before building geometry.
_Avoid_: Final model, image-to-3D output

**Model source**:
The reproducible Blender scene and script that define the visual rig asset before GLB export.
_Avoid_: Generated GLB, concept image

**Rigid shell**:
A visible robot or furniture part whose proportions never deform when a workstation measurement changes.
_Avoid_: Stretchable mesh

**Telescoping segment**:
An overlapping mechanical connection whose exposed length changes while its rigid shells and joints retain their shape.
_Avoid_: Scaled limb, stretched leg

**Adjustable assembly**:
A set of rigid shells connected by translating, rotating, or telescoping parts so a fit pose can change without visual distortion.
_Avoid_: Resizable object

**Dual-column sit-stand desk**:
An adjustable desk with two lateral telescoping columns whose clear space contains the person and chair throughout sitting and standing fit poses.
_Avoid_: Four-leg table, two floating posts

**Articulated monitor arm**:
A desk-clamped two-link support whose pivots place the screen while its mounting head preserves the screen orientation.
_Avoid_: Floating monitor, height-scaled stand

**Ergonomic chair assembly**:
An original, product-neutral office chair whose seat, back, lumbar support, armrests, gas lift, five-star base, and casters communicate adjustable seated support without reproducing a branded chair.
_Avoid_: H300 replica, generic stool, pedestal chair

**Fit envelope**:
The complete `145–205 cm` input range plus permitted calibration offsets in which every adjustable assembly must remain connected and collision-free.
_Avoid_: Recommended population, source-data range

**Functional minimalism**:
The scene's form language in which only joints and details needed to explain posture, adjustment, support, or identity remain visible; unrelated mechanisms and decoration are simplified or covered by quiet shells.
_Avoid_: Decorative machinery, exposed complexity, featureless toy

**Shell continuity**:
The visible overlap between adjacent rigid shells, collars, and joint sleeves that keeps the robot reading as one connected machine throughout every approved pose.
_Avoid_: Floating part, cosmetic gap, disconnected silhouette

**Pose clearance**:
The visible space maintained between non-adjacent moving assemblies, especially hands, forearms, torso, pelvis, and thighs, so separate parts never merge into one silhouette.
_Avoid_: Intersecting shell, fused limb, accidental contact
