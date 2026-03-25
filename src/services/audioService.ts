import { Audio, AVPlaybackStatus } from 'expo-av';

// Default alarm sound (bundled with app)
// Note: Add a default-alarm.mp3 file to src/assets/sounds/
// For now, we'll use a system default if not available
let DEFAULT_ALARM_SOUND: any = null;
try {
  DEFAULT_ALARM_SOUND = require('@/assets/sounds/default-alarm.mp3');
} catch {
  // Default sound not available, will use system sound
}

class AudioService {
  private sound: Audio.Sound | null = null;
  private isPlaying = false;
  private isLooping = false;

  /**
   * Initialize audio mode for alarm playback
   * This ensures audio plays even in silent mode and when screen is locked
   */
  async initializeAudioMode(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
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
  async playAlarmSound(customSoundUrl?: string | null, loop = true): Promise<void> {
    try {
      // Stop any existing sound
      await this.stopAlarmSound();

      // Initialize audio mode
      await this.initializeAudioMode();

      // Create sound object
      let soundSource: any;

      if (customSoundUrl) {
        // Use custom sound from URL
        soundSource = { uri: customSoundUrl };
      } else if (DEFAULT_ALARM_SOUND) {
        // Use default bundled sound
        soundSource = DEFAULT_ALARM_SOUND;
      } else {
        // No sound available
        console.warn('No alarm sound available');
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: true,
          isLooping: loop,
          volume: 1.0,
        },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;
      this.isPlaying = true;
      this.isLooping = loop;
    } catch (error) {
      console.error('Error playing alarm sound:', error);
      // Fallback to default sound if custom sound fails
      if (customSoundUrl) {
        await this.playAlarmSound(null, loop);
      }
    }
  }

  /**
   * Callback for playback status updates
   */
  private onPlaybackStatusUpdate = (status: AVPlaybackStatus): void => {
    if (!status.isLoaded) {
      // Handle error
      if (status.error) {
        console.error('Playback error:', status.error);
      }
      return;
    }

    if (status.didJustFinish && !status.isLooping) {
      this.isPlaying = false;
    }
  };

  /**
   * Stop alarm sound
   */
  async stopAlarmSound(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch (error) {
        console.error('Error stopping alarm sound:', error);
      } finally {
        this.sound = null;
        this.isPlaying = false;
        this.isLooping = false;
      }
    }
  }

  /**
   * Pause alarm sound
   */
  async pauseAlarmSound(): Promise<void> {
    if (this.sound && this.isPlaying) {
      try {
        await this.sound.pauseAsync();
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
    if (this.sound && !this.isPlaying) {
      try {
        await this.sound.playAsync();
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
    if (this.sound) {
      try {
        await this.sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
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
