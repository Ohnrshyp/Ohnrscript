#import <Cocoa/Cocoa.h>
#import <Metal/Metal.h>
#import <MetalKit/MetalKit.h>

// Forward declaration to the Ohnrscript tick function compiled by LLVM
extern void ohn_tick();

// Import the global memory heap from the runtime
extern uint8_t* ohn_heap_base;

// We use opaque handles in Ohnrscript. Max 1024 buffers for this prototype.
#define MAX_BUFFERS 1024

// Triple buffering for dynamic data
#define MAX_BUFFERS_IN_FLIGHT 3

typedef struct {
    id<MTLBuffer> mtlBuffer;
    BOOL isDynamic;
    
    // For dynamic buffers:
    id<MTLBuffer> dynamicSlices[MAX_BUFFERS_IN_FLIGHT];
    NSUInteger size;
} BufferHandle;

// Global State
static BufferHandle g_buffers[MAX_BUFFERS];
static int32_t g_bufferCount = 0;

static id<MTLDevice> g_device = nil;
static id<MTLCommandQueue> g_commandQueue = nil;
static id<MTLRenderPipelineState> g_pipelineState = nil;

static id<MTLRenderCommandEncoder> g_currentEncoder = nil;
static NSUInteger g_currentFrameIndex = 0;
static dispatch_semaphore_t g_inFlightSemaphore;

// ---------------------------------------------------------
// MTKViewDelegate (The Render Loop)
// ---------------------------------------------------------
@interface Renderer : NSObject <MTKViewDelegate>
@end

@implementation Renderer

- (void)mtkView:(MTKView *)view drawableSizeWillChange:(CGSize)size {
    // Handle resize if needed
}

- (void)drawInMTKView:(MTKView *)view {
    // Wait for the GPU to finish the oldest frame in the triple-buffer ring
    dispatch_semaphore_wait(g_inFlightSemaphore, DISPATCH_TIME_FOREVER);
    
    g_currentFrameIndex = (g_currentFrameIndex + 1) % MAX_BUFFERS_IN_FLIGHT;
    
    id<MTLCommandBuffer> commandBuffer = [g_commandQueue commandBuffer];
    
    // Add completion block to signal the semaphore when the GPU finishes this frame
    __block dispatch_semaphore_t block_sema = g_inFlightSemaphore;
    [commandBuffer addCompletedHandler:^(id<MTLCommandBuffer> buffer) {
        dispatch_semaphore_signal(block_sema);
    }];
    
    MTLRenderPassDescriptor *renderPassDescriptor = view.currentRenderPassDescriptor;
    if (renderPassDescriptor != nil) {
        id<MTLRenderCommandEncoder> encoder = [commandBuffer renderCommandEncoderWithDescriptor:renderPassDescriptor];
        g_currentEncoder = encoder;
        
        // 1. Set global state
        [encoder setRenderPipelineState:g_pipelineState];
        [encoder setFrontFacingWinding:MTLWindingCounterClockwise];
        [encoder setCullMode:MTLCullModeBack];
        
        // 2. Call into Ohnrscript! (Inversion of Control)
        ohn_tick();
        
        // 3. Teardown
        [encoder endEncoding];
        [commandBuffer presentDrawable:view.currentDrawable];
        g_currentEncoder = nil;
    }
    
    [commandBuffer commit];
}
@end

// ---------------------------------------------------------
// Application Delegate
// ---------------------------------------------------------
@interface AppDelegate : NSObject <NSApplicationDelegate, NSWindowDelegate>
@property (nonatomic, strong) NSWindow *window;
@property (nonatomic, strong) MTKView *mtkView;
@property (nonatomic, strong) Renderer *renderer;
@end

@implementation AppDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    NSRect frame = NSMakeRect(0, 0, 800, 600);
    self.window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:(NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskResizable)
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    [self.window setTitle:@"Ohnrscript - three.ohn"];
    [self.window center];
    
    self.mtkView = [[MTKView alloc] initWithFrame:frame device:g_device];
    self.mtkView.colorPixelFormat = MTLPixelFormatBGRA8Unorm_sRGB;
    self.mtkView.clearColor = MTLClearColorMake(0.1, 0.1, 0.1, 1.0); // Dark grey background
    self.window.contentView = self.mtkView;
    
    self.renderer = [[Renderer alloc] init];
    self.mtkView.delegate = self.renderer;
    
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}
@end

// ---------------------------------------------------------
// C FFI Bindings for Ohnrscript
// ---------------------------------------------------------

int64_t sys_math_sin(int32_t frame) {
    float f = (float)frame * 0.02f;
    float result = sinf(f);
    
    int32_t new_scale = 14;
    int32_t new_value = (int32_t)(result * 16384.0f);
    return ((new_value & 0x3FFFFFF) << 6) | new_scale;
}

int64_t sys_math_cos(int32_t frame) {
    float f = (float)frame * 0.02f;
    float result = cosf(f);
    
    int32_t new_scale = 14;
    int32_t new_value = (int32_t)(result * 16384.0f);
    return ((new_value & 0x3FFFFFF) << 6) | new_scale;
}

int64_t sys_metal_init() {
    g_device = MTLCreateSystemDefaultDevice();
    g_commandQueue = [g_device newCommandQueue];
    g_inFlightSemaphore = dispatch_semaphore_create(MAX_BUFFERS_IN_FLIGHT);
    
    // Load the compiled shaders
    NSError *error = nil;
    NSURL *libraryURL = [NSURL fileURLWithPath:@"shaders.metallib"];
    id<MTLLibrary> defaultLibrary = [g_device newLibraryWithURL:libraryURL error:&error];
    if (!defaultLibrary) {
        NSLog(@"Failed to load shaders.metallib: %@", error);
        return 0;
    }
    
    id<MTLFunction> vertexFunction = [defaultLibrary newFunctionWithName:@"vertex_main"];
    id<MTLFunction> fragmentFunction = [defaultLibrary newFunctionWithName:@"fragment_main"];
    
    MTLRenderPipelineDescriptor *pipelineStateDescriptor = [[MTLRenderPipelineDescriptor alloc] init];
    pipelineStateDescriptor.label = @"Simple Pipeline";
    pipelineStateDescriptor.vertexFunction = vertexFunction;
    pipelineStateDescriptor.fragmentFunction = fragmentFunction;
    pipelineStateDescriptor.colorAttachments[0].pixelFormat = MTLPixelFormatBGRA8Unorm_sRGB;
    
    g_pipelineState = [g_device newRenderPipelineStateWithDescriptor:pipelineStateDescriptor error:&error];
    if (!g_pipelineState) {
        NSLog(@"Failed to created pipeline state, error %@", error);
        return 0;
    }
    
    // Start the Cocoa App (This blocks the main thread permanently)
    return 1;
}

int64_t sys_metal_run() {
    [NSApplication sharedApplication];
    AppDelegate *delegate = [[AppDelegate alloc] init];
    [NSApp setDelegate:delegate];
    [NSApp run];
    
    return 1;
}

// Forward declaration for WebAssembly memory model pointer recovery
extern void* ohn_resolve_ptr(uint32_t ptr_low);

int64_t sys_metal_create_static_buffer(int32_t ptr_low, int32_t sizeBytes) {
    int32_t handle = g_bufferCount++;
    void* hostPtr = ohn_resolve_ptr(ptr_low);
    // Managed buffer: read-only for GPU. Shared is fine for UMA (Apple Silicon)
    g_buffers[handle].mtlBuffer = [g_device newBufferWithBytes:hostPtr length:sizeBytes options:MTLResourceStorageModeShared];
    g_buffers[handle].isDynamic = NO;
    return handle;
}

int64_t sys_metal_create_dynamic_buffer(int32_t sizeBytes) {
    int32_t handle = g_bufferCount++;
    g_buffers[handle].isDynamic = YES;
    g_buffers[handle].size = sizeBytes;
    for(int i = 0; i < MAX_BUFFERS_IN_FLIGHT; i++) {
        g_buffers[handle].dynamicSlices[i] = [g_device newBufferWithLength:sizeBytes options:MTLResourceStorageModeShared];
    }
    return handle;
}

void sys_metal_update_dynamic_buffer(int32_t handle, int32_t ptr_low) {
    BufferHandle* b = &g_buffers[handle];
    if (!b->isDynamic) return;
    
    id<MTLBuffer> currentBuffer = b->dynamicSlices[g_currentFrameIndex];
    void* dest = [currentBuffer contents];
    void* src = ohn_resolve_ptr(ptr_low);
    if (src) {
        memcpy(dest, src, b->size);
    }
}

void sys_metal_draw_instanced(int32_t staticHandle, int32_t dynamicHandle, int32_t instanceCount) {
    if (!g_currentEncoder) return;
    
    id<MTLBuffer> staticBuf = g_buffers[staticHandle].mtlBuffer;
    id<MTLBuffer> dynamicBuf = g_buffers[dynamicHandle].dynamicSlices[g_currentFrameIndex];
    
    [g_currentEncoder setVertexBuffer:staticBuf offset:0 atIndex:0];
    [g_currentEncoder setVertexBuffer:dynamicBuf offset:0 atIndex:1];
    
    // Assuming 36 vertices for our cube
    [g_currentEncoder drawPrimitives:MTLPrimitiveTypeTriangle vertexStart:0 vertexCount:36 instanceCount:instanceCount];
}

extern void __get_module_exports_main(void);
extern void ohn_init(void);

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        __get_module_exports_main();
        ohn_init();
    }
    return 0;
}
