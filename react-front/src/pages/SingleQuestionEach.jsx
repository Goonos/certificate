// src/pages/SingleQuestionEach.jsx
import OmrRow from '../components/OmrRow';
import OptionGroup from '../components/OptionGroup';
import React, { useState, useEffect } from 'react';
import HtmlContent from '../components/HtmlContent';


import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, Send, X, PenTool, AlertCircle, HelpCircle, Save, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';export default function SingleQuestionEach() {



    const formatHtmlContent = (htmlStr) => {
        if (!htmlStr) return '';
        // 1. 깨진 HTML 태그(해설) 복구
        let html = htmlStr.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
        // 2. <img> 태그를 찾아 기존 속성을 날리고 모바일 화면 폭에 맞춰 100%로 주입
        return html.replace(/<img([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/(width|height)\s*=\s*["'][^"']*["']/gi, '');
            // 라이트 모드(하얀 배경)에 맞는 기본 디자인만 적용
            return `<img ${cleanAttrs} width="100%" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        });
    };

    const location = useLocation();
    const navigate = useNavigate();

    const examInfo = location.state || {
        categoryName: '자격증 시험', sessionName: '23-01', categoryId: '1', typeCode: '01'
    };

    const isPracticalExam = examInfo.typeCode === '02';

    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isOmrOpen, setIsOmrOpen] = useState(false);
    
    // 🔥 문제별 해설 보기/닫기 토글 상태
    const [isExplanationOpen, setIsExplanationOpen] = useState(false);

    const [currentAttemptId, setCurrentAttemptId] = useState(examInfo.attemptId || null);

    const [customAlert, setCustomAlert] = useState({
        isOpen: false, message: '', type: 'info', onConfirm: null, onCancel: null, confirmText: '', cancelText: ''
    });

    // 문제 데이터 로드 (이어풀기 vs 신규 생성)
    // 4. 문제 불러오기
    useEffect(() => {
        // 🔥 1. 오답 노트 모드: 신호를 받으면 틀린 문제 전용 API를 호출합니다.
        if (examInfo.modeType === 'REVIEW_INCORRECT' && currentAttemptId) {
            fetch(`/api/exam/questions/incorrect/${currentAttemptId}`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error("오답 문제를 불러오지 못했습니다.");
                return res.json();
            })
            .then(data => {
                if (data.questions && data.questions.length > 0) {
                    setQuestions(data.questions);
                } else {
                    throw new Error("틀린 문제가 없습니다! 완벽합니다 💯");
                }
                setIsLoading(false);
            })
            .catch(err => {
                setErrorMsg(err.message);
                setIsLoading(false);
            });
        } 
        // 🧩 2. 이어풀기 모드 (기존 유지)
        else if (currentAttemptId) {
            fetch(`/api/exam/questions/resume/${currentAttemptId}`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error("이어풀기 문제를 불러오지 못했습니다.");
                return res.json();
            })
            .then(data => {
                if (data.questions && data.questions.length > 0) {
                    setQuestions(data.questions);
                } else {
                    throw new Error("저장된 문제 데이터가 없습니다.");
                }
                setIsLoading(false);
            })
            .catch(err => {
                setErrorMsg(err.message);
                setIsLoading(false);
            });
        } 
        // 🧩 3. 새 시험 모드 (기존 유지)
        else {
            fetch('/api/exam/questions/single-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    attemptId: currentAttemptId, 
                    categoryId: examInfo.categoryId,
                    typeCode: examInfo.typeCode,
                    subjectNos: examInfo.subjectNos || [],
                    modeType: examInfo.modeType || 'DESIGNATED',
                    examSession: examInfo.sessionName,
                    startSession: examInfo.startSession,
                    endSession: examInfo.endSession,
                    // 🔥 핵심 수정: 무식하게 적혀있던 limit: 20을 지우고, 범위 랜덤일 때만 20개로 제한합니다!
                    ...(examInfo.modeType === 'RANGE' ? { limit: 20 } : {}),
                    
                    examInfo: { ...examInfo, solveMode: 'single_each' }, 
                    questions: questions.map(q => ({ questionId: q.questionId, qNo: q.qNo, answer: q.answer })),
                    answers 
                })
            })
            .then(res => {
                if (!res.ok) throw new Error("서버에서 문제를 불러오지 못했습니다.");
                return res.json();
            })
            .then(data => {
                if (data.questions && data.questions.length > 0) setQuestions(data.questions);
                else throw new Error("해당 조건에 일치하는 기출문제가 없습니다.");
                setIsLoading(false);
            })
            .catch(err => { setErrorMsg(err.message); setIsLoading(false); });
        }
    }, [examInfo, currentAttemptId]);

    // 5. 이어풀기 시 이전 답안 복원
    useEffect(() => {
        if (currentAttemptId && questions.length > 0) {
            // 🔥 오답 노트거나 다시 풀기라면 기존에 마킹했던 답안을 싹 비워줍니다!
            if (examInfo.isRetry || examInfo.modeType === 'REVIEW_INCORRECT') {
                setAnswers({});
            } else {
                fetch(`/api/exam/progress/${currentAttemptId}`, { credentials: 'include' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.answers) setAnswers(data.answers);
                    })
                    .catch(err => console.error("기존 답안 로드 실패:", err));
            }
        }
    }, [currentAttemptId, questions, examInfo]);

    // 타이머
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

    const handleAnswerChange = (qNo, val, isMulti = false) => {
        setAnswers(prev => {
            if (!isMulti) {
                return { ...prev, [qNo]: val };
            }

            const currentAns = String(prev[qNo] || '');
            let newAns;
            
            if (currentAns.includes(String(val))) {
                newAns = currentAns.replace(String(val), '');
            } else {
                newAns = (currentAns + String(val)).split('').sort().join('');
            }
            
            return { ...prev, [qNo]: newAns };
        });
    };

    // 문제 이동 시 해설창을 다시 닫아주는 처리
    const handlePrev = () => {
        setIsExplanationOpen(false);
        setCurrentIndex(prev => Math.max(prev - 1, 0));
    };

    const handleNext = () => {
        setIsExplanationOpen(false);
        setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
    };

    const jumpToQuestion = (index) => {
        setIsExplanationOpen(false);
        setCurrentIndex(index);
        setIsOmrOpen(false);
    };

    // 임시저장
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
                        // 🔥 OCP 과목이든 뭐든 묻지도 따지지도 않고 single_each 강제 덮어쓰기!
                        examInfo: { ...examInfo, solveMode: 'single_each' }, 
                        questions, 
                        answers 
                    })
                })
                .then(res => res.json())
                .then(resData => {
                    if (resData.success) {
                        navigate('/mypage');
                    }
                });
            });
    };

    // 최종 제출
    // 📌 [최종 제출] - OCP 포함 모든 과목 무조건 single_each 강제!
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
                                // 🔥 결과창으로 넘길 때도 OCP 등 묻지 않고 single_each 강제 주입!
                                examInfo: { ...examInfo, solveMode: 'single_each' },      
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
    const currentQ = questions[currentIndex];

    return (
        <div className="safari-body omr-body-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* 상단 바 */}
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

            {/* 본문 문제 영역 */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 'bold' }}>문제 로딩중...</div>
            ) : errorMsg ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444', fontWeight: 'bold' }}>
                    <p>⚠️ {errorMsg}</p>
                    <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', border: 'none', cursor: 'pointer', marginTop: '10px' }}>돌아가기</button>
                </div>
            ) : currentQ ? (
                <div className="question-list-section full-width" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    
                    {!isPracticalExam && currentQ.subjectName && (
                        <div className="subject-header-banner" style={{ marginBottom: '12px' }}>
                            <span className="subject-num-badge">{currentQ.subjectNo || 1}과목</span>
                            <h4 className="subject-title-text">{currentQ.subjectName}</h4>
                        </div>
                    )}

                    <div className="question-card" style={{ marginBottom: '0' }}>
                        <div className="question-header">
                            <span className="q-number">{currentIndex + 1}.</span>
                            <div className="q-title-box">
                                <p className="q-title">{currentQ.title}</p>
                                {(!currentQ.options || currentQ.options.length === 0) && (
                                    <div style={{ marginTop: '8px' }}><span className="short-type-tag">단답형/주관식</span></div>
                                )}
                            </div>
                        </div>

                        <HtmlContent content={currentQ.passageText} type="passage" />

                        {currentQ.options && currentQ.options.length > 0 ? (
                            <OptionGroup 
                                q={currentQ} 
                                currentAnswer={answers[currentQ.qNo]} 
                                onAnswerChange={handleAnswerChange} 
                                isOcp={examInfo?.categoryName?.toUpperCase().includes('OCP')} 
                            />
                        ) : (
                            <div className="short-answer-wrapper">
                                <div className="short-input-header"><PenTool size={14} /><span>답안 작성</span></div>
                                <textarea 
                                    className="short-answer-input" 
                                    rows={3} 
                                    value={answers[currentQ.qNo] || ''} 
                                    onChange={(e) => handleAnswerChange(currentQ.qNo, e.target.value)}
                                    placeholder="정답을 작성하세요."
                                />
                            </div>
                        )}

                        {/* 🔥 해설 보기 클릭 시 표출되는 정답 및 해석 박스 */}
                        {isExplanationOpen && (
                            <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 800, color: '#16a34a', marginBottom: '12px' }}>
                                    <CheckCircle2 size={16} />
                                    <span>정답: {currentQ.options && currentQ.options.length > 0 && !isNaN(currentQ.answer) ? `${currentQ.answer}번` : currentQ.answer}</span>
                                </div>
                                
                                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                                    <strong style={{ color: '#0f172a', display: 'block', marginBottom: '8px', fontSize: '14px' }}>💡 문제 해설:</strong>
                                    
                                    {/* 🚨 핵심 수정: passageText(지문)가 아닌 explanationText(해설)를 전달해야 합니다! */}
                                    <HtmlContent content={currentQ.explanationText} type="explanation" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {/* 🔥 하단 버튼 영역 (해설 보기 버튼 + 이전/다음/제출) */}
            {!isLoading && !errorMsg && (
                <div style={{ padding: '12px 16px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    
                    {/* 🔥 요청하신 '해설 보기' 버튼 */}
                    <button 
                        onClick={() => setIsExplanationOpen(prev => !prev)}
                        style={{
                            width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '8px',
                            background: isExplanationOpen ? '#fef3c7' : '#eff6ff',
                            color: isExplanationOpen ? '#92400e' : '#2563eb',
                            border: isExplanationOpen ? '1px solid #fcd34d' : '1px solid #bfdbfe',
                            fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer'
                        }}
                    >
                        <Lightbulb size={16} />
                            {isExplanationOpen ? '해설 닫기' : '해설 보기'}
                    </button>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                            onClick={handlePrev} 
                            disabled={currentIndex === 0}
                            style={{ 
                                flex: 1, padding: '12px', borderRadius: '10px', 
                                background: currentIndex === 0 ? '#f1f5f9' : '#e2e8f0', 
                                color: currentIndex === 0 ? '#cbd5e1' : '#475569', 
                                border: 'none', fontWeight: 800, fontSize: '14px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', 
                                cursor: currentIndex === 0 ? 'default' : 'pointer' 
                            }}
                        >
                            <ChevronLeft size={16} /> 이전
                        </button>

                        <button 
                            onClick={handleNext} 
                            disabled={currentIndex === questions.length - 1}
                            style={{ 
                                flex: 1, padding: '12px', borderRadius: '10px', 
                                background: currentIndex === questions.length - 1 ? '#f1f5f9' : '#2563eb', 
                                color: currentIndex === questions.length - 1 ? '#cbd5e1' : '#ffffff', 
                                border: 'none', fontWeight: 800, fontSize: '14px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', 
                                cursor: currentIndex === questions.length - 1 ? 'default' : 'pointer' 
                            }}
                        >
                            다음 <ChevronRight size={16} />
                        </button>

                        <button 
                            onClick={handleSubmit}
                            style={{ 
                                flex: 1.2, padding: '12px', borderRadius: '10px', 
                                background: '#10b981', color: '#ffffff', 
                                border: 'none', fontWeight: 800, fontSize: '14px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', 
                                cursor: 'pointer' 
                            }}
                        >
                            <Send size={15} /> 제출
                        </button>
                    </div>
                </div>
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
                    {questions.map((q, idx) => {
                        const isOcp = examInfo?.categoryName?.toUpperCase().includes('OCP');
                        
                        return (
                            // 🔥 수십 줄의 코드가 이 한 줄로 완벽하게 대체됩니다!
                            <OmrRow 
                                key={q.qNo}
                                q={q} 
                                answerVal={answers[q.qNo]} 
                                isOcp={isOcp}
                                onAnswerChange={handleAnswerChange} 
                                onClick={() => jumpToQuestion(idx)} // (ExamOmr의 경우 scrollToQuestion(q.qNo) 적용)
                            />
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