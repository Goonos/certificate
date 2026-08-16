// src/pages/ExamResult.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Award, CheckCircle2, AlertCircle, ChevronRight, MessageCircle } from 'lucide-react';

export default function ExamResult() {
    const location = useLocation();
    const navigate = useNavigate();
    
    const pendingData = JSON.parse(sessionStorage.getItem('pending_exam_result') || 'null');
    // 🔥 attemptId를 location.state나 pendingData에서 확실하게 뽑아옵니다!
    const { examInfo, questions, answers, elapsedTime, attemptId } = location.state || pendingData || {};

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [scoreData, setScoreData] = useState({ totalScore: 0, subjectStats: {} });
    const [isSyncing, setIsLoggedInSyncing] = useState(false);

    const isPracticalExam = examInfo?.typeCode === '02';

    useEffect(() => {
        if (!questions) {
            alert("잘못된 접근입니다.");
            navigate('/cert-exam');
            return;
        }

        let totalCorrect = 0;
        const stats = {};

        questions.forEach(q => {
            const isCorrect = String(answers[q.qNo]) === String(q.answer);
            if (isCorrect) totalCorrect++;

            const subNo = q.subjectNo || '1';
            const subName = q.subjectName || '과목';
            
            if (!stats[subNo]) {
                stats[subNo] = { name: subName, total: 0, correct: 0 };
            }
            stats[subNo].total++;
            if (isCorrect) stats[subNo].correct++;
        });

        const totalScore = Math.round((totalCorrect / questions.length) * 100);
        setScoreData({ totalScore, subjectStats: stats });

        fetch('/api/auth/me', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setIsLoggedIn(data.isLoggedIn);

                if (data.isLoggedIn && questions) {
                    setIsLoggedInSyncing(true);
                    
                    // 🔥 백엔드에 attemptId를 무조건 같이 보냅니다! (기존 데이터 덮어쓰기)
                    fetch('/api/exam/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ attemptId, examInfo, questions, answers }) 
                    })
                    .then(res => res.json())
                    .then(resData => {
                        if (resData.success) {
                            sessionStorage.removeItem('pending_exam_result');
                        }
                    })
                    .catch(err => console.error("DB 동기화 실패:", err))
                    .finally(() => setIsLoggedInSyncing(false));
                }
            })
            .catch(() => setIsLoggedIn(false));

    }, [questions, answers, navigate, attemptId]);

    const handleKakaoLoginWithSave = () => {
        // 임시 보관함에 attemptId도 같이 챙겨 넣습니다!
        sessionStorage.setItem('pending_exam_result', JSON.stringify({
            examInfo, questions, answers, elapsedTime, attemptId
        }));
        const returnUrl = encodeURIComponent('/exam-result');
        window.location.href = `http://localhost:3000/api/auth/kakao?returnUrl=${returnUrl}`;
    };

    if (!questions) return null;

    const isPassed = scoreData.totalScore >= 60;
    const hasMultipleSubjects = Object.keys(scoreData.subjectStats).length > 1;

    return (
        <div className="safari-body" style={{ padding: '20px', paddingBottom: '40px', height: '100%', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>
                    {examInfo?.sessionName} {isPracticalExam ? '(실기)' : '(필기)'}
                </span>
                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
                    {examInfo?.categoryName}
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    소요 시간: {Math.floor((elapsedTime || 0) / 60)}분 {(elapsedTime || 0) % 60}초
                </p>
            </div>

            <div style={{
                background: isPassed ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                borderRadius: '20px', padding: '30px 20px', color: 'white', textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginBottom: '24px'
            }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.2)', width: '50px', height: '50px', borderRadius: '50%', marginBottom: '10px' }}>
                    <Award size={28} color="white" />
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, opacity: 0.9 }}>최종 점수</div>
                <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-1px' }}>
                    {scoreData.totalScore}<span style={{ fontSize: '24px', fontWeight: 600 }}>점</span>
                </div>
                <div style={{ marginTop: '10px', fontSize: '15px', fontWeight: 800, background: 'rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: '20px', display: 'inline-block' }}>
                    {isPassed ? '🎉 합격권입니다!' : '💪 조금 더 분발해 볼까요?'}
                </div>
            </div>

            {!isPracticalExam && hasMultipleSubjects && (
                <>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', color: '#1e293b' }}>과목별 분석</h3>
                    <div style={{ display: 'grid', gap: '10px', marginBottom: '32px' }}>
                        {Object.keys(scoreData.subjectStats).map(subNo => {
                            const stat = scoreData.subjectStats[subNo];
                            const subScore = Math.round((stat.correct / stat.total) * 100);
                            const isFail = subScore < 40;

                            return (
                                <div key={subNo} style={{
                                    background: '#ffffff', border: isFail ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                                    borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>{subNo}과목</div>
                                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{stat.name}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '18px', fontWeight: 800, color: isFail ? '#ef4444' : '#2563eb' }}>
                                            {subScore}점
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            {stat.correct} / {stat.total} 문항
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {isLoggedIn ? (
                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '20px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 10px' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
                        {isSyncing ? "DB에 결과를 저장하는 중..." : "기록이 DB에 안전하게 저장되었습니다!"}
                    </h4>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>마이페이지에서 누적 기출문제 풀이 기록을 확인해 보세요.</p>
                    <button 
                        onClick={() => navigate('/mypage')}
                        disabled={isSyncing}
                        style={{ width: '100%', padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', opacity: isSyncing ? 0.6 : 1 }}
                    >
                        마이페이지로 이동 <ChevronRight size={18} />
                    </button>
                </div>
            ) : (
                <div style={{ background: '#fffbeb', borderRadius: '16px', padding: '20px', textAlign: 'center', border: '1px solid #fde68a' }}>
                    <AlertCircle size={32} color="#d97706" style={{ margin: '0 auto 10px' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 6px 0', color: '#92400e' }}>앗! 로그인하지 않아 기록이 날아갑니다.</h4>
                    <p style={{ fontSize: '12px', color: '#b45309', margin: '0 0 16px 0', lineHeight: '1.4' }}>
                        지금 카카오로 로그인하면 방금 푼 점수와<br/>풀이 기록을 마이페이지에 자동으로 보관해 드려요!
                    </p>
                    <button 
                        onClick={handleKakaoLoginWithSave}
                        style={{ width: '100%', padding: '14px', background: '#FEE500', color: '#000000', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                        <MessageCircle size={18} fill="#000000" />
                        카카오로 3초 만에 시작하고 기록 보관
                    </button>
                    <button 
                        onClick={() => navigate('/')}
                        style={{ width: '100%', padding: '14px', background: 'transparent', color: '#94a3b8', border: 'none', fontWeight: 700, fontSize: '13px', marginTop: '4px', cursor: 'pointer' }}
                    >
                        기록 버리고 홈으로 가기
                    </button>
                </div>
            )}
        </div>
    );
}