/*
 * boot.c — Ohnrscript Kernel Boot Shim
 *
 * This is the infrastructure layer. It does three things:
 *   1. Places the multiboot1 header so QEMU/GRUB recognizes this as a kernel
 *   2. Sets up a stack (required before any function call)
 *   3. Calls kernelMain() — the Ohnrscript-compiled kernel logic
 *
 * Everything meaningful happens in kernelMain (compiled from kernel.ohn).
 * This file is analogous to crt0.o in a C program — infrastructure, not logic.
 */

#include <stdint.h>

/* ── Multiboot 1 Header ─────────────────────────────────────────────────── */
/* QEMU natively supports Multiboot 1 via the -kernel flag.                 */
/* Must appear in the first 8KB of the binary in a 32-bit aligned section.  */

#define MULTIBOOT_MAGIC     0x1BADB002
#define MULTIBOOT_FLAGS     0x00000003   /* bit0=page-align modules, bit1=meminfo */

struct multiboot_header {
    uint32_t magic;
    uint32_t flags;
    uint32_t checksum;
} __attribute__((packed));

__attribute__((section(".multiboot"), used, aligned(4)))
static const struct multiboot_header multiboot_hdr = {
    .magic    = MULTIBOOT_MAGIC,
    .flags    = MULTIBOOT_FLAGS,
    .checksum = (uint32_t)(-(MULTIBOOT_MAGIC + MULTIBOOT_FLAGS))
};

/* ── Static Stack ───────────────────────────────────────────────────────── */
/* 16KB stack, 16-byte aligned.                                             */

#define STACK_SIZE 16384
__attribute__((section(".bss"), aligned(16)))
static uint8_t kernel_stack[STACK_SIZE];

/* ── Serial Debug (COM1 = 0x3F8) ────────────────────────────────────────── */
/* Write bytes to the serial port so we can see output via -serial stdio.   */


static inline uint8_t inb_serial(uint16_t port) {
    uint8_t r;
    __asm__ volatile("inb %1, %0" : "=a"(r) : "Nd"(port));
    return r;
}
static inline void outb_serial(uint16_t port, uint8_t val) {
    __asm__ volatile("outb %0, %1" : : "a"(val), "Nd"(port));
}

static void serial_init() {
    outb_serial(0x3F8 + 1, 0x00); /* Disable interrupts */
    outb_serial(0x3F8 + 3, 0x80); /* Enable DLAB */
    outb_serial(0x3F8 + 0, 0x03); /* 38400 baud */
    outb_serial(0x3F8 + 1, 0x00);
    outb_serial(0x3F8 + 3, 0x03); /* 8 bits, no parity, 1 stop bit */
    outb_serial(0x3F8 + 2, 0xC7); /* Enable FIFO */
    outb_serial(0x3F8 + 4, 0x0B); /* RTS/DSR */
}

static void serial_print(const char *s) {
    while (*s) {
        while (!(inb_serial(0x3F8 + 5) & 0x20)) {} /* wait for TX ready */
        outb_serial(0x3F8, (uint8_t)*s++);
    }
}

/* ── Hardware Abstraction Layer ─────────────────────────────────────────── */
/* Expose x86 I/O port instructions to Ohnrscript via FFI.                  */

uint32_t inb(uint32_t port) {
    uint8_t ret;
    __asm__ volatile("inb %w1, %0" : "=a"(ret) : "Nd"((uint16_t)port));
    return (uint32_t)ret;
}

uint32_t outb(uint32_t port, uint32_t data) {
    __asm__ volatile("outb %0, %w1" : : "a"((uint8_t)data), "Nd"((uint16_t)port));
    return 0;
}

uint32_t inw(uint32_t port) {
    uint16_t ret;
    __asm__ volatile("inw %w1, %0" : "=a"(ret) : "Nd"((uint16_t)port));
    return (uint32_t)ret;
}

uint32_t outw(uint32_t port, uint32_t data) {
    __asm__ volatile("outw %0, %w1" : : "a"((uint16_t)data), "Nd"((uint16_t)port));
    return 0;
}

uint32_t outl(uint32_t port, uint32_t data) {
    __asm__ volatile("outl %0, %w1" : : "a"((uint32_t)data), "Nd"((uint16_t)port));
    return 0;
}

uint32_t inl(uint32_t port) {
    uint32_t ret;
    __asm__ volatile("inl %w1, %0" : "=a"(ret) : "Nd"((uint16_t)port));
    return ret;
}

uint32_t mfence() {
    __asm__ volatile("mfence" ::: "memory");
    return 0;
}

uint32_t hlt() {
    /* pause: hints the CPU we're in a spin-wait loop, saving power.
     * hlt would deadlock with all interrupts masked. */
    __asm__ volatile("pause");
    return 0;
}

uint32_t sti() {
    outb(0x3F8, 83);
    outb(0x3F8, 84);
    outb(0x3F8, 73);
    outb(0x3F8, 10);
    __asm__ volatile("sti");
    return 0;
}

extern uint32_t _virtio_rings_start;
uint32_t get_virtio_rings_addr() {
    return (uint32_t)&_virtio_rings_start;
}

static void serial_print_hex(uint32_t val) {
    for (int i = 28; i >= 0; i -= 4) {
        uint8_t nibble = (val >> i) & 0xF;
        outb(0x3F8, nibble < 10 ? '0' + nibble : 'A' + nibble - 10);
    }
}

// Callable from Ohnrscript via __extern('ext_dump_rings')
// Reads ring memory directly from C pointers — no Ohnrscript involved
uint32_t ext_dump_rings(uint32_t _a, uint32_t _b) {
    uint32_t rings_pa = get_virtio_rings_addr();
    volatile uint32_t* desc  = (volatile uint32_t*)(uintptr_t)rings_pa;
    volatile uint32_t* avail = (volatile uint32_t*)(uintptr_t)(rings_pa + 4096);
    volatile uint32_t* used  = (volatile uint32_t*)(uintptr_t)(rings_pa + 8192);

    serial_print("D0: ");  // First descriptor
    serial_print_hex(desc[0]); outb(0x3F8, ' ');
    serial_print_hex(desc[1]); outb(0x3F8, ' ');
    serial_print_hex(desc[2]); outb(0x3F8, ' ');
    serial_print_hex(desc[3]); outb(0x3F8, '\n');

    serial_print("AV: ");  // Available ring word 0 (flags|idx)
    serial_print_hex(avail[0]); outb(0x3F8, ' ');
    serial_print_hex(avail[1]); outb(0x3F8, '\n');

    serial_print("US: ");  // Used ring word 0 (flags|idx) + entry 0
    serial_print_hex(used[0]); outb(0x3F8, ' ');
    serial_print_hex(used[1]); outb(0x3F8, ' ');
    serial_print_hex(used[2]); outb(0x3F8, '\n');

    return 0;
}

/* ── Interrupt Ring Buffer (Top/Bottom Half) ────────────────────────────── */
#define IRQ_QUEUE_SIZE 256
static volatile uint32_t irq_queue[IRQ_QUEUE_SIZE];
static volatile uint32_t irq_head = 0;
static volatile uint32_t irq_tail = 0;

static void push_irq(uint32_t irqNumber) {
    uint32_t next = (irq_head + 1) % IRQ_QUEUE_SIZE;
    if (next != irq_tail) {
        irq_queue[irq_head] = irqNumber;
        irq_head = next;
    }
}

uint32_t poll_interrupt() {
    if (irq_head == irq_tail) return 0;
    uint32_t irq = irq_queue[irq_tail];
    irq_tail = (irq_tail + 1) % IRQ_QUEUE_SIZE;
    return irq;
}

/* ── Hardware Interrupt Handlers (Top Half) ─────────────────────────────── */
struct interrupt_frame {
    uint32_t ip;
    uint32_t cs;
    uint32_t flags;
    uint32_t sp;
    uint32_t ss;
};

__attribute__((interrupt)) void irq1_handler(struct interrupt_frame *frame) {
    push_irq(1);
    outb(0x20, 0x20); /* EOI to Master PIC */
}

__attribute__((interrupt)) void irq9_handler(struct interrupt_frame *frame) {
    push_irq(9);
    outb(0xA0, 0x20); /* EOI to Slave PIC */
    outb(0x20, 0x20); /* EOI to Master PIC */
}

__attribute__((interrupt)) void irq10_handler(struct interrupt_frame *frame) {
    push_irq(10);
    outb(0xA0, 0x20); /* EOI to Slave PIC */
    outb(0x20, 0x20); /* EOI to Master PIC */
}

__attribute__((interrupt)) void irq11_handler(struct interrupt_frame *frame) {
    /* Read VirtIO ISR to deassert level-triggered interrupt line.
     * stateMem[4] holds ioBase, set during VirtIO init before sti().
     * Address: 0x600000 + (4 * 4) = 0x600010.
     * The guard handles the window before VirtIO init sets ioBase. */
    volatile uint32_t *state = (volatile uint32_t *)0x600000;
    uint32_t io_base = state[4];
    if (io_base != 0) {
        inb_serial((uint16_t)(io_base + 19)); /* ISR read clears interrupt */
    }

    push_irq(11);
    outb(0xA0, 0x20); /* EOI to Slave PIC */
    outb(0x20, 0x20); /* EOI to Master PIC */
}

/* ── IDT & PIC Setup ────────────────────────────────────────────────────── */
struct idt_entry {
    uint16_t base_lo;
    uint16_t sel;
    uint8_t  always0;
    uint8_t  flags;
    uint16_t base_hi;
} __attribute__((packed));

struct idt_ptr {
    uint16_t limit;
    uint32_t base;
} __attribute__((packed));

static struct idt_entry idt[256];
static struct idt_ptr idtp;

static void idt_set_gate(uint8_t num, uint32_t base, uint16_t sel, uint8_t flags) {
    idt[num].base_lo = (base & 0xFFFF);
    idt[num].base_hi = (base >> 16) & 0xFFFF;
    idt[num].sel     = sel;
    idt[num].always0 = 0;
    idt[num].flags   = flags;
}

static void pic_remap() {
    outb(0x20, 0x11); outb(0xA0, 0x11);
    outb(0x21, 0x20); outb(0xA1, 0x28);
    outb(0x21, 0x04); outb(0xA1, 0x02);
    outb(0x21, 0x01); outb(0xA1, 0x01);
    outb(0x21, 0x0);  outb(0xA1, 0x0);
}

static void setup_interrupts() {
    idtp.limit = (sizeof(struct idt_entry) * 256) - 1;
    idtp.base  = (uint32_t)&idt;

    pic_remap();

    /* Mask ALL interrupts on both PICs — fully polled architecture.
     * VirtIO and keyboard are polled directly from the main loop.
     * IDT gates remain installed as safety nets but will never fire. */
    outb(0x21, 0xFF);  /* Master PIC: mask all (including IRQ 1 keyboard) */
    outb(0xA1, 0xFF);  /* Slave PIC: mask all (including IRQ 11 VirtIO)  */

    idt_set_gate(0x21, (uint32_t)irq1_handler, 0x08, 0x8E);
    idt_set_gate(0x29, (uint32_t)irq9_handler, 0x08, 0x8E);
    idt_set_gate(0x2A, (uint32_t)irq10_handler, 0x08, 0x8E);
    idt_set_gate(0x2B, (uint32_t)irq11_handler, 0x08, 0x8E);

    __asm__ volatile("lidt %0" : : "m" (idtp));
}


/* ── VGA Wrappers ───────────────────────────────────────────────────────── */
/* We expose these to Ohnrscript to avoid 32-bit vs 16-bit pointer math.    */

uint32_t vgaWriteChar(uint32_t offset, uint32_t ascii, uint32_t color) {
    volatile uint16_t *vga = (volatile uint16_t *)0xB8000;
    vga[offset] = (uint16_t)((color << 8) | (ascii & 0xFF));
    return 0;
}

uint32_t vgaClearScreen() {
    volatile uint16_t *vga = (volatile uint16_t *)0xB8000;
    for (int i = 0; i < 2000; i++) {
        vga[i] = (uint16_t)(0x0F20); /* White-on-black space */
    }
    return 0;
}

/* ── Unikernel C-Shims (Replacing POSIX bindings.c) ─────────────────────── */

static void kernel_memcpy(void* dest, const void* src, uint32_t len) {
    uint8_t* d = (uint8_t*)dest;
    const uint8_t* s = (const uint8_t*)src;
    for (uint32_t i = 0; i < len; i++) {
        d[i] = s[i];
    }
}

uint32_t sys_fill_response(uint32_t ptr, uint32_t response_type) {
    uint8_t* p = (uint8_t*)(uintptr_t)ptr;
    if (response_type == 2001) { // ROOT
        const char* resp = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!";
        kernel_memcpy(p, resp, 75);
    } else if (response_type == 2002) { // USERS
        const char* resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 17\r\n\r\n{\"users\":[\"db\"]}";
        kernel_memcpy(p, resp, 87);
    } else if (response_type == 404) {
        const char* resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot Found";
        kernel_memcpy(p, resp, 54);
    } else if (response_type == 405) {
        const char* resp = "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n";
        kernel_memcpy(p, resp, 55);
    }
    return 0;
}

uint32_t sys_mem_read_i8(uint32_t ptr, uint32_t byte_offset) {
    uint8_t* p = (uint8_t*)(uintptr_t)ptr;
    return p[byte_offset];
}

uint32_t sys_mem_read_i32(uint32_t ptr, uint32_t byte_offset) {
    uint8_t* base = (uint8_t*)(uintptr_t)ptr;
    uint32_t* p = (uint32_t*)(base + byte_offset);
    return *p;
}

// VirtIO Block stub for db.ohn
uint32_t ext_sys_lba_read(uint32_t relative_start_block, uint32_t num_blocks, uint32_t frame_id) {
    return 0;
}

// VirtIO Network Transmit Kick
uint32_t ext_virtio_tx_kick(uint32_t io_base, uint32_t queue_index) {
    __asm__ volatile("" ::: "memory");
    // Write queue_index to Queue Notify register (io_base + 16)
    __asm__ volatile("outw %w0, %w1" : : "a"((uint16_t)queue_index), "Nd"((uint16_t)(io_base + 16)));
    return 0;
}

// VirtIO Network Receive Kick
uint32_t ext_virtio_rx_kick(uint32_t io_base, uint32_t queue_index) {
    __asm__ volatile("" ::: "memory");
    __asm__ volatile("outw %w0, %w1" : : "a"((uint16_t)queue_index), "Nd"((uint16_t)(io_base + 16)));
    return 0;
}

// Push one TX descriptor into the TX vring and kick the device.
// Called from .ohn modules via __extern('ext_push_tx_ring').
//
// MAILBOX PROTOCOL: Function arguments are IGNORED.
// All inputs are read from stateMem (0x600000):
//   stateMem[20] = tx_rings_pa  (TX descriptor table physical address)
//   stateMem[21] = tx_buf_pa    (buffer physical address, includes virtio_net_hdr)
//   stateMem[22] = length       (total byte length of the buffer)
//   stateMem[23] = avail_pa     (TX vring_avail ring physical address)
//   stateMem[24] = io_base      (VirtIO I/O port base)
//
// This design makes the LLVM IR calling convention irrelevant — data flows
// through the shared stateMem region, not through registers.
uint32_t ext_push_tx_ring(uint32_t _a, uint32_t _b, uint32_t _c, uint32_t _d, uint32_t _e) {
    volatile uint32_t* state = (volatile uint32_t*)0x600000;

    uint32_t tx_rings_pa = state[20];
    uint32_t tx_buf_pa   = state[21];
    uint32_t length      = state[22];
    uint32_t avail_pa    = state[23];
    uint32_t io_base     = state[24];

    volatile uint32_t* desc = (volatile uint32_t*)(uintptr_t)tx_rings_pa;
    volatile uint32_t* avail = (volatile uint32_t*)(uintptr_t)avail_pa;

    // Read current avail idx (upper 16 bits of avail word 0)
    uint32_t flags_idx = avail[0];
    uint16_t avail_idx = (uint16_t)(flags_idx >> 16);
    uint16_t ring_index = avail_idx & 255;

    // Write descriptor at ring_index (each descriptor is 4 words = 16 bytes)
    uint32_t desc_base = ring_index * 4;
    desc[desc_base + 0] = tx_buf_pa;   // addr low 32 bits
    desc[desc_base + 1] = 0;           // addr high 32 bits
    desc[desc_base + 2] = length;      // len
    desc[desc_base + 3] = 0;           // flags=0 (device reads), no chaining

    __asm__ volatile("mfence" ::: "memory");

    // Write descriptor index into avail ring entries
    uint32_t word_index = ring_index >> 1;
    uint32_t current_word = avail[word_index + 1];
    if (ring_index & 1) {
        current_word = (current_word & 0x0000FFFF) | ((uint32_t)ring_index << 16);
    } else {
        current_word = (current_word & 0xFFFF0000) | (uint32_t)ring_index;
    }
    avail[word_index + 1] = current_word;

    __asm__ volatile("mfence" ::: "memory");

    // Advance avail idx
    avail_idx = (avail_idx + 1) & 0xFFFF;
    avail[0] = 0x0001 | ((uint32_t)avail_idx << 16); /* flags=VRING_AVAIL_F_NO_INTERRUPT, always */

    __asm__ volatile("mfence" ::: "memory");

    // Kick TX queue (queue index = 1)
    __asm__ volatile("outw %w0, %w1" : : "a"((uint16_t)1), "Nd"((uint16_t)(io_base + 16)));
    return 0;
}

// ── C-side RX ring population ─────────────────────────────────────────────
// MAILBOX PROTOCOL: reads stateMem[4]=ioBase, stateMem[5]=ringsPA
// This is the C equivalent of the Ohnrscript populateRxRing function.
// If this works but the Ohnrscript version doesn't, the issue is in codegen.
uint32_t ext_populate_rx_ring(uint32_t _a, uint32_t _b) {
    volatile uint32_t* state = (volatile uint32_t*)0x600000;
    uint32_t io_base = state[4];
    uint32_t rx_queue_pa = state[5];

    serial_print("POP-QPA:");
    serial_print_hex(rx_queue_pa);
    outb(0x3F8, '\n');

    volatile uint32_t* desc = (volatile uint32_t*)(uintptr_t)rx_queue_pa;
    volatile uint32_t* avail = (volatile uint32_t*)(uintptr_t)(rx_queue_pa + 4096);
    uint32_t rx_buffer_base = 0x300000;

    serial_print("POP-AVL:");
    serial_print_hex((uint32_t)(uintptr_t)avail);
    outb(0x3F8, '\n');

    // Fill 256 descriptors
    for (uint32_t i = 0; i < 256; i++) {
        uint32_t buf_addr = rx_buffer_base + (i * 2048);
        uint32_t d = i * 4; // 4 words per descriptor (16 bytes)
        desc[d + 0] = buf_addr;  // addr low
        desc[d + 1] = 0;         // addr high
        desc[d + 2] = 2048;      // len
        desc[d + 3] = 2;         // flags = VRING_DESC_F_WRITE
    }

    __asm__ volatile("mfence" ::: "memory");

    // Fill available ring entries (pack 2 x uint16 per word)
    for (uint32_t j = 0; j < 128; j++) {
        uint32_t val1 = j * 2;
        uint32_t val2 = (j * 2) + 1;
        avail[j + 1] = val1 | (val2 << 16);
    }

    __asm__ volatile("mfence" ::: "memory");

    // Set flags=1 (VRING_AVAIL_F_NO_INTERRUPT), idx=256
    // Low 16 bits = flags = 0x0001, High 16 bits = idx = 0x0100 (256 LE)
    avail[0] = 0x01000001;

    // Read back to verify
    uint32_t readback = avail[0];
    serial_print("POP-RB:");
    serial_print_hex(readback);
    outb(0x3F8, '\n');

    __asm__ volatile("mfence" ::: "memory");
    return 0;
}

// ── Linker Stubs for db.ohn and Ohnrscript ──────────────────────────────
uint32_t ohn_alloc_f32(uint32_t size) { return 0; }
uint32_t ext_sys_disk_init() { return 0; }
uint32_t ext_sys_rwlock_init(uint32_t f) { return 0; }
uint32_t ext_sys_lba_write(uint32_t start, uint32_t num, uint32_t frame) { return 0; }
uint32_t ext_sys_rwlock_rlock(uint32_t f) { return 0; }
uint32_t ext_sys_rwlock_unlock(uint32_t f) { return 0; }
uint32_t ext_sys_rwlock_wlock(uint32_t f) { return 0; }
uint32_t ext_sys_frame_write_i32(uint32_t frame, uint32_t offset, uint32_t val) { return 0; }
uint32_t ext_sys_frame_read_i32(uint32_t frame, uint32_t offset) { return 0; }
uint32_t ext_sys_frame_write_byte(uint32_t frame, uint32_t offset, uint32_t val) { return 0; }
uint32_t ext_sys_frame_read_byte(uint32_t frame, uint32_t offset) { return 0; }
uint32_t ext_print_boot() { return 0; }
uint32_t ext_print_success() { return 0; }
uint32_t ext_print_num(uint32_t num) { return 0; }
uint32_t ext_sys_thread_create(uint32_t id) { return 0; }
uint32_t ext_sys_thread_join(uint32_t id) { return 0; }


/* ── Forward Declaration ────────────────────────────────────────────────── */
/* kernelMain is compiled from kernel.ohn by the Ohnrscript LLVM generator. */
/* Zero parameters — banner is written from C, keyboard loop is self-contained. */

extern int kernelMain(void);
void* ohn_heap_base = (void*)0;

/* ── Banner Helper ──────────────────────────────────────────────────────── */
/* Write a C string to VGA at a given row, with a given color attribute.    */

static void vga_print_row(int row, const char *s, uint8_t color) {
    int col = 0;
    while (*s && col < 80) {
        vgaWriteChar(row * 80 + col, (uint8_t)*s, color);
        s++;
        col++;
    }
}

/* ── Kernel Entry Point ─────────────────────────────────────────────────── */

struct multiboot_info {
    uint32_t flags;
    uint32_t mem_lower;
    uint32_t mem_upper;
    uint32_t boot_device;
    uint32_t cmdline;
};

uint32_t authorized_vlan_id = 0;

uint32_t get_authorized_vlan_id() {
    return authorized_vlan_id;
}

static uint32_t parse_vlan_arg(const char *cmdline) {
    if (!cmdline) return 0;
    
    int i = 0;
    while (cmdline[i] != '\0' && i < 1024) { // Absolute 1KB limit
        if (cmdline[i] == 'V' && cmdline[i+1] == 'L' && cmdline[i+2] == 'A' && cmdline[i+3] == 'N' && cmdline[i+4] == '=') {
            int j = i + 5;
            uint32_t vlan = 0;
            int digits = 0;
            while (cmdline[j] >= '0' && cmdline[j] <= '9' && digits < 5) {
                vlan = (vlan * 10) + (cmdline[j] - '0');
                j++;
                digits++;
            }
            // Clamp to maximum valid VLAN ID
            if (vlan > 4095) vlan = 4095;
            return vlan;
        }
        i++;
    }
    return 0;
}

// Convert integer to string (max 4 chars for VLAN) and print
static void vga_print_vlan_status(uint32_t vlan) {
    vga_print_row(2, "[BOOT] Identity Locked to VLAN: ", 0x0A); // Light Green
    
    if (vlan == 0) {
        vgaWriteChar((2 * 80) + 32, '0', 0x0A);
        return;
    }
    
    char buf[8];
    int len = 0;
    uint32_t temp = vlan;
    while (temp > 0) {
        buf[len++] = (temp % 10) + '0';
        temp /= 10;
    }
    
    int offset = 32;
    for (int i = len - 1; i >= 0; i--) {
        vgaWriteChar((2 * 80) + offset, buf[i], 0x0A);
        offset++;
    }
}

void __attribute__((noreturn)) c_main(uint32_t magic, uint32_t mb_info_addr) {
    /* Initialize serial so we can debug */
    serial_init();
    serial_print("[BOOT] c_main entered\r\n");

    /* Defensively Parse Multiboot Magic */
    if (magic == 0x2BADB002) {
        struct multiboot_info *mbi = (struct multiboot_info *)mb_info_addr;
        if (mbi->flags & (1 << 2)) {
            authorized_vlan_id = parse_vlan_arg((const char *)mbi->cmdline);
        }
    }

    /* Clear screen */
    vgaClearScreen();

    /* Write banner from C — Ohnrscript never touches C strings */
    vga_print_row(0, "  OHNRSCRIPT KERNEL v0.1 | Compiled from JS via LLVM IR | No Runtime", 0x0F);
    vga_print_row(1, "------------------------------------------------------------------------", 0x07);
    
    /* Visually confirm VLAN identity */
    vga_print_vlan_status(authorized_vlan_id);

    serial_print("[BOOT] Setting up IDT and PIC...\r\n");
    setup_interrupts();

    serial_print("[BOOT] Banner written, calling kernelMain()...\r\n");

    /* Call into Ohnrscript — zero args, no ABI mismatch possible */
    kernelMain();

    serial_print("[BOOT] kernelMain returned (unexpected)\r\n");

    /* Halt forever */
    for (;;) {
        __asm__ volatile ("hlt");
    }
}

void __attribute__((naked, noreturn)) _start(void) {
    /* Set up our own stack immediately */
    __asm__ volatile (
        "movl %0, %%esp\n\t"
        "pushl %%ebx\n\t" /* Push Multiboot struct pointer */
        "pushl %%eax\n\t" /* Push Magic Number */
        "call c_main\n\t" /* Jump into standard C */
        "1:\n\t"          /* Halt loop if c_main returns */
        "hlt\n\t"
        "jmp 1b\n\t"
        :
        : "i"((uint32_t)(kernel_stack + STACK_SIZE))
        : "memory"
    );
}

