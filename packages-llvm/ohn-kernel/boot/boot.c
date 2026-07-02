/*
 * boot.c — Ohnrscript Kernel Boot Shim
 *
 * This is the infrastructure layer. It does three things:
 *   1. Places the multiboot2 header so GRUB recognizes this as a kernel
 *   2. Sets up a stack (required before any function call)
 *   3. Calls kernelMain() — the Ohnrscript-compiled kernel logic
 *
 * Everything meaningful happens in kernelMain (compiled from kernel.ohn).
 * This file is analogous to crt0.o in a C program — infrastructure, not logic.
 *
 * Compile: clang -target x86_64-elf -ffreestanding -fno-builtin -O2 -c boot.c -o boot.o
 */

#include <stdint.h>

/* ── Multiboot2 Header ──────────────────────────────────────────────────── */
/* GRUB reads this to identify and load our kernel binary.                  */
/* Must appear in the first 32KB of the binary in a 64-bit aligned section. */

#define MULTIBOOT2_MAGIC     0xE85250D6
#define MULTIBOOT2_ARCH_I386 0
#define MULTIBOOT2_HEADER_LEN 16

struct multiboot2_header {
    uint32_t magic;
    uint32_t architecture;
    uint32_t header_length;
    uint32_t checksum;
} __attribute__((packed));

__attribute__((section(".multiboot"), used))
static const struct multiboot2_header multiboot_header = {
    .magic         = MULTIBOOT2_MAGIC,
    .architecture  = MULTIBOOT2_ARCH_I386,
    .header_length = MULTIBOOT2_HEADER_LEN,
    .checksum      = -(MULTIBOOT2_MAGIC + MULTIBOOT2_ARCH_I386 + MULTIBOOT2_HEADER_LEN)
};

/* ── Static Stack ───────────────────────────────────────────────────────── */
/* 16KB stack, 16-byte aligned (required by System V x86-64 ABI).           */

#define STACK_SIZE 16384
__attribute__((section(".bss"), aligned(16)))
static uint8_t kernel_stack[STACK_SIZE];

/* ── String Constants ───────────────────────────────────────────────────── */
/* These are passed as byte arrays to kernelMain.                            */
/* The Ohnrscript kernel receives them as i64 pointer parameters.            */

static const uint8_t MSG_BANNER[]  = "  OHNRSCRIPT KERNEL v0.1  |  Compiled from JavaScript via LLVM IR  |  No Runtime";
static const uint8_t MSG_SEP[]     = "--------------------------------------------------------------------------------";
static const uint8_t MSG_OK[]      = "[ OK ] Kernel loaded. No JavaScript runtime. No GC. No engine. Ring 0.";
static const uint8_t MSG_SCAN[]    = "[ MEM ] VGA buffer checksum: 0x";
static const uint8_t MSG_HALT[]    = "[ -- ] System halted. Ohnrscript kernel complete.";

/* ── Forward Declaration ────────────────────────────────────────────────── */
/* kernelMain is compiled from kernel.ohn by the Ohnrscript LLVM generator. */
/* It receives: VGA base ptr + 5 string (ptr, len) pairs.                   */

extern int kernelMain(
    uint8_t *vga,
    const uint8_t *msg1, int len1,
    const uint8_t *msg2, int len2,
    const uint8_t *msg3, int len3,
    const uint8_t *msg4, int len4,
    const uint8_t *msg5, int len5
);

/* ── Kernel Entry Point ─────────────────────────────────────────────────── */
/* _start is the ELF entry point. GRUB jumps here in 32-bit protected mode. */
/* We immediately set up the stack and call kernelMain.                     */

void __attribute__((noreturn)) _start(void) {
    /* Set up stack pointer to the top of our static stack */
    __asm__ volatile (
        "mov %0, %%rsp\n\t"
        :
        : "r"((uint64_t)(kernel_stack + STACK_SIZE))
        : "memory"
    );

    /* VGA text buffer physical address on x86 */
    uint8_t *vga = (uint8_t *)0xB8000;

    /* Call the Ohnrscript-compiled kernel logic */
    kernelMain(
        vga,
        MSG_BANNER, (int)sizeof(MSG_BANNER) - 1,
        MSG_SEP,    (int)sizeof(MSG_SEP)    - 1,
        MSG_OK,     (int)sizeof(MSG_OK)     - 1,
        MSG_SCAN,   (int)sizeof(MSG_SCAN)   - 1,
        MSG_HALT,   (int)sizeof(MSG_HALT)   - 1
    );

    /* Halt forever — kernelMain should not return, but if it does: */
    for (;;) {
        __asm__ volatile ("hlt");
    }
}
