export class AmbientAudio {
  private context: AudioContext | null = null;
  private birdTimer = 0;

  start(): void {
    if (!window.AudioContext) return;
    if (this.context) {
      void this.context.resume().catch((error: unknown) => {
        console.error('Could not resume valley ambience.', error);
      });
      return;
    }

    const context = new window.AudioContext();
    this.context = context;
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const channel = noise.getChannelData(0);
    let seed = 19373;
    for (let i = 0; i < channel.length; i++) {
      seed = (seed * 16807) % 2147483647;
      channel[i] = ((seed - 1073741824) / 1073741824) * 0.3;
    }

    const wind = context.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 430;
    const windVolume = context.createGain();
    windVolume.gain.value = 0.075;
    wind.connect(filter).connect(windVolume).connect(context.destination);
    wind.start();

    const lowDrone = context.createOscillator();
    lowDrone.type = 'sine';
    lowDrone.frequency.value = 68;
    const droneVolume = context.createGain();
    droneVolume.gain.value = 0.014;
    lowDrone.connect(droneVolume).connect(context.destination);
    lowDrone.start();

    void context.resume().catch((error: unknown) => {
      console.error('Could not start valley ambience.', error);
    });
    this.scheduleBird();
  }

  dispose(): void {
    globalThis.clearTimeout(this.birdTimer);
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') {
      void context.close().catch((error: unknown) => {
        console.error('Could not stop valley ambience.', error);
      });
    }
  }

  private scheduleBird(): void {
    if (!this.context) return;
    this.birdTimer = window.setTimeout(() => {
      const context = this.context;
      if (!context) return;
      if (context.state === 'running') {
        const now = context.currentTime;
        const chirp = context.createOscillator();
        const volume = context.createGain();
        chirp.type = 'sine';
        chirp.frequency.setValueAtTime(1750 + Math.random() * 650, now);
        chirp.frequency.exponentialRampToValueAtTime(1180, now + 0.12);
        volume.gain.setValueAtTime(0.0001, now);
        volume.gain.exponentialRampToValueAtTime(0.012, now + 0.018);
        volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        chirp.connect(volume).connect(context.destination);
        chirp.start(now);
        chirp.stop(now + 0.22);
        chirp.addEventListener('ended', () => {
          chirp.disconnect();
          volume.disconnect();
        }, { once: true });
      }
      this.scheduleBird();
    }, 6500 + Math.random() * 9000);
  }
}
