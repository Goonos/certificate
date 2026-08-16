// src/pages/Home.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BookOpenCheck, ChevronRight } from 'lucide-react';

export default function Home() {
    const navigate = useNavigate();
    return (
        <div className="safari-body">
        <div className="menu-grid">
            {/* 자격증 공부 메뉴 */}
            <div className="menu-card" onClick={() => navigate('/cert-exam')}>
                <div className="card-info">
                    <div className="card-icon-wrapper">
                        <Award size={26} />
                    </div>
                    <div className="card-text">
                        <h3>자격증 공부</h3>
                    </div>
                </div>
                <ChevronRight className="card-arrow" size={20} />
            </div>

            {/* 나만의 공부 (준비중) */}
            <div className="menu-card" onClick={() => alert('준비중입니다.')}>
                <div class="card-info">
                    <div className="card-icon-wrapper" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                        <BookOpenCheck size={26} />
                    </div>
                    <div className="card-text">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            나만의 공부 <span className="card-badge">준비중</span>
                        </h3>
                    </div>
                </div>
                <ChevronRight className="card-arrow" size={20} />
            </div>
        </div>
    </div>
    );
}