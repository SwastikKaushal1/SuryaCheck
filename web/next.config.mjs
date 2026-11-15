/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === '1'

// On Vercel the API is the `backend` service at /backend on this same domain (see vercel.json).
const apiUrlOnVercel = process.env.VERCEL && !process.env.NEXT_PUBLIC_API_URL ? { NEXT_PUBLIC_API_URL: '/backend' } : {}

const nextConfig = {
  env: apiUrlOnVercel,
  // STATIC_EXPORT=1 writes a plain static site to web/out for S3 + CloudFront (see infra/deploy.ps1).
  // The whole app runs in the browser, so nothing is lost. Docker and `pnpm dev` keep the normal server.
  ...(staticExport ? { output: 'export' } : {}),
  // Local and Docker: /backend/* is forwarded to the FastAPI server (BACKEND_URL, the local one by default), so the
  // browser only talks to the website's address: no CORS, and a phone on your Wi-Fi or a tunnel works too.
  // Use it with NEXT_PUBLIC_API_URL=/backend. On Vercel, vercel.json routes /backend/* before it reaches Next.js.
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
