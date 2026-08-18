import React from 'react';

// 💡 1. &lt; &gt; 형태로 이스케이프된 HTML 문자열을 진짜 < > 태그로 복원하는 헬퍼 함수
const unescapeHTML = (html) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || html;
};

const QuestionCard = ({ question, index }) => {
    // DB의 PASSAGE_TEXT(지문)와 QUESTION_TEXT(문제) 추출
    const rawPassage = question.PASSAGE_TEXT || question.passageText || '';
    const rawQuestion = question.QUESTION_TEXT || question.questionText || '';

    // HTML 태그 이스케이프 디코딩 처리
    const passageHtml = rawPassage.includes('&lt;') ? unescapeHTML(rawPassage) : rawPassage;
    const questionText = rawQuestion.includes('&lt;') ? unescapeHTML(rawQuestion) : rawQuestion;

    return (
        <div id={`q-${index + 1}`} className="question-card">
            {/* 1. 문제 헤더 & 문제 질문 (QUESTION_TEXT) */}
            <div className="question-header">
                <span className="q-number">{index + 1}.</span>
                <div className="q-title-box">
                    {/* 만약 문제 본문에도 HTML 태그가 들어갈 수 있다면 dangerouslySetInnerHTML 사용 */}
                    <p 
                        className="q-title"
                        dangerouslySetInnerHTML={{ __html: questionText || '다음 설명을 읽고 올바른 것을 고르시오.' }}
                    />
                </div>
            </div>

            {/* 2. 지문 (PASSAGE_TEXT) 영역: 지문이 존재할 때만 크롤링 원본 HTML 스타일 그대로 렌더링 */}
            {passageHtml && (
                <div 
                    className="passage-box"
                    dangerouslySetInnerHTML={{ __html: passageHtml }}
                />
            )}

            {/* 3. 보기 (OPTIONS) 버튼 영역 */}
            <div className="options-group">
                <button className="option-btn">
                    <span className="opt-number">1</span>
                    <span className="opt-text">{question.OPTION_1 || question.option1}</span>
                </button>
                <button className="option-btn">
                    <span className="opt-number">2</span>
                    <span className="opt-text">{question.OPTION_2 || question.option2}</span>
                </button>
                <button className="option-btn">
                    <span className="opt-number">3</span>
                    <span className="opt-text">{question.OPTION_3 || question.option3}</span>
                </button>
                <button className="option-btn">
                    <span className="opt-number">4</span>
                    <span className="opt-text">{question.OPTION_4 || question.option4}</span>
                </button>
            </div>
        </div>
    );
};

export default QuestionCard;