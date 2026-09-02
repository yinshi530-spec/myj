import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: process.env.GITHUB_ACTIONS ? '/myj' : '',
  trailingSlash: true,
};

export default nextConfig;
