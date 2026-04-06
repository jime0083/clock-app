import {
  createAudioPlayer,
  setAudioModeAsync,
  AudioPlayer,
} from 'expo-audio';

// Default alarm sound (bundled with app)
const DEFAULT_ALARM_SOUND = require('@assets/sounds/アラーム音.m4a');

class AudioService {
  private player: AudioPlayer | null = null;
  private isPlaying = false;
  private isLooping = false;

  /**
   * Initialize audio mode for alarm playback
   * This ensures audio plays even in silent mode and when screen is locked
   */
  async initializeAudioMode(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
    } catch (error) {
      console.error('Error initializing audio mode:', error);
    }
  }

  /**
   * Load and play alarm sound
   * @param customSoundUrl - Optional URL to custom alarm sound from Firebase Storage
   * @param loop - Whether to loop the sound
   */
  async playAlarmSound(
    customSoundUrl?: string | null,
    loop = true
  ): Promise<void> {
    console.log('[Audio] playAlarmSound called, customSoundUrl:', customSoundUrl, 'loop:', loop);

    try {
      // Stop any existing sound
      await this.stopAlarmSound();

      // Initialize audio mode
      console.log('[Audio] Initializing audio mode...');
      await this.initializeAudioMode();
      console.log('[Audio] Audio mode initialized');

      // Determine sound source
      let soundSource: string | number | null = null;

      if (customSoundUrl && !customSoundUrl.startsWith('file:///var/mobile/Containers/Data/Application')) {
        // Use custom sound from URL (skip local cache files that may not exist)
        soundSource = customSoundUrl;
        console.log('[Audio] Using custom sound URL');
      } else if (customSoundUrl) {
        // Local cache file - these are temporary and may be deleted
        console.warn('[Audio] Custom sound is a local cache file, using default sound instead');
        soundSource = DEFAULT_ALARM_SOUND;
      } else if (DEFAULT_ALARM_SOUND) {
        // Use default bundled sound
        soundSource = DEFAULT_ALARM_SOUND;
        console.log('[Audio] Using default bundled sound');
      } else {
        // No sound available
        console.warn('[Audio] No alarm sound available');
        return;
      }

      // Create audio player
      console.log('[Audio] Creating audio player...');
      this.player = createAudioPlayer(soundSource);
      console.log('[Audio] Audio player created');

      // Configure player
      this.player.loop = loop;
      this.player.volume = 1.0;

      // Start playback
      console.log('[Audio] Starting playback...');
      this.player.play();
      console.log('[Audio] Playback started successfully');

      this.isPlaying = true;
      this.isLooping = loop;
    } catch (error) {
      console.error('[Audio] Error playing alarm sound:', error);
      // Fallback to default sound if custom sound fails
      if (customSoundUrl) {
        await this.playAlarmSound(null, loop);
      }
    }
  }

  /**
   * Stop alarm sound
   */
  async stopAlarmSound(): Promise<void> {
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch (error) {
        console.error('Error stopping alarm sound:', error);
      } finally {
        this.player = null;
        this.isPlaying = false;
        this.isLooping = false;
      }
    }
  }

  /**
   * Pause alarm sound
   */
  async pauseAlarmSound(): Promise<void> {
    if (this.player && this.isPlaying) {
      try {
        this.player.pause();
        this.isPlaying = false;
      } catch (error) {
        console.error('Error pausing alarm sound:', error);
      }
    }
  }

  /**
   * Resume alarm sound
   */
  async resumeAlarmSound(): Promise<void> {
    if (this.player && !this.isPlaying) {
      try {
        this.player.play();
        this.isPlaying = true;
      } catch (error) {
        console.error('Error resuming alarm sound:', error);
      }
    }
  }

  /**
   * Set volume
   * @param volume - Volume level from 0.0 to 1.0
   */
  async setVolume(volume: number): Promise<void> {
    if (this.player) {
      try {
        this.player.volume = Math.max(0, Math.min(1, volume));
      } catch (error) {
        console.error('Error setting volume:', error);
      }
    }
  }

  /**
   * Check if alarm is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Play a short preview of the alarm sound
   */
  async playPreview(customSoundUrl?: string | null): Promise<void> {
    try {
      await this.playAlarmSound(customSoundUrl, false);

      // Stop after 3 seconds
      setTimeout(async () => {
        await this.stopAlarmSound();
      }, 3000);
    } catch (error) {
      console.error('Error playing preview:', error);
    }
  }
}

// Export singleton instance
export const audioService = new AudioService();
