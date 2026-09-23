import { Howl } from "howler";

const CUES = {
  accepted: [587, 740],
  customerQuestion: [660],
  retry: [392, 330],
  skipped: [440, 523],
  levelUp: [523, 659, 784],
  complete: [523, 659, 784, 1047],
};

export function createExperienceAudio() {
  const sounds = {
    launch: new Howl({ src: ["/launch.mp3"], volume: 0.56, preload: true, html5: true }),
    answer: new Howl({ src: ["/ai-answer.mp3"], volume: 0.42, preload: true, html5: true }),
  };
  let audioContext;
  let muted = false;

  function playCue(name) {
    if (muted) return;
    const notes = CUES[name];
    if (!notes) return;

    try {
      audioContext ||= new window.AudioContext();
      if (audioContext.state === "suspended") void audioContext.resume();
      const start = audioContext.currentTime;
      notes.forEach((frequency, index) => {
        const at = start + index * 0.085;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.075, at + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.24);
      });
    } catch {
      return;
    }
  }

  return {
    play(name) {
      if (muted) return;
      if (name === "launch" || name === "answer") {
        sounds[name].stop();
        sounds[name].play();
        return;
      }
      playCue(name);
    },
    fadeLaunch() {
      if (sounds.launch.playing()) sounds.launch.fade(sounds.launch.volume(), 0.08, 900);
    },
    stop() {
      sounds.launch.stop();
      sounds.answer.stop();
    },
    setMuted(value) {
      muted = value;
      Object.values(sounds).forEach((sound) => sound.mute(value));
    },
    unload() {
      Object.values(sounds).forEach((sound) => sound.unload());
      void audioContext?.close();
      audioContext = undefined;
    },
  };
}
