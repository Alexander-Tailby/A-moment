// Decode the selected anatomical meshes into a local script asset for file://.
// Dependencies: draco3d. Source and asset license are recorded in SOURCES.md.
const fs = require("fs");
const draco = require(
  process.env.STILL_BUILD_DIR
    ? process.env.STILL_BUILD_DIR + "/node_modules/draco3d"
    : "draco3d",
);
(async () => {
  const bytes = fs.readFileSync("assets/brain-source.glb");
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + length));
  const binary = bytes.subarray(28 + length);
  const decoderModule = await draco.createDecoderModule({});
  const decoder = new decoderModule.Decoder();
  const meshes = [];
  for (const node of gltf.nodes) {
    const category = node.extras?.bx_cat;
    if (
      ![
        "cortex",
        "cerebellum",
        "brainstem",
        "arteries",
        "veins_sinuses",
      ].includes(category)
    )
      continue;
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const compressed = primitive.extensions.KHR_draco_mesh_compression;
      const view = gltf.bufferViews[compressed.bufferView];
      const chunk = binary.subarray(
        view.byteOffset,
        view.byteOffset + view.byteLength,
      );
      const buffer = new decoderModule.DecoderBuffer();
      buffer.Init(new Int8Array(chunk), chunk.length);
      const mesh = new decoderModule.Mesh();
      const status = decoder.DecodeBufferToMesh(buffer, mesh);
      if (!status.ok()) throw Error(status.error_msg());
      const positions = new Float32Array(mesh.num_points() * 3);
      const attribute = decoder.GetAttributeByUniqueId(
        mesh,
        compressed.attributes.POSITION,
      );
      const values = new decoderModule.DracoFloat32Array();
      decoder.GetAttributeFloatForAllPoints(mesh, attribute, values);
      for (let i = 0; i < positions.length; i++)
        positions[i] = values.GetValue(i);
      const indices = new Uint32Array(mesh.num_faces() * 3);
      const face = new decoderModule.DracoInt32Array();
      for (let i = 0; i < mesh.num_faces(); i++) {
        decoder.GetFaceFromMesh(mesh, i, face);
        for (let j = 0; j < 3; j++) indices[i * 3 + j] = face.GetValue(j);
      }
      meshes.push({
        name: node.name,
        category,
        positions: Buffer.from(positions.buffer).toString("base64"),
        indices: Buffer.from(indices.buffer).toString("base64"),
      });
      for (const value of [values, face, mesh, buffer])
        decoderModule.destroy(value);
    }
  }
  decoderModule.destroy(decoder);
  fs.writeFileSync(
    "assets/brain-meshes.js",
    "// Adapted Z-Anatomy / BodyParts3D meshes, CC BY-SA 4.0; see SOURCES.md.\nwindow.BRAIN_MESHES = " +
      JSON.stringify(meshes) +
      ";\n",
  );
  console.log("Decoded", meshes.length, "anatomical meshes.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
