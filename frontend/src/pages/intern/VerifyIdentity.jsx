import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useCamera from '../../hooks/useCamera';
import { loadFaceModels, getFaceDescriptor } from '../../utils/faceApi';
import internPortalService from '../../services/internPortalService';
import { toast } from 'react-toastify';
import { CameraIcon } from '../../components/common/Icons';
import '../../styles/verify.css';

const VerifyIdentity = () => {
  const navigate = useNavigate();
  const { videoRef, ready, error, startCamera, stopCamera } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState('Loading face detection models...');

  useEffect(() => {
    loadFaceModels()
      .then(() => {
        setModelsReady(true);
        setStatus('Click "Start Camera" to begin');
      })
      .catch(() => setStatus('Failed to load face models. Refresh and try again.'));
  }, []);

  const handleStart = async () => {
    await startCamera();
    setStatus('Position your face in the frame, then click Capture');
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    setStatus('Detecting face...');

    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (!descriptor) {
        setStatus('No face detected. Make sure your face is clearly visible.');
        setCapturing(false);
        return;
      }

      setStatus('Saving your face data...');
      await internPortalService.setupFace(descriptor);
      toast.success('Identity verified successfully!');
      stopCamera();
      navigate('/intern/dashboard');
    } catch (err) {
      toast.error(err.message || 'Verification failed. Try again.');
      setStatus('Something went wrong. Try capturing again.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="verify-page">
      <div className="verify-card slide-up">
        <div className="verify-header">
          <div className="verify-icon"><CameraIcon size={20} /></div>
          <h2 className="verify-title">Verify Your Identity</h2>
          <p className="verify-sub">
            One-time face setup. This will be used to verify your check-in/out at the SINES building.
          </p>
        </div>

        <div className="verify-camera-box">
          {!ready && !error && (
            <div className="camera-placeholder">
              <span>Camera not started</span>
            </div>
          )}
          {error && <div className="camera-error">{error}</div>}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`verify-video ${ready ? 'visible' : ''}`}
          />
        </div>

        <p className="verify-status">{status}</p>

        <div className="verify-actions">
          {!ready ? (
            <button
              className="btn-primary verify-btn"
              onClick={handleStart}
              disabled={!modelsReady}
            >
              {modelsReady ? 'Start Camera' : 'Loading...'}
            </button>
          ) : (
            <button
              className="btn-primary verify-btn"
              onClick={handleCapture}
              disabled={capturing}
            >
              {capturing ? <span className="btn-spinner" /> : 'Capture & Verify'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyIdentity;
