// /src/pages/ReportPage.jsx
// REPLACED FILE - This is the new professional analytics dashboard.

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';

const API_URL = 'http://localhost:5001/api';

const ReportPage = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const videoRef = useRef(null);

    // Re-acquire camera for the self-view thumbnail
    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
            .catch(err => console.error("Error accessing camera:", err));
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Fetch the analyzed report data
    useEffect(() => {
        const fetchReport = async () => {
            try {
                const response = await axios.get(`${API_URL}/analyze/session/${sessionId}`);
                setReport(response.data);
            } catch (err) {
                console.error("Failed to fetch report:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [sessionId]);

    const handleDownloadPdf = () => {
        // A simple way to generate a PDF - more advanced libraries like jsPDF can be used.
        window.print();
    };

    if (loading) return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Generating your report...</div>;
    if (!report) return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Could not load report.</div>;

    const radarData = [
        { subject: 'Behavioral', score: report.scores.behavioral, fullMark: 5 },
        { subject: 'Theory', score: report.scores.theory, fullMark: 5 },
        { subject: 'Coding', score: report.scores.coding, fullMark: 5 },
    ];
    
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 },
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen p-8 relative">
            {/* Self-view video remains */}
            <div className="absolute top-6 right-6 w-40 h-30 bg-black rounded-lg shadow-lg border border-gray-700">
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover rounded-lg"></video>
            </div>

            <motion.div 
                className="max-w-5xl mx-auto"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <motion.div variants={itemVariants} className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-cyan-400">Interview Performance Report</h1>
                    <p className="text-lg text-gray-400 mt-2">{report.role} for {report.company}</p>
                </motion.div>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* Charts Column */}
                    <motion.div variants={itemVariants} className="lg:col-span-1 bg-gray-800 p-6 rounded-lg flex flex-col justify-center items-center">
                        <h3 className="text-xl font-semibold mb-4">Skill Breakdown</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#4A5568"/>
                                <PolarAngleAxis dataKey="subject" stroke="#A0AEC0"/>
                                <PolarRadiusAxis angle={30} domain={[0, 5]} stroke="#4A5568"/>
                                <Radar name={report.candidate} dataKey="score" stroke="#38B2AC" fill="#38B2AC" fillOpacity={0.6} />
                                <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}/>
                            </RadarChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* Feedback & Summary Column */}
                    <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                        <div className="bg-gray-800 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-3">Feedback by Category</h3>
                            <div className="space-y-3 text-sm">
                                <p><strong className="text-blue-400">Behavioral:</strong> {report.feedback.behavioral}</p>
                                <p><strong className="text-purple-400">Theory:</strong> {report.feedback.theory}</p>
                                <p><strong className="text-green-400">Coding:</strong> {report.feedback.coding}</p>
                            </div>
                        </div>
                         <div className="bg-gray-800 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-3">Overall Summary</h3>
                            <p className="text-gray-300">{report.summary}</p>
                        </div>
                    </motion.div>
                </div>

                {/* Action Buttons */}
                <motion.div variants={itemVariants} className="flex justify-center gap-6 mt-12">
                     <button onClick={handleDownloadPdf} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-md transition duration-300">
                        Download Report
                    </button>
                    <button onClick={() => navigate('/')} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-md transition duration-300">
                        Start New Interview
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default ReportPage;