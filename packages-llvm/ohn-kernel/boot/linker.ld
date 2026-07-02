/* linker.ld — Ohnrscript Kernel Linker Script
 *
 * Places the kernel binary at 1MB physical address (0x100000) —
 * the standard load address for multiboot kernels. GRUB expects
 * this. The multiboot header must appear first so GRUB finds it
 * in the first 32KB of the binary.
 */

OUTPUT_FORMAT(elf32-i386)
ENTRY(_start)

SECTIONS
{
    /* Load at 1MB — standard multiboot kernel load address */
    . = 0x100000;

    /* Executable code */
    .text : {
        *(.multiboot)
        *(.text)
        *(.text.*)
    }

    /* Read-only data (string constants, etc.) */
    .rodata ALIGN(4096) : {
        *(.rodata)
        *(.rodata.*)
    }

    /* Initialized data */
    .data ALIGN(4096) : {
        *(.data)
        *(.data.*)
    }

    /* Zero-initialized data (stack lives here) */
    .bss ALIGN(4096) : {
        *(COMMON)
        *(.bss)
        *(.bss.*)
    }

    /* Discard debug sections to keep binary minimal */
    /DISCARD/ : {
        *(.comment)
        *(.eh_frame)
        *(.note.GNU-stack)
    }
}
