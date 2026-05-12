import React, { useState, useRef, useEffect, useCallback } from 'react';
import './GradingPage.css';
import GradingWorker from '../worker/grading-engine.worker.ts?worker';

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
    const [expandedTemporalIds, setExpandedTemporalIds] = useState({});
    const [simulationSpeed, setSimulationSpeed] = useState('1');

    const workerRef = useRef(null);
    const logEndRef = useRef(null);

    const addLog = useCallback((msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { timestamp, msg, type }]);
    }, []);

    const teacherKeyCacheRef = useRef({ hash: null, key: null });

    const safeParseTelemetry = useCallback((value) => {
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            if (Array.isArray(parsed)) {
                return { events: parsed, duration_ms: 0 };
            }
            return {
                events: Array.isArray(parsed?.events) ? parsed.events : [],
                duration_ms: Number(parsed?.duration_ms) || 0
            };
        } catch {
            return { events: [], duration_ms: 0 };
        }
    }, []);

    const getTelemetryEvent = useCallback((event) => {
        if (!event || typeof event !== 'object') return { type: 'Unknown', data: {} };
        const type = Object.keys(event)[0] || 'Unknown';
        return { type, data: event[type] || {} };
    }, []);

    const normalizeTemporalId = useCallback((rawId) => String(rawId || '').trim().toLowerCase().replace(/\s+/g, ''), []);

    const canonicalPinId = useCallback((pin) => {
        const normalized = String(pin || '').trim().toLowerCase().replace(/^pin:/, '');
        return `pin:${normalized}`;
    }, []);

    const formatTelemetryToken = useCallback((event) => {
        const { type, data } = getTelemetryEvent(event);
        if (type === 'PinChange') {
            return `PinChange(${data.pin}=${data.state ? 'H' : 'L'}@${data.time_ms})`;
        }
        if (type === 'ComponentState') {
            return `ComponentState(${data.id}.${data.key}=${data.value}@${data.time_ms})`;
        }
        if (type === 'SerialOutput') {
            return `SerialOutput(${String(data.data || '').trim()}@${data.time_ms})`;
        }
        return `${type}`;
    }, [getTelemetryEvent]);

    const buildTemporalBreakdownFallback = useCallback((currentReport) => {
        const teacherTelemetry = safeParseTelemetry(currentReport?.teacher_telemetry);
        const studentTelemetry = safeParseTelemetry(currentReport?.student_telemetry);
        const teacherEvents = Array.isArray(teacherTelemetry.events) ? teacherTelemetry.events : [];
        const studentEvents = Array.isArray(studentTelemetry.events) ? studentTelemetry.events : [];
        const idMap = currentReport?.id_mapping || {};
        const scale = teacherTelemetry.duration_ms && studentTelemetry.duration_ms
            ? teacherTelemetry.duration_ms / studentTelemetry.duration_ms
            : 1;

        const groupEvents = (events, isStudent) => {
            const groups = {};
            events.forEach(event => {
                const { type, data } = getTelemetryEvent(event);
                let groupId = 'other';
                if (type === 'PinChange') groupId = canonicalPinId(data.pin);
                else if (type === 'SerialOutput') groupId = 'Serial Console';
                else if (type === 'ComponentState') {
                    const mappedId = isStudent ? (idMap[data.id] || data.id) : data.id;
                    groupId = normalizeTemporalId(mappedId);
                }
                if (!groups[groupId]) groups[groupId] = [];
                groups[groupId].push({ ...data, _type: type });
            });
            return groups;
        };

        const teacherIgnored = Array.isArray(teacherTelemetry.ignored_events) ? teacherTelemetry.ignored_events : [];
        const studentIgnored = Array.isArray(studentTelemetry.ignored_events) ? studentTelemetry.ignored_events : [];

        const tGroups = groupEvents(teacherEvents, false);
        const sGroups = groupEvents(studentEvents, true);

        // Merge ignored events into groups but mark them so the UI can show 'Ignored'
        const mergeIgnored = (ignoredList, groups, isStudent) => {
            ignoredList.forEach(event => {
                const { type, data } = getTelemetryEvent(event);
                let groupId = 'other';
                if (type === 'PinChange') groupId = canonicalPinId(data.pin);
                else if (type === 'SerialOutput') groupId = 'Serial Console';
                else if (type === 'ComponentState') {
                    const mappedId = isStudent ? (idMap[data.id] || data.id) : data.id;
                    groupId = normalizeTemporalId(mappedId);
                }
                if (!groups[groupId]) groups[groupId] = [];
                groups[groupId].push({ ...data, _type: type, _ignored: true });
            });
        };

        mergeIgnored(teacherIgnored, tGroups, false);
        mergeIgnored(studentIgnored, sGroups, true);
        const allIds = Array.from(new Set([...Object.keys(tGroups), ...Object.keys(sGroups)])).sort();
        const idStats = allIds.map(groupId => {
            const tList = tGroups[groupId] || [];
            const sList = sGroups[groupId] || [];
            const teacherCount = tList.length;
            const studentCount = sList.length;
            const isSilentTeacher = teacherCount <= 1;
            let matchedEvents = 0;

            if (isSilentTeacher) {
                matchedEvents = teacherCount;
            } else {
                const maxRows = Math.min(tList.length, sList.length);
                for (let i = 0; i < maxRows; i++) {
                    const t = tList[i];
                    const s = sList[i];
                    if (!t || !s) continue;
                    const timeDiff = Math.abs((Number(t.time_ms) || 0) - (Number(s.time_ms) || 0) * scale);
                    const tClean = { ...t };
                    const sClean = { ...s };
                    delete tClean.time_ms;
                    delete sClean.time_ms;
                    delete tClean._type;
                    delete sClean._type;
                    if (timeDiff <= 250 && JSON.stringify(tClean) === JSON.stringify(sClean)) {
                        matchedEvents += 1;
                    }
                }
            }

            const matchPercentage = teacherCount === 0 ? 100 : (matchedEvents / teacherCount) * 100;
            const firstType = tList[0]?._type || sList[0]?._type || 'Unknown';

            return {
                id: groupId,
                id_type: firstType === 'PinChange' ? 'pin' : 'component',
                teacher_event_count: teacherCount,
                student_event_count: studentCount,
                match_percentage: Math.max(0, Math.min(100, matchPercentage)),
                matched_events: matchedEvents,
                is_silent_teacher: isSilentTeacher
            };
        });

        const overall = idStats.length > 0
            ? Math.round(idStats.reduce((sum, row) => sum + row.match_percentage, 0) / idStats.length)
            : 100;

        return {
            time_scale_factor: scale,
            id_stats: idStats,
            overall_temporal_score: overall
        };
    }, [canonicalPinId, getTelemetryEvent, normalizeTemporalId, safeParseTelemetry]);

    const buildTemporalEventDetails = useCallback((currentReport, temporalData) => {
        const teacherTelemetry = safeParseTelemetry(currentReport?.teacher_telemetry);
        const studentTelemetry = safeParseTelemetry(currentReport?.student_telemetry);
        const teacherEvents = Array.isArray(teacherTelemetry.events) ? teacherTelemetry.events : [];
        const studentEvents = Array.isArray(studentTelemetry.events) ? studentTelemetry.events : [];
        const idMap = currentReport?.id_mapping || {};
        const scale = teacherTelemetry.duration_ms && studentTelemetry.duration_ms
            ? teacherTelemetry.duration_ms / studentTelemetry.duration_ms
            : 1;

        const groupEvents = (events, isStudent) => {
            const groups = {};
            events.forEach(event => {
                const { type, data } = getTelemetryEvent(event);
                let groupId = 'other';
                if (type === 'PinChange') groupId = canonicalPinId(data.pin);
                else if (type === 'SerialOutput') groupId = 'Serial Console';
                else if (type === 'ComponentState') {
                    const mappedId = isStudent ? (idMap[data.id] || data.id) : data.id;
                    groupId = normalizeTemporalId(mappedId);
                }
                if (!groups[groupId]) groups[groupId] = [];
                groups[groupId].push({ ...data, _type: type });
            });
            return groups;
        };

        const describeEvent = (event) => {
            if (!event) return 'No event';
            if (event._type === 'PinChange') {
                return `Pin ${event.pin} = ${event.state ? 'H' : 'L'}`;
            }
            if (event._type === 'ComponentState') {
                return `${event.id}.${event.key} = ${String(event.value ?? '')}`;
            }
            if (event._type === 'SerialOutput') {
                return `Serial: ${String(event.data || '').trim()}`;
            }
            return event._type || 'Unknown event';
        };

        const cleanEvent = (event) => {
            if (!event) return null;
            const copy = { ...event };
            delete copy.time_ms;
            delete copy._type;
            return copy;
        };

        const tGroups = groupEvents(teacherEvents, false);
        const sGroups = groupEvents(studentEvents, true);
        const rows = Array.isArray(temporalData?.id_stats) ? temporalData.id_stats : [];
        const details = {};

        rows.forEach(stat => {
            const statId = normalizeTemporalId(stat.id);
            const teacherList = tGroups[statId] || tGroups[stat.id] || [];
            const studentList = sGroups[statId] || sGroups[stat.id] || [];
            const rowCount = Math.max(teacherList.length, studentList.length);
            // If there are no rows at all, show a single 'grace' row so UI isn't empty
            const effectiveRowCount = rowCount === 0 ? 1 : rowCount;
            const eventRows = [];
            for (let index = 0; index < effectiveRowCount; index += 1) {
                const teacherEvent = teacherList[index] || null;
                const studentEvent = studentList[index] || null;
                const teacherTime = Number(teacherEvent?.time_ms || 0);
                const studentTime = Number(studentEvent?.time_ms || 0);
                const timeDelta = Math.abs(teacherTime - (studentTime * scale));
                const teacherClean = cleanEvent(teacherEvent);
                const studentClean = cleanEvent(studentEvent);
                const teacherMatchesStudent = teacherClean && studentClean && JSON.stringify(teacherClean) === JSON.stringify(studentClean);
                const sameType = teacherEvent?._type && teacherEvent._type === studentEvent?._type;

                let matchStatus = 'unmatched';
                if (!teacherEvent && studentEvent) {
                    if (studentEvent._ignored) matchStatus = 'ignored';
                    else matchStatus = 'student extra';
                } else if (teacherEvent && !studentEvent) {
                    if (teacherEvent._ignored) matchStatus = 'ignored';
                    else matchStatus = 'missing';
                } else if (teacherMatchesStudent && timeDelta <= 250) {
                    matchStatus = 'matched';
                } else if (teacherMatchesStudent || sameType) {
                    matchStatus = 'time drift';
                } else if (!teacherEvent && !studentEvent) {
                    matchStatus = 'grace';
                }

                eventRows.push({
                    index: index + 1,
                    teacher_time_ms: teacherTime,
                    student_time_ms: studentTime,
                    time_delta_ms: Number.isFinite(timeDelta) ? timeDelta : 0,
                    teacher_label: describeEvent(teacherEvent),
                    student_label: describeEvent(studentEvent),
                    match_status: matchStatus,
                    teacher_event: teacherEvent,
                    student_event: studentEvent
                });
            }

            details[stat.id] = eventRows;
            details[statId] = eventRows;
        });

        return details;
    }, [canonicalPinId, getTelemetryEvent, normalizeTemporalId, safeParseTelemetry]);

    const buildAiAuditModel = useCallback((currentReport) => {
        const teacherTelemetry = safeParseTelemetry(currentReport?.teacher_telemetry);
        const studentTelemetry = safeParseTelemetry(currentReport?.student_telemetry);
        const teacherEvents = Array.isArray(teacherTelemetry.events) ? teacherTelemetry.events : [];
        const studentEvents = Array.isArray(studentTelemetry.events) ? studentTelemetry.events : [];

        const rawTeacher = currentReport?.ai_teacher_raw_trace || teacherEvents.map(formatTelemetryToken).join(' ');
        const rawStudent = currentReport?.ai_student_raw_trace || studentEvents.map(formatTelemetryToken).join(' ');
        const teacherFunctional = currentReport?.ai_teacher_functional_trace || currentReport?.ai_teacher_str || '';
        const studentFunctional = currentReport?.ai_student_functional_trace || currentReport?.ai_student_str || currentReport?.student_ai_str || '';
        const teacherElectrical = currentReport?.ai_teacher_electrical_trace || currentReport?.teacher_elec || '';
        const studentElectrical = currentReport?.ai_student_electrical_trace || currentReport?.student_elec || '';
        const teacherNormalized = currentReport?.ai_teacher_normalized_trace || `${teacherFunctional} ${teacherElectrical}`.trim();
        const studentNormalized = currentReport?.ai_student_normalized_trace || `${studentFunctional} ${studentElectrical}`.trim();

        return {
            rawTeacher,
            rawStudent,
            teacherFunctional,
            studentFunctional,
            teacherElectrical,
            studentElectrical,
            teacherNormalized,
            studentNormalized,
            functionalMatch: Number(currentReport?.ai_functional_match ?? currentReport?.functionalMatch ?? 0),
            electricalMatch: Number(currentReport?.ai_electrical_match ?? currentReport?.electricalMatch ?? 0),
            aiScore: Number(currentReport?.ai_score ?? 0),
            teacherTokens: Number(currentReport?.ai_teacher_tokens ?? teacherEvents.length),
            studentTokens: Number(currentReport?.ai_student_tokens ?? studentEvents.length)
        };
    }, [formatTelemetryToken, safeParseTelemetry]);

    useEffect(() => {
        console.log("[HEARTBEAT] UI: Creating new Grading Worker (Explicit Strategy)...");
        workerRef.current = new GradingWorker();

        workerRef.current.onmessage = (e) => {
            if (e.data.type === 'DOWNLOAD_REPORT') {
                try {
                    const blob = new Blob([e.data.report], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `grading_report_${Date.now()}.json`;
                    a.click();
                } catch (err) {
                    console.warn('Failed to download report automatically:', err);
                }
            }
            if (e.data.type === 'DOWNLOAD_REPORT_MERGED') {
                try {
                    const blob = new Blob([e.data.report], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `grading_report_with_ai_${Date.now()}.json`;
                    a.click();
                    addLog('✓ Merged grading + AI audit report downloaded.', 'success');
                } catch (err) {
                    console.warn('Failed to download merged report automatically:', err);
                }
            }
            if (e.data.type === 'GRADING_COMPLETE') {
                if (e.data.result.logs) {
                    const runSpeed = Number(e.data.result?.simulation_speed || simulationSpeed || 1);
                    e.data.result.logs.forEach(log => addLog(`[${runSpeed}x] ${log}`, 'info'));
                }

                // Cache the teacher key if it was generated/returned
                if (e.data.teacherBinaryKey && teacherFile) {
                    const fileHash = `${teacherFile.name}-${teacherFile.size}-${teacherFile.lastModified}`;
                    teacherKeyCacheRef.current = { hash: fileHash, key: e.data.teacherBinaryKey };
                }

                addLog('Grading complete. Report generated.', 'success');
                // Normalize report to ensure all fields have defaults
                const finalReport = {
                    score: 0,
                    spatial_score: 0,
                    logic_score: 0,
                    behavioral_score: 0,
                    pin_fidelity: 0,
                    code_score: 0,
                    verified_code_score: 0,
                    simulation_speed: Number(simulationSpeed) || 1,
                    telemetry_cutoff_ms: 7900,
                    feedback: [],
                    logs: [],
                    teacher_telemetry: null,
                    student_telemetry: null,
                    id_mapping: {},
                    temporal_breakdown: null,
                    ai_teacher_raw_trace: '',
                    ai_student_raw_trace: '',
                    ai_teacher_functional_trace: '',
                    ai_student_functional_trace: '',
                    ai_teacher_electrical_trace: '',
                    ai_student_electrical_trace: '',
                    ai_teacher_normalized_trace: '',
                    ai_student_normalized_trace: '',
                    ai_functional_match: 0,
                    ai_electrical_match: 0,
                    teacher_metrics: { pins: 0, functional: 0, serial: 0 },
                    student_metrics: { pins: 0, functional: 0, serial: 0 },
                    ...e.data.result // Override defaults with actual result
                };
                addLog(`Run metadata: speed=${Number(finalReport.simulation_speed || 1)}x, telemetry cutoff=${Number(finalReport.telemetry_cutoff_ms || 7900)}ms`, 'info');
                setReport(finalReport);
                setIsGrading(false); // Unlock UI immediately so user sees deterministic results and logs

                // --- AI Semantic Auditor Logic ---
                if (finalReport.teacher_telemetry && finalReport.student_telemetry) {
                    addLog('Starting AI Semantic Auditor (WASM) in background...', 'info');
                    setReport(prev => ({ ...prev, ai_status: 'Analyzing...' }));
                    const aiWorker = new Worker(new URL('../worker/ai-audit-final.worker.ts', import.meta.url), { type: 'module' });

                    aiWorker.onmessage = (aiEvent) => {
                        const aiData = aiEvent.data;
                        if (aiData.type === 'STATUS') {
                            addLog(`AI Auditor: ${aiData.msg}`, 'info');
                        } else if (aiData.type === 'RESULT') {
                            addLog(`AI Semantic Score generated: ${(aiData.score * 100).toFixed(1)}% (Time: ${aiData.auditTimeMs}ms)`, 'success');
                            const aiScore = Math.round(aiData.score * 100);

                            // Update report with AI results
                            setReport(prevReport => {
                                if (!prevReport) return null;
                                // New weighting: move 15% to verified_code_score (from behavioral)
                                // Final composition: spatial 20, logic 30, behavioral 25, verified_code 15, code 10
                                const rawScore = (prevReport.spatial_score * 20 + prevReport.logic_score * 30 + prevReport.behavioral_score * 25 + (prevReport.verified_code_score || 0) * 15 + (prevReport.code_score || 0) * 10) / 100;

                                const updatedReport = {
                                    ...prevReport,
                                    ai_score: aiScore,
                                    score: Math.round(rawScore),
                                    ai_teacher_raw_trace: aiData.teacherRawTrace || prevReport.ai_teacher_raw_trace,
                                    ai_student_raw_trace: aiData.studentRawTrace || prevReport.ai_student_raw_trace,
                                    ai_teacher_functional_trace: aiData.teacherFunctionalTrace || aiData.teacherStr || prevReport.ai_teacher_functional_trace,
                                    ai_student_functional_trace: aiData.studentFunctionalTrace || aiData.studentStr || prevReport.ai_student_functional_trace,
                                    ai_teacher_electrical_trace: aiData.teacherElectricalTrace || aiData.teacherElec || prevReport.ai_teacher_electrical_trace,
                                    ai_student_electrical_trace: aiData.studentElectricalTrace || aiData.studentElec || prevReport.ai_student_electrical_trace,
                                    ai_teacher_normalized_trace: aiData.teacherNormalizedTrace || prevReport.ai_teacher_normalized_trace,
                                    ai_student_normalized_trace: aiData.studentNormalizedTrace || prevReport.ai_student_normalized_trace,
                                    ai_teacher_str: aiData.teacherFunctionalTrace || aiData.teacherStr || prevReport.ai_teacher_str,
                                    ai_student_str: aiData.studentFunctionalTrace || aiData.studentStr || prevReport.ai_student_str,
                                    student_ai_str: aiData.studentFunctionalTrace || aiData.studentStr || prevReport.student_ai_str,
                                    ai_functional_match: aiData.functionalMatch || prevReport.ai_functional_match || 0,
                                    ai_electrical_match: aiData.electricalMatch || prevReport.ai_electrical_match || 0,
                                    ai_teacher_tokens: aiData.teacherTokens || prevReport.ai_teacher_tokens,
                                    ai_student_tokens: aiData.studentTokens || prevReport.ai_student_tokens,
                                    ai_audit_time_ms: aiData.auditTimeMs || prevReport.ai_audit_time_ms
                                };
                                return updatedReport;
                            });

                            // Option B: Request merged report with AI logs from grading worker
                            addLog('Requesting merged grading + AI report...', 'info');
                            
                            setReport(prevReport => {
                                if (prevReport && workerRef.current) {
                                    workerRef.current.postMessage({
                                        type: 'MERGE_AI_RESULTS',
                                        aiResult: {
                                            score: aiData.score,
                                            functionalMatch: aiData.functionalMatch,
                                            electricalMatch: aiData.electricalMatch,
                                            teacherRawTrace: aiData.teacherRawTrace,
                                            studentRawTrace: aiData.studentRawTrace,
                                            teacherFunctionalTrace: aiData.teacherFunctionalTrace,
                                            studentFunctionalTrace: aiData.studentFunctionalTrace,
                                            teacherElectricalTrace: aiData.teacherElectricalTrace,
                                            studentElectricalTrace: aiData.studentElectricalTrace,
                                            teacherNormalizedTrace: aiData.teacherNormalizedTrace,
                                            studentNormalizedTrace: aiData.studentNormalizedTrace,
                                            auditTimeMs: aiData.auditTimeMs,
                                            modelDiagnostics: aiData.modelDiagnostics,
                                            aiLogs: aiData.aiLogs || []
                                        },
                                        gradingResult: prevReport
                                    });
                                }
                                return prevReport;
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
                        idMapping: finalReport.id_mapping,
                        simulationSpeed: Number(finalReport.simulation_speed || simulationSpeed || 1)
                    });
                } else {
                    setIsGrading(false);
                }
                // --- End AI Logic ---

                if (finalReport.teacher_telemetry && teacherFile) {
                    const fileHash = `${teacherFile.name}-${teacherFile.size}-${teacherFile.lastModified}`;
                    if (teacherKeyCacheRef.current.hash !== fileHash) {
                        console.log("[CACHE] Auto-caching teacher telemetry for future runs...");
                        teacherKeyCacheRef.current = { 
                            hash: fileHash, 
                            key: finalReport.teacher_telemetry // Store as the cached key
                        };
                    }
                }

                if (!finalReport.teacher_telemetry || !finalReport.student_telemetry) {
                    setIsGrading(false);
                }
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
                const liveSpeed = Number(simulationSpeed || 1);
                addLog(`[${liveSpeed}x] ${e.data.msg}`, e.data.logType);
            }
        };

        return () => workerRef.current?.terminate();
    }, [addLog, simulationSpeed, teacherFile]);

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
        if (!report) return;
        const ai = buildAiAuditModel(report);
        const data = {
            teacher_raw_trace: ai.rawTeacher,
            student_raw_trace: ai.rawStudent,
            teacher_functional_trace: ai.teacherFunctional,
            student_functional_trace: ai.studentFunctional,
            teacher_electrical_trace: ai.teacherElectrical,
            student_electrical_trace: ai.studentElectrical,
            teacher_normalized_trace: ai.teacherNormalized,
            student_normalized_trace: ai.studentNormalized,
            teacher_semantic_trace: ai.teacherFunctional,
            student_semantic_trace: ai.studentFunctional,
            id_mapping: report.id_mapping,
            similarity_score: ai.aiScore,
            functional_match: ai.functionalMatch,
            electrical_match: ai.electricalMatch
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
                options,
                simulationSpeed: Number(simulationSpeed) || 1
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
        addLog(`Starting grading process at ${simulationSpeed}x simulation speed...`, 'info');

        try {
            const studentBuf = await studentFile.arrayBuffer();
            const fileHash = `${teacherFile.name}-${teacherFile.size}-${teacherFile.lastModified}`;

            let teacherData;
            if (teacherKeyCacheRef.current.hash === fileHash && teacherKeyCacheRef.current.key) {
                addLog('Using cached Teacher Reference Key (Simulation skipped).', 'success');
                teacherData = teacherKeyCacheRef.current.key;
            } else {
                const reason = !teacherKeyCacheRef.current.key ? 'No key in memory' : `Hash Mismatch (Current: ${fileHash} vs Cached: ${teacherKeyCacheRef.current.hash})`;
                addLog(`Cache Miss: Simulation required. Reason: ${reason}`, 'info');
                console.log("[CACHE DEBUG] Current File Hash:", fileHash);
                console.log("[CACHE DEBUG] Cached Hash:", teacherKeyCacheRef.current.hash);
                teacherData = await teacherFile.arrayBuffer();
                console.log("[CACHE DEBUG] Teacher File Read Successful. Size:", teacherData.byteLength);
            }

            const transferables = [];
            if (teacherData instanceof ArrayBuffer) transferables.push(teacherData);
            else if (teacherData && teacherData.buffer instanceof ArrayBuffer) transferables.push(teacherData.buffer);
            
            if (studentBuf instanceof ArrayBuffer) transferables.push(studentBuf);

            console.log("[CACHE DEBUG] Sending to Worker. Transferables:", transferables.length);
            workerRef.current.postMessage({
                type: 'GRADE',
                teacher: teacherData,
                student: studentBuf,
                options,
                simulationSpeed: Number(simulationSpeed) || 1
            }, transferables);
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
                                    onChange={(e) => setOptions({ ...options, exact_match: e.target.checked })} />
                                Exact Pin Matching
                            </label>
                            <label>
                                <input type="checkbox" checked={options.check_breadboard}
                                    onChange={(e) => setOptions({ ...options, check_breadboard: e.target.checked })} />
                                Enforce Breadboard
                            </label>
                            <label>
                                <input type="checkbox" checked={options.check_overlap}
                                    onChange={(e) => setOptions({ ...options, check_overlap: e.target.checked })} />
                                Detect Overlaps
                            </label>
                            <label className="critical-option">
                                <input type="checkbox" checked={options.ignore_pin_changes}
                                    onChange={(e) => setOptions({ ...options, ignore_pin_changes: e.target.checked })} />
                                Ignore Pin Changes (Behavioral Pruning)
                            </label>
                        </div>
                        <div className="button-group">
                            <button className="grade-action-btn" onClick={runGrading} disabled={isGrading}>
                                {isGrading ? 'Analyzing...' : 'Compare Circuits'}
                            </button>
                            <div className="speed-control" aria-label="Simulation speed selector">
                                <label htmlFor="simulation-speed-select">Speed</label>
                                <select
                                    id="simulation-speed-select"
                                    value={simulationSpeed}
                                    onChange={(e) => setSimulationSpeed(e.target.value)}
                                    disabled={isGrading}
                                >
                                    <option value="1">1x</option>
                                    <option value="2">2x</option>
                                    <option value="4">4x</option>
                                    <option value="8">8x</option>
                                </select>
                            </div>
                            <button className="key-action-btn" onClick={generateKey} disabled={isGrading}>
                                {isGrading ? 'Capturing...' : 'Generate Reference Key'}
                            </button>
                        </div>
                    </div>

                    {report && (
                        <div className="report-container">
                            <div className="report-tabs">
                                <button className={activeTab === 'report' ? 'active' : ''} onClick={() => setActiveTab('report')}>Diagnostic Report</button>
                                <button className={activeTab === 'temporal' ? 'active' : ''} onClick={() => setActiveTab('temporal')}>Temporal Behavior</button>
                                <button className={activeTab === 'behavior' ? 'active' : ''} onClick={() => setActiveTab('behavior')}>AI Semantic Audit</button>
                            </div>

                            {activeTab === 'report' ? (
                                <div className="report-content">
                                    <div className="stats">
                                        <div className="stat-box">
                                            <span className="val">{report.score}%</span>
                                            <span className="label">Total Score</span>
                                        </div>
                                        {typeof report.verified_code_score === 'number' && (
                                            <div className="stat-box">
                                                <span className="val">{report.verified_code_score}%</span>
                                                <span className="label">Verified Code Score</span>
                                            </div>
                                        )}
                                        {typeof report.code_score === 'number' && (
                                            <div className="stat-box">
                                                <span className="val">{report.code_score}%</span>
                                                <span className="label">Code Behaviour</span>
                                            </div>
                                        )}
                                        <div className="stat-box">
                                            <span className="val">{report.spatial_score}%</span>
                                            <span className="label">Spatial Eye</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="val">{report.behavioral_score}%</span>
                                            <span className="label">Fidelity</span>
                                        </div>
                                        {typeof report.ai_score === 'number' && (
                                            <div className="stat-box">
                                                <span className="val">{report.ai_score}%</span>
                                                <span className="label">AI Semantic Audit</span>
                                            </div>
                                        )}
                                    </div>

                                    <ul className="feedback">
                                        {(report.feedback || []).map((f, i) => (
                                            <li key={i} className={f.includes('Error') || f.includes('Gap') ? 'error-item' : 'info-item'}>{f}</li>
                                        ))}
                                        {(!report.feedback || report.feedback.length === 0) && <li className="success">Perfect Circuit Alignment!</li>}
                                    </ul>

                                    <div className="download-actions">
                                        <button onClick={() => downloadReport('teacher')}>Download Teacher Report</button>
                                        <button onClick={() => downloadReport('student')}>Download Student Report</button>
                                        <button onClick={downloadAiTraces} className="download-btn">Download AI Audit</button>
                                        <button onClick={() => {
                                            const bundle = {
                                                grading_report: report,
                                                ai_status: report.ai_status,
                                                ai_score: report.ai_score,
                                                teacher_telemetry: report.teacher_telemetry,
                                                student_telemetry: report.student_telemetry
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
                            ) : activeTab === 'temporal' ? (
                                <div className="temporal-behavior-view">
                                    <div className="temporal-header">
                                        <h3>Temporal Fidelity Analysis</h3>
                                        <p className="temporal-desc">Event-by-event behavioral matching with time normalization</p>
                                    </div>
                                    {(() => {
                                        const temporalData = report.temporal_breakdown || buildTemporalBreakdownFallback(report);
                                        const temporalRows = Array.isArray(temporalData?.id_stats) ? temporalData.id_stats : [];
                                        const temporalDetails = buildTemporalEventDetails(report, temporalData);
                                        return (
                                            <div className="temporal-content">
                                                <div className="temporal-meta">
                                                    <div className="meta-item">
                                                        <span className="label">Time Scale Factor:</span>
                                                        <span className="value">{Number(temporalData?.time_scale_factor || 1).toFixed(3)}x</span>
                                                    </div>
                                                    <div className="meta-item">
                                                        <span className="label">Overall Temporal Score:</span>
                                                        <span className="value">{Number(temporalData?.overall_temporal_score || 0)}%</span>
                                                    </div>
                                                </div>
                                                <div className="temporal-table-wrapper">
                                                    <table className="temporal-table">
                                                        <thead>
                                                            <tr>
                                                                <th>ID</th>
                                                                <th>Type</th>
                                                                <th>Teacher Events</th>
                                                                <th>Student Events</th>
                                                                <th>Matched</th>
                                                                <th>Match %</th>
                                                                <th>Silent?</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {temporalRows.map((stat, idx) => (
                                                                <React.Fragment key={stat.id || idx}>
                                                                <tr className={stat.is_silent_teacher ? 'silent-teacher' : (stat.match_percentage === 100 ? 'perfect-match' : stat.match_percentage >= 75 ? 'good-match' : 'partial-match')}>
                                                                    <td className="id-cell">
                                                                        <button
                                                                            type="button"
                                                                            className="temporal-disclosure-btn"
                                                                            onClick={() => setExpandedTemporalIds(prev => ({ ...prev, [stat.id]: !prev[stat.id] }))}
                                                                            aria-expanded={!!expandedTemporalIds[stat.id]}
                                                                            aria-controls={`temporal-detail-${idx}`}
                                                                        >
                                                                            <span className={`temporal-disclosure-icon ${expandedTemporalIds[stat.id] ? 'open' : ''}`}>▸</span>
                                                                            <span>{stat.id}</span>
                                                                        </button>
                                                                    </td>
                                                                    <td>{stat.id_type}</td>
                                                                    <td className="count-cell">{stat.teacher_event_count}</td>
                                                                    <td className="count-cell">{stat.student_event_count}</td>
                                                                    <td className="count-cell">{stat.matched_events}/{stat.teacher_event_count}</td>
                                                                    <td className="percentage-cell">
                                                                        <div className="progress-bar">
                                                                            <div className="progress-fill" style={{width: `${Number(stat.match_percentage || 0)}%`}}></div>
                                                                            <span className="percentage-text">{Number(stat.match_percentage || 0).toFixed(1)}%</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="silent-cell">{stat.is_silent_teacher ? '✓ (Grace)' : (stat.ignored_events ? `Ignored: ${stat.ignored_events}` : '-')}</td>
                                                                </tr>
                                                                {expandedTemporalIds[stat.id] && (
                                                                    <tr id={`temporal-detail-${idx}`} className="temporal-detail-row">
                                                                        <td colSpan="7">
                                                                            <div className="temporal-detail-panel">
                                                                                <div className="temporal-detail-title">Events for {stat.id}</div>
                                                                                <table className="temporal-detail-table">
                                                                                    <thead>
                                                                                        <tr>
                                                                                            <th>#</th>
                                                                                            <th>Teacher Event</th>
                                                                                            <th>Teacher Time</th>
                                                                                            <th>Student Event</th>
                                                                                            <th>Student Time</th>
                                                                                            <th>Delta</th>
                                                                                            <th>Status</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {(temporalDetails[stat.id] || []).map((eventRow) => (
                                                                                            <tr key={`${stat.id}-${eventRow.index}`} className={`detail-status-${eventRow.match_status.replace(/\s+/g, '-')}`}>
                                                                                                <td>{eventRow.index}</td>
                                                                                                <td>{eventRow.teacher_label}</td>
                                                                                                <td>{Number(eventRow.teacher_time_ms || 0)}ms</td>
                                                                                                <td>{eventRow.student_label}</td>
                                                                                                <td>{Number(eventRow.student_time_ms || 0)}ms</td>
                                                                                                <td>{Math.round(Number(eventRow.time_delta_ms || 0))}ms</td>
                                                                                                <td className="detail-status-cell">{eventRow.match_status}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                </React.Fragment>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="temporal-legend">
                                                    <div className="legend-item silent-teacher"><span className="dot"></span> Silent Teacher (0-1 events): 100% match grace</div>
                                                    <div className="legend-item perfect-match"><span className="dot"></span> Perfect Match: 100%</div>
                                                    <div className="legend-item good-match"><span className="dot"></span> Good Match: 75-99%</div>
                                                    <div className="legend-item partial-match"><span className="dot"></span> Partial Match: &lt;75%</div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="semantic-audit-view">
                                    <div className="semantic-audit-header">
                                        <div>
                                            <h3>AI Semantic Audit</h3>
                                            <p className="temporal-desc">Entropy-filtered traces with functional and electrical weighting</p>
                                        </div>
                                        <button className="download-audit-btn" onClick={downloadAiTraces}>📥 Download AI Audit</button>
                                    </div>

                                    {(() => {
                                        const ai = buildAiAuditModel(report);
                                        const rows = [
                                            { label: 'Raw Trace', teacher: ai.rawTeacher, student: ai.rawStudent, note: 'Pre-normalization telemetry' },
                                            { label: 'Functional Trace', teacher: ai.teacherFunctional, student: ai.studentFunctional, note: '85% weighted semantic path' },
                                            { label: 'Electrical Trace', teacher: ai.teacherElectrical, student: ai.studentElectrical, note: '15% weighted pin path' },
                                            { label: 'Normalized Trace', teacher: ai.teacherNormalized, student: ai.studentNormalized, note: 'AI scoring input after entropy filtering' }
                                        ];

                                        return (
                                            <div className="semantic-audit-content">
                                                <div className="semantic-summary-grid">
                                                    <div className="stat-box">
                                                        <span className="val">{ai.aiScore}%</span>
                                                        <span className="label">AI Semantic Score</span>
                                                    </div>
                                                    <div className="stat-box">
                                                        <span className="val">{ai.functionalMatch}%</span>
                                                        <span className="label">Functional Match</span>
                                                    </div>
                                                    <div className="stat-box">
                                                        <span className="val">{ai.electricalMatch}%</span>
                                                        <span className="label">Electrical Match</span>
                                                    </div>
                                                    <div className="stat-box">
                                                        <span className="val">85 / 15</span>
                                                        <span className="label">Blend Weights</span>
                                                    </div>
                                                </div>

                                                <div className="semantic-table-wrapper">
                                                    <table className="semantic-audit-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Layer</th>
                                                                <th>Teacher Report</th>
                                                                <th>Student Report</th>
                                                                <th>Notes</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rows.map((row) => (
                                                                <tr key={row.label}>
                                                                    <td className="id-cell">{row.label}</td>
                                                                    <td className="semantic-cell">
                                                                        <pre>{row.teacher || 'No teacher trace available.'}</pre>
                                                                    </td>
                                                                    <td className="semantic-cell">
                                                                        <pre>{row.student || 'No student trace available.'}</pre>
                                                                    </td>
                                                                    <td className="semantic-note-cell">{row.note}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div className="semantic-trace-grid">
                                                    <div className="semantic-trace-card">
                                                        <h4>Teacher Trace After Normalization</h4>
                                                        <pre>{ai.teacherNormalized || 'No normalized teacher trace available.'}</pre>
                                                    </div>
                                                    <div className="semantic-trace-card">
                                                        <h4>Student Trace After Normalization</h4>
                                                        <pre>{ai.studentNormalized || 'No normalized student trace available.'}</pre>
                                                    </div>
                                                </div>

                                                <div className="semantic-audit-footer">
                                                    Entropy filtering removes static fields that never change so the AI focuses on functional failure instead of repeated noise.
                                                </div>
                                            </div>
                                        );
                                    })()}
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
