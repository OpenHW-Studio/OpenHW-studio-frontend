import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileCheck, Loader2, AlertCircle, CheckCircle2, Play, ArrowRight, ShieldAlert } from 'lucide-react';
import { extractProjectMetaFromPng } from '../../../utils/projectCompilerUtils';

const AUDIT_STEPS = [
  { id: 'EXTRACTING', label: 'Extracting metadata...' },
  { id: 'VALIDATING', label: 'Validating circuit logic...' },
  { id: 'COMPILING', label: 'Compiling code...' },
  { id: 'SIMULATING', label: 'Running simulation' }, // We'll append the timer here
  { id: 'REPORTING', label: 'Creating report (bin file)...' },
  { id: 'DONE', label: 'Done' }
];

export default function TeacherGradingPanel({ isEnabled, autogradingKey, onKeyGenerated }) {
  const [status, setStatus] = useState('idle'); // idle, ready, processing, complete, error
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [simSeconds, setSimSeconds] = useState(0);
  const [error, setError] = useState(null);
  const workerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopTimer();
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSimSeconds(0);
    timerRef.current = setInterval(() => {
      setSimSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset everything for new file
    stopTimer();
    setSimSeconds(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      
      setFileData(arrayBuffer);
      setPreviewUrl(url);
      setStatus('ready');
      setCurrentStepIdx(-1);
      setError(null);
    } catch (err) {
      setError('Failed to read PNG file.');
      setStatus('error');
    }
  };

  const startAudit = async () => {
    if (!fileData) return;

    stopTimer();
    setSimSeconds(0);
    setStatus('processing');
    setError(null);
    setCurrentStepIdx(0); // Extracting

    try {
      // 1. Extract
      const projectMeta = extractProjectMetaFromPng(new Uint8Array(fileData));
      
      // 2. Start Worker for Validation & Simulation
      setCurrentStepIdx(1); // Validating
      
      workerRef.current = new Worker(new URL('../../../worker/grading-engine.worker.ts', import.meta.url), {
        type: 'module'
      });

      workerRef.current.onmessage = (e) => {
        const { type, msg, key, logType } = e.data;

        if (type === 'LOG') {
          const lowerMsg = msg.toLowerCase();
          // Map logs to steps based on actual worker log strings
          if (lowerMsg.includes('safety') || lowerMsg.includes('validation')) {
            setCurrentStepIdx(1); // Validating
          } else if (lowerMsg.includes('intelligent grading') || lowerMsg.includes('baseline')) {
            setCurrentStepIdx(2); // Compiling (placeholder for start of process)
          } else if (lowerMsg.includes('simulating')) {
            if (currentStepIdx < 3) {
              setCurrentStepIdx(3); // Simulating
              startTimer();
            }
          } else if (lowerMsg.includes('comparison') || lowerMsg.includes('final')) {
            stopTimer();
            setCurrentStepIdx(4); // Reporting
          }
        } else if (type === 'KEY_GENERATED' || type === 'GRADING_COMPLETE') {
          stopTimer();
          setCurrentStepIdx(5); // Done
          // Safer Base64 conversion
          const rawKey = key || e.data.teacherBinaryKey;
          if (!rawKey) {
            setError("Audit completed but no binary key was generated.");
            setStatus('error');
            return;
          }
          const uint8 = new Uint8Array(rawKey);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64Key = btoa(binary);
          onKeyGenerated(base64Key);
          setStatus('complete');
          workerRef.current.terminate();
        } else if (type === 'ERROR') {
          stopTimer();
          setError(msg);
          setStatus('error');
          workerRef.current.terminate();
        }
      };

      workerRef.current.onerror = (err) => {
        stopTimer();
        setError('Worker execution failed. This usually indicates a logic error in the circuit.');
        setStatus('error');
      };

      workerRef.current.postMessage({
        type: 'GRADE',
        teacher: fileData,
        student: fileData,
        options: {
          exact_match: true,
          check_breadboard: true,
          check_overlap: true,
          ignore_pin_changes: false
        },
        config: {
          compilerUrl: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'}/compile`
        }
      });

    } catch (err) {
      setError(err.message || 'Audit failed.');
      setStatus('error');
    }
  };

  if (!isEnabled) return null;

  return (
    <section className="teacher-grading-panel teacher-assignment-section">
      <div className="teacher-assignment-section__header">
        <div className="teacher-assignment-section__icon">
          <FileCheck size={16} />
        </div>
        <div className="teacher-assignment-section__copy">
          <strong>Autograding Reference</strong>
          <small>Upload and audit the "Correct" circuit to set the grading standard.</small>
        </div>
      </div>

      <div className="teacher-assignment-section__body">
        {status === 'idle' && !autogradingKey && (
          <label className="teacher-grading-upload">
            <Upload size={24} />
            <span>Click to upload Reference PNG</span>
            <input type="file" accept="image/png" onChange={handleFileUpload} hidden />
          </label>
        )}

        {(previewUrl || autogradingKey) && (
          <div className="teacher-grading-status">
            
            {/* PNG Preview Window */}
            <div className="teacher-grading-preview">
              <img src={previewUrl || `data:image/png;base64,${autogradingKey}`} alt="Reference Circuit" />
              {status === 'ready' && (
                <button className="teacher-button teacher-button--primary" onClick={startAudit}>
                  <Play size={14} />
                  Start Behavioral Audit
                </button>
              )}
              {(status === 'complete' || autogradingKey) && status !== 'processing' && (
                <button 
                  className="teacher-grading-status__reset" 
                  onClick={() => { 
                    setStatus('idle'); 
                    setPreviewUrl(null); 
                    setFileData(null);
                    onKeyGenerated(''); 
                  }}
                >
                  Change Reference PNG
                </button>
              )}
            </div>

            {/* Stepper Progress */}
            {status !== 'idle' && status !== 'ready' && (
              <div className="teacher-audit-stepper">
                {AUDIT_STEPS.map((step, idx) => {
                  const isActive = currentStepIdx === idx;
                  const isComplete = currentStepIdx > idx;
                  const isError = status === 'error' && isActive;

                  return (
                    <div key={step.id} className={`teacher-audit-step ${isActive ? 'teacher-audit-step--active' : ''} ${isComplete ? 'teacher-audit-step--complete' : ''} ${isError ? 'teacher-audit-step--error' : ''}`}>
                      <div className="teacher-audit-step__dot">
                        {isActive && !isComplete && !isError && <Loader2 size={10} className="teacher-spin" />}
                      </div>
                      <span>
                        {step.label}
                        {step.id === 'SIMULATING' && (isActive || isComplete) && ` (${simSeconds}s)`}
                      </span>
                      {isComplete && <CheckCircle2 size={14} className="text-success" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Strict Validation Error */}
            {status === 'error' && (
              <div className="teacher-grading-error-alert">
                <ShieldAlert size={24} />
                <div>
                  <strong>VALIDATION ERROR DETECTED</strong>
                  <p>{error}. This reference circuit cannot be used for grading until the issues are fixed in the simulator.</p>
                </div>
              </div>
            )}

            {status === 'complete' && (
              <div className="teacher-grading-success-note">
                <CheckCircle2 size={16} />
                <span>Reference key generated successfully. You can now finish the assignment.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
