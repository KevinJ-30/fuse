import { useState, useEffect } from 'react';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';
import './PoliciesNew.css';

interface Policy {
  id: string;
  name: string;
  tool: string;
  condition?: string;
  action: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';
  priority: number;
  enabled: boolean;
}

interface Stats {
  total: number;
  enabled: number;
  blockedToday: number;
}

const COMMON_TOOLS = [
  'send_email',
  'slack_message',
  'stripe_charge',
  'stripe_refund',
  'github_create_pr',
  'aws_ec2_terminate',
  'database_delete',
  'file_delete',
  'api_call',
  'webhook_trigger',
];

const CONDITION_EXAMPLES = [
  'amount > 1000',
  'recipient.domain === "external.com"',
  'user.role !== "admin"',
  'time.hour >= 9 && time.hour <= 17',
];

export default function PoliciesNew() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, enabled: 0, blockedToday: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    tool: '',
    condition: '',
    action: 'REQUIRE_APPROVAL' as Policy['action'],
    priority: 0,
    enabled: true,
  });

  useEffect(() => {
    fetchPolicies();
    fetchStats();

    const socket = getSocket();
    socket.on('policy:updated', handlePolicyUpdate);
    socket.on('policy:created', handlePolicyCreated);
    socket.on('policy:deleted', handlePolicyDeleted);

    return () => {
      socket.off('policy:updated', handlePolicyUpdate);
      socket.off('policy:created', handlePolicyCreated);
      socket.off('policy:deleted', handlePolicyDeleted);
    };
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/policies');
      setPolicies(response.data.sort((a: Policy, b: Policy) => a.priority - b.priority));
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/api/policies/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handlePolicyUpdate = (policy: Policy) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === policy.id ? policy : p)).sort((a, b) => a.priority - b.priority)
    );
    fetchStats();
  };

  const handlePolicyCreated = (policy: Policy) => {
    setPolicies((prev) => [...prev, policy].sort((a, b) => a.priority - b.priority));
    fetchStats();
  };

  const handlePolicyDeleted = (policyId: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== policyId));
    fetchStats();
  };

  const openCreateModal = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      tool: '',
      condition: '',
      action: 'REQUIRE_APPROVAL',
      priority: policies.length > 0 ? Math.max(...policies.map((p) => p.priority)) + 1 : 0,
      enabled: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      tool: policy.tool,
      condition: policy.condition || '',
      action: policy.action,
      priority: policy.priority,
      enabled: policy.enabled,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPolicy(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPolicy) {
        await apiClient.put(`/api/policies/${editingPolicy.id}`, formData);
      } else {
        await apiClient.post('/api/policies', formData);
      }
      closeModal();
      fetchPolicies();
      fetchStats();
    } catch (error) {
      console.error('Failed to save policy:', error);
    }
  };

  const handleToggle = async (policy: Policy) => {
    try {
      await apiClient.put(`/api/policies/${policy.id}`, {
        ...policy,
        enabled: !policy.enabled,
      });
    } catch (error) {
      console.error('Failed to toggle policy:', error);
    }
  };

  const handleDelete = async (policyId: string) => {
    if (deleteConfirm !== policyId) {
      setDeleteConfirm(policyId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      await apiClient.delete(`/api/policies/${policyId}`);
      setDeleteConfirm(null);
      fetchPolicies();
      fetchStats();
    } catch (error) {
      console.error('Failed to delete policy:', error);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPolicies = [...policies];
    const draggedItem = newPolicies[draggedIndex];
    newPolicies.splice(draggedIndex, 1);
    newPolicies.splice(index, 0, draggedItem);

    // Update priorities
    newPolicies.forEach((policy, idx) => {
      policy.priority = idx;
    });

    setPolicies(newPolicies);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      // Save new priorities to API
      await Promise.all(
        policies.map((policy) =>
          apiClient.put(`/api/policies/${policy.id}`, { ...policy })
        )
      );
    } catch (error) {
      console.error('Failed to update priorities:', error);
    }

    setDraggedIndex(null);
  };

  const getActionBadgeVariant = (action: Policy['action']) => {
    switch (action) {
      case 'ALLOW':
        return 'success';
      case 'DENY':
        return 'danger';
      case 'REQUIRE_APPROVAL':
        return 'warning';
      default:
        return 'default';
    }
  };

  const truncateCondition = (condition: string | undefined, maxLength = 50) => {
    if (!condition) return 'Always';
    return condition.length > maxLength ? `${condition.substring(0, maxLength)}...` : condition;
  };

  const columns = [
    {
      key: 'drag',
      header: '',
      width: '40px',
      render: () => (
        <div className="drag-handle">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="4" r="1.5" fill="currentColor" />
            <circle cx="11" cy="4" r="1.5" fill="currentColor" />
            <circle cx="5" cy="8" r="1.5" fill="currentColor" />
            <circle cx="11" cy="8" r="1.5" fill="currentColor" />
            <circle cx="5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="11" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      width: '80px',
      render: (policy: Policy) => (
        <Badge variant="brand" size="sm">
          {policy.priority}
        </Badge>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      width: '200px',
      render: (policy: Policy) => <div className="policy-name">{policy.name}</div>,
    },
    {
      key: 'tool',
      header: 'Tool',
      width: '180px',
      render: (policy: Policy) => <div className="policy-tool">{policy.tool}</div>,
    },
    {
      key: 'condition',
      header: 'Condition',
      render: (policy: Policy) => (
        <div className="policy-condition" title={policy.condition || 'Always'}>
          {truncateCondition(policy.condition)}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '160px',
      render: (policy: Policy) => (
        <Badge variant={getActionBadgeVariant(policy.action)} size="md">
          {policy.action.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'enabled',
      header: 'Enabled',
      width: '100px',
      render: (policy: Policy) => (
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={policy.enabled}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              e.stopPropagation();
              handleToggle(policy);
            }}
          />
          <span className="toggle-slider"></span>
        </label>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '160px',
      render: (policy: Policy) => (
        <div className="policy-actions" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(policy)}
          >
            Edit
          </Button>
          <Button
            variant={deleteConfirm === policy.id ? 'danger' : 'ghost'}
            size="sm"
            onClick={() => handleDelete(policy.id)}
          >
            {deleteConfirm === policy.id ? 'Confirm?' : 'Delete'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="policies-new-page">
      {/* Hero Section */}
      <div className="hero-section animate-in">
        <div className="hero-content">
          <h1 className="heading heading-lg">Access Control Policies</h1>
          <p className="hero-description">
            Define granular rules to control which tools your AI agents can access and under what
            conditions. Policies are evaluated in priority order.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={openCreateModal}>
          + Create Policy
        </Button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <Panel className="stat-card animate-in stagger-1" hover={false}>
          <div className="stat-label">Total Policies</div>
          <div className="metric-value">{stats.total}</div>
        </Panel>
        <Panel className="stat-card animate-in stagger-2" hover={false}>
          <div className="stat-label">Enabled Policies</div>
          <div className="metric-value" style={{ color: 'var(--ok)' }}>
            {stats.enabled}
          </div>
        </Panel>
        <Panel className="stat-card animate-in stagger-3" hover={false}>
          <div className="stat-label">Blocked Today</div>
          <div className="metric-value" style={{ color: 'var(--danger)' }}>
            {stats.blockedToday}
          </div>
        </Panel>
      </div>

      {/* Policies Table */}
      <Panel className="policies-table-panel animate-in stagger-4" hover={false}>
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading policies...</p>
          </div>
        ) : policies.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="empty-icon">
              <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2" />
              <path
                d="M32 16V32L40 40"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.4"
              />
            </svg>
            <h2 className="heading heading-md">No policies yet</h2>
            <p className="empty-description">
              Policies allow you to control what actions AI agents can perform. Create your first
              policy to start managing access control.
            </p>
            <div className="empty-features">
              <div className="empty-feature">
                <span className="feature-icon">✓</span>
                Allow or deny specific tools
              </div>
              <div className="empty-feature">
                <span className="feature-icon">✓</span>
                Set conditional rules
              </div>
              <div className="empty-feature">
                <span className="feature-icon">✓</span>
                Require approval workflows
              </div>
            </div>
            <Button variant="primary" size="lg" onClick={openCreateModal}>
              Create Your First Policy
            </Button>
            <a href="/docs/policies" className="docs-link">
              Learn more in documentation →
            </a>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="policies-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} style={{ width: col.width }}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {policies.map((policy, index) => (
                  <tr
                    key={policy.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`policy-row ${draggedIndex === index ? 'dragging' : ''}`}
                  >
                    {columns.map((col) => (
                      <td key={col.key}>{col.render(policy)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <Panel className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="heading heading-md">
                {editingPolicy ? 'Edit Policy' : 'Create Policy'}
              </h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="policy-form">
              <div className="form-group">
                <label className="form-label">Policy Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Restrict Large Payments"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tool</label>
                <select
                  className="form-input"
                  value={formData.tool}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, tool: e.target.value })}
                  required
                >
                  <option value="">Select a tool...</option>
                  {COMMON_TOOLS.map((tool) => (
                    <option key={tool} value={tool}>
                      {tool}
                    </option>
                  ))}
                  <option value="custom">Custom tool...</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Condition <span className="optional-label">(optional)</span>
                </label>
                <textarea
                  className="form-textarea"
                  value={formData.condition}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, condition: e.target.value })}
                  placeholder="e.g., amount > 1000"
                  rows={3}
                />
                <div className="form-hint">
                  <strong>Examples:</strong>
                  {CONDITION_EXAMPLES.map((example, i) => (
                    <code
                      key={i}
                      className="example-code"
                      onClick={() => setFormData({ ...formData, condition: example })}
                    >
                      {example}
                    </code>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Action</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="action"
                      value="ALLOW"
                      checked={formData.action === 'ALLOW'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, action: e.target.value as Policy['action'] })
                      }
                    />
                    <span className="radio-label">
                      <Badge variant="success" size="sm">
                        ALLOW
                      </Badge>
                      <span className="radio-description">Execute without approval</span>
                    </span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="action"
                      value="REQUIRE_APPROVAL"
                      checked={formData.action === 'REQUIRE_APPROVAL'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, action: e.target.value as Policy['action'] })
                      }
                    />
                    <span className="radio-label">
                      <Badge variant="warning" size="sm">
                        REQUIRE APPROVAL
                      </Badge>
                      <span className="radio-description">Pause and ask for approval</span>
                    </span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="action"
                      value="DENY"
                      checked={formData.action === 'DENY'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, action: e.target.value as Policy['action'] })
                      }
                    />
                    <span className="radio-label">
                      <Badge variant="danger" size="sm">
                        DENY
                      </Badge>
                      <span className="radio-description">Block execution completely</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.priority}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                    }
                    min="0"
                    required
                  />
                  <div className="form-hint">Lower numbers = higher priority</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <label className="toggle-switch toggle-switch-large">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, enabled: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">{formData.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {editingPolicy ? 'Update Policy' : 'Create Policy'}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </div>
  );
}
