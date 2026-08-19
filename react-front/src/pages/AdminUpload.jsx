import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, KeyRound, UploadCloud } from 'lucide-react';

export default function AdminUpload() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [savedPassword, setSavedPassword] = useState('');
    const [authError, setAuthError] = useState('');

    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

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
        <div style={{ padding: '30px 20px', maxWidth: '560px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck color="#16a34a" size={24} /> 관리자 백오피스
                </h2>
                <button 
                    onClick={handleLogout}
                    style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                    잠금
                </button>
            </div>
            
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
            }}>
                <p style={{ marginBottom: '20px', color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>
                    크롤링이나 수작업으로 완성된 <strong>기출문제 엑셀 파일(.xlsx)</strong>을 업로드해 주세요.<br/>
                    데이터는 <code>QUESTION_STG</code> 테이블로 일괄 적재됩니다.
                </p>

                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '24px', textAlign: 'center', marginBottom: '20px', background: '#f8fafc' }}>
                    <UploadCloud size={36} color="#64748b" style={{ marginBottom: '8px' }} />
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleFileChange}
                        style={{ display: 'block', margin: '0 auto', fontSize: '13px' }}
                    />
                </div>

                <button 
                    onClick={handleUpload} 
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        backgroundColor: isLoading ? '#9ca3af' : '#16a34a',
                        color: 'white',
                        padding: '14px',
                        borderRadius: '12px',
                        border: 'none',
                        fontWeight: '800',
                        fontSize: '14px',
                        cursor: isLoading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isLoading ? 'DB 적재 중... ⏳' : '엑셀 업로드 및 DB 적재 🚀'}
                </button>
            </div>
        </div>
    );
}