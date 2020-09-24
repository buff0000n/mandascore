var noteSpacingX = 4;
var noteSpacingY = 1;
var noteOffsetX = 2;
var noteOffsetY = 0;
var noteSizeX = 18;
var noteSizeY = 24;

var gridSizeX = noteSpacingX + noteSizeX;
var gridSizeY = noteSpacingY + noteSizeY;

sectionImages = {
    "all": "note-perc-1",
    "perc": "note-perc-3",
    "bass": "note-bass",
    "mel": "note-mel",
};

var imgGrid = Array(
    "measure-1",
    "measure-2",
    "measure-3",
    "measure-4"
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

var soundPath = "sound/";

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
);

var bzztSoundFile = "bzzt2.ogg";