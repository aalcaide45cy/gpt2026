import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Norte Reformas | Espacios para vivir mejor",
  description: "Reformas integrales, cocinas y baños con diseño, oficio y total tranquilidad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
