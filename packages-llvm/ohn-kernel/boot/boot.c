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

/* ── Forward Declaration ────────────────────────────────────────────────── */
/* kernelMain is compiled from kernel.ohn by the Ohnrscript LLVM generator. */

extern int kernelMain(
    uint32_t vga_unused,
    const uint8_t *msg1, int len1,
    const uint8_t *msg2, int len2,
    const uint8_t *msg3, int len3,
    const uint8_t *msg4, int len4,
    const uint8_t *msg5, int len5
);

/* ── String Constants ───────────────────────────────────────────────────── */
static const uint8_t MSG_BANNER[]  = "  OHNRSCRIPT KERNEL v0.1  |  Compiled from JS via LLVM IR  |  No Runtime";
static const uint8_t MSG_SEP[]     = "------------------------------------------------------------------------";
static const uint8_t MSG_OK[]      = "[ OK ] Kernel loaded. No JS runtime. No GC. No engine. Ring 0.";
static const uint8_t MSG_SCAN[]    = "[ KBD ] Polling PS/2 keyboard. Type anything: ";
static const uint8_t MSG_HALT[]    = "[ -- ] System halted.";

/* ── Kernel Entry Point ─────────────────────────────────────────────────── */

void __attribute__((noreturn)) _start(void) {
    /* Set up our own stack immediately */
    __asm__ volatile (
        "movl %0, %%esp\n\t"
        :
        : "r"((uint32_t)(kernel_stack + STACK_SIZE))
        : "memory"
    );

    /* Initialize serial so we can debug */
    serial_init();
    serial_print("[BOOT] _start entered\r\n");

    /* Clear VGA screen directly from C — sanity check before calling Ohnrscript */
    serial_print("[BOOT] Clearing VGA...\r\n");
    vgaClearScreen();

    /* Write a single character at top-left directly from C */
    serial_print("[BOOT] Writing 'O' to VGA cell 0...\r\n");
    vgaWriteChar(0, 'O', 0x0A); /* Green O at top-left */
    vgaWriteChar(1, 'H', 0x0A);
    vgaWriteChar(2, 'N', 0x0A);

    serial_print("[BOOT] Calling kernelMain...\r\n");

    kernelMain(
        0,
        MSG_BANNER, (int)sizeof(MSG_BANNER) - 1,
        MSG_SEP,    (int)sizeof(MSG_SEP)    - 1,
        MSG_OK,     (int)sizeof(MSG_OK)     - 1,
        MSG_SCAN,   (int)sizeof(MSG_SCAN)   - 1,
        MSG_HALT,   (int)sizeof(MSG_HALT)   - 1
    );

    serial_print("[BOOT] kernelMain returned (unexpected)\r\n");

    /* Halt forever */
    for (;;) {
        __asm__ volatile ("hlt");
    }
}
