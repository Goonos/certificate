// src/pages/CertExam.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';

export default function CertExam() {
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selected, setSelected] = useState({
        categoryId: null, categoryName: '',
        typeCode: '', typeName: '',
        solveMode: '', solveModeName: ''
    });

    const [modalStep, setModalStep] = useState(0);

    const [omrSessions, setOmrSessions] = useState([]); 
    const [singleSetup, setSingleSetup] = useState({ subjects: [], sessions: [] }); 
    
    const [checkedSubjects, setCheckedSubjects] = useState([]);
    const [sessionMode, setSessionMode] = useState('DESIGNATED');
    const [singleSession, setSingleSession] = useState('');
    const [startSession, setStartSession] = useState('');
    const [endSession, setEndSession] = useState('');

    useEffect(() => {
        fetch('/api/exam/categories')
            .then(res => res.json())
            .then(data => {
                setCategories(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    const handleCategoryClick = (cat) => {
        setSelected(prev => ({ ...prev, categoryId: cat.id, categoryName: cat.name }));
        
        if (cat.types.length === 1) {
            handleTypeSelect(cat.types[0].code, cat.types[0].name);
        } else {
            setModalStep(1); 
        }
    };

    const handleTypeSelect = (typeCode, typeName) => {
        setSelected(prev => ({ ...prev, typeCode, typeName }));
        setModalStep(2); 
    };

    const handleSolveModeSelect = async (modeCode, modeName) => {
        setSelected(prev => ({ ...prev, solveMode: modeCode, solveModeName: modeName }));

        if (modeCode === 'omr') {
            setModalStep(3);
            const res = await fetch(`/api/exam/sessions?categoryId=${selected.categoryId}&typeCode=${selected.typeCode}`);
            const data = await res.json();
            setOmrSessions(data);
        } else {
            const res = await fetch(`/api/exam/setup-info/${selected.categoryId}`);
            const data = await res.json();
            
            setSingleSetup(data);
            if(data.sessions.length > 0) {
                setSingleSession(data.sessions[0]);
                setStartSession(data.sessions[data.sessions.length - 1]);
                setEndSession(data.sessions[0]);
            }
            if(data.subjects.length > 0) {
                setCheckedSubjects(data.subjects.map(s => s.SUBJECT_NO)); 
            }
            setModalStep(4);
        }
    };

    const startOmrExam = (sessionId, sessionName) => {
        setModalStep(0);
        navigate('/exam-omr', {
            state: {
                categoryId: selected.categoryId,
                categoryName: selected.categoryName,
                typeCode: selected.typeCode,
                sessionId: sessionId,
                sessionName: sessionName
            }
        });
    };

    // 🔥 single_each 선택 시 /single-question-each 페이지로 이동!
    const submitSingleMode = () => {
        if (selected.typeCode !== '02' && checkedSubjects.length === 0) {
            return alert("최소 하나 이상의 과목을 선택해 주세요.");
        }

        const payload = {
            categoryId: selected.categoryId,
            categoryName: selected.categoryName,
            typeCode: selected.typeCode,
            solveMode: selected.solveMode,
            subjectNos: selected.typeCode === '02' ? [] : checkedSubjects,
            modeType: sessionMode,
            ...(sessionMode === 'DESIGNATED' 
                ? { examSession: singleSession, sessionName: singleSession } 
                : { startSession, endSession, sessionName: `${startSession}~${endSession}` })
        };

        setModalStep(0);

        if (selected.solveMode === 'single_end') {
            navigate('/single-question', { state: payload });
        } else if (selected.solveMode === 'single_each') {
            // 🔥 [추가] 문제별 해설 모드일 때는 방금 만든 페이지로!
            navigate('/single-question-each', { state: payload }); 
        } else {
            navigate('/exam-omr', { state: payload });
        }   
    };

    const toggleSubject = (subjectNo) => {
        setCheckedSubjects(prev => 
            prev.includes(subjectNo) 
                ? prev.filter(n => n !== subjectNo) 
                : [...prev, subjectNo]
        );
    };

    const renderModalContent = () => {
        if (modalStep === 1) {
            const cat = categories.find(c => c.id === selected.categoryId);
            return (
                <>
                    <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 700 }}>{cat?.name} 유형 선택</h3>
                    {cat?.types.map(type => (
                        <button key={type.code} className="type-btn" onClick={() => handleTypeSelect(type.code, type.name)}>
                            📝 {type.name}
                        </button>
                    ))}
                </>
            );
        }
        if (modalStep === 2) {
            return (
                <>
                    <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 700 }}>풀기 방식 선택</h3>
                    <button className="type-btn" onClick={() => handleSolveModeSelect('omr', '기출문제 풀기')}>📄 기출문제 풀기 (OMR)</button>
                    <button className="type-btn" onClick={() => handleSolveModeSelect('single_end', '한문제씩 풀기 (종료후 해설)')}>🧩 한문제씩 풀기 (종료후 해설)</button>
                    <button className="type-btn" onClick={() => handleSolveModeSelect('single_each', '한문제씩 풀기 (문제별 해설)')}>💡 한문제씩 풀기 (문제별 해설)</button>
                </>
            );
        }
        if (modalStep === 3) {
            return (
                <>
                    <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 700 }}>회차 선택</h3>
                    {omrSessions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>기출 회차가 없습니다.</div>
                    ) : (
                        omrSessions.map(sess => (
                            <button key={sess.id} className="type-btn" onClick={() => startOmrExam(sess.id, sess.name)}>
                                📅 {sess.name} 기출문제
                            </button>
                        ))
                    )}
                </>
            );
        }
        if (modalStep === 4) {
            return (
                <>
                    <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 700 }}>한문제씩 풀기 상세 설정</h3>
                    
                    {selected.typeCode !== '02' && (
                        <>
                            <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>1. 세부 과목 선택</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                {singleSetup.subjects.length === 0 ? <span style={{fontSize:'13px'}}>과목 없음</span> : singleSetup.subjects.map(s => (
                                    <label key={s.SUBJECT_NO} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={checkedSubjects.includes(s.SUBJECT_NO)}
                                            onChange={() => toggleSubject(s.SUBJECT_NO)}
                                        />
                                        {s.SUBJECT_NO}과목: {s.SUBJECT_NAME}
                                    </label>
                                ))}
                            </div>
                            <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', marginBottom: '20px' }} />
                        </>
                    )}

                    <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>{selected.typeCode === '02' ? '1.' : '2.'} 회차 범위 선택</h4>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                        <label>
                            <input type="radio" checked={sessionMode === 'DESIGNATED'} onChange={() => setSessionMode('DESIGNATED')} /> 지정 회차
                        </label>
                        <label>
                            <input type="radio" checked={sessionMode === 'RANGE'} onChange={() => setSessionMode('RANGE')} /> 범위 랜덤
                        </label>
                    </div>

                    {sessionMode === 'DESIGNATED' ? (
                        <select value={singleSession} onChange={e => setSingleSession(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #cbd5e1' }}>
                            {singleSetup.sessions.map(s => <option key={s} value={s}>{s} 회차</option>)}
                        </select>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <select value={startSession} onChange={e => setStartSession(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                {singleSetup.sessions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <span style={{ fontWeight: 'bold' }}>~</span>
                            <select value={endSession} onChange={e => setEndSession(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                {singleSetup.sessions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}

                    <button className="primary-btn" onClick={submitSingleMode} style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', borderRadius: '8px', fontWeight: 600 }}>풀기 시작</button>
                </>
            );
        }
        return null;
    };

    return (
        <div className="safari-body">
            
            <h2 style={{ marginBottom: '16px', fontSize: '19px', fontWeight: 800 }}>📚 과목 선택</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)', marginBottom: '24px' }}>응시할 자격증 종목을 선택해 주세요.</p>
            
            <div className="menu-grid" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '14px', gridColumn: '1 / -1' }}>
                        데이터를 불러오는 중...
                    </div>
                ) : categories.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444', fontSize: '14px', gridColumn: '1 / -1' }}>
                        데이터를 불러오지 못했습니다. DB를 확인하세요.
                    </div>
                ) : (
                    categories.map(cat => (
                        <div key={cat.id} className="menu-card" onClick={() => handleCategoryClick(cat)}>
                            <div className="card-info">
                                <div className="card-icon-wrapper" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                                    <BookOpen size={24} />
                                </div>
                                <div className="card-text">
                                    <h3>{cat.name}</h3>
                                </div>
                            </div>
                            <ChevronRight className="card-arrow" size={20} />
                        </div>
                    ))
                )}
            </div>

            {modalStep > 0 && (
                <>
                    <div className="action-sheet-overlay active" onClick={() => setModalStep(0)} style={{ display: 'block' }}></div>
                    <div className="action-sheet active" style={{ display: 'block', maxHeight: '85vh', overflowY: 'auto' }}>
                        {renderModalContent()}
                        {modalStep !== 4 && (
                            <button onClick={() => setModalStep(0)} style={{ width: '100%', padding: '14px', background: 'transparent', border: 'none', color: '#dc2626', fontWeight: 600, marginTop: '8px' }}>
                                취소
                            </button>
                        )}
                        {modalStep === 4 && (
                            <button onClick={() => setModalStep(0)} style={{ width: '100%', padding: '14px', background: 'transparent', border: 'none', color: '#64748b', fontWeight: 600, marginTop: '8px' }}>
                                닫기
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}