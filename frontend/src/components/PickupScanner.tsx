import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface PickupScannerProps {
  onToken: (token: string) => void;
  onError: (message: string) => void;
}

let scannerLifecycle: Promise<void> = Promise.resolve();

export default function PickupScanner({ onToken, onError }: PickupScannerProps) {
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onToken, onError]);

  useEffect(() => {
    let active = true;
    let decoded = false;
    const scanner = new Html5Qrcode('pickup-qr-reader', {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    const started = scannerLifecycle.then(async () => {
      if (!active) return;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (active && !decoded) {
            decoded = true;
            onTokenRef.current(decodedText);
          }
        },
        undefined
      );
      if (!active && scanner.isScanning) await scanner.stop();
    }).catch((reason: unknown) => {
      if (active) {
        onErrorRef.current(
          reason instanceof Error ? reason.message : 'Could not start the camera scanner'
        );
      }
    });
    scannerLifecycle = started;

    return () => {
      active = false;
      const cleanup = scannerLifecycle.then(async () => {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      });
      scannerLifecycle = cleanup.catch((reason: unknown) => {
        console.error('[PickupScanner] Could not stop the camera scanner:', reason);
      });
    };
  }, []);

  return <div aria-label="Pickup QR scanner" id="pickup-qr-reader" />;
}
