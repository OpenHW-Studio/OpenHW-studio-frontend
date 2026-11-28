    .syntax unified
    .cpu cortex-m4
    .thumb
    .section .vectors,"a",%progbits
    .word 0x20002000          /* SP */
    .word _start+1            /* Reset */
    .text
    .global _start
    .thumb_func
/* UARTE0 RX echo: the guest RECEIVES bytes injected by the host
   (runner injectUartByte -> engine uart_rx_byte) and prints each byte
   it actually read out of RXD. The printed byte IS the observed data:
   it can only exist if the guest read the injected value out of the
   UARTE RXD register.

   UARTE0 (0x40002000):
     TASKS_STARTRX 0x000   EVENTS_RXDRDY 0x108   RXD 0x518
     ENABLE 0x500          TXD 0x51C
   EVENTS are one register per event (RXDRDY reads 0/1) and are cleared
   by writing 0 to them — exactly like silicon. */
_start:
    /* HFCLK start: *(0x40000000) = 1 */
    ldr r0, =0x40000000
    movs r1, #1
    str r1, [r0]
    /* UARTE0 ENABLE=8: *(0x40002500) = 8 */
    ldr r0, =0x40002500
    movs r1, #8
    str r1, [r0]
    /* TASKS_STARTRX: *(0x40002000) = 1 (polled RX, RXD.MAXCNT stays 0) */
    ldr r0, =0x40002000
    movs r1, #1
    str r1, [r0]
    /* banner so the cell knows the echo loop is armed */
    ldr r4, =msg_ready
    bl print_cstr
loop:
    /* EVENTS_RXDRDY (0x40002108): 1 when a byte waits in RXD */
    ldr r0, =0x40002108
    ldr r0, [r0]
    cmp r0, #0
    beq loop
    /* RXD (0x40002518): the received byte */
    ldr r0, =0x40002518
    ldrb r5, [r0]
    /* clear EVENTS_RXDRDY: write 0 to 0x40002108 */
    ldr r0, =0x40002108
    movs r1, #0
    str r1, [r0]
    /* print "RX:" + 2 hex digits of the byte + "\n" */
    ldr r4, =msg_rx
    bl print_cstr
    mov r0, r5
    bl print_hex2
    ldr r4, =msg_nl
    bl print_cstr
    b loop

/* r0 = cstring pointer; clobbers r0-r3; preserves r4-r7 */
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

/* r0 = byte; prints 2 uppercase hex digits; clobbers r0-r3 */
print_hex2:
    push {r4, lr}
    mov r4, r0
    lsrs r1, r4, #4           /* high nibble */
    ldr r2, =hexdigits
    ldrb r1, [r2, r1]
    ldr r2, =0x4000251C
    str r1, [r2]
    ands r1, r4, #0x0F
    ldr r2, =hexdigits
    ldrb r1, [r2, r1]
    ldr r2, =0x4000251C
    str r1, [r2]
    pop {r4, pc}

    .section .rodata
hexdigits: .ascii "0123456789ABCDEF"
msg_ready: .asciz "UART_RX_READY\n"
msg_rx:    .asciz "RX:"
msg_nl:    .asciz "\n"
