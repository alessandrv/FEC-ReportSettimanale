/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  // oracledb is a native module — keep it out of the bundle so it loads at runtime.
  serverExternalPackages: ['oracledb'],
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['172.16.16.92'],
  output: 'standalone'
}

export default nextConfig
