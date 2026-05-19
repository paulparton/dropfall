export const SKY_VERTEX_SHADER = `
varying vec3 vWorldPosition;

void main() {
    vWorldPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
