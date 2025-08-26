// src/components/ChatMessage.jsx
import React from 'react';

const ChatMessage = ({ message }) => {
    const isAI = message.sender === 'ai';
    const isCodeResult = message.sender === 'coderesult';

    const baseStyle = "p-3 rounded-lg max-w-lg mb-2 whitespace-pre-wrap";
    const aiStyle = "bg-gray-700 text-white self-start";
    const userStyle = "bg-blue-600 text-white self-end";
    const codeResultStyle = "bg-gray-800 text-sm text-green-400 font-mono w-full self-start";

    const getStyle = () => {
        if (isAI) return `${baseStyle} ${aiStyle}`;
        if (isCodeResult) return `${baseStyle} ${codeResultStyle}`;
        return `${baseStyle} ${userStyle}`;
    }

    return (
        <div className={`flex ${isAI || isCodeResult ? 'justify-start' : 'justify-end'} w-full`}>
            <div className={getStyle()}>
                {message.text}
            </div>
        </div>
    );
};

export default ChatMessage;