
var soundFileSuffixes = Array(
    "-1.ogg",
    "-2.ogg",
    "-3.ogg",
    "-4.ogg",
    "-5.ogg",
    "-6.ogg",
    "-7.ogg",
    "-8.ogg",
    "-9.ogg",
    "-10.ogg",
    "-11.ogg",
    "-12.ogg",
    "-13.ogg"
)

class SoundEntry {
    constructor(source = null) {
        this.setSource(source);
        this.volume = 1.0;
        this.once = false;
    }

    setSource(source) {
        this.source = source;
        if (this.source != null) {
            this.audio = new Audio(source);
        } else {
            this.audio = null;
        }
    }

    setVolume(volume) {
        if (volume != this.volume) {
            this.volume = volume;
            if (this.source != null) {
                this.audio.volume = volume;
            }
        }
    }

    trigger() {
        if (this.source == null) return;

        // todo: mult-trigger with multiple audio objects?
        if (!this.once) {
            this.audio.play();
            this.once = true;

        } else {
            this.audio.currentTime = 0.0;
            this.audio.play();
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
            this.sounds[i].setSource("sound/" + this.source + this.suffixes[i]);
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
}