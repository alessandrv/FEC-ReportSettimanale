/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['172.16.16.92'],
}

export default nextConfig
