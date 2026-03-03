import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['ethers', 'mysql2', 'bcryptjs'],
};

export default nextConfig;
