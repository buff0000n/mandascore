

imgGrid = Array(
    "measure-1",
    "measure-2",
    "measure-3",
    "measure-4"
);

imgNote = Array(
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

imgNoteHover = Array(
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

imgNoteColHover = Array(
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


class MeasureSectionMetaData {
    constructor(rowStart, rowStop, maxNotes, selectColor) {
        this.rowStart = rowStart;
        this.rowStop = rowStop;
        this.maxNotes = maxNotes;
        this.selectColor = selectColor;
    }
}

var measureSections = {
    "all": new MeasureSectionMetaData(0, 12, 0, "#ffffff"),
    "perc": new MeasureSectionMetaData(0, 2, 24, "#ffffff"),
    "bass": new MeasureSectionMetaData(3, 7, 16, "#1fb5ff"),
    "mel": new MeasureSectionMetaData(8, 12, 16, "#e601ff")
}

function measureMouseover() {
    var e = window.event;
    var measure = e.currentTarget.measure;
    measure.doMouseover();
    measureMousemove();
}

function measureMousedown() {
    measureMouseEvent(true);
}

function measureMousemove() {
    measureMouseEvent(false);
}

function measureMouseEvent(click=false) {
    var e = window.event;
    e.preventDefault();
    var measure = e.currentTarget.measure;
    var targetRect = e.target.getBoundingClientRect();
    var x = Math.round(e.clientX - targetRect.left);
    var y = Math.round(e.clientY - targetRect.top);
    var down = e.buttons != 0;
    measure.doMousemove(x, y, down, click);
}

function measureMouseout() {
    var e = window.event;
    e.preventDefault();
    var measure = e.currentTarget.measure;
    measure.doMouseout();
}

function keyDown(e) {
    e = e || window.event;
    switch (e.code) {
		case "Escape" :
		    clearMenu();
		    break;
		case "Space" :
		    score.togglePlaying();
		    break;
		case "KeyZ" :
            // ctrlKey on Windows, metaKey on Mac
            if (e.ctrlKey || e.metaKey) {
                if (e.shiftKey) {
                    // ctrl/meta + shift + Z: redo
                    doRedo();
                } else {
                    // ctrl/meta + Z: undo
                    doUndo();
                }
            }
			break;
		case "KeyY" :
            // ctrlKey on Windows, metaKey on Mac
            if (e.ctrlKey || e.metaKey) {
                // ctrl/meta + Y: redo
                doRedo();
            }
		    break;
	}
}

function createNoteImage(baseName) {
        img = document.createElement("img");
        img.src = "img/" + baseName + ".png";
        img.srcset = "img2x/" + baseName + ".png 2x";
        img.baseName = baseName;
        return img;
}

function selectSection(sectionButton, section) {
    var div = getParent(sectionButton, "menu");
    div.callback(div.button, section);
    clearMenus();
}

function runSectionMenu(title, button, callback) {
    clearMenus();
    var div = document.createElement("div");
    div.className = "menu";
    div.button = button;
    div.callback = callback

    div.innerHTML = `
        <input class="button allButton" type="submit" value="All" onClick="selectSection(this, 'all')"/>
        <input class="button melButton" type="submit" value="Melody" onClick="selectSection(this, 'mel')"/>
        <input class="button bassButton" type="submit" value="Bass" onClick="selectSection(this, 'bass')"/>
        <input class="button percButton" type="submit" value="Percussion" onClick="selectSection(this, 'perc')"/>
    `;

    showMenu(div, getParent(button, "scoreButtonRow"), button);
}

function playButton(button) {
    getParent(button, "scoreButtonContainer").score.play();
}

function copyButton(button) {
    runSectionMenu("Copy", button, doCopy);
}

function doCopy(button, section) {
    getParent(button, "scoreButtonContainer").score.copy(section);
}

function pasteButton(button) {
    getParent(button, "scoreButtonContainer").score.paste();
}

function clearButton(button) {
    runSectionMenu("Clear", button, doClear);
}

function doClear(button, section) {
    getParent(button, "scoreButtonContainer").score.clear(section);
}

class Note {
    constructor(measure, time, row) {
        this.measure = measure;
        this.time = time;
        this.row = row;
        this.enabled = false;
        this.hover = false;
        this.timeHover = false;
        this.img = null;
    }

    setImg(baseName) {
        if (baseName == null) {
            if (this.img != null) {
                this.measure.removeImage(this.img);
                this.img = null;
            }
            return;
        }

        if (this.img != null) {
            if (this.img.baseName == baseName) {
                return;
            }
            // todo: modify in place?
            this.measure.removeImage(this.img);
            this.img = null;
        }

        this.img = createNoteImage(baseName);
        this.measure.addImage(this.img, this.time, this.row);
    }

    updateState() {
        if (this.enabled) {
            this.setImg(imgNote[this.row]);

        } else if (this.hover) {
            this.setImg(imgNoteHover[this.row]);

        } else if (this.timeHover) {
            this.setImg(imgNoteColHover[this.row]);

        } else {
            this.setImg(null);
        }
    }

    toggleEnabled() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        this.updateState();
    }

    setHover(hover) {
        this.hover = hover;
        this.updateState();
    }

    setTimeHover(timeHover) {
        this.timeHover = timeHover;
        this.updateState();
    }
}

class Measure {
    constructor(score, number) {
        this.score = score;
        this.number = number;

        this.noteSpacingX = 4;
        this.noteSpacingY = 1;
        this.noteOffsetX = 2;
        this.noteOffsetY = 0;
        this.noteSizeX = 18;
        this.noteSizeY = 24;

        this.gridSizeX = this.noteSpacingX + this.noteSizeX;
        this.gridSizeY = this.noteSpacingY + this.noteSizeY;

        this.container = document.createElement("div");
        this.container.measure = this;
        this.container.className = "measureContainer";

        this.buttons = this.buildButtons();
        this.container.appendChild(this.buttons);

        this.imgContainer = document.createElement("div");
        this.imgContainer.measure = this;
        this.imgContainer.className = "measureImgContainer";
        this.imgContainer.style.width = (this.gridSizeX * 16) + "px";
        this.imgContainer.style.height = (this.gridSizeY * 13) + "px";
        this.container.appendChild(this.imgContainer);

        this.gridImg = createNoteImage(imgGrid[this.number]);
        this.gridImg.measure = this;
        this.gridImg.className = "measureImg";
        this.gridImg.style.left = 0;
        this.gridImg.style.top = 0;
        this.gridImg.onmouseover = measureMouseover;
        this.gridImg.onmousemove = measureMousemove;
        this.gridImg.onmousedown = measureMousedown;
//        this.gridImg.onmousedrag = measureMousedrag;
        this.gridImg.onmouseout = measureMouseout;

        this.selectSection = null;
        this.selectBox = null;

        this.imgContainer.appendChild(this.gridImg);

        this.hovering = false;
        this.hoveredTime = -1;
        this.hoveredRow = -1;

        this.notes = Array(16);
        for (var t = 0; t < this.notes.length; t++) {
            this.notes[t] = new Array(13);
            for (var r = 0; r < this.notes[t].length; r++) {
                this.notes[t][r] = new Note(this, t, r);
            }
        }
    }

    buildButtons() {
        var div = document.createElement("div");
        div.className = "scoreButtonContainer";
        div.score = this;

        div.innerHTML = `
            <div class="scoreButtonRow">
                <input class="button clearButton" type="submit" value="Clear" onClick="clearButton(this)"/>
                <input class="button copyButton" type="submit" value="Copy" onClick="copyButton(this)"/>
                <input class="button pasteButton" type="submit" value="Paste" disabled onClick="pasteButton(this)"/>
                <input class="button playButton" type="submit" value="Play" onClick="playButton(this)"/>
            </div>
        `;

        return div;
    }

    removeImage(img) {
        img.remove();
    }

    addImage(img, time, row) {
        img.className = "measureImg";
        img.style.left = this.noteOffsetX + (this.gridSizeX * time);
        img.style.top = this.noteOffsetY + (this.gridSizeY * row);
//        img.style.zIndex = "10";
        img.style.pointerEvents = "none";
        this.imgContainer.appendChild(img);
    }

    getRow(y) {
        var row = Math.floor(y / this.gridSizeY);
        return row < 0 || row > 13 ? -1 : row;
    }

    getTime(x) {
        var time = Math.floor(x / this.gridSizeX);
        return time < 0 || time > 15 ? -1 : time;
    }

    doMouseover() {
        this.hovering = true;
    }

    doMousemove(x, y, down=false, click=false) {
        if (!this.hovering) {
            return;
        }

        var time = this.getTime(x);
        var row = this.getRow(y);
        this.hover(time, row, down, click);
    }

    doMouseout() {
        this.hovering = false;
        this.hover(-2, -2);
    }

    hover(time, row, down=false, click=false) {
        if (this.hoveredTime != -1 && (time != this.hoveredTime || row < 0)) {
            for (var r = 0; r < 13; r++) {
                this.notes[this.hoveredTime][r].setTimeHover(false);
            }
            this.notes[this.hoveredTime][this.hoveredRow].setHover(false);

        } else if (this.hoveredRow != -1 && (row != this.hoveredRow || time < 0)) {
            this.notes[this.hoveredTime][this.hoveredRow].setHover(false);
        }

        if (time >= 0 && row >= 0) {
            this.notes[time][row].setHover(true);
            for (var r = 0; r < 13; r++) {
                this.notes[time][r].setTimeHover(true);
            }

            if (click || (down && (this.hoveredRow != row || this.hoveredTime != time))) {

                if (this.selectSection != null
                    && row >= measureSections[this.selectSection].rowStart
                    && row <= measureSections[this.selectSection].rowStop) {
                        this.clearSelection();
                }

                if (this.notes[time][row].toggleEnabled()) {
                    this.score.soundPlayer.playSound(row);
                }
            }

            this.hoveredTime = time;
            this.hoveredRow = row;

        } else {
            this.hoveredTime = -1;
            this.hoveredRow = -1;
        }
    }

    clear(section="all") {
        if (this.selectSection == section || section == "all") {
            this.clearSelection();
        }
        for (var t = 0; t < this.notes.length; t++) {
            for (var r = measureSections[section].rowStart; r <= measureSections[section].rowStop; r++) {
                this.notes[t][r].setEnabled(false);
            }
        }
    }

    clearSelection() {
        if (this.selectSection != null) {
            this.selectSection = null;
            this.selectBox.remove();
            this.selectBox = null;
            this.score.setSelectedMeasure(null);
        }
    }

    copy(section) {
        this.clearSelection();
        this.score.setSelectedMeasure(this);
        this.selectSection = section;
        if (section != null) {
            this.selectBox = document.createElement("div");
            this.selectBox.measure = this;
            this.selectBox.className = "measureSelectBox-" + section;
            this.selectBox.style.width = ((this.gridSizeX * 16) - 8) + "px";
            this.selectBox.style.height = ((this.gridSizeY * (measureSections[section].rowStop - measureSections[section].rowStart + 1)) - 8) + "px";
            this.selectBox.style.left = 0;
            this.selectBox.style.top = this.gridSizeY * measureSections[section].rowStart;

            this.imgContainer.appendChild(this.selectBox);
        }
    }

    setPasteEnabled(enabled) {
        getFirstChild(this.buttons, "pasteButton").disabled = !enabled;
    }

    paste() {
        var fromMeasure = this.score.selectedMeasure;
        if (fromMeasure == null || fromMeasure == this) return;

        for (var t = 0; t < this.notes.length; t++) {
            for (var r = measureSections[fromMeasure.selectSection].rowStart; r <= measureSections[fromMeasure.selectSection].rowStop; r++) {
                this.notes[t][r].setEnabled(fromMeasure.notes[t][r].enabled);
            }
        }
    }

    play() {
    }
}




class Score {
    constructor() {
        this.buttons = this.buildButtons();

        this.measures = Array();
        // build the four measures
        for (var m = 0; m < 4; m++) {
            var measure = new Measure(this, m);
            this.measures.push(measure);
        }

        this.container = document.createElement("div");

        // split into two blocks so that making the window smaller doesn't put three on one line and one on the next
        var block1 = document.createElement("div");
        block1.className = "measureBlock";
        block1.appendChild(this.measures[0].container);
        block1.appendChild(this.measures[1].container);
        this.container.appendChild(block1)

        var block2 = document.createElement("div");
        block2.className = "measureBlock";
        block2.appendChild(this.measures[2].container);
        block2.appendChild(this.measures[3].container);
        this.container.appendChild(block2)

        this.soundPlayer = new SoundPlayer();
        this.soundPlayer.setPercSource("alpha");
        this.soundPlayer.setBassSource("alpha");
        this.soundPlayer.setMelSource("alpha");

        this.selectedMeasure = null;
    }

    buildButtons() {
        var div = document.createElement("div");
        div.className = "scoreButtonContainer";
        div.score = this;

        div.innerHTML = `
            <div class="scoreButtonRow">
                <input class="button clearButton" type="submit" value="Clear" onClick="clearButton(this)"/>
                <input class="button playButton" type="submit" value="Play" onClick="playButton(this)"/>
            </div>
        `;

        return div;
    }

    setSelectedMeasure(measure) {
        if (this.selectedMeasure != null && this.selectedMeasure != measure) {
            var t = this.selectedMeasure;
            this.selectedMeasure = null;
            t.clearSelection();
            for (var m = 0; m < 4; m++) {
                this.measures[m].setPasteEnabled(false);
            }
        }

        if (measure != null) {
            this.selectedMeasure = measure;
            for (var m = 0; m < 4; m++) {
                if (this.measures[m] != measure) {
                    this.measures[m].setPasteEnabled(true);
                }
            }
        }
    }

    clear(section) {
        for (var m = 0; m < 4; m++) {
            this.measures[m].clear(section);
        }
    }

    play() {
    }
}

var score;

function buildScore(container) {
    score = new Score();
    container.appendChild(score.buttons);
    container.appendChild(score.container);
}
