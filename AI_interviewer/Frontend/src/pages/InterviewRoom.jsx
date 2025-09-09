// src/pages/InterviewRoom.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Draggable from 'react-draggable';
import ChatMessage from '../components/ChatMessage';
import CodeEditor from '../components/CodeEditor';

const API_URL = 'http://localhost:5001/api/interview';

const StageIndicator = ({ stage }) => {
    const stageNames = {
        1: 'Technical Screen',
        2: 'Technical Deep-Dive',
        3: 'Final Behavioral'
    };
    if (!stageNames[stage]) return null;
    return (
        <div className="text-right">
            <p className="text-lg font-bold">Full Interview Mode</p>
            <p className="text-sm text-cyan-400">Stage {stage} of 3: {stageNames[stage]}</p>
        </div>
    );
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
}

const InterviewRoom = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    const videoRef = useRef(null);
    const chatEndRef = useRef(null);
    const draggableRef = useRef(null);

    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isCodingQuestion, setIsCodingQuestion] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [code, setCode] = useState('');
    const [questionCount, setQuestionCount] = useState(0);

    const [interviewMode, setInterviewMode] = useState(null);
    const [currentStage, setCurrentStage] = useState(1);
    const [sessionInitialized, setSessionInitialized] = useState(false);

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
    
    // Enhanced session initialization
    useEffect(() => {
        const fetchSessionAndSetGreeting = async () => {
            try {
                const response = await axios.get(`${API_URL}/session/${sessionId}`);
                const sessionData = response.data;
                
                setInterviewMode(sessionData.interviewMode);
                setCurrentStage(sessionData.currentStage);
                setQuestionCount(sessionData.history.length);

                // Only set greeting if this is a fresh session and we have a greeting from location state
                const greetingMessage = location.state?.greeting;
                if (greetingMessage && sessionData.history.length === 0 && messages.length === 0) {
                    setMessages([{ role: 'ai', text: greetingMessage, type: 'greeting' }]);
                } else if (sessionData.messages && sessionData.messages.length > 0) {
                    // Convert stored messages to our message format
                    const convertedMessages = sessionData.messages.map(msg => ({
                        role: msg.role === 'assistant' ? 'ai' : msg.role,
                        text: msg.content,
                        type: 'message'
                    }));
                    setMessages(convertedMessages);
                }
                
                setSessionInitialized(true);
            } catch (error) {
                console.error("Failed to fetch session details:", error);
                navigate('/'); // Redirect to home on error
            }
        };
        
        if (!sessionInitialized) {
            fetchSessionAndSetGreeting();
        }
    }, [sessionId, location.state, navigate, messages.length, sessionInitialized]);

    useEffect(() => {
        if (!recognition) return;
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            setTranscript(prev => prev + finalTranscript);
        };
        recognition.onend = () => setIsListening(false);
    }, []); // Empty dependency array means this setup runs only once

    useEffect(() => { 
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
    }, [messages, isTyping]);

    const toggleListen = () => {
        if (isListening) {
            recognition?.stop();
        } else {
            setTranscript(''); 
            recognition?.start();
        }
        setIsListening(!isListening);
    };

    const handleDecision = (decision) => {
        const aiMessage = { role: 'ai', text: decision.dialogue, type: 'question' };
        
        if (decision.action === 'CONTINUE') {
            setQuestionCount(prev => prev + 1);
            setCurrentQuestion(decision);
            setIsCodingQuestion(decision.category === 'coding');
            
            if (decision.currentStage) {
                setCurrentStage(decision.currentStage);
            }
        } else if (decision.action === 'END_INTERVIEW') {
            aiMessage.type = 'closing';
            setTimeout(() => navigate(`/report/${sessionId}`), 4000);
        }

        setIsTyping(true);
        setTimeout(() => {
            setMessages(prev => [...prev, aiMessage]);
            setIsTyping(false);
        }, 1200);
    };

    const handleSendAnswer = async () => {
        const answerText = isCodingQuestion ? code : transcript;
        if (!answerText.trim()) return;
        
        if (isListening) {
            recognition?.stop();
            setIsListening(false);
        }

        const userAnswer = { role: 'user', text: answerText, type: 'answer' };
        setMessages(prev => [...prev, userAnswer]);
        setTranscript('');
        setCode(''); // Clear code editor after submission
        setIsTyping(true);
        
        try {
            const response = await axios.post(`${API_URL}/next-step`, { sessionId, answer: answerText });
            handleDecision(response.data);
        } catch (error) {
    console.error('Error during interview flow:', error);
    setIsTyping(false);
    const errorMessage = "An error occurred communicating with the AI. You can try answering again, or end the interview now to generate a report on your progress so far.";
    setMessages(prev => [...prev, { role: 'ai', text: errorMessage, type: 'error' }]);
}
    };

    const handleEndInterview = async () => {
        if (!window.confirm("Are you sure you want to end the interview?")) return;
        try {
            const finalAnswer = isCodingQuestion ? code : transcript;
            await axios.post(`${API_URL}/end/${sessionId}`, { finalAnswer: finalAnswer.trim() });
            navigate(`/report/${sessionId}`);
        } catch (error) {
            console.error("Failed to end interview:", error);
            alert("Could not end the interview. Please try again.");
        }
    };
    
    // Show loading state until session is initialized
    if (!sessionInitialized) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
                <div className="text-center">
                    <div className="text-2xl mb-4">Initializing Interview Session...</div>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            <div className="flex-1 flex flex-col p-4 space-y-4">
                <header className="flex justify-between items-start border-b border-gray-700 pb-2">
                    <div>
                        <h2 className="text-2xl font-bold">AI Interview Session</h2>
                         {interviewMode === 'full' ? (
                           <StageIndicator stage={currentStage} />
                        ) : (
                           <p className="text-sm text-cyan-400">Question {questionCount + 1} | Specific Round</p>
                        )}
                    </div>
                    <button 
                        onClick={handleEndInterview} 
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        End Interview
                    </button>
                </header>

                <main className="flex-grow overflow-y-auto pr-2 flex flex-col space-y-4">
                    {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
                    {isTyping && <ChatMessage message={{ role: 'ai', isTyping: true }} />}
                    <div ref={chatEndRef} />
                </main>

                <footer className="mt-auto pt-4 border-t border-gray-700">
                    {isCodingQuestion ? (
                        <div className="h-64 border border-gray-600 rounded-lg">
                            <CodeEditor 
                                code={code} 
                                setCode={setCode} 
                                language={currentQuestion?.language_id || 93} 
                            />
                        </div>
                    ) : (
                        <textarea 
                            value={transcript} 
                            onChange={(e) => setTranscript(e.target.value)} 
                            className="w-full h-28 p-2 bg-gray-800 border border-gray-600 rounded-md resize-none" 
                            placeholder={isListening ? "Listening..." : "Click the microphone to start answering, or type here."} 
                            disabled={isTyping} 
                        />
                    )}
                    <div className="flex justify-center items-center mt-3 gap-4">
                        {!isCodingQuestion && recognition && (
                            <button 
                                onClick={toggleListen} 
                                disabled={isTyping} 
                                className={`px-6 py-3 rounded-full font-bold text-white transition-colors ${
                                    isListening 
                                        ? 'bg-red-600 hover:bg-red-700' 
                                        : 'bg-green-600 hover:bg-green-700'
                                } disabled:opacity-50`}
                            > 
                                {isListening ? 'Stop Listening' : 'Answer with Mic'} 
                            </button>
                        )}
                        <button 
                            onClick={handleSendAnswer} 
                            disabled={
                                isTyping || 
                                (isCodingQuestion && code.trim() === '') ||
                                (!isCodingQuestion && transcript.trim() === '')
                            }
                            className="px-8 py-3 rounded-full bg-cyan-600 hover:bg-cyan-700 font-bold text-white disabled:opacity-50 transition-colors"
                        > 
                            Submit Answer 
                        </button>
                    </div>
                </footer>
            </div>
            <Draggable nodeRef={draggableRef} handle=".video-handle" bounds="parent">
                <div ref={draggableRef} className="absolute bottom-4 right-4 w-64 h-48 flex flex-col rounded-lg shadow-2xl border-2 border-gray-700 bg-black cursor-move">
                    <div className="video-handle bg-gray-800 text-xs text-center py-1 rounded-t-md text-gray-400">Drag Video</div>
                    <video ref={videoRef} autoPlay muted className="flex-1 w-full h-full object-cover rounded-b-lg"></video>
                </div>
            </Draggable>
        </div>
    );
};

export default InterviewRoom;