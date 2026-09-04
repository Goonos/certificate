// src/routes/auth.js
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/oracle_db');
const router = express.Router();

const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID ;
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// 1. 카카오 로그인 리다이렉트
router.get('/kakao', (req, res) => {
    // 돌아갈 주소를 쿠키에 저장 (경로 제한을 풀기 위해 path: '/' 추가)
    const returnUrl = req.query.returnUrl || '/';
    res.cookie('return_url', returnUrl, { maxAge: 5 * 60 * 1000, httpOnly: true, path: '/' });

    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code`;
    res.redirect(kakaoAuthUrl);
});

// 2. 카카오 로그인 성공 후 (콜백)
router.get('/kakao/callback', async (req, res) => {
    try {
        const { code } = req.query;

        // 토큰 발급
        const tokenResponse = await axios.post('https://kauth.kakao.com/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: KAKAO_CLIENT_ID,
                redirect_uri: KAKAO_REDIRECT_URI,
                code: code,
            },
            headers: { 'Content-type': 'application/x-www-form-urlencoded;charset=utf-8' }
        });

        const accessToken = tokenResponse.data.access_token;

        // 유저 정보 가져오기
        const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const kakaoId = String(userResponse.data.id);
        const nickname = userResponse.data.properties?.nickname || '수험생';

        // 🔥 순수 MERGE 문으로 복원 (오라클 파싱 에러 원천 차단)
        const mergeSql = `
            MERGE INTO USERS U
            USING (SELECT :1 AS KAKAO_ID, :2 AS NICKNAME FROM DUAL) S
            ON (U.KAKAO_ID = S.KAKAO_ID)
            WHEN MATCHED THEN
                UPDATE SET U.NICKNAME = S.NICKNAME
            WHEN NOT MATCHED THEN
                INSERT (USER_ID, KAKAO_ID, NICKNAME, ROLE)
                VALUES (SEQ_USERS.NEXTVAL, S.KAKAO_ID, S.NICKNAME, 'USER')
        `;
        await executeQuery(mergeSql, [kakaoId, nickname]);

        // DB에서 저장된 유저 읽기
        const selectSql = `SELECT USER_ID, ROLE FROM USERS WHERE KAKAO_ID = :1`;
        const result = await executeQuery(selectSql, [kakaoId]);
        
        if (!result.rows || result.rows.length === 0) {
            throw new Error("DB에 유저 정보가 저장되지 않았습니다.");
        }
        const dbUser = result.rows[0];

        // JWT 세션 생성
        const token = jwt.sign(
            { userId: dbUser.USER_ID, kakaoId, nickname, role: dbUser.ROLE },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        // 🔥 [해결의 핵심] 브라우저가 절대 쿠키를 버리지 못하도록 가장 기본적이고 튼튼한 옵션만 적용
        res.cookie('cbt_token', token, {
            httpOnly: true,
            maxAge: 12 * 60 * 60 * 1000,
            path: '/'
        });

        // 사용한 임시 리턴 URL 쿠키를 꺼내고 삭제
        const returnUrl = req.cookies.return_url || '/';
        res.clearCookie('return_url', { path: '/' }); 

        // 🔥 원래 있던 프론트엔드 화면으로 복귀! (localhost 제거, 상대 경로 사용)
        res.redirect(returnUrl);

    } catch (err) {
        console.error("🚨 카카오 로그인 콜백 에러 발생! 원인:", err.message);
        // 🔥 에러가 났을 때 왜 튕겼는지 브라우저 주소창에 띄워줍니다! (찌꺼기 괄호 제거, 상대 경로 사용)
        res.redirect('/?error=login_failed');
    }
});

// 🛠️ [개발/로컬 테스트용] 마스터 계정 하이패스 로그인
router.get('/dev-login', async (req, res) => {
    // 운영 환경(production)에서는 무조건 403 차단
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).send("운영 환경에서는 사용할 수 없는 기능입니다.");
    }

    try {
        const masterKakaoId = 'master_admin_999';
        const nickname = '로컬마스터';

        // 1. DB에 마스터 계정 생성 또는 조회
        const mergeSql = `
            MERGE INTO USERS U
            USING (SELECT :1 AS KAKAO_ID, :2 AS NICKNAME FROM DUAL) S
            ON (U.KAKAO_ID = S.KAKAO_ID)
            WHEN MATCHED THEN
                UPDATE SET U.NICKNAME = S.NICKNAME
            WHEN NOT MATCHED THEN
                INSERT (USER_ID, KAKAO_ID, NICKNAME, ROLE)
                VALUES (NVL((SELECT MAX(USER_ID) FROM USERS), 0) + 1, S.KAKAO_ID, S.NICKNAME, 'ADMIN')
        `;
        await executeQuery(mergeSql, [masterKakaoId, nickname]);

        const selectSql = `SELECT USER_ID, ROLE FROM USERS WHERE KAKAO_ID = :1`;
        const result = await executeQuery(selectSql, [masterKakaoId]);
        const dbUser = result.rows[0];

        // 2. 카카오 없이 우리 서버가 직접 JWT 토큰 강제 발급
        const jwtSecret = process.env.JWT_SECRET || 'secret_cbt_key_1234';
        const token = jwt.sign(
            { userId: dbUser.USER_ID, kakaoId: masterKakaoId, nickname, role: dbUser.ROLE },
            jwtSecret,
            { expiresIn: '12h' }
        );

        // 3. 브라우저 쿠키에 강제로 굽기
        res.cookie('cbt_token', token, {
            httpOnly: true,
            maxAge: 12 * 60 * 60 * 1000,
            path: '/'
        });

        // 4. 로그인 성공 처리 후 프론트엔드 마이페이지로 귀환
        res.redirect('/mypage');

    } catch (err) {
        console.error("🚨 개발용 로그인 에러:", err);
        res.status(500).send("마스터 계정 로그인 실패");
    }
});
 
// 3. 내 정보 확인 (JWT 파싱)
router.get('/me', (req, res) => {
    const token = req.cookies.cbt_token;
    if (!token) return res.json({ isLoggedIn: false });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ isLoggedIn: true, user: decoded });
    } catch (err) {
        res.json({ isLoggedIn: false });
    }
});

// 4. 로그아웃
router.post('/logout', (req, res) => {
    res.clearCookie('cbt_token', { path: '/' });
    res.json({ success: true, message: "로그아웃 되었습니다." });
});

module.exports = router;