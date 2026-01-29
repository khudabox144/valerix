import { useState, useEffect } from 'react';
import axios from 'axios';

export default function InventoryList() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(fetchInventory, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_INVENTORY_API_URL}/api/inventory`
      );
      setInventory(response.data.items || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch inventory');
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (quantity) => {
    if (quantity === 0) {
      return { text: 'Out of Stock', className: 'bg-red-100 text-red-800' };
    } else if (quantity < 20) {
      return { text: 'Low Stock', className: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { text: 'In Stock', className: 'bg-green-100 text-green-800' };
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Inventory Status</h2>
      </div>

      {error && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {inventory.map((item) => {
          const stockStatus = getStockStatus(item.quantity);
          return (
            <div
              key={item.item_id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.item_name}
                </h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.className}`}>
                  {stockStatus.text}
                </span>
              </div>
              
              <p className="text-sm text-gray-500 mb-3">ID: {item.item_id}</p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Available:</span>
                  <span className="font-semibold text-gray-900">{item.quantity}</span>
                </div>
                {item.reserved_quantity > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Reserved:</span>
                    <span className="font-semibold text-gray-900">{item.reserved_quantity}</span>
                  </div>
                )}
              </div>

              {/* Stock bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    item.quantity === 0
                      ? 'bg-red-500'
                      : item.quantity < 20
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((item.quantity / 200) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
