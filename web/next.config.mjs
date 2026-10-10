/** @type {import('next').NextConfig} */
const nextConfig = {
  // STATIC_EXPORT=1 writes a plain static site to web/out for S3 + CloudFront (see infra/deploy.ps1).
  // The whole app runs in the browser, so nothing is lost. Docker and `pnpm dev` keep the normal server.
  ...(process.env.STATIC_EXPORT === '1' ? { output: 'export' } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
