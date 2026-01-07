import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  PaymentElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { API_URL, STRIPE_PUBLISHABLE_KEY } from '../config';

// Load Stripe with your publishable key
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ playerId, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Confirm the payment
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (stripeError) {
        setError(stripeError.message);
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded! Upgrade the player
        const response = await fetch(`${API_URL}/api/payment/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: playerId,
            stripePaymentId: paymentIntent.id,
          }),
        });

        const data = await response.json();

        if (data.success) {
          onSuccess(data.profileToken);
        } else {
          setError(data.error || 'Failed to activate profile');
        }
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-payment-form">
      <PaymentElement />

      {error && <div className="error-message">{error}</div>}

      <div className="payment-actions">
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="btn btn-primary"
        >
          {isProcessing ? 'Processing...' : 'Pay $19.00'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={isProcessing}
        >
          ← Cancel
        </button>
      </div>
    </form>
  );
}

function StripePayment({ playerId, onSuccess, onCancel }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create payment intent when component mounts
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch(`${API_URL}/api/payment/create-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: playerId,
            amount: 1900, // $19.00 in cents
          }),
        });

        const data = await response.json();

        if (data.success) {
          setClientSecret(data.clientSecret);
        } else {
          setError(data.error || 'Failed to initialize payment');
        }
      } catch (err) {
        setError('Failed to connect to payment server');
        console.error('Payment intent error:', err);
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [playerId]);

  if (loading) {
    return (
      <div className="payment-loading">
        <div className="spinner"></div>
        <p>Initializing payment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payment-error">
        <p className="error-message">{error}</p>
        <button onClick={onCancel} className="btn btn-secondary">
          ← Go Back
        </button>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#58a6ff',
        colorBackground: '#161b22',
        colorText: '#c9d1d9',
        colorDanger: '#f85149',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
        borderRadius: '10px',
      },
    },
  };

  return (
    <div className="stripe-payment-container">
      {clientSecret && (
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm
            playerId={playerId}
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        </Elements>
      )}
    </div>
  );
}

export default StripePayment;
