import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Interns from './pages/Interns';
import InternProfile from './pages/InternProfile';
import Tasks from './pages/Tasks';
import Attendance from './pages/Attendance';
import Locations from './pages/Locations';
import Login from './pages/Login';
import Signup from './pages/Signup';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/common/ProtectedRoute';
import InternLogin from './pages/intern/InternLogin';
import InternDashboard from './pages/intern/InternDashboard';
import InternTasks from './pages/intern/InternTasks';
import InternAttendance from './pages/intern/InternAttendance';
import VerifyIdentity from './pages/intern/VerifyIdentity';
import InternRoute from './components/common/InternRoute';
import AIChatBot from './components/common/AIChatBot';
import Chat from './pages/Chat';
import InternChat from './pages/intern/InternChat';


function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/interns" element={<ProtectedRoute><Interns /></ProtectedRoute>} />
        <Route path="/interns/:id/profile" element={<ProtectedRoute><InternProfile /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
        <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
        <Route path="/intern/login" element={<InternLogin />} />
        <Route path="/intern/verify-identity" element={<InternRoute><VerifyIdentity /></InternRoute>} />
        <Route path="/intern/dashboard" element={<InternRoute><InternDashboard /></InternRoute>} />
        <Route path="/intern/tasks" element={<InternRoute><InternTasks /></InternRoute>} />
        <Route path="/intern/attendance" element={<InternRoute><InternAttendance /></InternRoute>} />
        <Route path="*" element={<NotFound />} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/intern/chat" element={<InternRoute><InternChat /></InternRoute>} />
      </Routes>
      <AIChatBot />
    </>
  );
}

export default App;
