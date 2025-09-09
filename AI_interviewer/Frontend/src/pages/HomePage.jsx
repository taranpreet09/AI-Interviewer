// src/pages/HomePage.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api/interview';

const HomePage = () => {
    const navigate = useNavigate();
    // --- MODIFIED: Add interviewMode to the form state ---
    const [formData, setFormData] = useState({
    role: '', // Start with an empty string
    company: '',
    interviewType: 'Technical Screen', // Or 'Behavioral' as a default for specific mode
    interviewMode: 'specific'
});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // --- MODIFIED: The payload now directly reflects the form state ---
            const response = await axios.post(`${API_URL}/start`, formData);
            const { sessionId, greeting } = response.data;
           navigate(`/interview/${sessionId}`, { state: { greeting: greeting } });
        } catch (err) {
            setError('Failed to start interview. Please check the backend server.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    // --- ADDED: Dynamic options based on the selected mode ---
const getInterviewTypeOptions = () => {
    return [
        { value: 'Behavioral', label: 'Behavioral Round' },
        { value: 'System Design', label: 'System Design Round' },
        { value: 'Coding Challenge', label: 'Coding Challenge' },
        { value: 'Technical Screen', label: 'Technical Screen' }, // You can add this back if desired for specific mode
    ];
};


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <div className="w-full max-w-lg">
                <h1 className="text-5xl font-bold mb-2 text-center">AI Interviewer</h1>
                <p className="text-lg mb-8 text-gray-400 text-center">Prepare for your next big role.</p>
                <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-lg shadow-lg">
                    {/* --- ADDED: UI for selecting Interview Mode --- */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Choose your preparation mode:</label>
                        <div className="flex bg-gray-700 rounded-md p-1">
                            <button type="button" onClick={() => setFormData({...formData, interviewMode: 'specific', interviewType: 'Behavioral'})} className={`w-1/2 p-2 rounded ${formData.interviewMode === 'specific' ? 'bg-cyan-600' : ''}`}>
                                Specific Round
                            </button>
                            <button type="button" onClick={() => setFormData({...formData, interviewMode: 'full', interviewType: 'Full Simulation'})} className={`w-1/2 p-2 rounded ${formData.interviewMode === 'full' ? 'bg-cyan-600' : ''}`}>
                                Full Interview
                            </button>

                        </div>
                    </div>
                    
                    {/* --- MODIFIED: Role and Type selectors --- */}
                    <div className="mb-6">
    <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">Your Target Role:</label>
    <input
        type="text"
        id="role"
        name="role"
        value={formData.role}
        onChange={handleChange}
        placeholder="e.g., Senior Backend Engineer"
        className="w-full p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
        required
    />
</div>
                    
                    {formData.interviewMode === 'specific' && (
    <div className="mb-8">
        <label htmlFor="interviewType" className="block text-sm font-medium text-gray-300 mb-2">
            Round Type:
        </label>
        <select id="interviewType" name="interviewType" value={formData.interviewType} onChange={handleChange} className="w-full p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
           {getInterviewTypeOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
                    )}
                    <div className="mb-6">
                        <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">Target Company :</label>
                        <input type="text" id="company" name="company" value={formData.company} onChange={handleChange} placeholder="e.g., Google, Amazon" className="w-full p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:opacity-50">
                        {loading ? 'Starting...' : 'Start Interview'}
                    </button>
                    {error && <p className="text-red-500 text-center mt-4">{error}</p>}
                </form>
            </div>
        </div>
    );
};

export default HomePage;