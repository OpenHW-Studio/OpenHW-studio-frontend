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
        check_overlap: true
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
                
                // Cache the teacher key if it was generated/returned
                if (e.data.teacherBinaryKey && teacherFile) {
                    const fileHash = `${teacherFile.name}-${teacherFile.size}-${teacherFile.lastModified}`;
                    teacherKeyCacheRef.current = { hash: fileHash, key: e.data.teacherBinaryKey };
                }

                addLog('Grading complete. Report generated.', 'success');
                setReport(e.data.result);
                setIsGrading(false);
            } else if (e.data.type === 'KEY_GENERATED') {
                addLog('Reference Key generated successfully!', 'success');
                
                // Also cache here
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
                                <button className={activeTab === 'diff' ? 'active' : ''} onClick={() => setActiveTab('diff')}>Behavioral Diff</button>
                            </div>

                            {activeTab === 'summary' ? (
                                <>
                                    <h2>Analysis Report</h2>
                                    <div className="stats">
                                        <div className="stat-box">
                                            <span className="val">{report.score}%</span>
                                            <span className="label">Total Grade</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="val">{report.spatial_score}%</span>
                                            <span className="label">Spatial Eye</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="val">{report.behavioral_score}%</span>
                                            <span className="label">Behavior</span>
                                        </div>
                                    </div>
                                    <ul className="feedback">
                                        {report.feedback.map((f, i) => (
                                            <li key={i} className={f.includes('Error') || f.includes('Gap') ? 'error-item' : 'info-item'}>{f}</li>
                                        ))}
                                        {report.feedback.length === 0 && <li className="success">Perfect Circuit Alignment!</li>}
                                    </ul>
                                    <div className="download-actions">
                                        <button onClick={() => downloadReport('teacher')}>Download Teacher Report</button>
                                        <button onClick={() => downloadReport('student')}>Download Student Report</button>
                                    </div>
                                </>
                            ) : (
                                <div className="timeline-diff-view">
                                    <div className="diff-header">
                                        <span>Teacher Timeline</span>
                                        <span>Student Timeline</span>
                                    </div>
                                    <div className="diff-body">
                                        {(() => {
                                            const tEvents = JSON.parse(report.teacher_telemetry || '{"events":[]}').events;
                                            const sEvents = JSON.parse(report.student_telemetry || '{"events":[]}').events;
                                            const maxRows = Math.max(tEvents.length, sEvents.length);
                                            const rows = [];
                                            for (let i = 0; i < maxRows; i++) {
                                                const t = tEvents[i];
                                                const s = sEvents[i];
                                                rows.push(
                                                    <div key={i} className="diff-row">
                                                        <div className={`event-cell teacher ${!s ? 'missing' : ''}`}>
                                                            {t ? `${t.time_ms}ms: ${Object.keys(t)[0]}` : '-'}
                                                        </div>
                                                        <div className={`event-cell student ${!t ? 'extra' : (JSON.stringify(t) !== JSON.stringify(s) ? 'mismatch' : '')}`}>
                                                            {s ? `${s.time_ms}ms: ${Object.keys(s)[0]}` : '-'}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return rows;
                                        })()}
                                    </div>
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

            {isGrading && (
                <div className="grading-loader">
                    <div className="spinner"></div>
                    <p>Executing Graph Isomorphism & Spatial Checks...</p>
                </div>
            )}
        </div>
    );
};

export default GradingPage;
