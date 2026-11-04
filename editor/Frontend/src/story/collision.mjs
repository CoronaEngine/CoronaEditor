import { Box3, Line3, Matrix4, Vector3 } from 'three';
import { ExtendedTriangle, MeshBVH } from 'three-mesh-bvh';

// World meshes are rendered with Z reflected. Resolve the moving character capsule
// against the level's actual triangles in render coordinates, then convert back.
export function createLevelCollision(root) {
  const trees = [];
  const byGeometry = new Map();
  root.updateWorldMatrix(true, true);
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    let tree = byGeometry.get(mesh.geometry);
    if (!tree) {
      tree = new MeshBVH(mesh.geometry, { indirect: true });
      byGeometry.set(mesh.geometry, tree);
    }
    trees.push({
      tree,
      matrix: mesh.matrixWorld.clone(),
      inverse: new Matrix4().copy(mesh.matrixWorld).invert(),
    });
  });
  const segment = new Line3(),
    query = new Box3(),
    tri = new ExtendedTriangle();
  const contact = new Vector3(),
    onBody = new Vector3(),
    push = new Vector3();
  const radius = 0.27;
  return function constrain(position) {
    segment.start.set(position.x, position.y + radius, -position.z);
    segment.end.copy(segment.start);
    segment.end.y += 1.8 - radius * 2;
    for (let pass = 0; pass < 2; pass++) {
      let touched = false;
      for (const { tree, inverse, matrix } of trees) {
        query
          .makeEmpty()
          .expandByPoint(segment.start)
          .expandByPoint(segment.end)
          .expandByScalar(radius)
          .applyMatrix4(inverse);
        tree.shapecast({
          intersectsBounds: (bounds) => bounds.intersectsBox(query),
          intersectsTriangle(source) {
            tri.a.copy(source.a).applyMatrix4(matrix);
            tri.b.copy(source.b).applyMatrix4(matrix);
            tri.c.copy(source.c).applyMatrix4(matrix);
            tri.needsUpdate = true;
            const gap = tri.closestPointToSegment(segment, contact, onBody);
            if (gap >= radius - 1e-5) return false;
            push.subVectors(onBody, contact);
            if (gap < 1e-8) tri.getNormal(push);
            push.normalize().multiplyScalar(radius - gap);
            segment.start.add(push);
            segment.end.add(push);
            touched = true;
            return false;
          },
        });
      }
      if (!touched) break;
    }
    return { x: segment.start.x, y: segment.start.y - radius, z: -segment.start.z };
  };
}
