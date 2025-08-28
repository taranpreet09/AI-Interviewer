// src/pages/InterviewSelection.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api/interview';

const InterviewSelection = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSelect = async (type) => {
        setLoading(true);
        setError('');
        try {
            const response = await axios.post(`${API_URL}/start`, { interviewType: type });
            const { sessionId, firstQuestion } = response.data;
            navigate(`/interview/${sessionId}`, { state: { initialQuestion: firstQuestion } });
        } catch (err) {
            setError('Failed to start the interview. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const interviewTypes = ['DSA', 'System Design', 'HR'];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <h1 className="text-4xl font-bold mb-8">AI Interviewer</h1>
            <p className="text-lg mb-10 text-gray-300">Choose your interview type to begin.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                {interviewTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => handleSelect(type)}
                        disabled={loading}
                        className="p-8 bg-gray-800 rounded-lg text-2xl font-semibold hover:bg-blue-600 transition-colors duration-300 disabled:opacity-50"
                    >
                        {loading ? 'Starting...' : type}
                    </button>
                ))}
            </div>
            {error && <p className="text-red-500 mt-6">{error}</p>}
        </div>
    );
};

export default InterviewSelection;