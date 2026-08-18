import React, { useState } from 'react';

const AdminUpload = () => {
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) {
            alert('엑셀 파일을 먼저 선택해 주세요!');
            return;
        }

        // 파일 전송을 위한 FormData 생성
        const formData = new FormData();
        formData.append('excelFile', file); // 백엔드의 upload.single('excelFile')과 이름 매칭

        setIsLoading(true);

        try {
            const response = await fetch('/api/admin/upload-excel', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                alert(`✅ 업로드 완료!\n${result.message}`);
                setFile(null); // 초기화
            } else {
                alert(`❌ 업로드 실패: ${result.error}\n${result.details || ''}`);
            }
        } catch (error) {
            alert(`네트워크 오류가 발생했습니다: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
                ⚙️ 관리자 백오피스: 기출문제 등록
            </h2>
            
            <div style={{
                background: 'var(--bg-card, #fff)',
                border: '1px solid var(--border-subtle, #e5e7eb)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <p style={{ marginBottom: '16px', color: '#4b5563' }}>
                    크롤링이나 수작업으로 완성된 <strong>기출문제 엑셀 파일(.xlsx)</strong>을 업로드해 주세요.
                    데이터는 <code>QUESTION_STG</code> 테이블로 일괄 적재됩니다.
                </p>

                <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleFileChange}
                    style={{ marginBottom: '20px', display: 'block' }}
                />

                <button 
                    onClick={handleUpload} 
                    disabled={isLoading}
                    style={{
                        backgroundColor: isLoading ? '#9ca3af' : '#16a34a',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: isLoading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isLoading ? 'DB 적재 중... ⏳' : '엑셀 업로드 및 DB 적재 🚀'}
                </button>
            </div>
        </div>
    );
};

export default AdminUpload;