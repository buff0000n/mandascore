// constants

var noteSpacingX = 4;
var noteSpacingY = 1;
var noteOffsetX = 2;
var noteOffsetY = 0;
var noteSizeX = 18;
var noteSizeY = 24;

var gridSizeX = noteSpacingX + noteSizeX;
var gridSizeY = noteSpacingY + noteSizeY;

sectionImages = {
    "all": "all",
    "perc": "perc-3",
    "bass": "bass",
    "mel": "mel",
};

var imgGrid = Array(
    "measure-1",
    "measure-2",
    "measure-3",
    "measure-4"
);

var imgRow = Array(
    "perc-1",
    "perc-2",
    "perc-3",
    "bass",
    "bass",
    "bass",
    "bass",
    "bass",
    "mel",
    "mel",
    "mel",
    "mel",
    "mel"
);

var imgNote = Array(
    "note-perc-1",
    "note-perc-2",
    "note-perc-3",
    "note-bass",
    "note-bass",
    "note-bass",
    "note-bass",
    "note-bass",
    "note-mel",
    "note-mel",
    "note-mel",
    "note-mel",
    "note-mel"
);

var imgNoteHover = Array(
    "note-perc-1-hover",
    "note-perc-2-hover",
    "note-perc-3-hover",
    "note-bass-hover",
    "note-bass-hover",
    "note-bass-hover",
    "note-bass-hover",
    "note-bass-hover",
    "note-mel-hover",
    "note-mel-hover",
    "note-mel-hover",
    "note-mel-hover",
    "note-mel-hover"
);

var imgNoteColHover = Array(
    "note-perc-1-col-hover",
    "note-perc-2-col-hover",
    "note-perc-3-col-hover",
    "note-bass-col-hover",
    "note-bass-col-hover",
    "note-bass-col-hover",
    "note-bass-col-hover",
    "note-bass-col-hover",
    "note-mel-col-hover",
    "note-mel-col-hover",
    "note-mel-col-hover",
    "note-mel-col-hover",
    "note-mel-col-hover"
);

var soundPath = "mp3-hifi/";
var soundType = "mp3";

function singleSoundFiles(prefix) {
    var array = Array();
    for (var i = 1; i <= 13; i++) {
        array.push([prefix + "-" + i + "." + soundType]);
    }
    return array;
}

function doubleSoundFiles(prefix) {
    var array = Array();
    for (var i = 1; i <= 13; i++) {
        array.push([
            prefix + "-" + i + "-a." + soundType,
            prefix + "-" + i + "-b." + soundType
        ]);
    }
    return array;
}

var bzztSoundFile = "bzzt." + soundType;