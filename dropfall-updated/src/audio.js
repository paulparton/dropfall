import { useGameStore } from './store.js';

let audioCtx;
let isMusicPlaying = false;
let musicGain;
let sfxGain;
let currentTempo = 135; // Fast EDM BPM
let targetTempo = 135;

export function setMusicSpeed(multiplier) {
    targetTempo = 135 * multiplier;
}

export function setMusicVolume(volume) {
    if (musicGain) {
        musicGain.gain.value = volume;
    }
}

export function setSfxVolume(volume) {
    if (sfxGain) {
        sfxGain.gain.value = volume;
    }
}

export async function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();    
        musicGain = audioCtx.createGain();
        sfxGain = audioCtx.createGain();
        
        const settings = useGameStore.getState().settings;
        musicGain.gain.value = settings.musicVolume !== undefined ? settings.musicVolume : 0.6;
        sfxGain.gain.value = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.8;
        
        musicGain.connect(audioCtx.destination);
        sfxGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

export function playMusic() {
    if (isMusicPlaying || !audioCtx) return;
    isMusicPlaying = true;
    
    // --- CYBER INSTRUMENTS ---
    function playCyberKick(time, durationScale) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(musicGain);
        
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5 * durationScale);
        
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5 * durationScale);
        
        osc.start(time);
        osc.stop(time + 0.5 * durationScale);
    }
    
    function playCyberBass(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.value = note;
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, time);
        filter.frequency.exponentialRampToValueAtTime(1500, time + 0.1 * durationScale);
        filter.frequency.exponentialRampToValueAtTime(100, time + 0.25 * durationScale);
        
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.25 * durationScale);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);
        
        osc.start(time);
        osc.stop(time + 0.25 * durationScale);
    }

    // --- BEACH INSTRUMENTS ---
    function playBeachKick(time, durationScale) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(musicGain);
        
        osc.frequency.setValueAtTime(120, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3 * durationScale);
        
        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3 * durationScale);
        
        osc.start(time);
        osc.stop(time + 0.3 * durationScale);
    }

    function playBeachMarimba(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = note;
        
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2 * durationScale);
        
        osc.connect(gain);
        gain.connect(musicGain);
        
        osc.start(time);
        osc.stop(time + 0.2 * durationScale);
    }

    function playBeachBass(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = note / 2; // an octave lower
        
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.4 * durationScale);
        
        osc.connect(gain);
        gain.connect(musicGain);
        
        osc.start(time);
        osc.stop(time + 0.4 * durationScale);
    }

    // --- STONE INSTRUMENTS ---
    function playStoneTom(time, durationScale, pitchMultiplier = 1) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(musicGain);
        
        osc.frequency.setValueAtTime(100 * pitchMultiplier, time);
        osc.frequency.exponentialRampToValueAtTime(20 * pitchMultiplier, time + 0.4 * durationScale);
        
        gain.gain.setValueAtTime(0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4 * durationScale);
        
        osc.start(time);
        osc.stop(time + 0.4 * durationScale);
    }

    function playStoneWoodblock(time, durationScale, pitchMultiplier = 1) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        osc.type = 'square';
        osc.frequency.value = 800 * pitchMultiplier;
        
        filter.type = 'bandpass';
        filter.frequency.value = 1000 * pitchMultiplier;
        
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1 * durationScale);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);
        
        osc.start(time);
        osc.stop(time + 0.1 * durationScale);
    }

    // --- NEW CYBER INSTRUMENTS ---
    function playCyberHiHat(time, durationScale, open = false) {
        const len = open ? 0.12 : 0.04;
        const bufferSize = Math.floor(audioCtx.sampleRate * len);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = open ? 6000 : 9000;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(open ? 0.09 : 0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + len * durationScale);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);
        noise.start(time);
        noise.stop(time + len * durationScale);
    }

    function playCyberSnare(time, durationScale) {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.12);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const nf = audioCtx.createBiquadFilter();
        nf.type = 'highpass';
        nf.frequency.value = 3000;
        const ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0.16, time);
        ng.gain.exponentialRampToValueAtTime(0.001, time + 0.12 * durationScale);
        noise.connect(nf);
        nf.connect(ng);
        ng.connect(musicGain);
        const body = audioCtx.createOscillator();
        const bg = audioCtx.createGain();
        body.frequency.setValueAtTime(180, time);
        body.frequency.exponentialRampToValueAtTime(60, time + 0.06 * durationScale);
        bg.gain.setValueAtTime(0.28, time);
        bg.gain.exponentialRampToValueAtTime(0.001, time + 0.08 * durationScale);
        body.connect(bg);
        bg.connect(musicGain);
        noise.start(time);
        noise.stop(time + 0.12 * durationScale);
        body.start(time);
        body.stop(time + 0.08 * durationScale);
    }

    function playCyberPad(time, notes, duration) {
        notes.forEach(note => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const f = audioCtx.createBiquadFilter();
            osc.type = 'sawtooth';
            osc.frequency.value = note;
            f.type = 'lowpass';
            f.frequency.value = 500 + Math.sin(time * 0.3) * 150;
            f.Q.value = 1.5;
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(0.035, time + 0.15 * duration);
            g.gain.setValueAtTime(0.035, time + 0.7 * duration);
            g.gain.linearRampToValueAtTime(0, time + duration);
            osc.connect(f);
            f.connect(g);
            g.connect(musicGain);
            osc.start(time);
            osc.stop(time + duration);
        });
    }

    function playCyberArp(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const f = audioCtx.createBiquadFilter();
        osc.type = 'square';
        osc2.type = 'square';
        osc.frequency.value = note;
        osc2.frequency.value = note * 1.004;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2500, time);
        f.frequency.exponentialRampToValueAtTime(400, time + 0.12 * durationScale);
        g.gain.setValueAtTime(0.07, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.12 * durationScale);
        osc.connect(f);
        osc2.connect(f);
        f.connect(g);
        g.connect(musicGain);
        osc.start(time);
        osc2.start(time);
        osc.stop(time + 0.12 * durationScale);
        osc2.stop(time + 0.12 * durationScale);
    }

    // --- NEW BEACH INSTRUMENTS ---
    function playBeachShaker(time, durationScale) {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.05);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const f = audioCtx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 7000;
        f.Q.value = 1;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.05, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.05 * durationScale);
        noise.connect(f);
        f.connect(g);
        g.connect(musicGain);
        noise.start(time);
        noise.stop(time + 0.05 * durationScale);
    }

    function playBeachSteelDrum(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const harm = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note;
        harm.type = 'sine';
        harm.frequency.value = note * 2.76;
        g.gain.setValueAtTime(0.12, time);
        g.gain.exponentialRampToValueAtTime(0.02, time + 0.08 * durationScale);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.35 * durationScale);
        osc.connect(g);
        harm.connect(g);
        g.connect(musicGain);
        osc.start(time);
        harm.start(time);
        osc.stop(time + 0.35 * durationScale);
        harm.stop(time + 0.35 * durationScale);
    }

    function playBeachPad(time, notes, duration) {
        notes.forEach(note => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = note;
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(0.04, time + 0.2 * duration);
            g.gain.setValueAtTime(0.04, time + 0.6 * duration);
            g.gain.linearRampToValueAtTime(0, time + duration);
            osc.connect(g);
            g.connect(musicGain);
            osc.start(time);
            osc.stop(time + duration);
        });
    }

    function playBeachConga(time, durationScale, high = false) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(high ? 340 : 195, time);
        osc.frequency.exponentialRampToValueAtTime(high ? 170 : 75, time + 0.1 * durationScale);
        g.gain.setValueAtTime(0.18, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.14 * durationScale);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(time);
        osc.stop(time + 0.14 * durationScale);
    }

    function playBeachRimshot(time, durationScale) {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.03);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const f = audioCtx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 3500;
        f.Q.value = 3;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.12, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.03 * durationScale);
        noise.connect(f);
        f.connect(g);
        g.connect(musicGain);
        noise.start(time);
        noise.stop(time + 0.03 * durationScale);
    }

    // --- NEW TEMPLE INSTRUMENTS ---
    function playTempleDrone(time, note, duration) {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const f = audioCtx.createBiquadFilter();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.value = note;
        osc2.frequency.value = note * 1.5;
        f.type = 'lowpass';
        f.frequency.value = 200;
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(0.08, time + 0.3 * duration);
        g.gain.setValueAtTime(0.08, time + 0.7 * duration);
        g.gain.linearRampToValueAtTime(0, time + duration);
        osc1.connect(f);
        osc2.connect(f);
        f.connect(g);
        g.connect(musicGain);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration);
        osc2.stop(time + duration);
    }

    function playTempleBell(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const h1 = audioCtx.createOscillator();
        const h2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        h1.type = 'sine';
        h2.type = 'sine';
        osc.frequency.value = note;
        h1.frequency.value = note * 2.4;
        h2.frequency.value = note * 5.2;
        g.gain.setValueAtTime(0.1, time);
        g.gain.exponentialRampToValueAtTime(0.03, time + 0.1 * durationScale);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.7 * durationScale);
        osc.connect(g);
        h1.connect(g);
        h2.connect(g);
        g.connect(musicGain);
        osc.start(time);
        h1.start(time);
        h2.start(time);
        osc.stop(time + 0.7 * durationScale);
        h1.stop(time + 0.7 * durationScale);
        h2.stop(time + 0.7 * durationScale);
    }

    function playTempleShaker(time, durationScale) {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.07);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const f = audioCtx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 4000;
        f.Q.value = 2;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.045, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.07 * durationScale);
        noise.connect(f);
        f.connect(g);
        g.connect(musicGain);
        noise.start(time);
        noise.stop(time + 0.07 * durationScale);
    }

    function playTempleFlute(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const vib = audioCtx.createOscillator();
        const vg = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note;
        vib.type = 'sine';
        vib.frequency.value = 5;
        vg.gain.value = 3;
        vib.connect(vg);
        vg.connect(osc.frequency);
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(0.07, time + 0.08 * durationScale);
        g.gain.setValueAtTime(0.07, time + 0.25 * durationScale);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.45 * durationScale);
        osc.connect(g);
        g.connect(musicGain);
        vib.start(time);
        osc.start(time);
        vib.stop(time + 0.45 * durationScale);
        osc.stop(time + 0.45 * durationScale);
    }

    function playTempleBassDrum(time, durationScale) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.frequency.setValueAtTime(80, time);
        osc.frequency.exponentialRampToValueAtTime(25, time + 0.35 * durationScale);
        g.gain.setValueAtTime(0.6, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.35 * durationScale);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(time);
        osc.stop(time + 0.35 * durationScale);
    }

    // --- ARCTIC INSTRUMENTS ---
    function playArcticPad(time, notes, duration) {
        notes.forEach(note => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const f = audioCtx.createBiquadFilter();
            osc.type = 'sine';
            osc.frequency.value = note;
            f.type = 'lowpass';
            f.frequency.value = 800 + Math.sin(time * 0.2) * 200;
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(0.05, time + 0.3 * duration);
            g.gain.setValueAtTime(0.05, time + 0.6 * duration);
            g.gain.linearRampToValueAtTime(0, time + duration);
            osc.connect(f);
            f.connect(g);
            g.connect(musicGain);
            osc.start(time);
            osc.stop(time + duration);
        });
    }

    function playArcticBell(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const h1 = audioCtx.createOscillator();
        const h2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        h1.type = 'sine';
        h2.type = 'sine';
        osc.frequency.value = note;
        h1.frequency.value = note * 3.0;
        h2.frequency.value = note * 5.0;
        g.gain.setValueAtTime(0.08, time);
        g.gain.exponentialRampToValueAtTime(0.02, time + 0.15 * durationScale);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.8 * durationScale);
        osc.connect(g);
        h1.connect(g);
        h2.connect(g);
        g.connect(musicGain);
        osc.start(time);
        h1.start(time);
        h2.start(time);
        osc.stop(time + 0.8 * durationScale);
        h1.stop(time + 0.8 * durationScale);
        h2.stop(time + 0.8 * durationScale);
    }

    function playArcticChime(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note;
        g.gain.setValueAtTime(0.06, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.5 * durationScale);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(time);
        osc.stop(time + 0.5 * durationScale);
    }

    function playArcticKick(time, durationScale) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.frequency.setValueAtTime(90, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3 * durationScale);
        g.gain.setValueAtTime(0.5, time);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.3 * durationScale);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(time);
        osc.stop(time + 0.3 * durationScale);
    }

    function playArcticShimmer(time, durationScale) {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.08);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const f = audioCtx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 10000;
        f.Q.value = 5;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.02, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.08 * durationScale);
        noise.connect(f);
        f.connect(g);
        g.connect(musicGain);
        noise.start(time);
        noise.stop(time + 0.08 * durationScale);
    }

    // --- INFERNO INSTRUMENTS ---
    function playInfernoKick(time, durationScale) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.frequency.setValueAtTime(180, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.4 * durationScale);
        g.gain.setValueAtTime(1.0, time);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.4 * durationScale);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(time);
        osc.stop(time + 0.4 * durationScale);
    }

    function playInfernoBass(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const f = audioCtx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.value = note;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(80, time);
        f.frequency.exponentialRampToValueAtTime(600, time + 0.05 * durationScale);
        f.frequency.exponentialRampToValueAtTime(80, time + 0.2 * durationScale);
        g.gain.setValueAtTime(0.45, time);
        g.gain.linearRampToValueAtTime(0, time + 0.2 * durationScale);
        osc.connect(f);
        f.connect(g);
        g.connect(musicGain);
        osc.start(time);
        osc.stop(time + 0.2 * durationScale);
    }

    function playInfernoSnare(time, durationScale) {
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.15);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const nf = audioCtx.createBiquadFilter();
        nf.type = 'highpass';
        nf.frequency.value = 2500;
        const ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0.2, time);
        ng.gain.exponentialRampToValueAtTime(0.001, time + 0.15 * durationScale);
        noise.connect(nf);
        nf.connect(ng);
        ng.connect(musicGain);
        const body = audioCtx.createOscillator();
        const bg = audioCtx.createGain();
        body.frequency.setValueAtTime(200, time);
        body.frequency.exponentialRampToValueAtTime(50, time + 0.08 * durationScale);
        bg.gain.setValueAtTime(0.35, time);
        bg.gain.exponentialRampToValueAtTime(0.001, time + 0.1 * durationScale);
        body.connect(bg);
        bg.connect(musicGain);
        noise.start(time);
        noise.stop(time + 0.15 * durationScale);
        body.start(time);
        body.stop(time + 0.1 * durationScale);
    }

    function playInfernoHiHat(time, durationScale, open) {
        const len = open ? 0.1 : 0.03;
        const bufferSize = Math.floor(audioCtx.sampleRate * len);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const f = audioCtx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = open ? 5000 : 8000;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(open ? 0.08 : 0.05, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + len * durationScale);
        noise.connect(f);
        f.connect(g);
        g.connect(musicGain);
        noise.start(time);
        noise.stop(time + len * durationScale);
    }

    function playInfernoPad(time, notes, duration) {
        notes.forEach(note => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const f = audioCtx.createBiquadFilter();
            osc.type = 'sawtooth';
            osc.frequency.value = note;
            f.type = 'lowpass';
            f.frequency.value = 350 + Math.sin(time * 0.4) * 100;
            f.Q.value = 2;
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(0.04, time + 0.2 * duration);
            g.gain.setValueAtTime(0.04, time + 0.65 * duration);
            g.gain.linearRampToValueAtTime(0, time + duration);
            osc.connect(f);
            f.connect(g);
            g.connect(musicGain);
            osc.start(time);
            osc.stop(time + duration);
        });
    }

    function playInfernoLead(time, note, durationScale) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const f = audioCtx.createBiquadFilter();
        osc.type = 'square';
        osc.frequency.value = note;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(2000, time);
        f.frequency.exponentialRampToValueAtTime(300, time + 0.15 * durationScale);
        g.gain.setValueAtTime(0.06, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.15 * durationScale);
        osc.connect(f);
        f.connect(g);
        g.connect(musicGain);
        osc.start(time);
        osc.stop(time + 0.15 * durationScale);
    }

    let nextNoteTime = audioCtx.currentTime;
    let step = 0;
    
    // Cyber notes
    const cyberBassNotes = [32.70, 32.70, 32.70, 36.71, 32.70, 32.70, 29.14, 32.70]; // C1, D1, Bb0
    
    // Beach notes (C major / A minor feel)
    const beachChords = [
        [261.63, 329.63, 392.00], // C major
        [261.63, 329.63, 392.00],
        [220.00, 261.63, 329.63], // A minor
        [220.00, 261.63, 329.63],
        [174.61, 220.00, 261.63], // F major
        [174.61, 220.00, 261.63],
        [196.00, 246.94, 293.66], // G major
        [196.00, 246.94, 293.66]
    ];
    const beachBassNotes = [65.41, 65.41, 55.00, 55.00, 43.65, 43.65, 49.00, 49.00]; // C2, A1, F1, G1

    // Cyber pad chords (Cm → Bbm → Ab → Gsus4 progression)
    const cyberPadChords = [
        [130.81, 155.56, 196.00],  // Cm
        [116.54, 138.59, 174.61],  // Bbm
        [103.83, 130.81, 155.56],  // Ab
        [98.00, 130.81, 146.83],   // Gsus4
    ];
    // Cyber arpeggio notes (Cm pentatonic)
    const cyberArpNotes = [261.63, 311.13, 392.00, 523.25, 392.00, 311.13, 261.63, 196.00];

    // Beach steel drum melody notes (C major pentatonic)
    const beachMelodyNotes = [523.25, 587.33, 659.26, 783.99, 880.00, 783.99, 659.26, 587.33];
    const beachMelodyPattern = [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0];

    // Temple bell notes (D minor pentatonic / Phrygian)
    const templeBellNotes = [293.66, 349.23, 329.63, 261.63, 293.66, 349.23, 392.00, 329.63];
    const templeBellPattern = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    // Temple flute notes
    const templeFluteNotes = [587.33, 523.25, 659.26, 587.33, 493.88, 587.33, 523.25, 659.26];

    // Arctic notes (Ethereal E minor / Dorian)
    const arcticPadChords = [
        [164.81, 196.00, 246.94],  // Em
        [146.83, 174.61, 220.00],  // Dm
        [130.81, 164.81, 196.00],  // Cm
        [146.83, 196.00, 246.94],  // Dsus4
    ];
    const arcticBellNotes = [659.26, 783.99, 587.33, 659.26, 523.25, 783.99, 659.26, 523.25];
    const arcticBellPattern = [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    const arcticChimeNotes = [1318.51, 1174.66, 1046.50, 987.77, 1174.66, 1318.51, 1046.50, 1174.66];

    // Inferno notes (Aggressive D minor / Phrygian)
    const infernoBassNotes = [36.71, 36.71, 34.65, 36.71, 32.70, 36.71, 34.65, 32.70]; // D1, C#1, C1
    const infernoPadChords = [
        [146.83, 174.61, 220.00],  // Dm
        [138.59, 174.61, 207.65],  // Db/C#m
        [130.81, 155.56, 196.00],  // Cm
        [123.47, 155.56, 185.00],  // B dim
    ];
    const infernoLeadNotes = [293.66, 277.18, 261.63, 293.66, 349.23, 293.66, 261.63, 246.94];
    const infernoLeadPattern = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

    function schedule() {
        if (!isMusicPlaying) return;
        
        const theme = useGameStore.getState().settings.theme;
        
        // Smoothly interpolate tempo
        currentTempo += (targetTempo - currentTempo) * 0.05;
        const beatDuration = 60 / currentTempo;
        const durationScale = 135 / currentTempo;

        // Prevent audio glitch if tab was inactive
        if (nextNoteTime < audioCtx.currentTime - 0.5) {
            nextNoteTime = audioCtx.currentTime;
        }

        while (nextNoteTime < audioCtx.currentTime + 0.1) {
            if (theme === 'beach') {
                // Beach rhythm — original layers
                if (step % 8 === 0 || step % 8 === 3) {
                    playBeachKick(nextNoteTime, durationScale);
                }
                if (step % 4 === 2) {
                    const chord = beachChords[Math.floor(step / 16) % beachChords.length];
                    chord.forEach(note => playBeachMarimba(nextNoteTime, note, durationScale));
                }
                if (step % 8 === 0 || step % 8 === 4) {
                    playBeachBass(nextNoteTime, beachBassNotes[Math.floor(step / 16) % beachBassNotes.length], durationScale);
                }

                // Shaker on offbeat 16th notes
                if (step % 2 === 1) playBeachShaker(nextNoteTime, durationScale);

                // Rimshot on beat 4 &-of
                if (step % 16 === 13) playBeachRimshot(nextNoteTime, durationScale);

                // Conga fills
                if (step % 16 === 6) playBeachConga(nextNoteTime, durationScale, true);
                if (step % 16 === 10 || step % 16 === 11) playBeachConga(nextNoteTime, durationScale, false);

                // Steel drum melody (enters after 2 bars)
                if (step >= 32 && beachMelodyPattern[step % 16]) {
                    const noteIdx = Math.floor(step / 16 + step % 16 * 0.3) % beachMelodyNotes.length;
                    playBeachSteelDrum(nextNoteTime, beachMelodyNotes[noteIdx], durationScale);
                }

                // Warm pad (enters after 4 bars, sustained per 2-bar phrase)
                if (step >= 64 && step % 32 === 0) {
                    const padIdx = Math.floor(step / 32) % beachChords.length;
                    const chord = beachChords[padIdx];
                    playBeachPad(nextNoteTime, chord.map(n => n / 2), beatDuration * 8);
                }

            } else if (theme === 'temple') {
                // Temple rhythm — original layers
                if (step % 8 === 0) {
                    playStoneTom(nextNoteTime, durationScale, 0.8);
                } else if (step % 8 === 3 || step % 8 === 6) {
                    playStoneTom(nextNoteTime, durationScale, 1.2);
                }
                if (step % 4 === 2) {
                    playStoneWoodblock(nextNoteTime, durationScale, 1.0);
                } else if (step % 16 === 14) {
                    playStoneWoodblock(nextNoteTime, durationScale, 1.5);
                }

                // Bass drum on downbeats for weight
                if (step % 16 === 0) playTempleBassDrum(nextNoteTime, durationScale);

                // Shaker on offbeats
                if (step % 4 === 2) playTempleShaker(nextNoteTime, durationScale);

                // Tom fill every 4 bars
                if (step % 64 >= 60 && step % 2 === 0) {
                    const fillPitch = 0.7 + (step % 64 - 60) * 0.15;
                    playStoneTom(nextNoteTime, durationScale, fillPitch);
                }

                // Drone (enters after 2 bars, refreshes every 4 bars)
                if (step >= 32 && step % 64 === 0) {
                    playTempleDrone(nextNoteTime, 36.71, beatDuration * 16);
                }

                // Bell melody (enters after 4 bars)
                if (step >= 64 && templeBellPattern[step % 16]) {
                    const noteIdx = Math.floor(step / 16) % templeBellNotes.length;
                    playTempleBell(nextNoteTime, templeBellNotes[noteIdx], durationScale);
                }

                // Flute melody (enters after 8 bars, every bar on beat 1)
                if (step >= 128 && step % 16 === 0) {
                    const noteIdx = Math.floor(step / 16) % templeFluteNotes.length;
                    playTempleFlute(nextNoteTime, templeFluteNotes[noteIdx], durationScale);
                }

            } else if (theme === 'arctic') {
                // Arctic rhythm — ethereal, sparse, ambient
                // Soft kick on downbeats
                if (step % 16 === 0) playArcticKick(nextNoteTime, durationScale);

                // Shimmer on offbeats (sparse)
                if (step % 8 === 4) playArcticShimmer(nextNoteTime, durationScale);

                // Pad chords (enter immediately, long sustained)
                if (step % 64 === 0) {
                    const padIdx = Math.floor(step / 64) % arcticPadChords.length;
                    playArcticPad(nextNoteTime, arcticPadChords[padIdx], beatDuration * 16);
                }

                // Glass bell melody (enters after 2 bars)
                if (step >= 32 && arcticBellPattern[step % 16]) {
                    const noteIdx = Math.floor(step / 16) % arcticBellNotes.length;
                    playArcticBell(nextNoteTime, arcticBellNotes[noteIdx], durationScale);
                }

                // High chimes (enters after 4 bars, sparse)
                if (step >= 64 && step % 16 === 8) {
                    const chimeIdx = Math.floor(step / 16) % arcticChimeNotes.length;
                    playArcticChime(nextNoteTime, arcticChimeNotes[chimeIdx], durationScale);
                }

                // Second pad layer, octave up (enters after 6 bars)
                if (step >= 96 && step % 64 === 32) {
                    const padIdx = Math.floor(step / 64) % arcticPadChords.length;
                    const chord = arcticPadChords[padIdx].map(n => n * 2);
                    playArcticPad(nextNoteTime, chord, beatDuration * 16);
                }

            } else if (theme === 'inferno') {
                // Inferno rhythm — aggressive, heavy, driving
                // Heavy kick on 1 and 3, add syncopation
                if (step % 8 === 0 || step % 8 === 6) playInfernoKick(nextNoteTime, durationScale);

                // Distorted bass on every 8th note
                if (step % 2 === 0) {
                    playInfernoBass(nextNoteTime, infernoBassNotes[step % 8], durationScale);
                }

                // Hi-hat on every 16th note (open on offbeats)
                playInfernoHiHat(nextNoteTime, durationScale, step % 4 === 2);

                // Snare on 2 and 4
                if (step % 16 === 4 || step % 16 === 12) playInfernoSnare(nextNoteTime, durationScale);

                // Dark pad chords (enter after 2 bars)
                if (step >= 32 && step % 32 === 0) {
                    const padIdx = Math.floor(step / 32) % infernoPadChords.length;
                    playInfernoPad(nextNoteTime, infernoPadChords[padIdx], beatDuration * 8);
                }

                // Aggressive lead (enters after 4 bars)
                if (step >= 64 && infernoLeadPattern[step % 16]) {
                    const noteIdx = Math.floor(step / 8) % infernoLeadNotes.length;
                    playInfernoLead(nextNoteTime, infernoLeadNotes[noteIdx], durationScale);
                }

            } else {
                // Cyber rhythm — original layers
                if (step % 4 === 0) playCyberKick(nextNoteTime, durationScale);
                playCyberBass(nextNoteTime, cyberBassNotes[step % 8], durationScale);

                // Hi-hat on 8th notes (open on &-of-2)
                if (step % 2 === 0) playCyberHiHat(nextNoteTime, durationScale, step % 8 === 4);

                // Snare on beats 2 and 4
                if (step % 16 === 4 || step % 16 === 12) playCyberSnare(nextNoteTime, durationScale);

                // Pad chords (enter after 2 bars, sustained per 2-bar phrase)
                if (step >= 32 && step % 32 === 0) {
                    const padIdx = Math.floor(step / 32) % cyberPadChords.length;
                    playCyberPad(nextNoteTime, cyberPadChords[padIdx], beatDuration * 8);
                }

                // Arpeggio pattern (enters after 4 bars)
                if (step >= 64 && step % 4 === 2) {
                    const arpIdx = Math.floor(step / 4) % cyberArpNotes.length;
                    playCyberArp(nextNoteTime, cyberArpNotes[arpIdx], durationScale);
                }
            }
            
            nextNoteTime += beatDuration / 4; // 16th notes
            step++;
        }
        requestAnimationFrame(schedule);
    }
    schedule();
}

export function playCollisionSound(intensity) {
    if (!audioCtx) return;
    
    const theme = useGameStore.getState().settings.theme;
    
    if (theme === 'beach') {
        // Coconut bonk + splash — hollow woody thud with water splatter
        const t = audioCtx.currentTime;
        const vol = intensity / 5;

        // Layer 1: hollow wooden bonk (triangle wave, fast pitch drop)
        const bonk = audioCtx.createOscillator();
        const bonkGain = audioCtx.createGain();
        bonk.type = 'triangle';
        bonk.frequency.setValueAtTime(800 + 300 * intensity, t);
        bonk.frequency.exponentialRampToValueAtTime(120, t + 0.08);
        bonkGain.gain.setValueAtTime(1.6 * vol, t);
        bonkGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        bonk.connect(bonkGain);
        bonkGain.connect(sfxGain);
        bonk.start(t);
        bonk.stop(t + 0.15);

        // Layer 2: short splash (noise through bandpass, delayed slightly)
        const splashLen = Math.floor(audioCtx.sampleRate * 0.18);
        const splashBuf = audioCtx.createBuffer(1, splashLen, audioCtx.sampleRate);
        const sd = splashBuf.getChannelData(0);
        for (let i = 0; i < splashLen; i++) sd[i] = Math.random() * 2 - 1;
        const splash = audioCtx.createBufferSource();
        splash.buffer = splashBuf;
        const splashFilt = audioCtx.createBiquadFilter();
        splashFilt.type = 'bandpass';
        splashFilt.frequency.setValueAtTime(3000 + 500 * intensity, t + 0.02);
        splashFilt.frequency.exponentialRampToValueAtTime(800, t + 0.18);
        splashFilt.Q.value = 0.8;
        const splashGain = audioCtx.createGain();
        splashGain.gain.setValueAtTime(0.01, t);
        splashGain.gain.linearRampToValueAtTime(1.2 * vol, t + 0.02);
        splashGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        splash.connect(splashFilt);
        splashFilt.connect(splashGain);
        splashGain.connect(sfxGain);
        splash.start(t);
        splash.stop(t + 0.2);

    } else if (theme === 'temple') {
        // Heavy stone block impact — resonant thud + rubble scatter
        const t = audioCtx.currentTime;
        const vol = intensity / 5;

        // Layer 1: deep resonant thud (sine with sub-bass punch)
        const thud = audioCtx.createOscillator();
        const thudGain = audioCtx.createGain();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(80 + 40 * intensity, t);
        thud.frequency.exponentialRampToValueAtTime(30, t + 0.2);
        thudGain.gain.setValueAtTime(2.2 * vol, t);
        thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        thud.connect(thudGain);
        thudGain.connect(sfxGain);
        thud.start(t);
        thud.stop(t + 0.25);

        // Layer 2: gritty rubble crunch (noise through resonant lowpass)
        const rubbleLen = Math.floor(audioCtx.sampleRate * 0.22);
        const rubbleBuf = audioCtx.createBuffer(1, rubbleLen, audioCtx.sampleRate);
        const rd = rubbleBuf.getChannelData(0);
        for (let i = 0; i < rubbleLen; i++) rd[i] = Math.random() * 2 - 1;
        const rubble = audioCtx.createBufferSource();
        rubble.buffer = rubbleBuf;
        const rubbleFilt = audioCtx.createBiquadFilter();
        rubbleFilt.type = 'lowpass';
        rubbleFilt.frequency.setValueAtTime(1200 + 400 * intensity, t);
        rubbleFilt.frequency.exponentialRampToValueAtTime(200, t + 0.22);
        rubbleFilt.Q.value = 4;
        const rubbleGain = audioCtx.createGain();
        rubbleGain.gain.setValueAtTime(1.8 * vol, t);
        rubbleGain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
        rubble.connect(rubbleFilt);
        rubbleFilt.connect(rubbleGain);
        rubbleGain.connect(sfxGain);
        rubble.start(t);
        rubble.stop(t + 0.22);

        // Layer 3: brief mid-knock for stone "clack"
        const clack = audioCtx.createOscillator();
        const clackGain = audioCtx.createGain();
        clack.type = 'triangle';
        clack.frequency.setValueAtTime(400 + 150 * intensity, t);
        clack.frequency.exponentialRampToValueAtTime(80, t + 0.04);
        clackGain.gain.setValueAtTime(1.4 * vol, t);
        clackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
        clack.connect(clackGain);
        clackGain.connect(sfxGain);
        clack.start(t);
        clack.stop(t + 0.06);

    } else if (theme === 'arctic') {
        // Ice shatter — crystalline tinkle + sharp crack + glass scatter
        const t = audioCtx.currentTime;
        const vol = intensity / 5;

        // Layer 1: sharp crack (very short noise burst through highpass)
        const crackLen = Math.floor(audioCtx.sampleRate * 0.03);
        const crackBuf = audioCtx.createBuffer(1, crackLen, audioCtx.sampleRate);
        const cd = crackBuf.getChannelData(0);
        for (let i = 0; i < crackLen; i++) cd[i] = Math.random() * 2 - 1;
        const crack = audioCtx.createBufferSource();
        crack.buffer = crackBuf;
        const crackFilt = audioCtx.createBiquadFilter();
        crackFilt.type = 'highpass';
        crackFilt.frequency.value = 4000 + 1000 * intensity;
        const crackGain = audioCtx.createGain();
        crackGain.gain.setValueAtTime(2.0 * vol, t);
        crackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
        crack.connect(crackFilt);
        crackFilt.connect(crackGain);
        crackGain.connect(sfxGain);
        crack.start(t);
        crack.stop(t + 0.03);

        // Layer 2: crystalline tinkles (several short high sine pings)
        const baseFreqs = [2400, 3200, 4000, 5200];
        for (let i = 0; i < Math.min(intensity, baseFreqs.length); i++) {
            const ping = audioCtx.createOscillator();
            const pg = audioCtx.createGain();
            ping.type = 'sine';
            const delay = 0.01 + i * 0.025;
            ping.frequency.setValueAtTime(baseFreqs[i] + 200 * intensity, t + delay);
            ping.frequency.exponentialRampToValueAtTime(baseFreqs[i] * 0.6, t + delay + 0.12);
            pg.gain.setValueAtTime(0.01, t);
            pg.gain.linearRampToValueAtTime(0.7 * vol, t + delay);
            pg.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.15);
            ping.connect(pg);
            pg.connect(sfxGain);
            ping.start(t);
            ping.stop(t + delay + 0.15);
        }

        // Layer 3: icy scatter (short filtered noise tail)
        const scatterLen = Math.floor(audioCtx.sampleRate * 0.2);
        const scatterBuf = audioCtx.createBuffer(1, scatterLen, audioCtx.sampleRate);
        const scd = scatterBuf.getChannelData(0);
        for (let i = 0; i < scatterLen; i++) scd[i] = Math.random() * 2 - 1;
        const scatter = audioCtx.createBufferSource();
        scatter.buffer = scatterBuf;
        const scatFilt = audioCtx.createBiquadFilter();
        scatFilt.type = 'highpass';
        scatFilt.frequency.value = 3000;
        const scatGain = audioCtx.createGain();
        scatGain.gain.setValueAtTime(0.01, t);
        scatGain.gain.linearRampToValueAtTime(1.0 * vol, t + 0.03);
        scatGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        scatter.connect(scatFilt);
        scatFilt.connect(scatGain);
        scatGain.connect(sfxGain);
        scatter.start(t);
        scatter.stop(t + 0.2);

    } else if (theme === 'inferno') {
        // Volcanic explosion — sub-bass punch + sizzling crackle + fire burst
        const t = audioCtx.currentTime;
        const vol = intensity / 5;

        // Layer 1: sub-bass punch (sine dropping into sub frequencies)
        const boom = audioCtx.createOscillator();
        const boomGain = audioCtx.createGain();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(150 + 80 * intensity, t);
        boom.frequency.exponentialRampToValueAtTime(18, t + 0.4);
        boomGain.gain.setValueAtTime(2.5 * vol, t);
        boomGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        boom.connect(boomGain);
        boomGain.connect(sfxGain);
        boom.start(t);
        boom.stop(t + 0.4);

        // Layer 2: sizzling crackle (noise through high resonant bandpass)
        const sizzLen = Math.floor(audioCtx.sampleRate * 0.3);
        const sizzBuf = audioCtx.createBuffer(1, sizzLen, audioCtx.sampleRate);
        const szd = sizzBuf.getChannelData(0);
        for (let i = 0; i < sizzLen; i++) szd[i] = (Math.random() * 2 - 1) * (Math.random() > 0.7 ? 1 : 0.2);
        const sizzle = audioCtx.createBufferSource();
        sizzle.buffer = sizzBuf;
        const sizzFilt = audioCtx.createBiquadFilter();
        sizzFilt.type = 'bandpass';
        sizzFilt.frequency.setValueAtTime(4000 + 1000 * intensity, t);
        sizzFilt.frequency.exponentialRampToValueAtTime(1000, t + 0.3);
        sizzFilt.Q.value = 3;
        const sizzGain = audioCtx.createGain();
        sizzGain.gain.setValueAtTime(1.4 * vol, t);
        sizzGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        sizzle.connect(sizzFilt);
        sizzFilt.connect(sizzGain);
        sizzGain.connect(sfxGain);
        sizzle.start(t);
        sizzle.stop(t + 0.3);

        // Layer 3: distorted fire burst (sawtooth with fast sweep)
        const burst = audioCtx.createOscillator();
        const burstGain = audioCtx.createGain();
        const burstDist = audioCtx.createWaveShaperNode
            ? audioCtx.createWaveShaperNode() : null;
        burst.type = 'sawtooth';
        burst.frequency.setValueAtTime(300 + 200 * intensity, t);
        burst.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        burstGain.gain.setValueAtTime(1.6 * vol, t);
        burstGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        if (burstDist) {
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i / 128) - 1;
                curve[i] = (Math.PI + intensity) * x / (Math.PI + intensity * Math.abs(x));
            }
            burstDist.curve = curve;
            burst.connect(burstDist);
            burstDist.connect(burstGain);
        } else {
            burst.connect(burstGain);
        }
        burstGain.connect(sfxGain);
        burst.start(t);
        burst.stop(t + 0.15);

    } else {
        // Cyber/Tron: Digital glitch — rapid bit-step zap + electric hum
        const t = audioCtx.currentTime;
        const vol = intensity / 5;

        // Layer 1: electric zap (square wave rapid frequency sweep)
        const zap = audioCtx.createOscillator();
        const zapGain = audioCtx.createGain();
        const zapFilt = audioCtx.createBiquadFilter();
        zap.type = 'square';
        zap.frequency.setValueAtTime(2000 + 600 * intensity, t);
        zap.frequency.exponentialRampToValueAtTime(60, t + 0.12);
        zapFilt.type = 'bandpass';
        zapFilt.frequency.value = 1200;
        zapFilt.Q.value = 6;
        zapGain.gain.setValueAtTime(1.8 * vol, t);
        zapGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        zap.connect(zapFilt);
        zapFilt.connect(zapGain);
        zapGain.connect(sfxGain);
        zap.start(t);
        zap.stop(t + 0.15);

        // Layer 2: glitchy stutter (short repeating bursts via gain modulation)
        const glitch = audioCtx.createOscillator();
        const glitchGain = audioCtx.createGain();
        glitch.type = 'sawtooth';
        glitch.frequency.value = 80 * intensity;
        const steps = Math.floor(2 + intensity);
        for (let i = 0; i < steps; i++) {
            const on = t + i * 0.04;
            glitchGain.gain.setValueAtTime(1.4 * vol, on);
            glitchGain.gain.setValueAtTime(0.01, on + 0.015);
        }
        glitchGain.gain.setValueAtTime(0.01, t + steps * 0.04);
        glitch.connect(glitchGain);
        glitchGain.connect(sfxGain);
        glitch.start(t);
        glitch.stop(t + steps * 0.04 + 0.01);

        // Layer 3: digital hum tail (detuned pair through tight bandpass)
        const hum1 = audioCtx.createOscillator();
        const hum2 = audioCtx.createOscillator();
        const humGain = audioCtx.createGain();
        const humFilt = audioCtx.createBiquadFilter();
        hum1.type = 'square';
        hum2.type = 'square';
        hum1.frequency.value = 100 * intensity;
        hum2.frequency.value = 103 * intensity;
        humFilt.type = 'bandpass';
        humFilt.frequency.value = 800;
        humFilt.Q.value = 8;
        humGain.gain.setValueAtTime(1.0 * vol, t + 0.05);
        humGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        hum1.connect(humFilt);
        hum2.connect(humFilt);
        humFilt.connect(humGain);
        humGain.connect(sfxGain);
        hum1.start(t + 0.05);
        hum2.start(t + 0.05);
        hum1.stop(t + 0.3);
        hum2.stop(t + 0.3);
    }
}

const boostNodes = {};

export function setBoostSound(playerId, isBoosting) {
    if (!audioCtx) return;
    
    const theme = useGameStore.getState().settings.theme;
    
    if (isBoosting && !boostNodes[playerId]) {
        const gain = audioCtx.createGain();
        gain.connect(sfxGain);
        
        let source, filter;
        
        if (theme === 'beach') {
            // Ocean wave rush — noise with modulating bandpass for wave motion + low whoosh
            const bufferSize = audioCtx.sampleRate * 2.0;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            
            filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 500;
            filter.Q.value = 1.2;
            // Sweep up to simulate wave building
            filter.frequency.linearRampToValueAtTime(2200, audioCtx.currentTime + 0.6);
            
            // Second filter for warmth
            const warmth = audioCtx.createBiquadFilter();
            warmth.type = 'lowpass';
            warmth.frequency.value = 3000;
            
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 0.25);
            
            source.connect(filter);
            filter.connect(warmth);
            warmth.connect(gain);
            source.start();
            
            // Low sub-whoosh layer for water body
            const whoosh = audioCtx.createOscillator();
            whoosh.type = 'sine';
            whoosh.frequency.value = 55;
            whoosh.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.5);
            const whooshGain = audioCtx.createGain();
            whooshGain.gain.value = 0;
            whooshGain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.3);
            whoosh.connect(whooshGain);
            whooshGain.connect(sfxGain);
            whoosh.start();
            
            // Store extra nodes for cleanup
            boostNodes[playerId] = { source, gain, filter, theme, extras: [whoosh, whooshGain, warmth] };
            return;
            
        } else if (theme === 'temple') {
            // Stone grinding + ancient rumble — resonant low noise with harmonic peaks
            const bufferSize = audioCtx.sampleRate * 2.0;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            // Grittier noise: occasional pops for stone character
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.92 ? 1.5 : 0.6);
            }
            
            source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            
            filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 150;
            filter.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.6);
            filter.Q.value = 5; // Resonant peak for grinding character
            
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.55, audioCtx.currentTime + 0.25);
            
            source.connect(filter);
            filter.connect(gain);
            source.start();
            
            // Sub-bass rumble oscillator
            const rumble = audioCtx.createOscillator();
            rumble.type = 'sine';
            rumble.frequency.value = 35;
            rumble.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.5);
            const rumbleGain = audioCtx.createGain();
            rumbleGain.gain.value = 0;
            rumbleGain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.3);
            rumble.connect(rumbleGain);
            rumbleGain.connect(sfxGain);
            rumble.start();
            
            boostNodes[playerId] = { source, gain, filter, theme, extras: [rumble, rumbleGain] };
            return;
            
        } else if (theme === 'arctic') {
            // Blizzard wind — whistling bandpass noise + high shimmer
            const bufferSize = audioCtx.sampleRate * 2.0;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            
            filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 700;
            filter.frequency.linearRampToValueAtTime(1800, audioCtx.currentTime + 0.6);
            filter.Q.value = 5; // High Q for whistling wind character
            
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 0.35);
            
            source.connect(filter);
            filter.connect(gain);
            source.start();
            
            // Icy shimmer layer (high sine with slight vibrato)
            const shimmer = audioCtx.createOscillator();
            shimmer.type = 'sine';
            shimmer.frequency.value = 4200;
            const vibrato = audioCtx.createOscillator();
            vibrato.type = 'sine';
            vibrato.frequency.value = 6; // Slow modulation
            const vibGain = audioCtx.createGain();
            vibGain.gain.value = 80;
            vibrato.connect(vibGain);
            vibGain.connect(shimmer.frequency);
            const shimmerGain = audioCtx.createGain();
            shimmerGain.gain.value = 0;
            shimmerGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.5);
            shimmer.connect(shimmerGain);
            shimmerGain.connect(sfxGain);
            shimmer.start();
            vibrato.start();
            
            boostNodes[playerId] = { source, gain, filter, theme, extras: [shimmer, shimmerGain, vibrato, vibGain] };
            return;

        } else if (theme === 'inferno') {
            // Fire jet roar — aggressive noise with crackle modulation + deep sub roar
            const bufferSize = audioCtx.sampleRate * 2.0;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            // Spiky noise for crackle texture
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.6 ? 1.0 : 0.3);
            }
            
            source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            
            filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 300;
            filter.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.35);
            filter.Q.value = 2;
            
            // Add warmth/aggression with a second bandpass
            const midBoost = audioCtx.createBiquadFilter();
            midBoost.type = 'peaking';
            midBoost.frequency.value = 600;
            midBoost.gain.value = 8;
            midBoost.Q.value = 1.5;
            
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.15);
            
            source.connect(filter);
            filter.connect(midBoost);
            midBoost.connect(gain);
            source.start();
            
            // Deep sub roar oscillator
            const roar = audioCtx.createOscillator();
            roar.type = 'sawtooth';
            roar.frequency.value = 40;
            roar.frequency.linearRampToValueAtTime(65, audioCtx.currentTime + 0.4);
            const roarFilt = audioCtx.createBiquadFilter();
            roarFilt.type = 'lowpass';
            roarFilt.frequency.value = 120;
            const roarGain = audioCtx.createGain();
            roarGain.gain.value = 0;
            roarGain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.2);
            roar.connect(roarFilt);
            roarFilt.connect(roarGain);
            roarGain.connect(sfxGain);
            roar.start();
            
            boostNodes[playerId] = { source, gain, filter, theme, extras: [roar, roarFilt, roarGain, midBoost] };
            return;

        } else {
            // Cyber/Tron: Digital thruster — sawtooth buzz through resonant filter + electric hum
            source = audioCtx.createOscillator();
            source.type = 'sawtooth';
            source.frequency.value = 40;
            source.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.5);

            filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 200;
            filter.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.5);
            filter.Q.value = 8; // Resonant for that digital edge

            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.45, audioCtx.currentTime + 0.1);
            
            source.connect(filter);
            filter.connect(gain);
            source.start();
            
            // Electric hum overlay (detuned square pair)
            const hum1 = audioCtx.createOscillator();
            const hum2 = audioCtx.createOscillator();
            hum1.type = 'square';
            hum2.type = 'square';
            hum1.frequency.value = 60;
            hum2.frequency.value = 62;
            const humFilt = audioCtx.createBiquadFilter();
            humFilt.type = 'bandpass';
            humFilt.frequency.value = 120;
            humFilt.Q.value = 10;
            const humGain = audioCtx.createGain();
            humGain.gain.value = 0;
            humGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.2);
            hum1.connect(humFilt);
            hum2.connect(humFilt);
            humFilt.connect(humGain);
            humGain.connect(sfxGain);
            hum1.start();
            hum2.start();
            
            boostNodes[playerId] = { source, gain, filter, theme, extras: [hum1, hum2, humFilt, humGain] };
            return;
        }
        
        boostNodes[playerId] = { source, gain, filter, theme };
        
    } else if (!isBoosting && boostNodes[playerId]) {
        const { source, gain, filter, theme: nodeTheme, extras } = boostNodes[playerId];
        
        const fadeOutTime = 1.5;
        
        gain.gain.cancelScheduledValues(audioCtx.currentTime);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.01), audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + fadeOutTime);
        
        if (filter) {
            filter.frequency.cancelScheduledValues(audioCtx.currentTime);
            filter.frequency.setValueAtTime(filter.frequency.value, audioCtx.currentTime);
            filter.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + fadeOutTime);
        }
        
        if (nodeTheme !== 'beach' && nodeTheme !== 'temple' && nodeTheme !== 'arctic' && nodeTheme !== 'inferno') {
            // Cyber: also wind down the main oscillator frequency
            source.frequency.cancelScheduledValues(audioCtx.currentTime);
            source.frequency.setValueAtTime(source.frequency.value, audioCtx.currentTime);
            source.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + fadeOutTime);
        }
        
        // Fade out and stop extra nodes (oscillators, gains, etc.)
        if (extras) {
            for (const node of extras) {
                if (node instanceof GainNode) {
                    node.gain.cancelScheduledValues(audioCtx.currentTime);
                    node.gain.setValueAtTime(Math.max(node.gain.value, 0.001), audioCtx.currentTime);
                    node.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + fadeOutTime);
                } else if (node instanceof OscillatorNode) {
                    try { node.stop(audioCtx.currentTime + fadeOutTime); } catch(e) {}
                }
            }
        }
        
        source.stop(audioCtx.currentTime + fadeOutTime);
        delete boostNodes[playerId];
    }
}
