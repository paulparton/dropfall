// ============================================================================
// Signed Distance Field (SDF) Functions
// Complete library of SDF primitives and operations for Dropfall game
// ============================================================================

// === CONSTANTS ===
const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const float EPSILON = 0.001;
const float MAX_DIST = 1000.0;

// === PRIMITIVE SDFs ===

// Sphere at origin
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

// Box centered at origin
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Infinite cylinder along Y axis
float sdCylinder(vec3 p, float r) {
    return length(p.xz) - r;
}

// Hexagonal prism (for arena tiles)
float sdHexPrism(vec3 p, vec2 h) {
    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
    vec2 d = vec2(
        length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x), 
        p.z - h.y
    );
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Capsule (similar to elongated sphere)
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

// Plane
float sdPlane(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}

// === MODIFICATION OPERATIONS ===

// Elongate a primitive along an axis
float opElongate(float sdf, vec3 p, vec3 h) {
    vec3 q = abs(p) - h;
    return sdf + length(max(q, 0.0)) - min(max(q.x, max(q.y, q.z)), 0.0);
}

// Round/inflate a shape
float opRound(float sdf, float rad) {
    return sdf - rad;
}

// Onion effect (hollow shell)
float opOnion(float sdf, float thickness) {
    return abs(sdf) - thickness;
}

// === BOOLEAN OPERATIONS ===

// Union
float opUnion(float a, float b) {
    return min(a, b);
}

// Subtraction (a - b)
float opSubtraction(float a, float b) {
    return max(-a, b);
}

// Intersection
float opIntersection(float a, float b) {
    return max(a, b);
}

// Smooth union
float opSmoothUnion(float a, float b, float k) {
    k *= 4.0;
    float h = max(k - abs(a - b), 0.0);
    return min(a, b) - h * h * 0.25 / k;
}

// Smooth subtraction
float opSmoothSubtraction(float a, float b, float k) {
    k *= 4.0;
    float h = max(k - abs(-a - b), 0.0);
    return max(-a, b) + h * h * 0.25 / k;
}

// Smooth intersection
float opSmoothIntersection(float a, float b, float k) {
    k *= 4.0;
    float h = max(k - abs(a - b), 0.0);
    return max(a, b) + h * h * 0.25 / k;
}

// === TRANSFORMATION OPERATIONS ===

// Translation (move point, then apply SDF)
vec3 opTx(vec3 p, vec3 offset) {
    return p - offset;
}

// Uniform scale
float opScale(vec3 p, float scale, float sdf) {
    return sdf / scale;
}

// Rotation around Y axis
vec3 rotateY(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// Rotation around X axis
vec3 rotateX(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

// Rotation around Z axis
vec3 rotateZ(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

// === REPETITION ===

// Infinite repetition
vec3 opRep(vec3 p, vec3 c) {
    return mod(p + 0.5 * c, c) - 0.5 * c;
}

// Limited repetition
vec3 opRepLimited(vec3 p, vec3 c, vec3 l) {
    vec3 q = p - c * clamp(round(p / c), -l, l);
    return q;
}

// === DEFORMATIONS ===

// Twist deformation
vec3 opTwist(vec3 p, float k) {
    float c = cos(k * p.y);
    float s = sin(k * p.y);
    mat2 m = mat2(c, -s, s, c);
    return vec3(m * p.xz, p.y);
}

// Bend deformation
vec3 opBend(vec3 p, float k) {
    float c = cos(k * p.x);
    float s = sin(k * p.x);
    mat2 m = mat2(c, -s, s, c);
    return vec3(m * p.xy, p.z);
}

// === UTILITY FUNCTIONS ===

// Normal calculation (gradient of SDF)
vec3 calcNormal(vec3 p, float surfaceOffset) {
    const vec3 e = vec3(EPSILON, 0.0, 0.0);
    float d = sceneSDF(p + surfaceOffset * normalize(vec3(1.0)));
    return normalize(vec3(
        sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
        sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
        sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
    ));
}

// Smooth step
float smoothstep(float a, float b, float t) {
    t = clamp((t - a) / (b - a), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

// Linear step
float linearstep(float a, float b, float t) {
    return clamp((t - a) / (b - a), 0.0, 1.0);
}

// Color mapping based on distance
vec3 sdToColor(float d) {
    return vec3(
        sin(d * 0.5 + 0.0) * 0.5 + 0.5,
        sin(d * 0.5 + 2.0) * 0.5 + 0.5,
        sin(d * 0.5 + 4.0) * 0.5 + 0.5
    );
}
