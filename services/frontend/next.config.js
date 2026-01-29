/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_ORDER_API_URL: process.env.NEXT_PUBLIC_ORDER_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_INVENTORY_API_URL: process.env.NEXT_PUBLIC_INVENTORY_API_URL || 'http://localhost:3002',
  },
}

module.exports = nextConfig
