import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import { getSocket } from '../lib/socket';

interface Breaker {
  id: string;
  scope: 'GLOBAL' | 'AGENT' | 'TOOL';
  target: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export default function EmergencyStops() {
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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
    if (!confirm('Are you sure you want to delete this breaker?')) {
      return;
    }

    try {
      await apiClient.delete(`/api/breakers/${id}`);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error deleting breaker');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold">Emergency Stop Breakers</h3>
          <p className="text-sm text-gray-600 mt-1">
            Circuit breakers for instantly blocking tool calls
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Breaker
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Loading breakers...
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {breakers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No breakers configured
                  </td>
                </tr>
              ) : (
                breakers.map((breaker) => (
                  <tr key={breaker.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          breaker.scope === 'GLOBAL'
                            ? 'bg-red-100 text-red-800'
                            : breaker.scope === 'AGENT'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {breaker.scope}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {breaker.target || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          breaker.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {breaker.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {breaker.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleToggle(breaker.id, breaker.status)}
                        className={`${
                          breaker.status === 'ACTIVE'
                            ? 'text-gray-600 hover:text-gray-900'
                            : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {breaker.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(breaker.id)}
                        className="text-red-600 hover:text-red-900"
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

      {/* Create Breaker Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Breaker</h3>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scope
                  </label>
                  <select
                    value={formData.scope}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scope: e.target.value as 'GLOBAL' | 'AGENT' | 'TOOL',
                        target: '',
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="TOOL">Tool (block specific tool)</option>
                    <option value="AGENT">Agent (block specific agent)</option>
                    <option value="GLOBAL">Global (block everything)</option>
                  </select>
                </div>

                {formData.scope !== 'GLOBAL' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target ({formData.scope === 'AGENT' ? 'Agent ID' : 'Tool Name'})
                    </label>
                    <input
                      type="text"
                      value={formData.target}
                      onChange={(e) =>
                        setFormData({ ...formData, target: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder={
                        formData.scope === 'AGENT' ? 'e.g., sales_bot' : 'e.g., send_email'
                      }
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="Why are you creating this breaker?"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
