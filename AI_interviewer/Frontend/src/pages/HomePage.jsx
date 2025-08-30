import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api/interview';

const HomePage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        role: 'Software Engineer',
        company: '',
        interviewType: 'Technical'
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
            const submissionData = { ...formData };
            if (submissionData.interviewType === 'Technical') {
                submissionData.interviewType = 'DSA';
            }

            const response = await axios.post(`${API_URL}/start`, submissionData);
            const { sessionId, greeting } = response.data;
           navigate(`/interview/${sessionId}`, { state: { greeting: greeting } });
        } catch (err) {
            setError('Failed to start interview. Please check the backend server.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <div className="w-full max-w-lg">
                <h1 className="text-5xl font-bold mb-2 text-center">AI Interviewer</h1>
                <p className="text-lg mb-8 text-gray-400 text-center">Prepare for your next big role.</p>
                <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-lg shadow-lg">
                    <div className="mb-6">
                        <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">Role you're preparing for:</label>
                        <select id="role" name="role" value={formData.role} onChange={handleChange} className="w-full p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            <option>Software Engineer</option>
                            <option>Data Scientist</option>
                            <option>Product Manager</option>
                        </select>
                    </div>
                    <div className="mb-6">
                        <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">Target Company (Optional):</label>
                        <input type="text" id="company" name="company" value={formData.company} onChange={handleChange} placeholder="e.g., Google, Amazon" className="w-full p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    </div>
                    <div className="mb-8">
                        <label htmlFor="interviewType" className="block text-sm font-medium text-gray-300 mb-2">Round Type:</label>
                        <select id="interviewType" name="interviewType" value={formData.interviewType} onChange={handleChange} className="w-full p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            <option value="Technical">Technical</option>
                            <option value="HR">Behavioral / HR</option>
                            <option value="System Design">System Design</option>
                        </select>
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