"""Top-level board module: pin names and board identity."""

from rpi_sim import board as _board

BCM = _board.BCM
BOARD = _board.BOARD
BOARD_TO_BCM = _board.BOARD_TO_BCM
BCM_TO_BOARD = _board.BCM_TO_BOARD

# Common named pins (BCM numbering).
D0 = 17
D1 = 18
D2 = 27
D3 = 22
D4 = 23
D5 = 24
D6 = 25
D7 = 4
D8 = 14
D9 = 15
D10 = 10
D11 = 9
D12 = 11
D13 = 8
SDA = 2
SCL = 3
MOSI = 10
MISO = 9
SCK = 11
CE0 = 8
CE1 = 7
TX = 14
RX = 15


def board_info():
    return _board.board_info()


def to_bcm(pin, mode=BCM):
    return _board.to_bcm(pin, mode)


def onboard_led(name, on=None):
    return _board.onboard_led(name, on)
