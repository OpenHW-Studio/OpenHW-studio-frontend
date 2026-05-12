// @ts-nocheck
import React, { useState } from 'react';
import picoSvgMarkup from './pico.svg.html?raw';

export const BOUNDS = { x: 0, y: 0, w: 79, h: 200 };

export const PicoUI = ({ state, attrs, isRunning }: { state: any; attrs: any; isRunning?: boolean }) => {
	const [isResetPressed, setIsResetPressed] = useState(false);
	const txOn = !!state?.txActive;
	const rxOn = !!state?.rxActive;
	const ledOn = !!state?.builtInLed;

	const handleResetPress = (e: React.PointerEvent) => {
		if (!isRunning) return;
		e.stopPropagation();
		setIsResetPressed(true);
	};

	const handleResetRelease = () => {
		setIsResetPressed(false);
	};

	const nativeW = 79;
	const nativeH = 200;
	const scaleX = BOUNDS.w / nativeW;
	const scaleY = BOUNDS.h / nativeH;

	return (
		<div style={{ 
			position: 'relative', 
			width: BOUNDS.w, 
			height: BOUNDS.h,
			overflow: 'visible'
		}}>
			<div style={{
				width: nativeW,
				height: nativeH,
				transform: `scale(${scaleX}, ${scaleY})`,
				transformOrigin: '0 0',
				position: 'relative'
			}}>
				<div
					style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
					dangerouslySetInnerHTML={{ __html: picoSvgMarkup }}
				/>

				<div
					style={{
						position: 'absolute',
						top: 33,
						left: 16,
						width: 4,
						height: 4,
						backgroundColor: txOn ? '#ffb300' : 'transparent',
						borderRadius: '50%',
						pointerEvents: 'none',
						boxShadow: txOn ? '0 0 4px #ffb300' : 'none',
						transition: 'background-color 0.06s, box-shadow 0.06s',
					}}
				/>

				<div
					style={{
						position: 'absolute',
						top: 33,
						left: 20,
						width: 4,
						height: 4,
						backgroundColor: rxOn ? '#ffb300' : 'transparent',
						borderRadius: '50%',
						pointerEvents: 'none',
						boxShadow: rxOn ? '0 0 4px #ffb300' : 'none',
						transition: 'background-color 0.06s, box-shadow 0.06s',
					}}
				/>

				<div
					style={{
						position: 'absolute',
						top: 28,
						left: 45,
						width: 6,
						height: 6,
						backgroundColor: ledOn ? '#38d600' : 'transparent',
						borderRadius: '50%',
						pointerEvents: 'none',
						boxShadow: ledOn ? '0 0 6px #38d600' : 'none',
						transition: 'background-color 0.06s, box-shadow 0.06s',
					}}
				/>

				<div
					onPointerDown={handleResetPress}
					onPointerUp={handleResetRelease}
					onPointerLeave={handleResetRelease}
					onClick={(e) => {
						if (!isRunning) return;
						e.stopPropagation();
						attrs.onInteract?.('RESET');
					}}
					style={{
						position: 'absolute',
						top: 152,
						left: 34,
						width: 11,
						height: 11,
						borderRadius: '50%',
						border: '1px solid #30343b',
						background: isResetPressed ? '#cfd3d8' : '#eceff3',
						boxShadow: isResetPressed ? 'inset 0 0 0 1px #9aa1ab' : '0 1px 2px rgba(0,0,0,0.2)',
						cursor: isRunning ? 'pointer' : 'even-resize',
						pointerEvents: isRunning ? 'auto' : 'none',
						zIndex: 20,
					}}
					title="Reset Pico"
				/>
			</div>
		</div>
	);
};

export const contextMenuDuringRun = true;

const attrAsString = (value: any, fallback = '') => {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object') {
		if (typeof value.value === 'string') return value.value;
		if (typeof value.default === 'string') return value.default;
		if (value.value != null) return String(value.value);
		if (value.default != null) return String(value.default);
	}
	if (value == null) return fallback;
	return String(value);
};

