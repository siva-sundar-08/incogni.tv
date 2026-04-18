// src/App.jsx - FIXED VERSION
import React, { useState, useRef } from 'react';
import VerifyPage from './pages/Verify';
import ChatPage from './pages/Chat';
import './App.css';

function App() {
  const [isVerified, setIsVerified] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const streamRef = useRef(null);

  const handleVerified = (stream) => {
    console.log('User verified, starting chat with stream:', {
      id: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });

    // Store stream in both state and ref
    streamRef.current = stream;
    setLocalStream(stream);
    setIsVerified(true);

    // Ensure all tracks are enabled
    stream.getTracks().forEach(track => {
      track.enabled = true;
      console.log(`Track ${track.kind} enabled:`, track.enabled);
    });
  };

  const handleExit = () => {
    console.log('User exited chat');

    // Stop all media tracks
    const stream = streamRef.current || localStream;
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
    }

    // Clear references
    streamRef.current = null;
    setIsVerified(false);
    setLocalStream(null);
  };

  return (
    <div className="app">
      {!isVerified ? (
        <VerifyPage onVerified={handleVerified} />
      ) : (
        <ChatPage
          localStream={localStream || streamRef.current}
          onExit={handleExit}
        />
      )}
    </div>
  );
}

export default App;