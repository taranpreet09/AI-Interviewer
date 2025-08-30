import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Draggable from 'react-draggable';
import ChatMessage from '../components/ChatMessage';
import CodeEditor from '../components/CodeEditor';

const API_URL = 'http://localhost:5001/api/interview';

const getRandomDelay = (min = 800, max = 1500) => Math.floor(Math.random() * (max - min + 1)) + min;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = false;
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
    const [questionSource, setQuestionSource] = useState('...');
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [code, setCode] = useState('');

    const speak = (text) => {
        if (!window.speechSynthesis || !text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

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

    useEffect(() => {
    const greetingMessage = location.state?.greeting;
    if (greetingMessage && messages.length === 0) {
        const firstMessage = { role: 'ai', text: greetingMessage, type: 'question' };
        setIsTyping(true);
        setTimeout(() => {
            setMessages([firstMessage]);
            setIsTyping(false);
            speak(firstMessage.text);
        }, getRandomDelay());
    }
}, [location.state, messages.length]);

    useEffect(() => {
        if (!recognition) return;
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript.trim() + ' ';
                }
            }
            setTranscript(prev => (prev + finalTranscript).trim());
        };
        recognition.onend = () => setIsListening(false);
        return () => { if (recognition) { recognition.onresult = null; } };
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

    const toggleListen = () => {
        if (isListening) {
            recognition.stop();
        } else {
            setTranscript('');
            recognition.start();
        }
        setIsListening(!isListening);
    };

    const handleDecision = (decision) => {
    const aiMessage = { role: 'ai', text: decision.dialogue, type: 'question' };
    if (decision.action === 'END_INTERVIEW') {
        aiMessage.type = 'closing';
        setTimeout(() => navigate(`/report/${sessionId}`), 4000); 
    }
    
    setTimeout(() => {
        setMessages(prev => [...prev, aiMessage]);
        setIsTyping(false);
        speak(aiMessage.text);
    }, getRandomDelay());
};
    const handleSendAnswer = async () => {
        const answerText = isCodingQuestion ? code : transcript;
        if (!answerText.trim()) return;
        if (isListening) {
            recognition.stop();
            setIsListening(false);
        }

        const userAnswer = { role: 'user', text: answerText, type: 'answer' };
        setMessages(prev => [...prev, userAnswer]);
        setTranscript('');
        setCode('');
        setIsTyping(true);

        try {
            const response = await axios.post(`${API_URL}/next-step`, { sessionId, answer: answerText });
            handleDecision(response.data);
        } catch (error) {
            console.error('Error during interview flow:', error);
            setIsTyping(false);
            setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, a server error occurred.' }]);
        }
    };
    
    const handleRunCode = async () => {
        if (!code.trim()) return;
        setIsTyping(true);
        setMessages(prev => [...prev, { role: 'ai', text: "Running your code...", type: 'system' }]);
        try {
            const res = await axios.post(`${API_URL}/code/submit`, {
                source_code: code,
                language_id: currentQuestion?.language_id || 93,
            });
            const output = `Status: ${res.data.status?.description || res.data.status || 'Executed'}\nOutput:\n${res.data.stdout || res.data.stderr || "No output"}`;
            setMessages(prev => [...prev, { role: 'ai', text: output, type: 'coderesult' }]);
        } catch(err) {
            setMessages(prev => [...prev, { role: 'ai', text: "Failed to run code.", type: 'coderesult' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-900 overflow-hidden">
            <div className="flex-1 flex">
                <div className={`flex flex-col h-full ${isCodingQuestion ? 'w-1/2' : 'w-full'} p-4`}>
                    <div className="border-b border-gray-700 pb-2 mb-2">
                        <h2 className="text-2xl font-bold">AI Interview Session</h2>
                        {currentQuestion && (
                            <p className={`text-xs text-center p-1 rounded-md mt-1 ${questionSource === 'ai' ? 'bg-cyan-900/50 text-cyan-300' : 'bg-gray-700/50 text-gray-400'}`}>
                                Question Source: {questionSource === 'ai' ? 'AI Generated' : 'Seed Pool'}
                            </p>
                        )}
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 flex flex-col space-y-4">
                        {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
                        {isTyping && <ChatMessage message={{ role: 'ai', isTyping: true }} />}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="mt-4">
                        {isCodingQuestion ? (
                            <div className="flex flex-col h-64 border border-gray-700 rounded-lg"><CodeEditor code={code} setCode={setCode} language={currentQuestion?.language_id || 93} /></div>
                        ) : (
                            <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} className="w-full h-24 p-2 bg-gray-800 border-gray-600 rounded-md" placeholder={isListening ? "Listening..." : "Click 'Start Answering' or type here."} disabled={isTyping} />
                        )}
                        <div className="flex justify-center items-center mt-2 gap-4">
                            {!isCodingQuestion && (<button onClick={toggleListen} disabled={isSpeaking || isTyping} className={`px-6 py-3 rounded-full font-bold ${isListening ? 'bg-red-600' : 'bg-green-600'} disabled:opacity-50`}> {isListening ? 'Stop Listening' : 'Start Answering'} </button>)}
                            {isCodingQuestion && (<button onClick={handleRunCode} disabled={isTyping} className="px-6 py-3 rounded-full bg-gray-600 font-bold"> Run Code </button>)}
                            <button onClick={handleSendAnswer} disabled={isSpeaking || isTyping || isListening} className="px-6 py-3 rounded-full bg-cyan-600 font-bold disabled:opacity-50"> Submit Answer </button>
                        </div>
                    </div>
                </div>
            </div>
            <Draggable nodeRef={draggableRef} handle=".video-handle" bounds="parent">
                <div ref={draggableRef} className="absolute bottom-4 right-4 w-64 h-48 flex flex-col rounded-lg shadow-2xl border-2 border-gray-700 bg-black cursor-move">
                    <div className="video-handle bg-gray-800 text-xs text-center py-1 rounded-t-md">Drag Me</div>
                    <video ref={videoRef} autoPlay muted className="flex-1 w-full h-full object-cover rounded-b-lg"></video>
                </div>
            </Draggable>
        </div>
    );
};

export default InterviewRoom;