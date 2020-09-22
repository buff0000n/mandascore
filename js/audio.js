
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
    }

    setSource(source) {
        if (this.source == source) {
            return;
        }

        this.source = source;
        for (var i = 0; i < this.suffixes.length; i++) {
            this.sounds[i].setSource("sound/" + this.source + this.suffixes[i]);
        }
    }

    play(index) {
        this.sounds[index].trigger();
    }
}

class SoundPlayer {
    constructor() {
        this.perc = new SoundBank(soundFileSuffixes.slice(0, 3));
        this.bass = new SoundBank(soundFileSuffixes.slice(3, 8));
        this.mel = new SoundBank(soundFileSuffixes.slice(8, 13));
    }

    setPercSource(source) {
        this.perc.setSource(source);
    }

    setBassSource(source) {
        this.bass.setSource(source);
    }

    setMelSource(source) {
        this.mel.setSource(source);
    }

    playSound(index) {
        if (index < 3) this.perc.play(index)
        else if (index < 8) this.bass.play(index - 3)
        else this.mel.play(index - 8);
    }
}