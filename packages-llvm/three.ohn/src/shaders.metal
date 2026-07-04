#include <metal_stdlib>
using namespace metal;

// Unpack our 32-bit Bit-Packed Fixed-Precision struct
inline float unpack_fixed(int32_t packed) {
    int32_t value = packed >> 6;
    uint32_t scale = packed & 0x3F;
    return (float)value / exp2((float)scale);
}

// The static geometry data layout (passed in buffer(0) as 32-bit packed ints)
struct VertexIn {
    int32_t x;
    int32_t y;
    int32_t z;
    int32_t r;
    int32_t g;
    int32_t b;
    int32_t a;
};

// The dynamic uniform data layout (passed in buffer(1) as 16 packed ints)
struct InstanceData {
    int32_t m0, m1, m2, m3;
    int32_t m4, m5, m6, m7;
    int32_t m8, m9, m10, m11;
    int32_t m12, m13, m14, m15;
};

// What we pass from the Vertex Shader to the Fragment Shader
struct VertexOut {
    float4 position [[position]];
    float4 color;
};

vertex VertexOut vertex_main(
    uint vertexID [[vertex_id]],
    uint instanceID [[instance_id]],
    constant VertexIn *vertices [[buffer(0)]],
    constant InstanceData *instances [[buffer(1)]]) 
{
    VertexOut out;
    
    // 1. Grab the raw static vertex
    VertexIn v = vertices[vertexID];
    
    // Unpack geometry and color
    float3 pos = float3(unpack_fixed(v.x), unpack_fixed(v.y), unpack_fixed(v.z));
    float4 color = float4(unpack_fixed(v.r), unpack_fixed(v.g), unpack_fixed(v.b), unpack_fixed(v.a));
    
    // 2. Grab the transformation matrix for this specific instance
    InstanceData inst = instances[instanceID];
    
    // Unpack the 4x4 matrix (Metal matrices are Column-Major)
    float4x4 transform = float4x4(
        float4(unpack_fixed(inst.m0), unpack_fixed(inst.m1), unpack_fixed(inst.m2), unpack_fixed(inst.m3)),
        float4(unpack_fixed(inst.m4), unpack_fixed(inst.m5), unpack_fixed(inst.m6), unpack_fixed(inst.m7)),
        float4(unpack_fixed(inst.m8), unpack_fixed(inst.m9), unpack_fixed(inst.m10), unpack_fixed(inst.m11)),
        float4(unpack_fixed(inst.m12), unpack_fixed(inst.m13), unpack_fixed(inst.m14), unpack_fixed(inst.m15))
    );
    
    // 3. Multiply the local vertex by the transform matrix to get world space
    out.position = transform * float4(pos, 1.0);
    out.color = color;
    
    return out;
}

fragment float4 fragment_main(VertexOut in [[stage_in]]) {
    return in.color;
}
