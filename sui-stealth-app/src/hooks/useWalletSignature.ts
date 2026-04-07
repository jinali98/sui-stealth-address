import { useSignPersonalMessage } from '@mysten/dapp-kit';
import { useCallback } from 'react';

const STEALTH_MESSAGE = 'Generate stealth meta-address for this wallet';

export function useWalletSignature() {
  const { mutateAsync: signPersonalMessage, isPending } = useSignPersonalMessage();

  const signForStealth = useCallback(async (): Promise<string> => {
    const result = await signPersonalMessage({
      message: new TextEncoder().encode(STEALTH_MESSAGE)
    });

    // result.signature is base64, convert to hex
    const bytes = Uint8Array.from(atob(result.signature), c => c.charCodeAt(0));

    // Skip first byte (scheme flag) and extract 64-byte signature
    const sigBytes = bytes.slice(1, 65);

    // Convert to hex
    return Array.from(sigBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }, [signPersonalMessage]);

  return { signForStealth, isPending };
}
