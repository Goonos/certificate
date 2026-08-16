// src/config/oracle_db.js
const oracledb = require('oracledb');
require('dotenv').config();

// 오라클 DB 자동 커밋 설정
oracledb.autoCommit = true; 

async function initDbPool() {
    try {
        await oracledb.createPool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING,
            
            // ⭐️ [추가된 부분] mTLS 보안 인증서(Wallet) 정보 제출
            walletLocation: process.env.TNS_ADMIN, 
            walletPassword: process.env.WALLET_PASSWORD, 
            
            poolMin: 2,
            poolMax: 10,
            poolIncrement: 1
        });
        console.log("✅ Oracle DB Connection Pool 생성 완료!");
    } catch (err) {
        console.error("❌ Oracle DB Pool 생성 실패:", err);
    }
}

async function executeQuery(sql, binds = [], options = {}) {
    let connection;
    try {
        connection = await oracledb.getConnection();
        options.outFormat = oracledb.OUT_FORMAT_OBJECT;
        const result = await connection.execute(sql, binds, options);
        return result;
    } catch (err) {
        console.error("SQL 에러:", err);
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
}

module.exports = { initDbPool, executeQuery };