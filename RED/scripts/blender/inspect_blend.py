import argparse
import json
import os
import sys

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Inspect a Blender character asset.")
    parser.add_argument("--report", help="Write the JSON report to this path.")
    parser.add_argument("--render", help="Render a neutral asset preview to this path.")
    return parser.parse_args(argv)


def image_info(image):
    path = bpy.path.abspath(image.filepath) if image.filepath else ""
    return {
        "name": image.name,
        "source": image.source,
        "width": image.size[0],
        "height": image.size[1],
        "packed": image.packed_file is not None,
        "path": path or None,
        "exists": os.path.isfile(path) if path else None,
        "colorspace": image.colorspace_settings.name,
        "users": image.users,
    }


def material_info(material):
    node_types = []
    texture_nodes = []
    output_surface = None
    has_principled_surface = False
    pbr = None

    if material.use_nodes and material.node_tree:
        for node in material.node_tree.nodes:
            node_types.append(node.bl_idname)
            if node.type == "TEX_IMAGE" and node.image:
                texture_nodes.append({
                    "node": node.name,
                    "image": node.image.name,
                    "filepath": bpy.path.abspath(node.image.filepath) if node.image.filepath else None,
                })
            if node.type == "OUTPUT_MATERIAL" and getattr(node, "is_active_output", False):
                surface = node.inputs.get("Surface")
                if surface and surface.is_linked:
                    output_surface = surface.links[0].from_node.bl_idname
                    has_principled_surface = output_surface == "ShaderNodeBsdfPrincipled"
                    if has_principled_surface:
                        shader = surface.links[0].from_node

                        def input_value(name, fallback=None):
                            socket = shader.inputs.get(name)
                            if not socket:
                                return fallback
                            value = socket.default_value
                            return list(value) if hasattr(value, "__len__") else value

                        pbr = {
                            "base_color": input_value("Base Color"),
                            "metallic": input_value("Metallic", 0.0),
                            "roughness": input_value("Roughness", 0.5),
                            "alpha": input_value("Alpha", 1.0),
                        }

    return {
        "name": material.name,
        "users": material.users,
        "use_nodes": material.use_nodes,
        "diffuse_color": list(material.diffuse_color),
        "node_types": sorted(set(node_types)),
        "surface_shader": output_surface,
        "direct_principled_surface": has_principled_surface,
        "pbr": pbr,
        "image_textures": texture_nodes,
    }


def object_info(obj):
    info = {
        "name": obj.name,
        "type": obj.type,
        "dimensions": [round(value, 6) for value in obj.dimensions],
        "location": [round(value, 6) for value in obj.location],
        "rotation_euler_degrees": [
            round(value * 57.29577951308232, 4) for value in obj.rotation_euler
        ],
        "scale": [round(value, 6) for value in obj.scale],
        "parent": obj.parent.name if obj.parent else None,
        "materials": [slot.material.name for slot in obj.material_slots if slot.material],
        "nla_tracks": [
            {
                "name": track.name,
                "strips": [
                    {
                        "name": strip.name,
                        "action": strip.action.name if strip.action else None,
                        "frame_start": strip.frame_start,
                        "frame_end": strip.frame_end,
                    }
                    for strip in track.strips
                ],
            }
            for track in (obj.animation_data.nla_tracks if obj.animation_data else [])
        ],
        "active_action": (
            obj.animation_data.action.name
            if obj.animation_data and obj.animation_data.action
            else None
        ),
        "modifiers": [
            {"name": modifier.name, "type": modifier.type}
            for modifier in obj.modifiers
        ],
    }

    if obj.type == "MESH":
        mesh = obj.data
        mesh.calc_loop_triangles()
        info.update({
            "vertices": len(mesh.vertices),
            "polygons": len(mesh.polygons),
            "triangles": len(mesh.loop_triangles),
            "vertex_groups": [group.name for group in obj.vertex_groups],
            "armature_modifiers": [
                modifier.object.name
                for modifier in obj.modifiers
                if modifier.type == "ARMATURE" and modifier.object
            ],
        })
    elif obj.type == "ARMATURE":
        info["bones"] = [
            {
                "name": bone.name,
                "parent": bone.parent.name if bone.parent else None,
                "deform": bone.use_deform,
                "connected": bone.use_connect,
            }
            for bone in obj.data.bones
        ]

    return info


def render_preview(path, meshes):
    preview_meshes = [
        obj for obj in meshes
        if not obj.name.lower().startswith("shape_")
        and "control" not in obj.name.lower()
        and len(obj.data.polygons) > 2
        and max(obj.dimensions) < 10
        and obj.matrix_world.translation.length < 20
    ]
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in preview_meshes
        for corner in obj.bound_box
    ]
    if not corners:
        raise RuntimeError("Cannot render a preview without mesh objects.")
    minimum = Vector(tuple(min(point[axis] for point in corners) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in corners) for axis in range(3)))
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    largest = max(size)
    if largest <= 0:
        raise RuntimeError("Cannot render a preview for a zero-size model.")

    scene = bpy.context.scene
    engines = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.abspath(path)
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.world.color = (0.055, 0.06, 0.07)

    camera_data = bpy.data.cameras.new("AssetReviewCamera")
    camera = bpy.data.objects.new("AssetReviewCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = center + Vector((1.8, 1.15, 2.8)) * largest
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(size.x, size.y, size.z) * 1.7
    camera_data.lens = 50
    scene.camera = camera
    camera_data.clip_end = largest * 30 + 100

    lights = []
    for name, offset, energy, color in (
        ("AssetReviewKey", (2.5, 3.5, 3.2), 1500, (1.0, 0.82, 0.64)),
        ("AssetReviewFill", (-3.0, 1.2, 1.0), 850, (0.62, 0.73, 1.0)),
        ("AssetReviewRim", (0.0, 2.8, -3.2), 1200, (0.8, 0.88, 1.0)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = largest * 1.25
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = center + Vector(offset) * largest
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
        lights.append(light)

    bpy.ops.render.render(write_still=True)
    for light in lights:
        light_data = light.data
        bpy.data.objects.remove(light, do_unlink=True)
        bpy.data.lights.remove(light_data)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)


def main():
    args = parse_args()
    bpy.context.view_layer.update()
    scene_objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in scene_objects if obj.type == "MESH"]
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in meshes
        for corner in obj.bound_box
    ]
    bounds = None
    if corners:
        minimum = Vector(tuple(min(point[axis] for point in corners) for axis in range(3)))
        maximum = Vector(tuple(max(point[axis] for point in corners) for axis in range(3)))
        dimensions = maximum - minimum
        bounds = {
            "minimum": [round(value, 6) for value in minimum],
            "maximum": [round(value, 6) for value in maximum],
            "dimensions": [round(value, 6) for value in dimensions],
            "center": [round(value, 6) for value in (minimum + maximum) * 0.5],
        }
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)

    materials = {material.name: material for material in bpy.data.materials}
    external_images = [
        item for item in (image_info(image) for image in bpy.data.images)
        if not item["packed"] and item["path"]
    ]
    report = {
        "blend_file": bpy.data.filepath,
        "blender_version": bpy.app.version_string,
        "scene": bpy.context.scene.name if bpy.context.scene else None,
        "summary": {
            "object_count": len(scene_objects),
            "mesh_object_count": len(meshes),
            "triangle_count": triangles,
            "material_count": len(materials),
            "armature_count": sum(obj.type == "ARMATURE" for obj in scene_objects),
            "action_names": sorted(action.name for action in bpy.data.actions),
            "image_count": len(bpy.data.images),
            "external_image_count": len(external_images),
            "missing_external_images": [
                item["path"] for item in external_images if not item["exists"]
            ],
            "world_bounds": bounds,
            "actions": [
                {
                    "name": action.name,
                    "frame_start": round(action.frame_range[0], 4),
                    "frame_end": round(action.frame_range[1], 4),
                    "frame_count": round(action.frame_range[1] - action.frame_range[0], 4),
                    "fcurve_count": len(action.fcurves),
                    "data_paths": sorted({curve.data_path for curve in action.fcurves}),
                }
                for action in bpy.data.actions
            ],
        },
        "objects": [object_info(obj) for obj in scene_objects],
        "materials": [material_info(material) for material in materials.values()],
        "images": [image_info(image) for image in bpy.data.images],
    }

    rendered = json.dumps(report, indent=2, sort_keys=True)
    if args.render:
        render_preview(args.render, meshes)
    if args.report:
        os.makedirs(os.path.dirname(os.path.abspath(args.report)), exist_ok=True)
        with open(args.report, "w", encoding="utf-8") as output:
            output.write(rendered + "\n")
    print(rendered)


if __name__ == "__main__":
    main()
