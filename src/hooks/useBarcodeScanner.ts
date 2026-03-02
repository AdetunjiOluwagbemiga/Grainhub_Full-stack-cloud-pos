import { useEffect, useRef } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxTimeBetweenKeys?: number;
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minLength = 3,
  maxTimeBetweenKeys = 50,
  enabled = true,
}: BarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();

      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeSinceLastKey = currentTime - lastKeyTimeRef.current;

      if (timeSinceLastKey > maxTimeBetweenKeys && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (event.key === 'Enter') {
        event.preventDefault();

        if (bufferRef.current.length >= minLength) {
          const scannedCode = bufferRef.current.trim();
          bufferRef.current = '';
          onScan(scannedCode);
        } else {
          bufferRef.current = '';
        }

        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        bufferRef.current += event.key;
        lastKeyTimeRef.current = currentTime;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onScan, minLength, maxTimeBetweenKeys, enabled]);
}
