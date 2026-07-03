#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <fcntl.h>
#include <unistd.h>
#include <pthread.h>

// Simulated Disk File Descriptor
static int disk_fd = -1;

// Block size and Buffer Pool Size
#define BLOCK_SIZE 4096
#define NUM_FRAMES 1024

// Pinned/Aligned Buffer Pool Memory (Owned by C)
static uint8_t* buffer_pool = NULL;
static pthread_rwlock_t* rwlocks = NULL;
static pthread_t* workers = NULL;

// Ohnrscript Externs for Disk I/O
int64_t ext_sys_disk_init() {
    if (disk_fd != -1) return 0;
    
    // Allocate physically aligned Buffer Pool
    int err = posix_memalign((void**)&buffer_pool, BLOCK_SIZE, NUM_FRAMES * BLOCK_SIZE);
    if (err != 0) {
        perror("FATAL: Failed to allocate pinned Buffer Pool");
        exit(1);
    }
    
    rwlocks = (pthread_rwlock_t*)malloc(sizeof(pthread_rwlock_t) * NUM_FRAMES);
    if (!rwlocks) {
        perror("FATAL: Failed to allocate rwlocks");
        exit(1);
    }
    
    workers = (pthread_t*)malloc(sizeof(pthread_t) * 16); // Support up to 16 test threads
    if (!workers) {
        perror("FATAL: Failed to allocate workers array");
        exit(1);
    }

    // Open or create the simulated disk image
    disk_fd = open("disk.img", O_RDWR | O_CREAT, 0644);
    if (disk_fd < 0) {
        perror("FATAL: Failed to open disk.img");
        exit(1);
    }
    return 0;
}

// Thread-safe Logical Block Address Read
int64_t ext_sys_lba_read(int64_t relative_start_block, int64_t num_blocks, int32_t frame_id) {
    if (disk_fd < 0) ext_sys_disk_init();
    
    off_t offset = relative_start_block * BLOCK_SIZE;
    size_t bytes_to_read = num_blocks * BLOCK_SIZE;
    void* buffer_ptr = buffer_pool + (frame_id * BLOCK_SIZE);
    
    ssize_t bytes_read = pread(disk_fd, buffer_ptr, bytes_to_read, offset);
    if (bytes_read != (ssize_t)bytes_to_read) {
        // EOF ok on first run
    }
    return 0;
}

// Thread-safe Logical Block Address Write
int64_t ext_sys_lba_write(int64_t relative_start_block, int64_t num_blocks, int32_t frame_id) {
    if (disk_fd < 0) ext_sys_disk_init();
    
    off_t offset = relative_start_block * BLOCK_SIZE;
    size_t bytes_to_write = num_blocks * BLOCK_SIZE;
    void* buffer_ptr = buffer_pool + (frame_id * BLOCK_SIZE);
    
    ssize_t bytes_written = pwrite(disk_fd, buffer_ptr, bytes_to_write, offset);
    if (bytes_written != (ssize_t)bytes_to_write) {
        perror("FATAL: sys_lba_write failed");
        exit(1);
    }
    return 0;
}

// Frame Byte-Level Access for Ohnrscript (Phase 1 Compiler Bypass)
int64_t ext_sys_frame_write_byte(int32_t frame_id, int32_t offset, uint32_t val) {
    buffer_pool[(frame_id * BLOCK_SIZE) + offset] = (uint8_t)val;
    return 0;
}

uint32_t ext_sys_frame_read_byte(int32_t frame_id, int32_t offset) {
    return buffer_pool[(frame_id * BLOCK_SIZE) + offset];
}

int64_t ext_sys_frame_write_i32(int32_t frame_id, int32_t offset, int32_t val) {
    int32_t* ptr = (int32_t*)(buffer_pool + (frame_id * BLOCK_SIZE) + offset);
    *ptr = val;
    return 0;
}

int32_t ext_sys_frame_read_i32(int32_t frame_id, int32_t offset) {
    int32_t* ptr = (int32_t*)(buffer_pool + (frame_id * BLOCK_SIZE) + offset);
    return *ptr;
}

// ---------------------------------------------------------
// Thread-Safe Buffer Pool RWLocks
// ---------------------------------------------------------

int64_t ext_sys_rwlock_init(int32_t frame_id) {
    pthread_rwlock_init(&rwlocks[frame_id], NULL);
    return 0;
}

int64_t ext_sys_rwlock_rlock(int32_t frame_id) {
    pthread_rwlock_rdlock(&rwlocks[frame_id]);
    return 0;
}

int64_t ext_sys_rwlock_wlock(int32_t frame_id) {
    pthread_rwlock_wrlock(&rwlocks[frame_id]);
    return 0;
}

int64_t ext_sys_rwlock_unlock(int32_t frame_id) {
    pthread_rwlock_unlock(&rwlocks[frame_id]);
    return 0;
}

// Ohnrscript Print Externs
int64_t ext_print_boot() {
    printf("[INIT] Ohn-Kernel Native File System (db.ohn) Booting...\n");
    printf("       [Buffer Pool] 4MB Aligned Memory Allocated.\n");
    return 0;
}

int64_t ext_print_success() {
    printf("[SUCCESS] db.ohn Execution Completed.\n");
    return 0;
}

int64_t ext_print_num(int num) {
    printf("Result: %d\n", num);
    return 0;
}

// ---------------------------------------------------------
// Thread Spawning for Concurrency Testing
// ---------------------------------------------------------

extern int32_t dbWorkerFunction(int32_t worker_id);

void* db_thread_runner(void* arg) {
    int32_t worker_id = (int32_t)(uintptr_t)arg;
    dbWorkerFunction(worker_id);
    return NULL;
}

int64_t ext_sys_thread_create(int32_t worker_id) {
    pthread_create(&workers[worker_id], NULL, db_thread_runner, (void*)(uintptr_t)worker_id);
    return 0;
}

int64_t ext_sys_thread_join(int32_t worker_id) {
    pthread_join(workers[worker_id], NULL);
    return 0;
}
