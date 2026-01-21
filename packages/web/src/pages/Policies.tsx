import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';

interface Policy {
  id: string;
  name: string;
  tool: string;
  condition: string | null;
  action: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tool: '',
    condition: '',
    action: 'REQUIRE_APPROVAL' as 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL',
    priority: 100,
  });

  useEffect(() => {
    loadPolicies();

    // Set up Socket.io listeners
    const socket = getSocket();
    socket.on('policy:created', loadPolicies);
    socket.on('policy:updated', loadPolicies);
    socket.on('policy:toggled', loadPolicies);
    socket.on('policy:deleted', loadPolicies);

    return () => {
      socket.off('policy:created');
      socket.off('policy:updated');
      socket.off('policy:toggled');
      socket.off('policy:deleted');
    };
  }, []);

  const loadPolicies = async () => {
    try {
      const response = await apiClient.get('/api/policies');
      setPolicies(response.data.policies);
    } catch (error) {
      console.error('Error loading policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/policies', {
        name: formData.name,
        tool: formData.tool,
        condition: formData.condition || null,
        action: formData.action,
        priority: formData.priority,
      });
      setShowModal(false);
      setFormData({ name: '', tool: '', condition: '', action: 'REQUIRE_APPROVAL', priority: 100 });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error creating policy');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;

    try {
      await apiClient.put(`/api/policies/${editingPolicy.id}`, {
        name: formData.name,
        tool: formData.tool,
        condition: formData.condition || null,
        action: formData.action,
        priority: formData.priority,
      });
      setShowModal(false);
      setEditingPolicy(null);
      setFormData({ name: '', tool: '', condition: '', action: 'REQUIRE_APPROVAL', priority: 100 });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error updating policy');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await apiClient.patch(`/api/policies/${id}/toggle`, { enabled: !enabled });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error toggling policy');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) {
      return;
    }

    try {
      await apiClient.delete(`/api/policies/${id}`);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error deleting policy');
    }
  };

  const openCreateModal = () => {
    setEditingPolicy(null);
    setFormData({ name: '', tool: '', condition: '', action: 'REQUIRE_APPROVAL', priority: 100 });
    setShowModal(true);
  };

  const openEditModal = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      tool: policy.tool,
      condition: policy.condition || '',
      action: policy.action,
      priority: policy.priority,
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Approval Policies</h3>
          <p className="text-sm text-gray-400 mt-1">
            Define rules for when executions require approval or should be denied
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Create Policy
        </button>
      </div>

      {loading ? (
        <div className="bg-dark-100 rounded-lg shadow p-8 text-center text-gray-400">
          Loading policies...
        </div>
      ) : (
        <div className="bg-dark-100 rounded-lg shadow overflow-hidden border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Tool
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Condition
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-dark-100 divide-y divide-gray-800">
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-400">
                    No policies configured
                  </td>
                </tr>
              ) : (
                policies.map((policy) => (
                  <tr key={policy.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">
                      {policy.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                      <code className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">{policy.tool}</code>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-100 max-w-xs truncate">
                      {policy.condition ? (
                        <code className="text-xs text-gray-300">{policy.condition}</code>
                      ) : (
                        <span className="text-gray-500 italic">Always applies</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          policy.action === 'DENY'
                            ? 'bg-primary-900/30 text-primary-400 border border-primary-600'
                            : policy.action === 'REQUIRE_APPROVAL'
                            ? 'bg-gray-800 text-gray-300 border border-gray-700'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {policy.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                      {policy.priority}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          policy.enabled
                            ? 'bg-primary-900/30 text-primary-400 border border-primary-600'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {policy.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => openEditModal(policy)}
                        className="text-primary-500 hover:text-primary-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(policy.id, policy.enabled)}
                        className={`${
                          policy.enabled
                            ? 'text-gray-400 hover:text-gray-200'
                            : 'text-primary-500 hover:text-primary-400'
                        }`}
                      >
                        {policy.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDelete(policy.id)}
                        className="text-primary-500 hover:text-primary-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Policy Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-100 rounded-lg p-6 w-full max-w-lg border border-gray-800">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">
              {editingPolicy ? 'Edit Policy' : 'Create Policy'}
            </h3>
            <form onSubmit={editingPolicy ? handleUpdate : handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Policy Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-gray-100 focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                    placeholder="e.g., Large Refunds Require Approval"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Tool Name
                  </label>
                  <input
                    type="text"
                    value={formData.tool}
                    onChange={(e) => setFormData({ ...formData, tool: e.target.value })}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-gray-100 focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                    placeholder="e.g., stripe_refund"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Condition (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-gray-100 focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                    placeholder="e.g., args.amount GREATER_THAN 1000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: field OPERATOR value (e.g., args.to CONTAINS @customer.com)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Action
                  </label>
                  <select
                    value={formData.action}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        action: e.target.value as 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL',
                      })
                    }
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-gray-100 focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                  >
                    <option value="ALLOW">Allow (bypass checks)</option>
                    <option value="REQUIRE_APPROVAL">Require Approval</option>
                    <option value="DENY">Deny (block execution)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Priority (lower = higher priority)
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) })
                    }
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-gray-100 focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingPolicy(null);
                  }}
                  className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingPolicy ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
