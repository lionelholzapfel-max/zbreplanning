import type { NextConfig } from "next";

const IMMUTABLE = 'public, max-age=31536000, immutable';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  async headers() {
    return [
      // Fresh HTML/API by default to avoid stale content.
      {
        source: '/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      // Static assets (avatars, sounds, flags…) are immutable per URL — cache them
      // hard instead of re-downloading tens of MB on every visit. This rule is placed
      // after the one above so it wins for these file types.
      {
        source: '/:all*(png|jpg|jpeg|gif|webp|svg|ico|mp3|woff|woff2)',
        headers: [{ key: 'Cache-Control', value: IMMUTABLE }],
      },
    ];
  },
};

export default nextConfig;
// Deployment trigger: 1781450840
