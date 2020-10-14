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
        // find any notes that are enabled in the given column and schedule them to play woth the given delay
        for (var r = 0; r < 13; r++) {
            if (this.notes[t][r].enabled) {
                this.score.soundPlayer.playSoundLater(r, delay);
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
        // current state
        this.volume = 1.0;
        this.pack = "";

        // build the UI
        this.container = this.buildUI();
    }
    
    buildUI() {
        // assume the container is a table, top level element is table row
        var container = document.createElement("tr");
        // css
        container.className = "sectionRow";
        // back-reference
        container.editor = this;

        // build the icon, section label, and start the instrument pack drop-down
        var html = `
            <td><img src="img/${sectionImages[this.section]}.png" srcset="img2x/${sectionImages[this.section]}.png 2x"</td>
            <td><span>${sectionMetaData[this.section].displayName}</span></td>
            <td><select class="dropDown sectionPack" onchange="sectionPack()">`;

        // fill in the instrument pack drop-down options
        for (var i = 0; i < packs.length; i++) {
            html += `<option value="${packs[i].name}">${packs[i].displayName}</option>`;
        }

        // finish the drop-down, build the volume slider and enable checkbox
        html += `
            </select></td>
            <td><input class="sectionVolume" type="range" min="0" max="100" value="100" onchange="sectionVolume()" oninput="sectionVolumePeek()"/></td>
            <td>
                <input id="section-${this.section}-enable" class="button sectionEnable" type="checkbox" checked onchange="sectionToggle()"/>
                <label for="section-${this.section}-enable"></label>
            </td>
        `;

        container.innerHTML = html;
        return container;
    }

    setEnabled(enabled) {
        // pass through to the score's audio player to enable or disable audio
        this.score.soundPlayer.setEnabled(this.section, enabled);
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
        this.score.soundPlayer.setSource(this.section, this.pack);
    }

    draw(context, imageMap, fontSize, centerX, centerY, scale) {
        // for lack of anything else, just base everything off the note grid size
        var w = gridSizeX;
        var h = gridSizeY;

        // width allocated to the icon
        var w_icon = w*1.5;
        // width allocated to section label and pack name
        var w_packName = w*9;
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

        // top level undo, clear, and playback buttons
        this.buttons = this.buildButtons();
        this.container.appendChild(this.buttons);

        // title editor
        this.titleContainer = this.buildTitleEditor();
        this.container.appendChild(this.titleContainer);
        this.title = "";

        // container for section editors is a div with a table
        var sectionContainer = document.createElement("div");
        var sectionTable = document.createElement("table");
        sectionTable.style.display = "inline-block";

        // section editors
        this.sections = {};
        for (var name in sectionMetaData) {
            // skip the "all" section
            if (sectionMetaData[name].all) continue;
            // build section editor
            var section = new SectionEditor (this, name);
            this.sections[name] = section;
            sectionTable.appendChild(section.container);
        }

        sectionContainer.appendChild(sectionTable);
        this.container.appendChild(sectionContainer);

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

    setSong(songCode, disableUndo) {
        // parse the song code
        var song = new Song();
        song.parseChatLink(songCode);

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
    }

    getSong() {
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

        // finally, have the song object produce a song code format
        return song.formatAsChatLink();
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
            if (this.playback != null) {
                this.playback.kill();
            }
            // start a new playback with the given measure list.
            this.playback = new Playback(this, button, m);
            this.playback.start();
        }
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
            this.score.soundPlayer.clearStops();
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