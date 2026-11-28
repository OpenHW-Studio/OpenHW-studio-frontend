    .syntax unified
    .cpu cortex-m4
    .thumb
    .section .vectors,"a",%progbits
    .word 0x20002000          /* SP */
    .word _start+1            /* Reset */
    .text
    .global _start
    .thumb_func
/* SAADC (ADC) cell: the guest samples AIN0 and prints the RAW COUNT it
   read out of the SAADC RESULT buffer.
 *
 * The host injects the sample through the SAADC EASYDMA path (the runner
 * pump: saadc_take_result -> mem_write(RESULT.PTR) -> saadc_complete_
 * result). The printed number is therefore the value the host injected,
 * observed by the guest through the ADC — not a self-report.
 *
 * SAADC (0x40007000):
 *   TASKS_START 0x000 / TASKS_SAMPLE 0x004
 *   EVENTS_END 0x104
 *   ENABLE 0x500 / CH0.PSELP 0x510 / CH0.CONFIG 0x518
 *   RESOLUTION 0x5F0 / RESULT.PTR 0x62C / RESULT.MAXCNT 0x630
 */
_start:
    /* HFCLK start: *(0x40000000) = 1 */
    ldr r0, =0x40000000
    movs r1, #1
    str r1, [r0]
    /* UARTE ENABLE=8: *(0x40002500) = 8 */
    ldr r0, =0x40002500
    movs r1, #8
    str r1, [r0]
    /* banner */
    ldr r4, =msg_ready
    bl print_cstr

    /* SAADC ENABLE = 1: *(0x40007500) = 1 */
    ldr r0, =0x40007500
    movs r1, #1
    str r1, [r0]
    /* CH0.PSELP = AIN0 (0): *(0x40007510) = 0 */
    ldr r0, =0x40007510
    movs r1, #0
    str r1, [r0]
    /* CH0.CONFIG = 0 (gain 1/6, single-ended, bipolar off): 0x40007518 */
    ldr r0, =0x40007518
    movs r1, #0
    str r1, [r0]
    /* RESOLUTION = 12-bit (2): *(0x400075F0) = 2 */
    ldr r0, =0x400075F0
    movs r1, #2
    str r1, [r0]
    /* RESULT.PTR = 0x20001000: *(0x4000762C) */
    ldr r0, =0x4000762C
    ldr r1, =0x20001000
    str r1, [r0]
    /* RESULT.MAXCNT = 1: *(0x40007630) */
    ldr r0, =0x40007630
    movs r1, #1
    str r1, [r0]
    ldr r6, =0xFFFF            /* previous count (never matches) */
sample:
    /* TASKS_START: *(0x40007000) = 1 */
    ldr r0, =0x40007000
    movs r1, #1
    str r1, [r0]
    /* TASKS_SAMPLE: *(0x40007004) = 1 */
    ldr r0, =0x40007004
    movs r1, #1
    str r1, [r0]
    /* wait for EVENTS_END (0x40007104) */
    ldr r0, =0x40007104
    bl spin_until_set
    /* clear EVENTS_END */
    movs r1, #0
    str r1, [r0]
    /* read the 16-bit sample the host wrote into RESULT RAM */
    ldr r0, =0x20001000
    ldrh r5, [r0]
    /* print only when the count CHANGED (keeps the serial small and the
       last line is the settled reading) */
    cmp r5, r6
    beq sample
    mov r6, r5
    /* print "MB_SAADC:" + decimal count */
    ldr r4, =msg_adc
    bl print_cstr
    mov r0, r5
    bl print_dec
    ldr r4, =msg_nl
    bl print_cstr
    b sample

/* r0 = register address; spins until the register reads non-zero */
spin_until_set:
    push {r1, r2, lr}
    ldr r1, =2000000
sloop:
    ldr r2, [r0]
    cmp r2, #0
    bne sdone
    subs r1, r1, #1
    bne sloop
sdone:
    pop {r1, r2, pc}

/* r4 = cstring pointer; clobbers r0-r3; preserves r4-r7 */
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

/* r0 = u16 value; prints it in decimal (no leading zeros) */
print_dec:
    push {r4, r5, r6, r7, lr}
    mov r6, r0
    ldr r4, =powers
    movs r7, #0
    movs r5, #0               /* started flag */
pd_loop:
    ldr r1, [r4, r7, lsl #2]  /* power of ten */
    movs r2, #0
pd_sub:
    cmp r6, r1
    blo pd_next
    sub r6, r6, r1
    adds r2, r2, #1
    b pd_sub
pd_next:
    cmp r7, #4
    beq pd_emit               /* last digit: always printed */
    cmp r2, #0
    bne pd_emit
    cmp r5, #0
    bne pd_emit
    b pd_inc                  /* leading zero: skipped */
pd_emit:
    adds r2, r2, #48
    ldr r3, =0x4000251C
    str r2, [r3]
    movs r5, #1
pd_inc:
    adds r7, r7, #1
    cmp r7, #4
    ble pd_loop
    pop {r4, r5, r6, r7, pc}

    .section .rodata
powers:  .word 10000, 1000, 100, 10, 1
msg_ready: .asciz "SAADC_READY\n"
msg_adc:   .asciz "MB_SAADC:"
msg_nl:    .asciz "\n"
