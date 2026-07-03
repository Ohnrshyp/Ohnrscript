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

extern void* read_buf;

int64_t sys_socket_read(int32_t fd, int32_t offset_idx, int32_t length) {
    uint8_t* p = (uint8_t*)read_buf + (offset_idx * 4);
    return (int64_t)read((int)fd, p, (size_t)length);
}

// Uses MSG_NOSIGNAL where available as an extra SIGPIPE guard.
int64_t sys_socket_write(int32_t fd, int32_t offset_idx, int32_t length) {
    uint8_t* p = (uint8_t*)read_buf + (offset_idx * 4);
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

extern void* event_results;

// Waits for events. Writes results as flat [fd, filter, fd, filter ...] i32 pairs.
int64_t sys_kqueue_wait(int32_t kq, int32_t dummy_ptr, int32_t max_events, int32_t timeout_ms) {
    struct kevent events[max_events];
    struct timespec ts;
    ts.tv_sec  = timeout_ms / 1000;
    ts.tv_nsec = (timeout_ms % 1000) * 1000000;
    int n = kevent((int)kq, NULL, 0, events, (int)max_events, timeout_ms >= 0 ? &ts : NULL);
    int32_t* out = (int32_t*)event_results;
    for (int i = 0; i < n; i++) {
        out[i * 2]     = (int32_t)events[i].ident;
        out[i * 2 + 1] = (int32_t)events[i].filter;
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
    uint8_t* p = (uint8_t*)read_buf + (offset_idx * 4);
    
    if (response_type == 2001) { // ROOT
        const char* resp = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!";
        memcpy(p, resp, 75);
    } else if (response_type == 2002) { // USERS
        const char* resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 17\r\n\r\n{\"users\":[\"db\"]}";
        memcpy(p, resp, 87);
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

/* ============================================================
 * 8. MEMORY ACCESS (For HTTP parser)
 * ============================================================ */
int64_t sys_mem_read_i8(int64_t offset_idx, int64_t byte_offset) {
    uint8_t* base = (uint8_t*)read_buf + (offset_idx * 4);
    return (int64_t)base[byte_offset];
}

int64_t sys_mem_read_i32(int64_t offset_idx, int64_t byte_offset) {
    uint8_t* base = (uint8_t*)read_buf + (offset_idx * 4);
    int32_t* p = (int32_t*)(base + byte_offset);
    return (int64_t)*p;
}
