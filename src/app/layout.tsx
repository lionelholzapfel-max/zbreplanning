import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ZbrePlanning - La team au complet",
  description: "Plateforme de planning pour la Zbre Team - Activités, Coupe du Monde 2026 et plus",
  icons: {
    icon: "/team/group.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} dark`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Browser compatibility check
              try {
                // Test for features required by React 19
                if (typeof globalThis === 'undefined' || !window.Promise || !Array.prototype.includes) {
                  throw new Error('unsupported');
                }
              } catch(e) {
                document.addEventListener('DOMContentLoaded', function() {
                  document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center;background:#0a0a0f;color:white;font-family:system-ui,sans-serif;"><h1 style="font-size:24px;margin-bottom:16px;">⚠️ Navigateur non supporté</h1><p style="color:#9ca3af;max-width:400px;">ZbrePlanning nécessite iOS 15.4+ ou un navigateur récent. Mets à jour ton iPhone ou utilise Chrome/Firefox sur un autre appareil.</p></div>';
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#0a0a0f] text-white antialiased">
        <noscript>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>JavaScript requis</h1>
            <p style={{ color: '#9ca3af' }}>Active JavaScript pour utiliser ZbrePlanning.</p>
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
