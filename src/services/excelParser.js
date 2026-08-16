/**
 * excelParser.js — Excel (.xlsx) → QUESTION_STG Bulk Insert Service
 *
 * Responsibilities:
 *   1. Read an .xlsx file and parse all rows (skip header).
 *   2. Map each row to the raw columns of QUESTION_STG exactly as ETL_SPEC mandates.
 *   3. Perform bulk insert via oracledb.executeMany().
 *   4. Empty cells are always mapped to NULL (no empty strings allowed in STG).
 *   5. Return summary stats (total, inserted, rejected) for logging.
 *
 * Staging Table: QUESTION_STG
 *   Columns: RAW_CATEGORY, RAW_MODULE, RAW_SESSION, RAW_TYPE,
 *            RAW_PASS_TYPE, RAW_PASS_CONT, RAW_QUESTION, RAW_ANSWER,
 *            RAW_EXPLAN, RAW_OPT1, RAW_OPT2, RAW_OPT3, RAW_OPT4
 */

import oracledb from 'oracledb';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import dbPool from '../config/oracle_db.js';

// Mapping: Excel columns (1-indexed) → QUESTION_STG column names
const COL_MAP = [
  'RAW_CATEGORY',     // index 0  — 자격증종목
  'RAW_MODULE',       // index 1  — 과목번호
  'RAW_SESSION',      // index 2  — 회차
  'RAW_TYPE',         // index 3  — 문제유형코드
  'RAW_PASS_TYPE',    // index 4  — 지문타입
  'RAW_PASS_CONT',    // index 5  — 지문내용
  'RAW_QUESTION',     // index 6  — 문제본문
  'RAW_ANSWER',       // index 7  — 정답
  'RAW_EXPLAN',       // index 8  — 해설
  'RAW_OPT1',         // index 9  — 보기1
  'RAW_OPT2',         // index 10 — 보기2
  'RAW_OPT3',         // index 11 — 보기3
  'RAW_OPT4',         // index 12 — 보기4
];

/**
 * Load .xlsx rows into QUESTION_STG
 *
 * @param {string} filePath - Absolute or relative path to the .xlsx file
 * @param {object} pool     - Oracle DB pool (from dbPool)
 * @returns {object} summary with inserted / rejected counts and error messages
 */
async function loadExcelToStaging(filePath, conn = null) {
  let releasedConn = false;

  try {
    // Ensure we have a connection
    if (!conn) {
      conn = await dbPool.getConnection();
      releasedConn = true;
    }

    // ---------- 1. Read Excel file ----------
    const fileContent = await fs.readFile(filePath);
    const workbook = XLSX.read(fileContent, { type: 'buffer', cellDates: false });
    const sheetName = workbook.SheetNames[0]; // First sheet only
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null });

    if (rawData.length < 2) {
      return { total: 0, inserted: 0, rejected: 0, errors: 'Excel file has no data rows (minimum: header + 1 row).' };
    }

    // Remove header row (index 0 in sheet_to_json output)
    const rows = rawData.slice(1);

    // ---------- 2. Normalize rows → clean array of arrays ----------
    const bindParams = [];
    for (const [i, row] of rows.entries()) {
      if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
        // Completely empty row → skip silently
        continue;
      }

      const cleaned = [];
      for (let colIdx = 0; colIdx < COL_MAP.length; colIdx += 1) {
        const val = (row[colIdx] ?? null);
        // Normalize: convert to string, strip newlines/CR, trim whitespace
        let stringValue = val === null || val === undefined ? null : String(val).replace(/\r?\n/g, ' ').trim();
        cleaned.push(stringValue || null);  // Empty string → NULL
      }
      bindParams.push(cleaned);
    }

    if (bindParams.length === 0) {
      return { total: rows.length, inserted: 0, rejected: 0, errors: 'No valid data rows found in Excel.' };
    }

    // ---------- 3. Bulk insert into QUESTION_STG ----------
    const columns = COL_MAP.join(', ');
    const placeholders = COL_MAP.map((_, i) => `:${i + 1}`).join(', ');
    const sql = `INSERT INTO QUESTION_STG (${columns}) VALUES (${placeholders})`;

    // oracledb.executeMany: bindByName defaults, but we use numbered binds via paramsetindexmode
    const result = await conn.executeMany(sql, bindParams, {
      autoCommit: false,
      paramSetIndexMode: true,
    });

    await conn.commit();

    console.log(`[excelParser.js] Inserted ${result.rowsProcessed} rows into QUESTION_STG.`);

    return {
      total: rows.length,
      inserted: result.rowsProcessed,
      rejected: 0,
      errors: [],
    };

  } catch (err) {
    // Rollback on failure
    if (conn) {
      try { await conn.rollback(); } catch (_) { /* ignore rollback errors */ }
    }
    console.error('[excelParser.js] Error loading Excel to STG:', err);
    return {
      total: 0,
      inserted: 0,
      rejected: -1, // Indicates error condition
      errors: [err.message],
    };
  } finally {
    if (releasedConn && conn) {
      try { await conn.close(); } catch (_) { /* ignore close errors */ }
    }
  }
}

export default loadExcelToStaging;
