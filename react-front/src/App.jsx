// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Home as HomeIcon, ChevronLeft, ChevronRight, User, Menu, X, LogOut, Clock, Award, ChevronRight as ArrowRight, MessageCircle } from 'lucide-react';

import Home from './pages/Home';
import CertExam from './pages/CertExam';
import ExamOmr from './pages/ExamOmr';
import ExamResult from './pages/ExamResult';
import MyPage from './pages/MyPage';
import SingleQuestion from './pages/SingleQuestion';
import SingleQuestionEach from './pages/SingleQuestionEach';
import AdminUpload from './pages/AdminUpload';
import ReactGA from "react-ga4";

export default function App() {
const navigate = useNavigate();
const location = useLocation();
const [isDrawerOpen, setIsDrawerOpen] = useState(false);
const [user, setUser] = useState({ isLoggedIn: false, nickname: '', role: '' });
const [myExamData, setMyExamData] = useState({ inProgressExams: [], completedExams: [] });

const handleCopyLink = () => {
    // 1. 현재 주소를 가져와서 강제로 한글로 디코딩 (외계어 해독)
    const decodedUrl = decodeURI(window.location.href);
    // 2. 사용자의 클립보드(복사통)에 한글 주소 찔러넣기
    navigator.clipboard.writeText(decodedUrl).then(() => {
    });
};

// 🔥 GA4 통계 추적 (Google Analytics 4)
// 🚀 1. 앱이 처음 켜질 때 GA 초기화
    useEffect(() => {
        // G- 로 시작하는 본인의 측정 ID를 넣으세요!
        ReactGA.initialize("G-QT5NP7Y1RW"); 
    }, []);

    // 🚀 2. 화면(location)이 바뀔 때마다 GA에 보고
    useEffect(() => {
        ReactGA.send({ 
            hitType: "pageview", 
            page: location.pathname, // 현재 보고 있는 리액트 화면 경로 (예: /mypage)
            title: location.pathname // 통계에 찍힐 이름
        });
    }, [location]);

// 🔥 시험 페이지들에서는 상단 접속 배너 숨기기
const isExamPage = location.pathname === '/exam-omr' || location.pathname === '/single-question' || location.pathname === '/single-question-each';
const isMyPage = location.pathname === '/mypage';

useEffect(() => {
        const handleContextMenu = (e) => e.preventDefault();
        
        const handleKeyDown = (e) => {
            if (
                e.keyCode === 123 || // F12
                (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I (개발자도구)
                (e.ctrlKey && e.shiftKey && e.keyCode === 67) || // Ctrl+Shift+C (요소검사)
                (e.ctrlKey && e.keyCode === 85) // Ctrl+U (소스보기)
            ) {
                e.preventDefault();
            }
        };

        // 배포 환경(production)일 때만 콘솔창 내용을 다 지워버림
        if (process.env.NODE_ENV === 'production') {
            console.log = () => {};
            console.error = () => {};
            console.warn = () => {};
        }

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

useEffect(() => {
fetch('/api/auth/me', { credentials: 'include' })
.then(res => res.json())
.then(data => {
if (data.isLoggedIn) {
setUser({
isLoggedIn: true,
nickname: data.user.nickname,
role: data.user.role
});
} else {
setUser({ isLoggedIn: false, nickname: '', role: '' });
}
})
.catch(err => {
setUser({ isLoggedIn: false, nickname: '', role: '' });
});
}, []);

useEffect(() => {
if (isDrawerOpen && user.isLoggedIn) {
fetch('/api/mypage', { credentials: 'include' })
.then(res => res.ok ? res.json() : null)
.then(data => {
if (data) {
setMyExamData({
inProgressExams: data.inProgressExams || [],
completedExams: data.completedExams || []
});
}
})
.catch(err => console.error("드로어 데이터 로드 실패:", err));
}
}, [isDrawerOpen, user.isLoggedIn]);

const navigateBack = () => navigate(-1);
const navigateForward = () => navigate(1);

const handleMyPageClick = () => {
navigate('/mypage');
setIsDrawerOpen(false);
};

const handleResumeExam = (exam) => {
setIsDrawerOpen(false); // 드로어 닫기
let targetRoute = '/exam-omr';
if (exam.solveMode === 'single_each') {
targetRoute = '/single-question-each';
} else if (exam.solveMode === 'single_end' || exam.solveMode === 'SINGLE') {
targetRoute = '/single-question';
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

const handleAuth = () => {
if (user.isLoggedIn) {
fetch('/api/auth/logout', { method: 'POST' })
.then(() => {
setUser({ isLoggedIn: false, nickname: '', role: '' });
setMyExamData({ inProgressExams: [], completedExams: [] });
setIsDrawerOpen(false);
navigate('/');
});
} else {
const returnUrl = encodeURIComponent(window.location.pathname);
window.location.href = `/api/auth/kakao?returnUrl=${returnUrl}`;
}
};

return (
<div className="mobile-shell">
<main className="main-content">
{user.isLoggedIn && !isExamPage && !isMyPage && (
<div id="userBanner" className="user-banner" style={{ display: 'flex' }}>
<div className="avatar" id="userAvatar">{user.nickname.charAt(0)}</div>
<div>
<div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>수험생 접속 완료</div>
<div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>{user.nickname} 님</div>
</div>
</div>
)}

<div className="safari-window">
<div className="safari-header">
<div className="safari-controls">
<button className="dot dot-red" aria-label="홈으로 이동" onClick={() => navigate('/')} title="홈">
<HomeIcon className="dot-icon" />
</button>
<button className="dot dot-yellow" aria-label="이전 페이지" onClick={navigateBack} title="이전">
<ChevronLeft className="dot-icon" />
</button>
<button className="dot dot-green" aria-label="다음 페이지" onClick={navigateForward} title="다음">
<ChevronRight className="dot-icon" />
</button>
</div>
<div className="safari-url-bar"><span className="url-text">자격증공부.com</span></div>
<div className="safari-actions">
<button className="icon-btn-sm" aria-label="마이페이지" onClick={handleMyPageClick}>
<User size={18} />
</button>
<button className="icon-btn-sm" aria-label="설정 메뉴" onClick={() => setIsDrawerOpen(true)}>
<Menu size={18} />
</button>
</div>
</div>

<Routes>
<Route path="/" element={<Home />} />
<Route path="/cert-exam" element={<CertExam />} />
<Route path="/exam-omr" element={<ExamOmr />} />
<Route path="/exam-result" element={<ExamResult />} />
<Route path="/mypage" element={<MyPage />} />
<Route path="/single-question" element={<SingleQuestion />} />
<Route path="/single-question-each" element={<SingleQuestionEach />} /> {/* 🔥 추가! */}
<Route path="/admin" element={<AdminUpload />} />
</Routes>
</div>
</main>

<div className={`drawer-overlay ${isDrawerOpen ? 'active' : ''}`} onClick={() => setIsDrawerOpen(false)}></div>
<aside className={`drawer ${isDrawerOpen ? 'active' : ''}`} style={{ overflowY: 'auto' }}>
<div style={{ paddingBottom: '20px' }}>
<div className="drawer-header">
<h2 style={{ fontSize: '18px', fontWeight: 700 }}>메뉴</h2>
<button className="icon-btn-sm" onClick={() => setIsDrawerOpen(false)}>
<X size={20} />
</button>
</div>

<ul className="drawer-menu-list">
<li className="drawer-menu-item" onClick={() => { navigate('/'); setIsDrawerOpen(false); }}>
<HomeIcon size={18} /> 홈으로 이동
</li>
<li className="drawer-menu-item" onClick={handleMyPageClick}>
<User size={18} /> 마이페이지
</li>
</ul>

{user.isLoggedIn && (
<div style={{ marginTop: '20px', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
<hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '0' }} />

<div>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
<Clock size={15} color="#2563eb" />
<span>풀고 있는 기출문제</span>
<span style={{ fontSize: '11px', color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '10px' }}>
{myExamData.inProgressExams.length}
</span>
</div>

{myExamData.inProgressExams.length === 0 ? (
<div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 4px' }}>진행 중인 기출문제가 없습니다.</div>
) : (
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
{myExamData.inProgressExams.map(exam => {
const isSingle = exam.solveMode === 'single_end' || exam.solveMode === 'single_each' || exam.solveMode === 'SINGLE';
return (
<div
key={exam.attemptId}
onClick={() => handleResumeExam(exam)}
style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontSize: '12px' }}
>
<div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
<span style={{
fontSize: '9px', fontWeight: 800,
color: isSingle ? '#7c3aed' : '#0284c7',
background: isSingle ? '#f3e8ff' : '#e0f2fe',
padding: '1px 4px', borderRadius: '4px'
}}>
{isSingle ? '한문제씩' : 'OMR'}
</span>
<span>{exam.categoryName} ({exam.sessionName})</span>
</div>
<ArrowRight size={14} color="#2563eb" />
</div>
<div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
진행률: {exam.solvedCount}/{exam.totalCount} 문제
</div>
</div>
);
})}
</div>
)}
</div>

<div>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
<Award size={15} color="#10b981" />
<span>풀었던 기출문제</span>
<span style={{ fontSize: '11px', color: '#16a34a', background: '#f0fdf4', padding: '1px 6px', borderRadius: '10px' }}>
{myExamData.completedExams.length}
</span>
</div>

{myExamData.completedExams.length === 0 ? (
<div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 4px' }}>완료된 기출문제가 없습니다.</div>
) : (
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
{myExamData.completedExams.map(exam => (
<div
key={exam.attemptId}
onClick={handleMyPageClick}
style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
>
<div>
<div style={{ fontWeight: 700, color: '#0f172a' }}>{exam.categoryName} ({exam.sessionName})</div>
<div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>점수: {exam.score}점</div>
</div>
<span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', background: exam.isPassed ? '#dcfce7' : '#fee2e2', color: exam.isPassed ? '#15803d' : '#b91c1c' }}>
{exam.isPassed ? '합격' : '불합격'}
</span>
</div>
))}
</div>
)}
</div>
</div>
)}
</div>

<button
className="drawer-menu-item"
style={{
background: user.isLoggedIn ? '#f1f5f9' : '#FEE500',
color: user.isLoggedIn ? '#64748b' : '#000000',
justifyContent: 'center',
marginTop: 'auto',
fontWeight: '800',
border: 'none',
padding: '16px'
}}
onClick={handleAuth}
>
{user.isLoggedIn ? (
<><LogOut size={18} /> 로그아웃</>
) : (
<><MessageCircle size={18} fill="#000000" color="#000000" /> 카카오톡 로그인</>
)}
</button>
</aside>
</div>
);
}