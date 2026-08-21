// src/pages/ExamOmr.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, Send, X, PenTool, AlertCircle, HelpCircle, Save } from 'lucide-react';
import OmrRow from '../components/OmrRow';
import OptionGroup from '../components/OptionGroup';
import HtmlContent from '../components/HtmlContent';

export default function ExamOmr() {
    const location = useLocation();
    const navigate = useNavigate();
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
    const examInfo = location.state || {
        categoryName: '자격증 시험', sessionName: '회차 정보 없음', categoryId: '1', typeCode: '01'
    };

    // 🔥 실기 시험 여부 확인 (02 이면 실기)
    const isNoSubjectExam = examInfo.typeCode === '02' || (examInfo.categoryName && examInfo.categoryName.toUpperCase().includes('OCP'));
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

    const handleAnswerChange = (qNo, val, isMulti = false) => {
        setAnswers(prev => {
            // 1. 단일 선택 (기존 정보처리기사 등)
            if (!isMulti) {
                return { ...prev, [qNo]: val };
            }

            // 2. 다중 선택 (OCP_19C) - 알파벳을 뗐다 붙였다 토글!
            const currentAns = String(prev[qNo] || '');
            let newAns;
            
            if (currentAns.includes(String(val))) {
                // 이미 선택된 알파벳이면 제거 (예: 'ABC'에서 'B' 클릭 -> 'AC')
                newAns = currentAns.replace(String(val), '');
            } else {
                // 새로 선택한 알파벳이면 추가 후 오름차순 정렬 (예: 'C'에 'A' 추가 -> 'AC')
                newAns = (currentAns + String(val)).split('').sort().join('');
            }
            
            return { ...prev, [qNo]: newAns };
        });
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
    {/* 🔥 1. 반복문 변수명을 q에서 currentQ로 완벽하게 변경! */}
    {questions.map((currentQ, index) => {
        const isMultipleChoice = currentQ.options && currentQ.options.length > 0;
        const currentSubNo = (currentQ.subjectNo && Number(currentQ.subjectNo) > 0) ? Number(currentQ.subjectNo) : Math.ceil(Number(currentQ.qNo) / 20);
        const prevSubNo = index > 0 ? ((questions[index - 1].subjectNo && Number(questions[index - 1].subjectNo) > 0) ? Number(questions[index - 1].subjectNo) : Math.ceil(Number(questions[index - 1].qNo) / 20)) : null;
        const isNewSubject = index === 0 || currentSubNo !== prevSubNo;

        return (
            <React.Fragment key={currentQ.questionId || `q-${currentQ.qNo}`}>
                {/* 🔥 핵심 수정 부분: isNoSubjectExam 이 아닐 때만 과목 배너를 출력 (원본 완벽 유지!) */}
                {isNewSubject && !isNoSubjectExam && (
                    <div className="subject-header-banner">
                        <span className="subject-num-badge">{currentSubNo}과목</span>
                        {currentQ.subjectName && currentQ.subjectName.trim() !== '' && <h4 className="subject-title-text">{currentQ.subjectName}</h4>}
                    </div>
                )}

                <div id={`q-${currentQ.qNo}`} className="question-card">
                    
                    {/* 1. 문제 번호 및 제목 */}
                    <div className="question-header">
                        <span className="q-number">{currentQ.qNo}.</span>
                        <div className="q-title-box">
                            <p className="q-title">{currentQ.title}</p>
                            {(!currentQ.options || currentQ.options.length === 0) && (
                                <div style={{ marginTop: '8px' }}><span className="short-type-tag">단답형/주관식</span></div>
                            )}
                        </div>
                    </div>

                    {/* 🔥 2. 지문 (HTML 디코딩 렌더링) - 질문자님의 인라인 스타일 원본 100% 유지 🔥 */}
                    <HtmlContent content={currentQ.passageText} type="passage" />

                    {/* 3. 보기 버튼들 (객관식/주관식) */}
                    {isMultipleChoice ? (
                        // 🔥 20줄이 넘던 객관식 로직을 OptionGroup 컴포넌트 하나로 압축!
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
                                rows={2} 
                                value={answers[currentQ.qNo] || ''} 
                                onChange={(e) => handleAnswerChange(currentQ.qNo, e.target.value)} 
                            />
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
                    {/* 🔥 변수명을 currentQ로 맞추고, rreturn 오타 수정! */}
                    {questions.map((currentQ, idx) => {
                        const isOcp = examInfo?.categoryName?.toUpperCase().includes('OCP');
                        
                        return (
                            <OmrRow 
                                key={currentQ.qNo}
                                q={currentQ} 
                                answerVal={answers[currentQ.qNo]} 
                                isOcp={isOcp}
                                onAnswerChange={handleAnswerChange} 
                                onClick={() => {
                                    const element = document.getElementById(`q-${currentQ.qNo}`);
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setIsOmrOpen(false); 
                                    }
                                }}
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