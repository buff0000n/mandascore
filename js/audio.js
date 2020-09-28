//var maxSounds = 4;

var audioContext;

function initAudioContext() {
    if (audioContext == null) {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    }
}

function bankLoaded(loader, bufferList) {
    loader.bank.loaded(bufferList);
}

class SoundEntry {
    constructor() {
        this.setBuffer(null, null);
        this.volume = 1.0;
        this.queued = false;
    }

    setBuffer(buffer, sourceName) {
        this.buffer = buffer;
        this.sourceName = sourceName;
        if (this.queued) {
            this.trigger();
            this.queued = false;
        }
    }

    setVolume(volume) {
        if (volume != this.volume) {
            this.volume = volume;
        }
    }

    trigger() {
        this.triggerLater(0);
    }

    triggerLater(time) {
        if (this.buffer == null) {
            this.queued = true;
            return;
        }

        var source = audioContext.createBufferSource();
        source.buffer = this.buffer;

        var gain = audioContext.createGain();
        gain.gain.value = this.volume;

        source.connect(gain);
        gain.connect(audioContext.destination);

        if (time > 0) {
            var t = audioContext.currentTime + (time/1000);
            source.start(t);
            this.lastSource = source;
            // console.log("playing " + this.sourceName + " in " + time + "ms")
        } else {
            source.start(0);
            // console.log("playing " + this.sourceName)
        }
    }

    stop() {
        if (this.lastSource != null) {
            this.lastSource.stop();
            this.lastSource = null;
        }
    }

    clearStop() {
        // I can't believe I have to do this.
        // there is no way to get notified when a scheduled sound starts playing.
        // there is no way to cancel a scheduled sound without stopping it in the middle if it's already playing
        // AudioContext is better than new Audio().play(), but damn is it Very Annoying in some ways.
        this.lastSource = null;
    }
}

class SoundBank {
    constructor(suffixes) {
        this.suffixes = suffixes;
        this.sounds = Array();
        for (var i = 0; i < suffixes.length; i++) {
            this.sounds.push(new SoundEntry());
        }
        this.enabled = true;
        this.loader = null;
        this.initialized = false;
    }

    setSource(source) {
        if (this.source == source) {
            return;
        }

        this.source = source;
        this.initialized = false;
    }

    initialize() {
        if (this.initialized || this.loader != null) return;

        initAudioContext();
        if (this.source != null) {
            var sources = Array();
            for (var i = 0; i < this.sounds.length; i++) {
                this.sounds[i].setBuffer(null);
                sources.push(soundPath + this.source + this.suffixes[i]);
            }
            this.loader = new BufferLoader(audioContext, sources, bankLoaded);
            this.loader.bank = this;
            this.loader.load();
        }
    }

    loaded(bufferList) {
        for (var i = 0; i < this.sounds.length; i++) {
            this.sounds[i].setBuffer(bufferList[i], soundPath + this.source + this.suffixes[i]);
        }
        this.loader = null;
        this.initialized = true;
    }

    setVolume(volume) {
        if (this.volume == volume) {
            return;
        }

        this.volume = volume;
        for (var i = 0; i < this.sounds.length; i++) {
            this.sounds[i].setVolume(this.volume);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    play(index) {
        this.playLater(index, 0);
    }

    playLater(index, time) {
        if (this.enabled) {
            this.initialize();
            this.sounds[index].triggerLater(time);
            return true;
        } else {
            return false;
        }
    }

    stop() {
        for (var i = 0; i < this.sounds.length; i++) {
            this.sounds[i].stop();
        }
    }

    clearStops() {
        for (var i = 0; i < this.sounds.length; i++) {
            this.sounds[i].clearStop();
        }
    }
}

class SoundPlayer {
    constructor() {
        this.banks = {};
        this.indexToBank = {};

        for (var name in sectionMetaData) {
            var m = sectionMetaData[name];
            if (!m.all) {
                var bank = new SoundBank(soundFileSuffixes.slice(m.rowStart, m.rowStop + 1));
                bank.rowStart = m.rowStart;
                this.banks[name] = bank;
                for (var i = m.rowStart; i <= m.rowStop; i++) {
                    this.indexToBank[i] = bank;
                }
            }
        }

        this.bzzt = new SoundEntry(soundPath + bzztSoundFile);
    }

    setSource(section, source) {
        this.banks[section].setSource(source);
    }

    setVolume(section, volume) {
        this.banks[section].setVolume(volume);
    }

    setEnabled(section, enabled) {
        this.banks[section].setEnabled(enabled);
    }

    isEnabled(index) {
        var bank = this.indexToBank[index];
        return bank.enabled;
    }

    playSound(index) {
        this.playSoundLater(index, 0);
    }

    playSoundLater(index, time) {
        var bank = this.indexToBank[index];
        return bank.playLater(index - bank.rowStart, time);
    }

    clearStops() {
        for (var section in this.banks) {
            this.banks[section].clearStops();
        }
    }

    stop() {
        for (var section in this.banks) {
            this.banks[section].stop();
        }
    }

    playBzzt(index) {
        this.bzzt.trigger();
    }
}