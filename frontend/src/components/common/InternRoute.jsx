import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from './Loader';
import ConsentModal from './ConsentModal';

const InternRoute = ({ children }) => {
  const { intern, loading } = useAuth();
  if (loading) return <Loader />;
  if (!intern) return <Navigate to="/intern/login" />;
  // Blocking gate: an intern who hasn't accepted the current consent policy
  // sees only the consent notice, on every intern route (dashboard, tasks,
  // verify-identity, mobile check-in, etc.) — not just the dashboard — since
  // face/location data collection can happen from more than one entry point.
  if (intern.needs_consent) return <ConsentModal />;
  return children;
};

export default InternRoute;