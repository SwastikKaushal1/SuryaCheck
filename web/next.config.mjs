/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === '1'

const nextConfig = {
  // STATIC_EXPORT=1 writes a plain static site to web/out for S3 + CloudFront (see infra/deploy.ps1).
  // The whole app runs in the browser, so nothing is lost. Docker and `pnpm dev` keep the normal server.
  ...(staticExport ? { output: 'export' } : {}),
  // Dev only: /backend/* is forwarded to the local FastAPI server, so a phone on your Wi-Fi (or a tunnel)
  // only needs the website's address. Use it with NEXT_PUBLIC_API_URL=/backend.
  ...(staticExport
    ? {}
    : {
        // Dev only: let a phone reach the dev server through a Cloudflare tunnel or your Wi-Fi address
        // (otherwise Next.js answers "Unauthorized" to the page's scripts and live reload).
        allowedDevOrigins: ['*.trycloudflare.com', '192.168.*.*', '10.*.*.*'],
        async rewrites() {
          return [{ source: '/backend/:path*', destination: `${process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'}/:path*` }]
        },
      }),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
