import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'Kavach Wallet — Multi-chain Crypto Wallet',
  description:
    'Kavach adalah wallet crypto non-custodial multi-chain. Kunci Anda, aset Anda — private key tidak pernah meninggalkan device.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased`}>
        {children}
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
