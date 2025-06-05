// instrument pack metadata
// Mono settings need their own struct
class MonoSpec {
    constructor(perTone=false, fadeTime=0.05) {
        this.perTone = perTone;
        this.fadeTime = fadeTime;
    }
}

class InstrumentPack {
    constructor(name, displayName, formatName, abbrev, double=false, monoPerc=null, monoBass=null, monoMel=null) {
        this.name = name;
        this.displayName = displayName;
        this.formatName = formatName;
        this.abbrev = abbrev;
        this.mono = {};
        this.mono["perc"] = monoPerc;
        this.mono["bass"] = monoBass;
        this.mono["mel"] = monoMel;
        if (double) {
            this.soundFiles = doubleSoundFiles(this.name);
        } else {
            this.soundFiles = singleSoundFiles(this.name);
        }
    }
}

var packs = Array(
    new InstrumentPack("adau", "Adau", "BardTennoPackA", "U", true),
    new InstrumentPack("alpha", "Alpha", "BardCorpusPackA", "A", true),
    new InstrumentPack("beta", "Beta", "BardCorpusPackB", "B", true),
    new InstrumentPack("bombast", "Bombast", "BardHipHopPackA", "O", true, null, new MonoSpec(false, 0.05), new MonoSpec(false, 0.20)),
    new InstrumentPack("delta", "Delta", "BardCorpusPackD", "D", true, false, new MonoSpec(false, 0.50), new MonoSpec(false, 0.10)),
    new InstrumentPack("druk", "Druk", "BardGrineerPackA", "K", true),
    new InstrumentPack("epsilon", "Epsilon", "BardCorpusPackE", "E", true, false, new MonoSpec(true, 0.25), false),
    new InstrumentPack("gamma", "Gamma", "BardCorpusPackC", "G", true),
    new InstrumentPack("horos", "Horos", "BardEDMPackA", "H", true),
    new InstrumentPack("plogg", "Plogg", "BardGrineerPackB", "P", true),
    new InstrumentPack("clazz", "Clazz (Concept)", "ConceptClazz", "J"),
    new InstrumentPack("zeta", "Zeta (Concept)", "ConceptZeta", "Z"),
);

// build a few lookup tables for instrument pack metadata
var instrumentIdToPack = {};
var instrumentNameToPack = {};
var instrumentDisplayNameToPack = {};
for (var i = 0; i < packs.length; i++) {
    var pack = packs[i];
    instrumentIdToPack[pack.formatName] = pack;
    instrumentNameToPack[pack.name] = pack;
    instrumentDisplayNameToPack[pack.displayName] = pack;
}

// section metadata
class SectionMetaData {
    constructor(name, displayName, rowStart, rowStop, maxNotes, color, all=false) {
        this.name = name;
        this.displayName = displayName;
        this.rowStart = rowStart;
        this.rowStop = rowStop;
        this.maxNotes = maxNotes;
        this.color = color;
        this.all = all;
    }
}

var sectionNames = ["perc", "bass", "mel"];

var sectionMetaData = {
    "all": new SectionMetaData("all", "All", 0, 12, 56, "#ffffff", true),
    "perc": new SectionMetaData("perc", "Percussion", 0, 2, 26, "#ffffff"),
    "bass": new SectionMetaData("bass", "Bass", 3, 7, 16, "#1fb5ff"),
    "mel": new SectionMetaData("mel", "Melody", 8, 12, 16, "#e601ff"),
    "perf": new SectionMetaData("perf", "Performance", -1, -1, 0, "#ffffff", true)
}

var songMatchNoteWeight = 10;
var songMatchExtraNoteWeight = -2;
var songMatchMissingNoteWeight = -1;


// The rest of this is all converted from Python because I'm not writing it twice

// get the mapped in-game name from an instrument set identifier, or just the identifier if we
// don't have a mapping
function getPackName(packId) {
    if (packId in instrumentIdToPack) {
        // got a mapping
        return instrumentIdToPack[packId].name;
    } else {
        // unknown instrument set pls update kthxbye
        return packId;
    }
}

// get the mapped in-game name from an instrument set identifier, or just the identifier if we
// don't have a mapping
function getPackId(packName) {
    if (packName in instrumentNameToPack) {
        // got a mapping
        return instrumentNameToPack[packName].formatName;
    } else {
        // unknown instrument name this shouldn't happen
        return packName;
    }
}

// get or set the specified bit from the packed byte array according to the given row and column setup
function getSetBit(byteArray, numColumns, row, column, littleendian, offset, bitValue=-1) {
    // calculate the index of the byte and bit within that byte

    // get the bit index in the bit array
    var bit = (row * numColumns) + column;
    // convert the bit index into a byte index, taking into account the offset
    var byteIndex = offset + (bit >> 3);
    // and a sub index inside that byte
    var bitIndex = bit & 0x07;
    // if it's little endian then we need to count from the other end of the byte
    if (littleendian) {
        bitIndex = 7 - bitIndex;
    }

    if (bitValue < 0) {
        // if the byte index is past the end of the array then assume it's zero
        if (byteIndex >= byteArray.length) {
            return 0;

        } else {
            // extract the bit from inside the byte
            return (byteArray[byteIndex] >> bitIndex) & 0x01;
        }
    } else {
        // set a bit mask for the target bit
        var mask = 1 << bitIndex;

        if (bitValue == 0) {
            // AND the inverse mask with the byte
            byteArray[byteIndex] &= ~mask;

        } else {
            // OR the mask with the byte
            byteArray[byteIndex] |= mask;
        }
    }
}

function getBit(byteArray, numColumns, row, column, littleendian, offset) {
    return getSetBit(byteArray, numColumns, row, column, littleendian, offset);
}

function setBit(byteArray, numColumns, row, column, littleendian, offset, bitValue) {
    getSetBit(byteArray, numColumns, row, column, littleendian, offset, bitValue);
}
//
//var newVolume = true;
//
//function decodeVolume(b1, b2) {
//    if (this.newVolume) {
//        return decodeVolume_new(b1, b2)
//    } else {
//        return decodeVolume_old(b1, b2);
//    }
//}
//
//function encodeVolume(vol) {
//    if (this.newVolume) {
//        return encodeVolume_new(vol)
//    } else {
//        return encodeVolume_old(vol);
//    }
//}

// for some reason this is the dBFS value used for a level of 0
var zeroDBFS = -46.5625;

// turn volume data into a percentage
function decodeVolume(b1, b2) {
    // combine bytes and decode as a 16-bit float
    var dBFS = float16_to_float((b1 << 8) | b2);
    // check for the "zero" value
    if (dBFS <= zeroDBFS) {
        return 0;
    } else {
        // standard conversion from dBFS to 0-100 level
        return Math.pow(10, (dBFS / 20)) * 100;
    }
}

// turn a percentage into volume data
function encodeVolume(vol) {
    var dBFS;
    if (vol <= 0) {
        // use the "zero" value
        dBFS = zeroDBFS;
    } else {
        // standard conversion from 0-100 level to dBFS
        // There's no log base 10 built into javascript, so implement with natural log
        dBFS = (Math.log(vol / 100) / Math.LN10) * 20;
    }
    // convert to 16-bit float
    var level = float_to_float16(dBFS);
    // separate bytes
    return valtoBytes(level);
}

//// all I have are a volume value samples at 0%, 25%, 50%, 75%, and 100% that I can try to interpolate between
//
//// This value is definitely 0%
//var vol_p00 = 0xD1D2;
//// eyeballed averages for 25%, 50%, and 75%
//var vol_p25 = 0xCA00;
//var vol_p50 = 0xC5FD;
//var vol_p75 = 0xC09C;
//// This is somewhere around what the values approach as they near 100%
//var vol_p99 = 0xAD00;
//// This value is definitely 100%
//var vol_p100 = 0x0000;
//
//
//// turn volume data into a percentage
//function decodeVolume_old(b1, b2) {
//    // put the two bytes together
//    var val = (b1*0x100)+b2;
//
//    // check known value for 100%
//    if (val == vol_p100) {
//        return 100;
//    }
//
//    // check known value for 0%
//    if (val == vol_p00) {
//        return 0;
//    }
//
//    // find which 25% block it falls in
//    // ">" because the encoded value is in reverse ordering
//    if (vol_p00 >= val && val > vol_p25) {
//        block = 0;
//        blockMin = vol_p00;
//        blockMax = vol_p25;
//
//    } else if (vol_p25 >= val && val > vol_p50) {
//        block = 25;
//        blockMin = vol_p25;
//        blockMax = vol_p50;
//
//    } else if (vol_p50 >= val && val > vol_p75) {
//        block = 50;
//        blockMin = vol_p50;
//        blockMax = vol_p75;
//
//    } else if (vol_p75 >= val && val >= vol_p99) {
//        block = 75;
//        blockMin = vol_p75;
//        blockMax = vol_p99;
//
//    } else {
//        // Invalid value, as far as I can tell
//        // print("unrecognized volume value: 0x{0}".format(bytearray([b1, b2]).hex()))
//        return val
//    }
//
//    // assume it's linear between the two points
//    var percent = block + ((1 - ((val - blockMin) / (blockMax - blockMin))) * 25);
//
//    // print("decoded volume value: 0x{0} to {1}".format(bytearray([b1, b2]).hex(), percent))
//    return percent;
//}

function valtoBytes(v) {
    return Array((v >> 8) & 0xFF, v & 0xFF);
}

//// turn volume data into a percentage
//function encodeVolume_old(vol) {
//    // convenience function to convert back to byte array
//
//    // check known value for 100%
//    if (vol == 100) {
//        return valtoBytes(vol_p100);
//    }
//
//    // check known value for 0%
//    if (vol == 0) {
//        return valtoBytes(vol_p00);
//    }
//
//    // find which 25% block it falls in
//    if (0 <= vol && vol < 25) {
//        block = 0;
//        blockMin = vol_p00;
//        blockMax = vol_p25;
//
//    } else if (25 <= vol && vol < 50) {
//        block = 25;
//        blockMin = vol_p25;
//        blockMax = vol_p50;
//
//    } else if (50 <= vol && vol < 75) {
//        block = 50;
//        blockMin = vol_p50;
//        blockMax = vol_p75;
//
//    } else if (75 <= vol && vol <= 100) {
//        block = 75;
//        blockMin = vol_p75;
//        blockMax = vol_p99;
//
//    } else {
//        // Invalid value, as far as I can tell
//        // print("unrecognized volume value: {0}".format(vol))
//        // symmetry with decodeVolume
//        return valtoBytes(vol);
//    }
//
//    // assume it's linear between the two points
//    var val = Math.round((blockMax - blockMin) * (1 - ((vol - block) / 25)) + blockMin);
//    // print("encoded volume value: {0} to 0x{1}".format(vol, bytearray(valtoBytes(val)).hex()))
//    return valtoBytes(val);
//}

// compile a regular expression that matches the [SONG-...] format.  It looks like this:
// [SONG-<song name>:<base 64 data>:<melody instrument>:<bass instrument>:<percussion instrument>]
chatLinkPattern = /\[SONG-([^:]+):([^:]+):([^:]+):([^:]+):([^:\]]+)\]/;

var maxNameLength = 24;

// very few chars seem to be allowed
// invalidNameCharRegex = /[^0-9A-Za-z._\- ]/
// okay, we don't really care about valid chat links since you can't paste them into chat anymore anyway,
// just remove what we have to for the format
invalidNameCharRegex = /[:]/;
extraSpacesRegex = /\s{2,}/;

function sanitizeName(name) {
    name = name.replace(invalidNameCharRegex, "");
    name = name.replace(extraSpacesRegex, "");
    name = name.trim();
    return name.substring(0, maxNameLength);
}

// obtuse base64 conversion routine cribbed from somewhere on the internet
function base64ToUint8(encoded) {
    return Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
}

// obtuse base64 conversion routine cribbed from somewhere on the internet
function uint8ToBase64(buffer) {
     var binary = '';
     var len = buffer.byteLength;
     for (var i = 0; i < len; i++) {
         binary += String.fromCharCode(buffer[i]);
     }
     return btoa(binary);
}

// This object can translate back and forth between the song code format and a data model for the song
class Song {
    constructor() {
        // start off with default title, instrument packs, and volumes
        this.name = "";
        this.packs = {
            "perc": "adau",
            "bass": "adau",
            "mel": "adau"
        };
        this.volumes = {
            "perc": 100.0,
            "bass": 100.0,
            "mel": 100.0
        };
        // cached data
        this.clearCachedData();

        // first array index is the time of the note, from 0-63
        // second array index is the note: 0 = lowest melody note, 12 = top percussion note
        // todo: do I have to have the rows in reverse order?
        this.notes = Array(64);
        for (var t = 0; t < this.notes.length; t++) {
            this.notes[t] = new Array(13);
            for (var r = 0; r < this.notes[t].length; r++) {
                this.notes[t][r] = 0;
            }
        }
    }

    clone() {
        // ugh
        var song = new Song();
        song.setName(this.getName());
        song.setPack("perc", this.getPack("perc"));
        song.setPack("bass", this.getPack("bass"));
        song.setPack("mel", this.getPack("mel"));
        song.setVolume("perc", this.getVolume("perc"));
        song.setVolume("bass", this.getVolume("bass"));
        song.setVolume("mel", this.getVolume("mel"));
        for (var t = 0; t < this.notes.length; t++) {
            for (var r = 0; r < this.notes[t].length; r++) {
                song.notes[t][r] = this.notes[t][r];
            }
        }
        return song;
    }

    getMeasureNotes(m) {
        // extract the notes for the given measure into a 16x13 array of 1s and 0s
        var mnotes = Array(16);
        for (var t = 0; t < 16; t++) {
            mnotes[t] = new Array(13);
            for (var r = 0; r < 13; r++) {
                mnotes[t][r] = this.notes[(m*16) + t][r];
            }
        }

        return mnotes;
    }

    setMeasureNotes(m, mnotes) {
        // set the notes for the given measure from a 16x13 array of 1s and 0s
        for (var t = 0; t < 16; t++) {
            for (var r = 0; r < 13; r++) {
                this.notes[(m*16) + t][r] = mnotes[t][r];
            }
        }
        this.clearCachedData();
    }

    // accessors
    getName() {
        return this.name;
    }

    setName(name) {
        this.name = name;
    }

    getPack(section) {
        return this.packs[section];
    }

    setPack(section, pack) {
        this.packs[section] = pack;
    }

    getVolume(section) {
        return this.volumes[section];
    }

    setVolume(section, volume) {
        this.volumes[section] = volume;
    }

    clearCachedData() {
        this.sectionPresent = null;
    }

    hasSection(section) {
        if (!this.sectionPresent) {
            this.sectionPresent = {};
        }
        if (this.sectionPresent[section] == null) {
            var md = sectionMetaData[section];
            var foundOne = false;
            for (var t = 0; t < 64 && !foundOne; t++) {
                for (var r = md.rowStart; r <= md.rowStop && !foundOne; r++) {
                    if (this.notes[t][r] != 0) {
                        foundOne = true;
                    }
                }
            }
            this.sectionPresent[section] = foundOne;
        }
        return this.sectionPresent[section];
    }

    toString() {
        // produce a basic text-formatted view of the song data
        // this isn't used for this project, but maybe it's useful for someone else.  It makes this file a
        // self-contained library for reading song codes
        // todo: I have not actually tested this
        var string = "";

        // Get these out of the way
        string += `Name: ${this.name}\n`;
        string += `Percussion: ${this.packs["perc"]}: ${this.volumes["perc"].toFixed(0)}\n`;
        string += `Bass: ${this.packs["bass"]}: ${this.volumes["bass"].toFixed(0)}\n`;
        string += `Melody: ${this.packs["mel"]}: ${this.volumes["mel"].toFixed(0)}\n`;

        // header divider for note data
        string += "||---------1---------||---------2---------||---------3---------||---------4---------||\n";
        // column 0 is at the bottom, 12 is at the top
        for (var c = 12; c >= 0; c-=1) {
            // for each data column/note row, count up through the 64 data rows/note columns
            for (var r = 0; r < 64; r++) {
                if (r % 16 == 0) {
                    // print the measure dividers every sixteen notes
                    // printing without ending it with a newline is surprisingly hard
                    string += "||";
                } else if (r % 4 == 0) {
                    // print the quarter note dividers every four notes
                    string += "|";
                }
                // check the bit at the current data row and column/note column and row
                if (this.notes[r][c] == 1) {
                    // write a "O" for filled notes
                    string += "O";
                } else {
                    // write a "." for blank notes
                    string += ".";
                }
            }

            // print the last measure separator and end the line
            string += "||\n";

            // print instrument set separators after data column/note 10 (between bass and percussion)
            // and row 5 (between melody and bass) (note that c is counting down from 12)
            if (c == 10 || c == 5) {
                string += "||-------------------||-------------------||-------------------||-------------------||\n";
            }
        }
        // final footer divider for note data
        string += "||-------------------||-------------------||-------------------||-------------------||";

        return string;
    }

    parseChatLink(chatLink) {
        // search for a song.  I'm assuming there is only one per line
        var reMatch = chatLink.match(chatLinkPattern);
        if (reMatch == null) {
            throw "Invalid format";
        }

        // # print the raw [SONG-...] data for posterity
        // print(reMatch.group(0))

        // name is first in the block
        this.name = reMatch[1];
        // followed by a bunch of base64 encoded binary data
        var encoded = reMatch[2];
        // followed by pack identifiers, in reverse order
        this.packs["perc"] = getPackName(reMatch[5]);
        this.packs["bass"] = getPackName(reMatch[4]);
        this.packs["mel"] = getPackName(reMatch[3]);

        // base64 -> binary one-liner
        var b = base64ToUint8(encoded);

        // the first six bytes are the volume sliders for each instrument part
        // two bytes each, in reverse order
        this.volumes["perc"] = decodeVolume(b[4], b[5]);
        this.volumes["bass"] = decodeVolume(b[2], b[3]);
        this.volumes["mel"] = decodeVolume(b[0], b[1]);

        // After the first 6 bytes, the note data is packed bit by bit into 13*64 bits.
        // The first 13 bits are the first vertical column in the first measure of the song,
        // starting at the bottom melody note and ending at the top percussion note.
        // 1 indicates that note is filled, 0 means it's blank.
        // The next 13 bits are the second vertical column in the first measure.  This continues
        // for all 64 columns.
        // This is probably convenient for playback, but the binary data columns and rows are
        // reversed compared to how the note data appears in the game.  I need to reverse the rows
        // and columns, and the easiest way was to just build a random bit access method getBit()
        // Other tidbits:
        //   The bytes themselves are little endian for some reason, so that has to be reversed too.
        //   If the last columns of the song are blank then their data will be truncated and not
        //     included in the song's base64 data.  If you share a completely blank song then the
        //     base64 data will only include the six bytes of volume slider data.

        // count down from 12 to 0, because the data columns are in reverse order from how the note rows
        // appear in game
        for (var r = 12; r >= 0; r--) {
            // for each data column/note row, count up through the 64 data rows/note columns
            for (var c = 0; c < 64; c++) {
                // check the bit at the current data row and column/note column and row
                if (getBit(b, 13, c, r, 1, 6) == 1) {
                    // write a "O" for filled notes
                    this.notes[c][r] = 1;
                } else {
                    this.notes[c][r] = 0;
                }
            }
        }

        "break".trim();
    }

    formatAsChatLink() {
        // oh crap we have to do all that in reverse

        // name is first in the block.  Make it fit the stringent rules for name characters and length
        var name = sanitizeName(this.name);
        // make sure the name is non-empty
        if (name == "") {
            name = "Song";
        }

        // instrument sets identifiers, in reverse order
        var percInst = getPackId(this.packs["perc"]);
        var bassInst = getPackId(this.packs["bass"]);
        var melInst = getPackId(this.packs["mel"]);

        // 6 bytes of volume data plus up to (64*13)/8 = 104 bytes of note data
        var b = new Uint8Array(110);

        // the first six bytes are the volume sliders for each instrument part
        // two bytes each, in reverse order
        // don't know why, but I have to set these in the order in which they appear in the byte array
        var v = encodeVolume(this.volumes["mel"]);
        b[0] = v[0]; b[1] = v[1];
        v = encodeVolume(this.volumes["bass"]);
        b[2] = v[0]; b[3] = v[1];
        v = encodeVolume(this.volumes["perc"]);
        b[4] = v[0]; b[5] = v[1];

        // count down from 12 to 0, because the data columns are in reverse order from how the note rows
        // appear in game
        for (var r = 12; r >= 0; r--) {
            // for each data column/note row, count up through the 64 data rows/note columns
            for (var c = 0; c < 64; c++) {
                // check the bit at the current data row and column/note column and row
                setBit(b, 13, c, r, 1, 6, this.notes[c][r])
            }
        }

        var lastNonzeroByte = 0
        for (var i = 0; i < b.length; i++) {
            if (b[i] != 0) {
                lastNonzeroByte = i;
            }
        }

        // encode to base64, trimming any trailing 0-bytes
        // it still returns bytes for some reason so encode as a string
        var encoded = uint8ToBase64(b.slice(0, lastNonzeroByte+1));

        // [SONG-<song name>:<base 64 data>:<melody instrument>:<bass instrument>:<percussion instrument>]
        return `[SONG-${name}:${encoded}:${melInst}:${bassInst}:${percInst}]`;
    }

    matchSong(otherSong) {
        return this.matchSongSection(otherSong, "perc") +
               this.matchSongSection(otherSong, "bass") +
               this.matchSongSection(otherSong, "mel");
    }

    matchSongSection(otherSong, section) {
        if (!this.hasSection(section) || !otherSong.hasSection(section)) {
            return 0;
        }

        var md = sectionMetaData[section];

        var matchNotes = 0;
        var extraNotes = 0;
        var missingNotes = 0;
        for (var t = 0; t < 64; t++) {
            for (var r = md.rowStart; r <= md.rowStop; r++) {
                if (this.notes[t][r]) {
                    if (otherSong.notes[t][r]) {
                        matchNotes += 1;
                    } else {
                        extraNotes += 1;
                    }
                } else if (otherSong.notes[t][r]) {
                    missingNotes += 1;
                }
            }
        }

        // weight match counts against each other, then weight the whole score by the total number of notes
        return ((matchNotes * songMatchNoteWeight) +
                (extraNotes * songMatchExtraNoteWeight) +
                (missingNotes * songMatchMissingNoteWeight)) /
                (matchNotes + extraNotes);
    }
}
