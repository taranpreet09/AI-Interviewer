// /src/components/ScoreCard.jsx
// NEW FILE

import React from 'react';

const ScoreCard = ({ title, scores, feedback, question }) => {
    
    const renderScores = () => {
        if (!scores) return null;
        return Object.entries(scores).map(([key, value]) => (
            <div key={key} className="text-center">
                <p className="text-2xl font-bold text-cyan-400">{value}<span className="text-base text-gray-400">/5</span></p>
                <p className="text-xs uppercase text-gray-400">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
            </div>
        ));
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
            <h4 className="font-semibold text-lg text-gray-200 mb-2">{title}</h4>
            <p className="text-sm text-gray-400 italic mb-3">"{question}"</p>
            <div className="flex justify-around items-center bg-gray-900/50 p-3 rounded-md mb-3">
                {renderScores()}
            </div>
            <div>
                <h5 className="font-bold text-sm text-gray-300">AI Feedback:</h5>
                <p className="text-sm text-gray-400">{feedback}</p>
            </div>
        </div>
    );
};

export default ScoreCard;