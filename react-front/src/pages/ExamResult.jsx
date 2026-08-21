import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Award, CheckCircle2, AlertCircle, ChevronRight, MessageCircle, XCircle, BookOpen } from 'lucide-react';
import HtmlContent from '../components/HtmlContent'; // 🔥 HtmlContent 임포트 복구

export default function ExamResult() {
    const location = useLocation();
    const navigate = useNavigate();
    
    const pendingData = JSON.parse(sessionStorage.getItem('pending_exam_result') || 'null');
    const { examInfo, questions, answers, elapsedTime, attemptId } = location.state || pendingData || {};

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [scoreData, setScoreData] = useState({ totalScore: 0, subjectStats: {} });
    const [isSyncing, setIsLoggedInSyncing] = useState(false);

    const isPracticalExam = examInfo?.typeCode === '02';

    // 💡 정답/오답 분류 데이터를 담을 상태
    const [reviewData, setReviewData] = useState({ correctQuestions: [], incorrectQuestions: [] });

    useEffect(() => {
        if (!questions) {
            alert("잘못된 접근입니다.");
            navigate('/cert-exam');
            return;
        }

        // 🔥 질문자님 원본 통계 로직 100% 복원
        let totalCorrect = 0;
        const stats = {};
        
        // 💡 리뷰용 배열
        const correctList = [];
        const incorrectList = [];

        questions.forEach(q => {
            // DB에 등록된 정답과 내 정답 비교
            const isCorrect = String(answers[q.qNo]) === String(q.answer);
            if (isCorrect) totalCorrect++;

            // 과목별 통계 분류 (원본 유지)
            const subNo = q.subjectNo || '1';
            const subName = q.subjectName || '과목';
            
            if (!stats[subNo]) {
                stats[subNo] = { name: subName, total: 0, correct: 0 };
            }
            stats[subNo].total++;
            if (isCorrect) stats[subNo].correct++;

            // 💡 정답/오답 리뷰용 데이터 가공
            const myAnswer = answers[q.qNo] !== undefined && answers[q.qNo] !== null ? String(answers[q.qNo]).trim() : '';
            const realAnswer = String(q.answer).trim();

            const myAnswerText = q.options && q.options.length > 0 && myAnswer && !isNaN(myAnswer) 
                ? `${myAnswer}번. ${q.options[Number(myAnswer) - 1] || ''}` 
                : (myAnswer || '미입력');
            
            const realAnswerText = q.options && q.options.length > 0 && realAnswer && !isNaN(realAnswer)
                ? `${realAnswer}번. ${q.options[Number(realAnswer) - 1] || ''}` 
                : realAnswer;

            const questionData = { ...q, myAnswerText, realAnswerText, isCorrect };

            if (isCorrect) correctList.push(questionData);
            else incorrectList.push(questionData);
        });

        // 총점 계산 (원본 유지)
        const totalScore = Math.round((totalCorrect / questions.length) * 100);
        setScoreData({ totalScore, subjectStats: stats });
        
        // 상태에 리뷰 데이터 저장
        setReviewData({ correctQuestions: correctList, incorrectQuestions: incorrectList });

        // 로그인 체크 및 DB 동기화 (원본 유지)
        fetch('/api/auth/me', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setIsLoggedIn(data.isLoggedIn);

                if (data.isLoggedIn && questions) {
                    setIsLoggedInSyncing(true);
                    
                    // 백엔드 전송 최적화 (원본 유지)
                    const optimizedQuestions = questions.map(q => ({ questionId: q.questionId || q.QUESTION_ID, qNo: q.qNo, answer: q.answer }));

                    fetch('/api/exam/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ attemptId, examInfo, questions: optimizedQuestions, answers }) 
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

    }, [questions, answers, navigate, attemptId, examInfo]);

    const handleKakaoLoginWithSave = () => {
        sessionStorage.setItem('pending_exam_result', JSON.stringify({
            examInfo, questions, answers, elapsedTime, attemptId
        }));
        const returnUrl = encodeURIComponent('/exam-result');
        window.location.href = `http://localhost:3000/api/auth/kakao?returnUrl=${returnUrl}`; // 🔥 원본 도메인 유지
    };

    if (!questions) return null;

    const isPassed = scoreData.totalScore >= 60;
    const hasMultipleSubjects = Object.keys(scoreData.subjectStats).length > 1;

    // 💡 개별 문제 리뷰 카드 컴포넌트
    const ReviewCard = ({ q }) => (
        <div style={{
            background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '16px',
            border: `1px solid ${q.isCorrect ? '#bbf7d0' : '#fecaca'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' }}>
                {q.isCorrect ? <CheckCircle2 color="#22c55e" size={20} style={{ flexShrink: 0, marginTop: '2px' }}/> : <XCircle color="#ef4444" size={20} style={{ flexShrink: 0, marginTop: '2px' }}/>}
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', lineHeight: '1.5' }}>
                    {q.qNo}. <span dangerouslySetInnerHTML={{ __html: q.title ? String(q.title).replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '' }} />
                </div>
            </div>

            {/* 🔥 지문 영역 HtmlContent로 통일 */}
            {q.passageText && (
                <HtmlContent content={q.passageText} type="passage" />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: q.isCorrect ? '#f0fdf4' : '#fef2f2', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
                {!q.isCorrect && (
                    <div style={{ color: '#b91c1c' }}>
                        <strong style={{ display: 'inline-block', width: '60px' }}>내 답안:</strong> 
                        <span style={{ textDecoration: 'line-through', opacity: 0.8 }}>{q.myAnswerText}</span>
                    </div>
                )}
                <div style={{ color: '#15803d', fontWeight: q.isCorrect ? 'bold' : 'normal' }}>
                    <strong style={{ display: 'inline-block', width: '60px' }}>정답:</strong> {q.realAnswerText}
                </div>
            </div>

            {/* 🔥 해설 영역 HtmlContent로 통일 */}
            {q.explanationText && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0', fontSize: '13.5px', color: '#334155', lineHeight: '1.6' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0f172a', marginBottom: '6px' }}>
                        <BookOpen size={14} color="#3b82f6" /> 문제 해설
                    </strong>
                    <HtmlContent content={q.explanationText} type="explanation" />
                </div>
            )}
        </div>
    );

    return (
        <div className="safari-body" style={{ padding: '20px', paddingBottom: '40px', height: '100%', overflowY: 'auto' }}>
            
            {/* 1. 상단 정보 (원본 유지 - 필기/실기 텍스트 제거 포함) */}
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>
                    {examInfo?.sessionName}
                </span>
                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
                    {examInfo?.categoryName}
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    소요 시간: {Math.floor((elapsedTime || 0) / 60)}분 {(elapsedTime || 0) % 60}초
                </p>
            </div>

            {/* 2. 최종 점수 배너 (원본 유지) */}
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

            {/* 3. 과목별 통계 (원본 100% 복원!) */}
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

            {/* 🔥 [이동됨] 로그인 유도 및 마이페이지 이동 (점수 통계 직후 위치 원본 복원!) */}
            <div style={{ marginBottom: '32px' }}>
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

            {/* 🔥 4. 오답 노트 (틀린 문제) 영역 (리뷰 컴포넌트!) 🔥 */}
            {reviewData.incorrectQuestions.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #fee2e2', paddingBottom: '10px' }}>
                        <XCircle size={20} /> 틀린 문제 리뷰 ({reviewData.incorrectQuestions.length}개)
                    </h3>
                    {reviewData.incorrectQuestions.map(q => <ReviewCard key={`incorrect-${q.qNo}`} q={q} />)}
                </div>
            )}

            {/* 🔥 5. 정답 노트 (맞춘 문제) 영역 (리뷰 컴포넌트!) 🔥 */}
            {reviewData.correctQuestions.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #dcfce3', paddingBottom: '10px' }}>
                        <CheckCircle2 size={20} /> 맞춘 문제 리뷰 ({reviewData.correctQuestions.length}개)
                    </h3>
                    {reviewData.correctQuestions.map(q => <ReviewCard key={`correct-${q.qNo}`} q={q} />)}
                </div>
            )}
            
        </div>
    );
}