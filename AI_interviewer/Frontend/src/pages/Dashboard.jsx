// /src/pages/Dashboard.jsx
// NEW FILE

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = 'http://localhost:5001/api/dashboard';

const Dashboard = () => {
    const { sessionId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${API_URL}/${sessionId}`);
                setData(response.data);
            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [sessionId]);

    if (loading) return <div className="text-center p-10">Loading Dashboard...</div>;
    if (!data) return <div className="text-center p-10 text-red-500">Could not load dashboard data.</div>;
    
    const COLORS = ['#0088FE', '#FF8042'];

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-4xl font-bold text-center mb-8 text-cyan-400">Analytics Dashboard</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Confidence Trend */}
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4 text-white">Confidence Trend (Behavioral)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data.confidenceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                            <XAxis dataKey="question" stroke="#A0AEC0" />
                            <YAxis domain={[0, 5]} stroke="#A0AEC0" />
                            <Tooltip contentStyle={{ backgroundColor: '#2D3748', border: 'none' }} />
                            <Legend />
                            <Line type="monotone" dataKey="score" stroke="#38B2AC" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Time per Question */}
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4 text-white">Time per Question (seconds)</h2>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.timeData}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                            <XAxis dataKey="question" stroke="#A0AEC0" />
                            <YAxis stroke="#A0AEC0" />
                            <Tooltip contentStyle={{ backgroundColor: '#2D3748', border: 'none' }} />
                            <Bar dataKey="time" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Coding Accuracy */}
                {data.accuracyData[0].value > 0 || data.accuracyData[1].value > 0 ? (
                    <div className="bg-gray-800 p-6 rounded-lg lg:col-span-2 flex flex-col items-center">
                        <h2 className="text-xl font-semibold mb-4 text-white">Coding Accuracy</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={data.accuracyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                    {data.accuracyData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#2D3748', border: 'none' }}/>
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : null}
            </div>
            <div className="text-center mt-10">
                <Link to={`/report/${sessionId}`} className="bg-cyan-600 text-white font-sans px-8 py-3 rounded-md hover:bg-cyan-700">View Summary Report</Link>
            </div>
        </div>
    );
};

export default Dashboard;