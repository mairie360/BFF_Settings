import { useSessionPublicKey } from './session-keys';

// Every test app verifies the session tokens with Core's public key, the fixtures sign them like Core (EdDSA,
// MAIR-680), and no JWT_SECRET is set (bffs-lib >= 3 never reads it): HS256 tokens are refused.
useSessionPublicKey();
