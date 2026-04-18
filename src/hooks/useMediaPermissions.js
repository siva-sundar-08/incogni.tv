// src/hooks/useMediaPermissions.js
import { useState } from 'react';

const useMediaPermissions = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Request camera and microphone permissions
   * @returns {Promise<MediaStream>} Media stream with video and audio
   */
  const getMediaStream = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support media devices');
      }

      // Request video and audio permissions
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Media stream obtained successfully');
      console.log('Video tracks:', mediaStream.getVideoTracks().length);
      console.log('Audio tracks:', mediaStream.getAudioTracks().length);

      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      console.error('Error accessing media devices:', err);

      let errorMessage = 'Unable to access camera or microphone';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permission denied. Please allow camera and microphone access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera or microphone found on your device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera or microphone is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera or microphone does not meet the required specifications.';
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Media access is not allowed on insecure origins. Use HTTPS.';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Stop all media tracks and release devices
   */
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      setStream(null);
      console.log('All media tracks stopped');
    }
  };

  /**
   * Check if permissions are already granted
   * @returns {Promise<boolean>} True if permissions are granted
   */
  const checkPermissions = async () => {
    try {
      if (!navigator.permissions) {
        return false;
      }

      const cameraPermission = await navigator.permissions.query({ name: 'camera' });
      const micPermission = await navigator.permissions.query({ name: 'microphone' });

      return cameraPermission.state === 'granted' && micPermission.state === 'granted';
    } catch (err) {
      console.error('Error checking permissions:', err);
      return false;
    }
  };

  /**
   * Toggle audio track
   * @param {boolean} enabled - Enable or disable audio
   */
  const toggleAudio = (enabled) => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
        console.log(`Audio ${enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  /**
   * Toggle video track
   * @param {boolean} enabled - Enable or disable video
   */
  const toggleVideo = (enabled) => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
        console.log(`Video ${enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  return {
    stream,
    error,
    loading,
    getMediaStream,
    stopStream,
    checkPermissions,
    toggleAudio,
    toggleVideo
  };
};

export default useMediaPermissions;