// src/components/OmrRow.jsx
import React from 'react';

export default function OmrRow({ q, answerVal, onAnswerChange, isOcp, onClick }) {
    const isMultipleChoice = q.options && q.options.length > 0;
    const currentAnswer = String(answerVal || '');
    const hasAnswer = currentAnswer.trim() !== '';

    return (
        <div className="omr-row" onClick={onClick}>
            <span className="omr-q-num">{q.qNo}번</span>
            
            {isMultipleChoice ? (
                // 🔥 4개(ABCD) 출력 후 줄바꿈 되도록 설정된 공통 UI
                <div className="omr-bubbles" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 26px)' }}>
                    {q.options.map((_, idx) => {
                        const optNo = isOcp ? String.fromCharCode(65 + idx) : String(idx + 1);
                        const isSelected = isOcp ? currentAnswer.includes(optNo) : currentAnswer === optNo;

                        return (
                            <button
                                key={optNo}
                                className={`omr-bubble ${isSelected ? 'checked' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAnswerChange(q.qNo, optNo, isOcp);
                                }}
                            >
                                {optNo}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="omr-short-status">
                    {hasAnswer ? <div className="omr-short-answer-display">{currentAnswer}</div> : <span className="omr-badge empty">미작성</span>}
                </div>
            )}
        </div>
    );
}