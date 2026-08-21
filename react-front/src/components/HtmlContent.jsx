// src/components/HtmlContent.jsx
import React from 'react';

export default function HtmlContent({ content, type = 'passage' }) {
    if (!content) return null;

    // 🔥 이미지 리사이징 및 깨진 태그 복원 공통 함수
    const formatHtmlContent = (str) => {
        let html = str.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        return html.replace(/<img([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/(width|height)\s*=\s*["'][^"']*["']/gi, '');
            return `<img ${cleanAttrs} width="100%" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
        });
    };

    // 지문(Passage)용 스타일
    if (type === 'passage') {
        return (
            <div 
                style={{ 
                    background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', 
                    fontSize: '13px', color: '#334155', border: '1px solid #e2e8f0', 
                    marginBottom: '16px', whiteSpace: 'pre-wrap', lineHeight: '1.5',
                    display: 'block', width: '100%', maxWidth: '100%', 
                    overflowX: 'auto', WebkitOverflowScrolling: 'touch', 
                    overscrollBehaviorX: 'contain', touchAction: 'pan-x'
                }}
                dangerouslySetInnerHTML={{ __html: formatHtmlContent(content) }}
            />
        );
    }

    // 해설(Explanation)용 기본 스타일
    return (
        <div 
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto' }}
            dangerouslySetInnerHTML={{ __html: formatHtmlContent(content) }}
        />
    );
}