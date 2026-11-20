import argparse
import bmesh
import os
import runpy
import sys

import bpy
from mathutils import Euler, Vector


WEAPON_OBJECTS = {
    "broadsword": {"Cube", "Cylinder", "Cylinder.001"},
    "ornate-sword": {"Cube.001", "Cylinder.002", "Sphere"},
    "dagger": {"Cube.002", "Cube.003"},
    "bow": {
        "BezierCurve.001",
        "BezierCurve.002",
        "Circle",
        "Cone",
        "Cone.002",
        "Cylinder.003",
        "Cylinder.004",
        "Cylinder.006",
        "Plane.002", "Plane.003", "Plane.004",
        "Plane.008", "Plane.009", "Plane.010",
    },
    "staff": {
        "BezierCurve.003",
        "BezierCurve.004",
        "BezierCurve.005",
        "BezierCurve.006",
        "BezierCurve.007",
        "BezierCurve.008",
        "BezierCurve.009",
        "GG",
    },
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Prepare one reviewed R.E.D. Blender asset.")
    parser.add_argument(
        "--asset",
        required=True,
        choices=("wolf", "trex", "knight", *WEAPON_OBJECTS),
    )
    parser.add_argument("--output", required=True, help="Destination self-contained GLB.")
    parser.add_argument("--report", help="Destination GLB summary JSON.")
    parser.add_argument("--render", help="Render the prepared scene to this PNG.")
    parser.add_argument("--frame", type=int, default=5, help="Frame for the optional preview render.")
    parser.add_argument("--max-texture-size", type=int, default=2048)
    parser.add_argument("--strip-wolf-fur", action="store_true", help="Omit the source's detached fur-shell faces.")
    return parser.parse_args(argv)


def image_named(fragment):
    return next(
        (image for image in bpy.data.images if fragment.lower() in image.name.lower()),
        None,
    )


def set_pbr_material(material, base_image=None, normal_image=None):
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    lowered = material.name.lower()
    metal = any(word in lowered for word in (
        "steel", "metal", "brass", "copper", "blade", "silver", "gold",
    )) or ("dagger" in lowered and "handle" not in lowered)
    if "black" in lowered:
        color = (0.025, 0.032, 0.034, 1)
    elif any(word in lowered for word in ("brass", "copper", "gold")):
        color = (0.42, 0.24, 0.075, 1)
    elif metal:
        color = (0.28, 0.34, 0.36, 1)
    elif any(word in lowered for word in ("leather", "scabre", "handle")):
        color = (0.15, 0.075, 0.035, 1)
    elif any(word in lowered for word in ("wood", "staff", "bow")):
        color = (0.18, 0.095, 0.045, 1)
    elif "fur" in lowered:
        color = (0.34, 0.24, 0.15, 1)
    else:
        color = tuple(material.diffuse_color)
    material.diffuse_color = color
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = 0.72 if metal else 0.0
    shader.inputs["Roughness"].default_value = 0.32 if metal else 0.78
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    if base_image:
        base_image.colorspace_settings.name = "sRGB"
        image_node = nodes.new("ShaderNodeTexImage")
        image_node.image = base_image
        material.node_tree.links.new(image_node.outputs["Color"], shader.inputs["Base Color"])
    if normal_image:
        normal_image.colorspace_settings.name = "Non-Color"
        image_node = nodes.new("ShaderNodeTexImage")
        image_node.image = normal_image
        normal = nodes.new("ShaderNodeNormalMap")
        material.node_tree.links.new(image_node.outputs["Color"], normal.inputs["Color"])
        material.node_tree.links.new(normal.outputs["Normal"], shader.inputs["Normal"])


def make_wolf_materials():
    for material in {slot.material for obj in bpy.context.scene.objects for slot in obj.material_slots if slot.material}:
        name = material.name.lower()
        if "body" in name:
            image = image_named("Wolf_Body.jpg")
        elif "eyes" in name:
            image = image_named("Wolf_Eyes_1.jpg")
        else:
            image = None
        set_pbr_material(material, image)


def make_trex_materials(meshes):
    materials = {
        slot.material
        for obj in meshes
        for slot in obj.material_slots
        if slot.material
    }
    for material in materials:
        base = None
        normal = None
        if material.name == "Material":
            material.diffuse_color = (0.25, 0.18, 0.1, 1)
        elif material.name == "Material.001":
            base = image_named("tuto trex textura paint")
            normal = image_named("tuto trex normal map")
        elif material.name == "Material.002":
            base = image_named("dentadura inferior")
        elif material.name == "Material.003":
            base = image_named("dentadura superior")
        elif material.name == "Material.008":
            base = image_named("t_rex_eye")
        set_pbr_material(material, base, normal)


def mesh_bounds(meshes):
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in meshes
        for corner in obj.bound_box
    ]
    if not points:
        raise RuntimeError("The selected asset has no mesh bounds.")
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def orient_weapon(asset, meshes):
    if asset not in {"dagger", "staff"}:
        return
    minimum, maximum = mesh_bounds(meshes)
    pivot = (minimum + maximum) * 0.5
    rotation = Euler((0, 0, 1.5707963267948966), "XYZ").to_matrix()
    for obj in meshes:
        obj.location = pivot + rotation @ (obj.matrix_world.translation - pivot)
        obj.rotation_euler.z += 1.5707963267948966


def move_selected_to_origin(selected, meshes):
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds(meshes)
    shift = Vector(((minimum.x + maximum.x) * 0.5, (minimum.y + maximum.y) * 0.5, minimum.z))
    selected_set = set(selected)
    roots = [obj for obj in selected if obj.parent not in selected_set]
    for obj in roots:
        obj.location -= shift
    bpy.context.view_layer.update()


def keep_only(selected):
    keep = set(selected)
    for obj in list(bpy.context.scene.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)


def parent_meshes_to_armature(armature, meshes):
    for mesh in meshes:
        if mesh.parent is armature:
            continue
        world_matrix = mesh.matrix_world.copy()
        mesh.parent = armature
        mesh.matrix_world = world_matrix


def descendant_objects(root):
    descendants = set()
    pending = list(root.children)
    while pending:
        child = pending.pop()
        if child in descendants:
            continue
        descendants.add(child)
        pending.extend(child.children)
    return descendants


def prepare_wolf(strip_fur=False):
    armature = next((obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"), None)
    if not armature:
        raise RuntimeError("The wolf source has no armature.")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    make_wolf_materials()
    if strip_fur:
        for mesh_object in meshes:
            fur_slots = {
                index for index, material in enumerate(mesh_object.data.materials)
                if material and material.name == "Wolf_Fur"
            }
            if not fur_slots:
                continue
            mesh_data = bmesh.new()
            mesh_data.from_mesh(mesh_object.data)
            for face in list(mesh_data.faces):
                if face.material_index in fur_slots:
                    mesh_data.faces.remove(face)
            mesh_data.to_mesh(mesh_object.data)
            mesh_data.free()
            mesh_object.data.update()
    parent_meshes_to_armature(armature, meshes)

    animation_data = armature.animation_data_create()
    for track in list(animation_data.nla_tracks):
        animation_data.nla_tracks.remove(track)
    animation_data.action = None
    invalid_actions = []
    for action in list(bpy.data.actions):
        start, end = action.frame_range
        if end <= start or action.name == "000":
            invalid_actions.append(action)
            continue
        track = animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, int(start), action)
        strip.action_frame_start = start
        strip.action_frame_end = end
        strip.blend_type = "REPLACE"
        track.mute = False
    for action in invalid_actions:
        bpy.data.actions.remove(action)

    keep_only([armature, *meshes])
    move_selected_to_origin([armature, *meshes], meshes)


def prepare_trex():
    armature = next(
        (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE" and obj.name == "Armature"),
        None,
    )
    if not armature:
        raise RuntimeError("The T-Rex source has no expected Armature object.")
    named_meshes = {obj.name: obj for obj in bpy.context.scene.objects if obj.type == "MESH"}
    required = ("t-rex", "lowerteeth", "upperteeth")
    missing = [name for name in required if name not in named_meshes]
    if missing:
        raise RuntimeError("The T-Rex source is missing expected meshes: " + ", ".join(missing))
    meshes = [named_meshes[name] for name in required]
    make_trex_materials(meshes)
    armature.animation_data_create()
    action = bpy.data.actions.get("ArmatureAction")
    if action:
        armature.animation_data.action = action
    for pose_bone in armature.pose.bones:
        pose_bone.custom_shape = None
        pose_bone.custom_shape_transform = None
    parent_meshes_to_armature(armature, meshes)
    keep_only([armature, *meshes])
    move_selected_to_origin([armature, *meshes], meshes)


def prepare_knight():
    armature = bpy.data.objects.get("Knight_rig")
    if not armature or armature.type != "ARMATURE":
        raise RuntimeError("The knight source has no expected Knight_rig armature.")
    selected = [armature, *descendant_objects(armature)]
    meshes = [obj for obj in selected if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("The knight rig has no child meshes.")
    keep_only(selected)
    for image in bpy.data.images:
        if image.users and not image.packed_file and image.has_data:
            image.pack()
    move_selected_to_origin(selected, meshes)


def prepare_weapon(asset):
    names = WEAPON_OBJECTS[asset]
    available = {obj.name: obj for obj in bpy.context.scene.objects}
    meshes = [available[name] for name in names if name in available]
    if len(meshes) != len(names):
        missing = sorted(names - available.keys())
        raise RuntimeError(f"{asset} is missing Blender meshes: {', '.join(missing)}")
    for obj in meshes:
        for modifier in obj.modifiers:
            if modifier.type == "SUBSURF":
                modifier.levels = min(modifier.levels, 2)
                modifier.render_levels = min(modifier.render_levels, 2)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.convert(target="MESH")
    meshes = [obj for obj in bpy.context.scene.objects if obj.select_get()]
    orient_weapon(asset, meshes)
    materials = {slot.material for obj in meshes for slot in obj.material_slots if slot.material}
    for material in materials:
        image = next(
            (node.image for node in material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image),
            None,
        ) if material.use_nodes and material.node_tree else None
        if image and not image.packed_file and image.filepath and not os.path.isfile(bpy.path.abspath(image.filepath)):
            image = None
        set_pbr_material(material, image)
    keep_only(meshes)
    move_selected_to_origin(meshes, meshes)


def main():
    args = parse_args()
    if args.max_texture_size < 0:
        raise ValueError("--max-texture-size must not be negative.")
    if args.asset == "wolf":
        prepare_wolf(args.strip_wolf_fur)
    elif args.asset == "trex":
        prepare_trex()
    elif args.asset == "knight":
        prepare_knight()
    else:
        prepare_weapon(args.asset)

    if args.render:
        bpy.context.scene.frame_set(args.frame)
        inspector = os.path.join(os.path.dirname(__file__), "inspect_blend.py")
        helpers = runpy.run_path(inspector)
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        helpers["render_preview"](args.render, meshes)

    exporter = os.path.join(os.path.dirname(__file__), "export_glb.py")
    arguments = ["--", "--output", args.output, "--max-texture-size", str(args.max_texture_size)]
    if args.report:
        arguments.extend(("--report", args.report))
    sys.argv = [exporter, *arguments]
    runpy.run_path(exporter)["main"]()


if __name__ == "__main__":
    main()
