"""Uppercase alias for the PCA9685 driver."""

from adafruit_pca9685 import PCA9685 as _PCA9685


class PCA9685(_PCA9685):
    pass
