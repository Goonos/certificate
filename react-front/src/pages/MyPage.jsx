// src/pages/MyPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SolveModeBadge from '../components/SolveModeBadge'; 
import { User, Clock, CheckCircle2, XCircle, ChevronRight, Award, LogOut, MessageCircle, Trash2, RotateCcw, BookOpen } from 'lucide-react';

export default function MyPage() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 이어풀기 기록 삭제 기능 구현
    const handleDeleteExam = (attemptId, type, e) => {
        e.stopPropagation(); 
        
        if (!window.confirm("이 기록을 정말 삭제하시겠습니까?\n삭제된 기록은 복구할 수 없습니다.")) return;

        fetch(`/api/mypage/attempt/${attemptId}`, { method: 'DELETE', credentials: 'include' })
            .then(res => res.json())
            .then(resData => {
                if (resData.success) {
                    setData(prev => ({
                        ...prev,
                        [type]: prev[type].filter(exam => exam.attemptId !== attemptId)
                    }));
                } else {
                    alert("삭제에 실패했습니다.");
                }
            })
            .catch(err => alert("서버 오류로 삭제하지 못했습니다."));
    };

    useEffect(() => {
        fetch('/api/mypage', { credentials: 'include' })
            .then(res => {
                if (res.status === 401) {
                    throw new Error("로그인이 필요한 서비스입니다.");
                }
                if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
                return res.json();
            })
            .then(resData => {
                setData(resData);
                setIsLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setIsLoading(false);
            });
    }, []);

    const handleLogout = () => {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
            .then(() => {
                navigate('/');
                window.location.reload(); 
            });
    };

    // 📌 풀기 방식(solveMode)에 따라 3가지 길로 정확히 안내
    const handleResumeExam = (exam, extraState = {}) => {
        let targetRoute = '/exam-omr'; // 기본값 (OMR)

        if (exam.solveMode === 'single_end' || exam.solveMode === 'SINGLE') {
            targetRoute = '/single-question'; // 종료 후 해설 모드
        } else if (exam.solveMode === 'single_each') {
            targetRoute = '/single-question-each'; // 문제별 해설 모드
        }

        navigate(targetRoute, {
            state: {
                categoryId: exam.categoryId,
                categoryName: exam.categoryName,
                typeCode: exam.typeCode,
                sessionName: exam.sessionName,
                attemptId: exam.attemptId,
                solveMode: exam.solveMode,
                ...extraState
            }
        });
    };

    // 🔥 다시 풀기 버튼 이벤트
    const handleRetry = (exam, e) => {
        e.stopPropagation();
        if (!window.confirm("문제를 처음부터 다시 푸시겠습니까?\n새로운 점수로 현재 기록이 덮어씌워집니다.")) return;
        handleResumeExam(exam, { isRetry: true }); 
    };

    // 🔥 오답 노트 버튼 이벤트
    const handleIncorrectNote = (exam, e) => {
        e.stopPropagation();
        handleResumeExam(exam, { modeType: 'REVIEW_INCORRECT' });
    };

    if (isLoading) {
        return <div className="safari-body" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>마이페이지 정보를 불러오는 중...</div>;
    }

    if (error) {
        return (
            <div className="safari-body" style={{ 
                flex: 1, overflowY: 'auto', padding: '20px', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '0' 
            }}>
                <div style={{
                    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
                    padding: '40px 20px', width: '100%', maxWidth: '320px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>로그인이 필요합니다</h2>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
                        나만의 기출문제 풀이 기록과<br/>과목별 정답률 통계를 확인해 보세요.
                    </p>
                    
                    <button 
                        onClick={() => {
                            const returnUrl = encodeURIComponent('/mypage');
                            window.location.href = `/api/auth/kakao?returnUrl=${returnUrl}`;
                        }}
                        style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            width: '100%', padding: '14px', background: '#FEE500', color: '#000000', 
                            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '800', cursor: 'pointer' 
                        }}
                    >
                        <MessageCircle size={18} fill="#000000" />
                            카카오톡 로그인
                        </button>

                        {/* 🔥 로컬 개발 환경(DEV)일 때만 마스터 로그인 버튼 렌더링 */}
                        {import.meta.env.DEV && (
                            <button 
                                onClick={() => window.location.href = '/api/auth/dev-login'}
                                style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    width: '100%', padding: '14px', background: '#f1f5f9', color: '#475569', 
                                    border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '800', cursor: 'pointer',
                                    marginTop: '12px'
                                }}
                            >
                                개발자 로그인
                            </button>
                        )}
                </div>
            </div>
        );
    }

    const { user, inProgressExams, completedExams } = data;

    return (
        <div className="safari-body" style={{ 
            flex: 1, overflowY: 'auto', minHeight: '0',
            padding: '20px', paddingBottom: '40px', WebkitOverflowScrolling: 'touch' 
        }}>
            
            {/* 유저 프로필 헤더 */}
            <div style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: '16px', padding: '20px',
                color: '#ffffff', marginBottom: '24px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={26} color="#ffffff" strokeWidth={2} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{user.nickname} 님</h3>
                        <span style={{ fontSize: '12px', opacity: 0.85, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', marginTop: '4px', display: 'inline-block' }}>
                            {user.role === 'ADMIN' ? '관리자' : '일반 수험생'}
                        </span>
                    </div>
                </div>
                <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <LogOut size={16} /> 로그아웃
                </button>
            </div>

            {/* 📌 진행 중인 시험 영역 */}
            <section style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Clock size={18} color="#2563eb" />
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#1e293b' }}>풀고 있는 기출문제</h3>
                    <span style={{ background: '#e0f2fe', color: '#0284c7', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                        {inProgressExams.length}
                    </span>
                </div>

                {inProgressExams.length === 0 ? (
                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        현재 진행 중인 시험이 없습니다.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {inProgressExams.map(exam => (
                            <div key={exam.attemptId} onClick={() => handleResumeExam(exam)} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '6px' }}>{exam.sessionName}</span>
                                            <SolveModeBadge solveMode={exam.solveMode} />
                                        </div>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{exam.categoryName}</h4>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDeleteExam(exam.attemptId, 'inProgressExams', e)} 
                                        style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>진행률: <strong style={{ color: '#2563eb' }}>{exam.solvedCount}</strong> / {exam.totalCount} 문제</p>
                                    <div style={{ display: 'flex', alignItems: 'center', color: '#2563eb', fontSize: '13px', fontWeight: 700 }}>
                                        <span>이어풀기</span><ChevronRight size={18} />
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* 📌 완료된 시험 영역 */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Award size={18} color="#10b981" />
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#1e293b' }}>풀었던 기출문제</h3>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                        {completedExams.length}
                    </span>
                </div>

                {completedExams.length === 0 ? (
                    <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        응시 완료된 시험 기록이 없습니다.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {completedExams.map(exam => (
                            <div key={exam.attemptId} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                                
                                {/* 상단: 뱃지들 + 합격여부 */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '6px' }}>{exam.sessionName}</span>
                                            <SolveModeBadge solveMode={exam.solveMode} />
                                        </div>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{exam.categoryName}</h4>
                                    </div>
                                    {exam.isPassed ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}><CheckCircle2 size={14} /> 합격 ({exam.score}점)</div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}><XCircle size={14} /> 불합격 ({exam.score}점)</div>
                                    )}
                                </div>

                                {/* 🔥 레이아웃 정렬 수정: alignItems를 제거하여 상단에 밀착시키고, 좌측 컨테이너에 space-between 추가 */}
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    
                                    {/* 좌측 영역: 과목별 성적 (위) + 응시일자 (아래) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: '12px' }}>
                                        {/* 성적이 구분선 바로 아래에 위치하게 됩니다 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>과목별 성적</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {exam.subjects && exam.subjects.map(sub => (
                                                    <div key={sub.subjectNo} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', background: sub.score < 40 ? '#fef2f2' : '#f8fafc', color: sub.score < 40 ? '#ef4444' : '#334155', border: sub.score < 40 ? '1px solid #fca5a5' : '1px solid #e2e8f0' }}>
                                                        {sub.subjectNo}과목: <strong>{sub.score}점</strong> {sub.score < 40 && '(과락)'}
                                                    </div>
                                                ))}
                                                {(!exam.subjects || exam.subjects.length === 0) && (
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>단일 과목 (세부 성적 없음)</div>
                                                )}
                                            </div>
                                        </div>
                                        {/* 남는 여백(공백)이 이 위쪽으로 발생하며, 응시일자는 버튼 라인에 맞춰집니다 */}
                                        <div style={{ fontSize: '11px', color: '#94a3b8', paddingTop: '10px' }}>응시일자: {exam.completeDt}</div>
                                    </div>

                                    {/* 우측 영역: 버튼 3개 스택 (높이의 기준이 됨) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                                        <button 
                                            onClick={(e) => handleRetry(exam, e)} 
                                            style={{ background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px' }}
                                        >
                                            <RotateCcw size={14} /> 다시 풀기
                                        </button>
                                        <button 
                                            onClick={(e) => handleIncorrectNote(exam, e)} 
                                            style={{ background: '#fffbeb', color: '#d97706', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px' }}
                                        >
                                            <BookOpen size={14} /> 오답 노트
                                        </button>
                                        <button 
                                            onClick={(e) => handleDeleteExam(exam.attemptId, 'completedExams', e)} 
                                            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px' }}
                                        >
                                            <Trash2 size={14} /> 기록 삭제
                                        </button>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}