// src/components/VideoBox.jsx - FIXED VERSION
import React, { useEffect, useRef } from 'react';

const VideoBox = ({ stream, isLocal, label, placeholder }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      console.error('Video element ref is null');
      return;
    }

    if (stream && stream.active) {
      console.log(`Setting stream for ${label}:`, {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      // Set srcObject
      videoElement.srcObject = stream;

      // Ensure video plays
      videoElement.play().catch(err => {
        console.error(`Error playing video for ${label}:`, err);
      });

      // Log when video starts playing
      const handleLoadedMetadata = () => {
        console.log(`Video metadata loaded for ${label}`);
      };

      const handleCanPlay = () => {
        console.log(`Video can play for ${label}`);
      };

      const handlePlaying = () => {
        console.log(`Video is playing for ${label}`);
      };

      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('playing', handlePlaying);

      // Cleanup
      return () => {
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('playing', handlePlaying);
      };
    } else {
      // Clear srcObject if no stream
      if (videoElement.srcObject) {
        console.log(`Clearing stream for ${label}`);
        videoElement.srcObject = null;
      }
    }
  }, [stream, label]);

  return (
    <div className="video-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`video-element ${isLocal ? 'local' : 'remote'}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: stream ? 'block' : 'none'
        }}
      />

      <div className="video-label">{label}</div>

      {!stream && (
        <div className="video-placeholder">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <p>{placeholder || (isLocal ? 'Your camera' : 'Waiting for partner...')}</p>
        </div>
      )}
    </div>
  );
};

export default VideoBox;
