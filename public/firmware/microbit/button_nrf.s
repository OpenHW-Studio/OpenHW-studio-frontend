    .syntax unified
    .cpu cortex-m4
    .thumb
    .section .vectors,"a",%progbits
    .word 0x20002000          /* SP */
    .word _start+1            /* Reset */
    .text
    .global _start
    .thumb_func
/* Button A = P0.14, Button B = P0.23 (active LOW, edge fingers P5/P11).
   Prints BTN_A/BTN_B on press, BTN_A_REL/BTN_B_REL on release. */
_start:
    /* HFCLK start: *(0x40000000) = 1 */
    ldr r0, =0x40000000
    movs r1, #1
    str r1, [r0]
    /* UARTE ENABLE=8: *(0x40002500) = 8 */
    ldr r0, =0x40002500
    movs r1, #8
    str r1, [r0]
    /* P0.14 + P0.23 input with pullup: PIN_CNF = 0xC */
    ldr r0, =0x50000738
    movs r1, #0xC
    str r1, [r0]
    ldr r0, =0x5000075C
    movs r1, #0xC
    str r1, [r0]
    /* print BTN_READY */
    ldr r4, =msg_ready
    bl print_cstr
    movs r6, #1               /* prevA = released */
    movs r7, #1               /* prevB = released */
loop:
    ldr r0, =0x50000510
    ldr r0, [r0]              /* GPIO IN */
    /* --- button A (bit 14): carry = bit after LSR #15 --- */
    lsrs r1, r0, #15
    bcs rel_a
    cmp r6, #1                /* pressed: print only on 1->0 edge */
    bne chk_b
    ldr r4, =msg_a
    bl print_cstr
    movs r6, #0
    b chk_b
rel_a:
    cmp r6, #0
    bne chk_b
    ldr r4, =msg_a_rel
    bl print_cstr
    movs r6, #1
chk_b:
    /* --- button B (bit 23): carry = bit after LSR #24 --- */
    lsrs r1, r0, #24
    bcs rel_b
    cmp r7, #1
    bne loop
    ldr r4, =msg_b
    bl print_cstr
    movs r7, #0
    b loop
rel_b:
    cmp r7, #0
    bne loop
    ldr r4, =msg_b_rel
    bl print_cstr
    movs r7, #1
    b loop

/* r4 = cstring pointer; clobbers r0-r3 (r6/r7 preserved) */
print_cstr:
    push {r4, lr}
    mov r0, r4
pc_loop:
    ldrb r1, [r0]
    adds r0, r0, #1
    cbz r1, pc_done
    ldr r2, =0x4000251C       /* UARTE TXD */
    str r1, [r2]
    b pc_loop
pc_done:
    pop {r4, pc}

    .section .rodata
msg_ready:  .asciz "BTN_READY\n"
msg_a:      .asciz "BTN_A\n"
msg_a_rel:  .asciz "BTN_A_REL\n"
msg_b:      .asciz "BTN_B\n"
msg_b_rel:  .asciz "BTN_B_REL\n"
