    .syntax unified
    .cpu cortex-m4
    .thumb
    .section .vectors,"a",%progbits
    .word 0x20002000          /* SP */
    .word _start+1            /* Reset */
    .text
    .global _start
    .thumb_func
/* PWM0 cell: the guest programs a PWM waveform (one SEQ word) and the
 * HOST reads the duty/frequency back out of the engine.
 *
 * The engine keeps the waveform bytes driver-side (it has no guest-RAM
 * handle), so the runner pump feeds the SEQ compare word it reads from
 * guest RAM (pwm_observe_seq_word) and asks the engine for the resulting
 * duty (pwm_get_duty) and rate (pwm_get_freq_hz) — the owner P164
 * runner gear. The LED wired to the PWM pin then lights with that duty.
 *
 * PWM0 (0x4001C000):
 *   TASKS_SEQSTART0 0x008
 *   ENABLE 0x500 / MODE 0x504 / COUNTERTOP 0x508 / PRESCALER 0x50C
 *   DECODER 0x510 / SEQ[0].PTR 0x520 / SEQ[0].CNT 0x524
 *   PSEL.OUT[0] 0x560
 *
 * COUNTERTOP=1000, PRESCALER=0 (16 MHz HFCLK), Up mode -> 16000 Hz.
 * SEQ compare word 250 -> duty 250/1000 = 25 % (2500 basis points).
 */
    .equ PWM0_BASE,   0x4001C000
    .equ SEQ_RAM,     0x20001020
    .equ PWM_TOP,     1000
    .equ PWM_COMPARE, 250
    .equ PWM_PIN,     26        /* P0.26 = edge pin P19 */
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

    /* SEQ word in RAM: 250 (16-bit LE) */
    ldr r0, =SEQ_RAM
    movs r1, #PWM_COMPARE
    strh r1, [r0]

    /* ENABLE = 1 */
    ldr r0, =PWM0_BASE + 0x500
    movs r1, #1
    str r1, [r0]
    /* MODE = 0 (Up) */
    ldr r0, =PWM0_BASE + 0x504
    movs r1, #0
    str r1, [r0]
    /* COUNTERTOP = 1000 */
    ldr r0, =PWM0_BASE + 0x508
    movs r1, #PWM_TOP
    str r1, [r0]
    /* PRESCALER = 0 (16 MHz) */
    ldr r0, =PWM0_BASE + 0x50C
    movs r1, #0
    str r1, [r0]
    /* DECODER = 0 (direct, common load) */
    ldr r0, =PWM0_BASE + 0x510
    movs r1, #0
    str r1, [r0]
    /* SEQ[0].PTR = SEQ_RAM */
    ldr r0, =PWM0_BASE + 0x520
    ldr r1, =SEQ_RAM
    str r1, [r0]
    /* SEQ[0].CNT = 1 word */
    ldr r0, =PWM0_BASE + 0x524
    movs r1, #1
    str r1, [r0]
    /* PSEL.OUT[0] = P0.26 */
    ldr r0, =PWM0_BASE + 0x560
    movs r1, #PWM_PIN
    str r1, [r0]
    /* TASKS_SEQSTART0 = 1 */
    ldr r0, =PWM0_BASE + 0x008
    movs r1, #1
    str r1, [r0]
    /* print the programmed compare word so the guest's contribution is
       visible in the serial log */
    ldr r4, =msg_seq
    bl print_cstr
    movs r0, #PWM_COMPARE
    bl print_dec
    ldr r4, =msg_nl
    bl print_cstr
done:
    b done

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
msg_ready: .asciz "PWM_READY\n"
msg_seq:   .asciz "PWM_SEQ:"
msg_nl:    .asciz "\n"
