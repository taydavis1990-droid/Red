import argparse
import json
import os
import sys

import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Inspect a Blender character asset.")
    parser.add_argument("--report", help="Write the JSON report to this path.")
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

    return {
        "name": material.name,
        "users": material.users,
        "use_nodes": material.use_nodes,
        "diffuse_color": list(material.diffuse_color),
        "node_types": sorted(set(node_types)),
        "surface_shader": output_surface,
        "direct_principled_surface": has_principled_surface,
        "image_textures": texture_nodes,
    }


def object_info(obj):
    info = {
        "name": obj.name,
        "type": obj.type,
        "dimensions": [round(value, 6) for value in obj.dimensions],
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


def main():
    args = parse_args()
    scene_objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in scene_objects if obj.type == "MESH"]
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
        },
        "objects": [object_info(obj) for obj in scene_objects],
        "materials": [material_info(material) for material in materials.values()],
        "images": [image_info(image) for image in bpy.data.images],
    }

    rendered = json.dumps(report, indent=2, sort_keys=True)
    if args.report:
        os.makedirs(os.path.dirname(os.path.abspath(args.report)), exist_ok=True)
        with open(args.report, "w", encoding="utf-8") as output:
            output.write(rendered + "\n")
    print(rendered)


if __name__ == "__main__":
    main()
