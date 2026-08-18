// src/routes/exam.js
const express = require('express');
const { executeQuery } = require('../config/oracle_db');
const router = express.Router();
const jwt = require('jsonwebtoken');

// 로그인 인증 미들웨어
const authenticateUser = (req, res, next) => {
    const token = req.cookies.cbt_token;
    if (!token) return res.status(401).json({ error: "로그인이 필요합니다." });
    try {
        const jwtSecret = process.env.JWT_SECRET ;
        req.user = jwt.verify(token, jwtSecret);
        next();
    } catch (err) {
        return res.status(401).json({ error: "세션이 만료되었습니다." });
    }
};

// ==========================================
// 1. 공통 정보 조회 (종목, 회차, 모달 셋업)
// ==========================================

router.get('/categories', async (req, res) => {
    try {
        const sql = `
            SELECT C.CATEGORY_ID, C.CATEGORY_NAME, 
                   E.EXAM_TYPE_CODE, E.EXAM_TYPE_NAME, E.UI_ROUTE_URL
            FROM QUESTION_CATEGORY C
            LEFT JOIN CATEGORY_EXAM_TYPE E ON C.CATEGORY_ID = E.CATEGORY_ID
            ORDER BY C.CATEGORY_ID ASC, E.EXAM_TYPE_CODE ASC
        `;
        const result = await executeQuery(sql);

        const categoriesMap = {};
        result.rows.forEach(row => {
            const catId = row.CATEGORY_ID;
            if (!categoriesMap[catId]) {
                categoriesMap[catId] = { id: catId, name: row.CATEGORY_NAME, types: [] };
            }
            if (row.EXAM_TYPE_CODE) {
                categoriesMap[catId].types.push({ code: row.EXAM_TYPE_CODE, name: row.EXAM_TYPE_NAME, url: row.UI_ROUTE_URL });
            }
        });

        res.json(Object.values(categoriesMap));
    } catch (err) {
        res.status(500).json({ error: "종목 목록을 불러오는 중 에러가 발생했습니다." });
    }
});

router.get('/sessions', async (req, res) => {
    try {
        const { categoryId, typeCode } = req.query;
        const sql = `
            SELECT DISTINCT EXAM_SESSION 
            FROM EXAM_QUESTION 
            WHERE CATEGORY_ID = :1 AND QUESTION_TYPE = :2
            ORDER BY EXAM_SESSION DESC
        `;
        const result = await executeQuery(sql, [categoryId, typeCode]);
        res.json(result.rows.map(row => ({ id: row.EXAM_SESSION, name: row.EXAM_SESSION })));
    } catch (err) {
        res.status(500).json({ error: "회차 목록을 불러오는 중 에러가 발생했습니다." });
    }
});

// 🔥 [복원] 모달창 데이터 세팅 API (과목, 회차)
router.get('/setup-info/:categoryId', async (req, res) => {
    const { categoryId } = req.params;
    try {
        const subjectSql = `SELECT SUBJECT_NO, SUBJECT_NAME FROM EXAM_SUBJECT WHERE CATEGORY_ID = :1 ORDER BY SUBJECT_NO ASC`;
        const subjectsResult = await executeQuery(subjectSql, [categoryId]);

        const sessionSql = `SELECT DISTINCT EXAM_SESSION FROM EXAM_QUESTION WHERE CATEGORY_ID = :1 ORDER BY EXAM_SESSION DESC`;
        const sessionsResult = await executeQuery(sessionSql, [categoryId]);

        res.json({
            subjects: subjectsResult.rows,
            sessions: sessionsResult.rows.map(r => r.EXAM_SESSION)
        });
    } catch (err) {
        console.error("설정 정보 조회 에러:", err);
        res.status(500).json({ error: "과목 및 회차 정보를 불러오지 못했습니다." });
    }
});


// ==========================================
// 2. 기출문제 풀기 (OMR 모드 & 한문제씩 풀기)
// ==========================================

router.get('/questions', async (req, res) => {
    try {
        const { categoryId, typeCode, session } = req.query;

        if (!categoryId || !typeCode || !session) return res.status(400).json({ error: "필수 파라미터 누락" });

        const sql = `
            SELECT Q.QUESTION_ID, NVL(Q.SUBJECT_NO, 1) AS SUBJECT_NO, TO_CHAR(S.SUBJECT_NAME) AS SUBJECT_NAME, 
                   Q.QUESTION_NO, TO_CHAR(Q.PASSAGE_TEXT) AS PASSAGE_TEXT, TO_CHAR(Q.QUESTION_TEXT) AS QUESTION_TEXT, 
                   Q.QUESTION_TYPE, TO_CHAR(Q.EXPLANATION_TEXT) AS EXPLANATION_TEXT, TO_CHAR(Q.ANSWER_TEXT) AS ANSWER_TEXT,
                   O.OPTION_NO, TO_CHAR(O.OPTION_TEXT) AS OPTION_TEXT
            FROM EXAM_QUESTION Q
            LEFT JOIN EXAM_SUBJECT S ON TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(S.CATEGORY_ID) AND NVL(Q.SUBJECT_NO, 1) = S.SUBJECT_NO
            LEFT JOIN QUESTION_OPTIONS O ON Q.QUESTION_ID = O.QUESTION_ID
            WHERE TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(:1) AND Q.QUESTION_TYPE = :2 AND Q.EXAM_SESSION = :3
            ORDER BY NVL(Q.SUBJECT_NO, 1) ASC, Q.QUESTION_NO ASC, O.OPTION_NO ASC
        `;
        
        const result = await executeQuery(sql, [categoryId, typeCode, session]);
        const questionsArr = [];
        let currentQuestion = null;

        result.rows.forEach(row => {
            if (!currentQuestion || currentQuestion.questionId !== row.QUESTION_ID) {
                currentQuestion = {
                    questionId: row.QUESTION_ID, subjectNo: row.SUBJECT_NO, subjectName: row.SUBJECT_NAME || '',
                    qNo: row.QUESTION_NO, passageText: row.PASSAGE_TEXT, title: row.QUESTION_TEXT,
                    questionType: row.QUESTION_TYPE, explanationText: row.EXPLANATION_TEXT, answer: row.ANSWER_TEXT, options: []
                };
                questionsArr.push(currentQuestion);
            }
            if (row.OPTION_NO) currentQuestion.options.push(row.OPTION_TEXT);
        });

        res.json(questionsArr); 
    } catch (err) {
        res.status(500).json({ error: "문제를 불러오는 중 에러가 발생했습니다." });
    }
});

// 🔥 한문제씩 풀기 전용 동적 문제 조회 API (랜덤 20문제 로직 추가)
router.post('/questions/single-mode', async (req, res) => {
    const { categoryId, typeCode, subjectNos, modeType, examSession, startSession, endSession, limit = 20 } = req.body;

    try {
        // 1. 기본 쿼리 (TO_CHAR로 타입 변환 안전하게 적용)
        let sql = `
            SELECT Q.QUESTION_ID, Q.CATEGORY_ID, S.SUBJECT_NAME, Q.SUBJECT_NO, 
            Q.EXAM_SESSION, Q.QUESTION_NO, 
            TO_CHAR(Q.PASSAGE_TEXT) AS PASSAGE_TEXT,   /* 🔥 여기 수정 */
            TO_CHAR(Q.QUESTION_TEXT) AS QUESTION_TEXT, /* 🔥 여기 수정 */
            Q.QUESTION_TYPE, TO_CHAR(Q.ANSWER_TEXT) AS ANSWER_TEXT, TO_CHAR(Q.EXPLANATION_TEXT) AS EXPLANATION_TEXT
            FROM EXAM_QUESTION Q
            LEFT JOIN EXAM_SUBJECT S ON TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(S.CATEGORY_ID) AND NVL(Q.SUBJECT_NO, 1) = S.SUBJECT_NO
            WHERE TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(:categoryId) AND Q.QUESTION_TYPE = :typeCode
            `;
        
        let bindParams = { categoryId, typeCode };

        // 2. 모드에 따른 쿼리 분기
        if (modeType === 'RANDOM_20') {
            // 🔥 [수정 포인트] 랜덤 20제는 과목 검사를 하지 않고 지정 회차에서 바로 랜덤 추출
            sql += ` AND Q.EXAM_SESSION = :examSession`;
            bindParams.examSession = examSession;

            sql = `
                SELECT * FROM (
                    ${sql}
                    ORDER BY DBMS_RANDOM.VALUE
                ) WHERE ROWNUM <= :limitCount
            `;
            bindParams.limitCount = parseInt(limit, 10);
            
        } else {
            // 기존 모드들 (지정 회차, 범위 랜덤) - 여기서는 기존처럼 과목 필수 검사 수행
            if (typeCode !== '02' && (!subjectNos || subjectNos.length === 0)) {
                return res.status(400).json({ error: "최소 하나 이상의 과목을 선택해 주세요." });
            }

            if (typeCode !== '02' && subjectNos && subjectNos.length > 0) {
                const subjectBinds = {};
                const subjectPlaceholders = subjectNos.map((no, idx) => {
                    const key = `s${idx}`;
                    subjectBinds[key] = no;
                    return `:${key}`;
                }).join(', ');
                sql += ` AND Q.SUBJECT_NO IN (${subjectPlaceholders})`;
                Object.assign(bindParams, subjectBinds);
            }

            if (modeType === 'DESIGNATED') {
                sql += ` AND Q.EXAM_SESSION = :examSession ORDER BY Q.SUBJECT_NO ASC, Q.QUESTION_NO ASC`;
                bindParams.examSession = examSession;
            } else if (modeType === 'RANGE') {
                sql += ` AND Q.EXAM_SESSION BETWEEN :startSession AND :endSession`;
                bindParams.startSession = startSession;
                bindParams.endSession = endSession;

                sql = `
                    SELECT * FROM (
                        ${sql}
                        ORDER BY DBMS_RANDOM.VALUE
                    ) WHERE ROWNUM <= :limitCount
                `;
                bindParams.limitCount = parseInt(limit, 10);
            }
        }

        const result = await executeQuery(sql, bindParams);
        let questions = result.rows;

        // 3. 객관식 옵션 병합 (기존 동일)
        if (questions.length > 0) {
            const qIds = questions.map(q => q.QUESTION_ID);
            const optBinds = {};
            const optPlaceholders = qIds.map((id, idx) => {
                optBinds[`q${idx}`] = id;
                return `:q${idx}`;
            }).join(', ');

            const optSql = `
                SELECT QUESTION_ID, OPTION_NO, TO_CHAR(OPTION_TEXT) AS OPTION_TEXT 
                FROM QUESTION_OPTIONS 
                WHERE QUESTION_ID IN (${optPlaceholders}) 
                ORDER BY QUESTION_ID, OPTION_NO ASC
            `;
            const optResult = await executeQuery(optSql, optBinds);

            questions = questions.map(q => {
                return {
                    ...q,
                    qNo: q.QUESTION_NO,
                    title: q.QUESTION_TEXT,
                    passageText: q.PASSAGE_TEXT,
                    questionType: q.QUESTION_TYPE,
                    answer: q.ANSWER_TEXT,
                    explanationText: q.EXPLANATION_TEXT,
                    options: optResult.rows
                        .filter(opt => opt.QUESTION_ID === q.QUESTION_ID)
                        .map(opt => opt.OPTION_TEXT)
                };
            });
        }

        res.json({ total: questions.length, questions: questions });

    } catch (err) {
        console.error("한문제씩 풀기 문제 조회 에러:", err);
        res.status(500).json({ error: "문제를 불러오는 중 에러가 발생했습니다." });
    }
});


// ==========================================
// 3. 기록 저장, 이어풀기, 제출 및 채점
// ==========================================

router.get('/progress/:attemptId', authenticateUser, async (req, res) => {
    try {
        const attemptId = req.params.attemptId;
        const sql = `
            SELECT Q.QUESTION_NO, TO_CHAR(L.SELECTED_ANSWER) AS SELECTED_ANSWER
            FROM USER_SOLVE_LOG L
            JOIN EXAM_QUESTION Q ON TO_CHAR(L.QUESTION_ID) = TO_CHAR(Q.QUESTION_ID)
            WHERE L.ATTEMPT_ID = :1 AND L.USER_ID = :2
        `;
        const result = await executeQuery(sql, [attemptId, req.user.userId]);
        const savedAnswers = {};
        
        result.rows.forEach(row => {
            if (row.SELECTED_ANSWER !== null && row.SELECTED_ANSWER !== undefined) {
                const val = String(row.SELECTED_ANSWER).trim();
                savedAnswers[row.QUESTION_NO] = (!isNaN(val) && val !== '') ? Number(val) : val;
            }
        });

        res.json({ answers: savedAnswers });
    } catch (err) {
        console.error("진행 내역 조회 에러:", err);
        res.status(500).json({ error: "진행 내역을 불러오지 못했습니다." });
    }
});

router.post('/save-progress', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        let { attemptId, examInfo, questions, answers } = req.body;
        const solveMode = examInfo.solveMode || 'omr';

        if (!attemptId) {
            const seqRes = await executeQuery(`SELECT SEQ_USER_EXAM_ATTEMPT.NEXTVAL AS ID FROM DUAL`);
            attemptId = seqRes.rows[0].ID;
            const insertAttemptSql = `
                BEGIN
                    INSERT INTO USER_EXAM_ATTEMPT (ATTEMPT_ID, USER_ID, CATEGORY_ID, EXAM_SESSION, TYPE_CODE, SOLVE_MODE, STATUS, TOTAL_COUNT, START_DT)
                    VALUES (:1, :2, :3, :4, :5, :6, 'IN_PROGRESS', :7, SYSDATE);
                    COMMIT;
                END;
            `;
                await executeQuery(insertAttemptSql, [
                    attemptId, 
                    userId, 
                    examInfo.categoryId, 
                    examInfo.sessionName || '지정/랜덤 모의고사', // 🔥 핵심: 비어있으면 기본값 텍스트 삽입!
                    examInfo.typeCode || '01', 
                    solveMode, 
                    questions.length
                ]);        
            } else {
            const updateAttemptSql = `
                BEGIN
                    UPDATE USER_EXAM_ATTEMPT 
                    SET STATUS = 'IN_PROGRESS', SOLVE_MODE = NVL(:1, SOLVE_MODE), START_DT = NVL(START_DT, SYSDATE) 
                    WHERE ATTEMPT_ID = :2 AND USER_ID = :3;
                    COMMIT;
                END;
            `;
            await executeQuery(updateAttemptSql, [solveMode, attemptId, userId]);
        }

        for (const q of questions) {
            // 🔥 [핵심 수정] 소문자(OMR), 대문자(한문제씩) 모두 호환되도록 완벽 커버!
            const questionId = q.questionId || q.QUESTION_ID || q.qNo; 
            const selectedAns = answers[q.qNo] ? String(answers[q.qNo]) : null;
            const isCorrect = selectedAns ? (String(q.answer) === selectedAns ? 'Y' : 'N') : null;

            const mergeLogSql = `
                BEGIN
                    MERGE INTO USER_SOLVE_LOG L
                    USING (SELECT :1 AS ATTEMPT_ID, :2 AS QUESTION_ID FROM DUAL) T
                    ON (L.ATTEMPT_ID = T.ATTEMPT_ID AND L.QUESTION_ID = T.QUESTION_ID)
                    WHEN MATCHED THEN
                        UPDATE SET L.SELECTED_ANSWER = :3, L.IS_CORRECT = :4, L.SOLVE_DT = SYSDATE
                    WHEN NOT MATCHED THEN
                        INSERT (SOLVE_LOG_ID, ATTEMPT_ID, USER_ID, QUESTION_ID, SELECTED_ANSWER, IS_CORRECT, SOLVE_DT)
                        VALUES (SEQ_USER_SOLVE_LOG.NEXTVAL, :1, :5, :2, :3, :4, SYSDATE);
                    COMMIT;
                END;
            `;
            await executeQuery(mergeLogSql, [attemptId, questionId, selectedAns, isCorrect, userId]);
        }

        res.json({ success: true, attemptId });
    } catch (err) {
        console.error("임시저장 에러:", err);
        res.status(500).json({ error: "임시저장 중 오류가 발생했습니다." });
    }
});

// 2. /save-progress 끝나는 곳 바로 아래에 이어풀기 전용 API를 추가합니다.
router.get('/questions/resume/:attemptId', authenticateUser, async (req, res) => {
    try {
        const attemptId = req.params.attemptId;
        const userId = req.user.userId;

        const sql = `
            SELECT Q.QUESTION_ID, Q.CATEGORY_ID, S.SUBJECT_NAME, Q.SUBJECT_NO, 
            Q.EXAM_SESSION, Q.QUESTION_NO, 
            TO_CHAR(Q.PASSAGE_TEXT) AS PASSAGE_TEXT,   /* 🔥 여기 수정 */
            TO_CHAR(Q.QUESTION_TEXT) AS QUESTION_TEXT, /* 🔥 여기 수정 */
            Q.QUESTION_TYPE, TO_CHAR(Q.ANSWER_TEXT) AS ANSWER_TEXT, TO_CHAR(Q.EXPLANATION_TEXT) AS EXPLANATION_TEXT
            FROM USER_SOLVE_LOG L
            JOIN EXAM_QUESTION Q ON L.QUESTION_ID = Q.QUESTION_ID
            LEFT JOIN EXAM_SUBJECT S ON TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(S.CATEGORY_ID) AND NVL(Q.SUBJECT_NO, 1) = S.SUBJECT_NO
            WHERE L.ATTEMPT_ID = :1 AND L.USER_ID = :2
            ORDER BY L.SOLVE_LOG_ID ASC
            `;
        const result = await executeQuery(sql, [attemptId, userId]);
        let questions = result.rows;

        if (questions.length > 0) {
            const qIds = questions.map(q => q.QUESTION_ID);
            const optBinds = {};
            const optPlaceholders = qIds.map((id, idx) => {
                optBinds[`q${idx}`] = id;
                return `:q${idx}`;
            }).join(', ');

            const optSql = `
                SELECT QUESTION_ID, OPTION_NO, TO_CHAR(OPTION_TEXT) AS OPTION_TEXT 
                FROM QUESTION_OPTIONS 
                WHERE QUESTION_ID IN (${optPlaceholders}) 
                ORDER BY QUESTION_ID, OPTION_NO ASC
            `;
            const optResult = await executeQuery(optSql, optBinds);

            questions = questions.map(q => {
                return {
                    ...q,
                    questionId: q.QUESTION_ID, // 🔥 프론트가 정확히 인식할 수 있도록 소문자로 확실히 매핑!
                    qNo: q.QUESTION_NO,
                    title: q.QUESTION_TEXT,
                    passageText: q.PASSAGE_TEXT,
                    questionType: q.QUESTION_TYPE,
                    answer: q.ANSWER_TEXT,
                    explanationText: q.EXPLANATION_TEXT,
                    options: optResult.rows
                        .filter(opt => opt.QUESTION_ID === q.QUESTION_ID)
                        .map(opt => opt.OPTION_TEXT)
                };
            });
        }

        res.json({ questions: questions });
    } catch (err) {
        console.error("이어풀기 문제 로드 에러:", err);
        res.status(500).json({ error: "이어풀기 문제를 불러오는 중 에러가 발생했습니다." });
    }
});

router.post('/submit', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { attemptId: existingAttemptId, examInfo, questions, answers } = req.body;
        
        let correctCount = 0;
        const solveLogs = [];

        questions.forEach(q => {
            const selectedAns = answers[q.qNo] ? String(answers[q.qNo]) : null;
            const isCorrect = String(selectedAns) === String(q.answer) ? 'Y' : 'N';
            if (isCorrect === 'Y') correctCount++;
            
            // 🔥 여기도 동일하게 문제 번호 매핑 보완
            solveLogs.push({ questionId: q.questionId || q.QUESTION_ID || q.qNo, selectedAnswer: selectedAns, isCorrect: isCorrect });
        });

        const totalCount = questions.length;
        const score = Math.round((correctCount / totalCount) * 100);
        let attemptId = existingAttemptId;

        if (attemptId) {
            const updateAttemptSql = `
                BEGIN
                    UPDATE USER_EXAM_ATTEMPT 
                    SET STATUS='COMPLETED', SCORE=:1, CORRECT_COUNT=:2, COMPLETE_DT=SYSDATE 
                    WHERE ATTEMPT_ID=:3 AND USER_ID=:4;
                    COMMIT;
                END;
            `;
            await executeQuery(updateAttemptSql, [score, correctCount, attemptId, userId]);
        } else {
            const seqRes = await executeQuery(`SELECT SEQ_USER_EXAM_ATTEMPT.NEXTVAL AS ID FROM DUAL`);
            attemptId = seqRes.rows[0].ID;
            const solveMode = examInfo.solveMode || 'omr';
            const insertAttemptSql = `
                BEGIN
                    INSERT INTO USER_EXAM_ATTEMPT (ATTEMPT_ID, USER_ID, CATEGORY_ID, EXAM_SESSION, TYPE_CODE, SOLVE_MODE, STATUS, SCORE, TOTAL_COUNT, CORRECT_COUNT, START_DT, COMPLETE_DT) 
                    VALUES (:1, :2, :3, :4, :5, :6, 'COMPLETED', :7, :8, :9, SYSDATE, SYSDATE);
                    COMMIT;
                END;
            `;
            await executeQuery(insertAttemptSql, [
                attemptId, 
                userId, 
                examInfo.categoryId, 
                examInfo.sessionName || '지정/랜덤 모의고사', // 🔥 여기도 동일하게 추가!
                examInfo.typeCode || '01', 
                solveMode, 
                score, 
                totalCount, 
                correctCount
            ]);        
        }

        for (const log of solveLogs) {
            const mergeLogSql = `
                BEGIN
                    MERGE INTO USER_SOLVE_LOG L
                    USING (SELECT :1 AS ATTEMPT_ID, :2 AS QUESTION_ID FROM DUAL) T
                    ON (L.ATTEMPT_ID = T.ATTEMPT_ID AND L.QUESTION_ID = T.QUESTION_ID)
                    WHEN MATCHED THEN 
                        UPDATE SET L.SELECTED_ANSWER = :3, L.IS_CORRECT = :4, L.SOLVE_DT = SYSDATE
                    WHEN NOT MATCHED THEN 
                        INSERT (SOLVE_LOG_ID, ATTEMPT_ID, USER_ID, QUESTION_ID, SELECTED_ANSWER, IS_CORRECT, SOLVE_DT) 
                        VALUES (SEQ_USER_SOLVE_LOG.NEXTVAL, :1, :5, :2, :3, :4, SYSDATE);
                    COMMIT;
                END;
            `;
            await executeQuery(mergeLogSql, [attemptId, log.questionId, log.selectedAnswer, log.isCorrect, userId]);
        }

        res.json({ success: true, attemptId, score });
    } catch (err) {
        console.error("시험 제출 적재 실패:", err);
        res.status(500).json({ error: "시험 결과 저장 중 에러가 발생했습니다." });
    }
});

module.exports = router;