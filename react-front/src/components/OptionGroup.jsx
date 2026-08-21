// src/components/OptionGroup.jsx
import React from 'react';

export default function OptionGroup({ q, currentAnswer, onAnswerChange, isOcp }) {
    if (!q.options || q.options.length === 0) return null;

    return (
        <div className="options-group">
            {q.options.map((opt, idx) => {
                // 🔥 OCP면 A, B, C... 일반 과목이면 1, 2, 3...
                const optVal = isOcp ? String.fromCharCode(65 + idx) : String(idx + 1);
                
                const currentAnsStr = String(currentAnswer || '');
                
                // 🔥 다중 선택(OCP)과 단일 선택 상태 호환
                const isSelected = isOcp 
                    ? currentAnsStr.split(',').includes(optVal)
                    : currentAnsStr === optVal;

                return (
                    <button 
                        key={optVal} 
                        className={`option-btn ${isSelected ? 'selected' : ''}`} 
                        onClick={() => {
                            if (isOcp) {
                                const prevArr = currentAnsStr ? currentAnsStr.split(',') : [];
                                if (prevArr.includes(optVal)) {
                                    onAnswerChange(q.qNo, prevArr.filter(x => x !== optVal).join(','));
                                } else {
                                    onAnswerChange(q.qNo, [...prevArr, optVal].sort().join(','));
                                }
                            } else {
                                onAnswerChange(q.qNo, optVal);
                            }
                        }}
                    >
                        <span className="opt-number">{optVal}</span>
                        <span className="opt-text">{opt}</span>
                    </button>
                );
            })}
        </div>
    );
}