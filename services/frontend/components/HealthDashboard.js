import { useState, useEffect } from 'react';
import axios from 'axios';

export default function HealthDashboard() {
  const [orderHealth, setOrderHealth] = useState(null);
  const [inventoryHealth, setInventoryHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [responseTimes, setResponseTimes] = useState([]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    const startTime = Date.now();

    try {
      const [orderResponse, inventoryResponse] = await Promise.allSettled([
        axios.get(`${process.env.NEXT_PUBLIC_ORDER_API_URL}/health/deep`, { timeout: 5000 }),
        axios.get(`${process.env.NEXT_PUBLIC_INVENTORY_API_URL}/health`, { timeout: 5000 }),
      ]);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Update response times for rolling average
      setResponseTimes(prev => {
        const updated = [...prev, responseTime].slice(-10); // Keep last 10 measurements
        const avg = updated.reduce((sum, time) => sum + time, 0) / updated.length;
        setAvgResponseTime(avg);
        return updated;
      });

      if (orderResponse.status === 'fulfilled') {
        setOrderHealth({
          healthy: true,
          ...orderResponse.value.data,
        });
      } else {
        setOrderHealth({
          healthy: false,
          error: orderResponse.reason.message,
        });
      }

      if (inventoryResponse.status === 'fulfilled') {
        setInventoryHealth({
          healthy: true,
          ...inventoryResponse.value.data,
        });
      } else {
        setInventoryHealth({
          healthy: false,
          error: inventoryResponse.reason.message,
        });
      }

    } catch (error) {
      console.error('Error fetching health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (healthy) => {
    return healthy ? 'bg-green-500' : 'bg-red-500';
  };

  const getResponseTimeColor = () => {
    if (avgResponseTime > 1000) return 'bg-red-500'; // Red if > 1 second
    if (avgResponseTime > 500) return 'bg-yellow-500'; // Yellow if > 500ms
    return 'bg-green-500'; // Green otherwise
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
    <div className="space-y-6">
      {/* Alert Banner */}
      <div className={`rounded-lg p-4 ${getResponseTimeColor()}`}>
        <div className="flex items-center justify-between text-white">
          <div>
            <h3 className="text-lg font-bold">System Response Time</h3>
            <p className="text-sm opacity-90">
              {avgResponseTime > 1000 
                ? '⚠️ ALERT: Response time exceeds 1 second threshold' 
                : '✓ System responding normally'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{avgResponseTime.toFixed(0)}ms</p>
            <p className="text-sm opacity-90">30-second rolling average</p>
          </div>
        </div>
      </div>

      {/* Service Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Service */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Order Service</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(orderHealth?.healthy)} animate-pulse`}></div>
              <span className="text-sm font-medium text-gray-700">
                {orderHealth?.healthy ? 'Healthy' : 'Degraded'}
              </span>
            </div>
          </div>

          <div className="px-6 py-4 space-y-3">
            {orderHealth?.checks && Object.entries(orderHealth.checks).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className={`text-sm font-medium ${
                  value === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {value}
                </span>
              </div>
            ))}
            {orderHealth?.error && (
              <div className="text-sm text-red-600 mt-2">
                Error: {orderHealth.error}
              </div>
            )}
          </div>
        </div>

        {/* Inventory Service */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Inventory Service</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(inventoryHealth?.healthy)} animate-pulse`}></div>
              <span className="text-sm font-medium text-gray-700">
                {inventoryHealth?.healthy ? 'Healthy' : 'Degraded'}
              </span>
            </div>
          </div>

          <div className="px-6 py-4 space-y-3">
            {inventoryHealth?.checks && Object.entries(inventoryHealth.checks).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className={`text-sm font-medium ${
                  value === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {value}
                </span>
              </div>
            ))}
            {inventoryHealth?.error && (
              <div className="text-sm text-red-600 mt-2">
                Error: {inventoryHealth.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">System Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Order Service</p>
            <p className="text-lg font-semibold text-gray-900">
              {orderHealth?.healthy ? '✓ Online' : '✗ Offline'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Inventory Service</p>
            <p className="text-lg font-semibold text-gray-900">
              {inventoryHealth?.healthy ? '✓ Online' : '✗ Offline'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Avg Response</p>
            <p className="text-lg font-semibold text-gray-900">
              {avgResponseTime.toFixed(0)}ms
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Last Check</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
