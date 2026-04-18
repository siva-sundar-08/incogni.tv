// src/pages/Verify.jsx
import React, { useState, useEffect, useRef } from 'react';
import useMediaPermissions from '../hooks/useMediaPermissions';

const VerifyPage = ({ onVerified }) => {
  const [isOver18, setIsOver18] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const { stream, error, loading, getMediaStream } = useMediaPermissions();
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleRequestPermissions = async () => {
    try {
      await getMediaStream();
      setPermissionsGranted(true);
    } catch (err) {
      alert('Camera and microphone permissions are required to use this app.');
    }
  };

  const handleProceed = () => {
    if (isOver18 && permissionsGranted && stream) {
      onVerified(stream);
    }
  };

  return (
    <div className="verify-page">
      <div className="verify-container">
        <h1>Talk to someone random, instantly.</h1>
        <p className="subtitle">Incogni.tv pairs you with a stranger for live video, text chat, skip, and report.</p>

        <div className="verify-steps">
          {/* Step 1: Age Verification */}
          <div className="verify-step">
            <h3>Step 1: Age check</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isOver18}
                onChange={(e) => setIsOver18(e.target.checked)}
              />
              <span>I confirm that I am 18 years or older</span>
            </label>
          </div>

          {/* Step 2: Media Permissions */}
          <div className="verify-step">
            <h3>Step 2: Camera and microphone</h3>
            {!permissionsGranted ? (
              <button
                onClick={handleRequestPermissions}
                disabled={!isOver18 || loading}
                className="verify-btn"
              >
                {loading ? 'Requesting...' : 'Enable camera and mic'}
              </button>
            ) : (
              <div className="permission-granted">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="preview-video"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <p className="success-text">Permissions granted. You are ready to match.</p>
              </div>
            )}
            {error && <p className="error-text">Error: {error}</p>}
          </div>
        </div>

        {/* Proceed Button */}
        <button
          onClick={handleProceed}
          disabled={!isOver18 || !permissionsGranted}
          className="proceed-btn"
        >
          Start matching
        </button>

        {/* Privacy Disclaimer */}
        <div className="disclaimer">
          <p><strong>Privacy Notice:</strong></p>
          <ul>
            <li>No account is required to enter the queue</li>
            <li>Video connects peer-to-peer through WebRTC when possible</li>
            <li>Use Next to leave any chat immediately</li>
            <li>Use Report for nudity, harassment, threats, or spam</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VerifyPage;
