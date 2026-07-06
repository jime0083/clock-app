const mockGetRandomBytesAsync = jest.fn((n: number) => Promise.resolve(new Uint8Array(n).fill(7)));
const mockDigestStringAsync = jest.fn((..._args: unknown[]) => Promise.resolve('ZGlnZXN0'));
const mockOpenAuthSessionAsync = jest.fn();

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: (n: number) => mockGetRandomBytesAsync(n),
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  CryptoEncoding: { BASE64: 'BASE64' },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

jest.mock('expo-auth-session', () => ({}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { x: { clientId: 'test-client-id' } } },
}));

jest.mock('firebase/firestore', () => ({
  Timestamp: { now: jest.fn(() => ({ seconds: 0, nanoseconds: 0 })) },
}));

import { startXAuth, revokeXToken } from '../../services/xAuthService';

// 16 bytes of 0x07 -> hex "07" x16
const STATE_HEX = '07'.repeat(16);
const CALLBACK_BASE = `okiroya://?code=auth-code-123&state=${STATE_HEX}`;

describe('xAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRandomBytesAsync.mockImplementation((n: number) =>
      Promise.resolve(new Uint8Array(n).fill(7))
    );
    mockDigestStringAsync.mockResolvedValue('ZGlnZXN0');
  });

  describe('startXAuth', () => {
    it('should complete the full OAuth flow and return a connection', async () => {
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success', url: CALLBACK_BASE });
      (global as unknown as { fetch: jest.Mock }).fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'access-token-1',
              refresh_token: 'refresh-token-1',
              expires_in: 7200,
              token_type: 'bearer',
              scope: 'tweet.write',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { id: '1', name: 'Test', username: 'testuser' } }),
        });

      const result = await startXAuth();

      expect(result.success).toBe(true);
      expect(result.connection).toEqual(
        expect.objectContaining({
          connected: true,
          accessToken: 'access-token-1',
          refreshToken: 'refresh-token-1',
          username: 'testuser',
        })
      );
    });

    it('should report cancellation', async () => {
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' });

      const result = await startXAuth();

      expect(result).toEqual({ success: false, error: 'Authentication cancelled' });
    });

    it('should report a generic failure for other non-success results', async () => {
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'dismiss' });

      const result = await startXAuth();

      expect(result).toEqual({ success: false, error: 'Authentication failed' });
    });

    it('should surface an X-reported error from the callback', async () => {
      mockOpenAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: 'okiroya://?error=access_denied',
      });

      const result = await startXAuth();

      expect(result.success).toBe(false);
      expect(result.error).toContain('access_denied');
    });

    it('should fail when no authorization code is present', async () => {
      mockOpenAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: `okiroya://?state=${STATE_HEX}`,
      });

      const result = await startXAuth();

      expect(result).toEqual({ success: false, error: 'No authorization code received' });
    });

    it('should detect a state mismatch (possible CSRF)', async () => {
      mockOpenAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: 'okiroya://?code=auth-code-123&state=wrong-state',
      });

      const result = await startXAuth();

      expect(result).toEqual({
        success: false,
        error: 'State mismatch - possible CSRF attack',
      });
    });

    it('should surface a token exchange failure', async () => {
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success', url: CALLBACK_BASE });
      (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error_description: 'invalid_grant' }),
      });

      const result = await startXAuth();

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_grant');
    });

    it('should surface a user-info fetch failure', async () => {
      mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success', url: CALLBACK_BASE });
      (global as unknown as { fetch: jest.Mock }).fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'access-token-1',
              refresh_token: 'refresh-token-1',
              expires_in: 7200,
              token_type: 'bearer',
              scope: 'tweet.write',
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ detail: 'user lookup failed' }),
        });

      const result = await startXAuth();

      expect(result.success).toBe(false);
      expect(result.error).toBe('user lookup failed');
    });

    it('should fail gracefully when X credentials are not configured', async () => {
      jest.resetModules();
      jest.doMock('expo-constants', () => ({ expoConfig: { extra: {} } }));
      jest.doMock('expo-crypto', () => ({
        getRandomBytesAsync: (n: number) => mockGetRandomBytesAsync(n),
        digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
        CryptoDigestAlgorithm: { SHA256: 'SHA256' },
        CryptoEncoding: { BASE64: 'BASE64' },
      }));
      jest.doMock('expo-web-browser', () => ({
        maybeCompleteAuthSession: jest.fn(),
        openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
      }));
      jest.doMock('expo-auth-session', () => ({}));
      jest.doMock('firebase/firestore', () => ({
        Timestamp: { now: jest.fn(() => ({ seconds: 0, nanoseconds: 0 })) },
      }));

      const { startXAuth: startXAuthNoConfig } = require('../../services/xAuthService');
      const result = await startXAuthNoConfig();

      expect(result).toEqual({
        success: false,
        error: 'X API credentials are not configured',
      });
    });
  });

  describe('revokeXToken', () => {
    it('should return true when revocation succeeds', async () => {
      (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({ ok: true });

      expect(await revokeXToken('access-token-1')).toBe(true);
    });

    it('should return false when revocation fails', async () => {
      (global as unknown as { fetch: jest.Mock }).fetch = jest
        .fn()
        .mockResolvedValue({ ok: false });

      expect(await revokeXToken('access-token-1')).toBe(false);
    });

    it('should return false when the network call throws', async () => {
      (global as unknown as { fetch: jest.Mock }).fetch = jest
        .fn()
        .mockRejectedValue(new Error('network error'));

      expect(await revokeXToken('access-token-1')).toBe(false);
    });
  });
});
