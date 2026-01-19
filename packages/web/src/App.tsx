import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import ExecutionGraph from './pages/ExecutionGraph';
import EmergencyStops from './pages/EmergencyStops';
import Policies from './pages/Policies';
import ApprovalQueue from './pages/ApprovalQueue';
import Rollbacks from './pages/Rollbacks';
import RollbackDetail from './pages/RollbackDetail';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/executions" element={<ExecutionGraph />} />
              <Route path="/breakers" element={<EmergencyStops />} />
              <Route path="/policies" element={<Policies />} />
              <Route path="/approvals" element={<ApprovalQueue />} />
              <Route path="/rollbacks" element={<Rollbacks />} />
              <Route path="/rollbacks/:id" element={<RollbackDetail />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
