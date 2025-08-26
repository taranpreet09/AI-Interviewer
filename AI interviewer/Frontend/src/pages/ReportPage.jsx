// /src/pages/ReportPage.jsx
// REPLACED FILE - New structured report format

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api/interview';

const ReportPage = () => {
    const { sessionId } = useParams();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    // ... (error state)

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const response = await axios.get(`${API_URL}/session/${sessionId}`);
                setSession(response.data);
            } catch (err) {
                // ... error handling
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
    }, [sessionId]);

    if (loading) return <div className="text-center p-10">Generating your detailed report...</div>;
    if (!session || !session.report) return <div className="text-center p-10 text-red-500">Could not load report.</div>;
    
    const { report, role, company, interviewType } = session;

    const renderScoreLine = (label, data) => (
        `${label.padEnd(12)}: ${data.score}/5 (${data.feedback})`
    );

    return (
        <div className="container mx-auto p-6 max-w-4xl font-mono">
            <h1 className="text-3xl font-bold text-center mb-6 text-cyan-400">Interview Performance Report</h1>
            
            <div className="bg-gray-800 p-6 rounded-lg mb-8 text-sm text-gray-300 whitespace-pre-wrap">
                <p>{`Candidate:     Anonymous`}</p>
                <p>{`Role Target:   ${role} @ ${company}`}</p>
                <p>{`Round:         ${interviewType}`}</p>
                <hr className="my-3 border-gray-600" />
                {report.finalScores.behavioral && <p>{renderScoreLine('Behavioral', report.finalScores.behavioral)}</p>}
                {report.finalScores.theory && <p>{renderScoreLine('Theory', report.finalScores.theory)}</p>}
                {report.finalScores.coding && <p>{renderScoreLine('Coding', report.finalScores.coding)}</p>}
                <hr className="my-3 border-gray-600" />
                <p className="font-bold">Summary:</p>
                <p>{report.summary}</p>
            </div>

            {/* Detailed Feedback Sections */}
            <div className="space-y-6">
                {report.behavioralAnalysis.length > 0 && (
                    <div>
                        <h2 className="text-xl font-semibold mb-3 border-b border-gray-700 pb-1">Behavioral Feedback</h2>
                        {report.behavioralAnalysis.map((item, index) => (
                            <div key={index} className="bg-gray-800/50 p-4 rounded-md mb-3">
                                <p className="italic text-gray-400">Q: "{item.questionText}"</p>
                                <p className="mt-2 text-sm">Scores - Clarity: {item.scores.clarity}, Confidence: {item.scores.confidence}, STAR: {item.scores.starCompleteness}</p>
                                <p className="mt-1 text-sm"><span className="font-bold">Feedback:</span> {item.feedback}</p>
                            </div>
                        ))}
                    </div>
                )}
                 {/* Add similar blocks for Theory and Coding analysis if they exist */}
            </div>

            <div className="text-center mt-10">
                <Link to="/" className="bg-cyan-600 text-white font-sans px-8 py-3 rounded-md hover:bg-cyan-700">Start New Interview</Link>
            </div>
        </div>
    );
};

export default ReportPage;