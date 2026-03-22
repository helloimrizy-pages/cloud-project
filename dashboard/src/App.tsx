import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import LiveControls from './pages/LiveControls';
import KPITimeline from './pages/KPITimeline';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<LiveControls />} />
          <Route path="/timeline" element={<KPITimeline />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
      </Route>
    </Routes>
  );
}
