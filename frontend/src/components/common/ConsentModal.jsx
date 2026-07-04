import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import internPortalService from '../../services/internPortalService';
import { toast } from 'react-toastify';
import './consentModal.css';

// Blocking, un-dismissable overlay shown to an intern whose stored
// consent_version doesn't match the app's current CONSENT_VERSION (either
// they never accepted, or the policy changed since they last did). There's
// no [x]/backdrop-click close — acceptance is the only way out, since this
// covers biometric (face) and location (GPS check-in) data collection that
// shouldn't happen before the intern has actually agreed to it.
const ConsentModal = () => {
  const { setIntern } = useAuth();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!checked) return;
    setSubmitting(true);
    try {
      await internPortalService.acceptConsent();
      setIntern((prev) => (prev ? { ...prev, needs_consent: false } : prev));
      toast.success('Thanks — you can continue.');
    } catch (err) {
      toast.error(err.message || 'Could not save your consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="consent-overlay">
      <div className="consent-box">
        <h2 className="consent-title">Before you continue</h2>
        <p className="consent-intro">
          SEECS InternHub collects a few types of personal data to run attendance and task
          tracking for your internship. Please review what's collected and why:
        </p>

        <ul className="consent-list">
          <li>
            <strong>Face verification data.</strong> A one-time face scan is converted into a
            numeric "face descriptor" in your browser — a photo of your face is never uploaded
            or stored. That descriptor is used only to confirm it's you at check-in/check-out.
          </li>
          <li>
            <strong>Location at check-in/out.</strong> Your device's GPS coordinates are recorded
            each time you check in or out, to confirm you were at your assigned site. This is not
            tracked at any other time.
          </li>
          <li>
            <strong>Tasks, submissions, and chat.</strong> Files you submit for tasks and messages
            you send in chat are stored so your supervisor can review and respond to them.
          </li>
          <li>
            <strong>Who can see this.</strong> Only SEECS admins/supervisors with access to this
            portal. Data isn't shared outside the department or used for anything beyond running
            the internship program.
          </li>
        </ul>

        <label className="consent-checkbox-row">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>I understand and consent to this data being collected as described.</span>
        </label>

        <button className="btn-primary consent-accept-btn" onClick={handleAccept} disabled={!checked || submitting}>
          {submitting ? <span className="btn-spinner" /> : 'Agree & Continue'}
        </button>
      </div>
    </div>
  );
};

export default ConsentModal;
