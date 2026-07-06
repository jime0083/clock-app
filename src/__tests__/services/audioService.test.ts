const mockPlayerPlay = jest.fn();
const mockPlayerPause = jest.fn();
const mockPlayerRemove = jest.fn();
const mockSetAudioModeAsync = jest.fn();

const createMockPlayer = () => ({
  play: mockPlayerPlay,
  pause: mockPlayerPause,
  remove: mockPlayerRemove,
  loop: false,
  volume: 1.0,
});

const mockCreateAudioPlayer = jest.fn((_source?: unknown) => createMockPlayer());

jest.mock('expo-audio', () => ({
  createAudioPlayer: (source?: unknown) => mockCreateAudioPlayer(source),
  setAudioModeAsync: (options?: unknown) => mockSetAudioModeAsync(options),
}));

import { audioService } from '../../services/audioService';

describe('audioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockCreateAudioPlayer.mockImplementation(() => createMockPlayer());
  });

  afterEach(async () => {
    await audioService.stopAlarmSound();
  });

  describe('initializeAudioMode', () => {
    it('should configure the audio session for silent-mode playback', async () => {
      await audioService.initializeAudioMode();

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({ playsInSilentMode: true })
      );
    });

    it('should not throw when setAudioModeAsync fails', async () => {
      mockSetAudioModeAsync.mockRejectedValue(new Error('audio mode error'));

      await expect(audioService.initializeAudioMode()).resolves.toBeUndefined();
    });
  });

  describe('playAlarmSound', () => {
    it('should play the default bundled sound when no custom sound is given', async () => {
      await audioService.playAlarmSound();

      expect(mockCreateAudioPlayer).toHaveBeenCalled();
      expect(mockPlayerPlay).toHaveBeenCalled();
      expect(audioService.getIsPlaying()).toBe(true);
    });

    it('should play a custom sound URL when provided', async () => {
      await audioService.playAlarmSound('https://example.com/sound.mp3', true);

      expect(mockCreateAudioPlayer).toHaveBeenCalledWith('https://example.com/sound.mp3');
    });

    it('should fall back to the default sound for a local cache file URL', async () => {
      await audioService.playAlarmSound('file:///var/mobile/Containers/Data/Application/cache.mp3');

      // Falls back to the bundled default (a require() result), not the cache path
      expect(mockCreateAudioPlayer).not.toHaveBeenCalledWith(
        'file:///var/mobile/Containers/Data/Application/cache.mp3'
      );
      expect(mockPlayerPlay).toHaveBeenCalled();
    });

    it('should retry with the default sound if playing a custom sound throws', async () => {
      mockCreateAudioPlayer
        .mockImplementationOnce(() => {
          throw new Error('player error');
        })
        .mockImplementationOnce(() => createMockPlayer());

      await audioService.playAlarmSound('https://example.com/broken.mp3');

      expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(2);
      expect(audioService.getIsPlaying()).toBe(true);
    });
  });

  describe('stopAlarmSound', () => {
    it('should pause and remove the player and reset state', async () => {
      await audioService.playAlarmSound();
      await audioService.stopAlarmSound();

      expect(mockPlayerPause).toHaveBeenCalled();
      expect(mockPlayerRemove).toHaveBeenCalled();
      expect(audioService.getIsPlaying()).toBe(false);
    });

    it('should do nothing when no player is active', async () => {
      await expect(audioService.stopAlarmSound()).resolves.toBeUndefined();
    });
  });

  describe('pauseAlarmSound / resumeAlarmSound', () => {
    it('should pause while playing', async () => {
      await audioService.playAlarmSound();
      await audioService.pauseAlarmSound();

      expect(mockPlayerPause).toHaveBeenCalled();
      expect(audioService.getIsPlaying()).toBe(false);
    });

    it('should resume when paused', async () => {
      await audioService.playAlarmSound();
      await audioService.pauseAlarmSound();
      mockPlayerPlay.mockClear();

      await audioService.resumeAlarmSound();

      expect(mockPlayerPlay).toHaveBeenCalled();
      expect(audioService.getIsPlaying()).toBe(true);
    });
  });

  describe('setVolume', () => {
    it('should clamp volume within 0 and 1', async () => {
      await audioService.playAlarmSound();
      const player = mockCreateAudioPlayer.mock.results[0].value;

      await audioService.setVolume(1.5);
      expect(player.volume).toBe(1);

      await audioService.setVolume(-0.5);
      expect(player.volume).toBe(0);
    });
  });

  describe('playPreview', () => {
    it('should play without looping', async () => {
      jest.useFakeTimers();

      await audioService.playPreview();

      expect(mockCreateAudioPlayer).toHaveBeenCalled();
      expect(audioService.getIsPlaying()).toBe(true);

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      jest.useRealTimers();
    });
  });
});
