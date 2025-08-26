// src/pages/InterviewRoom.jsx
// REPLACED FILE - Fixed the "Invalid hook call" error

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Draggable from 'react-draggable';
import axios from 'axios';
import ChatMessage from '../components/ChatMessage';
import CodeEditor from '../components/CodeEditor';



const API_URL = 'http://localhost:5001/api';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
}

const InterviewRoom = () => {
    // --- HOOKS AT TOP LEVEL ---
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation(); // <-- FIX: useLocation is now at the top level
    const videoRef = useRef(null);
    const chatEndRef = useRef(null);
const draggableRef = useRef(null);  // <-- ADD THIS
    // --- STATE MANAGEMENT ---
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [messages, setMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isCodingQuestion, setIsCodingQuestion] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [interviewFinished, setInterviewFinished] = useState(false);
    const [code, setCode] = useState('');

    // --- VIDEO PREVIEW EFFECT ---
    useEffect(() => {
        const getVideoStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
            }
        };
        getVideoStream();
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // --- TEXT-TO-SPEECH FUNCTION ---
    const speak = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); // Clear the queue
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    // --- SPEECH-TO-TEXT EFFECT ---
    useEffect(() => {
        if (!recognition) return;
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            setTranscript(prev => prev.trim() + ' ' + finalTranscript);
        };
        return () => {
            if(recognition) recognition.stop();
        }
    }, []);
    
    const toggleListen = () => {
        if (isListening) {
            recognition.stop();
        } else {
            setTranscript(''); 
            recognition.start();
        }
        setIsListening(!isListening);
    };

    // --- INITIAL QUESTION LOGIC ---
    useEffect(() => {
        // FIX: Using the 'location' variable from the top-level hook call
        const initialQuestion = location.state?.initialQuestion;
        if (initialQuestion) {
            setCurrentQuestion(initialQuestion);
            setMessages([{ sender: 'ai', text: initialQuestion.text }]);
            speak(initialQuestion.text);
            setIsCodingQuestion(initialQuestion.type === 'coding');
        }
    }, [location.state, sessionId]); // FIX: Added location.state to dependency array
    
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSendAnswer = async () => {
        if (isListening) {
            recognition.stop();
            setIsListening(false);
        }
        
        const answer = isCodingQuestion ? code : transcript;
        if (!answer.trim()) return;

        setMessages(prev => [...prev, { sender: 'user', text: answer }]);
        setTranscript('');
        setIsLoading(true);

        try {
            const askRes = await axios.post(`${API_URL}/interview/ask`, { sessionId, answer });
            if (askRes.data.finished) {
                const finishMsg = "Thank you for completing the interview. Generating your report now...";
                setMessages(prev => [...prev, { sender: 'ai', text: finishMsg }]);
                speak(finishMsg);
                setInterviewFinished(true);
                await axios.post(`${API_URL}/feedback/analyze/${sessionId}`);
                navigate(`/report/${sessionId}`);
            } else {
                const nextQ = askRes.data.nextQuestion;
                setCurrentQuestion(nextQ);
                setMessages(prev => [...prev, { sender: 'ai', text: nextQ.text }]);
                speak(nextQ.text);
                setIsCodingQuestion(nextQ.type === 'coding');
            }
        } catch (error) {
            console.error('Error during interview flow:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRunCode = async () => {
        if (!code.trim()) return;
        setIsLoading(true);
        setMessages(prev => [...prev, { sender: 'ai', text: "Running your code..." }]);
        
        try {
            const res = await axios.post(`${API_URL}/interview/code/submit`, {
                source_code: code,
                language_id: currentQuestion.language_id,
                sessionId,
            });
            const output = `Status: ${res.data.status}\nOutput:\n${res.data.stdout || res.data.stderr || "No output"}`;
            setMessages(prev => [...prev, { sender: 'coderesult', text: output }]);
        } catch(err) {
            console.error("Code execution error:", err);
            setMessages(prev => [...prev, { sender: 'coderesult', text: "Failed to run code." }]);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="flex h-screen bg-gray-900 overflow-hidden">
            <div className="flex-1 flex">
                 <div className={`flex flex-col h-full ${isCodingQuestion ? 'w-1/2' : 'w-full'} p-4`}>
                    <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">AI Interviewer Session</h2>
                    <div className="flex-grow overflow-y-auto pr-2">
                        {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
                        <div ref={chatEndRef} />
                    </div>
                    {!isCodingQuestion && currentQuestion && (
                        <div className="mt-4">
                            <textarea
                                value={transcript}
                                readOnly
                                className="w-full h-24 p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-300"
                                placeholder={isListening ? "Listening... Your words will appear here..." : "Click 'Start Answering' to speak."}
                            />
                            <div className="flex justify-center items-center mt-2 gap-4">
                               <button onClick={toggleListen} disabled={isSpeaking || isLoading || interviewFinished} className={`px-6 py-3 rounded-full text-white font-bold ${isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}>
                                   {isListening ? 'Stop Listening' : 'Start Answering'}
                               </button>
                               <button onClick={handleSendAnswer} disabled={isSpeaking || isLoading || isListening || !transcript.trim() || interviewFinished} className="px-6 py-3 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold disabled:opacity-50">
                                   Submit Answer
                               </button>
                            </div>
                        </div>
                    )}
                </div>
                {isCodingQuestion && currentQuestion && (
    <div className="w-1/2 h-full flex flex-col p-4 border-l border-gray-700">
        <div className="flex-grow mb-4">
             <CodeEditor code={code} setCode={setCode} language={currentQuestion.language_id} />
        </div>
        <div className="flex justify-end gap-4">
            <button 
                onClick={handleRunCode} 
                disabled={isLoading || interviewFinished}
                className="bg-green-600 px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50">
                Run Code
            </button>
             <button 
                onClick={handleSendAnswer} 
                disabled={isLoading || interviewFinished}
                className="bg-blue-600 px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50">
                Submit Final Answer
             </button>
        </div>
    </div>
)}
            </div>
            
             <Draggable nodeRef={draggableRef} handle=".video-handle" bounds="parent">
  <div
    ref={draggableRef}
    className="absolute bottom-4 right-4 w-64 h-48 flex flex-col rounded-lg shadow-2xl border-2 border-gray-700 bg-black cursor-move"
  >
    <div className="video-handle bg-gray-800 text-white text-xs text-center py-1 rounded-t-md">
      Drag Me
    </div>
    <video
      ref={videoRef}
      autoPlay
      muted
      className="flex-1 w-full h-full object-cover rounded-b-lg"
    ></video>
  </div>
</Draggable>
        </div>
    );
};

export default InterviewRoom;