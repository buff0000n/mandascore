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
    "all": "perc-3",
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

var soundFileSuffixes = Array(
    "-1." + soundType,
    "-2." + soundType,
    "-3." + soundType,
    "-4." + soundType,
    "-5." + soundType,
    "-6." + soundType,
    "-7." + soundType,
    "-8." + soundType,
    "-9." + soundType,
    "-10." + soundType,
    "-11." + soundType,
    "-12." + soundType,
    "-13." + soundType
);

var bzztSoundFile = "bzzt." + soundType;