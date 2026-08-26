# Workstation Fit

Workstation Fit turns a person's measurements into adjustable workstation starting ranges and a visual calibration scene.

## Language

**Chinese product name**:
`就位` is the shared Chinese name for the website and Bilibili Toy edition. Platform names and implementation variants are not appended to the user-facing brand.
_Avoid_: 就位 Toy 版, 就位网页版, Toy Lite

**Target population**:
Chinese adult office users using the tool as a workstation setup starting point. Chinese anthropometric data is preferred; evidence from other populations must name that limitation. Children, wheelchair users, and people requiring clinical or individualized assessment are outside the default model.
_Avoid_: Universal human model, medical population, silently mixing populations

**Height-only model**:
The V1 body input model uses height alone to create broad fit estimates, then relies on posture calibration for individual differences in leg, torso, arm, and eye proportions. Sex and additional body measurements are not required inputs.
_Avoid_: Claiming personal precision from height, mandatory body survey

**Fit estimate**:
A height-derived suggested starting point paired with a reference range that must be confirmed against the person's body.
_Avoid_: Ideal height, perfect height, optimal value, medical recommendation

**Monitor-top height**:
The floor-to-screen-top fit estimate used to compare the display with the user's natural eye line. Screen-bottom height is not a product metric because it depends on the physical display size.
_Avoid_: Screen-bottom height, monitor stand height, exact eye height

**Evidence chain**:
The traceable connection from one fit estimate to its original sources, the project's calculation or transformation, the source coverage, and the remaining limitations. Every displayed measurement must have its own evidence chain.
_Avoid_: General bibliography, related reading presented as direct support

**Evidence status**:
The visible distinction between a fit estimate inside its sources' stated coverage and a trend estimate outside that coverage. Trend estimates remain available across the fit envelope but must disclose their source boundary and direct the user into calibration.
_Avoid_: Confidence score, hiding extrapolation, presenting extrapolation as direct source data

**Evidence class**:
The authority assigned to a source in an evidence chain. Original anthropometric data, formal standards, and government or occupational-health publications can support measurements; university and professional guidance can support calibration rules; brand tools and GitHub projects are corroboration or implementation references unless they disclose a stronger underlying source.
_Avoid_: Treating every link as equal evidence, using an undocumented calculator as numerical authority

**Calibration**:
A prominent but user-initiated guided checklist in which the user adjusts their real chair, desk, and monitor against observable contact points such as feet, elbows, and eye line. The website records checklist progress, not revised numeric recommendations.
_Avoid_: Onboarding, numeric offset control, diagnosis, treatment

**Posture calibration**:
The locally saved physical-check progress for one posture. Sitting checks cover the chair, desk, and monitor; standing checks cover the desk and monitor. Completion is recorded only after every step for that posture is finished.
_Avoid_: Numeric offset, one shared sitting-and-standing state, mandatory input

**Local fit profile**:
The height, onboarding state, and posture-check progress saved only in the current platform container, with no account or server record. Website and Bilibili Toy profiles exist independently, are never synchronized or transferred, and may disappear when the platform clears local storage; changing the saved height marks each completed posture check for reconfirmation.
_Avoid_: Numeric offsets, user account, cloud profile, cross-platform profile, anonymous tracking

**Bilibili Toy edition**:
A Bilibili-hosted static package of the website's calculator, evidence browser, posture calibration, and 3D scene, with its own build artifact and release lifecycle. It keeps evidence-source citations without third-party hyperlinks and excludes the website's related-episode and discovery modules; it shares product source and fit rules with the website but has independent local state and is not a redirect, separate product, or reduced mini tool.
_Avoid_: Website redirect, editorial mirror, separate Toy product, Toy Lite

**Toy preview**:
An uploaded Bilibili-hosted build used to verify the Toy edition before review submission. It is not an approved or published Toy, and moving from preview to review always requires a separate explicit confirmation.
_Avoid_: Published Toy, review submission, release

**Related episode entry**:
One secondary editorial module after the complete evidence chains, containing a shared cover, title, summary, and multiple platform destinations for the related episode. It does not frame the independent calculator as sponsored; a destination without a published URL is visibly pending rather than linked to a placeholder.
_Avoid_: Primary call to action, four duplicate episode cards, empty link, sponsor branding in the calculator

**Onboarding**:
A skippable, replayable first-visit interface tour that teaches height input, posture switching, and 3D scene controls without blocking calculator use or changing and saving fit estimates.
_Avoid_: Calibration, required setup

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
The complete `145–205 cm` input range in which every adjustable assembly must remain connected and collision-free.
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
