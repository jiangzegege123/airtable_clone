import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "~/components/ui/use-toast";
import { Toaster } from "~/components/ui/toast";

import "~/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Airtable Clone",
  description: "A simple Airtable clone built with Next.js and tRPC",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <SessionProvider>
          <ToastProvider>
            <TRPCReactProvider>{children}</TRPCReactProvider>
            <Toaster />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
