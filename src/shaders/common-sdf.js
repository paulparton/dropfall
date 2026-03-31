export const COMMON_SDF_GLSL = `
#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);

    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    vec3 u = f * f * (3.0 - 2.0 * f);

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);

    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z);
}

float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 8; i++) {
        if (i >= octaves) {
            break;
        }
        value += amplitude * noise2D(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

float fbm3(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 8; i++) {
        if (i >= octaves) {
            break;
        }
        value += amplitude * noise3D(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float sdBox2D(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdHexagon(vec2 p, float r) {
    const vec3 k = vec3(-0.8660254038, 0.5, 0.5773502692);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float sdTriangle(vec2 p, vec2 a, vec2 b, vec2 c) {
    vec2 e0 = b - a;
    vec2 e1 = c - b;
    vec2 e2 = a - c;

    vec2 v0 = p - a;
    vec2 v1 = p - b;
    vec2 v2 = p - c;

    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);

    float s = sign(e0.x * e2.y - e0.y * e2.x);

    vec2 d = min(
        min(
            vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
            vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))
        ),
        vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x))
    );

    return -sqrt(d.x) * sign(d.y);
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float opUnion(float d1, float d2) {
    return min(d1, d2);
}

float opSubtraction(float d1, float d2) {
    return max(-d2, d1);
}

float opIntersection(float d1, float d2) {
    return max(d1, d2);
}

float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
}

vec2 voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);

    float d1 = 1e9;
    float d2 = 1e9;

    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(hash21(n + g), hash21(n + g + vec2(19.19, 73.27)));
            vec2 r = g + o - f;
            float d = dot(r, r);

            if (d < d1) {
                d2 = d1;
                d1 = d;
            } else if (d < d2) {
                d2 = d;
            }
        }
    }

    return vec2(sqrt(d1), sqrt(d2));
}

vec2 grad2D(vec2 p) {
    float a = hash(p) * TAU;
    return vec2(cos(a), sin(a));
}

float gradientNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    float n00 = dot(grad2D(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
    float n10 = dot(grad2D(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
    float n01 = dot(grad2D(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
    float n11 = dot(grad2D(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

    return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y) * 0.5 + 0.5;
}

float ridgeNoise(vec2 p) {
    return 1.0 - abs(gradientNoise(p) * 2.0 - 1.0);
}

float ridgeFbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    float prev = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) {
            break;
        }
        float n = ridgeNoise(p * frequency);
        n = n * n;
        value += n * amplitude * prev;
        prev = n;
        frequency *= 2.2;
        amplitude *= 0.5;
    }
    return value;
}

float warpedFbm(vec2 p, int octaves, float warpStrength) {
    vec2 q = vec2(
        fbm(p + vec2(5.2, 1.3), octaves),
        fbm(p + vec2(1.7, 9.2), octaves)
    );
    return fbm(p + q * warpStrength, octaves);
}

vec3 voronoiEdge(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);

    float minDist = 8.0;
    float secondDist = 8.0;
    vec2 minId = vec2(0.0);

    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(hash21(n + g), hash21(n + g + vec2(17.17, 53.53)));
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < minDist) {
                secondDist = minDist;
                minDist = d;
                minId = n + g;
            } else if (d < secondDist) {
                secondDist = d;
            }
        }
    }
    return vec3(sqrt(minDist), sqrt(secondDist) - sqrt(minDist), hash21(minId));
}

float sdArc(vec2 p, float ra, float rb, float angle) {
    p.x = abs(p.x);
    float sa = sin(angle);
    float ca = cos(angle);
    float k = (ca * p.x > sa * p.y) ? dot(p, vec2(sa, ca)) : length(p);
    return sqrt(max(0.0, dot(p, p) + ra * ra - 2.0 * ra * k)) - rb;
}

float sdCross(vec2 p, vec2 size, float r) {
    p = abs(p);
    p = (p.y > p.x) ? p.yx : p;
    vec2 q = p - size;
    float k = max(q.y, q.x);
    vec2 w = (k > 0.0) ? q : vec2(size.y - p.x, -k);
    return sign(k) * length(max(w, 0.0)) - r;
}

float sdNgon(vec2 p, float r, int n) {
    float an = PI / float(n);
    float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
    p = length(p) * vec2(cos(bn), abs(sin(bn)));
    p -= vec2(r, 0.0);
    p.y += clamp(-p.y, 0.0, r * tan(an));
    return length(p) * sign(p.x);
}
`;
