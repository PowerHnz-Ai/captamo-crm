import type { Metadata } from "next";
import { DM_Sans, Nunito_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppDialogProvider } from "@/components/ui/AppDialogProvider";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Fonte da logo Captamo (Nunito Sans ExtraBold).
const nunitoSans = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["800"],
});

export const metadata: Metadata = {
  title: "Captamo",
  description: "Captamo — CRM de WhatsApp para captação e atendimento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${dmSans.variable} ${jakarta.variable} ${nunitoSans.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem('ultra-preferences')||'{}');var t=p.theme||'dark';if(t==='system'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var r=document.documentElement;r.setAttribute('data-theme',t);r.setAttribute('data-font-size',p.fontSize||'medium');if(p.accent){r.style.setProperty('--accent',p.accent);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AppDialogProvider>{children}</AppDialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
