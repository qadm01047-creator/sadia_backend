/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable body parsing for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig

