// AI_interviewer/Frontend/src/pages/ReportPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import FeedbackCard from '../components/FeedbackCard';

const API_URL = 'http://localhost:5001/api';

const ReportPage = () => {
    const { sessionId } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState('Initiating report generation...');

    useEffect(() => {
        // This function will repeatedly check the report status until it's 'completed' or 'failed'
        const pollForCompletion = async (reportId, maxAttempts = 40) => {
            let attempts = 0;
            const pollInterval = 3000; // Poll every 3 seconds

            const poll = async () => {
                if (attempts >= maxAttempts) {
                    setError('Report generation is taking longer than expected. Please refresh the page in a moment.');
                    setLoading(false);
                    return;
                }
                attempts++;
                setLoadingMessage(`Analyzing your responses... This may take up to a minute. (${attempts})`);
                
                try {
                    const statusResponse = await axios.get(`${API_URL}/report/status/${reportId}`);
                    
                    if (statusResponse.data.status === 'completed') {
                        setReport(statusResponse.data.data);
                        setLoading(false);
                    } else if (statusResponse.data.status === 'failed') {
                        setError('An error occurred during report generation. Please try again.');
                        setLoading(false);
                    } else {
                        // If status is 'pending' or 'processing', poll again after the interval
                        setTimeout(poll, pollInterval);
                    }
                } catch (pollError) {
                    console.error('Polling error:', pollError);
                    setError('Unable to check report status. Please refresh the page.');
                    setLoading(false);
                }
            };
            
            // Start the polling process
            poll();
        };

        const initiateReportGeneration = async () => {
            try {
                // This is the initial call to our new smart endpoint
                const response = await axios.get(`${API_URL}/report/session/${sessionId}`);
                
                if (response.status === 200) {
                    // Status 200 means the report was already generated and is complete
                    setReport(response.data);
                    setLoading(false);
                } else if (response.status === 202) {
                    // Status 202 means the report generation has started, so we begin polling
                    const { reportId } = response.data;
                    pollForCompletion(reportId);
                }
            } catch (err) {
                console.error("Failed to fetch or generate report:", err);
                setError(err.response?.data?.message || 'Failed to start report generation. The session may not be complete or may not exist.');
                setLoading(false);
            }
        };

        initiateReportGeneration();
    }, [sessionId]);

    const groupedFeedback = useMemo(() => {
        if (!report || report.interviewMode !== 'full' || !report.detailedFeedback) {
            return null;
        }
        return report.detailedFeedback.reduce((acc, item) => {
            const stage = item.stage || 1;
            if (!acc[stage]) acc[stage] = [];
            acc[stage].push(item);
            return acc;
        }, {});
    }, [report]);

    // --- RENDER LOGIC ---

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
                <div className="text-2xl mb-4">{loadingMessage}</div>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
                <p className="text-gray-400 text-center max-w-md">
                    Our AI is carefully analyzing each of your responses to provide detailed feedback. 
                    This process can sometimes take up to a minute.
                </p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
                <div className="text-2xl text-red-400 mb-4">Report Generation Error</div>
                <p className="text-gray-400 mb-6 text-center max-w-md">{error}</p>
                <div className="space-x-4">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Try Again
                    </button>
                    <Link 
                        to="/" 
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    if (!report) {
         return (
            <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
                <div className="text-center">
                    <div className="text-2xl mb-4">Report Not Available</div>
                    <p className="text-gray-400 mb-6">We could not find a report for this session.</p>
                    <Link to="/" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded">
                        Start New Interview
                    </Link>
                </div>
            </div>
        );
    }

    const radarData = [
        { subject: 'Behavioral', score: report.finalScores?.behavioral || 0, fullMark: 5 },
        { subject: 'Theory/Design', score: report.finalScores?.theory || 0, fullMark: 5 },
        { subject: 'Coding', score: report.finalScores?.coding || 0, fullMark: 5 },
    ];
    
    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };
    const stageNames = { 1: 'Stage 1: Technical Screen', 2: 'Stage 2: Technical Deep-Dive', 3: 'Stage 3: Final Behavioral' };

    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 md:p-8">
            <motion.div className="max-w-6xl mx-auto" variants={containerVariants} initial="hidden" animate="visible">
                <motion.div variants={itemVariants} className="text-center mb-10">
                    <h1 className="text-3xl md:text-5xl font-bold text-cyan-400">Interview Performance Report</h1>
                    <p className="text-lg text-gray-400 mt-2">{report.role} @ {report.company || 'Showcase Project'}</p>
                </motion.div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    <div className="lg:col-span-1 space-y-8">
                        <motion.div variants={itemVariants} className="bg-gray-800 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-3 text-center text-white">Recruiter Summary</h3>
                            <div className="space-y-3 text-sm">
                                <p><strong className="text-green-400">Strengths:</strong> {report.summary?.strengths || 'N/A'}</p>
                                <p><strong className="text-yellow-400">Weaknesses:</strong> {report.summary?.weaknesses || 'N/A'}</p>
                                <p><strong className="text-cyan-400">Next Steps:</strong> {report.summary?.nextSteps || 'N/A'}</p>
                            </div>
                        </motion.div>
                        <motion.div variants={itemVariants} className="bg-gray-800 p-6 rounded-lg flex flex-col justify-center items-center">
                            <h3 className="text-xl font-semibold mb-4 text-white">Overall Skill Radar</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="#4A5568"/>
                                    <PolarAngleAxis dataKey="subject" stroke="#A0AEC0" fontSize={14}/>
                                    <Radar name="Score" dataKey="score" stroke="#38B2AC" fill="#38B2AC" fillOpacity={0.7} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}/>
                                </RadarChart>
                            </ResponsiveContainer>
                        </motion.div>
                    </div>

                    <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                        <h2 className="text-2xl font-bold text-white">Detailed Answer Analysis</h2>
                        
                        {groupedFeedback ? (
                            Object.entries(groupedFeedback).map(([stage, feedbackItems]) => (
                                <div key={stage}>
                                    <h3 className="text-xl font-semibold text-cyan-400 mb-4 border-b border-gray-700 pb-2">
                                        {stageNames[stage]}
                                    </h3>
                                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                                        {feedbackItems.map((item, index) => (
                                            <FeedbackCard key={index} item={item} />
                                        ))}
                                    </motion.div>
                                </div>
                            ))
                        ) : (
                            report.detailedFeedback?.length > 0 ? (
                                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                                    {report.detailedFeedback.map((item, index) => (
                                        <FeedbackCard key={index} item={item} />
                                    ))}
                                </motion.div>
                            ) : (
                                <p className="text-gray-400">No detailed feedback available for this session.</p>
                            )
                        )}
                    </motion.div>
                </div>

                <motion.div variants={itemVariants} className="flex justify-center gap-6 mt-12">
                    <Link to="/" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-md transition duration-300">Start New Interview</Link>
                    <Link to={`/dashboard/${sessionId}`} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-md transition duration-300">View Analytics</Link>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default ReportPage;