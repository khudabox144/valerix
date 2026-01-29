import { useState, useEffect } from 'react';
import Head from 'next/head';
import OrderForm from '@/components/OrderForm';
import OrdersList from '@/components/OrdersList';
import InventoryList from '@/components/InventoryList';
import HealthDashboard from '@/components/HealthDashboard';
import ChaosControls from '@/components/ChaosControls';

export default function Home() {
  const [activeTab, setActiveTab] = useState('orders');
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <>
      <Head>
        <title>Valerix - E-Commerce Platform</title>
        <meta name="description" content="Microservices E-Commerce Platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  🏆 Valerix Platform
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Microservices E-Commerce System
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Champion Edition
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('orders')}
                className={`${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                📦 Orders
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`${
                  activeTab === 'inventory'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                📊 Inventory
              </button>
              <button
                onClick={() => setActiveTab('health')}
                className={`${
                  activeTab === 'health'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                💚 Health
              </button>
              <button
                onClick={() => setActiveTab('chaos')}
                className={`${
                  activeTab === 'chaos'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                🔴 Chaos Control
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <OrderForm onOrderCreated={triggerRefresh} />
              <OrdersList key={refreshKey} />
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <InventoryList key={refreshKey} />
            </div>
          )}

          {activeTab === 'health' && (
            <div>
              <HealthDashboard />
            </div>
          )}

          {activeTab === 'chaos' && (
            <div>
              <ChaosControls />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-sm text-gray-500">
              Built for BUET Fest Hackathon - Microservices & DevOps Champion 🏆
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
