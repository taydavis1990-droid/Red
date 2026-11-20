import argparse
import json
import os
import struct
import sys

import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Conservatively export the current Blender file to GLB.")
    parser.add_argument("--output", required=True, help="Destination .glb path.")
    parser.add_argument(
        "--max-texture-size",
        type=int,
        default=0,
        help="Optional maximum image side length. Images are never enlarged; zero preserves source sizes.",
    )
    parser.add_argument("--report", help="Write the export summary as JSON.")
    return parser.parse_args(argv)


def scene_materials():
    return {
        slot.material
        for obj in bpy.context.scene.objects
        for slot in obj.material_slots
        if slot.material
    }


def prepare_standard_materials():
    incompatible = []
    for material in scene_materials():
        if not material.use_nodes:
            material.use_nodes = True
            principled = next(
                (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
                None,
            )
            if principled:
                principled.inputs["Base Color"].default_value = material.diffuse_color

        node_tree = material.node_tree
        if not node_tree:
            incompatible.append(material.name)
            continue

        active_output = next(
            (
                node for node in node_tree.nodes
                if node.type == "OUTPUT_MATERIAL" and getattr(node, "is_active_output", False)
            ),
            None,
        )
        surface = active_output.inputs.get("Surface") if active_output else None
        surface_node = surface.links[0].from_node if surface and surface.is_linked else None
        if not surface_node or surface_node.type != "BSDF_PRINCIPLED":
            incompatible.append(material.name)
            continue

        subsurface = surface_node.inputs.get("Subsurface Weight")
        if subsurface:
            subsurface.default_value = 0.0

    if incompatible:
        names = ", ".join(sorted(incompatible))
        raise RuntimeError(
            "These materials do not use a Principled BSDF directly at the active Material Output: "
            + names
            + ". Rebuild and visually review them as PBR materials in Blender before exporting."
        )


def resize_images(max_size):
    if max_size <= 0:
        return []
    resized = []
    for image in bpy.data.images:
        if image.users == 0:
            continue
        width, height = image.size
        largest_side = max(width, height)
        if largest_side <= max_size or width <= 0 or height <= 0:
            continue
        ratio = max_size / largest_side
        image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
        resized.append({
            "name": image.name,
            "from": [width, height],
            "to": list(image.size),
        })
    return resized


def read_glb_summary(path):
    with open(path, "rb") as glb:
        header = glb.read(12)
        if len(header) != 12:
            raise RuntimeError("The exported GLB is missing its header.")
        magic, version, declared_length = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2 or declared_length != os.path.getsize(path):
            raise RuntimeError("The exported file is not a valid glTF 2.0 binary container.")

        document = None
        while glb.tell() < declared_length:
            chunk_header = glb.read(8)
            if len(chunk_header) != 8:
                raise RuntimeError("The exported GLB contains a truncated chunk header.")
            chunk_length, chunk_type = struct.unpack("<II", chunk_header)
            chunk = glb.read(chunk_length)
            if len(chunk) != chunk_length:
                raise RuntimeError("The exported GLB contains a truncated chunk.")
            if chunk_type == 0x4E4F534A:
                document = json.loads(chunk.decode("utf-8").rstrip(" \t\r\n\0"))
                break

    if document is None:
        raise RuntimeError("The exported GLB has no JSON document chunk.")
    return document


def glb_triangle_count(document):
    triangle_count = 0
    accessors = document.get("accessors", [])
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            mode = primitive.get("mode", 4)
            if mode not in (4, 5, 6):
                continue
            accessor_index = primitive.get("indices")
            if accessor_index is None:
                accessor_index = primitive.get("attributes", {}).get("POSITION")
            if accessor_index is None or accessor_index >= len(accessors):
                continue
            element_count = accessors[accessor_index]["count"]
            triangle_count += element_count // 3 if mode == 4 else max(0, element_count - 2)
    return triangle_count


def glb_vertex_count(document):
    accessors = document.get("accessors", [])
    return sum(
        accessors[position_index]["count"]
        for mesh in document.get("meshes", [])
        for primitive in mesh.get("primitives", [])
        if (position_index := primitive.get("attributes", {}).get("POSITION")) is not None
        and position_index < len(accessors)
    )


def main():
    args = parse_args()
    if args.max_texture_size < 0:
        raise ValueError("--max-texture-size must be zero or a positive integer.")

    output_path = os.path.abspath(args.output)
    if not output_path.lower().endswith(".glb"):
        raise ValueError("--output must end in .glb.")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    prepare_standard_materials()
    resized_images = resize_images(args.max_texture_size)

    # Purge only datablocks Blender confirms are unused; referenced meshes, weights,
    # armatures, materials, images, and actions remain in the scene.
    bpy.data.orphans_purge(do_recursive=True)

    result = bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_skins=True,
        export_animations=True,
        export_materials="EXPORT",
        export_apply=False,
        export_keep_originals=False,
        export_nla_strips=True,
        export_force_sampling=True,
    )
    if "FINISHED" not in result or not os.path.isfile(output_path):
        raise RuntimeError("Blender's glTF exporter did not produce the requested GLB.")

    glb_document = read_glb_summary(output_path)
    if any(image.get("uri") for image in glb_document.get("images", [])):
        raise RuntimeError("The GLB references an external image instead of embedding it.")
    if any(buffer.get("uri") for buffer in glb_document.get("buffers", [])):
        raise RuntimeError("The GLB references an external buffer instead of embedding it.")
    joint_nodes = {
        node_index
        for skin in glb_document.get("skins", [])
        for node_index in skin.get("joints", [])
    }
    scene_images = {
        node.image
        for material in scene_materials()
        if material.use_nodes and material.node_tree
        for node in material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image
    }
    image_sizes = [
        max(image.size)
        for image in scene_images
        if image.size[0] > 0 and image.size[1] > 0
    ]
    summary = {
        "output": output_path,
        "blender_version": bpy.app.version_string,
        "file_size_bytes": os.path.getsize(output_path),
        "mesh_count": len(glb_document.get("meshes", [])),
        "vertex_count": glb_vertex_count(glb_document),
        "face_count": glb_triangle_count(glb_document),
        "skin_count": len(glb_document.get("skins", [])),
        "skeleton_bone_count": len(joint_nodes),
        "animation_clips": [
            animation.get("name", f"Animation {index}")
            for index, animation in enumerate(glb_document.get("animations", []))
        ],
        "embedded_image_count": len(glb_document.get("images", [])),
        "max_texture_size": max(image_sizes, default=0),
        "resized_images": resized_images,
        "external_dependencies": 0,
    }

    rendered = json.dumps(summary, indent=2, sort_keys=True)
    if args.report:
        os.makedirs(os.path.dirname(os.path.abspath(args.report)), exist_ok=True)
        with open(args.report, "w", encoding="utf-8") as report_file:
            report_file.write(rendered + "\n")
    print(rendered)


if __name__ == "__main__":
    main()
