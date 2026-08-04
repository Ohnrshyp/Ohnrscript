/**
 * bindings.c — Ohnrscript node.ohn ABI Shim Layer
 *
 * Purpose: Wraps complex POSIX C structs (epoll_event, kevent, sockaddr_in)
 * into flat, primitive byte arrays that Ohnrscript's LLVM IR can safely
 * consume without hitting C compiler ABI padding mismatches across
 * x86_64 / ARM64 / Linux / macOS.
 *
 * Ohnrscript externs call these shim functions directly.
 * All pointers are passed as int64_t to match Ohnrscript's i64 LLVM params.
 */

#include <stdint.h>
#include <string.h>
#include <signal.h>
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#ifdef __linux__
  #include <sys/epoll.h>
  #include <sys/eventfd.h>
#elif __APPLE__
  #include <sys/event.h>
  #include <sys/time.h>
#endif

/* ============================================================
 * 1. SIGNAL SETUP
 * Suppress SIGPIPE globally so a write() to a closed socket
 * returns -1 instead of instantly killing the process.
 * ============================================================ */
void sys_suppress_sigpipe(void) {
    signal(SIGPIPE, SIG_IGN);
}

/* ============================================================
 * 2. SOCKET PRIMITIVES
 * Flat wrappers so Ohnrscript never touches sockaddr structs.
 * ============================================================ */


#include <time.h>
int64_t sys_time_sec(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (int64_t)ts.tv_sec;
}

// Creates a TCP socket. Returns fd or -1.

int64_t sys_socket_tcp(void) {
    return (int64_t)socket(AF_INET, SOCK_STREAM, 0);
}

// Sets SO_REUSEADDR + SO_REUSEPORT for multi-core forking.
int64_t sys_socket_set_reuseport(int32_t fd) {
    int yes = 1;
    setsockopt((int)fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));
#ifdef SO_REUSEPORT
    setsockopt((int)fd, SOL_SOCKET, SO_REUSEPORT, &yes, sizeof(yes));
#endif
    return 0;
}

// Sets socket to non-blocking mode (required for epoll/kqueue).
int64_t sys_socket_nonblock(int32_t fd) {
    int flags = fcntl((int)fd, F_GETFL, 0);
    return (int64_t)fcntl((int)fd, F_SETFL, flags | O_NONBLOCK);
}

// Binds socket to 0.0.0.0:port. Returns 0 or -1.
int64_t sys_socket_bind(int32_t fd, int32_t port) {
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family      = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port        = htons((uint16_t)port);
    return (int64_t)bind((int)fd, (struct sockaddr*)&addr, sizeof(addr));
}

int64_t sys_socket_listen(int32_t fd, int32_t backlog) {
    return (int64_t)listen((int)fd, (int)backlog);
}

// Accepts a new connection. Returns client_fd or -1 (EAGAIN = no pending).
int64_t sys_socket_accept(int32_t fd) {
    struct sockaddr_in client_addr;
    socklen_t client_len = sizeof(client_addr);
    return (int64_t)accept((int)fd, (struct sockaddr*)&client_addr, &client_len);
}

extern void* ohn_resolve_ptr_safe(uint32_t base_offset, uint32_t byte_length);
extern uint32_t read_buf;

int64_t sys_socket_read(int32_t fd, int32_t offset_idx, int32_t length) {
    uint8_t* p = (uint8_t*)ohn_resolve_ptr_safe(read_buf + (offset_idx * 4), (uint32_t)length);
    return (int64_t)read((int)fd, p, (size_t)length);
}

// Uses MSG_NOSIGNAL where available as an extra SIGPIPE guard.
int64_t sys_socket_write(int32_t fd, int32_t offset_idx, int32_t length) {
    uint8_t* p = (uint8_t*)ohn_resolve_ptr_safe(read_buf + (offset_idx * 4), (uint32_t)length);
#ifdef MSG_NOSIGNAL
    return (int64_t)send((int)fd, p, (size_t)length, MSG_NOSIGNAL);
#else
    return (int64_t)write((int)fd, p, (size_t)length);
#endif
}

int64_t sys_socket_close(int32_t fd) {
    return (int64_t)close((int)fd);
}

/* ============================================================
 * 3. EVENT LOOP — LINUX (epoll)
 * ============================================================ */
#ifdef __linux__

int64_t sys_epoll_create(void) {
    return (int64_t)epoll_create1(0);
}

// Registers fd with epoll. events: EPOLLIN=1, EPOLLOUT=4, EPOLLET=0x80000000
int64_t sys_epoll_add(int64_t epfd, int64_t fd, int64_t events) {
    struct epoll_event ev;
    memset(&ev, 0, sizeof(ev));
    ev.events   = (uint32_t)events;
    ev.data.fd  = (int)fd;
    return (int64_t)epoll_ctl((int)epfd, EPOLL_CTL_ADD, (int)fd, &ev);
}

int64_t sys_epoll_mod(int64_t epfd, int64_t fd, int64_t events) {
    struct epoll_event ev;
    memset(&ev, 0, sizeof(ev));
    ev.events   = (uint32_t)events;
    ev.data.fd  = (int)fd;
    return (int64_t)epoll_ctl((int)epfd, EPOLL_CTL_MOD, (int)fd, &ev);
}

int64_t sys_epoll_del(int64_t epfd, int64_t fd) {
    return (int64_t)epoll_ctl((int)epfd, EPOLL_CTL_DEL, (int)fd, NULL);
}

// Waits for events. Writes results as flat [fd, events, fd, events ...] i32 pairs.
// Returns number of events. max_events is the array capacity.
int64_t sys_epoll_wait(int64_t epfd, int64_t out_buf_ptr, int64_t max_events, int64_t timeout_ms) {
    struct epoll_event events[max_events];
    int n = epoll_wait((int)epfd, events, (int)max_events, (int)timeout_ms);
    int32_t* out = (int32_t*)(uintptr_t)out_buf_ptr;
    for (int i = 0; i < n; i++) {
        out[i * 2]     = events[i].data.fd;
        out[i * 2 + 1] = (int32_t)events[i].events;
    }
    return (int64_t)n;
}

// eventfd for lock-free MPSC thread pool wakeup.
int64_t sys_eventfd_create(void) {
    return (int64_t)eventfd(0, EFD_NONBLOCK);
}

int64_t sys_eventfd_signal(int64_t efd) {
    uint64_t one = 1;
    return (int64_t)write((int)efd, &one, sizeof(one));
}

int64_t sys_eventfd_drain(int64_t efd) {
    uint64_t val;
    return (int64_t)read((int)efd, &val, sizeof(val));
}

#endif /* __linux__ */

/* ============================================================
 * 4. EVENT LOOP — MACOS (kqueue)
 * ============================================================ */
#ifdef __APPLE__

int64_t sys_kqueue_create(void) {
    return (int64_t)kqueue();
}

// Registers an EVFILT_READ or EVFILT_WRITE filter for fd.
// filter: EVFILT_READ=-1, EVFILT_WRITE=-2
// flags:  EV_ADD=1, EV_DELETE=2, EV_ENABLE=4, EV_DISABLE=8
int64_t sys_kqueue_register(int32_t kq, int32_t fd, int32_t filter, int32_t flags) {
    struct kevent ev;
    EV_SET(&ev, (uintptr_t)fd, (short)filter, (uint16_t)flags, 0, 0, NULL);
    return (int64_t)kevent((int)kq, &ev, 1, NULL, 0, NULL);
}

extern uint32_t event_results;

// Waits for events. Writes results as flat [fd, filter, fd, filter ...] i32 pairs.
int64_t sys_kqueue_wait(int32_t kq, int32_t dummy_ptr, int32_t max_events, int32_t timeout_ms) {
    struct kevent events[max_events];
    struct timespec ts;
    ts.tv_sec  = timeout_ms / 1000;
    ts.tv_nsec = (timeout_ms % 1000) * 1000000;
    int n = kevent((int)kq, NULL, 0, events, (int)max_events, timeout_ms >= 0 ? &ts : NULL);
    int32_t* out = (int32_t*)ohn_resolve_ptr_safe(event_results, max_events * 8);
    for (int i = 0; i < n; i++) {
        out[i * 2]     = (int32_t)events[i].ident;
        out[i * 2 + 1] = (int32_t)events[i].filter;
        fprintf(stderr, "[KQUEUE] Woke up fd=%d filter=%d\n", out[i*2], out[i*2+1]);
    }
    return (int64_t)n;
}

// Self-pipe trick for kqueue wakeup (replaces Linux eventfd).
// Returns [read_fd, write_fd] packed as (read_fd | (write_fd << 32)).
int64_t sys_selfpipe_create(void) {
    int fds[2];
    if (pipe(fds) < 0) return -1;
    fcntl(fds[0], F_SETFL, O_NONBLOCK);
    fcntl(fds[1], F_SETFL, O_NONBLOCK);
    return (int64_t)fds[0] | ((int64_t)fds[1] << 32);
}

int64_t sys_selfpipe_signal(int64_t write_fd) {
    char byte = 1;
    return (int64_t)write((int)write_fd, &byte, 1);
}

int64_t sys_selfpipe_drain(int64_t read_fd) {
    char buf[64];
    return (int64_t)read((int)read_fd, buf, sizeof(buf));
}

#endif /* __APPLE__ */

/* ============================================================
 * 5. CPU CORE COUNT (for SO_REUSEPORT forking)
 * ============================================================ */
int64_t sys_cpu_count(void) {
    return (int64_t)sysconf(_SC_NPROCESSORS_ONLN);
}

/* ============================================================
 * 6. MEMORY — mmap shared arena for cross-fork shared state
 * ============================================================ */
#include <sys/mman.h>

// Allocates a shared memory region readable/writable by all forked processes.
int64_t sys_shared_alloc(int64_t size) {
    void* ptr = mmap(NULL, (size_t)size,
        PROT_READ | PROT_WRITE,
        MAP_SHARED | MAP_ANONYMOUS,
        -1, 0);
    if (ptr == MAP_FAILED) return 0;
    return (int64_t)(uintptr_t)ptr;
}

int64_t sys_shared_free(int64_t ptr, int64_t size) {
    return (int64_t)munmap((void*)(uintptr_t)ptr, (size_t)size);
}

/* ============================================================
 * 7. STRING BYPASS (For missing string literal parser)
 * ============================================================ */
void sys_fill_response(int32_t offset_idx, int32_t response_type) {
    uint8_t* p = (uint8_t*)ohn_resolve_ptr_safe(read_buf + (offset_idx * 4), 1024);
    fprintf(stderr, "[HTTP] Filling response %d for offset %d\n", response_type, offset_idx);
    
    if (response_type == 2001) { // ROOT
        const char* resp = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!";
        memcpy(p, resp, 75);
    } else if (response_type == 2002) { // USERS
        const char* resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 16\r\n\r\n{\"users\":[\"db\"]}";
        memcpy(p, resp, 86);
    } else if (response_type == 404) {
        const char* resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot Found";
        memcpy(p, resp, 54);
    } else if (response_type == 405) {
        const char* resp = "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n";
        memcpy(p, resp, 55);
    } else {
        const char* resp = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n";
        memcpy(p, resp, 58);
    }
}

void sys_log_int(int32_t val1, int32_t val2, int32_t val3) {
    fprintf(stderr, "[DEBUG] %d %d %d\n", val1, val2, val3);
}

/* ============================================================
 * 8. MEMORY ACCESS (For HTTP parser)
 * ============================================================ */
int64_t sys_mem_read_i8(int64_t offset_idx, int64_t byte_offset) {
    uint8_t* base = (uint8_t*)ohn_resolve_ptr_safe(read_buf + (offset_idx * 4), byte_offset + 1);
    return (int64_t)base[byte_offset];
}

int64_t sys_mem_read_i32(int64_t offset_idx, int64_t byte_offset) {
    uint8_t* base = (uint8_t*)ohn_resolve_ptr_safe(read_buf + (offset_idx * 4), byte_offset + 4);
    int32_t* p = (int32_t*)(base + byte_offset);
    return (int64_t)*p;
}

/* ============================================================
 * 9. ATOMIC PRIMITIVES (For lock-free MPSC queue)
 *
 * Ohnrscript's Int32Array buffers are backed by ohn_heap_base.
 * The .ohn side passes a byte offset; we resolve it to a real
 * pointer and apply a hardware atomic instruction.
 *
 * Both functions use __ATOMIC_SEQ_CST (sequentially consistent)
 * — the strongest memory ordering, correct for an MPSC queue
 * shared between a worker's main thread and its background threads.
 * ============================================================ */
extern uint8_t* ohn_heap_base;

/* Atomically add val to the i32 at heap byte offset offset_bytes.
 * Returns the value that was at that address BEFORE the add. */
int64_t sys_atomic_add(int64_t offset_bytes, int64_t val) {
    int32_t* ptr = (int32_t*)(ohn_heap_base + (uint32_t)offset_bytes);
    int32_t v = (int32_t)val;
    return (int64_t)__atomic_fetch_add(ptr, v, __ATOMIC_SEQ_CST);
}

/* Atomically compare the i32 at heap byte offset offset_bytes to
 * expected. If equal, write replacement and return 1 (success).
 * If not equal, leave memory unchanged and return 0 (failure).
 *
 * This is the Compare-And-Swap (CAS) primitive. The MPSC producer
 * spins on this to atomically claim a head index without a mutex. */
int64_t sys_atomic_cmpxchg(int64_t offset_bytes, int64_t expected, int64_t replacement) {
    int32_t* ptr = (int32_t*)(ohn_heap_base + (uint32_t)offset_bytes);
    int32_t exp = (int32_t)expected;
    int32_t rep = (int32_t)replacement;
    int success = __atomic_compare_exchange_n(
        ptr, &exp, rep,
        0,                   /* strong CAS — no spurious failures */
        __ATOMIC_SEQ_CST,    /* success ordering */
        __ATOMIC_SEQ_CST     /* failure ordering */
    );
    return (int64_t)success;
}


/* ============================================================
 * 10. TLS (mbedTLS) ZERO-ALLOCATION BRIDGE
 * ============================================================ */
#include <sys/types.h>
#include <sys/sysctl.h>
#include <sys/mman.h>

#define MBEDTLS_ERR_NET_RECV_FAILED -0x004C
#define MBEDTLS_ERR_NET_SEND_FAILED -0x004E

#include "mbedtls/ssl.h"
#include "mbedtls/error.h"
#include "mbedtls/platform_util.h"
#include "mbedtls/memory_buffer_alloc.h"
#include "mbedtls/psa_util.h"
#include "psa/crypto.h"

#ifndef MAP_ANON
#define MAP_ANON MAP_ANONYMOUS
#endif

size_t query_system_ram() {
    long long total_memory = 0;
    size_t len = sizeof(total_memory);

#if defined(__APPLE__)
    int mib[2] = {CTL_HW, HW_MEMSIZE};
    if (sysctl(mib, 2, &total_memory, &len, NULL, 0) == 0) return (size_t)total_memory;
#elif defined(__FreeBSD__)
    if (sysctlbyname("hw.physmem", &total_memory, &len, NULL, 0) == 0) return (size_t)total_memory;
#endif

    return 1024 * 1024 * 1024; // 1 GB safe baseline fallback
}

void sys_tls_init_pool(size_t calculated_arena_size) {
    void* mmap_pool = mmap(NULL, calculated_arena_size, 
                           PROT_READ | PROT_WRITE, 
                           MAP_ANON | MAP_PRIVATE, -1, 0);
    
    if (mmap_pool == MAP_FAILED) {
        perror("FATAL: Failed to mmap TLS arena");
        exit(1);
    }
    mbedtls_memory_buffer_alloc_init((unsigned char*)mmap_pool, calculated_arena_size);
}

mbedtls_ssl_config conf;
mbedtls_ssl_config conf_client;
mbedtls_x509_crt cacert;

typedef struct ohn_cert_node {
    mbedtls_x509_crt cert;
    mbedtls_pk_context pkey;
} ohn_cert_node;

ohn_cert_node default_cert_node;

ohn_cert_node* find_cached_cert(const unsigned char *hostname, size_t name_len) {
    return &default_cert_node;
}

int ohn_sni_callback(void *p_info, mbedtls_ssl_context *ssl, 
                     const unsigned char *hostname, size_t name_len) {
    ohn_cert_node* cert_node = find_cached_cert(hostname, name_len);
    if (cert_node != NULL) {
        return mbedtls_ssl_set_hs_own_cert(ssl, &cert_node->cert, &cert_node->pkey);
    }
    return 0; 
}

void sys_tls_init(void) {
    size_t connection_limit = 10000;
    char* env_limit = getenv("OHN_MAX_CONNECTIONS");
    if (env_limit) connection_limit = (size_t)atoi(env_limit);

    size_t arena_size = connection_limit * 65536;
    size_t max_allowed_ram = query_system_ram() / 10;
    if (arena_size > max_allowed_ram) arena_size = max_allowed_ram;

    sys_tls_init_pool(arena_size);

    int ret;
    ret = psa_crypto_init();
    if (ret != 0) {
        fprintf(stderr, "[TLS] psa_crypto_init failed: -0x%04X\n", (unsigned int)-ret);
    } else {
        fprintf(stderr, "[TLS] psa_crypto_init OK\n");
    }

    mbedtls_ssl_config_init(&conf);
    mbedtls_x509_crt_init(&cacert);

    mbedtls_x509_crt_init(&default_cert_node.cert);
    mbedtls_pk_init(&default_cert_node.pkey);

    ret = mbedtls_x509_crt_parse_file(&default_cert_node.cert, "cert.pem");
    if (ret != 0) {
        char errbuf[256];
        mbedtls_strerror(ret, errbuf, sizeof(errbuf));
        fprintf(stderr, "[TLS] cert.pem parse FAILED: -0x%04X (%s)\n", (unsigned int)-ret, errbuf);
    } else {
        fprintf(stderr, "[TLS] cert.pem loaded OK\n");
    }

    ret = mbedtls_pk_parse_keyfile(&default_cert_node.pkey, "key.pem", NULL, NULL, NULL);
    if (ret != 0) {
        char errbuf[256];
        mbedtls_strerror(ret, errbuf, sizeof(errbuf));
        fprintf(stderr, "[TLS] key.pem parse FAILED: -0x%04X (%s)\n", (unsigned int)-ret, errbuf);
    } else {
        fprintf(stderr, "[TLS] key.pem loaded OK\n");
    }

    ret = mbedtls_ssl_config_defaults(&conf,
                                MBEDTLS_SSL_IS_SERVER,
                                MBEDTLS_SSL_TRANSPORT_STREAM,
                                MBEDTLS_SSL_PRESET_DEFAULT);
    if (ret != 0) {
        fprintf(stderr, "[TLS] ssl_config_defaults (server) FAILED: -0x%04X\n", (unsigned int)-ret);
    }

    mbedtls_ssl_config_init(&conf_client);
    ret = mbedtls_ssl_config_defaults(&conf_client,
                                MBEDTLS_SSL_IS_CLIENT,
                                MBEDTLS_SSL_TRANSPORT_STREAM,
                                MBEDTLS_SSL_PRESET_DEFAULT);
    if (ret != 0) {
        fprintf(stderr, "[TLS] ssl_config_defaults (client) FAILED: -0x%04X\n", (unsigned int)-ret);
    }
    mbedtls_ssl_conf_min_tls_version(&conf_client, MBEDTLS_SSL_VERSION_TLS1_2);
    mbedtls_ssl_conf_authmode(&conf_client, MBEDTLS_SSL_VERIFY_NONE);
    mbedtls_ssl_conf_rng(&conf_client, mbedtls_psa_get_random, MBEDTLS_PSA_RANDOM_STATE);

    mbedtls_ssl_conf_min_tls_version(&conf, MBEDTLS_SSL_VERSION_TLS1_2);
    mbedtls_ssl_conf_authmode(&conf, MBEDTLS_SSL_VERIFY_NONE);
    mbedtls_ssl_conf_rng(&conf, mbedtls_psa_get_random, MBEDTLS_PSA_RANDOM_STATE);

    mbedtls_ssl_conf_sni(&conf, ohn_sni_callback, NULL);
    ret = mbedtls_ssl_conf_own_cert(&conf, &default_cert_node.cert, &default_cert_node.pkey);
    if (ret != 0) {
        char errbuf[256];
        mbedtls_strerror(ret, errbuf, sizeof(errbuf));
        fprintf(stderr, "[TLS] ssl_conf_own_cert FAILED: -0x%04X (%s)\n", (unsigned int)-ret, errbuf);
    } else {
        fprintf(stderr, "[TLS] ssl_conf_own_cert OK\n");
    }

    char* cert_file = getenv("SSL_CERT_FILE");
    if (cert_file) mbedtls_x509_crt_parse_file(&cacert, cert_file);
    mbedtls_ssl_conf_ca_chain(&conf, &cacert, NULL);

    fprintf(stderr, "[TLS] sys_tls_init complete. Listening on :8443\n");
}

int ohn_net_send(void *ctx, const unsigned char *buf, size_t len) {
    int fd = (int)(uintptr_t)ctx;
#ifdef MSG_NOSIGNAL
    ssize_t ret = send(fd, buf, len, MSG_NOSIGNAL);
#else
    ssize_t ret = write(fd, buf, len);
#endif
    if (ret < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) return MBEDTLS_ERR_SSL_WANT_WRITE;
        return MBEDTLS_ERR_NET_SEND_FAILED;
    }
    return (int)ret;
}

int ohn_net_recv(void *ctx, unsigned char *buf, size_t len) {
    int fd = (int)(uintptr_t)ctx;
    ssize_t ret = read(fd, buf, len);
    if (ret < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) return MBEDTLS_ERR_SSL_WANT_READ;
        return MBEDTLS_ERR_NET_RECV_FAILED;
    }
    return (int)ret;
}

mbedtls_ssl_context ssl_contexts[10240];
mbedtls_ssl_config slot_configs[10240];
mbedtls_x509_crt slot_cacerts[10240];

int64_t sys_tls_connect(int32_t slot, int32_t fd, int32_t hostname_offset, int32_t is_server) {
    if (slot < 0 || slot >= 10240) return -1;
    mbedtls_ssl_context* ssl = &ssl_contexts[slot];
    mbedtls_ssl_init(ssl);
    int setup_ret = mbedtls_ssl_setup(ssl, is_server ? &conf : &conf_client);
    if (setup_ret != 0) {
        fprintf(stderr, "[TLS] ssl_setup FAILED: -0x%04X\n", (unsigned int)-setup_ret);
        return -1;
    }
    
    if (hostname_offset != 0) {
        char* hostname = (char*)ohn_resolve_ptr_safe(hostname_offset, 256); // assuming 256 bytes string
        mbedtls_ssl_set_hostname(ssl, hostname);
    }

    mbedtls_ssl_set_bio(ssl, (void*)(uintptr_t)fd, ohn_net_send, ohn_net_recv, NULL);
    return 0;
}

int64_t sys_tls_inject_ca(int32_t slot, int32_t ca_str_offset, int32_t ca_len) {
    if (slot < 0 || slot >= 10240) return -1;
    mbedtls_ssl_context* ssl = &ssl_contexts[slot];
    mbedtls_ssl_config* sconf = &slot_configs[slot];
    mbedtls_x509_crt* scert = &slot_cacerts[slot];
    
    memcpy(sconf, &conf, sizeof(mbedtls_ssl_config));
    mbedtls_x509_crt_init(scert);
    
    unsigned char* ca_str = (unsigned char*)ohn_resolve_ptr_safe(ca_str_offset, (uint32_t)ca_len);
    mbedtls_x509_crt_parse(scert, ca_str, (size_t)ca_len);
    
    mbedtls_ssl_conf_ca_chain(sconf, scert, NULL);
    mbedtls_ssl_setup(ssl, sconf);
    return 0;
}

int64_t sys_tls_handshake(int32_t slot) {
    if (slot < 0 || slot >= 10240) return -1;
    mbedtls_ssl_context* ssl = &ssl_contexts[slot];
    
    fprintf(stderr, "[TLS] Handshake START for slot %d\n", slot);
    int ret = mbedtls_ssl_handshake(ssl);
    fprintf(stderr, "[TLS] Handshake END for slot %d, ret=%d\n", slot, ret);
    
    if (ret == MBEDTLS_ERR_SSL_WANT_READ) return -1;
    if (ret == MBEDTLS_ERR_SSL_WANT_WRITE) return -2;
    if (ret < 0) {
        char errbuf[256];
        mbedtls_strerror(ret, errbuf, sizeof(errbuf));
        fprintf(stderr, "[TLS] handshake slot=%d FAILED: -0x%04X (%s)\n",
                slot, (unsigned int)-ret, errbuf);
        return -3;
    }
    fprintf(stderr, "[TLS] handshake slot=%d OK\n", slot);
    return 0;
}

int64_t sys_tls_read(int32_t slot, int32_t offset_idx, int32_t length) {
    if (slot < 0 || slot >= 10240) return -1;
    mbedtls_ssl_context* ssl = &ssl_contexts[slot];
    uint8_t* p = (uint8_t*)ohn_resolve_ptr_safe(read_buf + (offset_idx * 4), (uint32_t)length);
    int ret = mbedtls_ssl_read(ssl, p, (size_t)length);
    if (ret == MBEDTLS_ERR_SSL_WANT_READ) return -1;
    if (ret == MBEDTLS_ERR_SSL_WANT_WRITE) return -2;
    if (ret < 0) return -3;
    return (int64_t)ret;
}

int64_t sys_tls_write(int32_t slot, int32_t offset_idx, int32_t length) {
    if (slot < 0 || slot >= 10240) return -1;
    mbedtls_ssl_context* ssl = &ssl_contexts[slot];
    uint8_t* p = (uint8_t*)ohn_resolve_ptr_safe(read_buf + (offset_idx * 4), (uint32_t)length);
    fprintf(stderr, "[TLS] Writing %d bytes for slot %d\n", length, slot);
    int ret = mbedtls_ssl_write(ssl, p, (size_t)length);
    fprintf(stderr, "[TLS] Write for slot %d returned %d\n", slot, ret);
    if (ret == MBEDTLS_ERR_SSL_WANT_READ) return -1;
    if (ret == MBEDTLS_ERR_SSL_WANT_WRITE) return -2;
    if (ret < 0) return -3;
    return (int64_t)ret;
}

void sys_tls_close(int32_t slot) {
    if (slot < 0 || slot >= 10240) return;
    mbedtls_ssl_context* ssl = &ssl_contexts[slot];
    mbedtls_ssl_close_notify(ssl);
    mbedtls_ssl_free(ssl);
    mbedtls_x509_crt_free(&slot_cacerts[slot]);
}

