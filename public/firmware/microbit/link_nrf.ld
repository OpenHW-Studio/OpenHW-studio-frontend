/* link_nrf.ld — flat image layout for the nRF52833 fixed .bin fixtures.
 *
 * The engine boots a flat .bin at 0x0 and reads SP/PC from 0x0/0x4, so
 * the vector table must land FIRST, then code, then literals.
 *
 * Build recipe (xpack arm-none-eabi-gcc):
 *   ${TC}as -march=armv7e-m -mfloat-abi=hard -mfpu=fpv4-sp-d16 \
 *       -o x.o x.s
 *   ${TC}ld -T link_nrf.ld -o x.elf x.o
 *   ${TC}objcopy -O binary x.elf x.bin
 */
MEMORY {
  FLASH (rx) : ORIGIN = 0x00000000, LENGTH = 512K
  RAM   (rwx): ORIGIN = 0x20000000, LENGTH = 128K
}
SECTIONS {
  .vectors : { KEEP(*(.vectors)) } > FLASH
  .text    : { *(.text*) } > FLASH
  .rodata  : { *(.rodata*) } > FLASH
  _srodata = .;
}
