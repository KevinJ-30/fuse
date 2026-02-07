import { useState, useEffect } from 'react';
import './CustomerRefundPortal.css';

// Sample orders for the dropdown
const SAMPLE_ORDERS = [
  { id: 'ord_12345', name: 'Blue Widget', amount: 50 },
  { id: 'ord_67890', name: 'Premium Package', amount: 350 },
  { id: 'ord_11111', name: 'Enterprise Plan', amount: 750 },
  { id: 'ord_99999', name: 'Deluxe Bundle', amount: 6000 },
  { id: 'ord_22222', name: 'Starter Kit', amount: 100 },
];

const REFUND_REASONS = [
  'Product arrived damaged',
  'Wrong item shipped',
  'Not satisfied with quality',
  'Changed my mind',
  'Product defective',
];

type Status = 'idle' | 'loading' | 'success' | 'error' | 'pending';

export default function CustomerRefundPortal() {
  const [selectedOrder, setSelectedOrder] = useState(SAMPLE_ORDERS[0].id);
  const [selectedReason, setSelectedReason] = useState(REFUND_REASONS[0]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);

  // Get order details
  const orderDetails = SAMPLE_ORDERS.find(o => o.id === selectedOrder);

  // Listen for messages from parent window (demo control)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'REFUND_RESULT') {
        const { status: resultStatus, amount, reason } = event.data.data;

        setRefundAmount(amount);

        if (resultStatus === 'COMPLETED' || resultStatus === 'executed') {
          setStatus('success');
          setMessage(`Your refund of $${amount} has been approved!`);
        } else if (resultStatus === 'BLOCKED' || resultStatus === 'blocked') {
          setStatus('error');
          setMessage('Your refund request could not be processed. Please contact support.');
        } else if (resultStatus === 'AWAITING_APPROVAL' || resultStatus === 'pending') {
          setStatus('pending');
          setMessage("Your request is under review. We'll email you within 24 hours.");
        } else {
          setStatus('error');
          setMessage('An error occurred while processing your request. Please try again.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderDetails) return;

    setStatus('loading');
    setMessage('');
    setRefundAmount(orderDetails.amount);

    // Post message to parent window
    window.parent.postMessage({
      type: 'REFUND_REQUESTED',
      data: {
        orderId: selectedOrder,
        amount: orderDetails.amount,
        reason: selectedReason,
        customerId: `cus_${selectedOrder}`,
      }
    }, '*');

    // Set loading message
    setMessage('Processing your refund request...');
  };

  const handleReset = () => {
    setStatus('idle');
    setMessage('');
    setRefundAmount(0);
    setSelectedOrder(SAMPLE_ORDERS[0].id);
    setSelectedReason(REFUND_REASONS[0]);
  };

  return (
    <div className="customer-portal">
      <div className="portal-container">
        <div className="portal-header">
          <h1 className="portal-title">Request a Refund</h1>
          <p className="portal-subtitle">We're here to help. Select your order below to get started.</p>
        </div>

        {status === 'idle' || status === 'loading' ? (
          <form onSubmit={handleSubmit} className="refund-form">
            <div className="form-field">
              <label htmlFor="order" className="form-label">Select Order</label>
              <select
                id="order"
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                className="form-select"
                disabled={status === 'loading'}
              >
                {SAMPLE_ORDERS.map(order => (
                  <option key={order.id} value={order.id}>
                    Order #{order.id.split('_')[1]} - {order.name} - ${order.amount}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="amount" className="form-label">Refund Amount</label>
              <div className="amount-display-large">
                ${orderDetails?.amount.toFixed(2)}
              </div>
              <p className="form-help">Full order amount will be refunded</p>
            </div>

            <div className="form-field">
              <label htmlFor="reason" className="form-label">Reason for Refund</label>
              <select
                id="reason"
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="form-select"
                disabled={status === 'loading'}
              >
                {REFUND_REASONS.map(reason => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                'Request Refund'
              )}
            </button>

            {status === 'loading' && (
              <div className="status-message loading">
                <div className="status-icon">⏳</div>
                <div className="status-text">{message}</div>
              </div>
            )}
          </form>
        ) : (
          <div className="result-container">
            <div className={`status-message ${status}`}>
              <div className="status-icon">
                {status === 'success' && '✓'}
                {status === 'error' && '✗'}
                {status === 'pending' && '⏳'}
              </div>
              <div className="status-text">{message}</div>
            </div>

            {status === 'success' && (
              <div className="success-details">
                <div className="detail-row">
                  <span className="detail-label">Refund Amount:</span>
                  <span className="detail-value">${refundAmount}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value">Approved</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Processing Time:</span>
                  <span className="detail-value">3-5 business days</span>
                </div>
              </div>
            )}

            {status === 'pending' && (
              <div className="pending-details">
                <p>Your refund request has been received and is being reviewed by our team.</p>
                <p>Reference: {selectedOrder}</p>
              </div>
            )}

            <button onClick={handleReset} className="reset-button">
              Submit Another Request
            </button>
          </div>
        )}

        <div className="portal-footer">
          <p>Need help? Contact our support team at <a href="mailto:support@example.com">support@example.com</a></p>
        </div>
      </div>
    </div>
  );
}
