import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
    allowedDevOrigins: ["https://grew-salem-descriptions-measure.trycloudflare.com", "https://*.trycloudflare.com"]
  },
  webpack: (config) => {
    config.externals.push({
      '@aws-sdk/client-s3': 'commonjs @aws-sdk/client-s3',
      'aws-sdk': 'commonjs aws-sdk',
      'mock-aws-s3': 'commonjs mock-aws-s3',
      'nock': 'commonjs nock',
    });
    return config;
  },
};

export default nextConfig;
