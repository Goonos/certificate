// src/components/SolveModeBadge.jsx
import React from 'react';

export default function SolveModeBadge({ solveMode }) {
    // 🔥 방식에 따라 텍스트와 색상 완벽하게 분기
    const isEach = solveMode === 'single_each';
    const isEnd = solveMode === 'single_end' || solveMode === 'SINGLE';
    const isSingle = isEach || isEnd;

    let badgeText = 'OMR';
    if (isEach) badgeText = '한문제(해설)';
    else if (isEnd) badgeText = '한문제(종료)';

    return (
        <span style={{ 
            fontSize: '10px', 
            fontWeight: 800, 
            color: isSingle ? '#7c3aed' : '#0284c7', 
            background: isSingle ? '#f3e8ff' : '#e0f2fe', 
            padding: '2px 6px', 
            borderRadius: '6px',
            whiteSpace: 'nowrap'
        }}>
            {badgeText}
        </span>
    );
}