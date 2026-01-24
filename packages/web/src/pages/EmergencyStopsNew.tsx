import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';
import '../styles/tokens.css';
import './EmergencyStopsNew.css';

interface Breaker {
  id: string;
  scope: 'GLOBAL' | 'AGENT' | 'TOOL';
  target: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  reason: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  active: number;
  blockedToday: number;
}

export default function EmergencyStopsNew() {
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, blockedToday: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    scope: 'TOOL' as 'GLOBAL' | 'AGENT' | 'TOOL',
    target: '',
    reason: '',
  });

  useEffect(() => {
    loadBreakers();

    // Set up Socket.io listeners
    const socket = getSocket();
    socket.on('breaker:created', loadBreakers);
    socket.on('breaker:toggled', loadBreakers);
    socket.on('breaker:deleted', loadBreakers);

    return () => {
      socket.off('breaker:created');
      socket.off('breaker:toggled');
      socket.off('breaker:deleted');
    };
  }, []);

  useEffect(() => {
    // Calculate stats whenever breakers change
    const total = breakers.length;
    const active = breakers.filter(b => b.status === 'ACTIVE').length;
    // Mock blocked today count - in real app, this would come from API
    const blockedToday = active > 0 ? Math.floor(Math.random() * 100) : 0;
    setStats({ total, active, blockedToday });
  }, [breakers]);

  const loadBreakers = async () => {
    try {
      const response = await apiClient.get('/api/breakers');
      setBreakers(response.data.breakers);
    } catch (error) {
      console.error('Error loading breakers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/breakers', {
        scope: formData.scope,
        target: formData.scope === 'GLOBAL' ? null : formData.target,
        reason: formData.reason,
      });
      setShowModal(false);
      setFormData({ scope: 'TOOL', target: '', reason: '' });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error creating breaker');
    }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    // Confirm for GLOBAL breakers
    const breaker = breakers.find(b => b.id === id);
    if (breaker?.scope === 'GLOBAL' && newStatus === 'ACTIVE') {
      if (!confirm('Are you sure you want to activate a GLOBAL breaker? This will block ALL tool calls from ALL agents.')) {
        return;
      }
    }

    try {
      await apiClient.patch(`/api/breakers/${id}`, { status: newStatus });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error toggling breaker');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/breakers/${id}`);
      setDeleteConfirm(null);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error deleting breaker');
    }
  };

  const hasActiveBreakers = stats.active > 0;

  // Custom Toggle Switch Component
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      className={`toggle-switch ${checked ? 'toggle-active' : 'toggle-inactive'}`}
      onClick={onChange}
      aria-label={checked ? 'Deactivate' : 'Activate'}
    >
      <span className="toggle-slider" />
    </button>
  );

  // Table columns configuration
  const columns = [
    {
      key: 'scope',
      header: 'Scope',
      width: '140px',
      render: (breaker: Breaker) => (
        <Badge
          variant={
            breaker.scope === 'GLOBAL' ? 'danger' :
            breaker.scope === 'AGENT' ? 'brand' :
            'default'
          }
          size="md"
        >
          {breaker.scope}
        </Badge>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      width: '180px',
      render: (breaker: Breaker) => (
        <span className="table-target">
          {breaker.target || <span className="target-all">All</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '140px',
      render: (breaker: Breaker) => (
        <div className="status-cell">
          <div className="status-indicator">
            {breaker.status === 'ACTIVE' && <span className="status-pulse" />}
            <span className={`status-label ${breaker.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
              {breaker.status}
            </span>
          </div>
          <ToggleSwitch
            checked={breaker.status === 'ACTIVE'}
            onChange={() => handleToggle(breaker.id, breaker.status)}
          />
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (breaker: Breaker) => (
        <span className="table-reason">{breaker.reason}</span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      width: '160px',
      render: (breaker: Breaker) => (
        <span className="table-date">
          {new Date(breaker.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (breaker: Breaker) => (
        <div className="actions-cell">
          {deleteConfirm === breaker.id ? (
            <div className="delete-confirm">
              <button
                className="confirm-yes"
                onClick={() => handleDelete(breaker.id)}
              >
                Yes
              </button>
              <button
                className="confirm-no"
                onClick={() => setDeleteConfirm(null)}
              >
                No
              </button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteConfirm(breaker.id)}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="emergency-stops-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading emergency stops...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="emergency-stops-container">
      {/* Hero Section */}
      <div className="hero-section animate-in">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="heading heading-lg">Emergency Stop Breakers</h1>
            <p className="hero-description">
              Circuit breakers for instantly blocking tool calls across your agent network
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowModal(true)}
            className="hero-cta"
          >
            + Create Breaker
          </Button>
        </div>

        {/* Warning Callout */}
        {hasActiveBreakers && (
          <Panel className="warning-callout animate-in stagger-1" gradient="brand" hover={false}>
            <div className="warning-content">
              <div className="warning-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="warning-text">
                <h3 className="heading heading-sm">Active Breakers Detected</h3>
                <p>
                  {stats.active} breaker{stats.active !== 1 ? 's are' : ' is'} currently active and blocking executions
                </p>
              </div>
            </div>
          </Panel>
        )}
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <Panel className="stat-card animate-in stagger-2" hover={false}>
          <div className="stat-label">Total Breakers</div>
          <div className="metric-value">{stats.total}</div>
        </Panel>
        <Panel className="stat-card animate-in stagger-3" hover={false}>
          <div className="stat-label">Active Breakers</div>
          <div className="metric-value stat-danger">{stats.active}</div>
        </Panel>
        <Panel className="stat-card animate-in stagger-4" hover={false}>
          <div className="stat-label">Blocked Executions Today</div>
          <div className="metric-value stat-muted">{stats.blockedToday}</div>
        </Panel>
      </div>

      {/* Main Table */}
      <Panel className="table-panel animate-in stagger-5" hover={false}>
        {breakers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="heading heading-md">No Breakers Configured</h2>
            <p className="empty-description">
              Emergency stop breakers allow you to instantly block tool executions at different scopes:
              GLOBAL (all tools), AGENT (specific agent), or TOOL (specific tool).
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowModal(true)}
              className="empty-cta"
            >
              Create Your First Breaker
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={breakers}
            keyExtractor={(breaker) => breaker.id}
          />
        )}
      </Panel>

      {/* Create Breaker Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <Panel className="modal-panel" gradient="brand" hover={false}>
              <div className="modal-header">
                <h2 className="heading heading-md">Create Emergency Stop Breaker</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M6 18L18 6M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreate} className="modal-form">
                <div className="form-field">
                  <label className="form-label">Scope</label>
                  <select
                    value={formData.scope}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scope: e.target.value as 'GLOBAL' | 'AGENT' | 'TOOL',
                        target: '',
                      })
                    }
                    className="form-select"
                  >
                    <option value="TOOL">Tool - Block specific tool</option>
                    <option value="AGENT">Agent - Block specific agent</option>
                    <option value="GLOBAL">Global - Block everything</option>
                  </select>
                </div>

                {formData.scope === 'GLOBAL' && (
                  <div className="global-warning">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Warning: GLOBAL scope will block ALL tool calls from ALL agents</span>
                  </div>
                )}

                {formData.scope !== 'GLOBAL' && (
                  <div className="form-field">
                    <label className="form-label">
                      Target {formData.scope === 'AGENT' ? 'Agent ID' : 'Tool Name'}
                    </label>
                    <input
                      type="text"
                      value={formData.target}
                      onChange={(e) =>
                        setFormData({ ...formData, target: e.target.value })
                      }
                      className="form-input"
                      placeholder={
                        formData.scope === 'AGENT' ? 'e.g., sales_bot' : 'e.g., send_email'
                      }
                      required
                    />
                  </div>
                )}

                <div className="form-field">
                  <label className="form-label">Reason</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="form-textarea"
                    rows={3}
                    placeholder="Why are you creating this breaker?"
                    required
                  />
                </div>

                <div className="modal-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                  >
                    Create Breaker
                  </Button>
                </div>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
