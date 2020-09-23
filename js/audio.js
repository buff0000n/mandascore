var maxSounds = 4;

class SoundEntry {
    constructor(source = null) {
        this.setSource(source);
        this.volume = 1.0;
    }

    setSource(source) {
        this.source = source;
        if (this.source != null) {
            this.audio = Array();
            this.index = -1;
        } else {
            this.audio = null;
            this.index = -1;
        }
    }

    setVolume(volume) {
        if (volume != this.volume) {
            this.volume = volume;
            if (this.audio != null) {
                for (var i = 0; i < this.audio.length; i++) {
                    this.audio[i].volume = volume;
                }
            }
        }
    }

    trigger() {
        if (this.source == null) return;

        this.index = (this.index + 1) % maxSounds;
        if (this.audio.length < this.index + 1) {
            var a = new Audio(this.source);
            this.audio.push(a);
            a.play();

        } else {
            var a = this.audio[this.index];
            a.currentTime = 0.0;
            a.play();
        }
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
    }

    setSource(source) {
        if (this.source == source) {
            return;
        }

        this.source = source;
        for (var i = 0; i < this.sounds.length; i++) {
            this.sounds[i].setSource(soundPath + this.source + this.suffixes[i]);
        }
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
        if (this.enabled) {
            this.sounds[index].trigger();
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

    playSound(index) {
        var bank = this.indexToBank[index];
        bank.play(index - bank.rowStart);
    }

    playBzzt(index) {
        this.bzzt.trigger();
    }
}