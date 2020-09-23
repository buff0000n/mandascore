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
    nodeName = e.target.nodeName;

    if (nodeName == "TEXTAREA" || nodeName == "INPUT") {
        return;
    }

    switch (e.code) {
		case "Escape" :
		    clearMenu();
		    break;
		case "Space" :
            e.preventDefault();
		    score.togglePlaying();
		    break;
		case "KeyZ" :
            // ctrlKey on Windows, metaKey on Mac
            if (e.ctrlKey || e.metaKey) {
                if (e.shiftKey) {
                    // ctrl/meta + shift + Z: redo
                    e.preventDefault();
                    doRedo();
                } else {
                    // ctrl/meta + Z: undo
                    e.preventDefault();
                    doUndo();
                }
            }
			break;
		case "KeyY" :
            // ctrlKey on Windows, metaKey on Mac
            if (e.ctrlKey || e.metaKey) {
                // ctrl/meta + Y: redo
                e.preventDefault();
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
    sectionButton.blur();
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

    var html = "";
    for (var name in sectionMetaData) {
        var m = sectionMetaData[name];
        html += `<input class="button ${m.name}Button" type="submit" value="${m.displayName}" onClick="selectSection(this, '${m.name}')" style="color: ${m.color}"/>`;
    }
    div.innerHTML = html;

    showMenu(div, getParent(button, "scoreButtonRow"), button);
}

function playButton(button) {
    button.blur();
    getParent(button, "scoreButtonContainer").score.play();
}

function copyButton(button) {
    button.blur();
    runSectionMenu("Copy", button, doCopy);
}

function doCopy(button, section) {
    getParent(button, "scoreButtonContainer").score.copy(section);
}

function pasteButton(button) {
    button.blur();
    getParent(button, "scoreButtonContainer").score.paste();
}

function clearButton(button) {
    button.blur();
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

    setEnabled(enabled, action=true) {
        if (this.enabled != enabled) {
            this.enabled = enabled;
            this.updateState();
            this.measure.noteChanged(this);
            if (action) {
                this.measure.score.startActions();
                this.measure.score.addAction(new NoteAction(this, this.enabled));
                this.measure.score.endActions();
            }
        }
    }

    setHover(hover) {
        this.hover = hover;
        this.updateState();
    }

    setTimeHover(timeHover) {
        this.timeHover = timeHover;
        this.updateState();
    }

    toString() {
        return this.time + ", " + this.row + " in " + this.measure.toString();
    }
}

class NoteAction extends Action {
    constructor(note, enabled) {
        super();
        this.note = note;
        this.enabled = enabled;
    }

	undoAction() {
	    this.note.setEnabled(!this.enabled, false);
	}

	redoAction() {
	    this.note.setEnabled(this.enabled, false);
	}

	toString() {
	    return (this.enabled? "Enable " : "Disable ") + " note " + this.note.toString();
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

        this.sectionCount = {};
        for (var section in sectionMetaData) {
            if (!sectionMetaData[section].all) {
                this.sectionCount[section] = 0;
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

    getSection(row) {
        for (var section in sectionMetaData) {
            var m = sectionMetaData[section];
            if (!m.all && row >= m.rowStart && row <= m.rowStop) return section;
        }
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
                var note = this.notes[time][row];
                var section = this.getSection(row);
                if (note.enabled) {
                    note.setEnabled(false);

                } else if (this.sectionCount[section] >= sectionMetaData[section].maxNotes) {
                    this.score.soundPlayer.playBzzt();

                } else {
                    note.setEnabled(true);
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
        this.score.startActions();
        if (this.selectSection == section || section == "all") {
            this.clearSelection();
        }
        for (var t = 0; t < this.notes.length; t++) {
            for (var r = sectionMetaData[section].rowStart; r <= sectionMetaData[section].rowStop; r++) {
                this.notes[t][r].setEnabled(false);
            }
        }
        this.score.endActions();
    }

    noteChanged(note) {
        if (this.selectSection != null
            && note.row >= sectionMetaData[this.selectSection].rowStart
            && note.row <= sectionMetaData[this.selectSection].rowStop) {
                this.clearSelection();
        }

        var section = this.getSection(note.row);
        if (note.enabled) {
            this.sectionCount[section]++;
        } else {
            this.sectionCount[section]--;
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
            this.selectBox.className = "measureSelectBox";
            this.selectBox.style.borderColor = sectionMetaData[section].color;
            this.selectBox.style.width = ((this.gridSizeX * 16) - 8) + "px";
            this.selectBox.style.height = ((this.gridSizeY * (sectionMetaData[section].rowStop - sectionMetaData[section].rowStart + 1)) - 8) + "px";
            this.selectBox.style.left = 0;
            this.selectBox.style.top = this.gridSizeY * sectionMetaData[section].rowStart;

            this.imgContainer.appendChild(this.selectBox);
        }
    }

    setPasteEnabled(enabled) {
        getFirstChild(this.buttons, "pasteButton").disabled = !enabled;
    }

    paste() {
        var fromMeasure = this.score.selectedMeasure;
        if (fromMeasure == null || fromMeasure == this) return;

        this.score.startActions();
        for (var t = 0; t < this.notes.length; t++) {
            for (var r = sectionMetaData[fromMeasure.selectSection].rowStart; r <= sectionMetaData[fromMeasure.selectSection].rowStop; r++) {
                this.notes[t][r].setEnabled(fromMeasure.notes[t][r].enabled);
            }
        }
        this.score.endActions();
    }

    play() {
    }

    toString() {
        return "measure " + (this.number + 1);
    }
}

function sectionToggle() {
    var e = window.event;
    var target = e.currentTarget;
    var editor = getParent(target, "sectionRow").editor;
    editor.setEnabled(target.checked);
    target.blur();
}

function sectionPack() {
    var e = window.event;
    var target = e.currentTarget;
    var editor = getParent(target, "sectionRow").editor;
    editor.setPack(target.value);
    target.blur();
}

function sectionVolume() {
    var e = window.event;
    var target = e.currentTarget;
    var editor = getParent(target, "sectionRow").editor;
    editor.setVolume(target.value / 100);
    target.blur();
}

class SectionEditor {
    constructor(score, section) {
        this.score = score;
        this.section = section;
        this.volume = 1.0;
        this.pack = "";

        this.container = document.createElement("tr");
        this.container.className = "sectionRow";
        this.container.editor = this;

        var html = `
            <td><input class="button sectionEnable" type="checkbox" checked onchange="sectionToggle()"/></td>
            <td><span>${sectionMetaData[section].displayName}</span></td>
            <td><select class="button sectionPack" onchange="sectionPack()">`;

        for (var i = 0; i < packs.length; i++) {
            html += `<option value="${packs[i].name}">${packs[i].displayName}</option>`;
        }

        html += `
            </select></td>
            <td><input class="sectionVolume" type="range" min="0" max="100" value="100" onchange="sectionVolume()"/></td>
        `;

        this.container.innerHTML = html;
    }

    setEnabled(enabled) {
        this.score.soundPlayer.setEnabled(this.section, enabled);
    }

    setVolume(volume, action=true) {
        if (action) {
            this.score.startActions();
            this.score.addAction(new setVolumeAction(this, this.volume, volume));
            this.score.endActions();
        } else {
            getFirstChild(this.container, "sectionVolume").value = volume * 100;
        }
        this.volume = volume;
        this.score.soundPlayer.setVolume(this.section, this.volume);
    }

    setPack(pack, action=true) {
        if (action) {
            this.score.startActions();
            this.score.addAction(new setPackAction(this, this.pack, pack));
            this.score.endActions();
        } else {
            getFirstChild(this.container, "sectionPack").value = pack;
        }
        this.pack = pack;
        this.score.soundPlayer.setSource(this.section, this.pack);
    }
}

class setVolumeAction extends Action {
    constructor(editor, oldVolume, newVolume) {
        super();
        this.editor = editor;
        this.oldVolume = oldVolume;
        this.newVolume = newVolume;
    }
    
	undoAction() {
	    this.editor.setVolume(this.oldVolume, false);
	}

	redoAction() {
	    this.editor.setVolume(this.newVolume, false);
	}

	toString() {
	    return "Set " + this.editor.section + " volume to " + this.newVolume;
	}
}

class setPackAction extends Action {
    constructor(editor, oldPack, newPack) {
        super();
        this.editor = editor;
        this.oldPack = oldPack;
        this.newPack = newPack;
    }
    
	undoAction() {
	    this.editor.setPack(this.oldPack, false);
	}

	redoAction() {
	    this.editor.setPack(this.newPack, false);
	}

	toString() {
	    return "Set " + this.editor.section + " pack to " + this.newPack;
	}
}

function titleChanged() {
    var e = window.event;
    var target = e.currentTarget;
    var score = getParent(target, "songTitleDiv").score;
    score.setTitle(target.value);
}

class Score {
    constructor() {
        this.container = document.createElement("div");
        
        this.buttons = this.buildButtons();
        this.container.appendChild(this.buttons);

        this.titleContainer = this.buildTitleEditor();
        this.container.appendChild(this.titleContainer);
        this.title = "";

        this.sections = {};

        var sectionContainer = document.createElement("div");
        var sectionTable = document.createElement("table");
        sectionTable.style.display = "inline-block";

        for (var name in sectionMetaData) {
            if (sectionMetaData[name].all) continue;
            var section = new SectionEditor (this, name);
            this.sections[name] = section;
            sectionTable.appendChild(section.container);
        }

        sectionContainer.appendChild(sectionTable);
        this.container.appendChild(sectionContainer);

        this.measures = Array();
        // build the four measures
        for (var m = 0; m < 4; m++) {
            var measure = new Measure(this, m);
            this.measures.push(measure);
        }

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
//        this.soundPlayer.setSource("perc", "alpha");
//        this.soundPlayer.setSource("bass", "alpha");
//        this.soundPlayer.setSource("mel", "alpha");

        this.selectedMeasure = null;
        this.actionCount = 0;
        this.actions = null;
    }

    initBlank() {
        for (var section in this.sections) {
            this.sections[section].setPack("adau", false);
            this.sections[section].setVolume(1.0, false);
        }
    }

    buildButtons() {
        var div = document.createElement("div");
        div.className = "scoreButtonContainer";
        div.score = this;

        div.innerHTML = `
            <div class="scoreButtonRow">
                <input id="undoButton" class="button undoButton" type="submit" disabled value="Undo" onClick="doUndo()"/>
                <input id="redoButton" class="button redoButton" type="submit" disabled value="Redo" onClick="doRedo()"/>
                <input class="button clearButton" type="submit" value="Clear" onClick="clearButton(this)"/>
                <input class="button playButton" type="submit" value="Play" onClick="playButton(this)"/>
            </div>
        `;

        return div;
    }

    buildTitleEditor() {
        var titleContainer = document.createElement("div")
        titleContainer.className = "songTitleDiv"
        titleContainer.score = this;
        titleContainer.innerHTML = `
            <div class="tooltip">
                <span class="label">Song Title:</span>
                <input class="songTitle" type="text" size="50" onchange="titleChanged()"/>
                <span class="tooltiptextbottom">Give your song a name</span>
            </div>
        `;
        return titleContainer;
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
        this.startActions();
        for (var m = 0; m < 4; m++) {
            this.measures[m].clear(section);
        }
        this.endActions();
    }

    setTitle(title, action=true) {
        if (action) {
            this.startActions();
            this.addAction(new setTitleAction(this, this.title, title));
            this.endActions();
        } else {
            getFirstChild(this.titleContainer, "songTitle").value = title;
        }
        this.title = title;
    }

    startActions() {
        this.actionCount++;
        if (this.actionCount == 1) {
            this.actions = Array();
        }
    }

    addAction(action) {
        this.actions.push(action);
    }

    endActions() {
        this.actionCount--;
        if (this.actionCount == 0) {
            if (this.actions.length == 1) {
                addUndoAction(this.actions[0]);

            } else if (this.actions.length > 1) {
                addUndoAction(new CompositeAction(this.actions));
            }
        }
    }

    play() {
    }
}

class setTitleAction extends Action {
    constructor(score, oldTitle, newTitle) {
        super();
        this.score = score;
        this.oldTitle = oldTitle;
        this.newTitle = newTitle;
    }
    
	undoAction() {
	    this.score.setTitle(this.oldTitle, false);
	}

	redoAction() {
	    this.score.setTitle(this.newTitle, false);
	}

	toString() {
	    return "Set title to " + this.newTitle;
	}
}

var score;

function buildScore(container) {
    score = new Score();
    container.appendChild(score.container);
    score.initBlank();
}
