// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AarogyaVaani — Digital Health Locker',
    short_name: 'AarogyaVaani',
    description: 'Your patient-controlled digital health locker.',
    start_url: '/',
    display: 'standalone', // This is crucial: it removes the browser URL bar
    background_color: '#ffffff',
    theme_color: '#086f83', // Use your brand color (e.g., Tailwind teal-700)
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}