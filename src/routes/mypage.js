// src/routes/mypage.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/oracle_db');
const router = express.Router();

// 로그인 인증 미들웨어
const authenticateUser = (req, res, next) => {
    const token = req.cookies.cbt_token;
    if (!token) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }
    try {
        const jwtSecret = process.env.JWT_SECRET ;
        req.user = jwt.verify(token, jwtSecret);
        next();
    } catch (err) {
        return res.status(401).json({ error: "세션이 만료되었습니다." });
    }
};

// 마이페이지 전체 데이터 조회 API
router.get('/', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. 회원 정보 조회
        const userSql = `SELECT USER_ID, NICKNAME, ROLE FROM USERS WHERE USER_ID = :1`;
        const userRes = await executeQuery(userSql, [userId]);
        const userInfo = userRes.rows[0];

        // 🔥 2. 풀고 있는 기출문제 리스트 (SOLVE_MODE 추가)
        const inProgressSql = `
            SELECT A.ATTEMPT_ID, 
                   A.CATEGORY_ID, 
                   C.CATEGORY_NAME, 
                   A.EXAM_SESSION, 
                   A.TYPE_CODE, 
                   A.SOLVE_MODE,   -- 🔥 방식을 알기 위해 SOLVE_MODE 조회 추가
                   A.TOTAL_COUNT,
                   TO_CHAR(A.START_DT, 'YYYY-MM-DD HH24:MI') AS START_DT,
                   (SELECT COUNT(*) 
                    FROM USER_SOLVE_LOG L 
                    WHERE L.ATTEMPT_ID = A.ATTEMPT_ID AND L.SELECTED_ANSWER IS NOT NULL) AS SOLVED_COUNT
            FROM USER_EXAM_ATTEMPT A
            JOIN QUESTION_CATEGORY C ON A.CATEGORY_ID = C.CATEGORY_ID
            WHERE A.USER_ID = :1 AND A.STATUS = 'IN_PROGRESS'
            ORDER BY A.START_DT DESC
        `;
        const inProgressRes = await executeQuery(inProgressSql, [userId]);

        // 🔥 3. 풀었던 기출문제 리스트 (SOLVE_MODE 추가)
        const completedSql = `
            SELECT A.ATTEMPT_ID, 
                   A.CATEGORY_ID, 
                   C.CATEGORY_NAME, 
                   A.EXAM_SESSION, 
                   A.TYPE_CODE, 
                   A.SOLVE_MODE,   -- 🔥 방식을 알기 위해 SOLVE_MODE 조회 추가
                   A.SCORE, 
                   A.TOTAL_COUNT, 
                   A.CORRECT_COUNT,
                   TO_CHAR(A.COMPLETE_DT, 'YYYY-MM-DD HH24:MI') AS COMPLETE_DT
            FROM USER_EXAM_ATTEMPT A
            JOIN QUESTION_CATEGORY C ON A.CATEGORY_ID = C.CATEGORY_ID
            WHERE A.USER_ID = :1 AND A.STATUS = 'COMPLETED'
            ORDER BY A.COMPLETE_DT DESC
        `;
        const completedRes = await executeQuery(completedSql, [userId]);

        // 4. 풀었던 시험별 과목별 점수 상세 조회
        const completedList = [];
        for (const attempt of completedRes.rows) {
            const subjectScoreSql = `
                SELECT Q.SUBJECT_NO,
                       COUNT(*) AS TOTAL_Q,
                       SUM(CASE WHEN L.IS_CORRECT = 'Y' THEN 1 ELSE 0 END) AS CORRECT_Q
                FROM USER_SOLVE_LOG L
                JOIN EXAM_QUESTION Q ON L.QUESTION_ID = Q.QUESTION_ID
                WHERE L.ATTEMPT_ID = :1
                GROUP BY Q.SUBJECT_NO
                ORDER BY Q.SUBJECT_NO ASC
            `;
            const subjectRes = await executeQuery(subjectScoreSql, [attempt.ATTEMPT_ID]);

            let isPassed = true;
            let hasSubjectFail = false; 

            const subjectScores = subjectRes.rows.map(sub => {
                const score = sub.TOTAL_Q > 0 ? Math.round((sub.CORRECT_Q / sub.TOTAL_Q) * 100) : 0;
                if (score < 40) hasSubjectFail = true; 
                return {
                    subjectNo: sub.SUBJECT_NO,
                    score: score,
                    correctCount: sub.CORRECT_Q,
                    totalCount: sub.TOTAL_Q
                };
            });

            const overallScore = attempt.SCORE || 0;
            if (overallScore < 60 || hasSubjectFail) {
                isPassed = false;
            }

            completedList.push({
                attemptId: attempt.ATTEMPT_ID,
                categoryId: attempt.CATEGORY_ID,
                categoryName: attempt.CATEGORY_NAME,
                sessionName: attempt.EXAM_SESSION,
                typeCode: attempt.TYPE_CODE,
                solveMode: attempt.SOLVE_MODE || 'omr', // 🔥 추가된 solveMode 맵핑
                score: overallScore,
                isPassed: isPassed,
                hasSubjectFail: hasSubjectFail,
                completeDt: attempt.COMPLETE_DT,
                subjects: subjectScores
            });
        }

        // 5. 프론트엔드로 데이터 전송
        res.json({
            user: {
                userId: userInfo.USER_ID,
                nickname: userInfo.NICKNAME,
                role: userInfo.ROLE
            },
            inProgressExams: inProgressRes.rows.map(row => ({
                attemptId: row.ATTEMPT_ID,
                categoryId: row.CATEGORY_ID,
                categoryName: row.CATEGORY_NAME,
                sessionName: row.EXAM_SESSION,
                typeCode: row.TYPE_CODE,
                solveMode: row.SOLVE_MODE || 'omr', // 🔥 추가된 solveMode 맵핑
                solvedCount: row.SOLVED_COUNT,
                totalCount: row.TOTAL_COUNT,
                startDt: row.START_DT
            })),
            completedExams: completedList
        });

    } catch (err) {
        console.error("마이페이지 데이터 조회 에러:", err);
        res.status(500).json({ error: "마이페이지 정보를 불러오는 중 에러가 발생했습니다." });
    }
});

module.exports = router;