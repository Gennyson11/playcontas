import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayContas - Marketplace Seguro de Contas, Jogos & Ativos Digitais",
  description:
    "Compre e venda contas de IA, Gemini Pro, ChatGPT Plus, Jogos, Chaves Steam e Ferramentas com pagamento protegido e entrega automática 24 horas no PlayContas.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className="bg-[#F8FAFC] text-zinc-900 min-h-screen flex flex-col antialiased selection:bg-[#0066FF] selection:text-white">
        {children}
      </body>
    </html>
  );
}
