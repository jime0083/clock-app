/**
 * Authentication Flow Integration Tests
 *
 * Tests the complete authentication flow including:
 * - Firebase Auth credential handling
 * - User profile creation/update in Firestore
 * - Admin status checking
 * - Sign out flow
 */

// Mock Firebase Auth
const mockSignInWithCredential = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock('firebase/auth', () => ({
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
  GoogleAuthProvider: {
    credential: jest.fn(() => ({ providerId: 'google.com' })),
  },
  OAuthProvider: jest.fn().mockImplementation(() => ({
    credential: jest.fn(() => ({ providerId: 'apple.com' })),
  })),
}));

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  collection: jest.fn(() => ({ id: 'mock-collection' })),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

// Mock Firebase instances
jest.mock('../../services/firebase', () => ({
  auth: {
    currentUser: null,
  },
  db: {},
}));

import {
  checkIsAdmin,
  convertToAppUser,
  createOrUpdateUserProfile,
  signInWithGoogle,
  signInWithApple,
  signOut,
  deleteAccount,
} from '../../services/authService';

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Admin Status Check', () => {
    it('should return true for admin user', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'admin-doc', data: () => ({ uid: 'admin-uid' }) }],
      });

      const isAdmin = await checkIsAdmin('admin-uid');

      expect(isAdmin).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const isAdmin = await checkIsAdmin('regular-uid');

      expect(isAdmin).toBe(false);
    });

    it('should return false when Firestore query fails', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const isAdmin = await checkIsAdmin('any-uid');

      expect(isAdmin).toBe(false);
    });
  });

  describe('Convert Firebase User to App User', () => {
    it('should convert regular user correctly', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      const firebaseUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      };

      const appUser = await convertToAppUser(firebaseUser as any);

      expect(appUser).toEqual({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
        isAdmin: false,
      });
    });

    it('should convert admin user correctly', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'admin-doc' }],
      });

      const firebaseUser = {
        uid: 'admin-123',
        email: 'admin@example.com',
        displayName: 'Admin User',
        photoURL: null,
      };

      const appUser = await convertToAppUser(firebaseUser as any);

      expect(appUser.isAdmin).toBe(true);
    });
  });

  describe('User Profile Creation', () => {
    it('should create new user profile when user does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const appUser = {
        uid: 'new-user-123',
        email: 'new@example.com',
        displayName: 'New User',
        photoURL: null,
        isAdmin: false,
      };

      await createOrUpdateUserProfile(appUser);

      expect(mockSetDoc).toHaveBeenCalled();
      const setDocCall = mockSetDoc.mock.calls[0];
      const userData = setDocCall[1];

      expect(userData.profile.email).toBe('new@example.com');
      expect(userData.profile.displayName).toBe('New User');
      expect(userData.settings.language).toBe('ja');
      expect(userData.stats.totalFailures).toBe(0);
    });

    it('should update existing user profile', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          profile: { email: 'old@example.com' },
        }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      const appUser = {
        uid: 'existing-user-123',
        email: 'updated@example.com',
        displayName: 'Updated User',
        photoURL: 'https://new-photo.jpg',
        isAdmin: false,
      };

      await createOrUpdateUserProfile(appUser);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          profile: expect.objectContaining({
            email: 'updated@example.com',
          }),
        }),
        { merge: true }
      );
    });
  });

  describe('Google Sign In Flow', () => {
    it('should complete Google sign in successfully', async () => {
      const mockFirebaseUser = {
        uid: 'google-user-123',
        email: 'google@example.com',
        displayName: 'Google User',
        photoURL: 'https://google.com/photo.jpg',
      };

      mockSignInWithCredential.mockResolvedValue({
        user: mockFirebaseUser,
      });
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      const appUser = await signInWithGoogle('mock-id-token');

      expect(mockSignInWithCredential).toHaveBeenCalled();
      expect(appUser.uid).toBe('google-user-123');
      expect(appUser.email).toBe('google@example.com');
      expect(mockSetDoc).toHaveBeenCalled(); // Profile was created
    });
  });

  describe('Apple Sign In Flow', () => {
    it('should complete Apple sign in successfully', async () => {
      const mockFirebaseUser = {
        uid: 'apple-user-123',
        email: 'apple@icloud.com',
        displayName: 'Apple User',
        photoURL: null,
      };

      mockSignInWithCredential.mockResolvedValue({
        user: mockFirebaseUser,
      });
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      const appUser = await signInWithApple('mock-identity-token', 'mock-nonce');

      expect(mockSignInWithCredential).toHaveBeenCalled();
      expect(appUser.uid).toBe('apple-user-123');
      expect(appUser.email).toBe('apple@icloud.com');
    });
  });

  describe('Sign Out Flow', () => {
    it('should sign out successfully', async () => {
      mockSignOut.mockResolvedValue(undefined);

      await signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Account Deletion Flow', () => {
    it('should delete user account and Firestore document', async () => {
      const mockAuth = require('../../services/firebase').auth;
      mockAuth.currentUser = { uid: 'delete-me-123' };

      mockDeleteDoc.mockResolvedValue(undefined);
      mockDeleteUser.mockResolvedValue(undefined);

      await deleteAccount('delete-me-123');

      expect(mockDeleteDoc).toHaveBeenCalled();
      expect(mockDeleteUser).toHaveBeenCalled();
    });

    it('should only delete Firestore document if current user is different', async () => {
      const mockAuth = require('../../services/firebase').auth;
      mockAuth.currentUser = { uid: 'different-user' };

      mockDeleteDoc.mockResolvedValue(undefined);

      await deleteAccount('delete-me-123');

      expect(mockDeleteDoc).toHaveBeenCalled();
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });
  });
});
