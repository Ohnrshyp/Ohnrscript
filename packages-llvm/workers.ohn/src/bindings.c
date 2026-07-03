#include <stdint.h>
#include <stdlib.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>

#ifdef __APPLE__
#include <dispatch/dispatch.h>
typedef dispatch_semaphore_t os_sem_t;
#else
#include <semaphore.h>
typedef sem_t os_sem_t;
#endif

#define QUEUE_SIZE 256

typedef struct {
    _Atomic uint32_t head;
    _Atomic uint32_t tail;
    _Atomic(void*) buffer[QUEUE_SIZE]; 
} MPSCQueue;

typedef struct {
    pthread_t thread_id;
    void* fn_ptr;
    MPSCQueue* mailbox;
    os_sem_t wakeup_sem;
    _Atomic uint8_t is_sleeping;
} WorkerState;

// Allocates and initializes the WorkerState and lock-free queue
int64_t sys_worker_alloc(void) {
    WorkerState* ws = calloc(1, sizeof(WorkerState));
    ws->mailbox = calloc(1, sizeof(MPSCQueue));
    atomic_init(&ws->mailbox->head, 0);
    atomic_init(&ws->mailbox->tail, 0);
    atomic_init(&ws->is_sleeping, 0);

#ifdef __APPLE__
    ws->wakeup_sem = dispatch_semaphore_create(0);
#else
    sem_init(&ws->wakeup_sem, 0, 0);
#endif
    return (int64_t)(uintptr_t)ws;
}

// Lock-Free MPSC Ring Buffer Push
// Returns 0 on success, -1 if queue is full (Backpressure)
int64_t sys_mpsc_push(int64_t ws_ptr, int64_t arena_ptr) {
    WorkerState* ws = (WorkerState*)(uintptr_t)ws_ptr;
    MPSCQueue* q = ws->mailbox;
    
    uint32_t head = atomic_load_explicit(&q->head, memory_order_relaxed);
    for (;;) {
        uint32_t tail = atomic_load_explicit(&q->tail, memory_order_acquire);
        if (head - tail >= QUEUE_SIZE) {
            return -1; // Explicit Backpressure: Queue Full
        }
        if (atomic_compare_exchange_weak_explicit(&q->head, &head, head + 1, memory_order_release, memory_order_relaxed)) {
            break;
        }
    }
    
    // We reserved 'head'. Write data safely.
    atomic_store_explicit(&q->buffer[head % QUEUE_SIZE], (void*)(uintptr_t)arena_ptr, memory_order_release);
    
    // User-Space Sleep Bypass: Only drop into kernel if worker is asleep
    if (atomic_load_explicit(&ws->is_sleeping, memory_order_acquire) == 1) {
#ifdef __APPLE__
        dispatch_semaphore_signal(ws->wakeup_sem);
#else
        sem_post(&ws->wakeup_sem);
#endif
    }
    
    return 0; // Success
}

// Lock-Free MPSC Pop
// Returns pointer, or 0 if empty.
int64_t sys_mpsc_pop(int64_t ws_ptr) {
    WorkerState* ws = (WorkerState*)(uintptr_t)ws_ptr;
    MPSCQueue* q = ws->mailbox;
    
    uint32_t tail = atomic_load_explicit(&q->tail, memory_order_relaxed);
    uint32_t head = atomic_load_explicit(&q->head, memory_order_acquire);
    
    if (tail == head) {
        return 0; // Empty
    }
    
    void* ptr = atomic_exchange_explicit(&q->buffer[tail % QUEUE_SIZE], NULL, memory_order_acquire);
    if (ptr == NULL) {
        // Producer reserved head but hasn't stored yet. Treat as temporarily empty.
        return 0; 
    }
    
    // Safely move tail forward (single consumer, so simple store is safe)
    atomic_store_explicit(&q->tail, tail + 1, memory_order_release);
    return (int64_t)(uintptr_t)ptr;
}

// Sleep mechanism using Semaphores
int64_t sys_worker_sleep(int64_t ws_ptr) {
    WorkerState* ws = (WorkerState*)(uintptr_t)ws_ptr;
    atomic_store_explicit(&ws->is_sleeping, 1, memory_order_release);
    
    // Double check queue to avoid race condition where a push happens right before we sleep
    uint32_t tail = atomic_load_explicit(&ws->mailbox->tail, memory_order_relaxed);
    uint32_t head = atomic_load_explicit(&ws->mailbox->head, memory_order_acquire);
    if (tail != head) {
        atomic_store_explicit(&ws->is_sleeping, 0, memory_order_release);
        return 0; // Queue isn't empty, abort sleep
    }
    
#ifdef __APPLE__
    dispatch_semaphore_wait(ws->wakeup_sem, DISPATCH_TIME_FOREVER);
#else
    sem_wait(&ws->wakeup_sem);
#endif
    
    atomic_store_explicit(&ws->is_sleeping, 0, memory_order_release);
    return 0;
}

// We hardcode the worker entry point because Ohnrscript currently lacks first-class function pointer support
extern int64_t myWorkerFunction(int64_t ws_ptr);

void* thread_runner(void* arg) {
    WorkerState* ws = (WorkerState*)arg;
    
    // Execute Ohnrscript worker function
    myWorkerFunction((int64_t)(uintptr_t)ws);
    
    return NULL;
}

int64_t sys_thread_create(int64_t ws_ptr) {
    WorkerState* ws = (WorkerState*)(uintptr_t)ws_ptr;
    return (int64_t)pthread_create(&ws->thread_id, NULL, thread_runner, ws);
}

int64_t sys_thread_join(int64_t ws_ptr) {
    WorkerState* ws = (WorkerState*)(uintptr_t)ws_ptr;
    pthread_join(ws->thread_id, NULL);
    
    // PANIC LEAK DRAIN: Automatically clear unread items from the queue
    MPSCQueue* q = ws->mailbox;
    uint32_t head = atomic_load_explicit(&q->head, memory_order_acquire);
    uint32_t tail = atomic_load_explicit(&q->tail, memory_order_relaxed);
    
    while (tail < head) {
        void* ptr = atomic_exchange_explicit(&q->buffer[tail % QUEUE_SIZE], NULL, memory_order_acquire);
        if (ptr != NULL) {
            free(ptr); // Deallocate Transfer Arena
        }
        tail++;
    }
    
#ifdef __APPLE__
    dispatch_release(ws->wakeup_sem);
#else
    sem_destroy(&ws->wakeup_sem);
#endif

    free(q);
    free(ws);
    return 0;
}


// Helper for testing Transfer Arena allocations
int64_t sys_alloc_dummy_arena(void) {
    void* ptr = malloc(1024);
    return (int64_t)(uintptr_t)ptr;
}

// Hardcoded print statements to bypass Ohnrscript string literal limitations
int64_t print_main_start(void) { printf("[Main] Spawning Worker Thread...\n"); return 0; }
int64_t print_main_alloc(void) { printf("[Main] Allocating Dummy Transfer Arena...\n"); return 0; }
int64_t print_main_handoff(void) { printf("[Main] Handoff: Posting Transfer Arena to Worker...\n"); return 0; }
int64_t print_main_wait(void) { printf("[Main] Waiting for worker to join...\n"); return 0; }
int64_t print_main_done(void) { printf("[Main] Complete.\n"); return 0; }

int64_t print_worker_start(void) { printf("[Worker] Started! Waiting for Transfer Arena...\n"); return 0; }
int64_t print_worker_recv(void) { printf("[Worker] Successfully received Transfer Arena (Zero-Copy)!\n"); return 0; }
int64_t print_worker_empty(void) { printf("[Worker] Received empty/null pointer.\n"); return 0; }
int64_t print_worker_exit(void) { printf("[Worker] Exiting gracefully.\n"); return 0; }

