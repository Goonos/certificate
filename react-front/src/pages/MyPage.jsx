// src/pages/MyPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Clock, CheckCircle2, XCircle, ChevronRight, Award, LogOut, MessageCircle } from 'lucide-react';

export default function MyPage() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

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

    // 🔥 풀기 방식(solveMode)에 따라 분기하여 이동하는 이어풀기 함수
    const handleResumeExam = (exam) => {
        let targetRoute = '/exam-omr'; // 기본값 OMR
        
        if (exam.solveMode === 'single_each') {
            targetRoute = '/single-question-each'; // 💡 새로 만든 문제별 해설 뷰어
        } else if (exam.solveMode === 'single_end' || exam.solveMode === 'SINGLE') {
            targetRoute = '/single-question'; // 🧩 기존 종료 후 해설 뷰어
        }

        navigate(targetRoute, {
            state: {
                categoryId: exam.categoryId,
                categoryName: exam.categoryName,
                typeCode: exam.typeCode,
                sessionName: exam.sessionName,
                attemptId: exam.attemptId,
                solveMode: exam.solveMode
            }
        });
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
            
            <div style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: '16px', padding: '20px',
                color: '#ffffff', marginBottom: '24px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={26} color="#ffffff" />
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
                        {inProgressExams.map(exam => {
                            const isSingle = exam.solveMode === 'single_end' || exam.solveMode === 'single_each' || exam.solveMode === 'SINGLE';                            return (
                                <div key={exam.attemptId} onClick={() => handleResumeExam(exam)} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '6px' }}>
                                                {exam.sessionName}
                                            </span>
                                            {/* 🔥 방식 태그 (OMR vs 한문제씩) 추가 */}
                                            <span style={{ 
                                                fontSize: '10px', fontWeight: 800, 
                                                color: isSingle ? '#7c3aed' : '#0284c7', 
                                                background: isSingle ? '#f3e8ff' : '#e0f2fe', 
                                                padding: '1px 6px', borderRadius: '6px' 
                                            }}>
                                                {isSingle ? '한문제씩' : 'OMR'}
                                            </span>
                                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{exam.categoryName}</h4>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                            진행률: <strong style={{ color: '#2563eb' }}>{exam.solvedCount}</strong> / {exam.totalCount} 문제
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', color: '#2563eb', fontSize: '13px', fontWeight: 700 }}>
                                        <span>이어풀기</span><ChevronRight size={18} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Award size={18} color="#10b981" />
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#1e293b' }}>풀했던 기출문제</h3>
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
                        {completedExams.map(exam => {
                                const isSingle = exam.solveMode === 'single_end' || exam.solveMode === 'single_each' || exam.solveMode === 'SINGLE';                            return (
                                <div key={exam.attemptId} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '6px' }}>
                                                    {exam.sessionName}
                                                </span>
                                                <span style={{ 
                                                    fontSize: '10px', fontWeight: 800, 
                                                    color: isSingle ? '#7c3aed' : '#0284c7', 
                                                    background: isSingle ? '#f3e8ff' : '#e0f2fe', 
                                                    padding: '1px 6px', borderRadius: '6px' 
                                                }}>
                                                    {isSingle ? '한문제씩' : 'OMR'}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{exam.categoryName}</h4>
                                        </div>
                                        {exam.isPassed ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}><CheckCircle2 size={14} /> 합격 ({exam.score}점)</div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}><XCircle size={14} /> 불합격 ({exam.score}점)</div>
                                        )}
                                    </div>

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
                                    <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '11px', color: '#94a3b8' }}>응시일자: {exam.completeDt}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}