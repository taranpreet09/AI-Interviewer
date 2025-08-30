import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
const API_URL = 'http://localhost:5001/api';
const FeedbackCard = ({ item }) => {
    const colorMap = {
        behavioral: 'blue',
        theory: 'purple',
        coding: 'green'
    };
    const color = colorMap[item.category] || 'gray';

    return (
        <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} className="bg-gray-800/50 p-6 rounded-lg">
            <h3 className={`text-lg font-semibold mb-2 text-${color}-400`}>Question: <span className="text-gray-200 font-normal">"{item.question}"</span></h3>
             <div className="bg-gray-900/70 p-3 rounded-md mb-3">
                <p className="text-sm text-gray-400 italic whitespace-pre-wrap">{item.answer}</p>
            </div>
            <div className="text-sm space-y-2">
                <p><strong className={`font-semibold text-${color}-400`}>Score:</strong> {(item.score || 0).toFixed(1)} / 5.0</p>
                <p><strong className={`font-semibold text-${color}-400`}>Details:</strong> {item.details || 'N/A'}</p>
                <p><strong className={`font-semibold text-${color}-400`}>Tips:</strong> {item.tips || 'N/A'}</p>
            </div>
        </motion.div>
    );
};


const ReportPage = () => {
    const { sessionId } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
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

    if (loading) return <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white"><div className="text-2xl">Generating your detailed report...</div></div>;
    if (!report) return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Could not load report.</div>;

    const radarData = [
        { subject: 'Behavioral', score: report.finalScores?.behavioral || 0, fullMark: 5 },
        { subject: 'Theory', score: report.finalScores?.theory || 0, fullMark: 5 },
        { subject: 'Coding', score: report.finalScores?.coding || 0, fullMark: 5 },
    ];
    
    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

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
                            <h3 className="text-xl font-semibold mb-3 text-center">Recruiter Summary</h3>
                            <div className="space-y-3 text-sm">
                                <p><strong className="text-green-400">Strengths:</strong> {report.summary.strengths}</p>
                                <p><strong className="text-yellow-400">Weaknesses:</strong> {report.summary.weaknesses}</p>
                                <p><strong className="text-cyan-400">Next Steps:</strong> {report.summary.nextSteps}</p>
                            </div>
                        </motion.div>
                        <motion.div variants={itemVariants} className="bg-gray-800 p-6 rounded-lg flex flex-col justify-center items-center">
                            <h3 className="text-xl font-semibold mb-4">Overall Skill Radar</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="#4A5568"/>
                                    <PolarAngleAxis dataKey="subject" stroke="#A0AEC0" fontSize={14}/>
                                    <Radar name="Average Score" dataKey="score" stroke="#38B2AC" fill="#38B2AC" fillOpacity={0.7} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}/>
                                </RadarChart>
                            </ResponsiveContainer>
                        </motion.div>
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                         <h2 className="text-2xl font-bold text-white">Detailed Answer Analysis</h2>
                        {report.detailedFeedback && report.detailedFeedback.length > 0 ? (
                            report.detailedFeedback.map((item, index) => (
                                <FeedbackCard key={index} item={item} />
                            ))
                        ) : (
                            <p>No detailed feedback available.</p>
                        )}
                    </div>
                </div>

                <motion.div variants={itemVariants} className="flex justify-center gap-6 mt-12">
                    <Link to="/" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-md transition duration-300">Start New Interview</Link>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default ReportPage;