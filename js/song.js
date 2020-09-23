class InstrumentPack {
    constructor(name, displayName) {
        this.name = name;
        this.displayName = displayName;
    }
}

var packs = Array(
    new InstrumentPack("adau", "Adau"),
    new InstrumentPack("alpha", "Alpha"),
    new InstrumentPack("beta", "Beta"),
    new InstrumentPack("delta", "Delta"),
    new InstrumentPack("druk", "Druk"),
    new InstrumentPack("epsilon", "Epsilon"),
    new InstrumentPack("gamma", "Gamma"),
    new InstrumentPack("horos", "Horos"),
    new InstrumentPack("plogg", "Plogg"),
);

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

var sectionMetaData = {
    "all": new SectionMetaData("all", "All", 0, 12, 0, "#ffffff", true),
    "perc": new SectionMetaData("perc", "Percussion", 0, 2, 24, "#ffffff"),
    "bass": new SectionMetaData("bass", "Bass", 3, 7, 16, "#1fb5ff"),
    "mel": new SectionMetaData("mel", "Melody", 8, 12, 16, "#e601ff")
}

class Song {
    constructor() {
        this.sets = Array(3);
        this.volumes = Array(3);
        this.name = "";
        this.notes = Array(64);
        for (var i = 0; i < notes.length; i++) {
          this.notes[i] = new Array(13);
        }
    }

    getMeasureNotes(m) {
        return this.notes.slice(m*16, (m+1)*16);
    }

    setMeasureNotes(m, measureNotes) {
        for (var t = 0; t < 16; t++) {
            for (var n = 0; t < 13; n++) {
                this.notes[m+16 + t][n] = measureNotes[t, n];
            }
        }
    }
}