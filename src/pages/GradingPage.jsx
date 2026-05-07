import React, { useState, useRef, useEffect, useCallback } from 'react';
import './GradingPage.css';

const GradingPage = () => {
    const [teacherFile, setTeacherFile] = useState(null);
    const [studentFile, setStudentFile] = useState(null);
    const [isGrading, setIsGrading] = useState(false);
    const [report, setReport] = useState(null);
    const [logs, setLogs] = useState([]);
    const [options, setOptions] = useState({
        exact_match: true,
        check_breadboard: true,
        check_overlap: true,
        ignore_pin_changes: true
    });
    const [activeTab, setActiveTab] = useState('summary');

    const workerRef = useRef(null);
    const logEndRef = useRef(null);

    const addLog = useCallback((msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { timestamp, msg, type }]);
    }, []);

    const teacherKeyCacheRef = useRef({ hash: null, key: null });

    useEffect(() => {
        workerRef.current = new Worker(new URL('../worker/grading-worker.ts', import.meta.url), { type: 'module' });
        
        workerRef.current.onmessage = (e) => {
            if (e.data.type === 'GRADING_COMPLETE') {
                if (e.data.result.logs) {
                    e.data.result.logs.forEach(log => addLog(log, 'info'));
                }
                
                if (e.data.teacherBinaryKey && teacherFile) {
                    const fileHash = `${teacherFile.name}-${teacherFile.size}-${teacherFile.lastModified}`;
                    teacherKeyCacheRef.current = { hash: fileHash, key: e.data.teacherBinaryKey };
                }

                addLog('Grading complete. Report generated.', 'success');
                const finalReport = e.data.result;
                setReport(finalReport);
                setIsGrading(false);
                
                if (finalReport.teacher_telemetry && finalReport.student_telemetry) {
                    addLog('Starting AI Semantic Auditor (WASM) in background...', 'info');
                    setReport(prev => ({...prev, ai_status: 'Analyzing...'}));
                    const aiWorker = new Worker(new URL('../worker/ai-audit-final.worker.ts', import.meta.url), { type: 'module' });
                    
                    aiWorker.onmessage = (aiEvent) => {
                        const aiData = aiEvent.data;
                        if (aiData.type === 'STATUS') {
                            addLog(`AI Auditor: ${aiData.msg}`, 'info');
                        } else if (aiData.type === 'RESULT') {
                            addLog(`AI Semantic Score generated: ${(aiData.score * 100).toFixed(1)}% (Time: ${aiData.auditTimeMs}ms)`, 'success');
                            const aiScore = Math.round(aiData.score * 100);
                            
                            setReport(prev => {
                                if (!prev) return null;
                                const astMatch = prev.code_score || 100;
                                const pinFidelity = prev.pin_fidelity || 0;
                                const verifiedCodeScore = Math.round((astMatch * 0.7) + (pinFidelity * 0.3));
                                const rawScore = (prev.spatial_score * 0.2) + (prev.logic_score * 0.2) + (aiScore * 0.3) + (verifiedCodeScore * 0.3);
                                
                                return { 
                                    ...prev, 
                                    ai_score: aiScore,
                                    code_score: verifiedCodeScore,
                                    score: Math.round(rawScore),
                                    ai_teacher_str: aiData.teacherStr,
                                    student_ai_str: aiData.studentStr
                                };
                            });
                            aiWorker.terminate();
                            addLog('AI Auditor worker terminated to free memory.', 'info');
                        } else if (aiData.type === 'ERROR') {
                            addLog(`AI Auditor Error: ${aiData.error}`, 'error');
                            setReport(prev => ({ ...prev, ai_status: 'Error' }));
                            aiWorker.terminate();
                        }
                    };

                    aiWorker.postMessage({
                        type: 'GRADE_SEMANTICS',
                        teacherTelemetry: finalReport.teacher_telemetry,
                        studentTelemetry: finalReport.student_telemetry,
                        idMapping: finalReport.id_mapping
                    });
                } else {
                    setIsGrading(false);
                }
            } else if (e.data.type === 'KEY_GENERATED') {
                addLog('Reference Key generated successfully!', 'success');
                if (teacherFile) {
                    const fileHash = `${teacherFile.name}-${teacherFile.size}-${teacherFile.lastModified}`;
                    teacherKeyCacheRef.current = { hash: fileHash, key: e.data.key };
                }
                const blob = new Blob([e.data.key], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `reference_key_${new Date().getTime()}.bin`;
                a.click();
                setIsGrading(false);
            } else if (e.data.type === 'LOG') {
                addLog(e.data.msg, e.data.logType);
            }
        };

        return () => workerRef.current?.terminate();
    }, [addLog, teacherFile]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        addLog(`File uploaded for ${type}: ${file.name}`);
        if (type === 'teacher') setTeacherFile(file);
        else setStudentFile(file);
    };

    const clearLogs = () => setLogs([]);
    
    const downloadLogs = () => {
        const content = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.msg}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grading_logs_${new Date().getTime()}.txt`;
        a.click();
    };

    const downloadReport = (type) => {
        const data = type === 'teacher' ? report.teacher_telemetry : report.student_telemetry;
        if (!data) return;
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_behavioral_report_${new Date().getTime()}.json`;
        a.click();
    };

    const downloadAiTraces = () => {
        if (!report || !report.ai_teacher_str) return;
        const data = {
            teacher_semantic_trace: report.ai_teacher_str,
            student_semantic_trace: report.ai_student_str,
            id_mapping: report.id_mapping,
            similarity_score: report.ai_score
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai_semantic_match_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateKey = async () => {
        if (!teacherFile) {
            addLog('Error: Please upload a teacher PNG first.', 'error');
            return;
        }
        setIsGrading(true);
        addLog('Starting Key Generation (with Behavioral Capture)...', 'info');
        try {
            const buf = await teacherFile.arrayBuffer();
            workerRef.current.postMessage({
                type: 'GENERATE_KEY',
                teacher: { project: "", projectBuf: buf },
                options
            });
        } catch (err) {
            addLog(`Error: ${err.message}`, 'error');
            setIsGrading(false);
        }
    };

    const runGrading = async () => {
        if (!teacherFile || !studentFile) {
            addLog('Error: Missing files for grading.', 'error');
            alert("Please provide both teacher and student PNGs.");
            return;
        }

        setIsGrading(true);
        setReport(null);
        addLog('Starting grading process...', 'info');

        try {
            const studentBuf = await studentFile.arrayBuffer();
            const fileHash = `${teacherFile.name}-${teacherFile.size}-${teacherFile.lastModified}`;
            
            let teacherData;
            if (teacherKeyCacheRef.current.hash === fileHash && teacherKeyCacheRef.current.key) {
                addLog('Using cached Teacher Reference Key (Simulation skipped).', 'success');
                teacherData = teacherKeyCacheRef.current.key;
            } else {
                addLog('Teacher PNG changed or not cached. Simulation required.', 'info');
                teacherData = await teacherFile.arrayBuffer();
            }

            workerRef.current.postMessage({
                type: 'GRADE',
                teacher: teacherData,
                student: studentBuf,
                options
            }, teacherData instanceof ArrayBuffer ? [teacherData, studentBuf] : [studentBuf]);
        } catch (err) {
            addLog(`Error preparing files: ${err.message}`, 'error');
            setIsGrading(false);
        }
    };

    return (
        <div className="grading-page">
            <header>
                <h1>Intelligent Grading Eye</h1>
                <p>Pure WASM Circuit Analysis & Comparison</p>
            </header>

            <div className="grading-grid">
                <div className="upload-section">
                    <div className={`drop-zone ${teacherFile ? 'has-file' : ''}`}>
                        <h3>Teacher Reference PNG</h3>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'teacher')} accept="image/png" />
                        <div className="file-info">{teacherFile ? teacherFile.name : 'Click to upload gold standard'}</div>
                    </div>
                </div>

                <div className="upload-section">
                    <div className={`drop-zone ${studentFile ? 'has-file' : ''}`}>
                        <h3>Student Submission PNG</h3>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'student')} accept="image/png" />
                        <div className="file-info">{studentFile ? studentFile.name : 'Click to upload student work'}</div>
                    </div>
                </div>
            </div>

            <div className="main-layout">
                <div className="control-panel">
                    <div className="options-card">
                        <h2>Grading Logic</h2>
                        <div className="option-controls">
                            <label>
                                <input type="checkbox" checked={options.exact_match} 
                                    onChange={(e) => setOptions({...options, exact_match: e.target.checked})} />
                                Exact Pin Matching
                            </label>
                            <label>
                                <input type="checkbox" checked={options.check_breadboard} 
                                    onChange={(e) => setOptions({...options, check_breadboard: e.target.checked})} />
                                Enforce Breadboard
                            </label>
                            <label>
                                <input type="checkbox" checked={options.check_overlap} 
                                    onChange={(e) => setOptions({...options, check_overlap: e.target.checked})} />
                                Detect Overlaps
                            </label>
                            <label className="critical-option">
                                <input type="checkbox" checked={options.ignore_pin_changes} 
                                    onChange={(e) => setOptions({...options, ignore_pin_changes: e.target.checked})} />
                                Ignore Pin Changes (Behavioral Pruning)
                            </label>
                        </div>
                        <div className="button-group">
                            <button className="grade-action-btn" onClick={runGrading} disabled={isGrading}>
                                {isGrading ? 'Analyzing...' : 'Compare Circuits'}
                            </button>
                            <button className="key-action-btn" onClick={generateKey} disabled={isGrading}>
                                {isGrading ? 'Capturing...' : 'Generate Reference Key'}
                            </button>
                        </div>
                    </div>

                    {report && (
                        <div className="report-container">
                            <div className="report-tabs">
                                <button className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}>Summary</button>
                                <button className={activeTab === 'behavior' ? 'active' : ''} onClick={() => setActiveTab('behavior')}>Behavioral Audit</button>
                                <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Grading Logs</button>
                            </div>

                            {activeTab === 'summary' && (
                                <div className="report-content">
                                    <h2>Analysis Report</h2>
                                    <div className="stats">
                                        <div className="stat-box">
                                            <span className="val">{report.spatial_score}%</span>
                                            <span className="label">Spatial</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="val">{report.logic_score}%</span>
                                            <span className="label">Logic</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="val">{report.ai_score || 0}%</span>
                                            <span className="label">Semantic AI</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="val">{report.behavioral_score}%</span>
                                            <span className="label">Temporal</span>
                                        </div>
                                        <div className="stat-box accent">
                                            <span className="val">{report.code_score}%</span>
                                            <span className="label">Verified Code</span>
                                        </div>
                                    </div>
                                    <ul className="feedback">
                                        {report.feedback.map((f, i) => (
                                            <li key={i} className={f.includes('Error') || f.includes('Gap') ? 'error-item' : 'info-item'}>{f}</li>
                                        ))}
                                        <li className="info-item success">
                                            <b>Code Execution Audit:</b> {report.pin_fidelity >= 90 ? 
                                                'Excellent. Code matches pin-toggling patterns perfectly.' : 
                                                `Moderate. Pin execution fidelity: ${report.pin_fidelity}%`}
                                        </li>
                                    </ul>
                                    <div className="download-actions">
                                        <button onClick={() => downloadReport('teacher')}>Download Teacher Report</button>
                                        <button onClick={() => downloadReport('student')}>Download Student Report</button>
                                        <button onClick={() => {
                                             const tEvents = JSON.parse(report.teacher_telemetry || '{"events":[]}').events;
                                             const sEvents = JSON.parse(report.student_telemetry || '{"events":[]}').events;
                                             const maxRows = Math.max(tEvents.length, sEvents.length);
                                             const behaviorDiff = [];
                                             for (let i = 0; i < maxRows; i++) {
                                                 const t = tEvents[i] || null;
                                                 const s = sEvents[i] || null;
                                                 const getEventTime = (e) => {
                                                     if (!e) return null;
                                                     const inner = Object.values(e)[0];
                                                     return inner?.time_ms || 0;
                                                 };
                                                 behaviorDiff.push({
                                                     index: i,
                                                     teacher_time: getEventTime(t),
                                                     student_time: getEventTime(s),
                                                     teacher_event: t,
                                                     student_event: s,
                                                     is_match: JSON.stringify(t) === JSON.stringify(s)
                                                 });
                                             }
                                             const bundle = {
                                                 grading_report: report,
                                                 behavioral_diff_report: behaviorDiff,
                                                 ai_report: {
                                                     score: report.ai_score,
                                                     teacher_trace: report.ai_teacher_str,
                                                     student_trace: report.ai_student_str
                                                 }
                                             };
                                             const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
                                             const url = URL.createObjectURL(blob);
                                             const a = document.createElement('a');
                                             a.href = url;
                                             a.download = `full_diagnostic_bundle_${Date.now()}.json`;
                                             a.click();
                                        }} className="download-btn primary">📦 Download Full Diagnostic Bundle</button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'behavior' && (
                                <div className="timeline-diff-view">
                                    <div className="diff-header">
                                        <span>Teacher Timeline</span>
                                        <span>Student Timeline</span>
                                    </div>
                                    <div className="diff-body grouped">
                                         {(() => {
                                             const tEvents = JSON.parse(report.teacher_telemetry || '{"events":[]}').events;
                                             const sEvents = JSON.parse(report.student_telemetry || '{"events":[]}').events;
                                             const idMap = report.id_mapping || {};
                                             const groupEvents = (events, isStudent) => {
                                                 const groups = {};
                                                 events.forEach(e => {
                                                     const type = Object.keys(e)[0];
                                                     const data = e[type];
                                                     let groupId = 'other';
                                                     if (type === 'PinChange') groupId = `Pin ${data.pin}`;
                                                     else if (type === 'SerialOutput') groupId = 'Serial Console';
                                                     else if (type === 'ComponentState') {
                                                         groupId = isStudent ? (idMap[data.id] || data.id) : data.id;
                                                     }
                                                     if (!groups[groupId]) groups[groupId] = [];
                                                     groups[groupId].push({ ...data, _type: type, _raw: e });
                                                 });
                                                 return groups;
                                             };
                                             const tGroups = groupEvents(tEvents, false);
                                             const sGroups = groupEvents(sEvents, true);
                                             const allGroupIds = Array.from(new Set([...Object.keys(tGroups), ...Object.keys(sGroups)]));
                                             return allGroupIds.map(groupId => {
                                                 const tList = tGroups[groupId] || [];
                                                 const sList = sGroups[groupId] || [];
                                                 const maxRows = Math.max(tList.length, sList.length);
                                                 const rows = [];
                                                 rows.push(<div key={`header-${groupId}`} className="diff-group-header">{groupId}</div>);
                                                 for (let i = 0; i < maxRows; i++) {
                                                     const t = tList[i];
                                                     const s = sList[i];
                                                     const formatDesc = (e) => {
                                                         if (!e) return null;
                                                         if (e._type === 'PinChange') return `State: ${e.state ? 'HIGH' : 'LOW'}`;
                                                         if (e._type === 'ComponentState') return `${e.key} = ${e.value}`;
                                                         if (e._type === 'SerialOutput') return e.data;
                                                         return e._type;
                                                     };
                                                     const isMismatch = (() => {
                                                         if (!t || !s) return false;
                                                         const tClean = { ...t }; delete tClean.time_ms; delete tClean._raw;
                                                         const sClean = { ...s }; delete sClean.time_ms; delete sClean._raw;
                                                         return JSON.stringify(tClean) !== JSON.stringify(sClean);
                                                     })();
                                                     rows.push(
                                                         <div key={`${groupId}-${i}`} className="diff-row">
                                                             <div className={`event-cell teacher ${!s ? 'missing' : ''}`}>
                                                                 {t ? `${t.time_ms}ms: ${formatDesc(t)}` : '-'}
                                                             </div>
                                                             <div className={`event-cell student ${!t ? 'extra' : (isMismatch ? 'mismatch' : 'match')}`}>
                                                                 {s ? `${s.time_ms}ms: ${formatDesc(s)}` : '-'}
                                                             </div>
                                                         </div>
                                                     );
                                                 }
                                                 return rows;
                                             });
                                         })()}
                                     </div>
                                </div>
                            )}

                            {activeTab === 'logs' && (
                                <div className="grading-logs-view">
                                    <div className="log-summary">
                                        <h3>Simulation Event Statistics</h3>
                                        <div className="metric-row">
                                            <span>Teacher Events:</span> <span>{report.teacher_metrics?.pins || 0} Pins, {report.teacher_metrics?.functional || 0} Components</span>
                                        </div>
                                        <div className="metric-row">
                                            <span>Student Events:</span> <span>{report.student_metrics?.pins || 0} Pins, {report.student_metrics?.functional || 0} Components</span>
                                        </div>
                                    </div>
                                    <ul className="engine-logs">
                                        {report.logs.map((log, i) => <li key={i}>{log}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="log-sidebar">
                    <div className="log-header">
                        <h2>Grading Logs</h2>
                        <div className="log-actions">
                            <button onClick={downloadLogs} title="Download Logs">📥</button>
                            <button onClick={clearLogs} title="Clear Logs">🗑️</button>
                        </div>
                    </div>
                    <div className="log-content">
                        {logs.map((log, i) => (
                            <div key={i} className={`log-entry ${log.type}`}>
                                <span className="time">{log.timestamp}</span>
                                <span className="msg">{log.msg}</span>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GradingPage;
