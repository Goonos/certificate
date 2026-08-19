import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, KeyRound, UploadCloud, Database, Play, RefreshCw } from 'lucide-react';
export default function AdminUpload() {
    // 인증 상태 및 비밀번호 상태
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    // 입력된 비밀번호, 저장된 비밀번호, 인증 오류 메시지 상태
    const [passwordInput, setPasswordInput] = useState('');
    // 입력된 비밀번호, 저장된 비밀번호, 인증 오류 메시지 상태
    const [savedPassword, setSavedPassword] = useState('');
    // 인증 오류 메시지 상태
    const [authError, setAuthError] = useState('');
    // STG 테이블 데이터 상태
    const [stgData, setStgData] = useState([]);
    // PL/SQL 실행 상태
    const [isExecuting, setIsExecuting] = useState(false);
    // 엑셀 파일 업로드 상태
    const [file, setFile] = useState(null);
    // 로딩 상태
    const [isLoading, setIsLoading] = useState(false);

    // STG 테이블 데이터 조회
    const fetchStgData = () => {
        fetch('/api/admin/stg-list')
            .then(res => res.json())
            .then(resData => {
                if (resData.success) setStgData(resData.data);
            })
            .catch(err => console.error(err));
    };

    // PL/SQL 실행 처리
    const handleExecutePlsql = () => {
        if (!window.confirm('⚠️ 정말로 PL/SQL 프로시저를 실행하시겠습니까?')) return;
    };
    useEffect(() => {
        if (isAuthenticated) fetchStgData();
    }, [isAuthenticated]);

    // PL/SQL 실행 함수
    const handleExecutePLSQL = () => {
        if (!window.confirm('정말 STG 데이터를 운영 테이블로 이관하시겠습니까?\n(SP_EXAM_DATA_LOAD 프로시저가 실행됩니다.)')) return;

        setIsExecuting(true);
        fetch('/api/admin/execute-plsql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': savedPassword // 보안 통과용
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`🎉 성공: ${data.message}`);
                fetchStgData(); // 실행 후 표 다시 새로고침
            } else {
                alert(`❌ 오류: ${data.error}`);
            }
        })
        .catch(err => alert('서버 통신 오류'))
        .finally(() => setIsExecuting(false));
    };
    // 페이지 진입 시 세션에 기존 인증 내역이 있는지 확인
    useEffect(() => {
        const storedAuth = sessionStorage.getItem('admin_auth');
        const storedPw = sessionStorage.getItem('admin_pw');
        if (storedAuth === 'true' && storedPw) {
            setIsAuthenticated(true);
            setSavedPassword(storedPw);
        }
    }, []);

    // 🔒 비밀번호 입력 검증 처리
    const handleLogin = (e) => {
        e.preventDefault();
        setAuthError('');

        if (!passwordInput.trim()) {
            setAuthError('비밀번호를 입력해 주세요.');
            return;
        }

        fetch('/api/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: passwordInput })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setIsAuthenticated(true);
                setSavedPassword(passwordInput);
                sessionStorage.setItem('admin_auth', 'true');
                sessionStorage.setItem('admin_pw', passwordInput);
            } else {
                setAuthError(data.error || '비밀번호가 올바르지 않습니다.');
            }
        })
        .catch(err => {
            console.error(err);
            setAuthError('서버 통신 오류가 발생했습니다.');
        });
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    // 🚀 엑셀 파일 업로드 처리
    const handleUpload = async () => {
        if (!file) {
            alert('엑셀 파일을 먼저 선택해 주세요!');
            return;
        }

        const formData = new FormData();
        formData.append('excelFile', file);

        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/upload-excel', {
                method: 'POST',
                headers: {
                    // 백엔드로 보낼 보안 헤더 추가
                    'x-admin-password': savedPassword 
                },
                body: formData
            });
            const result = await response.json();

            if (response.ok) {
                alert(`✅ 업로드 완료!\n${result.message}`);
                setFile(null);
            } else {
                alert(`❌ 업로드 실패: ${result.error}\n${result.details || ''}`);
            }
        } catch (error) {
            alert(`네트워크 오류가 발생했습니다: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('admin_auth');
        sessionStorage.removeItem('admin_pw');
        setIsAuthenticated(false);
        setPasswordInput('');
        setSavedPassword('');
    };

    // 🔒 미인증 시: 비밀번호 입력 화면
    if (!isAuthenticated) {
        return (
            <div style={{ padding: '40px 20px', maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '20px',
                    padding: '32px 24px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff',
                        color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px auto'
                    }}>
                        <Lock size={28} />
                    </div>

                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                        관리자 인증
                    </h2>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
                        기출문제 업로드 페이지 접근을 위해 비밀번호를 입력해 주세요.
                    </p>

                    <form onSubmit={handleLogin}>
                        <div style={{ position: 'relative', marginBottom: '16px' }}>
                            <input 
                                type="password" 
                                placeholder="관리자 비밀번호 입력"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px 12px 40px',
                                    borderRadius: '12px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '14px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <KeyRound size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>

                        {authError && (
                            <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600', marginBottom: '16px', textAlign: 'left' }}>
                                ⚠️ {authError}
                            </p>
                        )}

                        <button 
                            type="submit"
                            style={{
                                width: '100%', padding: '12px', background: '#2563eb', color: '#ffffff',
                                border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            <ShieldCheck size={18} /> 인증하기
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ✅ 인증 완료 시: 엑셀 업로드 관리자 화면
    return (
        <div style={{ padding: '30px 20px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck color="#16a34a" size={24} /> 관리자 백오피스
                </h2>
                <button onClick={handleLogout} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    잠금
                </button>
            </div>
            
            {/* 1. 기존 엑셀 업로드 박스 */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)', marginBottom: '24px' }}>
                {/* ... 기존 엑셀 업로드 UI (UploadCloud 아이콘 및 찾아보기 버튼 부분) 유지 ... */}
                <p style={{ marginBottom: '20px', color: '#475569', fontSize: '13px' }}>엑셀 파일 업로드 (QUESTION_STG 적재)</p>
                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '24px', textAlign: 'center', marginBottom: '20px', background: '#f8fafc' }}>
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
                </div>
                <button onClick={handleUpload} disabled={isLoading} style={{ width: '100%', padding: '14px', background: '#16a34a', color: 'white', borderRadius: '12px', border: 'none', fontWeight: '800', cursor: 'pointer' }}>
                    {isLoading ? '적재 중...' : '엑셀 업로드'}
                </button>
            </div>

            {/* 🔥 2. 새로 추가된 STG 테이블 뷰어 및 PL/SQL 실행 박스 */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database size={18} color="#2563eb" /> STG 테이블 대기열
                    </h3>
                    <button onClick={fetchStgData} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                        <RefreshCw size={14} /> 새로고침
                    </button>
                </div>

                {/* 데이터 그리드 (표) */}
                <div style={{ overflowX: 'auto', marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '10px' }}>STG_ID</th>
                                <th style={{ padding: '10px' }}>종목</th>
                                <th style={{ padding: '10px' }}>회차</th>
                                <th style={{ padding: '10px' }}>문항번호</th>
                                <th style={{ padding: '10px' }}>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stgData.length === 0 ? (
                                <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>대기 중인 데이터가 없습니다.</td></tr>
                            ) : (
                                stgData.map((row) => (
                                    <tr key={row.STG_ID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px', color: '#64748b' }}>{row.STG_ID}</td>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{row.CATEGORY_NAME}</td>
                                        <td style={{ padding: '10px' }}>{row.EXAM_SESSION}</td>
                                        <td style={{ padding: '10px' }}>{row.SUBJECT_NO}과목 {row.QUESTION_NO}번</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{ background: row.STATUS === 'PENDING' ? '#fef3c7' : '#dcfce7', color: row.STATUS === 'PENDING' ? '#d97706' : '#15803d', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>
                                                {row.STATUS}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PL/SQL 실행 버튼 */}
                <button 
                    onClick={handleExecutePLSQL} 
                    disabled={isExecuting || stgData.length === 0}
                    style={{
                        width: '100%', padding: '14px', background: isExecuting || stgData.length === 0 ? '#94a3b8' : '#2563eb',
                        color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '14px',
                        cursor: isExecuting || stgData.length === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                >
                    <Play size={18} />
                    {isExecuting ? '프로시저 실행 중... DB 반영 대기' : 'STG ➡️ PROD 이관 프로시저 실행'}
                </button>
            </div>
        </div>
    );
}