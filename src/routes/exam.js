// src/routes/exam.js
const express = require('express');
const { executeQuery } = require('../config/oracle_db');
const router = express.Router();
const jwt = require('jsonwebtoken');
const KST = "SYSDATE + 9/24";

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
            ORDER BY EXAM_SESSION ASC
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
    const { typeCode } = req.query; // 👈 프론트에서 넘겨주는 typeCode(82 또는 83) 받기

    try {
        const subjectSql = `SELECT SUBJECT_NO, SUBJECT_NAME FROM EXAM_SUBJECT WHERE CATEGORY_ID = :1 ORDER BY SUBJECT_NO ASC`;
        const subjectsResult = await executeQuery(subjectSql, [categoryId]);

        // 🔥 typeCode가 있으면 082(82)와 083(83) 회차를 정확히 분리해서 조회
        let sessionSql = `SELECT DISTINCT EXAM_SESSION FROM EXAM_QUESTION WHERE CATEGORY_ID = :1`;
        const sessionBinds = [categoryId];

        if (typeCode) {
            sessionSql += ` AND QUESTION_TYPE = :2`;
            sessionBinds.push(typeCode);
        }
        sessionSql += ` ORDER BY EXAM_SESSION ASC`;

        const sessionsResult = await executeQuery(sessionSql, sessionBinds);

        res.json({ subjects: subjectsResult.rows, sessions: sessionsResult.rows.map(r => r.EXAM_SESSION) });
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
            /* 🔥 JOIN에 타입 조건 추가 (2배 뻥튀기 방지) */
            LEFT JOIN EXAM_SUBJECT S 
                   ON TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(S.CATEGORY_ID) 
                  AND NVL(Q.SUBJECT_NO, 1) = S.SUBJECT_NO
                  AND Q.QUESTION_TYPE = S.EXAM_TYPE_CODE 
            LEFT JOIN QUESTION_OPTIONS O ON Q.QUESTION_ID = O.QUESTION_ID
            WHERE TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(:1) AND Q.QUESTION_TYPE = :2 AND Q.EXAM_SESSION = :3
            /* 🔥 ORDER BY에 QUESTION_ID 추가 (339개 무한 증식 방지) */
            ORDER BY NVL(Q.SUBJECT_NO, 1) ASC, Q.QUESTION_NO ASC, Q.QUESTION_ID ASC, O.OPTION_NO ASC
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

// 🔥 한문제씩 풀기 전용 동적 문제 조회 API (OCP 과목패스 + 메타데이터 연동 완벽 지원)
router.post('/questions/single-mode', async (req, res) => {
    const { categoryId, typeCode, subjectNos, modeType, examSession, startSession, endSession, limit = 20 } = req.body;

    try {
        // 1. 기본 쿼리 
        let sql = `
            SELECT Q.QUESTION_ID, Q.CATEGORY_ID, S.SUBJECT_NAME, Q.SUBJECT_NO, 
            Q.EXAM_SESSION, Q.QUESTION_NO, 
            TO_CHAR(Q.PASSAGE_TEXT) AS PASSAGE_TEXT, 
            TO_CHAR(Q.QUESTION_TEXT) AS QUESTION_TEXT, 
            Q.QUESTION_TYPE, TO_CHAR(Q.ANSWER_TEXT) AS ANSWER_TEXT, TO_CHAR(Q.EXPLANATION_TEXT) AS EXPLANATION_TEXT,
            NVL(S.QUESTION_COUNT, 20) AS QUESTION_COUNT /* 과목별 할당 문제 수 */
            FROM EXAM_QUESTION Q
            LEFT JOIN EXAM_SUBJECT S 
                   ON TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(S.CATEGORY_ID) 
                  AND NVL(Q.SUBJECT_NO, 1) = S.SUBJECT_NO
                  /* 🔥 해결 1: OCP 문제 2배 증식(뻥튀기) 완벽 차단 조인 조건 */
                  AND Q.QUESTION_TYPE = S.EXAM_TYPE_CODE 
            WHERE TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(:categoryId) AND Q.QUESTION_TYPE = :typeCode
            `;
        
        let bindParams = { categoryId, typeCode };
        const isOcp = typeCode === '82' || typeCode === '83';

        // 2. 모드에 따른 쿼리 분기
        if (modeType === 'RANDOM_20') {
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
            if (!isOcp && typeCode !== '02' && (!subjectNos || subjectNos.length === 0)) {
                return res.status(400).json({ error: "최소 하나 이상의 과목을 선택해 주세요." });
            }

            if (!isOcp && typeCode !== '02' && subjectNos && subjectNos.length > 0) {
                const subjectBinds = {};
                const subjectPlaceholders = subjectNos.map((no, idx) => {
                    const key = `s${idx}`;
                    subjectBinds[key] = no;
                    return `:${key}`;
                }).join(', ');
                
                // 🔥 해결 2: SQLD 문제의 과목 번호가 비어있어도(NULL) 튕겨내지 않고 1과목으로 멱살 잡고 가져오는 무적 방어 로직!
                sql += ` AND NVL(Q.SUBJECT_NO, 1) IN (${subjectPlaceholders})`;
                Object.assign(bindParams, subjectBinds);
            }

            if (modeType === 'DESIGNATED') {
                sql += ` AND Q.EXAM_SESSION = :examSession ORDER BY Q.SUBJECT_NO ASC, Q.QUESTION_NO ASC`;
                bindParams.examSession = examSession;
            } else if (modeType === 'RANGE') {
                // 🔥 해결 3: "60회"와 "62회" 같은 문자열 회차 비교 시 오작동하지 않도록 localeCompare로 한국어 숫자 순서 완벽 스왑 처리
                let actualStart = startSession;
                let actualEnd = endSession;
                if (String(startSession).localeCompare(String(endSession), 'ko', { numeric: true }) > 0) {
                    actualStart = endSession;
                    actualEnd = startSession;
                }

                sql += ` AND Q.EXAM_SESSION BETWEEN :startSession AND :endSession`;
                bindParams.startSession = actualStart;
                bindParams.endSession = actualEnd;

                // 과목별 문항수 컷팅 파티션 쿼리
                sql = `
                    SELECT * FROM (
                        SELECT T.*,
                               ROW_NUMBER() OVER(PARTITION BY T.SUBJECT_NO ORDER BY DBMS_RANDOM.VALUE) AS RND_RN
                        FROM ( ${sql} ) T
                    ) WHERE RND_RN <= QUESTION_COUNT
                    ORDER BY SUBJECT_NO, RND_RN
                `;
            }
        }

        const result = await executeQuery(sql, bindParams);
        let questions = result.rows;

        // 3. 객관식 옵션 병합
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
        const sessionName = examInfo.sessionName || '지정/랜덤 모의고사';

        // 1. 부모 레코드 (USER_EXAM_ATTEMPT) 처리
        if (!attemptId) {
            const seqRes = await executeQuery(`SELECT SEQ_USER_EXAM_ATTEMPT.NEXTVAL AS ID FROM DUAL`);
            attemptId = seqRes.rows[0].ID;
            const insertAttemptSql = `
                BEGIN
                    INSERT INTO USER_EXAM_ATTEMPT (ATTEMPT_ID, USER_ID, CATEGORY_ID, EXAM_SESSION, TYPE_CODE, SOLVE_MODE, STATUS, TOTAL_COUNT, START_DT)
                    VALUES (:1, :2, :3, :4, :5, :6, 'IN_PROGRESS', :7, ${KST});
                    COMMIT;
                END;
            `;
            await executeQuery(insertAttemptSql, [attemptId, userId, examInfo.categoryId, sessionName, examInfo.typeCode || '01', solveMode, questions.length]);
        } else {
            const updateAttemptSql = `
                BEGIN
                    UPDATE USER_EXAM_ATTEMPT 
                    SET STATUS = 'IN_PROGRESS', SOLVE_MODE = NVL(:1, SOLVE_MODE), START_DT = NVL(START_DT, ${KST}) 
                    WHERE ATTEMPT_ID = :2 AND USER_ID = :3;
                    COMMIT;
                END;
            `;
            await executeQuery(updateAttemptSql, [solveMode, attemptId, userId]);
        }

        // 2. 답안 기록 최신화
        for (const q of questions) {
            const questionId = q.questionId || q.QUESTION_ID || q.qNo; 
            const selectedAns = answers[q.qNo] ? String(answers[q.qNo]) : null;
            
            // 🔥 콤마, 공백 제거 및 대문자 변환 후 알파벳 오름차순 정렬
            const cleanAns = (ans) => ans ? String(ans).replace(/[^A-Z0-9]/ig, '').toUpperCase().split('').sort().join('') : '';
            
            // 🔥 무적화된 채점 로직 적용
            const isCorrect = selectedAns ? (cleanAns(q.answer) === cleanAns(selectedAns) ? 'Y' : 'N') : null;
            const mergeLogSql = `
                BEGIN
                    MERGE INTO USER_SOLVE_LOG L
                    USING (SELECT :1 AS ATTEMPT_ID, :2 AS QUESTION_ID FROM DUAL) T
                    ON (L.ATTEMPT_ID = T.ATTEMPT_ID AND L.QUESTION_ID = T.QUESTION_ID)
                    WHEN MATCHED THEN
                        UPDATE SET L.SELECTED_ANSWER = :3, L.IS_CORRECT = :4, L.SOLVE_DT = ${KST}
                    WHEN NOT MATCHED THEN
                        INSERT (SOLVE_LOG_ID, ATTEMPT_ID, USER_ID, QUESTION_ID, SELECTED_ANSWER, IS_CORRECT, SOLVE_DT)
                        VALUES (SEQ_USER_SOLVE_LOG.NEXTVAL, :1, :5, :2, :3, :4, ${KST});
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
                   TO_CHAR(Q.PASSAGE_TEXT) AS PASSAGE_TEXT,   
                   TO_CHAR(Q.QUESTION_TEXT) AS QUESTION_TEXT, 
                   Q.QUESTION_TYPE, TO_CHAR(Q.ANSWER_TEXT) AS ANSWER_TEXT, TO_CHAR(Q.EXPLANATION_TEXT) AS EXPLANATION_TEXT
            FROM USER_SOLVE_LOG L
            JOIN EXAM_QUESTION Q ON L.QUESTION_ID = Q.QUESTION_ID
            LEFT JOIN EXAM_SUBJECT S 
                   ON TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(S.CATEGORY_ID) 
                  AND NVL(Q.SUBJECT_NO, 1) = S.SUBJECT_NO
                  /* 🔥 핵심 해결: 이어풀기 쿼리에도 EXAM_TYPE_CODE 조인 조건을 추가하여 2배 뻥튀기 원천 차단! */
                  AND Q.QUESTION_TYPE = S.EXAM_TYPE_CODE
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
        const solveMode = examInfo.solveMode || 'omr';
        const sessionName = examInfo.sessionName || '지정/랜덤 모의고사';
        
        let attemptId = existingAttemptId;

        // 1. 부모 레코드 (USER_EXAM_ATTEMPT) 무조건 먼저 준비 (FK 제약조건 에러 방지)
        if (!attemptId) {
            const seqRes = await executeQuery(`SELECT SEQ_USER_EXAM_ATTEMPT.NEXTVAL AS ID FROM DUAL`);
            attemptId = seqRes.rows[0].ID;

            const insertAttemptSql = `
                BEGIN
                    INSERT INTO USER_EXAM_ATTEMPT (ATTEMPT_ID, USER_ID, CATEGORY_ID, EXAM_SESSION, TYPE_CODE, SOLVE_MODE, STATUS, TOTAL_COUNT, START_DT) 
                    VALUES (:1, :2, :3, :4, :5, :6, 'IN_PROGRESS', :7, ${KST});
                    COMMIT;
                END;
            `;
            await executeQuery(insertAttemptSql, [attemptId, userId, examInfo.categoryId, sessionName, examInfo.typeCode || '01', solveMode, questions.length]);
        }

        // 2. 자식 테이블 (USER_SOLVE_LOG) 먼저 최신화
        for (const q of questions) {
            const questionId = q.questionId || q.QUESTION_ID || q.qNo; 
            const selectedAns = answers[q.qNo] ? String(answers[q.qNo]) : null;
            
            // 🔥 콤마, 공백 제거 및 대문자 변환 후 알파벳 오름차순 정렬
            const cleanAns = (ans) => ans ? String(ans).replace(/[^A-Z0-9]/ig, '').toUpperCase().split('').sort().join('') : '';
            
            // 🔥 무적화된 채점 로직 적용
            const isCorrect = (cleanAns(selectedAns) === cleanAns(q.answer)) ? 'Y' : 'N';
            const mergeLogSql = `
                BEGIN
                    MERGE INTO USER_SOLVE_LOG L
                    USING (SELECT :1 AS ATTEMPT_ID, :2 AS QUESTION_ID FROM DUAL) T
                    ON (L.ATTEMPT_ID = T.ATTEMPT_ID AND L.QUESTION_ID = T.QUESTION_ID)
                    WHEN MATCHED THEN 
                        UPDATE SET L.SELECTED_ANSWER = :3, L.IS_CORRECT = :4, L.SOLVE_DT = ${KST}
                    WHEN NOT MATCHED THEN 
                        INSERT (SOLVE_LOG_ID, ATTEMPT_ID, USER_ID, QUESTION_ID, SELECTED_ANSWER, IS_CORRECT, SOLVE_DT) 
                        VALUES (SEQ_USER_SOLVE_LOG.NEXTVAL, :1, :5, :2, :3, :4, ${KST});
                    COMMIT;
                END;
            `;
            await executeQuery(mergeLogSql, [attemptId, questionId, selectedAns, isCorrect, userId]);
        }

        // 3. DB에 쌓인 SOLVE_LOG 기준으로 전체 정답 수 집계 (오답노트로 풀었어도 전체 대비 점수 산출)
        const cntSql = `SELECT COUNT(*) AS CORRECT_CNT FROM USER_SOLVE_LOG WHERE ATTEMPT_ID = :1 AND IS_CORRECT = 'Y'`;
        const cntRes = await executeQuery(cntSql, [attemptId]);
        const finalCorrect = cntRes.rows[0].CORRECT_CNT;

        const totalSql = `SELECT TOTAL_COUNT FROM USER_EXAM_ATTEMPT WHERE ATTEMPT_ID = :1`;
        const totalRes = await executeQuery(totalSql, [attemptId]);
        const finalTotal = totalRes.rows[0].TOTAL_COUNT;

        const finalScore = finalTotal > 0 ? Math.round((finalCorrect / finalTotal) * 100) : 0;

        // 4. 부모 테이블 최종 상태 및 계산된 점수 반영
        const updateAttemptSql = `
            BEGIN
                UPDATE USER_EXAM_ATTEMPT 
                SET STATUS='COMPLETED', SCORE=:1, CORRECT_COUNT=:2, COMPLETE_DT=${KST}, SOLVE_MODE=NVL(:3, SOLVE_MODE)
                WHERE ATTEMPT_ID=:4 AND USER_ID=:5;
                COMMIT;
            END;
        `;
        await executeQuery(updateAttemptSql, [finalScore, finalCorrect, solveMode, attemptId, userId]);

        res.json({ success: true, attemptId, score: finalScore });
    } catch (err) {
        console.error("시험 제출 적재 실패:", err);
        res.status(500).json({ error: "시험 결과 저장 중 에러가 발생했습니다." });
    }
});

// 🔥 [추가] 오답 노트 전용 문제 조회 API
router.get('/questions/incorrect/:attemptId', authenticateUser, async (req, res) => {
    try {
        const attemptId = req.params.attemptId;
        const userId = req.user.userId;

        const sql = `
            SELECT Q.QUESTION_ID, Q.CATEGORY_ID, TO_CHAR(S.SUBJECT_NAME) AS SUBJECT_NAME, Q.SUBJECT_NO, 
                   Q.EXAM_SESSION, Q.QUESTION_NO, TO_CHAR(Q.PASSAGE_TEXT) AS PASSAGE_TEXT, TO_CHAR(Q.QUESTION_TEXT) AS QUESTION_TEXT, 
                   Q.QUESTION_TYPE, TO_CHAR(Q.ANSWER_TEXT) AS ANSWER_TEXT, TO_CHAR(Q.EXPLANATION_TEXT) AS EXPLANATION_TEXT
            FROM USER_SOLVE_LOG L
            JOIN EXAM_QUESTION Q ON L.QUESTION_ID = Q.QUESTION_ID
            LEFT JOIN EXAM_SUBJECT S 
                   ON TO_CHAR(Q.CATEGORY_ID) = TO_CHAR(S.CATEGORY_ID) 
                  AND NVL(Q.SUBJECT_NO, 1) = S.SUBJECT_NO
                  AND Q.QUESTION_TYPE = S.EXAM_TYPE_CODE /* 과목 조인 뻥튀기 방지 */
            WHERE L.ATTEMPT_ID = :1 AND L.USER_ID = :2 AND L.IS_CORRECT = 'N'
            ORDER BY NVL(Q.SUBJECT_NO, 1) ASC, Q.QUESTION_NO ASC
        `;
        
        const result = await executeQuery(sql, [attemptId, userId]);
        let questions = result.rows;

        if (questions.length > 0) {
            const qIds = questions.map(q => q.QUESTION_ID);
            const optBinds = {};
            const optPlaceholders = qIds.map((id, idx) => { optBinds[`q${idx}`] = id; return `:q${idx}`; }).join(', ');

            const optSql = `
                SELECT QUESTION_ID, OPTION_NO, TO_CHAR(OPTION_TEXT) AS OPTION_TEXT 
                FROM QUESTION_OPTIONS 
                WHERE QUESTION_ID IN (${optPlaceholders}) 
                ORDER BY QUESTION_ID, OPTION_NO ASC
            `;
            const optResult = await executeQuery(optSql, optBinds);

            questions = questions.map((q) => ({
                ...q,
                questionId: q.QUESTION_ID,
                qNo: q.QUESTION_NO,
                title: q.QUESTION_TEXT,
                passageText: q.PASSAGE_TEXT,
                questionType: q.QUESTION_TYPE,
                answer: q.ANSWER_TEXT,
                explanationText: q.EXPLANATION_TEXT,
                // 🔥 객체 대신 문자열(OPTION_TEXT) 배열로 반환
                options: optResult.rows
                    .filter(opt => opt.QUESTION_ID === q.QUESTION_ID)
                    .map(opt => opt.OPTION_TEXT)
            }));
        }
        res.json({ questions });
    } catch (err) {
        console.error("오답 조회 에러:", err);
        res.status(500).json({ error: "오답 문제를 불러오는 중 에러가 발생했습니다." });
    }
});


// GET /api/exam/questions/range
router.get('/questions/range', async (req, res) => {
    const { categoryId, typeCode, startSession, endSession } = req.query;

    // 🔥 [디버깅용 로그 추가] 프론트엔드가 뭘 보냈는지 터미널에서 확인!
    console.log("==== [범위 회차 요청 파라미터] ====");
    console.log("categoryId:", categoryId, "typeCode:", typeCode);
    console.log("startSession:", startSession, "endSession:", endSession);

    let connection;
    try {
        connection = await oracledb.getConnection();
        
        // 💡 메타 테이블(EXAM_SUBJECT)을 조인하여 과목별 문제 수를 동적으로 가져오는 최적화 쿼리
        const sql = `
            SELECT Q.*
            FROM (
                SELECT Q.*,
                       S.QUESTION_COUNT,
                       ROW_NUMBER() OVER(PARTITION BY Q.SUBJECT_NO ORDER BY DBMS_RANDOM.VALUE) AS RND_RN
                FROM EXAM_QUESTION Q
                JOIN EXAM_SUBJECT S 
                  ON Q.CATEGORY_ID = S.CATEGORY_ID 
                 AND Q.EXAM_TYPE_CODE = S.EXAM_TYPE_CODE 
                 AND Q.SUBJECT_NO = S.SUBJECT_NO
                WHERE Q.CATEGORY_ID = :categoryId
                  AND Q.EXAM_TYPE_CODE = :typeCode
                  AND Q.EXAM_SESSION BETWEEN :startSession AND :endSession
            ) Q
            WHERE Q.RND_RN <= Q.QUESTION_COUNT
            ORDER BY Q.SUBJECT_NO, Q.RND_RN
        `;

        const binds = {
            categoryId: Number(categoryId), // 숫자 타입 처리
            typeCode,
            startSession,
            endSession
        };

        const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        res.json({
            success: true,
            questions: result.rows 
        });

    } catch (err) {
        console.error('범위 회차 문제 랜덤 조회 오류:', err);
        res.status(500).json({ success: false, message: '랜덤 모의고사 생성 중 오류가 발생했습니다.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
});
module.exports = router;