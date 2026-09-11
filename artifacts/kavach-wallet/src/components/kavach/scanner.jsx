'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const QRScanner = ({ onScanned, onClose }) => {
  const containerId = 'kavach-qr-reader';
  const scannerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        const mod = await import('html5-qrcode');
        const { Html5Qrcode } = mod;
        const cams = await Html5Qrcode.getCameras();
        if (!cams || !cams.length) throw new Error('No camera found.');
        if (!mounted) return;
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 240 },
          (decoded) => {
            onScanned(decoded);
            scanner.stop().catch(() => {});
          },
          () => {}
        );
      } catch (e) {
        setError(e.message || 'Could not open the camera. Allow camera access in your browser.');
      }
    };
    start();
    return () => {
      mounted = false;
      try { scannerRef.current?.stop().catch(() => {}); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-black/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white">
          <Camera className="h-5 w-5" />
          <span className="text-sm font-semibold">Scan QR Code</span>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>

      <div id={containerId} className="h-full w-full" />

      {error && (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl border border-red-500/30 bg-slate-950 p-5 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-3 text-sm text-red-200">{error}</p>
          <Button onClick={onClose} className="mt-4 bg-slate-800 text-white hover:bg-slate-700">Tutup</Button>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-4 text-center text-xs text-slate-300 backdrop-blur-sm">
        Point your camera at a crypto address QR code
      </div>
    </div>
  );
};
