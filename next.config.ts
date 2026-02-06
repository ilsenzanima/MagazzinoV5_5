import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ===== IMAGE OPTIMIZATION =====
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },

  // ===== PERFORMANCE =====
  compress: true,

  // ===== CACHING HEADERS =====
  async headers() {
    // Content Security Policy - adjust domains as needed
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://docs.opencv.org https://cdn.jsdelivr.net", // Required for Next.js + OpenCV.js for document scanner
      "script-src-elem 'self' 'unsafe-inline' https://vercel.live https://docs.opencv.org https://cdn.jsdelivr.net", // For Chrome's stricter CSP + OpenCV.js
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://*.openstreetmap.org https://*.tile.openstreetmap.org",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.github.com https://raw.githubusercontent.com https://nominatim.openstreetmap.org",
      "frame-src 'self' https://www.google.com https://maps.google.com https://*.openstreetmap.org", // For map embeds
      "worker-src 'self'", // For Service Worker
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      // Service Worker - must be served without redirect
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      // Static assets - immutable cache
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },

  // ===== BUNDLE OPTIMIZATION =====
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // ===== PRODUCTION SOURCE MAPS =====
  productionBrowserSourceMaps: false,
};

export default nextConfig;
