// we will initialize the context at the last possible moment, inside a user event,
// because that's what some browsers require
var audioContext;

function initAudioContext() {
    // init the audio context if it's not initialized
    if (audioContext == null) {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    }
}

// fade time for stopping a sound
// we can't just stop a sound instantly because there will be an audible pop.
var monoFadeTime = 0.05;

// object wrapping a single sound and keeping track of its source, volume, and play state.
class SoundEntry {
    constructor() {
        // init with no sound for now
        this.setBuffers(null, null);
        // default volume
        this.volume = 1.0;
        this.mixVolume = 1.0;
        this.masterVolume = 1.0;
        this.queuedTime = null;
    }

    setBuffers(buffers, sourceName) {
        // save the sound info
        this.buffers = buffers;
        this.bufferIndex = 0;
        this.sourceName = sourceName;
        // if we need to play a sound and we have an actual buffer then play it
        if (this.queuedTime != null && this.buffers != null) {
            this.triggerAtTime(this.queuedTime);
            this.queuedTime = null;
        }
    }

    setVolume(volume) {
        if (volume != this.volume) {
            this.volume = volume;
        }
    }

    setMixVolume(mixVolume) {
        if (mixVolume != this.mixVolume) {
            this.mixVolume = mixVolume;
        }
    }

    setMasterVolume(masterVolume) {
        if (masterVolume != this.masterVolume) {
            this.masterVolume = masterVolume;
        }
    }

    trigger() {
        this.triggerLater(0);
    }

    triggerLater(time=0, context=audioContext) {
        if (time > 0) {
            // calculate the sound start time in the audio context's terms
            var triggerTime = context.currentTime + (time/1000);
        } else {
            // just start the source immediately and forget it
            var triggerTime = 0
        }

        if (this.buffers == null) {
            // if we don't have the sound yet then queue playback for when we do
            this.queuedTime = triggerTime;

        } else {
            // create the sound and schedule it
            this.triggerAtTime(triggerTime, context);
        }
    }

    triggerAtTime(triggerTime, context=audioContext) {
        // combine section volume, master volume, and individual sound mix volume
        var gainValue = this.volume * this.mixVolume * this.masterVolume;

        // short circuit
        if (gainValue == 0) {
            return;
        }

        // create a source node
        var source = context.createBufferSource();
        source.buffer = this.buffers[this.bufferIndex];
        this.bufferIndex++;
        if (this.bufferIndex >= this.buffers.length) {
            this.bufferIndex = 0;
        }

        // create a volume node
        var gain = context.createGain();
        // set the volume on the gain node
        gain.gain.value = gainValue;

        // connect the nodes to the audio context output
        source.connect(gain);
        gain.connect(context.destination);

        // schedule the sound
        // console.log("Playing at " + triggerTime + ": " + this.sourceName);
        source.start(triggerTime);

        // hold on to the source and gain nodes in case we have to cancel it or stop it
        this.lastSource = source;
        this.lastGain = gain;
    }

    stop() {
        this.stopLater(0);
    }

    stopLater(time=0) {
        // if we have a scheduled source then cancel it
        if (this.lastSource != null) {
            if (time > 0) {
                // calculate the sound start time in the audio context's terms
                var t = audioContext.currentTime + (time/1000);
                // schedule the stop
                // We can't just stop the sound instantly because there will be an audio pop
                // this.lastSource.stop(t);
                // schedule the start of a fade
                this.lastGain.gain.setValueAtTime(this.volume, t);
                // schedule a very quick fade, down to 0.01 volume because it doesn't like 0.
                this.lastGain.gain.exponentialRampToValueAtTime(0.01, t + monoFadeTime);
                // stop the source at the end of the fade
                this.lastSource.stop(t + monoFadeTime);

            } else {
                // stop immediately
                // We can't just stop the sound instantly because there will be an audio pop
                // this.lastSource.stop();
                // start a very quick fade, down to 0.01 volume because it doesn't like 0.
                this.lastGain.gain.exponentialRampToValueAtTime(0.01, monoFadeTime);
                // stop the source at the end of the fade
                this.lastSource.stop(monoFadeTime);
            }
            // clear the source state
            this.lastSource = null;
            this.gain = null;
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

// object wrapping a bank of sounds from a single source
class SoundBankSource {
    constructor(sourceName, sources, mono=false) {
        // source data
        this.sourceName = sourceName;
        this.sources = sources;
        this.mono = mono;
        // intialized flag
        this.initialized = false;

        // create the sound entries
        this.sounds = Array();
        for (var i = 0; i < this.sources.length; i++) {
            this.sounds.push(new SoundEntry());
        }
    }

    getSourceList() {
        var sourceList = Array();
        for (var i = 0; i < this.sounds.length; i++) {
            // add a sound path to the list for each entry in the source for that sound
            // these will be the keys in the map passed to applySourceBuffers()
            for (var j = 0; j < this.sources[i].length; j++) {
                sourceList.push(this.sources[i][j]);
            }
        }
        return sourceList;
    }

    applySourceBuffers(bufferMap) {
        for (var i = 0; i < this.sounds.length; i++) {
            // collect the buffers for this sound
            var soundBuffers = Array();
            for (var j = 0; j < this.sources[i].length; j++) {
                // the key is the original source path
                soundBuffers.push(bufferMap[this.sources[i][j]]);
            }
            // set the sound buffers, concatenate the sound file paths for a name
            this.sounds[i].setBuffers(soundBuffers, this.sources[i].join());
        }
        // this sound bank source is now initialized and will stay that way
        this.initialized = true;
    }

    setVolume(volume) {
        // propagate song-level volume to each sound
        for (var i = 0; i < this.sounds.length; i++) {
            this.sounds[i].setVolume(volume);
        }
    }

    setMixVolume(index, mixVolume) {
        // propagate mixer volume to the relevant sound
        this.sounds[index].setMixVolume(mixVolume);
    }

    setMasterVolume(masterVolume) {
        // propagate master volume to each sound
        for (var index = 0; index < this.sounds.length; index++) {
            this.sounds[index].setMasterVolume(masterVolume);
        }
    }

    playLater(index, time, context=audioContext) {
        if (this.mono) {
            // if this bank is mono then schedule any currently playing sounds to stop
            for (var i = 0; i < this.sounds.length; i++) {
                this.sounds[i].stopLater(time);
            }
        }
        // play the sound
        this.sounds[index].triggerLater(time, context);
    }

    stop() {
        // stop all sounds in this bank
        for (var i = 0; i < this.sounds.length; i++) {
            this.sounds[i].stop();
        }
    }

    clearStops() {
        // clear all stoppable sounds in this bank.  This is because we can't know on our own when a sound
        // has started playing
        for (var i = 0; i < this.sounds.length; i++) {
            this.sounds[i].clearStop();
        }
    }
}

// object wrapping a collections of sounds from the same logical source
class SoundBank {
    constructor(name, size) {
        // source cache
        this.name = name;
        this.sources = {};
        this.currentSource = null;
        this.volume = null;

        // enabled status is also an array
        this.enabled = Array();
        for (var i = 0; i < size; i++) {
            this.enabled.push(true);
        }

        // initialization state
        this.initialized = false;
    }

    precacheSource(sourceName, sources, mono=false) {
        if (!this.sources[sourceName]) {
            // create a new, uninitialized  bank source if it doesn't exist
            this.sources[sourceName] = new SoundBankSource(sourceName, sources, mono);
        }
        return this.sources[sourceName];
    }

    setSource(sourceName, sources, mono=false, precache=false) {
        // don't do anything if it's the source we already have
        if (this.currentSource && this.currentSource.sourceName == sourceName) {
            return;
        }

        // get or create a bank source and set it as the current
        var bankSource = this.precacheSource(sourceName, sources, mono);
        // check if it's initialized
        if (!bankSource.initialized) {
            // reset the init flag.
            // we can't actually do anything until there's an explicit user action.
            // abuse of auto-play video and audio is why we can't have nice things.
            this.initialized = false;
            // clear out any pending loaders
            // this can happen if sound packs are changed really fast by holding down undo/redo
            this.loader = null;

        }

        if (!precache) {
            this.currentSource = bankSource;
            // make sure the song-level volume is correct
            if (this.volume != null) {
                this.currentSource.setVolume(this.volume);
            }
        }

    }

    initialize(callback=null) {
        // check if we're already initialized or in the process of initialization
        if (this.initialized || this.loader != null) {
            // call the callback directly
            if (callback != null) callback();
            // short circuit
            return;
        }

        // finally we can init the audio context now that we're theoretically inside a user event handler
        initAudioContext();
        if (this.sources != null) {
            // collect the source paths from all unintialized bank sources
            var originalSourceList = Array();
            for (var sourceName in this.sources) {
                var source = this.sources[sourceName];
                if (!source.initialized) {
                    // append the source paths into one big list
                    originalSourceList = originalSourceList.concat(source.getSourceList());
                }
            }
            // build a corresponding array of the full source paths
            var sourceList = Array();
            for (var i = 0; i < originalSourceList.length; i++) {
                sourceList.push(soundPath + originalSourceList[i]);
            }
            // start a background loader with a callback because that's how things work
            this.loader = new BufferLoader(audioContext, sourceList,
                (loader, bufferList) => this.loaded(loader, originalSourceList, bufferList, callback));
            this.loader.bank = this;
            this.loader.load();
        }
    }

    loaded(loader, originalSourceList, bufferList, callback) {
        if (loader != this.loader) {
            // ignore, things have changed since this loader was started
            return;
        }
        // build a map of source path to buffer
        var bufferMap = {};
        for (var i = 0; i < originalSourceList.length; i++) {
            // order is preserved, set the key for each buffer using the corresponding original path entry
            bufferMap[originalSourceList[i]] = bufferList[i];
        }

        // set the loaded sources into each sound entry
        for (var sourceName in this.sources) {
            var source = this.sources[sourceName];
            if (!source.initialized) {
                // Each source will pull the buffers they need from the map
                source.applySourceBuffers(bufferMap);
            }
        }
        // set the initialized state
        this.loader = null;
        this.initialized = true;

        // hit the callback if provided
        if (callback != null) callback();
    }

    setVolume(volume) {
        // change check
        if (this.volume == volume) {
            return;
        }

        // save the volume
        this.volume = volume;
        // pass on the setting to the current bank source
        // no need to set it on all sources
        if (this.currentSource) {
            this.currentSource.setVolume(this.volume);
        }
    }

    setMixVolume(index, mixVolume) {
        // pass on the mixer setting to each of the bank sources
        // mixer settings typically don't change that often and this is easier than
        // saving and reinitializing mixer settings every time the bank source changes
        for (var sourceName in this.sources) {
            var source = this.sources[sourceName];
            source.setMixVolume(index, mixVolume);
        }
    }

    setMasterVolume(masterVolume) {
        // pass on the mixer setting to each of the bank sources
        for (var sourceName in this.sources) {
            var source = this.sources[sourceName];
            source.setMasterVolume(masterVolume);
        }
    }

    setEnabled(index, enabled) {
        // enable/disable sound
        this.enabled[index] = enabled;
    }

    isEnabled(index) {
        return this.enabled[index];
    }

    play(index) {
        // play the sound immediately
        this.playLater(index, 0);
    }

    playLater(index, time, context=audioContext) {
        // check if the given sound is enabled
        if (this.enabled[index]) {
            // make sure we're initialized.  Regardless of whether it's from clicking a note or starting playback,
            // the first sound must be played directly inside a user event handler so we're allowed to init the
            // audio context
            this.initialize();
            if (this.currentSource) {
                this.currentSource.playLater(index, time, context);
            }
            return true;

        } else {
            return false;
        }
    }

    stop() {
        // stop the current bank source
        if (this.currentSource) {
            this.currentSource.stop();
        }
    }

    clearStops() {
        // clear all stoppable sounds in the current bank source.
        // This is because we can't know on our own when a sound has started playing
        if (this.currentSource) {
            this.currentSource.clearStops();
        }
    }
}

// This object wraps three sound banks, one each for percussion, bass, and melody
class SoundPlayer {
    constructor() {
        // data structures
        this.banks = {};
        this.indexToBank = {};
        this.numBanks = 0;

        for (var name in sectionMetaData) {
            var m = sectionMetaData[name];
            if (!m.all) {
                // create a new bank with the section's number of notes and sound file suffixes
                var bank = new SoundBank(name, m.rowStop - m.rowStart + 1);
                // store an extra row start property, we'll need this later
                bank.rowStart = m.rowStart;
                // reference the bank by name
                this.banks[name] = bank;
                // also reference the bank by the row index of each note it plays
                for (var i = m.rowStart; i <= m.rowStop; i++) {
                    this.indexToBank[i] = bank;
                }
                // it's hard to get the size of a dict, so just keep it handy
                this.numBanks++;
            }
        }

        // special error sound for when the max number of notes in a section is exceeded
        this.bzzt = new SoundBank("bzzt", 1);
        // the suffix is the whole path
        this.bzzt.setSource(bzztSoundFile, [[bzztSoundFile]], true);

        // initialization flag
        this.initialized = false;
    }

    setSource(section, source, mono=false, precache=false) {
        var m = sectionMetaData[section];
        var soundFiles = instrumentNameToPack[source].soundFiles
        // set the source on the given section
        this.banks[section].setSource(source, soundFiles.slice(m.rowStart, m.rowStop + 1), mono, precache);
        // go ahead and reset the initialized flag
        this.initialized = false;
    }

    setVolume(section, volume) {
        // set the volume on the given section
        this.banks[section].setVolume(volume);
    }

    setMixVolume(index, mixVolume) {
        // find the correct section
        var bank = this.indexToBank[index];
        // set the specified sound's volume
        return bank.setMixVolume(index - bank.rowStart, mixVolume);
    }

    setMasterVolume(masterVolume) {
        for (var section in this.banks) {
            this.banks[section].setMasterVolume(masterVolume);
        }
    }

    setEnabled(index, enabled) {
        var bank = this.indexToBank[index];
        // enable or disable playback for the given row
        bank.setEnabled(index - bank.rowStart, enabled);
    }

    isEnabled(index) {
        // determine if the row is enabled
        var bank = this.indexToBank[index];
        return bank.isEnabled(index - bank.rowStart);
    }

    allBanksInitialized() {
        // short circuit
        if (this.initialized) {
            return true;
        }
        // check to see if every bank is initialized
        for (var section in this.banks) {
            if (!this.banks[section].initialized) {
                // found an uninitialized one
                return false;
            }
        }
        // short circuit in the future
        this.initialized = true;
        // we are initialized
        return true;
    }

    initialize(callback) {
        // short-circuit if we're already initialized
        if (this.allBanksInitialized()) {
            callback();
            return;
        }

        // loop over the sections
        for (var section in this.banks) {
            // initialize each section with a callback
            this.banks[section].initialize(() => {
                // if we've hit all banks then run the callback
                if (this.allBanksInitialized()) {
                    callback();
                }
            });
        }
    }

    playSound(index) {
        // play a sound now
        this.playSoundLater(index, 0);
    }

    playSoundLater(index, time) {
        // find the correct section
        var bank = this.indexToBank[index];
        // play the sound, reindexing according to the section's starting row index
        // use the offline context if present, otherwise play live
        return bank.playLater(index - bank.rowStart, time, this.offlineCtx ? this.offlineCtx : audioContext);
    }

    clearStops() {
        // This is because we can't tell when a sound has started playing, and we don't want to cut sounds off
        // in the middle when we stop playback.
        for (var section in this.banks) {
            this.banks[section].clearStops();
        }
    }

    stop() {
        // stop any pending scheduled sounds in every bank
        for (var section in this.banks) {
            this.banks[section].stop();
        }
    }

    playBzzt(index) {
        // play the error sound immediately
        this.bzzt.play(0);
    }

    startRendering(duration, callback) {
        // assume 44100 sample rate
        var sampleRate = 44100;

        this.initialize(() => {
            this.offlineCtx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);
            callback();
        });
    }

    finishRendering(callback) {
        console.log("Started audio rendering");
        this.offlineCtx.startRendering().then((buffer) => {
            console.log("Finished audio rendering");
            this.offlineCtx = null;
            callback(buffer);
        });
    }
}