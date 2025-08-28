// /src/pages/InterviewRoom.jsx
// FINAL, FULLY-FEATURED VERSION (Phase 6.1 + Voice/Video)

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Draggable from 'react-draggable';
import ChatMessage from '../components/ChatMessage';
import CodeEditor from '../components/CodeEditor';

const API_URL = 'http://localhost:5001/api/interview';

// Helper for random AI "thinking" delay
const getRandomDelay = (min = 800, max = 1500) => Math.floor(Math.random() * (max - min + 1)) + min;

// Browser compatibility for Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = false; // Set to false for cleaner final transcripts
    recognition.lang = 'en-US';
}

const InterviewRoom = () => {
    // --- React Hooks ---
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    // --- Refs for DOM elements ---
    const videoRef = useRef(null);
    const chatEndRef = useRef(null);
    const draggableRef = useRef(null);

    // --- State Management ---
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [currentQuestionType, setCurrentQuestionType] = useState('behavioral');
    
    // --- Voice/Text Input State ---
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    // --- Coding State ---
    const [code, setCode] = useState('');

    const primaryQuestionCount = useMemo(() => 
        messages.filter(m => m.role === 'ai' && (m.type === 'question' || m.type === 'greeting')).length
    , [messages]);
    
    // --- Effects ---

    // Effect for Video Preview
    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                if (videoRef.current) videoRef.current.srcObject = stream;
            })
            .catch(err => console.error("Error accessing camera:", err));
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Effect for Speech Recognition results
    useEffect(() => {
        if (!recognition) return;
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript.trim() + ' ';
                }
            }
            // Append final results to the transcript
            setTranscript(prev => (prev + finalTranscript).trim());
        };
        recognition.onend = () => {
            setIsListening(false);
        };
        return () => { if (recognition) recognition.onresult = null; };
    }, []);
    
    // Effect to auto-scroll chat
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
    
    // --- Core Functions ---

    const speak = (text) => {
        if (!window.speechSynthesis || !text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    const toggleListen = () => {
        if (isListening) {
            recognition.stop();
        } else {
            setTranscript(''); 
            recognition.start();
        }
        setIsListening(!isListening);
    };

    const handleSendAnswer = async () => {
        if (isListening) {
            recognition.stop();
            setIsListening(false);
        }
        
        const answerText = currentQuestionType === 'coding' ? code : transcript;
        if (!answerText.trim()) return;

        const userAnswer = { role: 'user', text: answerText, type: 'answer' };
        setMessages(prev => [...prev, userAnswer]);
        setTranscript('');
        setCode(''); // Clear code editor as well
        setIsTyping(true);

        try {
            const response = await axios.post(`${API_URL}/next-step`, { sessionId, answer: answerText });
            const aiMessage = response.data;

            if (aiMessage.action === 'END_INTERVIEW') {
                const finalMessage = { role: 'ai', text: aiMessage.finalMessage || "That concludes our session. Thank you for your time.", type: 'closing' };
                setTimeout(() => {
                    setIsTyping(false);
                    setMessages(prev => [...prev, finalMessage]);
                    speak(finalMessage.text);
                    setTimeout(() => navigate(`/report/${sessionId}`), 3000);
                }, getRandomDelay());
            } else {
                setTimeout(() => {
                    setMessages(prev => [...prev, aiMessage]);
                    setIsTyping(false);
                    speak(aiMessage.text);
                    
                    const isCoding = /write a function|algorithm|class/i.test(aiMessage.text);
                    setCurrentQuestionType(isCoding ? 'coding' : 'behavioral');
                    if (isCoding) setCode(`// ${aiMessage.text}`);

                }, getRandomDelay());
            }

        } catch (error) {
            console.error('Error during interview flow:', error);
            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, an error occurred.'}]);
        }
    };
    
    const handleRunCode = async () => { /* ... same as before ... */ };

     // Effect for Initial Greeting Message (must be after speak is defined)
    useEffect(() => {
        const initialMessage = location.state?.firstMessage;
        if (initialMessage && messages.length === 0) {
            setIsTyping(true);
            setTimeout(() => {
                setMessages([initialMessage]);
                setIsTyping(false);
                speak(initialMessage.text);
            }, getRandomDelay());
        }
    }, [location.state, messages.length]);


    // --- Render ---
    return (
        <div className="flex h-screen bg-gray-900 overflow-hidden">
            <div className="flex-1 flex flex-col p-4 max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                    <h2 className="text-2xl font-bold">AI Interview Session</h2>
                    {primaryQuestionCount > 0 && (
                        <div className="px-3 py-1 bg-gray-700 text-sm rounded-full">
                           Question {primaryQuestionCount}
                        </div>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto pr-2 flex flex-col space-y-6">
                    {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
                    {isTyping && <ChatMessage message={{ role: 'ai', isTyping: true }} />}
                    <div ref={chatEndRef} />
                </div>

                <div className="mt-4">
                    {currentQuestionType === 'coding' ? (
                        <div className="flex flex-col h-64 border border-gray-700 rounded-lg">
                            <CodeEditor code={code} setCode={setCode} language={93} />
                        </div>
                    ) : (
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            className="w-full h-24 p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-300"
                            placeholder={isListening ? "Listening..." : "Click 'Start Answering' to speak or type here."}
                            disabled={isTyping}
                        />
                    )}

                    <div className="flex justify-center items-center mt-2 gap-4">
                        {currentQuestionType !== 'coding' && (
                            <button onClick={toggleListen} disabled={isSpeaking || isTyping} className={`px-6 py-3 rounded-full text-white font-bold ${isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}>
                               {isListening ? 'Stop Listening' : 'Start Answering'}
                            </button>
                        )}
                        {currentQuestionType === 'coding' && (
                            <button onClick={handleRunCode} disabled={isTyping} className="px-6 py-3 rounded-full bg-gray-600 hover:bg-gray-700 text-white font-bold disabled:opacity-50">
                                Run Code
                            </button>
                        )}
                        <button onClick={handleSendAnswer} disabled={isSpeaking || isTyping || (currentQuestionType === 'coding' ? !code.trim() : !transcript.trim())} className="px-6 py-3 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold disabled:opacity-50">
                            Submit Answer
                        </button>
                    </div>
                </div>
            </div>

            <Draggable nodeRef={draggableRef} handle=".video-handle" bounds="parent">
                <div ref={draggableRef} className="absolute bottom-4 right-4 w-64 h-48 flex flex-col rounded-lg shadow-2xl border-2 border-gray-700 bg-black cursor-move">
                    <div className="video-handle bg-gray-800 text-white text-xs text-center py-1 rounded-t-md">Drag Me</div>
                    <video ref={videoRef} autoPlay muted className="flex-1 w-full h-full object-cover rounded-b-lg"></video>
                </div>
            </Draggable>
        </div>
    );
};

export default InterviewRoom;