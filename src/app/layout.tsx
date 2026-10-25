import type { Metadata, Viewport } from "next";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-sw";

export const metadata: Metadata = {
  title: { default: "Consultorio de Ana", template: "%s · Consultorio de Ana" },
  description: "Gestión de turnos y material para pacientes.",
  applicationName: "Consultorio de Ana",
  appleWebApp: { capable: true, title: "Consultorio", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2b6a62",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
