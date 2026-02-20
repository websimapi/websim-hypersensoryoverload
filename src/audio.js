export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = {};
        this.sources = {};
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
        this.gainNode.gain.value = 0.5;
        this.engineSource = null;
    }

    async load(name, url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.buffers[name] = audioBuffer;
    }

    play(name, loop = false, volume = 1.0, playbackRate = 1.0) {
        if (!this.buffers[name]) return;
        
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.loop = loop;
        source.playbackRate.value = playbackRate;
        
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        
        source.connect(gain);
        gain.connect(this.gainNode);
        source.start(0);

        if (name === 'engine') this.engineSource = source;
        return source;
    }

    setEnginePitch(speedRatio) {
        if (this.engineSource) {
            // Pitch shifts with speed
            this.engineSource.playbackRate.value = 0.5 + speedRatio * 1.5;
        }
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
}