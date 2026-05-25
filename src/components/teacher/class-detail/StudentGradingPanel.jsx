import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  ShieldCheck, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Cpu, 
  Zap, 
  Code, 
  Brain,
  Crosshair,
  Activity
} from 'lucide-react';
import { extractProjectMetaFromPng } from '../../../utils/projectCompilerUtils';

const AUDIT_STAGES = [
  { id: 'EXTRACTING', label: 'Extracting' },
  { id: 'VALIDATING', label: 'Validating' },
  { id: 'COMPILING', label: 'Compiling' },
  { id: 'SIMULATING', label: 'Running Simulation' },
  { id: 'COMPARING', label: 'Comparing' },
  { id: 'AI', label: 'AI Audit' },
  { id: 'FINALIZING', label: 'Finalizing' }
];

export default function StudentGradingPanel({ submissionPngUrl, referenceKeyBase64, onComplete }) {
  const [status, setStatus] = useState('idle'); // idle, running, finished, error
  const [currentStageIdx, setCurrentStageIdx] = useState(-1);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [showFullLog, setShowFullLog] = useState(false);
  const [simSeconds, setSimSeconds] = useState(0);
  
  const workerRef = useRef(null);
  const terminalEndRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

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

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    
    // Map logs to stages
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('extracting')) setCurrentStageIdx(0);
    else if (lowerMsg.includes('validat')) setCurrentStageIdx(1);
    else if (lowerMsg.includes('compiling')) setCurrentStageIdx(2);
    else if (lowerMsg.includes('simulating')) {
      setCurrentStageIdx(3);
      if (!timerRef.current) startTimer();
    }
    else if (lowerMsg.includes('comparison') || lowerMsg.includes('comparing')) {
      stopTimer();
      setCurrentStageIdx(4);
    }
    else if (lowerMsg.includes('ai semantic') || lowerMsg.includes('ai audit')) setCurrentStageIdx(5);
    else if (lowerMsg.includes('finalizing') || lowerMsg.includes('report generated')) setCurrentStageIdx(6);
  };

  const startGrading = async () => {
    if (!submissionPngUrl || !referenceKeyBase64) {
      addLog('Error: Missing submission data or reference key.', 'error');
      return;
    }

    setStatus('running');
    setLogs([]);
    setResult(null);
    setCurrentStageIdx(0);
    addLog('Initializing Student Submission Analysis...');

    try {
      // 1. Fetch PNG bytes
      addLog('Extracting submission assets...');
      const response = await fetch(submissionPngUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // 2. Extract Metadata
      addLog('Validating circuit structure...');
      const studentMeta = extractProjectMetaFromPng(new Uint8Array(arrayBuffer));
      addLog(`Circuit identified: ${studentMeta.board || 'Generic Board'}`, 'success');

      // 3. Decode Teacher Key
      addLog('Loading Reference Key...');
      const binaryKeyString = atob(referenceKeyBase64);
      const referenceKey = new Uint8Array(binaryKeyString.length);
      for (let i = 0; i < binaryKeyString.length; i++) {
        referenceKey[i] = binaryKeyString.charCodeAt(i);
      }

      // 4. Initialize Worker
      addLog('Compiling simulation environment...');
      workerRef.current = new Worker(new URL('../../../worker/grading-engine.worker.ts', import.meta.url), {
        type: 'module'
      });

      workerRef.current.onmessage = (e) => {
        const { type, msg, result: gradingResult, logType } = e.data;

        if (type === 'LOG') {
          addLog(msg, logType || 'info');
        } else if (type === 'GRADING_COMPLETE') {
          stopTimer();
          addLog('Structural comparison complete. Starting AI Semantic Audit...', 'success');
          setCurrentStageIdx(5); // AI Audit
          
          // --- AI Semantic Auditor Logic ---
          const aiWorker = new Worker(new URL('../../../worker/ai-audit-final.worker.ts', import.meta.url), { type: 'module' });
          
          aiWorker.onmessage = (aiEvent) => {
            const aiData = aiEvent.data;
            if (aiData.type === 'STATUS') {
              addLog(`AI: ${aiData.msg}`, 'info');
            } else if (aiData.type === 'RESULT') {
              addLog(`AI Semantic Match complete: ${Math.round(aiData.score * 100)}%`, 'success');
              
              const finalReport = {
                ...gradingResult,
                ai_score: Math.round(aiData.score * 100)
              };

              // Re-calculate total score if needed (matching GradingPage logic)
              // Final composition: spatial 20, logic 30, behavioral 25, verified_code 15, code 10
              const calculatedScore = (
                (finalReport.spatial_score || 0) * 20 + 
                (finalReport.logic_score || 0) * 30 + 
                (finalReport.behavioral_score || 0) * 25 + 
                (finalReport.verified_code_score || 0) * 15 + 
                (finalReport.code_score || 0) * 10
              ) / 100;
              
              finalReport.score = Math.round(calculatedScore);

              addLog('Finalizing comprehensive report...', 'success');
              setCurrentStageIdx(6); // Finalizing
              
              setTimeout(() => {
                setResult(finalReport);
                setStatus('finished');
                if (onComplete) onComplete(finalReport);
              }, 800);
              
              aiWorker.terminate();
            } else if (aiData.type === 'ERROR') {
              addLog(`AI Auditor Error: ${aiData.error}`, 'error');
              setResult(gradingResult);
              setStatus('finished');
              aiWorker.terminate();
            }
          };

          aiWorker.postMessage({
            type: 'GRADE_SEMANTICS',
            teacherTelemetry: gradingResult.teacher_telemetry,
            studentTelemetry: gradingResult.student_telemetry,
            idMapping: gradingResult.id_mapping,
            simulationSpeed: 8 // Default high speed for audit
          });
          
          workerRef.current.terminate();
        } else if (type === 'ERROR') {
          stopTimer();
          addLog(`Engine Error: ${msg}`, 'error');
          setStatus('error');
          workerRef.current.terminate();
        }
      };

      // 5. Send Grading Message
      workerRef.current.postMessage({
        type: 'GRADE',
        teacher: referenceKey,
        student: arrayBuffer,
        options: {
          exact_match: false,
          check_breadboard: true,
          check_overlap: true,
          ignore_pin_changes: true
        },
        config: {
          compilerUrl: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'}/compile`
        }
      });

    } catch (err) {
      stopTimer();
      addLog(`Fatal Error: ${err.message}`, 'error');
      setStatus('error');
    }
  };

  // Auto-start if landing on this panel
  useEffect(() => {
    if (submissionPngUrl && referenceKeyBase64) {
      startGrading();
    }
  }, [submissionPngUrl, referenceKeyBase64]);

  return (
    <section className="student-grading-panel teacher-assignment-section">
      <div className="student-grading-header">
        <div className="student-grading-header__title">
          <Terminal size={20} className="text-accent" />
          <h3>Automated Behavioral Audit</h3>
        </div>
        <div className="student-grading-header__status">
          {status === 'running' && (
            <div className="flex items-center gap-2 text-accent text-sm font-bold">
              <Loader2 size={14} className="teacher-spin" />
              <span>Audit in Progress</span>
            </div>
          )}
          {status === 'finished' && (
            <div className="flex items-center gap-2 text-success text-sm font-bold">
              <CheckCircle2 size={14} />
              <span>Audit Complete</span>
            </div>
          )}
        </div>
      </div>

      {/* Audit Stepper */}
      <div className="student-audit-stepper-container">
        <div className="student-audit-stepper">
          {AUDIT_STAGES.map((stage, idx) => {
            const isActive = currentStageIdx === idx;
            const isComplete = currentStageIdx > idx || status === 'finished';
            
            return (
              <div key={stage.id} className={`student-audit-step ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`}>
                <div className="student-audit-step__marker">
                  {isComplete ? <CheckCircle2 size={14} /> : (isActive ? <Loader2 size={14} className="teacher-spin" /> : <div className="student-audit-step__dot" />)}
                </div>
                <span className="student-audit-step__label">
                  {stage.label}
                  {stage.id === 'SIMULATING' && isActive && ` (${simSeconds}s)`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {(status === 'running' || status === 'finished' || status === 'error' || logs.length > 0) && (
        <div className={`student-grading-terminal ${showFullLog ? 'is-expanded' : ''} mt-4`}>
          <div className="student-grading-terminal__toolbar">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="ml-2">audit_engine.log</span>
            </div>
            <button onClick={() => setShowFullLog(!showFullLog)} className="hover:text-white transition-colors">
              {showFullLog ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
          <div className="student-grading-terminal__content">
            {logs.map((log, i) => (
              <div key={i} className={`terminal-line terminal-line--${log.type}`}>
                <span className="terminal-line__time">[{log.time}]</span>
                <span className="terminal-line__msg">{log.msg}</span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      )}

      {status === 'finished' && result && (
        <div className="student-grading-results">
          <div className="grading-score-card">
            <div className="grading-score-card__circle">
              <svg viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray={`${result.score}, 100`} strokeLinecap="round" />
              </svg>
              <div className="grading-score-card__value">
                <strong>{result.score}</strong>
                <span>Score</span>
              </div>
            </div>
            <div className="grading-score-card__copy">
              <h4>Total Score</h4>
              <p>{result.score >= 80 ? 'Excellent work! Your circuit matches the reference logic.' : 
                  result.score >= 50 ? 'Good effort. Some logic mismatches were detected.' : 
                  'Significant differences detected from reference.'}</p>
            </div>
          </div>

          <div className="grading-metrics-grid">
            <div className="grading-metric">
              <div className="grading-metric__icon"><ShieldCheck size={18} /></div>
              <div>
                <strong>{result.verified_code_score || 0}%</strong>
                <span>Verified Code Score</span>
              </div>
            </div>
            <div className="grading-metric">
              <div className="grading-metric__icon"><Code size={18} /></div>
              <div>
                <strong>{result.code_score || 0}%</strong>
                <span>Code Behaviour</span>
              </div>
            </div>
            <div className="grading-metric">
              <div className="grading-metric__icon"><Crosshair size={18} /></div>
              <div>
                <strong>{result.spatial_score || 0}%</strong>
                <span>Spatial Eye</span>
              </div>
            </div>
            <div className="grading-metric">
              <div className="grading-metric__icon"><Zap size={18} /></div>
              <div>
                <strong>{result.behavioral_score || 0}%</strong>
                <span>Fidelity</span>
              </div>
            </div>
            <div className="grading-metric">
              <div className="grading-metric__icon"><Brain size={18} /></div>
              <div>
                <strong>{result.ai_score || 0}%</strong>
                <span>AI Semantic Audit</span>
              </div>
            </div>
          </div>

          {result.feedback && result.feedback.length > 0 && (
            <div className="grading-feedback">
              <h5>Diagnostic Feedback</h5>
              <ul>
                {result.feedback.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
