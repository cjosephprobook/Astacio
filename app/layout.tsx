import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Service Zone Builder",
  description: "Zip-code heatmap and zone editor for service-region planning",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#fafaf7",
          fontFamily: "system-ui, sans-serif",
          color: "#1a1a1a",
        }}
      >
        {children}
      </body>
    </html>
  );
}
