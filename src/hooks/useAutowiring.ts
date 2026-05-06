import { useEffect, useRef, useCallback } from 'react';

export function useAutowiring() {
  const workerRef = useRef<Worker | null>(null);
  const resolversRef = useRef<Map<string, (val: any) => void>>(new Map());

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/autowiring.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'AUTONOMOUS_RESULT') {
        const resolve = resolversRef.current.get('autonomous');
        if (resolve) {
          resolve(payload);
          resolversRef.current.delete('autonomous');
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const generateAutonomousSetup = useCallback((components: any[], wires: any[], newComp: any, manifest: any, boardId: string, pinDefs: any) => {
    return new Promise((resolve) => {
      resolversRef.current.set('autonomous', resolve);
      workerRef.current?.postMessage({
        type: 'GENERATE_AUTONOMOUS_SETUP',
        payload: { components, wires, newComp, manifest, boardId, pinDefs }
      });
    });
  }, []);

  return { generateAutonomousSetup };
}
