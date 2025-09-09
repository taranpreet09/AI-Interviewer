// src/components/FeedbackCard.jsx

import React from 'react';
import { motion } from 'framer-motion';

const FeedbackCard = ({ item }) => {
    const colorMap = {
        behavioral: 'blue',
        theory: 'purple',
        coding: 'green'
    };
    const color = colorMap[item.category] || 'gray';

    const itemVariants = { 
        hidden: { y: 20, opacity: 0 }, 
        visible: { y: 0, opacity: 1 } 
    };

    return (
        <motion.div variants={itemVariants} className="bg-gray-800/50 p-6 rounded-lg">
            <h3 className={`text-lg font-semibold mb-2 text-${color}-400`}>
                Question: <span className="text-gray-200 font-normal">"{item.question}"</span>
            </h3>
            
            <div className="bg-gray-900/70 p-4 rounded-md mb-4">
                <p className="text-sm font-semibold text-gray-400 mb-2">Your Answer:</p>
                <p className="text-sm text-gray-300 italic whitespace-pre-wrap">{item.answer}</p>
            </div>

            <div className="text-sm space-y-2">
                <p>
                    <strong className={`font-semibold text-${color}-400`}>Score:</strong> 
                    <span className="font-bold text-white ml-2">{(item.score || 0).toFixed(1)} / 5.0</span>
                </p>
                <p>
                    <strong className={`font-semibold text-${color}-400`}>AI Analysis:</strong> 
                    <span className="text-gray-300 ml-2">{item.details || 'N/A'}</span>
                </p>
                <p>
                    <strong className={`font-semibold text-${color}-400`}>Improvement Tip:</strong> 
                    <span className="text-gray-300 ml-2">{item.tips || 'N/A'}</span>
                </p>
            </div>
        </motion.div>
    );
};

export default FeedbackCard;