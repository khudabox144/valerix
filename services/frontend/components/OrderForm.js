import { useState } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const ITEMS = [
  { id: 'ps5', name: 'PlayStation 5' },
  { id: 'xbox', name: 'Xbox Series X' },
  { id: 'switch', name: 'Nintendo Switch' },
  { id: 'laptop', name: 'Gaming Laptop' },
  { id: 'monitor', name: '4K Gaming Monitor' },
];

export default function OrderForm({ onOrderCreated }) {
  const [itemId, setItemId] = useState('ps5');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const idempotencyKey = uuidv4();

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_ORDER_API_URL}/api/orders`,
        {
          item_id: itemId,
          quantity: parseInt(quantity),
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
            'Content-Type': 'application/json',
          },
        }
      );

      setMessage({
        type: 'success',
        text: `Order created successfully! Order ID: ${response.data.order.order_id}`,
        status: response.data.order.status,
      });

      if (onOrderCreated) {
        onOrderCreated();
      }

      // Reset form
      setQuantity(1);

    } catch (error) {
      let errorMessage = 'Failed to create order';
      
      if (error.response) {
        errorMessage = error.response.data.message || error.response.data.error || errorMessage;
      } else if (error.request) {
        errorMessage = 'Order service is not responding. Please try again.';
      }

      setMessage({
        type: 'error',
        text: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Order</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="item" className="block text-sm font-medium text-gray-700 mb-1">
            Item
          </label>
          <select
            id="item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ITEMS.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min="1"
            max="100"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Creating Order...' : 'Create Order'}
        </button>
      </form>

      {message && (
        <div
          className={`mt-4 p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {message.text}
          </p>
          {message.status && (
            <p className="text-xs text-gray-600 mt-1">
              Status: <span className="font-semibold">{message.status}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
