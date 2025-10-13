// Frontend/src/pages/InterviewRoom.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios from 'axios';
import CodeEditor from '../components/CodeEditor';

const socket = io('http://localhost:5001');

const InterviewRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const videoRef = useRef(null);

  // --- State Management ---
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [isCodingQuestion, setIsCodingQuestion] = useState(false);
  const [code, setCode] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [aiFullText, setAiFullText] = useState('Initializing...');
  const [aiDisplayedText, setAiDisplayedText] = useState('Initializing...');
  const [currentStage, setCurrentStage] = useState(1);
  const [questionCount, setQuestionCount] = useState(0);
  const [interviewMode, setInterviewMode] = useState('specific');

  const { transcript, listening, resetTranscript } = useSpeechRecognition();

  // --- Effect Hooks ---

  // 1. Camera Access
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => console.error('Error accessing camera:', err));
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 2. Session Initialization
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const res = await axios.get(`http://localhost:5001/api/interview/session/${sessionId}`);
        setInterviewMode(res.data.interviewMode);
        setQuestionCount(res.data.history.length);
        setCurrentStage(res.data.currentStage);

        const greetingMessage = location.state?.greeting || "Hello! Welcome to your interview.";
        setSessionInitialized(true);
        setTimeout(() => speak(greetingMessage), 1000);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        navigate('/');
      }
    };
    if (!sessionInitialized) initializeSession();
  }, [sessionId, sessionInitialized, location.state, navigate]);

  // 3. WebSocket AI Response Handler
  useEffect(() => {
    const handleAiResponse = (data) => {
      setQuestionCount((prev) => prev + 1);
      setCurrentStage(data.currentStage);
      setIsCodingQuestion(data.category === 'coding');

      if (data.action === 'END_INTERVIEW') {
        speak(data.dialogue);
        setTimeout(() => navigate(`/report/${sessionId}`), 4000);
      } else {
        speak(data.dialogue);
      }
    };
    socket.on('ai-spoke', handleAiResponse);
    return () => socket.off('ai-spoke', handleAiResponse);
  }, [navigate, sessionId]);

  // --- Core Functions ---

  // Text-to-Speech
  const speak = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Reset states for new message
    setAiFullText(text);
    setAiDisplayedText('');

    // Gradual update while AI speaks
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setAiDisplayedText(text.substring(0, event.charIndex));
      }
    };

    utterance.onstart = () => setIsAiSpeaking(true);

    utterance.onend = () => {
      setAiDisplayedText(text); // Ensure the full text is shown
      setIsAiSpeaking(false);
      if (!isCodingQuestion) {
        resetTranscript();
        SpeechRecognition.startListening({ continuous: false });
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Send Answer to Backend
  const handleSendAnswer = () => {
    const finalAnswer = isCodingQuestion ? code : transcript;
    if (!finalAnswer.trim()) return;
    SpeechRecognition.stopListening();
    socket.emit('user-spoke', { sessionId, answer: finalAnswer });
    resetTranscript();
    setCode('');
  };

  // End Interview Manually
  const handleEndInterview = async () => {
    if (!window.confirm('Are you sure you want to end the interview?')) return;
    socket.emit('end-interview', { sessionId });
    navigate(`/report/${sessionId}`);
  };

  // --- Render Logic ---
  if (!sessionInitialized) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
        <p>Loading interview session...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-gray-800 text-white font-sans flex-col p-4">
      {/* Header Section */}
      <header className="w-full flex justify-between items-center p-2 border-b border-gray-700 mb-4">
        <h1 className="text-xl font-bold text-cyan-400">AI Interviewer</h1>
        <div className="text-right">
          {interviewMode === 'full' ? (
            <>
              <p className="font-semibold">Full Interview Mode</p>
              <p className="text-sm text-gray-400">
                Stage {currentStage} of 3 | Question {questionCount + 1}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Specific Round</p>
              <p className="text-sm text-gray-400">Question {questionCount + 1}</p>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: AI Interviewer */}
        <div className="flex flex-1 flex-col items-center justify-center bg-black p-6 rounded-lg">
          <div
            className={`relative w-56 h-56 rounded-full flex items-center justify-center bg-gray-700 shadow-lg transition-all duration-500 ${
              isAiSpeaking ? 'scale-110 ring-4 ring-cyan-500 ring-opacity-70' : ''
            }`}
          >
            <p className="text-xl font-medium">AI Avatar</p>
            {isAiSpeaking && (
              <div className="absolute inset-0 rounded-full bg-cyan-400 opacity-20 animate-ping"></div>
            )}
          </div>
          <div className="mt-6 text-lg text-center text-gray-300 h-24 font-mono">
            <p>{aiDisplayedText}</p>
          </div>
        </div>

        {/* Right Panel: Candidate (You) */}
        <div className="flex flex-1 flex-col items-center justify-center p-6 space-y-4">
          <div className="relative w-56 h-56 bg-gray-900 rounded-full shadow-2xl overflow-hidden border-2 border-gray-700">
            <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
          </div>

          {/* Input Area */}
          <div className="w-full max-w-2xl h-64">
            {isCodingQuestion ? (
              <CodeEditor code={code} setCode={setCode} />
            ) : (
              <div className="w-full h-full p-4 bg-gray-900 border border-gray-700 rounded-md text-white">
                <h3 className="font-bold mb-2 text-gray-400">Your Answer:</h3>
                <p className="text-gray-200">
                  {transcript || (listening ? 'Listening...' : 'Waiting for your turn...')}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex space-x-4">
            <button
              onClick={handleSendAnswer}
              disabled={isAiSpeaking || (isCodingQuestion ? !code.trim() : !transcript.trim())}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-full transition-all disabled:bg-gray-600"
            >
              Submit Answer
            </button>
            <button
              onClick={handleEndInterview}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-full transition-all"
            >
              End Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;
