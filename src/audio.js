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

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log('[Audio] Created AudioContext, state:', audioCtx.state);
        musicGain = audioCtx.createGain();
        sfxGain = audioCtx.createGain();
        
        const settings = useGameStore.getState().settings;
        musicGain.gain.value = settings.musicVolume !== undefined ? settings.musicVolume : 0.6;
        sfxGain.gain.value = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.8;
        console.log('[Audio] Music volume:', musicGain.gain.value, 'SFX volume:', sfxGain.gain.value);
        
        musicGain.connect(audioCtx.destination);
        sfxGain.connect(audioCtx.destination);
        console.log('[Audio] Gain nodes connected');
    }
    if (audioCtx.state === 'suspended') {
        console.log('[Audio] Resuming suspended AudioContext');
        audioCtx.resume();
    }
    console.log('[Audio] AudioContext state after init:', audioCtx.state);
}

export function playMusic() {
    console.log('[Audio] playMusic called, isMusicPlaying:', isMusicPlaying, 'audioCtx:', !!audioCtx);
    if (isMusicPlaying || !audioCtx) return;
    isMusicPlaying = true;
    console.log('[Audio] Starting music...');
    
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
                // Beach rhythm
                if (step % 8 === 0 || step % 8 === 3) {
                    playBeachKick(nextNoteTime, durationScale);
                }
                if (step % 4 === 2) {
                    // Offbeat chords
                    const chord = beachChords[Math.floor(step / 16) % beachChords.length];
                    chord.forEach(note => playBeachMarimba(nextNoteTime, note, durationScale));
                }
                if (step % 8 === 0 || step % 8 === 4) {
                    playBeachBass(nextNoteTime, beachBassNotes[Math.floor(step / 16) % beachBassNotes.length], durationScale);
                }
            } else if (theme === 'cracked_stone') {
                // Stone rhythm
                if (step % 8 === 0) {
                    playStoneTom(nextNoteTime, durationScale, 0.8); // Low tom
                } else if (step % 8 === 3 || step % 8 === 6) {
                    playStoneTom(nextNoteTime, durationScale, 1.2); // High tom
                }
                
                if (step % 4 === 2) {
                    playStoneWoodblock(nextNoteTime, durationScale, 1.0);
                } else if (step % 16 === 14) {
                    playStoneWoodblock(nextNoteTime, durationScale, 1.5);
                }
            } else {
                // Cyber rhythm (default)
                if (step % 4 === 0) playCyberKick(nextNoteTime, durationScale);
                playCyberBass(nextNoteTime, cyberBassNotes[step % 8], durationScale);
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
        // Rubbery collision noise (boing)
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        // Pitch drop for boing effect
        osc.frequency.setValueAtTime(400 + 200 * intensity, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(1.5 * (intensity / 5), audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(sfxGain);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
        
    } else if (theme === 'cracked_stone') {
        // Crunchy stone collision noise
        // Use a noise buffer
        const bufferSize = audioCtx.sampleRate * 0.2; // 0.2 seconds
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800 - 200 * intensity; // Lower frequency for harder hits
        filter.Q.value = 1;
        
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(2.0 * (intensity / 5), audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);
        
        noise.start();
        
    } else {
        // Cyber: Grinding metal sound using FM synthesis and noise
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        osc1.type = 'square';
        osc2.type = 'sawtooth';
        
        // Detuned harsh frequencies
        osc1.frequency.value = 100 * intensity;
        osc2.frequency.value = 150 * intensity;
        
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        filter.Q.value = 5;
        
        // Envelope
        gain.gain.setValueAtTime(2.4 * (intensity / 5), audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);
        
        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.4);
        osc2.stop(audioCtx.currentTime + 0.4);
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
            // Crashing wave (white noise with lowpass filter sweeping up)
            const bufferSize = audioCtx.sampleRate * 2.0; // 2 seconds loop
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            
            filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.frequency.linearRampToValueAtTime(2000, audioCtx.currentTime + 0.5);
            
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.2);
            
            source.connect(filter);
            filter.connect(gain);
            source.start();
            
        } else if (theme === 'cracked_stone') {
            // Rolling boulder noise (low frequency noise/rumble)
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
            filter.type = 'lowpass';
            filter.frequency.value = 100;
            filter.frequency.linearRampToValueAtTime(300, audioCtx.currentTime + 0.5);
            
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 0.2);
            
            source.connect(filter);
            filter.connect(gain);
            source.start();
            
        } else {
            // Cyber: Turbo wind up sound
            source = audioCtx.createOscillator();
            source.type = 'square'; // More rumbly
            source.frequency.value = 30; // Lower start
            source.frequency.linearRampToValueAtTime(60, audioCtx.currentTime + 0.5);

            filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 150; // Cut off high frequencies for rumble

            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
            
            source.connect(filter);
            filter.connect(gain);
            source.start();
        }
        
        boostNodes[playerId] = { source, gain, filter, theme };
        
    } else if (!isBoosting && boostNodes[playerId]) {
        const { source, gain, filter, theme: nodeTheme } = boostNodes[playerId];
        
        const fadeOutTime = 1.5; // Longer fade out
        
        gain.gain.cancelScheduledValues(audioCtx.currentTime);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.01), audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + fadeOutTime);
        
        if (nodeTheme === 'beach' || nodeTheme === 'cracked_stone') {
            if (filter) {
                filter.frequency.cancelScheduledValues(audioCtx.currentTime);
                filter.frequency.setValueAtTime(filter.frequency.value, audioCtx.currentTime);
                filter.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + fadeOutTime);
            }
        } else {
            // Cyber
            source.frequency.cancelScheduledValues(audioCtx.currentTime);
            source.frequency.setValueAtTime(source.frequency.value, audioCtx.currentTime);
            source.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + fadeOutTime);
        }
        
        source.stop(audioCtx.currentTime + fadeOutTime);
        delete boostNodes[playerId];
    }
}
