// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { initDbPool } = require('./config/oracle_db');
const mypageRoutes = require('./routes/mypage');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 공통 미들웨어 설정 (중복 제거 완료)
app.use(cors({
    origin: ['http://localhost:5173', 'http://자격증공부.com', 'https://자격증공부.com', 'http://www.자격증공부.com'],    
    credentials: true // 쿠키 주고받기 허용
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser()); // 🔥 JWT 토큰을 쿠키로 읽기 위해 필수!
app.use('/api/admin', require('./routes/admin'));

// 2. API 라우터 연결 (정적 파일 서빙보다 위에 있어야 빠름)
const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');

app.use('/api/auth', authRoutes); // 카카오 로그인용 라우터
app.use('/api/exam', examRoutes); // 기출문제용 라우터
app.use('/api/mypage', mypageRoutes); // 마이페이지용 라우터



// 5. 서버 시작 함수
async function startServer() {
    try {
        await initDbPool(); // 오라클 DB 풀 생성 대기
        app.listen(PORT, () => {
            console.log(`🔥 서버가 정상적으로 시작되었습니다: http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("❌ 서버 시작 중 에러 발생:", err);
    }
}

startServer();