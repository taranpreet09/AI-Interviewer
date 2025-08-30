import React from 'react';

const AiAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-cyan-800 flex items-center justify-center text-cyan-200 font-bold text-sm">
        AI
    </div>
);

const UserAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-gray-200 font-bold text-sm">
        You
    </div>
);

const TypingIndicator = () => (
    <div className="flex items-center space-x-1">
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-typing-dot-1"></div>
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-typing-dot-2"></div>
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-typing-dot-3"></div>
    </div>
);

const ChatMessage = ({ message }) => {
    const isAi = message.role === 'ai';

    if (message.isTyping) {
        return (
             <div className="flex items-end space-x-3 max-w-lg animate-fade-in-slide-up">
                <AiAvatar />
                <div className="p-3 bg-gray-700 rounded-lg">
                    <TypingIndicator />
                </div>
            </div>
        )
    }

    return (
        <div className={`flex items-end space-x-3 max-w-2xl animate-fade-in-slide-up ${isAi ? 'self-start' : 'self-end flex-row-reverse space-x-reverse'}`}>
            {isAi ? <AiAvatar /> : <UserAvatar />}
            <div className={`p-3 rounded-lg whitespace-pre-wrap ${isAi ? 'bg-gray-700' : 'bg-blue-600'}`}>
                <p>{message.text}</p>
                {isAi && message.type === 'followup' && (
                    <div className="mt-2">
                        <span className="text-xs px-2 py-1 bg-yellow-800/50 text-yellow-300 rounded-full">
                            Follow-up
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;