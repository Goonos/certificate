const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const oracledb = require('oracledb');
const router = express.Router();

// 메모리 스토리지: 하드디스크에 저장하지 않고 RAM에서 바로 읽어 처리 (속도 최적화)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-excel', upload.single('excelFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '엑셀 파일이 첨부되지 않았습니다.' });
    }

    let connection;
    try {
        console.log('📦 [Admin] 엑셀 파일 수신 완료. 파싱을 시작합니다...');
        // 메모리에 올라간 파일을 엑셀 워크북으로 읽기
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0]; 
        const sheet = workbook.Sheets[sheetName];

        // 빈 칸은 ''(빈 문자열)로 처리하여 JSON 배열로 변환
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
            return res.status(400).json({ error: '엑셀 파일에 데이터가 없습니다.' });
        }
        console.log(`✅ 파싱 성공: 총 ${rows.length}문항 발견. DB 적재를 시도합니다.`);

        // 오라클 DB 접속 (환경변수 사용)
        connection = await oracledb.getConnection();

        // 💡 12,000바이트 ERD 데이터도 거뜬한 바인드 변수 쿼리
        const insertSql = `
            INSERT INTO QUESTION_STG (
                STG_ID, CATEGORY_NAME, EXAM_SESSION, SUBJECT_NO, QUESTION_NO, QUESTION_TYPE,
                PASSAGE_TEXT, QUESTION_TEXT, OPTION_1, OPTION_2, OPTION_3, OPTION_4,
                ANSWER_TEXT, EXPLANATION_TEXT, STATUS
            ) VALUES (
                QUESTION_STG_SEQ.NEXTVAL, 
                :CATEGORY_NAME, :EXAM_SESSION, :SUBJECT_NO, :QUESTION_NO, :QUESTION_TYPE,
                :PASSAGE_TEXT, :QUESTION_TEXT, :OPTION_1, :OPTION_2, :OPTION_3, :OPTION_4,
                :ANSWER_TEXT, :EXPLANATION_TEXT, 'PENDING'
            )
        `;

        const options = {
            autoCommit: true, // 즉시 커밋
            bindDefs: {
                CATEGORY_NAME: { type: oracledb.STRING, maxSize: 100 },
                EXAM_SESSION: { type: oracledb.STRING, maxSize: 50 },
                SUBJECT_NO: { type: oracledb.NUMBER },
                QUESTION_NO: { type: oracledb.NUMBER },
                QUESTION_TYPE: { type: oracledb.STRING, maxSize: 10 },
                PASSAGE_TEXT: { type: oracledb.STRING, maxSize: 500000 }, 
                QUESTION_TEXT: { type: oracledb.STRING, maxSize: 500000 }, // 👈 CLOB (ERD 데이터)
                OPTION_1: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_2: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_3: { type: oracledb.STRING, maxSize: 1000 },
                OPTION_4: { type: oracledb.STRING, maxSize: 1000 },
                ANSWER_TEXT: { type: oracledb.STRING, maxSize: 1000 },
                EXPLANATION_TEXT: { type: oracledb.STRING, maxSize: 500000 } // 👈 CLOB (해설)
            }
        };

        // 💡 배열 전체를 한 번에 인서트! (Batch Insert - DBA 최적화)
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