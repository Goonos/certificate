// src/pages/ExamOmr.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, Send, X, PenTool, AlertCircle, HelpCircle, Save } from 'lucide-react';

export default function ExamOmr() {
    const location = useLocation();
    const navigate = useNavigate();

    const examInfo = location.state || {
        categoryName: '자격증 시험', sessionName: '회차 정보 없음', categoryId: '1', typeCode: '01'
    };

    // 🔥 실기 시험 여부 확인 (02 이면 실기)
    const isPracticalExam = examInfo.typeCode === '02';

    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isOmrOpen, setIsOmrOpen] = useState(false);
    
    const [currentAttemptId, setCurrentAttemptId] = useState(examInfo.attemptId || null);

    const [customAlert, setCustomAlert] = useState({
        isOpen: false, message: '', type: 'info', onConfirm: null, onCancel: null, confirmText: '', cancelText: ''
    });

    useEffect(() => {
        fetch(`/api/exam/questions?categoryId=${examInfo.categoryId}&typeCode=${examInfo.typeCode}&session=${examInfo.sessionName}`)
            .then(res => {
                if (!res.ok) throw new Error("서버에서 문제를 불러오지 못했습니다.");
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data) && data.length > 0) setQuestions(data);
                else throw new Error("해당 회차에 등록된 문제 데이터가 없습니다."); 
                setIsLoading(false);
            })
            .catch(err => {
                setErrorMsg(err.message);
                setIsLoading(false);
            });
    }, [examInfo]);

    useEffect(() => {
        if (currentAttemptId && questions.length > 0) {
            fetch(`/api/exam/progress/${currentAttemptId}`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    if (data.answers) setAnswers(data.answers);
                })
                .catch(err => console.error("기존 답안 로드 실패:", err));
        }
    }, [currentAttemptId, questions]);

    useEffect(() => {
        if (isLoading || errorMsg || customAlert.isOpen) return;
        const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, [isLoading, errorMsg, customAlert.isOpen]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const handleAnswerChange = (qNo, val) => {
        setAnswers(prev => ({ ...prev, [qNo]: val }));
    };

    const scrollToQuestion = (qNo) => {
        const element = document.getElementById(`q-${qNo}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setIsOmrOpen(false);
        }
    };

    const handleSaveProgress = () => {
    fetch('/api/auth/me', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (!data.isLoggedIn) {
                alert("임시저장은 로그인 후 이용 가능합니다.");
                return;
            }
            
            fetch('/api/exam/save-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                attemptId: currentAttemptId, 
                examInfo: { ...examInfo, solveMode: 'omr' }, 
                // 🔥 마법의 코드: 서버가 채점/저장할 때 필요한 최소한의 뼈대 데이터만 맵핑해서 보냅니다!
                questions: questions.map(q => ({ questionId: q.questionId, qNo: q.qNo, answer: q.answer })),
                answers 
            })
            })
            .then(res => {
                if (!res.ok) throw new Error("서버 저장 실패");
                return res.json();
            })
            .then(resData => {
                if (resData.success) {
                    alert("성공적으로 임시저장 되었습니다.");
                    navigate('/mypage');
                } else {
                    alert("저장에 실패했습니다. 다시 시도해 주세요.");
                }
            })
            .catch(err => {
                console.error(err);
                alert("임시저장 중 서버 에러가 발생했습니다.");
            });
        });
};

    const handleSubmit = () => {
        if (questions.length === 0) return;

        const unansweredQuestions = questions.filter(q => {
            const val = answers[q.qNo];
            return val === undefined || val === null || String(val).trim() === '';
        });

        if (unansweredQuestions.length > 0) {
            setCustomAlert({
                isOpen: true,
                type: 'warning',
                message: `아직 풀지 않은 문제가 ${unansweredQuestions.length}개 있습니다.\n현재까지의 답안을 임시저장 할까요?`,
                confirmText: '임시 저장',
                cancelText: '이어서 풀기',
                onCancel: () => setCustomAlert({ isOpen: false }),
                onConfirm: () => {
                    setCustomAlert({ isOpen: false });
                    handleSaveProgress();
                }
            });
        } else {
            setCustomAlert({
                isOpen: true,
                type: 'confirm',
                message: "모든 문제를 작성했습니다.\n최종 답안을 제출하시겠습니까?",
                confirmText: '최종 제출',
                cancelText: '취소',
                onCancel: () => setCustomAlert({ isOpen: false }),
                onConfirm: () => {
                    setCustomAlert({ isOpen: false });
                    setTimeout(() => {
                        navigate('/exam-result', {
                            state: {
                                // 🔥 핵심: 제출해서 결과창으로 넘길 때도 OMR 꼬리표 주입!
                                examInfo: { ...examInfo, solveMode: 'omr' },      
                                questions,     
                                answers,       
                                elapsedTime,
                                attemptId: currentAttemptId 
                            }
                        });
                    }, 150);
                }
            });
        }
    };

    const answeredCount = Object.keys(answers).filter(k => String(answers[k]).trim() !== '').length;

    return (
        <div className="safari-body omr-body-container">
            <div className="omr-top-bar">
                <div className="timer-box">
                    <Clock size={15} />
                    <span>{formatTime(elapsedTime)}</span>
                </div>
                <div className="exam-title-center">
                    <span className="exam-subject-badge">{examInfo.sessionName}</span>
                    <h3 className="exam-session-text">{examInfo.categoryName}</h3>
                </div>
                <button className="omr-top-btn" onClick={() => setIsOmrOpen(true)}>
                    <span className="top-btn-badge">{answeredCount}/{questions.length}</span>
                </button>
            </div>

            <hr className="omr-divider" />

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 'bold' }}>문제 로딩중...</div>
            ) : errorMsg ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444', fontWeight: 'bold' }}>
                    <p>⚠️ {errorMsg}</p>
                    <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', border: 'none', cursor: 'pointer', marginTop: '10px' }}>돌아가기</button>
                </div>
            ) : (
                <div className="question-list-section full-width">
                    {questions.map((q, index) => {
                        const isMultipleChoice = q.options && q.options.length > 0;
                        const currentSubNo = (q.subjectNo && Number(q.subjectNo) > 0) ? Number(q.subjectNo) : Math.ceil(Number(q.qNo) / 20);
                        const prevSubNo = index > 0 ? ((questions[index - 1].subjectNo && Number(questions[index - 1].subjectNo) > 0) ? Number(questions[index - 1].subjectNo) : Math.ceil(Number(questions[index - 1].qNo) / 20)) : null;
                        const isNewSubject = index === 0 || currentSubNo !== prevSubNo;

                        return (
                            <React.Fragment key={q.questionId || `q-${q.qNo}`}>
                                {/* 🔥 핵심 수정 부분: isPracticalExam 이 아닐 때만 과목 배너를 출력! */}
                                {isNewSubject && !isPracticalExam && (
                                    <div className="subject-header-banner">
                                        <span className="subject-num-badge">{currentSubNo}과목</span>
                                        {q.subjectName && q.subjectName.trim() !== '' && <h4 className="subject-title-text">{q.subjectName}</h4>}
                                    </div>
                                )}

                                <div id={`q-${q.qNo}`} className="question-card">
                                    
                                    {/* 1. 문제 번호 및 제목 */}
                                    <div className="question-header">
                                        <span className="q-number">{q.qNo}.</span>
                                        <div className="q-title-box">
                                            <p className="q-title">{q.title}</p>
                                            {(!q.options || q.options.length === 0) && (
                                                <div style={{ marginTop: '8px' }}><span className="short-type-tag">단답형/주관식</span></div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 🔥 2. 지문 (HTML 디코딩 렌더링) 🔥 */}
                                    {q.passageText && (
                                        <div 
                                            style={{ 
                                                background: '#f8fafc', padding: '14px', borderRadius: '10px', 
                                                fontSize: '13px', color: '#334155', border: '1px solid #e2e8f0', 
                                                marginBottom: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.5',
                                                overflowX: 'auto' 
                                            }}
                                            dangerouslySetInnerHTML={{ 
                                                __html: q.passageText.replace(/&lt;/g, '<').replace(/&gt;/g, '>') 
                                            }} 
                                        />
                                    )}

                                    {/* 3. 보기 버튼들 (객관식/주관식) */}
                                    {isMultipleChoice ? (
                                        <div className="options-group">
                                            {/* 🔥 question.options 대신 q.options 사용! */}
                                            {q.options.map((opt, idx) => {
                                                const optNo = idx + 1;
                                                const isSelected = answers[q.qNo] === optNo;
                                                return (
                                                    <button 
                                                        key={optNo} 
                                                        className={`option-btn ${isSelected ? 'selected' : ''}`} 
                                                        onClick={() => handleAnswerChange(q.qNo, optNo)}
                                                    >
                                                        <span className="opt-number">{optNo}</span>
                                                        <span className="opt-text">{opt}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="short-answer-wrapper">
                                            <div className="short-input-header"><PenTool size={14} /><span>답안 작성</span></div>
                                            <textarea className="short-answer-input" rows={2} value={answers[q.qNo] || ''} onChange={(e) => handleAnswerChange(q.qNo, e.target.value)} />
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {!isLoading && !errorMsg && (
                <button className="floating-submit-btn" onClick={handleSubmit}>
                    <Send size={16} /><span>제출</span>
                </button>
            )}

            {/* 답안지 드로어 */}
            <div className={`omr-overlay ${isOmrOpen ? 'active' : ''}`} onClick={() => setIsOmrOpen(false)}></div>
            <div className={`omr-drawer ${isOmrOpen ? 'active' : ''}`}>
                <div className="omr-drawer-header">
                    <h4><CheckCircle2 size={18} /> 답안지</h4>
                    <button className="icon-btn-sm" onClick={() => setIsOmrOpen(false)}><X size={20} /></button>
                </div>
                <div className="omr-drawer-content">
                    <div className="omr-grid-list">
                        {questions.map((q) => {
                            const isMultipleChoice = q.options && q.options.length > 0;
                            const answerVal = answers[q.qNo];
                            const hasAnswer = answerVal !== undefined && String(answerVal).trim() !== '';

                            return (
                                <div key={q.qNo} className="omr-row" onClick={() => scrollToQuestion(q.qNo)}>
                                    <span className="omr-q-num">{q.qNo}번</span>
                                    {isMultipleChoice ? (
                                        <div className="omr-bubbles">
                                            {[1, 2, 3, 4].map((num) => (
                                                <button key={num} className={`omr-bubble ${answerVal === num ? 'checked' : ''}`} onClick={(e) => { e.stopPropagation(); handleAnswerChange(q.qNo, num); }}>
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="omr-short-status">
                                            {hasAnswer ? <div className="omr-short-answer-display">{answerVal}</div> : <span className="omr-badge empty">미작성</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="omr-drawer-footer" style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={handleSaveProgress}
                        style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                        <Save size={14} /> 임시저장
                    </button>
                    <button 
                        className="submit-exam-btn" 
                        style={{ flex: 1.5, padding: '14px', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }} 
                        onClick={handleSubmit}
                    >
                        <Send size={14} /> 최종 제출
                    </button>
                </div>
            </div>

            {/* 공통 커스텀 모달 팝업 */}
            {customAlert.isOpen && (
                <>
                    <div className="action-sheet-overlay active" onClick={() => (customAlert.type === 'confirm' || customAlert.type === 'warning') && customAlert.onCancel ? customAlert.onCancel() : setCustomAlert({ isOpen: false })} style={{ display: 'block', zIndex: 9999, backdropFilter: 'blur(3px)' }}></div>
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        background: '#ffffff', width: '85%', maxWidth: '320px', padding: '24px',
                        borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        zIndex: 10000, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
                    }}>
                        {customAlert.type === 'warning' && <AlertCircle size={42} color="#f59e0b" style={{ marginBottom: '16px' }} />}
                        {customAlert.type === 'confirm' && <HelpCircle size={42} color="#3b82f6" style={{ marginBottom: '16px' }} />}
                        <p style={{ fontSize: '15px', color: '#1e293b', marginBottom: '24px', fontWeight: '600', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                            {customAlert.message}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                            {(customAlert.type === 'confirm' || customAlert.type === 'warning') && (
                                <button onClick={customAlert.onCancel} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
                                    {customAlert.cancelText || '취소'}
                                </button>
                            )}
                            <button onClick={customAlert.onConfirm} style={{ flex: 1, padding: '12px', background: customAlert.type === 'warning' ? '#f59e0b' : '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
                                {customAlert.confirmText || '확인'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}