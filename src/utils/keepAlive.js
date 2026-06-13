// This hack plays a completely silent audio track in the background.
// This prevents modern browsers (Chrome, Safari, Firefox) from throttling
// the JavaScript timers (setInterval/setTimeout) and Web Worker CPU limits
// when the user switches to a different tab or window.

export function enableBackgroundThrottlingHack() {
    if (typeof window === 'undefined') return;

    let audioCtx = null;

    const initAudio = () => {
        if (audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        audioCtx = new AudioContext();

        // Create an empty, silent audio buffer
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);

        // Periodically ping the audio context to keep the tab "active"
        let pingInterval = setInterval(() => {
            if (audioCtx && audioCtx.state === 'suspended' && !document.hidden) {
                audioCtx.resume().catch(() => { });
            }
        }, 1000);

        let backgroundTimeout = null;

        // Battery saver: Disable the hack after 90 seconds in the background
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Tab went to background, start the 90s countdown
                backgroundTimeout = setTimeout(() => {
                    if (audioCtx && audioCtx.state === 'running') {
                        console.log('[KeepAlive] 90 seconds elapsed in background. Suspending to save battery.');
                        audioCtx.suspend().catch(() => { });
                    }
                }, 90000);
            } else {
                // Tab came back to foreground, cancel the timeout and resume instantly
                if (backgroundTimeout) {
                    clearTimeout(backgroundTimeout);
                    backgroundTimeout = null;
                }
                if (audioCtx && audioCtx.state === 'suspended') {
                    console.log('[KeepAlive] Tab active. Resuming high-performance mode.');
                    audioCtx.resume().catch(() => { });
                }
            }
        });

        // Remove listeners once initialized
        document.removeEventListener('click', initAudio);
        document.removeEventListener('keydown', initAudio);
        document.removeEventListener('touchstart', initAudio);
    };

    // Browsers require a user interaction to start an AudioContext
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    document.addEventListener('touchstart', initAudio);
}
