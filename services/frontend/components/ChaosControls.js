import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ChaosControls() {
  const [chaosConfig, setChaosConfig] = useState({
    latency: false,
    latency_ms: 5000,
    crash_rate: 0,
    partial_failure_rate: 0,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);

  useEffect(() => {
    fetchCurrentConfig();
  }, []);

  const fetchCurrentConfig = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_INVENTORY_API_URL}/api/admin/chaos`
      );
      setCurrentConfig(response.data.config);
    } catch (error) {
      console.error('Error fetching chaos config:', error);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_INVENTORY_API_URL}/api/admin/chaos`,
        chaosConfig
      );

      setMessage({
        type: 'success',
        text: 'Chaos configuration applied successfully!',
      });

      fetchCurrentConfig();

    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to apply chaos configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_INVENTORY_API_URL}/api/admin/chaos`
      );

      setChaosConfig({
        latency: false,
        latency_ms: 5000,
        crash_rate: 0,
        partial_failure_rate: 0,
      });

      setMessage({
        type: 'success',
        text: 'Chaos engineering disabled',
      });

      fetchCurrentConfig();

    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to disable chaos engineering',
      });
    } finally {
      setLoading(false);
    }
  };

  const presets = {
    mild: {
      latency: true,
      latency_ms: 2000,
      crash_rate: 0.1,
      partial_failure_rate: 0.05,
    },
    moderate: {
      latency: true,
      latency_ms: 5000,
      crash_rate: 0.3,
      partial_failure_rate: 0.2,
    },
    extreme: {
      latency: true,
      latency_ms: 10000,
      crash_rate: 0.5,
      partial_failure_rate: 0.3,
    },
  };

  const applyPreset = (preset) => {
    setChaosConfig(presets[preset]);
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-red-50 border-l-4 border-red-500 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Chaos Engineering Controls
            </h3>
            <p className="mt-1 text-sm text-red-700">
              Use these controls to simulate real-world failures in the Inventory Service.
              Perfect for demonstrating resilience patterns during presentations.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Configure Chaos</h2>

          <div className="space-y-4">
            {/* Latency Control */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Introduce Latency
                </label>
                <input
                  type="checkbox"
                  checked={chaosConfig.latency}
                  onChange={(e) => setChaosConfig({ ...chaosConfig, latency: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
              {chaosConfig.latency && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Delay (ms): {chaosConfig.latency_ms}
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="15000"
                    step="1000"
                    value={chaosConfig.latency_ms}
                    onChange={(e) => setChaosConfig({ ...chaosConfig, latency_ms: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Crash Rate Control */}
            <div className="border-b border-gray-200 pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crash Rate: {(chaosConfig.crash_rate * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={chaosConfig.crash_rate}
                onChange={(e) => setChaosConfig({ ...chaosConfig, crash_rate: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Probability of request failing with 500 error
              </p>
            </div>

            {/* Partial Failure Rate Control */}
            <div className="pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Partial Failure Rate: {(chaosConfig.partial_failure_rate * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={chaosConfig.partial_failure_rate}
                onChange={(e) => setChaosConfig({ ...chaosConfig, partial_failure_rate: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Schrödinger's Warehouse: DB commits but response fails
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleApply}
                disabled={loading}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-white transition-colors ${
                  loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? 'Applying...' : 'Apply Chaos'}
              </button>
              <button
                onClick={handleDisable}
                disabled={loading}
                className="flex-1 py-2 px-4 rounded-md font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                Disable All
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`mt-4 p-3 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <p className="text-sm">{message.text}</p>
            </div>
          )}
        </div>

        {/* Presets & Current Status */}
        <div className="space-y-6">
          {/* Presets */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Presets</h2>
            
            <div className="space-y-3">
              <button
                onClick={() => applyPreset('mild')}
                className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-yellow-400 transition-colors"
              >
                <h3 className="font-semibold text-gray-900">🟡 Mild Chaos</h3>
                <p className="text-sm text-gray-600 mt-1">
                  2s latency, 10% crash rate, 5% partial failures
                </p>
              </button>

              <button
                onClick={() => applyPreset('moderate')}
                className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-orange-400 transition-colors"
              >
                <h3 className="font-semibold text-gray-900">🟠 Moderate Chaos</h3>
                <p className="text-sm text-gray-600 mt-1">
                  5s latency, 30% crash rate, 20% partial failures
                </p>
              </button>

              <button
                onClick={() => applyPreset('extreme')}
                className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-red-400 transition-colors"
              >
                <h3 className="font-semibold text-gray-900">🔴 Extreme Chaos</h3>
                <p className="text-sm text-gray-600 mt-1">
                  10s latency, 50% crash rate, 30% partial failures
                </p>
              </button>
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Current Status</h2>
            
            {currentConfig ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Latency:</span>
                  <span className="font-semibold">
                    {currentConfig.latency ? `${currentConfig.latency_ms}ms` : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Crash Rate:</span>
                  <span className="font-semibold">
                    {(currentConfig.crash_rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Partial Failure:</span>
                  <span className="font-semibold">
                    {(currentConfig.partial_failure_rate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading configuration...</p>
            )}
          </div>
        </div>
      </div>

      {/* Demo Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          💡 Presentation Demo Flow
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>Open the Health dashboard in a separate screen/split view</li>
          <li>Show normal operations (green status, fast response times)</li>
          <li>Apply "Moderate Chaos" preset</li>
          <li>Watch the Health dashboard turn RED (latency spike)</li>
          <li>Create orders on the Orders tab - they still work!</li>
          <li>Show the circuit breaker fallback messages</li>
          <li>Disable chaos - watch system recover (GREEN)</li>
        </ol>
      </div>
    </div>
  );
}
