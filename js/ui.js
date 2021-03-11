var stopKills = true;

var score;

function buildScore(container) {
    // create a new score model and UI
    score = new Score();
    // put it in the container
    container.appendChild(score.container);
    // initialize a blank song with default packs selected
    score.initBlank();
}

function measureMouseover() {
    // forward a mouseover event to the measure's handler
    var e = window.event;
    var measure = e.currentTarget.measure;
    measure.doMouseover();
    // also consider this a mouse move event
    measureMousemove();
}

function measureMousedown() {
    measureMouseEvent(true);
}

function measureMousemove() {
    measureMouseEvent(false);
}

function measureMouseEvent(click=false) {
    // get the event and prevent default handling
    var e = window.event;
    e.preventDefault();
    // get the target measure
    var measure = e.currentTarget.measure;
    // surprisingly hard to get the coordinates of the event in the target elements coordinate space
    var targetRect = e.target.getBoundingClientRect();
    var x = Math.round(e.clientX - targetRect.left);
    var y = Math.round(e.clientY - targetRect.top);
    // see if it's a drag event
    var down = e.buttons != 0;
    // call the measure's handler
    measure.doMousemove(x, y, down, click);
}

function measureMouseout() {
    // forward a mouseout event to the measure's handler
    var e = window.event;
    e.preventDefault();
    var measure = e.currentTarget.measure;
    measure.doMouseout();
}

function keyDown(e) {
    e = e || window.event;
    nodeName = e.target.nodeName;

    // ignote typing in a text box
    if (nodeName == "TEXTAREA" || nodeName == "INPUT") {
        return;
    }

    switch (e.code) {
		case "Escape" :
		    // clear any open menus on escape
		    clearMenu();
		    break;
		case "Space" :
		    // on space either start the full song playing or pause/resume whatever was already playing
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

function createNoteImagePath(baseName, hidpi=false) {
    // build the image path for regular and hidpi images
    return (hidpi ? "img2x/" : "img/") + baseName + ".png";
}

function createNoteImage(baseName) {
    // create an image with the right src and hidpi src
    img = document.createElement("img");
    img.src = createNoteImagePath(baseName, false);
    img.srcset = createNoteImagePath(baseName, true) + " 2x";
    img.baseName = baseName;
    return img;
}

function runSectionMenu(title, button, callback) {
    // clear all menus
    clearMenus();
    // create a div and set some properties
    var div = document.createElement("div");
    div.className = "menu";
    div.button = button;
    div.callback = callback

    // build the section menu out of buttons
    var html = "";
    for (var name in sectionMetaData) {
        var m = sectionMetaData[name];
        html += `<input class="button ${m.name}Button" type="submit" value="${m.displayName}" onClick="selectSection(this, '${m.name}')" style="color: ${m.color}"/>`;
    }
    div.innerHTML = html;

    // put the menu in the clicked button's parent and anchor it to button
    showMenu(div, getParent(button, "scoreButtonRow"), button);
}

function selectSection(sectionButton, section) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    sectionButton.blur();
    // get the callback and call it
    var div = getParent(sectionButton, "menu");
    div.callback(div.button, section);
    // clear all menus
    clearMenus();
}

function runPngMenu(button) {
    // clear all menus
    clearMenus();
    // create the menu div and set some props
    var div = document.createElement("div");
    div.className = "menu";
    div.button = button;

    // add the container div with some default content
    var html = `<div class="pngLinkDiv">...</div>`;
    div.innerHTML = html;

    // show it like a menu, but it's just a popup
    showMenu(div, button.parentElement, button);

    // get the container div
    var linkDiv = getFirstChild(div, "pngLinkDiv");

    // kick off the png generation in the background
    score.generatePng(linkDiv);
}

function playButton(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // play either the single measure or the whole song, depending on what object is saved on the button's container
    getParent(button, "scoreButtonContainer").score.play(button);
}

function copyButton(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // get the associated measure
    var measure = getParent(button, "scoreButtonContainer").score;
    // clicking copy on a measure that already has something selected will clear the selection
    if (measure.hasSelection()) {
        measure.clearSelection();
    } else {
        // otherwise we need to show the section menu and ask which section to copy
        runSectionMenu("Copy", button, doCopy);
    }
}

function doCopy(button, section) {
    // get the associated measure and set its selection to the given section
    getParent(button, "scoreButtonContainer").score.copy(section);
}

function pasteButton(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // get the associated measure and paste the selected section from another measure
    getParent(button, "scoreButtonContainer").score.paste();
}

function clearButton(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // show the section menu and ask which section to clear
    runSectionMenu("Clear", button, doClear);
}

function doClear(button, section) {
    // get the associated measure and clear the given section
    getParent(button, "scoreButtonContainer").score.clear(section);
}

// object for tracking the state of an individual node.  There will be 64*13 of these.
class Note {
    constructor(measure, time, row) {
        // identify the note
        this.measure = measure;
        this.time = time;
        this.row = row;

        // note state
        this.enabled = false;
        this.hover = false;
        this.timeHover = false;

        // displayed note image, if any
        this.img = null;
        this.baseName = null;
    }

    setImg(baseName) {
        if (baseName == null) {
            // clear the note image
            if (this.img != null) {
                this.img.remove();
                this.img = null;
            }
            return;
        }

        if (this.img != null) {
            // note image hasn't changed, ignore
            if (this.img.baseName == baseName) {
                return;
            }
            // todo: modify in place?
            // remove the note image so we can add another one
            this.img.remove();
            this.img = null;
        }

        // create the nore image
        this.img = createNoteImage(baseName);
        // let the measure add it in the right place
        this.measure.addImage(this.img, this.time, this.row);
    }

    updateState() {
        if (this.enabled) {
            // if the note is enabled then that image takes precedence
            this.setImg(imgNote[this.row]);

        } else if (this.hover) {
            // if the note has the mouse hovering over it then that's the next precedence
            this.setImg(imgNoteHover[this.row]);

        } else if (this.timeHover) {
            // if the mouse is hovering over the same time column as the note then that's the last precedence
            this.setImg(imgNoteColHover[this.row]);

        } else {
            // otherwise there's note image to display
            this.setImg(null);
        }
    }

    toggleEnabled() {
        // convenience to toggle the enabled state
        this.setEnabled(!this.enabled);
        return this.enabled;
    }

    setEnabled(enabled, action=true) {
        // check if this is a state change
        if (this.enabled != enabled) {
            // update the state and image
            this.enabled = enabled;
            this.updateState();
            // notify the measure
            this.measure.noteChanged(this);
            // add an undo action if this isn't already an undo aaction
            if (action) {
                this.measure.score.startActions();
                this.measure.score.addAction(new NoteAction(this, this.enabled));
                this.measure.score.endActions();
            }
        }
    }

    setHover(hover) {
        // update the state and image
        this.hover = hover;
        this.updateState();
    }

    setTimeHover(timeHover) {
        // update the state and image
        this.timeHover = timeHover;
        this.updateState();
    }

    bounce() {
        // well this sucks, the only way to retrigger a CSS animation is to recreate the element.
        // todo: firefox does not seem to like this sometimes
        // clone the image
        var img2 = this.img.cloneNode();
        // add the animation class
        img2.classList.add("playNote");
        // remove the old image and add the new one
        this.img.remove();
        this.img = img2;
        this.measure.addImage(this.img, this.time, this.row);
    }

    toString() {
        return this.time + ", " + this.row + " in " + this.measure.toString();
    }
}

// pretty straightforward undo action for enabling/disabling a note
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

// object for handling the state/display of a measure, there will be four of these
class Measure {
    constructor(score, number) {
        // idenitify this measure
        this.score = score;
        this.number = number;

        // UI building factored out to a method because it's huge
        this.buildUI();

        // initialize the note array, 16x23 notes
        this.notes = Array(16);
        for (var t = 0; t < this.notes.length; t++) {
            this.notes[t] = new Array(13);
            for (var r = 0; r < this.notes[t].length; r++) {
                this.notes[t][r] = new Note(this, t, r);
            }
        }

        // initialize the section note counts, so we can know when we exceed the note limits
        this.sectionCount = {};
        for (var section in sectionMetaData) {
            if (!sectionMetaData[section].all) {
                this.sectionCount[section] = 0;
            }
        }

        // selection state
        this.selectSection = null;
        this.selectBox = null;

        // mouse state
        this.hovering = false;
        this.hoveredTime = -1;
        this.hoveredRow = -1;
        
        // playback state
        this.playbackTime = -1;
        this.playbackBox = null;
    }

    buildUI() {
        // top level container
        this.container = document.createElement("div");
        this.container.className = "measureContainer";
        // back-reference
        this.container.measure = this;

        // button container
        this.buttons = document.createElement("div");
        this.buttons.className = "scoreButtonContainer";
        // back-reference
        this.buttons.score = this;
        // build the buttons ina single row
        this.buttons.innerHTML = `
            <div class="scoreButtonRow">
                <input class="button clearButton" type="submit" value="Clear" onClick="clearButton(this)"/>
                <input class="button copyButton" type="submit" value="Copy" onClick="copyButton(this)"/>
                <input class="button pasteButton" type="submit" value="Paste" disabled onClick="pasteButton(this)"/>
                <input class="button playButton" type="submit" value="Play" onClick="playButton(this)"/>
            </div>
        `;
        this.container.appendChild(this.buttons);

        // container for the background image and all note images
        this.imgContainer = document.createElement("div");
        this.imgContainer.className = "measureImgContainer";
        // set its size to match the size of the background image
        this.imgContainer.style.width = (gridSizeX * 16) + "px";
        this.imgContainer.style.height = (gridSizeY * 13) + "px";
        // back-reference
        this.imgContainer.measure = this;
        this.container.appendChild(this.imgContainer);

        // create the background grid image
        this.gridImg = createNoteImage(imgGrid[this.number]);
        // absolute positioning
        this.gridImg.className = "measureImg";
        this.gridImg.style.left = 0;
        this.gridImg.style.top = 0;
        // we need all the mouse listeners
        this.gridImg.onmouseover = measureMouseover;
        this.gridImg.onmousemove = measureMousemove;
        this.gridImg.onmousedown = measureMousedown;
        this.gridImg.onmouseout = measureMouseout;
        // todo: which of these back-references do we actually need?
        this.gridImg.measure = this;
        this.imgContainer.appendChild(this.gridImg);
    }
    
    setMeasureNotes(mnotes) {
        // load note info from an external source
        for (var t = 0; t < 16; t++) {
            for (var r = 0; r < 13; r++) {
                // rows from the song parser are in reverse order
                this.notes[t][r].setEnabled(mnotes[t][12-r] == 1);
            }
        }
    }

    getMeasureNotes() {
        // save note info to an array of 1s and 0s
        var mnotes = Array(16);
        for (var t = 0; t < 16; t++) {
            mnotes[t] = Array(13);
            for (var r = 0; r < 13; r++) {
                // rows from the song parser are in reverse order
                mnotes[t][12-r] = this.notes[t][r].enabled ? 1 : 0;
            }
        }
        return mnotes;
    }

    addImage(img, time, row) {
        // absolutely position an image according to its grid position
        img.classList.add("measureImg");
        img.style.left = noteOffsetX + (gridSizeX * time);
        img.style.top = noteOffsetY + (gridSizeY * row);
        // let mouse events through to the container
        img.style.pointerEvents = "none";
        // add the image to the image container
        this.imgContainer.appendChild(img);
    }

    getRow(y) {
        // calculate the grid row containing the given y coordiante
        var row = Math.floor(y / gridSizeY);
        return row < 0 || row > 13 ? -1 : row;
    }

    getTime(x) {
        // calculate the grid column containing the given x coordiante
        var time = Math.floor(x / gridSizeX);
        return time < 0 || time > 15 ? -1 : time;
    }

    getSection(row) {
        // todo: make this a static method?
        // get the section containing the given row
        for (var section in sectionMetaData) {
            var m = sectionMetaData[section];
            if (!m.all && row >= m.rowStart && row <= m.rowStop) return section;
        }
    }

    doMouseover() {
        // set the hovering state
        this.hovering = true;
    }

    doMousemove(x, y, down=false, click=false) {
        // sanity check, if someone has clicked inside the container and dragged outside
        // then ignore all the events from outside the container
        if (!this.hovering) {
            return;
        }

        // get the grid coordinates
        var time = this.getTime(x);
        var row = this.getRow(y);
        // call the do everything method
        this.hover(time, row, down, click);
    }

    doMouseout() {
        // set the hovering state
        this.hovering = false;
        // call the do everything method to clear other state
        // todo: I don't remember why -2
        this.hover(-2, -2);
    }

    hover(time, row, down=false, click=false) {
        // full disclosure: this method kind of got away from me
        
        // if the hover column has moved, or if the hover row has gone off the measure,
        // then clear the hover column aand the hovered note
        if (this.hoveredTime != -1 && (time != this.hoveredTime || row < 0)) {
            for (var r = 0; r < 13; r++) {
                this.notes[this.hoveredTime][r].setTimeHover(false);
            }
            this.notes[this.hoveredTime][this.hoveredRow].setHover(false);

        // otherwise, if the just the hover row has changed or the hover column has gone off the measure
        // then clear the hovered note
        } else if (this.hoveredRow != -1 && (row != this.hoveredRow || time < 0)) {
            this.notes[this.hoveredTime][this.hoveredRow].setHover(false);
        }

        // if there is no hovering
        if (time < 0 || row < 0) {
            // clear our hover state
            this.hoveredTime = -1;
            this.hoveredRow = -1;

        // if we have a valid hover row and column
        } else {
            // set the hover state on the hovered note
            this.notes[time][row].setHover(true);
            // set the hover state on the hovered column
            for (var r = 0; r < 13; r++) {
                this.notes[time][r].setTimeHover(true);
            }

            // If there is a click, or of the mouse has dragged to a new note while pressed
            if (click || (down && (this.hoveredRow != row || this.hoveredTime != time))) {
                // get the note object and its assocaited section
                var note = this.notes[time][row];
                var section = this.getSection(row);
                // if the note is currently enabled, then just turn it off
                if (note.enabled) {
                    note.setEnabled(false);

                // if the note is currently disabled but we're at the note limit for the sectio, 
                // then play a warning sound
                } else if (this.sectionCount[section] >= sectionMetaData[section].maxNotes) {
                    this.score.soundPlayer.playBzzt();

                // otherwise, turn on the note and play its sound
                } else {
                    note.setEnabled(true);
                    this.score.soundPlayer.playSound(row);
                }
            }

            // update our hover state
            this.hoveredTime = time;
            this.hoveredRow = row;
        }
    }

    clear(section="all") {
        // contain all the note changes in a single undo action
        this.score.startActions();
        // if the section being cleared is currently selected then clear the selection
        if (this.selectSection == section || section == "all") {
            this.clearSelection();
        }
        // iterate over each note in the section and turn it off
        for (var t = 0; t < this.notes.length; t++) {
            for (var r = sectionMetaData[section].rowStart; r <= sectionMetaData[section].rowStop; r++) {
                this.notes[t][r].setEnabled(false);
            }
        }
        // commit the undo action
        this.score.endActions();
    }

    noteChanged(note) {
        // if a note in the currently selected section was changed then clear the selection
        if (this.selectSection != null
            && note.row >= sectionMetaData[this.selectSection].rowStart
            && note.row <= sectionMetaData[this.selectSection].rowStop) {
                this.clearSelection();
        }

        // get the section containing the note
        var section = this.getSection(note.row);
        if (note.enabled) {
            // if the note was turned on then increment the note count for that section
            this.sectionCount[section]++;
        } else {
            // if the note was turned off then decrement the note count for that section
            this.sectionCount[section]--;
        }
    }

    clearSelection() {
        if (this.selectSection != null) {
            // clear all selection state and UI
            this.selectSection = null;
            this.selectBox.remove();
            this.selectBox = null;
            // notify the score that the selection was cleared
            this.score.setSelectedMeasure(null);
        }
    }

    hasSelection() {
        return this.selectSection != null;
    }

    copy(section) {
        // clear any existing selection
        this.clearSelection();

        if (section != null) {
            // save section state in this measure and the score
            this.score.setSelectedMeasure(this);
            this.selectSection = section;
            // create the selection box, it's just a div with a border
            this.selectBox = document.createElement("div");
            // absolutely position it according to the section
            this.selectBox.className = "measureSelectBox";
            this.selectBox.style.width = ((gridSizeX * 16) - 8) + "px";
            this.selectBox.style.height = ((gridSizeY * (sectionMetaData[section].rowStop - sectionMetaData[section].rowStart + 1)) - 8) + "px";
            this.selectBox.style.left = 0;
            this.selectBox.style.top = gridSizeY * sectionMetaData[section].rowStart;
            // set the color based on the section
            this.selectBox.style.borderColor = sectionMetaData[section].color;
            // obligatory back-reference
            this.selectBox.measure = this;
            this.imgContainer.appendChild(this.selectBox);
        }
    }

    setPasteEnabled(enabled) {
        // get the paste button and enabled/disable based on whether something is selected for copy
        getFirstChild(this.buttons, "pasteButton").disabled = !enabled;
    }

    paste() {
        // pull the copy source from the score
        var fromMeasure = this.score.selectedMeasure;
        // sanity check
        if (fromMeasure == null || fromMeasure == this) return;

        // contain all the note changes in a single undo action
        this.score.startActions();
        // iterate over all notes in the section
        for (var t = 0; t < this.notes.length; t++) {
            for (var r = sectionMetaData[fromMeasure.selectSection].rowStart; r <= sectionMetaData[fromMeasure.selectSection].rowStop; r++) {
                // copy the enabled state from each note in the source measure
                // to the corresponding note in this measure
                this.notes[t][r].setEnabled(fromMeasure.notes[t][r].enabled);
            }
        }
        // commit the undo action
        this.score.endActions();
    }

    play(button) {
        // start playback with a single measure
        this.score.doPlayback(button, [this]);
    }

    startPlaybackMarker() {
        // initialize the playback marker to just before the start
        this.playbackTime = -0.1;

        // create the marker if it's not present
        if (this.playbackBox == null) {
            // just a thin div
            this.playbackBox = document.createElement("div");
            // absolutely positioned
            this.playbackBox.className = "playbackBox";
            this.playbackBox.style.width = "4px";
            this.playbackBox.style.height = (gridSizeY * 13) + "px";
            this.playbackBox.style.left = 0;
            this.playbackBox.style.top = 0;
            // back-reference
            this.playbackBox.measure = this;
            this.imgContainer.appendChild(this.playbackBox);
        }
    }

    setPlaybackMarkerTime(time) {
        // absolutely position the marker
        this.playbackBox.style.left = (gridSizeX * 8) * time;

        // re-initialize the playback time if it's wrapped around
        if (time < this.playbackTime) {
            this.playbackTime = -0.1;
        }

        // get the previous and current playback columns, 16 columns across a 2-second measure
        var oldT = Math.floor(this.playbackTime * 8.0);
        var newT = Math.floor(time * 8.0);

        // loop from oldT + 1 to newT, if they are the same then this loops zero times,
        // if we've moved forward one frame then this runs once
        // if we've somehow missed a few frames then this catches us up.
        for (var t = oldT + 1; t <= newT; t++) {
            for (var r = 0; r < 13; r++) {
                // only bounce the note if it's enable and its section's audio is enabled
                if (this.notes[t][r].enabled && this.score.soundPlayer.isEnabled(r)) {
                    this.notes[t][r].bounce();
                }
            }
        }

        // update state
        this.playbackTime = time;
    }

    playAudioForTime(t, delay) {
        // loop over each section
        for (var i in sectionNames) {
            var section = sectionNames[i];
            // get the name of the pack for the sectoin
            var pack = this.score.sectionPacks[section];
            // determine whether the section is mono
            var mono = this.score.isSectionMono(section);
            // get the general section metadata
            var metadata = sectionMetaData[section]
            // loop over the rows in the section
            for (var r = metadata.rowStart; r <= metadata.rowStop; r++) {
                // check for an enabled note
                if (this.notes[t][r].enabled) {
                    // play an enabled note
                    this.score.soundPlayer.playSoundLater(r, delay);
                    // if the section is mono then only play the highest enabled note.  This is how it works in game.
                    if (mono) {
                        break;
                    }
                }
            }
        }
    }

    stopPlayback() {
        // clear playback state and UI
        this.playbackTime = -1;
        this.playbackBox.remove();
        this.playbackBox = null;
    }

    draw(context, imageMap, startX, startY, scale) {
        // set the start x coordinate based on which measure this is
        startX = startX + (gridSizeX * 16) * this.number;
        // draw the background grid image for the correct measure
        context.drawImage(imageMap["m" + this.number], startX * scale, startY * scale);

        for (var t = 0; t < 16; t++) {
            for (var r = 0; r < 13; r++) {
                // if the note is enabled
                if (this.notes[t][r].enabled) {
                    // find the correct image in the map
                    var img = imageMap[r < 3 ? "np" + (r + 1) : r < 8 ? "nb" : "nm"];
                    // draw it at the right location
                    context.drawImage(
                        img,
                        (startX + noteOffsetX + (gridSizeX * t)) * scale,
                        (startY + noteOffsetY + (gridSizeY * r)) * scale
                    );
                }
            }
        }
    }

    toString() {
        return "measure " + (this.number + 1);
    }
}

function sectionToggle() {
    // get the parent editor
    var e = window.event;
    var target = e.currentTarget;
    var editor = getParent(target, "sectionRow").editor;
    // enable or disable that section's audio
    editor.setEnabled(target.checked);
    // chrome is doing strange things with clicked buttons so just unfocus it
    target.blur();
}

function sectionPack() {
    // get the parent editor
    var e = window.event;
    var target = e.currentTarget;
    var editor = getParent(target, "sectionRow").editor;
    // and set that section's pack
    editor.setPack(target.value);
    // chrome is doing strange things with clicked buttons so just unfocus it
    target.blur();
}

function sectionVolume(peek=false) {
    // get the parent editor
    var e = window.event;
    var target = e.currentTarget;
    var editor = getParent(target, "sectionRow").editor;
    // if the slider is being dragged then set the audio volume but do not commit an action
    if (peek) {
        editor.setVolume(target.value / 100, false, true);
    } else {
        // otherwise set the audio level and commit it
        editor.setVolume(target.value / 100);
        // chrome is doing strange things with clicked buttons so just unfocus it
        target.blur();
    }
}

function sectionVolumePeek() {
    // if the slider is being dragged then set the audio volume but do not commit it
    sectionVolume(true);
}

// object containing the controls and state for a single instrument pack
class SectionEditor {
    constructor(score, section) {
        // identify the section
        this.score = score;
        this.section = section;
        this.metadata = sectionMetaData[this.section];

        // current song data state
        this.volume = 1.0;
        this.pack = "";

        // main UI
        this.mainSlider = null;

        // build the UI
        this.buildUI();

        // mixer UI
        this.mixerSlider = null;
        this.mixerRowSliders = [];

        // mixer UI is built from the main mixer
    }
    
    buildUI() {
        // assume the container is a table, top level element is table row
        var tr = document.createElement("tr");
        // css
        tr.className = "sectionRow";
        // back-reference
        tr.editor = this;
        
        this.mainSlider = new MixerSlider(this, false);

        // build the icon, section label, and start the instrument pack drop-down
        var html = `
            <td><img src="img/${sectionImages[this.section]}.png" srcset="img2x/${sectionImages[this.section]}.png 2x"></td>
            <td><span>${sectionMetaData[this.section].displayName}</span></td>
            <td><select class="dropDown sectionPack" onchange="sectionPack()">`;

        // fill in the instrument pack drop-down options
        for (var i = 0; i < packs.length; i++) {
            html += `<option value="${packs[i].name}">${packs[i].displayName}</option>`;
        }

        // finish the drop-down, build the volume slider and enable checkbox
        html += `</select></td>`;
 
        tr.innerHTML = html;

        this.mainSlider.buildUI(tr);
//           <td><input class="sectionVolume" type="range" min="0" max="100" value="100" onchange="sectionVolume()" oninput="sectionVolumePeek()"/></td>
//            <td>
//                <input id="section-${this.section}-enable" class="button sectionEnable" type="checkbox" checked onchange="sectionToggle()"/>
//                <label for="section-${this.section}-enable"></label>
//            </td>
//        `;

        this.container = tr;
    }

    setEnabled(row, enabled) {
        // pass through to the score's audio player to enable or disable audio
        this.score.soundPlayer.setEnabled(this.metadata.rowStart + row, enabled);
    }

    setVolume(volume, action=true, peek=false, load=false) {
        // if this isn't an undo action and the slider has been dropped then create an undo action
        if (action && !peek) {
            this.score.startActions();
            this.score.addAction(new setVolumeAction(this, this.volume, volume));
            this.score.endActions();
        }
        // if this is an initial load or we're not in an undo action and not peeking then make sure the
        // slider reflects the volume value
        if (load || (!action && !peek)) {
            getFirstChild(this.container, "sectionVolume").value = volume * 100;
        }
        // if we're not dragging then save it as a state
        if (!peek) {
            this.volume = volume;
        }
        // regardless of everything else, set the actual volume on the sound player
        this.score.soundPlayer.setVolume(this.section, volume);
    }

    setPack(pack, action=true, load=false) {
        // if this isn't an undo action then create an undo action
        if (action) {
            this.score.startActions();
            this.score.addAction(new setPackAction(this, this.pack, pack));
            this.score.endActions();
        }
        // if this is an initial load or we're not in an undo action then make sure the UI reflects the selection
        if (!action || load) {
            getFirstChild(this.container, "sectionPack").value = pack;
        }
        // save state
        this.pack = pack;
        // update the sound player
        this.score.setSectionSource(this.section, this.pack);
    }

    draw(context, imageMap, fontSize, centerX, centerY, scale) {
        // for lack of anything else, just base everything off the note grid size
        var w = gridSizeX;
        var h = gridSizeY;

        // width allocated to the icon
        var w_icon = w*1.5;
        // width allocated to section label and pack name
        var w_packName = w*10;
        // width allocated to the volume indicator
        var w_volume = w*8;
        // width of the volume knob
        var w_volumeKnob = w*0.3;
        // size of the border around the knob
        var w_volumeKnob_border = 1;
        // height of the slider track
        var h_volumeSlider = h/5;

        // calculate the starting X coordinate
        var startX = centerX - ((w_icon + w_packName + w_volume) / 2);

        // draw the icon
        context.drawImage(
            imageMap[this.section],
            startX * scale,
            (centerY - (h/2)) * scale
        );

        startX += w_icon;

        // draw the section name + instrument set label
        context.font = (fontSize* scale) + "px Arial";
        context.textAlign = "left";
        context.fillStyle = "#FFFFFF";
        context.fillText(
            sectionMetaData[this.section].displayName + ": " + instrumentNameToPack[this.pack].displayName,
            scale * (startX),
            scale * (centerY + (fontSize / 2))
        );

        startX += w_packName;

        // draw the volume slider track
        context.fillStyle = "#FFFFFF";
        context.fillRect(
            scale * (startX),
            scale * (centerY - (h_volumeSlider/2)),
            scale * (w_volume),
            scale * (h_volumeSlider)
        );

        // carve out the border of the volume knob
        context.fillStyle = "#000000";
        context.fillRect(
            scale * (startX + ((w_volume - w_volumeKnob) * this.volume) - w_volumeKnob_border),
            scale * (centerY - (h/2) - w_volumeKnob_border),
            scale * (w_volumeKnob + (w_volumeKnob_border * 2)),
            scale * (h + (w_volumeKnob_border * 2))
        );

        // draw the volume knob
        context.fillStyle = "#FFFFFF";
        context.fillRect(
            scale * (startX + ((w_volume - w_volumeKnob) * this.volume)),
            scale * (centerY - (h/2)),
            scale * (w_volumeKnob),
            scale * (h)
        );
        // that was a lot of work
    }

    buildMixerUi(table) {
        // build section mixer
        this.mixerMainSlider = new MixerSlider(this, true);

        var tr = document.createElement("tr");
        tr.className = "sectionRow";
        tr.innerHTML = `
                <td><img src="img/${sectionImages[this.section]}.png" srcset="img2x/${sectionImages[this.section]}.png 2x"/></td>
                <td colspan="2"><span>${sectionMetaData[this.section].displayName}</span></td>`;

        this.mixerMainSlider.buildUI(tr);
        table.appendChild(tr);

        // set up mirror for the two main sliders, they do the same thing.
        this.mainSlider.toggleMirror = this.mixerMainSlider;
        this.mixerMainSlider.toggleMirror = this.mainSlider;

        // individual row mixers
        for (var row = this.metadata.rowStart; row <= this.metadata.rowStop; row++) {
            var slider = new MixerSlider(this, true, row - this.metadata.rowStart);
            this.mixerRowSliders[row - this.metadata.rowStart] = slider;

            tr = document.createElement("tr");
            tr.className = "sectionRow";
            tr.innerHTML = `
                <td/>
                <td style="text-align: right">
                    <img src="img/${imgNote[row]}.png" srcset="img2x/${imgNote[row]}.png 2x"/>
                </td>
                <td style="text-align: right; max-width: 1px;">
                    <span>${row - this.metadata.rowStart + 1}</span>
                </td>`;

            slider.buildUI(tr);
            table.appendChild(tr);
        }
    }

    resetMixer() {
        this.mixerMainSlider.setVolumeValue(1);
        this.mixerVolumeChange(true, null, 1, false);

        this.mixerMainSlider.setToggleValue(true);
        this.mixerToggleChange(null, true, false);
    }

    mixerVolumeChange(isMixer, row, value, commit, secondary=false) {
        if (!isMixer) {
            this.setVolume(value, true, !commit);

        } else if (row == null) {
            for (var i = 0; i < this.mixerRowSliders.length; i++) {
                this.mixerVolumeChange(isMixer, i, value, commit, true);
            }

        } else if (isMixer) {
            if (secondary) {
                this.mixerRowSliders[row].setVolumeValue(value);
            } else {
                var totalValue = 0;
                var totalCount = 0;
                for (var i in this.mixerRowSliders) {
                    totalValue += this.mixerRowSliders[i].getVolumeValue();
                    totalCount += 1;
                }
                this.mixerMainSlider.setVolumeValue(totalValue / totalCount);
            }

            // propogate as a mix volume for that row's sound
            this.score.soundPlayer.setMixVolume(this.metadata.rowStart + row, value);
        }
    }

    mixerToggleChange(row, enabled, secondary=false) {
        if (row == null) {
            for (var i = 0; i < this.mixerRowSliders.length; i++) {
                this.mixerToggleChange(i, enabled, true);
            }

        } else {
            if (secondary) {
                this.mixerRowSliders[row].setToggleValue(enabled);

            } else if (enabled && !this.mixerMainSlider.getToggleValue()) {
                this.mixerMainSlider.setToggleValue(true);

            } else if (!enabled) {
                var oneEnabled = false;
                for (var i = 0; i < this.mixerRowSliders.length; i++) {
                    if (this.mixerRowSliders[i].getToggleValue()) {
                        oneEnabled = true;
                        break;
                    }
                }
                if (!oneEnabled) {
                    this.mixerMainSlider.setToggleValue(false);
                }
            }
            this.setEnabled(row, enabled);
        }
    }
}

function appendChildWithWrapper(parent, wrapperTag, ...children) {
    var wrapper = document.createElement(wrapperTag);
    for (var i = 0; i < children.length; i++) {
        wrapper.appendChild(children[i]);
    }
    parent.appendChild(wrapper);
}

class MixerSlider {
    constructor(sectionEditor, isMixer=false, row=null, toggleMirror=null) {
        this.sectionEditor = sectionEditor;
        this.isMixer = isMixer;
        this.row = row;
        this.toggleMirror = toggleMirror;
    }

    buildUI(tr) {
        this.slider = document.createElement("input");
        this.slider.className = "sectionVolume";
        this.slider.type = "range";
        this.slider.min = "0";
        this.slider.max = "100";
        this.slider.value = "100";
        this.slider.addEventListener("change", () => { this.volumeChange(true) });
        this.slider.addEventListener("input", () => { this.volumeChange(false) });
        appendChildWithWrapper(tr, "td", this.slider);

        var id = (this.isMixer ? "mixer-" : "section-") + this.sectionEditor.section;
        if (this.row != null) id = id + "-" + this.row;

        this.toggler = document.createElement("input");
        this.toggler.id = id + "-enable";
        this.toggler.classList.add("button");
        this.toggler.classList.add("sectionEnable");
        this.toggler.type = "checkbox";
        this.toggler.checked = true;
        this.toggler.addEventListener("change", () => { this.toggleChange() });

        var label = document.createElement("label")
        label.htmlFor = id + "-enable";

        appendChildWithWrapper(tr, "td", this.toggler, label);
    }

    getVolumeValue() {
        return this.slider.value / 100;
    }

    setVolumeValue(value) {
        this.slider.value = value * 100;
    }

    volumeChange(commit) {
        this.sectionEditor.mixerVolumeChange(this.isMixer, this.row, this.slider.value / 100, commit);
    }

    getToggleValue() {
        return this.toggler.checked
    }

    setToggleValue(enabled) {
        this.toggler.checked = enabled;
        if (this.toggleMirror) {
            this.toggleMirror.toggler.checked = enabled;
        }
    }

    toggleChange() {
        var enabled = this.toggler.checked;
        this.sectionEditor.mixerToggleChange(this.row, enabled);
        if (this.toggleMirror) {
            this.toggleMirror.toggler.checked = enabled;
        }
    }
}

// basic volume setting undo action
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

// basic instrument pack setting undo action
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
    // find the title text box and update the score
    var e = window.event;
    var target = e.currentTarget;
    var score = getParent(target, "songTitleDiv").score;
    score.setTitle(target.value);
}

// object containing the state and controls for the whole song
class Score {
    constructor() {
        // build the four measures
        this.measures = Array();
        for (var m = 0; m < 4; m++) {
            var measure = new Measure(this, m);
            this.measures.push(measure);
        }

        // section editors
        this.sections = {};
        for (var name in sectionMetaData) {
            // skip the "all" section
            if (sectionMetaData[name].all) continue;
            // build section editor
            var section = new SectionEditor (this, name);
            this.sections[name] = section;
        }

        // map of section instrument pack selections
        this.sectionPacks = {};

        // playlist object
        this.playlist = new Playlist(this);

        // library object
        this.library = new Library(this);

        // mixer object
        this.mixer = new Mixer(this);

        // build the UI
        this.buildUI();

        // section state
        this.selectedMeasure = null;

        // undo state
        this.actionCount = 0;
        this.actions = null;

        // playback state
        this.playback = null;
    }

    buildUI() {
        // top level container
        this.container = document.createElement("div");

        this.controlBar = document.createElement("div");
        this.controlBar.className = "controlBar";
        this.controlBar.measure = this;

        this.songControls = document.createElement("div");
        this.songControls.className = "songControlContainer";
        this.songControls.measure = this;

        // top level undo, clear, and playback buttons
        this.buttons = this.buildButtons();
        this.songControls.appendChild(this.buttons);

        // title editor
        this.titleContainer = this.buildTitleEditor();
        this.songControls.appendChild(this.titleContainer);
        this.title = "";

        // container for section editors is a div with a table
        var sectionContainer = document.createElement("div");
        var sectionTable = document.createElement("table");
        sectionTable.style.display = "inline-block";

        // section editors
        for (var name in this.sections) {
            sectionTable.appendChild(this.sections[name].container);
        }

        sectionContainer.appendChild(sectionTable);
        this.songControls.appendChild(sectionContainer);

        this.controlBar.appendChild(this.library.libraryBox);
        this.controlBar.appendChild(this.playlist.playlistContainer);
        this.controlBar.appendChild(this.mixer.mixerBox);
        this.controlBar.appendChild(this.songControls);

        this.container.appendChild(this.controlBar);

        // split four measures into two blocks of two so that making the window smaller
        // doesn't put three on one line and one on the next
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

        // init the sound player
        this.soundPlayer = new SoundPlayer();
    }

    buildButtons() {
        // button container
        var div = document.createElement("div");
        div.className = "scoreButtonContainer";
        div.score = this;

        // build buttons
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
        // container for label and text box
        var titleContainer = document.createElement("div")
        titleContainer.className = "songTitleDiv"
        // back-ref
        titleContainer.score = this;
        // build label and editor
        titleContainer.innerHTML = `
            <div class="tooltip">
                <span class="label">Song Title:</span>
                <input class="songTitle" type="text" size="24" maxlength="24" onchange="titleChanged()"/>
                <span class="tooltiptextbottom">Give your song a name</span>
            </div>
        `;
        return titleContainer;
    }

    initBlank() {
        // default state: all adau instruments and 100% volume
        for (var section in this.sections) {
            this.sections[section].setPack("adau", false);
            this.sections[section].setVolume(1.0, false);
        }
    }

    setSong(songCode, disableUndo, resetPlayback=false) {
        // parse the song code
        var song = new Song();
        song.parseChatLink(songCode);
        this.setSongObject(song, disableUndo, resetPlayback);
    }

    setSongObject(song, disableUndo, resetPlayback=false) {
        if (resetPlayback) {
            // remember whether we were playing before stopping playback
            var playing = this.isPlaying();
            this.stopPlayback();
        }
        // put the entire process of loading the song into a single undo action
        this.startActions();
        // set the title, make sure to update the UI
        this.setTitle(song.getName(), true, true);

        // loop over each section that's not the "all" section
        for (var section in sectionMetaData) {
            if (!sectionMetaData[section].all) {
                // set the instrument pack, make sure to update the UI
                this.sections[section].setPack(song.getPack(section), true, true);
                // set the volume, make sure to update the UI
                // song stores the volume as a percentage 0-100
                this.sections[section].setVolume(song.getVolume(section) / 100.0, true, false, true);
            }
        }

        for (var m = 0; m < 4; m++) {
            // extract each measure's note info from the parsed song and update the measure UI
            this.measures[m].setMeasureNotes(song.getMeasureNotes(m));
        }

        // commit as a single undo action
        this.endActions(disableUndo);

        // resume playing if it was playing before
        if (resetPlayback && playing) {
            this.togglePlaying();
        }
    }

    getSongObject() {
        // create a song object
        var song = new Song();

        // save the name
        song.setName(this.title);

        // loop over each section that's not the "all" section
        for (var section in sectionMetaData) {
            if (!sectionMetaData[section].all) {
                // save the instrument pack
                song.setPack(section, this.sections[section].pack);
                // save the volume
                // song stores the volume as a percentage 0-100
                song.setVolume(section, this.sections[section].volume * 100.0);
            }
        }

        for (var m = 0; m < 4; m++) {
            // extract each measure's note info from the UI and save to the song
            song.setMeasureNotes(m, this.measures[m].getMeasureNotes());
        }

        return song;
    }

    getSong() {
        // finally, have the song object produce a song code format
        return this.getSongObject().formatAsChatLink();
    }

    setSelectedMeasure(measure) {
        // check if we already have a selection and it's different
        if (this.selectedMeasure != null && this.selectedMeasure != measure) {
            // clear the section state
            var t = this.selectedMeasure;
            this.selectedMeasure = null;
            // clear the measure's section state
            t.clearSelection();
            // disable paste buttons
            for (var m = 0; m < 4; m++) {
                this.measures[m].setPasteEnabled(false);
            }
        }

        // if it's a valid selection
        if (measure != null) {
            // update selection state, assume the measure's own state is already updated
            this.selectedMeasure = measure;
            // enable paste buttons for the other three measures
            for (var m = 0; m < 4; m++) {
                if (this.measures[m] != measure) {
                    this.measures[m].setPasteEnabled(true);
                }
            }
        }
    }

    clear(section) {
        // put the entire process of clearing the section into a single undo action
        this.startActions();
        // clear the section from each measure
        for (var m = 0; m < 4; m++) {
            this.measures[m].clear(section);
        }
        // commit as a single undo action
        this.endActions();
    }

    setTitle(title, action=true, load=false) {
        // if we're not in an undo action then create an undo action
        if (action) {
            this.startActions();
            this.addAction(new setTitleAction(this, this.title, title));
            this.endActions();
        }
        // if we're a regular action or loading then update the UI
        if (!action || load) {
            getFirstChild(this.titleContainer, "songTitle").value = title;
        }
        // save state
        this.title = title;
    }

    setSectionSource(section, pack) {
        // save the section pack info
        this.sectionPacks[section] = pack;
        // set the audio source
        this.soundPlayer.setSource(section, pack, this.isSectionMono(section));
    }

    isSectionMono(section) {
        return instrumentNameToPack[this.sectionPacks[section]].mono[section];
    }

    startActions() {
        // increment the nested action count
        this.actionCount++;
        // if this is the top level then start a new action list
        if (this.actionCount == 1) {
            this.actions = Array();
        }
    }

    addAction(action) {
        // add an action to the list
        this.actions.push(action);
    }

    endActions(disableUndo=false) {
        // decrement the nested action count
        this.actionCount--;
        // if we've closed the top level action then commit any undo actions
        if (this.actionCount == 0) {
            var action = null;
            // if there was just one action then that's our undo action
            if (this.actions.length == 1) {
                action = this.actions[0];

            // otherwise build a composite action
            } else if (this.actions.length > 1) {
                action = new CompositeAction(this.actions);
            }

            // if there as an undo action
            if (action != null) {
                // When loading the song from a URL, don't start off with an undo action.
                if (!disableUndo) {
                    // wrap the undo action in another action that updates the song code when
                    // undoing or redoing
                    addUndoAction(new WrapAction(action));
                }
                // update the song code box in the UI
                updateSongCode();
            }
        }
    }

    togglePlaying() {
        // space bar handler
        if (this.playback != null) {
            // if we are currently playing something, then either pause or resume it.
            this.playback.toggle();
        } else {
            // otherwise pretend the user clicked the song play button
            this.play(getFirstChild(this.buttons, "playButton"));
        }
    }

    play(button) {
        // start playback with all four measures
        this.doPlayback(button, this.measures);
    }

    doPlayback(button, m) {
        // if there already is a playback in progress
        if (button.playback != null) {
            // currently, kill the playback when the stop button is clicked.  get the playback marker off the screen.
            if (button.playback.playing() && stopKills) {
                button.playback.kill();
                this.playback = null;
            } else {
                button.playback.toggle();
            }

        } else {
            // something else is playing, kill it
            this.stopPlayback();
            // start a new playback with the given measure list.
            this.playback = new Playback(this, button, m);
            this.playback.start();
        }
    }

    stopPlayback() {
        if (this.playback != null) {
            this.playback.kill();
            this.playback = null;
        }
    }

    isPlaying() {
        return this.playback != null && this.playback.playing();
    }

    generatePng(linkDiv, display) {
        // let's just always use create a hi-res version
        var hidpi = true;
        // we have to pre-load the images
        loadImages({
            "m0": createNoteImagePath(imgGrid[0], hidpi),
            "m1": createNoteImagePath(imgGrid[1], hidpi),
            "m2": createNoteImagePath(imgGrid[2], hidpi),
            "m3": createNoteImagePath(imgGrid[3], hidpi),
            "np1": createNoteImagePath(imgNote[0], hidpi),
            "np2": createNoteImagePath(imgNote[1], hidpi),
            "np3": createNoteImagePath(imgNote[2], hidpi),
            "nb": createNoteImagePath(imgNote[3], hidpi),
            "nm": createNoteImagePath(imgNote[8], hidpi),
            "perc": createNoteImagePath(sectionImages["perc"], hidpi),
            "bass": createNoteImagePath(sectionImages["bass"], hidpi),
            "mel": createNoteImagePath(sectionImages["mel"], hidpi)
        },
        // provide a call-back to draw the PNG once the images are loaded
        (imageMap) => this.doGeneratePng(imageMap, hidpi, linkDiv)
        );
    }

    doGeneratePng(imageMap, hidpi, linkDiv) {
        // set scale depending on hidpi
        var scale = hidpi ? 2 : 1;

        // basic sizing
        var margin = 10;
        var fontSize = 16;
        // total guess for section height
        var sectionHeight = gridSizeY + margin;

        // create a canvas
        var canvas = document.createElement("canvas");
        // calculate the width
        canvas.width = ((gridSizeX * 64) + (margin * 2)) * scale;
        // add up everything to calculate the height
        canvas.height = (margin
            + (fontSize * 2)
            + margin
            + (sectionHeight * 3)
            + (gridSizeY * 13)
            + fontSize
            + margin
        ) * scale;

        // get the graphics context, this is what we'll do all our work in
        var context = canvas.getContext("2d");

        // fill the whole canvas with a background color, otherwise it will be transparent
        context.fillStyle = "#000000";
        context.fillRect(0, 0, canvas.width, canvas.height);

        var startY = margin;

        // header
        context.font = (fontSize * 2 * scale) + "px Arial";
        context.textAlign = "center";
        context.fillStyle = "#FFFFFF";
        context.fillText(this.title, (margin + (gridSizeX * 32)) * scale, (startY + (fontSize * 2)) * scale);

        startY += margin + (fontSize * 2);

        // three instrument sections
        for (var section in {"perc":"", "bass":"", "mel":""}) {
            this.sections[section].draw(context, imageMap, fontSize, margin + (gridSizeX * 32), startY + (sectionHeight/2), scale);
            startY += sectionHeight;
        }

        // note grid
        for (var m = 0; m < 4; m++) {
            this.measures[m].draw(context, imageMap, margin, startY, scale);
        }

        // footer
        context.font = (fontSize * scale) + "px Arial";
        context.textAlign = "right";
        context.fillStyle = "#808080";
        context.fillText("buff0000n.github.io/mandascore", (margin + (gridSizeX * 64)) * scale, (startY + (gridSizeY * 13) + fontSize + (margin / 2)) * scale);

        var link = convertToPngLink(canvas, this.title);
        linkDiv.innerHTML = "";
        linkDiv.appendChild(link);
    }
}

class Mixer {
    constructor(score) {
        // back reference to the score
        this.score = score;

        // build the UI
        this.buildUI();
    }

    buildUI() {
        // main container
        this.mixerBox = document.createElement("div");
        this.mixerBox.className = "mixerBox";
        this.mixerBox.id = "mixerBox";
        // back reference because why not
        this.mixerBox.mixer = this;

        this.container = this.mixerBox;

        // button container
        this.buttons = document.createElement("div");
        this.buttons.className = "scoreButtonContainer";
        // back-reference
        this.buttons.score = this;
        // build the buttons in a single row
        this.buttons.innerHTML = `
            <div class="scoreButtonRow">
                <input class="button resetButton" type="submit" value="Reset"/>
            </div>
        `;
        this.container.appendChild(this.buttons);

        getFirstChild(this.container, "resetButton").addEventListener("click", () => { this.resetMixerButton() });

        var table = document.createElement("table");

        for (var name in sectionMetaData) {
            if (name in this.score.sections) {
                var sectionEditor = this.score.sections[name];
                sectionEditor.buildMixerUi(table);
            }
        }

        var tableDiv = document.createElement("div");
        tableDiv.className = "mixerlistScollArea";

        tableDiv.appendChild(table);
        this.container.appendChild(tableDiv);

    }

    init() {
    }

    resetMixerButton(e) {
        getFirstChild(this.container, "resetButton").blur();
        for (name in this.score.sections) {
            var sectionEditor = this.score.sections[name];
            sectionEditor.resetMixer();
        }
    }
}

function clearPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();

    // clear all menus
    clearMenus();
    // create a div and set some properties
    var div = document.createElement("div");
    div.className = "menu";
    div.button = button;

    // build the section menu out of buttons
    var html = "";
    html += `<input class="button" type="submit" value="Clear Playlist" onClick="reallyClearPlaylist(this)"/>`;
    html += `<input class="button" type="submit" value="Cancel" onClick="clearMenus()"/>`;
    div.innerHTML = html;

    // put the menu in the clicked button's parent and anchor it to button
    showMenu(div, getParent(button, "scoreButtonRow"), button);
}

function reallyClearPlaylist(button) {
   // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();

    // need to get this before clearing menus
    var playlist = getParent(button, "playlistBox").playlist;

    // clear all menus
    clearMenus();

    // clear the playlist
    playlist.clear();
}

function loopPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    var playlist = getParent(button, "playlistBox").playlist;

    playlist.toggleLoop(button);
}

function addToPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    var playlist = getParent(button, "playlistBox").playlist;
    playlist.add();
}

function editPlaylistSaveButton(e) {
    editPlaylistSave(e.target);
}

function editPlaylistSave(button) {
    var textarea = getFirstChild(getParent(button, "playlistBox"), "playlistEditArea");
    if (textarea.exp != textarea.value) {
        textarea.playlist.import(textarea.value);
    }
    clearMenus();
}

function editPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    var playlist = getParent(button, "playlistBox").playlist;

    // clear all menus
    clearMenus();
    // create a div and set some properties
    var div = document.createElement("div");
    div.className = "menu";
    div.button = button;
//    div.callback = callback

    // build the section menu out of buttons
    var textArea = document.createElement("textarea");
    textArea.className = "playlistEditArea";
    textArea.rows = "5";
    textArea.cols = "64";
    var exp = playlist.export();
    textArea.value = exp;
    textArea.exp = exp;
    textArea.playlist = playlist;
    // escape is usually ignored in text areas
    textArea.onkeydown = textAreaKeyDown;

    div.appendChild(textArea);

    var save = document.createElement("input");
    save.className = "button";
    save.value = "Save";
    save.textarea = textArea;
    save.playlist = playlist;
    save.onclick = editPlaylistSaveButton

    div.appendChild(save);


//    div.innerHTML = `<textarea id="songCode" rows="5" cols="64" onchange="editPlaylistChanged(this);"></textarea>`;

    // put the menu in the clicked button's parent and anchor it to button
    showMenu(div, getParent(button, "scoreButtonRow"), button);

    textArea.focus();
    textArea.select();
}

function textAreaKeyDown(e) {
    e = e || window.event;
    nodeName = e.target.nodeName;

    switch (e.code) {
		case "Escape" :
		    // clear any open menus on escape
		    clearMenu();
		    break;
		case "Enter" :
		    // commit when enter is pressed
		    editPlaylistSave(e.target);
		    break;
    }
}

class Playlist {
    constructor(score) {
        // back reference to the score
        this.score = score;
        // list of playlist entries
        this.entries = Array();
        // looping state
        this.looping = false;
        // build the UI
        this.buildUI();
    }

    buildUI() {

        // this.playlistContainer = document.createElement("div");
        // this.playlistContainer.className = "playlistContainer";
        // this.playlistContainer.measure = this;

        // main container
        // this will expand vertically with the playlist
        // todo: figure out a good cross-browser way to add a scrollbar
        this.playlistBox = document.createElement("div");
        this.playlistBox.className = "playlistBox";
        this.playlistBox.id = "playlistBox";
        // back reference because why not
        this.playlistBox.playlist = this;

        // this.playlistContainer.appendChild(this.playlistBox);
        this.playlistContainer = this.playlistBox;

        // menu bar, just HTML it
        this.playlistBox.innerHTML = `
            <div class="scoreButtonRow">
                <input class="button addButton" type="submit" value="Add" onClick="addToPlaylist(this)"/>
                <input class="button loopButton" type="submit" value="Enable" onClick="loopPlaylist(this)"/>
                <input class="button clearButton" type="submit" value="Clear" onClick="clearPlaylist(this)"/>
                <input class="button editButton" type="submit" value="Copy/Paste" onClick="editPlaylist(this)"/>
                <div class="popup">
                    <input id="playlistCopyUrlButton" class="button urlButton popup" type="submit" value="Generate Link"
                           onClick="copyPlaylistUrl()"/>
                    <div class="popuptext" id="playlistPopupBox">
                        <input id="playlistUrlHolder" type="text" size="60" onblur="hideUrlPopup()"/>
                    </div>
                </div>
            </div>
        `;

        // get a reference to the looping toggle button
        this.loopingButton = getFirstChild(this.playlistBox, "loopButton");

        this.playlistScollArea = document.createElement("div");
        this.playlistScollArea.className = "playlistScollArea";
        this.playlistBox.appendChild(this.playlistScollArea);
    }

    addSongCode(code, select, insert=true) {
        var song = new Song();
        song.parseChatLink(code);
        this.addSong(song, select, insert);
    }

    addSong(song, select, insert=true) {
        // create a new entry
        var entry = new PlaylistEntry(song, this);
        if (this.selected && insert) {
            // if there's a selection, the insert the new entry immediately after the selection
            var index = this.entries.indexOf(this.selected);
            this.entries.splice(index+1, 0, entry);
            // do the same insertion in the dom
            insertAfter(entry.playlistEntryContainer, this.selected.playlistEntryContainer);
            // renumber entries
            this.reIndex();

        } else {
            // no current selection or we're support to append instead of insert
            this.entries.push(entry);
            // no need to reindex the whole list
            entry.setIndex(this.entries.length);
            // insert into the dom
            this.playlistScollArea.appendChild(entry.playlistEntryContainer);
        }
        if (select) {
            // optionally select
            this.select(entry, false);
        }
    }

    removeEntry(entry) {
        // remove from the entry list
        if (removeFromList(this.entries, entry)) {
            // remove from the dom
            deleteNode(entry.playlistEntryContainer);
            // if the node was selected then we have no selection now
            if (this.selected == entry) {
                this.selected = null;
            }
            // renumber entries
            this.reIndex();
        }
    }

    moveUp(entry) {
        // get the index of the entry
        var index = this.entries.indexOf(entry);
        // make sure it's not already at the top
        if (index > 0) {
            // remove and insert one spot up
            this.entries.splice(index, 1);
            this.entries.splice(index-1, 0, entry);
            // same move in the dom
            deleteNode(entry.playlistEntryContainer);
            insertBefore(entry.playlistEntryContainer, this.entries[index].playlistEntryContainer);
            // renumber entries
            this.reIndex();
        }
    }

    moveToTop(entry) {
        // get the index of the entry
        var index = this.entries.indexOf(entry);
        // make sure it's not already at the top
        if (index > 0) {
            // remove and insert at the beginning
            this.entries.splice(index, 1);
            this.entries.splice(0, 0, entry);
            // same move in the dom
            deleteNode(entry.playlistEntryContainer);
            insertBefore(entry.playlistEntryContainer, this.entries[1].playlistEntryContainer);
            // renumber entries
            this.reIndex();
        }
    }

    moveDown(entry) {
        // get the index of the entry
        var index = this.entries.indexOf(entry);
        // make sure it's not already at the bottom
        if (index >= 0 && index < this.entries.length - 1) {
            // remove and insert one spot down
            this.entries.splice(index, 1);
            this.entries.splice(index+1, 0, entry);
            // same move in the dom
            deleteNode(entry.playlistEntryContainer);
            insertAfter(entry.playlistEntryContainer, this.entries[index].playlistEntryContainer);
            // renumber entries
            this.reIndex();
        }
    }

    moveToBottom(entry) {
        // get the index of the entry
        var index = this.entries.indexOf(entry);
        if (index >= 0 && index < this.entries.length - 1) {
            // remove and insert at the end
            this.entries.splice(index, 1);
            this.entries.splice(this.entries.length, 0, entry);
            // same move in the dom
            deleteNode(entry.playlistEntryContainer);
            insertAfter(entry.playlistEntryContainer, this.entries[this.entries.length - 2].playlistEntryContainer);
            // renumber entries
            this.reIndex();
        }
    }

    reIndex() {
        // lazy, just loop through and re-index eveything.
        for (var i = 0; i < this.entries.length; i++) {
            this.entries[i].setIndex(i + 1);
        }
    }

    select(entry, setScore, resetPlayback=false) {
        // already selected
        if (this.selected == entry) {
            return;
        }
        // not sure if I need a null check but whatever
        if (entry == null) {
            return;
        }
        // check if there is already a selection
        if (this.selected) {
            // update the playlist entry's song, if this isn't an add action
            if (setScore) {
                this.selected.updateSong();
            }
            // clear selection
            this.selected.setSelected(false);
        }
        // select the new entry
        entry.setSelected(true);
        this.selected = entry;
        // update the score, if this isn't an add action
        if (setScore) {
            this.score.setSongObject(this.selected.song, true, resetPlayback);
            // let's make this simple for now: switching songs in the playlist clears the undo history.
            clearUndoStack();
        }
    }

    selectNext() {
        // if there is no selection then select the first entry
        if (!this.selected) {
            this.select(this.entries[0], true);
            return;
        }
        // get the currently selected index
        var index = this.entries.indexOf(this.selected);
        // increment and wrap around if necessary
        index += 1;
        if (index >= this.entries.length) {
            index = 0;
        }
        // change the selection, updating the score
        this.select(this.entries[index], true);
    }

    clear() {
        // delete from the dom
        for (var i = 0; i < this.entries.length; i++) {
            deleteNode(this.entries[i].playlistEntryContainer);
        }
        // clear state
        this.entries = Array();
        this.selected = null;
    }

    add() {
        // add the song currently in the score and automatically select it
        // This bypasses the auto-update when the selection changes, so the previously selected entry remains unchanged
        this.addSong(this.score.getSongObject(), true);
    }

    toggleLoop() {
        this.setLooping(!this.looping)
    }

    setLooping(looping) {
        if (!looping) {
            this.loopingButton.value = "Enable";
            this.looping = false;
        } else {
            this.loopingButton.value = "Disable";
            this.looping = true;
        }
    }

    export() {
        // build a string with each playlist song's code on a new line
        var str = "";
        for (var i = 0; i < this.entries.length; i++) {
            str = str + this.entries[i].song.formatAsChatLink() + "\n";
        }
        return str;
    }

    import(str) {
        // split into lines
        var songCodes = str.split("\n")
        var readEntries = Array();

        for (var i = 0; i < songCodes.length; i++) {
            // trim and check for blank lines
            var code = songCodes[i].trim();
            if (code != "") {
                // parse the song
                var song = new Song();
                song.parseChatLink(code);
                readEntries.push(song);
            }
        }

        // don't make any changes if we didn't read any valid songs
        // we also avoid making any changes if there was an error parsing the song list
        if (readEntries.length > 0) {
            // clear the current playlist
            this.clear();
            // add each song
            for (var i = 0; i < readEntries.length; i++) {
                // add it to the playlist, without affecting the selection
                this.addSong(readEntries[i], false);
            }
            // finally, select the first entry and reset playback
            this.select(this.entries[0], true, true);
        }
    }
}

class PlaylistEntry {
    constructor(song, playlist) {
        // song object
        this.song = song;
        // back reference
        this.playlist = playlist;
        // build the UI
        this.buildUI();
    }

    buildUI() {
        // main container
        this.playlistEntryContainer = document.createElement("div");
        this.playlistEntryContainer.className = "playlistEntryContainer";
        this.playlistEntryContainer.playlist = this;

        // I kind of regret this, but build the dom manually
        {
            var span = document.createElement("span");
            span.className = "smallButton";
            span.onclick = this.deletePlaylistEntry
            span.entry = this;
            span.innerHTML = `X`;
            this.playlistEntryContainer.appendChild(span);
        }

        {
            var span = document.createElement("span");
            span.className = "smallButton";
            span.onclick = this.movePlaylistEntryToTop
            span.entry = this;
            span.innerHTML = `⇈`;
            this.playlistEntryContainer.appendChild(span);
        }
        {
            var span = document.createElement("span");
            span.className = "smallButton";
            span.onclick = this.movePlaylistEntryUp
            span.entry = this;
            span.innerHTML = `↑`;
            this.playlistEntryContainer.appendChild(span);
        }

        {
            var span = document.createElement("span");
            span.className = "smallButton";
            span.onclick = this.movePlaylistEntryDown
            span.entry = this;
            span.innerHTML = `↓`;
            this.playlistEntryContainer.appendChild(span);
        }
        {
            var span = document.createElement("span");
            span.className = "smallButton";
            span.onclick = this.movePlaylistEntryToBottom
            span.entry = this;
            span.innerHTML = `⇊`;
            this.playlistEntryContainer.appendChild(span);
        }

        {
            // we need to keep a reference to the index span to change its color when selected
            this.indexBar = document.createElement("span");
            this.indexBar.className = "playlistEntry";
            this.indexBar.onclick = this.selectPlaylistEntry
            this.indexBar.entry = this;
            this.playlistEntryContainer.appendChild(this.indexBar);
        }
        {
            // we need to keep a reference to the title span to change its color when selected
            this.titleBar = document.createElement("span");
            this.titleBar.className = "playlistEntry";
            this.titleBar.onclick = this.selectPlaylistEntry
            this.titleBar.entry = this;
            this.titleBar.innerHTML = this.song.getName();
            this.playlistEntryContainer.appendChild(this.titleBar);
        }
    }

    setIndex(index) {
        this.indexBar.innerHTML = index;
    }

    deletePlaylistEntry() {
        this.entry.playlist.removeEntry(this.entry);
    }

    movePlaylistEntryUp() {
        this.entry.playlist.moveUp(this.entry);
    }

    movePlaylistEntryToTop() {
        this.entry.playlist.moveToTop(this.entry);
    }

    movePlaylistEntryDown() {
        this.entry.playlist.moveDown(this.entry);
    }

    movePlaylistEntryToBottom() {
        this.entry.playlist.moveToBottom(this.entry);
    }

    selectPlaylistEntry() {
        this.entry.playlist.select(this.entry, true);
    }

    setSelected(selected) {
        // change the css depending on whether it's selected
        this.indexBar.className = selected ? "playlistEntrySelected" : "playlistEntry";
        this.titleBar.className = selected ? "playlistEntrySelected" : "playlistEntry";
        if (selected) {
            // scroll the playlist viewer to the selected entry, either at the top or the botton, whichever is nearest
            this.playlistEntryContainer.scrollIntoView({"behavior": "auto", "block": "nearest", "inline": "nearest"});
        }
    }

    updateSong() {
        // load the current song from the score
        this.song = this.playlist.score.getSongObject();
        // update the title
        this.titleBar.innerHTML = this.song.getName();
    }
}

// basic title undo action
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

// undo action wrapper that automatically triggers a song code update
class WrapAction extends Action {
    constructor(action) {
        super();
        this.action = action;
    }

	undoAction() {
	    this.action.undoAction();
        updateSongCode();
	}

	redoAction() {
	    this.action.redoAction();
        updateSongCode();
	}

	toString() {
	    return this.action.toString();
	}
}

// playback marker animation speed
var tickms = 15;

// object for controlling and tracking the state of a playback operation
class Playback {
    constructor(score, button, measures) {
        // score reference
        this.score = score;
        // play button
        this.button = button;
        // back-reference the button to this playback object
        this.button.playback = this;

        // the measures to play
        this.measures = measures;

        // run parameters
        this.runTime = 2.0 * measures.length;
        this.runT = 16 * measures.length;

        // playback state
        // animation tick timeout reference
        this.animTimeout = null;
        // time zero for the current iteration of the loop
        this.startTime = 0.0;
        // current time within the loop
        this.currentTime = 0.0;
        // current time column
        this.currentT = -2;
        // sound play column currently scheduled
        this.playT = -1;
        // the last measure we set playback state on
        this.lastMeasure = null;

        // hack flag to prevent moving to the next playlist entry immediately when starting
        this.hasPlayed = false;
    }

    playing() {
        // we're playing if we have an animation tick scheduled
        return this.animTimeout != null;
    }

    start() {
        // change the Play button to a Loading button while the sounds are loaded
        this.button.value = "Loading";
        this.button.enabled = false;

        // don't start playing until the player has been initialized
        // After the sound player is loaded this should go straight through to loaded()
        this.score.soundPlayer.initialize(() => this.loaded());
    }

    loaded() {
        // change the Play button to a Stop button
        this.button.value = "Stop";
        this.button.enabled = true;
        // start the first/next animation tick
        this.tick(true);
    }

    stop() {
        this.score.soundPlayer.clearStops();

        // unschedule the next animation tick, if any
        if (this.animTimeout != null) clearTimeout(this.animTimeout);
        this.animTimeout = null;

        // cancel any pending scheduled sounds
        this.score.soundPlayer.stop();

        // change the Stop button to a Play button
        this.button.value = "Play";
    }

    toggle() {
        // stop if we're playing
        if (this.playing()) {
            this.stop();

        // otherwise start/restart
        } else {
            this.start();
        }
    }

    kill() {
        // stop playing
        this.stop();
        // clean up measure playback marker
        if (this.lastMeasure != null) this.lastMeasure.stopPlayback();
        // remove the back-reference
        this.button.playback = null;
    }

    playAudio(delay) {
        // hack to switch to the next song in the playlist
        // only switch if we've played through once, have wrapped back to 0, have four measures,
        // have a playlist, and the playlist is enabled.
        if (this.hasPlayed && this.playT == 0 && this.measures.length == 4 &&
            this.score.playlist != null && this.score.playlist.looping) {
            this.score.playlist.selectNext();
        }
        this.hasPlayed = true;

        // play the audio for the current playT time column
        // get the correct measure
        var measure = Math.floor(this.playT / 16);
        // play the measure's corresponding time column
        this.measures[measure].playAudioForTime(this.playT - (measure * 16), delay);
    }

    tick(start=false) {
        // schedule the next tick right away, so we get as close to the specified animation speed as possible
        this.animTimeout = setTimeout(() => { this.tick() }, tickms);

        // get the current time in seconds
        var time = getTime() / 1000;

        // console.log("tick at " + time + ", currentT=" + this.currentT + ", playT=" + this.playT);

        // special logic for the first tick
        if (start) {
            // initialize the current loop's start time.
            // If we're currently in the middle of the loop then this will be in the past
            this.startTime = time - this.currentTime;
            // if we're starting fresh at the beginning of the loop
            if (this.currentTime == 0) {
                // set the current and playing time columns
                this.currentT = 0;
                this.playT = 0;
                // play the first time column immediately
                this.playAudio(0);
            } else {
                // schedule the next time column to play
                var delay = ((this.currentT + 1) * 125) - (this.currentTime * 1000);
                this.playAudio(delay);
            }

        } else {
            // update the current time in the loop
            this.currentTime = time - this.startTime;
            // wrap around if we've passed the end of the loop
            while (this.currentTime >= this.runTime) {
                // wrap the current time around
                this.currentTime -= this.runTime;
                // move the start time up by one loop
                this.startTime += this.runTime;
            }
            // calcluate the current time column
            this.currentT = Math.floor(this.currentTime * 8);
        }

        // determine if we've reached the time columne that was already scheduled to play
        // We can potentially skip playing time columns if the animation rate somehow drops
        // below 8 fps, but the logic to try and account for that was getting too complicated
        // because of the wraparound, and playing a bunch of time columns at once will sound bad anyway.
        if (this.currentT == this.playT) {
            // get the next time column
            this.playT = (this.currentT + 1) % this.runT;
            // calculate the time until we hit the next time column
            var delay = ((this.currentT + 1) * 125) - (this.currentTime * 1000);
            // only way to support stopping scheduled sounds
            // without stopping sounds that have already been started in the middle of playing
//            this.score.soundPlayer.clearStops();
            // schedule the time column for play
            this.playAudio(delay);
        }

        // get the current measure
        var measureIndex = Math.floor(this.currentTime / 2.0);
        var measure = this.measures[measureIndex];
        // if we've moved to a different measure
        if (measure != this.lastMeasure) {
            // clear the last measure's playback state, if any
            if (this.lastMeasure != null) this.lastMeasure.stopPlayback();
            // start playback on the new measure
            this.lastMeasure = measure;
            measure.startPlaybackMarker();
        }
        // set the measure's playback state
        measure.setPlaybackMarkerTime(this.currentTime % 2);
    }

}