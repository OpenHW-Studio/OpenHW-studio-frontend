export { validateShortCircuits } from './shortCircuits.js';
export {
	validateMcuPower,
	validateComponentLimits,
	validatePowerDissipation,
	validateReversePolarity,
	validateFloatingPins,
	validateLogicLevels,
	validateI2CPullups,
	validateSerialPinConflict,
	validateI2CDeviceWithoutMcu,
	validateLedFloatingPins,
	validateRp2040VoltageInputs,
	validateBuzzerResistor,
	validateDuplicateI2CAddress,
	validatePotentiometer,
	validateDiodePolarity,
	validateTotalPowerBudget,
	validateThermalLimits,
	validateBatteryLife,
	validateVoltageDrops,
	validateDeadlocks,
	validateSignalIntegrity
} from './realWorldRules.js';
export * as emulatorComponents from '../../components/index.js';
