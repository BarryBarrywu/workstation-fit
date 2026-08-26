import { readFileSync, writeFileSync } from 'node:fs';

const componentSizes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const itemSizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function parseGlb(path) {
  const file = readFileSync(path);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
  const binaryHeader = 20 + jsonLength;
  const binaryLength = file.readUInt32LE(binaryHeader);
  const binary = file.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength);
  return { json, binary };
}

function encodeAccessor(model, accessorIndex) {
  const accessor = model.json.accessors[accessorIndex];
  const view = model.json.bufferViews[accessor.bufferView];
  const componentSize = componentSizes[accessor.componentType];
  const itemSize = itemSizes[accessor.type];
  if (!componentSize || !itemSize || accessor.sparse) throw new Error(`Unsupported accessor ${accessorIndex}`);
  const packedStride = componentSize * itemSize;
  const sourceStride = view.byteStride ?? packedStride;
  const sourceOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const output = Buffer.alloc(accessor.count * packedStride);
  for (let index = 0; index < accessor.count; index += 1) {
    model.binary.copy(output, index * packedStride, sourceOffset + index * sourceStride, sourceOffset + index * sourceStride + packedStride);
  }
  return {
    componentType: accessor.componentType,
    count: accessor.count,
    itemSize,
    normalized: Boolean(accessor.normalized),
    data: output.toString('base64'),
  };
}

function compactModel(path) {
  const model = parseGlb(path);
  const accessorMap = new Map();
  const accessor = (index) => {
    if (!accessorMap.has(index)) accessorMap.set(index, encodeAccessor(model, index));
    return accessorMap.get(index);
  };
  const materials = (model.json.materials ?? []).map((material) => ({
    name: material.name ?? '',
    color: material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1],
    metalness: material.pbrMetallicRoughness?.metallicFactor ?? 1,
    roughness: material.pbrMetallicRoughness?.roughnessFactor ?? 1,
    emissive: material.emissiveFactor ?? [0, 0, 0],
    doubleSided: Boolean(material.doubleSided),
  }));
  const meshes = model.json.meshes.map((mesh) => ({
    name: mesh.name ?? '',
    primitives: mesh.primitives.map((primitive) => ({
      position: accessor(primitive.attributes.POSITION),
      normal: primitive.attributes.NORMAL === undefined ? null : accessor(primitive.attributes.NORMAL),
      indices: primitive.indices === undefined ? null : accessor(primitive.indices),
      material: primitive.material ?? null,
    })),
  }));
  const nodes = model.json.nodes.map((node) => ({
    name: node.name ?? '',
    mesh: node.mesh ?? null,
    children: node.children ?? [],
    translation: node.translation,
    rotation: node.rotation,
    scale: node.scale,
    matrix: node.matrix,
  }));
  return { roots: model.json.scenes[model.json.scene ?? 0].nodes, materials, meshes, nodes };
}

export function writeModelPayload({ robotPath, furniturePath, outputPath }) {
  const payload = { robot: compactModel(robotPath), furniture: compactModel(furniturePath) };
  writeFileSync(outputPath, `window.__JIUWEI_MODEL_DATA__=${JSON.stringify(payload)};\n`);
}
