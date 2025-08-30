import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import InterviewRoom from './pages/InterviewRoom';
import ReportPage from './pages/ReportPage';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="bg-gray-900 text-white min-h-screen font-sans">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/interview/:sessionId" element={<InterviewRoom />} />
          <Route path="/report/:sessionId" element={<ReportPage />} />
           <Route path="/dashboard/:sessionId" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;