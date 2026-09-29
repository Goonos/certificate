const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const oracledb = require('oracledb');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// 🔒 [보안 1] 비밀번호 검증 API
router.post('/verify', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (password === adminPassword) {
        return res.status(200).json({ success: true, message: '인증 성공' });
    } else {
        return res.status(401).json({ success: false, error: '비밀번호가 일치하지 않습니다.' });
    }
});
// 📊 [조회 API] STG 테이블 데이터 조회 (최신 100건 미리보기)
router.get('/stg-list', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const sql = `
            SELECT STG_ID, CATEGORY_NAME, EXAM_SESSION, SUBJECT_NO, QUESTION_NO, STATUS
            FROM QUESTION_STG
            ORDER BY STG_ID DESC
            FETCH FIRST 100 ROWS ONLY
        `;
        const result = await connection.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) {}
        }
    }
});

// 🚀 [실행 API] PL/SQL 프로시저 원클릭 실행
router.post('/execute-plsql', async (req, res) => {
    // 🔒 보안: 여기도 비밀번호 헤더 검증을 걸어줍니다 (선택사항)
    const reqPassword = req.headers['x-admin-password'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234!';
    if (reqPassword !== adminPassword) return res.status(403).json({ error: '권한 없음' });

    let connection;
    try {
        connection = await oracledb.getConnection();
        
        console.log('⚡ PL/SQL 프로시저 (SP_EXAM_DATA_LOAD) 실행 시작...');
        // Node.js에서 프로시저를 실행하는 정석 방법
        await connection.execute(`BEGIN SP_EXAM_DATA_LOAD; END;`);
        console.log('✅ PL/SQL 프로시저 실행 완료!');

        res.json({ success: true, message: 'STG 데이터를 운영 테이블로 성공적으로 이관했습니다!' });
    } catch (err) {
        console.error('❌ PL/SQL 실행 오류:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) {}
        }
    }
});

// 🔒 [보안 2] 엑셀 업로드 API (헤더 비밀번호 검증 미들웨어)
router.post('/upload-excel', upload.single('excelFile'), async (req, res) => {
    const reqPassword = req.headers['x-admin-password'];
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (reqPassword !== adminPassword) {
        return res.status(403).json({ error: '권한이 없습니다. 비밀번호 인증이 필요합니다.' });
    }

    if (!req.file) {
        return res.status(400).json({ error: '엑셀 파일이 첨부되지 않았습니다.' });
    }

    let connection;
    try {
        console.log('📦 [Admin] 엑셀 파일 수신 완료. 파싱을 시작합니다...');
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0]; 
        const sheet = workbook.Sheets[sheetName];

        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
            return res.status(400).json({ error: '엑셀 파일에 데이터가 없습니다.' });
        }
        console.log(`✅ 파싱 성공: 총 ${rows.length}문항 발견. DB 적재를 시도합니다.`);

        connection = await oracledb.getConnection();

        const insertSql = `
            INSERT INTO QUESTION_STG (
                STG_ID, CATEGORY_NAME, EXAM_SESSION, SUBJECT_NO, QUESTION_NO, QUESTION_TYPE,
                PASSAGE_TEXT, QUESTION_TEXT, 
                OPTION_1, OPTION_2, OPTION_3, OPTION_4, OPTION_5, OPTION_6, OPTION_7, OPTION_8,
                ANSWER_TEXT, EXPLANATION_TEXT, STATUS
            ) VALUES (
                QUESTION_STG_SEQ.NEXTVAL, 
                :CATEGORY_NAME, :EXAM_SESSION, :SUBJECT_NO, :QUESTION_NO, :QUESTION_TYPE,
                :PASSAGE_TEXT, :QUESTION_TEXT, 
                :OPTION_1, :OPTION_2, :OPTION_3, :OPTION_4, :OPTION_5, :OPTION_6, :OPTION_7, :OPTION_8,
                :ANSWER_TEXT, :EXPLANATION_TEXT, 'PENDING'
            )
        `;

        const options = {
            autoCommit: true, 
            bindDefs: {
                CATEGORY_NAME: { type: oracledb.STRING, maxSize: 100 },
                EXAM_SESSION: { type: oracledb.STRING, maxSize: 50 },
                SUBJECT_NO: { type: oracledb.NUMBER },
                QUESTION_NO: { type: oracledb.NUMBER },
                QUESTION_TYPE: { type: oracledb.STRING, maxSize: 10 },
                PASSAGE_TEXT: { type: oracledb.DB_TYPE_CLOB }, 
                QUESTION_TEXT: { type: oracledb.DB_TYPE_CLOB },
                OPTION_1: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_2: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_3: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_4: { type: oracledb.STRING, maxSize: 1000 },
                // 🔥 추가된 5~8번 보기 맵핑 규칙
                OPTION_5: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_6: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_7: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_8: { type: oracledb.STRING, maxSize: 1000 },
                ANSWER_TEXT: { type: oracledb.STRING, maxSize: 1000 },
                EXPLANATION_TEXT: { type: oracledb.DB_TYPE_CLOB }
            }
        };
        rows.forEach(row => {
            // 1. 숫자/문자열 타입 강제 매칭 (엑셀에서 숫자로 넘어와도 무조건 문자로!)
            if (row.CATEGORY_NAME !== undefined && row.CATEGORY_NAME !== '') row.CATEGORY_NAME = String(row.CATEGORY_NAME);
            if (row.EXAM_SESSION !== undefined && row.EXAM_SESSION !== '') row.EXAM_SESSION = String(row.EXAM_SESSION);
            if (row.QUESTION_TYPE !== undefined && row.QUESTION_TYPE !== '') row.QUESTION_TYPE = String(row.QUESTION_TYPE);
            
            // Number 타입은 혹시 문자로 넘어왔을 경우를 대비해 숫자로!
            if (row.SUBJECT_NO !== undefined && row.SUBJECT_NO !== '') row.SUBJECT_NO = Number(row.SUBJECT_NO);
            if (row.QUESTION_NO !== undefined && row.QUESTION_NO !== '') row.QUESTION_NO = Number(row.QUESTION_NO);

            // 2. CLOB 컬럼 방어 (빈 칸이면 튕기는 버그 방지)
            // 값이 없거나 빈 문자열이면 확실한 순수 null로 덮어쓰고, 값이 있으면 무조건 String으로 캐스팅!
            row.PASSAGE_TEXT = (row.PASSAGE_TEXT === undefined || row.PASSAGE_TEXT === '') ? null : String(row.PASSAGE_TEXT);
            row.QUESTION_TEXT = (row.QUESTION_TEXT === undefined || row.QUESTION_TEXT === '') ? null : String(row.QUESTION_TEXT);
            row.EXPLANATION_TEXT = (row.EXPLANATION_TEXT === undefined || row.EXPLANATION_TEXT === '') ? null : String(row.EXPLANATION_TEXT);
            
            // 3. 나머지 보기들도 안전하게 처리
            row.OPTION_1 = (row.OPTION_1 === undefined || row.OPTION_1 === '') ? null : String(row.OPTION_1);
            row.OPTION_2 = (row.OPTION_2 === undefined || row.OPTION_2 === '') ? null : String(row.OPTION_2);
            row.OPTION_3 = (row.OPTION_3 === undefined || row.OPTION_3 === '') ? null : String(row.OPTION_3);
            row.OPTION_4 = (row.OPTION_4 === undefined || row.OPTION_4 === '') ? null : String(row.OPTION_4);
            row.OPTION_5 = (row.OPTION_5 === undefined || row.OPTION_5 === '') ? null : String(row.OPTION_5);
            row.OPTION_6 = (row.OPTION_6 === undefined || row.OPTION_6 === '') ? null : String(row.OPTION_6);
            row.OPTION_7 = (row.OPTION_7 === undefined || row.OPTION_7 === '') ? null : String(row.OPTION_7);
            row.OPTION_8 = (row.OPTION_8 === undefined || row.OPTION_8 === '') ? null : String(row.OPTION_8);
            row.ANSWER_TEXT = (row.ANSWER_TEXT === undefined || row.ANSWER_TEXT === '') ? null : String(row.ANSWER_TEXT);
        });

        const result = await connection.executeMany(insertSql, rows, options);
        console.log(`🎉 DB 적재 성공! ${result.rowsAffected}개의 문항이 STG 테이블에 들어갔습니다.`);
        
        res.status(200).json({
            message: `성공적으로 ${result.rowsAffected}개의 기출문제가 업로드되었습니다!`,
            insertedCount: result.rowsAffected
        });
    } catch (err) {
        console.error('❌ 엑셀 업로드 중 오류 발생:\n', err);
        res.status(500).json({ error: 'DB 적재 실패', details: err.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

module.exports = router;