import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SidebarNew from './components/layout/SidebarNew';
import HeaderNew from './components/layout/HeaderNew';
import DashboardNew from './pages/DashboardNew';
import ExecutionGraphNew from './pages/ExecutionGraphNew';
import EmergencyStopsNew from './pages/EmergencyStopsNew';
import PoliciesNew from './pages/PoliciesNew';
import ApprovalQueueNew from './pages/ApprovalQueueNew';
import RollbacksNew from './pages/RollbacksNew';
import RollbackDetailNew from './pages/RollbackDetailNew';

function App() {
  return (
    <Router>
      <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
        <SidebarNew />
        <div className="flex-1 flex flex-col overflow-hidden">
          <HeaderNew />
          <main className="flex-1 overflow-x-hidden overflow-y-auto" style={{ background: 'var(--bg)' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardNew />} />
              <Route path="/executions" element={<ExecutionGraphNew />} />
              <Route path="/breakers" element={<EmergencyStopsNew />} />
              <Route path="/policies" element={<PoliciesNew />} />
              <Route path="/approvals" element={<ApprovalQueueNew />} />
              <Route path="/rollbacks" element={<RollbacksNew />} />
              <Route path="/rollbacks/:id" element={<RollbackDetailNew />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
