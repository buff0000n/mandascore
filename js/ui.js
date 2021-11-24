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
		    score.togglePlaying(e.shiftKey);
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

function runSectionMenu(title, button, callback, sectionList) {
    // clear all menus
    clearMenus();
    // create a div and set some properties
    var div = document.createElement("div");
    div.className = "menu";
    div.button = button;
    div.callback = callback

    // build the section menu out of buttons
    var html = "";
    for (var i = 0; i < sectionList.length; i++) {
        var name = sectionList[i];
        var m = sectionMetaData[name];
        html += `<div class="button ${m.name}Button" onClick="selectSection(this, '${m.name}')" style="color: ${m.color}; vertical-align: middle; text-align: left;">
            <img style="vertical-align: middle;" class="imgButton" src="img/${sectionImages[name]}.png" srcset="img2x/${sectionImages[name]}.png 2x"/>
            ${m.displayName}</span>
        </div>`;
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
    var e = window.event;
    var restart = e && e.shiftKey;
    // play either the single measure or the whole song, depending on what object is saved on the button's container
    getParent(button, "scoreButtonContainer").score.play(button, restart);
}

function copyButton(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // get the associated measure
    var measure = getParent(button, "scoreButtonContainer").score;
    // show the section menu and ask which section to copy
    runSectionMenu("Copy", button, doCopy, ["all", "perc", "bass", "mel"]);
}

function copyScoreButton(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // get the associated score
    var score = getParent(button, "scoreButtonContainer").score;
    // show the section menu and ask which section to copy, add an option for copying the performance
    runSectionMenu("Copy", button, doCopy, ["all", "perc", "bass", "mel", "perf"]);
}

function doCopy(button, section) {
    // get the associated measure and set its selection to the given section
    getParent(button, "scoreButtonContainer").score.copy(section);
}

function pasteButton(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();

    // check if the shift key is pressed
    var e = window.event;
    if (e.shiftKey) {
        // get the section of the current copy data
        var section = getCopyDataSection(score.copyData);
        // only allowed with bass and melody
        if (section == "bass" || section == "mel") {
            // make the other section first in the section selection dropdown
            var sectionSelection = section == "bass" ? ["mel", "bass"] : ["bass", "mel"];
            // run the menu
            runSectionMenu("Paste", button, (button, section) => {
                // create a copy of the copy data with the sections swapped
                var copyData = swapCopyDataSection(score.copyData, section);
                // do the paste operation with the copy copy
                getParent(button, "scoreButtonContainer").score.paste(copyData);
            }, sectionSelection);
            // prevent the default past behavior
            return;
        }
    }

    // get the associated measure and paste the selected section from another measure
    getParent(button, "scoreButtonContainer").score.paste(score.copyData);
}

function clearButton(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // show the section menu and ask which section to clear
    runSectionMenu("Clear", button, doClear, ["all", "perc", "bass", "mel"]);
}

function doClear(button, section) {
    // get the associated measure and clear the given section
    getParent(button, "scoreButtonContainer").score.clear(section);
}

function setButtonEnabled(button, enabled) {
    // convenience function for changing the enabled state of a button
    if (enabled) {
        button.classList.remove("imgButtonDisabled");
        button.classList.add("imgButton");
    } else {
        button.classList.remove("imgButton");
        button.classList.add("imgButtonDisabled");
    }
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
        this.noteShown = false;
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

        // create the note image
        this.img = createNoteImage(baseName);
        // let the measure add it in the right place
        this.measure.addImage(this.img, this.time, this.row);
    }

    updateState() {
        if (this.enabled) {
            // if the note is enabled then that image takes precedence
            // only update the image once, so we don't interfere with bounce()
            if (!this.noteShown) {
                this.setImg(imgNote[this.row]);
                // set the flag
                this.noteShown = true;
            }
        } else {
            // unset the flag
            this.noteShown = false;
            if (this.hover) {
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
        // make sure update() doesn't blow away the bounce animation before it starts
        this.noteShown = true;
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

// combined mouse/touch event handling
var lastMTEvent = null;
var lastTouchEvent = null;

class MTEvent {
	constructor(original, isTouch, currentTarget, clientX, clientY, altKey, shiftKey, ctrlKey, buttons) {
	    this.original = original;
		this.isTouch = isTouch;
		this.currentTarget = currentTarget;
		this.target = currentTarget;
		this.clientX = clientX;
		this.clientY = clientY;
		this.altKey = altKey;
		this.shiftKey = shiftKey;
		this.ctrlKey = ctrlKey;
		this.buttons = buttons;
		lastMTEvent = this;
	}

	preventDefault() {
        this.original.preventDefault();
	}
}

function mouseEventToMTEvent(e, overrideTarget=null) {
    return new MTEvent(e, false,
        overrideTarget ? overrideTarget : e.currentTarget,
        e.clientX, e.clientY,
        e.altKey, e.shiftKey, e.ctrlKey || e.metaKey,
        e.buttons);
}

function touchEventToMTEvent(e, overrideTarget=null) {
    // this gets tricky because the first touch in the list may not necessarily be the first touch, and
    // you can end multi-touch with a different touch than the one you started with
    var primary = null;

    if (e.touches.length > 0) {
        // meh, just make the first one in the list the primary, no need to get fancy with multi-touch
        primary = e.touches[0];
    }

    if (primary) {
        // we can generate an event, yay our team
        lastTouchEvent = new MTEvent(e, true,
            overrideTarget ? overrideTarget : primary.target,
            primary.clientX, primary.clientY,
            e.altKey, e.shiftKey, e.touches.length);
        return lastTouchEvent;

    } else if (lastTouchEvent != null) {
        // If a touch ends then we need to look at last event to know where the touch was when it ended
        return lastTouchEvent;

    } else {
        console.log("bogus touch event");
    }
}

function setupDragDropListeners(onDrag, onDrop) {
    // set up drag listeners on the document itself
    // touch events down work across DOM elements unless you go all the way
    // to the document level
    document.onmousemove = (e) => { onDrag(mouseEventToMTEvent(e)); };
    document.onmouseup = (e) => { onDrop(mouseEventToMTEvent(e)); };
    document.ontouchmove = (e) => { onDrag(touchEventToMTEvent(e)); };
    document.ontouchend = (e) => { onDrop(touchEventToMTEvent(e)); };
}

function clearDragDropListeners() {
    // remove drag/drop listeners from the document
    document.onmousemove = null;
    document.onmouseup = null;
    document.ontouchmove = null;
    document.ontouchend = null;
}

class CopyData {
    constructor(measure, section) {
        this.section = section;
        this.sectionMetaData = sectionMetaData[this.section];
        // initialize the note array, 16x23 notes
        this.notes = Array(16);
        for (var t = 0; t < this.notes.length; t++) {
            this.notes[t] = new Array(13);
            for (var r = this.sectionMetaData.rowStart; r <= this.sectionMetaData.rowStop; r++) {
                this.notes[t][r] = measure ? measure.notes[t][r].enabled : false;
            }
        }
    }

    apply(measure) {
        // iterate over all notes in the section
        for (var t = 0; t < this.notes.length; t++) {
            for (var r = this.sectionMetaData.rowStart; r <= this.sectionMetaData.rowStop; r++) {
                // copy the enabled state from each note in the source measure
                // to the corresponding note in this measure
                measure.notes[t][r].setEnabled(this.notes[t][r]);
            }
        }
    }

    createSwapped(section) {
        // shortcut
        if (section == this.section) {
            return this;
        }

        // make sure the sections are the same size
        if ((this.sectionMetaData.rowStop - this.sectionMetaData.rowStart) !=
                (sectionMetaData[section].rowStop - sectionMetaData[section].rowStart)) {
            throw "Cannot swap " + this.section + " and " + section;
        }

        // create a new object
        var copy = new CopyData(null, section);

        // get the offset from the current section to the new one
        var rOffset = copy.sectionMetaData.rowStart - this.sectionMetaData.rowStart;
        // copy data
        for (var t = 0; t < this.notes.length; t++) {
            for (var r = this.sectionMetaData.rowStart; r <= this.sectionMetaData.rowStop; r++) {
                // use the offset to copy data to the new section in the new object
                copy.notes[t][r + rOffset] = this.notes[t][r];
            }
        }
        return copy;
    }
}

class CopyPerformance {
    constructor(score) {
        this.packs = {};
        this.volumes = {};
        for (var section in score.sections) {
            this.packs[section] = score.sections[section].pack;
            this.volumes[section] = score.sections[section].volume;
        }
    }

    apply(score) {
        for (var section in score.sections) {
            score.sections[section].setPack(this.packs[section], true, true);
            score.sections[section].setVolume(this.volumes[section], true, false, true);
        }
    }
}

function getCopyDataSection(copyData) {
    // it can be an array or a single one because of reasons
    if (copyData.length) {
        return copyData[0].section;

    } else {
        return copyData.section;
    }
}

function swapCopyDataSection(copyData, section) {
    if (copyData.length) {
        // copy each measure in the array
        var newCopyData = [];
        for (var i = 0; i < copyData.length; i++) {
            newCopyData.push(copyData[i].createSwapped(section));
        }
        return newCopyData;

    } else {
        // just one emasure
        return copyData.createSwapped(section);
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
        this.selectBox = null;

        // mouse state
        this.hovering = false;
        this.hoveredTime = -1;
        this.hoveredRow = -1;
        
        // playback state
        this.timingBar = null;
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
                <span class="imgButton clearButton tooltip" onclick="clearButton(this)"><img src="img/icon-clear.png" srcset="img2x/icon-clear.png 2x" alt="Clear"/>
                    <span class="tooltiptextbottom">Clear all or part of the measure</span>
                </span>
                <span class="imgButton copyButton tooltip" onclick="copyButton(this)"><img src="img/icon-copy.png" srcset="img2x/icon-copy.png 2x" alt="Copy"/>
                    <span class="tooltiptextbottom">Copy all or part of the measure</span>
                </span>
                <span class="imgButtonDisabled pasteButton tooltip" onclick="pasteButton(this)"><img src="img/icon-paste.png" srcset="img2x/icon-paste.png 2x" alt="Paste"/>
                    <span class="tooltiptextbottom">Paste the last copied measure or partial measure</span>
                </span>
                <span class="imgButton playButton tooltip" onclick="playButton(this)"><img src="img/icon-play.png" srcset="img2x/icon-play.png 2x" alt="Play"/>
                    <span class="tooltiptextbottom">Play this measure</span>
                </span>
            </div>
        `;
        this.container.appendChild(this.buttons);

        // we need something that contains the timing bar, playback marker, and measure image
        this.measureTimingContainer = document.createElement("div");
        this.measureTimingContainer.className = "measureTimingContainer";
        this.measureTimingContainer.style.width = (gridSizeX * 16) + "px";
        this.measureTimingContainer.style.height = (gridSizeY * 14) + "px";
        // this back-reference is used by the drag handler
        this.measureTimingContainer.measure = this;
        this.measureTimingContainer.disabled = false;
        this.container.appendChild(this.measureTimingContainer);

        // container for the timing bar
        this.timingContainer = document.createElement("div");
        this.timingContainer.className = "timingContainer";
        this.timingContainer.style.width = (gridSizeX * 16) + "px";
        this.timingContainer.style.height = (gridSizeY) + "px";
        this.timingContainer.innerHTML = `<img src="img/timingbar.png" srcset="img2x/timingbar.png 2x"/>`;
        // back-reference
        this.timingContainer.measure = this;
        this.measureTimingContainer.appendChild(this.timingContainer);

        // container for the background image and all note images
        this.imgContainer = document.createElement("div");
        this.imgContainer.className = "measureImgContainer";
        // set its size to match the size of the background image
        this.imgContainer.style.width = (gridSizeX * 16) + "px";
        this.imgContainer.style.height = (gridSizeY * 13) + "px";
        // back-reference
        this.imgContainer.measure = this;
        this.measureTimingContainer.appendChild(this.imgContainer);

        // create the background grid image
        this.gridImg = createNoteImage(imgGrid[this.number]);
        // absolute positioning
        this.gridImg.className = "measureImg";
        this.gridImg.style.left = 0;
        this.gridImg.style.top = 0;
        // todo: which of these back-references do we actually need?
        this.gridImg.measure = this;
        this.imgContainer.appendChild(this.gridImg);

        this.resetListeners();
    }

    resetListeners() {
        // default listener state, ready to enter notes or start dragging the playback marker
        this.gridImg.onmouseover = (e) => { this.measureMouseover(e); };
        this.gridImg.onmousemove = (e) => { this.measureMousemove(e); };
        this.gridImg.onmousedown = (e) => { this.measureMousedown(e); }; // touch event default click handler calls this
        this.gridImg.onmouseout = (e) => { this.measureMouseout(e); };

        this.timingContainer.onmousedown = (e) => { this.startDrag(mouseEventToMTEvent(e)); };
        this.timingContainer.ontouchstart = (e) => { this.startDrag(touchEventToMTEvent(e)); };

        this.measureTimingContainer.disabled = false;
    }
    
    disableListeners(disableTimingBar=false) {
        // listener state when dragging the playback marker and not an actively playing measure
        // listener state when dragging the playback marker, still hover but don't enter notes
        this.gridImg.onmouseover = (e) => { this.measureMouseover(e, false); };
        this.gridImg.onmousemove = (e) => { this.measureMousemove(e, false); };
        this.gridImg.onmousedown = null;
        this.gridImg.onmouseout = (e) => { this.measureMouseout(e); };

        this.timingContainer.onmousedown = null;
        this.timingContainer.ontouchstart = null;

        if (disableTimingBar) {
            this.measureTimingContainer.disabled = true;
        }
    }

    startDrag(e) {
        // get or create a playback marker
        var marker = this.score.getPlaybackMarker();
        // start dragging
        marker.startDrag(e, this);
    }

    disableDrag() {
        // prevent any event handling on the timing bar
        this.timingContainer.onmousedown = (e) => { e.preventDefault(); };
        this.timingContainer.ontouchstart = (e) => { e.preventDefault(); };
        // switch image
        this.timingContainer.className = "timingContainer_disabled";
        this.timingContainer.innerHTML = `<img src="img/timingbar-disabled.png" srcset="img2x/timingbar-disabled.png 2x" width="352" height="25"/>`;
    }

    enableDrag() {
        this.timingContainer.onmousedown = (e) => { this.startDrag(mouseEventToMTEvent(e)); };
        this.timingContainer.ontouchstart = (e) => { this.startDrag(touchEventToMTEvent(e)); };
        // switch image
        this.timingContainer.className = "timingContainer";
        this.timingContainer.innerHTML = `<img src="img/timingbar.png" srcset="img2x/timingbar.png 2x" width="352" height="25"/>`;
    }

    setMeasureNotes(mnotes, action=true) {
        // load note info from an external source
        for (var t = 0; t < 16; t++) {
            for (var r = 0; r < 13; r++) {
                // rows from the song parser are in reverse order
                this.notes[t][r].setEnabled(mnotes[t][12-r] == 1, action);
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

    measureMouseover(e, writeNotes = true) {
        this.doMouseover();
        // also consider this a mouse move event
        this.measureMousemove(e, writeNotes);
    }

    measureMousedown(e) {
        this.measureMouseEvent(e, true);
    }

    measureMousemove(e, writeNotes = true) {
        this.measureMouseEvent(e, false, writeNotes);
    }

    measureMouseEvent(e, click, writeNotes) {
        e.preventDefault();
        // surprisingly hard to get the coordinates of the event in the target elements coordinate space
        var targetRect = e.target.getBoundingClientRect();
        var x = Math.round(e.clientX - targetRect.left);
        var y = Math.round(e.clientY - targetRect.top);
        // see if it's a drag event
        var down = writeNotes && e.buttons != 0;
        // call the measure's handler
        this.doMousemove(x, y, down, click);
    }

    measureMouseout() {
        // forward a mouseout event to the measure's handler
        var e = window.event;
        e.preventDefault();
        var measure = e.currentTarget.measure;
        measure.doMouseout();
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
        if (this.selectBox != null) {
            // clear all selection state and UI
            this.selectBox.remove();
            this.selectBox = null;
        }
    }

    showSelection(section) {
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

        setTimeout(() => { this.clearSelection(); }, 1000);
    }

    copy(section) {
        // clear any existing selection
        this.clearSelection();

        if (section != null) {
            this.score.setCopyData(new CopyData(this, section));
            this.showSelection(section);
        }
    }

    setPasteEnabled(enabled) {
        // get the paste button and enabled/disable based on whether something is selected for copy
        setButtonEnabled(getFirstChild(this.buttons, "pasteButton"), enabled);
    }

    paste(copyData) {
        if (copyData) {
            // contain all the note changes in a single undo action
            this.score.startActions();
            // apply the copy data
            copyData.apply(this);
            // commit the undo action
            this.score.endActions();
            // UI feedback
            this.showSelection(copyData.section);
        }
    }

    play(button, restart=false) {
        // start playback with a single measure
        this.score.doPlayback(button, [this], restart);
    }

    startPlaybackMarker(playbackMarker) {
        this.playbackMarker = playbackMarker;
    }

    setPlaybackMarkerTime(time, bumpFirst=false) {
        // get the previous and current playback columns, 16 columns across a 2-second measure
        var oldT = Math.floor(this.playbackMarker.time * 8.0);
        var newT = Math.floor(time * 8.0);

        // loop from oldT + 1 to newT, if they are the same then this loops zero times,
        // if we've moved forward one frame then this runs once
        // if we've somehow missed a few frames then this catches us up.
        for (var t = oldT + (bumpFirst ? 0 : 1); t <= newT; t++) {
            this.bounceTime(t);
        }

        // update state
        this.playbackMarker.setTime(this, time);
    }

    bounceTime(t) {
        for (var r = 0; r < 13; r++) {
            // only bounce the note if it's enable and its section's audio is enabled
            if (this.notes[t][r].enabled && this.score.soundPlayer.isEnabled(r)) {
                this.notes[t][r].bounce();
            }
        }
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

    draw(context, imageMap, startX, startY, scale) {
        // set the start x coordinate based on which measure this is
        startX = startX + (gridSizeX * 16) * this.number;

        // draw the timing bar
        context.drawImage(imageMap["timingbar"], startX * scale, startY * scale);

        // move down under the timing bar
        startY = startY + gridSizeY;

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
            <td><img src="img/${sectionImages[this.section]}.png" srcset="img2x/${sectionImages[this.section]}.png 2x"/></td>
            <td><span>${sectionMetaData[this.section].displayName}</span></td>
            <td><select class="dropDown sectionPack" onchange="sectionPack()">`;

        // fill in the instrument pack drop-down options
        for (var i = 0; i < packs.length; i++) {
            html += `<option value="${packs[i].name}">${packs[i].displayName}</option>`;
        }

        // finish the drop-down, build the volume slider and enable checkbox
        html += `</select></td>`;

        // save the row contents so far
        tr.innerHTML = html;

        // add the slider and toggle
        this.mainSlider.buildUI(tr);

        // the TR is our main container
        this.container = tr;
    }

    setEnabled(row, enabled) {
        // pass through to the score's audio player to enable or disable a row
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

    buildMixerUI(table) {
        // build section mixer
        this.mixerMainSlider = new MixerSlider(this, true);

        // build the beginning of the section mixer row
        var tr = document.createElement("tr");
        tr.className = "sectionRow";
        tr.innerHTML = `
                <td style="text-align:right">
                    <span style="color:${sectionMetaData[this.section].color}">${sectionMetaData[this.section].displayName}</span>
                </td>
                <td/>`;

        // add the section slider and toggle
        this.mixerMainSlider.buildUI(tr);

        // add the section mixer row to the table
        table.appendChild(tr);

        // set up mirror for the two main sliders, their state needs to be synchronized.
        this.mainSlider.toggleMirror = this.mixerMainSlider;
        this.mixerMainSlider.toggleMirror = this.mainSlider;

        // individual row mixers
        for (var row = this.metadata.rowStart; row <= this.metadata.rowStop; row++) {
            // build a row slider
            var slider = new MixerSlider(this, true, row - this.metadata.rowStart);
            this.mixerRowSliders[row - this.metadata.rowStart] = slider;

            // build the beginning of the mixer row
            tr = document.createElement("tr");
            tr.className = "sectionRow";
            tr.innerHTML = `
                <td style="text-align:right">
                    <span style="color:${sectionMetaData[this.section].color}">${row - this.metadata.rowStart + 1}</span>
                </td>
                <td><img src="img/${imgRow[row]}.png" srcset="img2x/${imgRow[row]}.png 2x"/></td>`;

            // add the slider and toggle
            slider.buildUI(tr);
            // add the mixer row to the table
            table.appendChild(tr);
        }
    }

    resetMixer() {
        // reset the section mixer volume to 1
        this.mixerMainSlider.setVolumeValue(1);
        // propagate the change to the row mixers
        this.mixerVolumeChange(true, null, 1, false);

        // reset the section mixer toggle to 1
        this.mixerMainSlider.setToggleValue(true);
        // propagate the change to the row mixers
        this.mixerToggleChange(null, true, false);
    }

    mixerVolumeChange(isMixer, row, value, commit, secondary=false) {
        if (!isMixer) {
            // the volume change is coming from the main song section editor, change the song volume
            this.setVolume(value, true, !commit);

        } else if (row == null) {
            // the volume change is coming from the main section mixer
            // propagate the change to the row mixers
            for (var i = 0; i < this.mixerRowSliders.length; i++) {
                this.mixerVolumeChange(isMixer, i, value, commit, true);
            }

        } else if (isMixer) {
            if (secondary) {
                // this is a change being propagated from the main mixer, just change the UI
                this.mixerRowSliders[row].setVolumeValue(value);

            } else {
                // the row mixer is being changed directly
                // calculate the average volume among all the row mixers
                var totalValue = 0;
                var totalCount = 0;
                for (var i in this.mixerRowSliders) {
                    totalValue += this.mixerRowSliders[i].getVolumeValue();
                    totalCount += 1;
                }
                // update the section mixer value
                this.mixerMainSlider.setVolumeValue(totalValue / totalCount);
            }

            // propogate as a mix volume for that row's sound in the audio player
            this.score.soundPlayer.setMixVolume(this.metadata.rowStart + row, value);
        }
    }

    mixerToggleChange(row, enabled, secondary=false) {
        if (row == null) {
            // the toggle change is happening in the section mixer of the song editor, they do the same thing
            // propagate the chage to each row mixer, making them match the section toggle
            for (var i = 0; i < this.mixerRowSliders.length; i++) {
                this.mixerToggleChange(i, enabled, true);
            }

        } else {
            if (secondary) {
                // this is a change being propagated from the main mixer, just change the UI
                this.mixerRowSliders[row].setToggleValue(enabled);

            } else if (enabled && !this.mixerMainSlider.getToggleValue()) {
                // a row mixer was directly enabled, set the section mixer to enabled as well
                this.mixerMainSlider.setToggleValue(true);

            } else if (!enabled) {
                // a row mixer was directly disabled, see if there are any row mixers in this section that are still enabled
                var oneEnabled = false;
                for (var i = 0; i < this.mixerRowSliders.length; i++) {
                    if (this.mixerRowSliders[i].getToggleValue()) {
                        oneEnabled = true;
                        break;
                    }
                }
                // if there are no row editors enabled, then switch the section mixer toggle to disabled
                if (!oneEnabled) {
                    this.mixerMainSlider.setToggleValue(false);
                }
            }
            // propagate the enable change to the audio player
            this.setEnabled(row, enabled);
        }
    }

    exportMixer() {
        var sectionString = "";
        var first = true;
        var hasAdjustments = false;
        // just export the individual note track settings
        for (var i = 0; i < this.mixerRowSliders.length; i++) {
            // comma delimiter between note tracks
            if (!first) {
                sectionString += ",";
            }
            first = false;
            // get the note track mixer settings
            var volume = this.mixerRowSliders[i].getVolumeValue();
            var toggle = this.mixerRowSliders[i].getToggleValue();
            // only add something for the volume if it's not 100%
            if (volume != 1) {
                sectionString += (Math.round(volume * 100));
                hasAdjustments = true;
            }
            // only add something for the toggle if it's toggled off
            if (!toggle) {
                // separator if both the volume and toggle need to be exported
                if (volume != 1) {
                    sectionString += "|";
                }
                sectionString += "off";
                hasAdjustments = true;
            }
        }
        // If nothing was changed fro the defaults then we don't need a config
        if (!hasAdjustments) {
            return "";
        } else {
            return sectionString;
        }
    }

    importMixer(string) {
        // if it's a blank string then just reset to defaults
        if (string.length == 0) {
            this.resetMixer();
            return;
        }
        // split by note tracks
        var trackStrings = string.split(",");
        // format check
        if (trackStrings.length != this.mixerRowSliders.length) {
            throw "Invalid mixer format: section " + this.section;
        }
        // start with defaults
        this.resetMixer();
        for (var i = 0; i < this.mixerRowSliders.length; i++) {
            var slider = this.mixerRowSliders[i];
            // check for delimiter
            var s = trackStrings[i].split("|");
            // format check
            if (s.length > 2) {
                throw "Invalid mixer format: section " + this.section + ", track " + (i + 1);
            }
            // go over each delimited note track setting
            for (var j = 0; j < s.length; j++) {
                // if it's the string "off" then turn the note track off
                if (s[j] == "off") {
                    // set the track mixer toggle to disabled
                    slider.setToggleValue(false);
                    // propagate the change
                    this.mixerToggleChange(i, false, false);
                // otherwise, if it's a non-empty string then assume it's a volume
                } else if (s != "") {
                    // parse the volume and check for invalid values
                    var volume = parseInt(s[j]);
                    if (Number.isNaN(volume) || volume < 0 || volume > 100) {
                        throw "Invalid mixer format: section " + this.section + ", track " + (i + 1) + ", volume: " + s[j];
                    }
                    // set the track mixer volue
                    slider.setVolumeValue(volume / 100);
                    // propagate the change
                    this.mixerVolumeChange(true, i, volume / 100, false);
                }
            }
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
    constructor(sectionEditor, isMixer=false, row=null, toggleMirror=null, noToggle=false) {
        this.sectionEditor = sectionEditor;
        this.isMixer = isMixer;
        this.row = row;
        this.noToggle  = noToggle;
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

        if (!this.noToggle) {
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
            // skip the "all" and "performance" sections
            if (sectionMetaData[name].all || sectionMetaData[name].maxNotes == 0) continue;
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
        this.sectionContainer = document.createElement("div");
        this.sectionContainer.style.position = "relative";
        var sectionTable = document.createElement("table");
        sectionTable.style.display = "inline-block";

        // section editors
        for (var name in this.sections) {
            sectionTable.appendChild(this.sections[name].container);
        }

        this.sectionContainer.appendChild(sectionTable);
        this.songControls.appendChild(this.sectionContainer);

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
                <span id="undoButton" class="imgButtonDisabled undoButton tooltip" onclick="doUndo(this)"><img src="img/icon-undo.png" srcset="img2x/icon-undo.png 2x" alt="Redo"/>
                    <span class="tooltiptextbottom">Undo the last action</span>
                </span>
                <span id="redoButton" class="imgButtonDisabled redoButton tooltip" onclick="doRedo(this)"><img src="img/icon-redo.png" srcset="img2x/icon-redo.png 2x" alt="Redo"/>
                    <span class="tooltiptextbottom">Redo the last undone action</span>
                </span>
                <span class="imgButton clearButton tooltip" onclick="clearButton(this)"><img src="img/icon-clear.png" srcset="img2x/icon-clear.png 2x" alt="Clear"/>
                    <span class="tooltiptextbottom">Clear all or part of the song</span>
                </span>
                <span class="imgButton copyButton tooltip" onclick="copyScoreButton(this)"><img src="img/icon-copy.png" srcset="img2x/icon-copy.png 2x" alt="Copy"/>
                    <span class="tooltiptextbottom">Copy all or part of the song</span>
                </span>
                <span class="imgButtonDisabled pasteButton tooltip" onclick="pasteButton(this)"><img src="img/icon-paste.png" srcset="img2x/icon-paste.png 2x" alt="Paste"/>
                    <span class="tooltiptextbottom">Paste the last copied song or partial song</span>
                </span>
                <span id="mainPlayButton" class="imgButton playButton tooltip" onclick="playButton(this)"><img src="img/icon-play.png" srcset="img2x/icon-play.png 2x" alt="Play"/>
                    <span class="tooltiptextbottom">Play the song</span>
                </span>
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
                <input class="songTitle" type="text" size="36" maxlength="24" onchange="titleChanged()"/>
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

    setSong(songCode, action=true, resetPlayback=false) {
        // parse the song code
        var song = new Song();
        song.parseChatLink(songCode);
        this.setSongObject(song, action, resetPlayback);
    }

    setSongObject(song, action=true, resetPlayback=false) {
        if (resetPlayback) {
            // remember whether we were playing before stopping playback
            var playing = this.isPlaying();
            this.stopPlayback();
        }
        if (action) {
            // put the entire process of loading the song into a single undo action
            this.startActions();
        }

        // set the title, make sure to update the UI
        this.setTitle(song.getName(), action, true);

        // loop over each section that's not the "all" section
        for (var section in sectionMetaData) {
            if (!sectionMetaData[section].all) {
                // set the instrument pack, make sure to update the UI
                this.sections[section].setPack(song.getPack(section), action, true);
                // set the volume, make sure to update the UI
                // song stores the volume as a percentage 0-100
                this.sections[section].setVolume(song.getVolume(section) / 100.0, action, false, true);
            }
        }

        for (var m = 0; m < 4; m++) {
            // extract each measure's note info from the parsed song and update the measure UI
            this.measures[m].setMeasureNotes(song.getMeasureNotes(m), action);
        }

        // commit as a single undo action
        if (action) {
            this.endActions();
        }

        // resume playing if it was playing before
        if (resetPlayback && playing) {
            this.togglePlaying();
        }
    }

    getSongObject() {
        // make sure we have the latest from the title editor
        // If it still had focus when a playlist entry is clicked then it won't have fired the onupdate event yet
        var title = getFirstChild(this.titleContainer, "songTitle").value
        if (title != this.title) {
            this.setTitle(title);
        }

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

    setCopyData(copyData) {
        this.copyData = copyData;
        // check if it's an array or a performance
        if (this.copyData.length || this.copyData.packs) {
            // whole song copy, enable the song paste button and disable the measure paste buttons
            this.setPasteEnabled(true);
            for (var m = 0; m < 4; m++) {
                this.measures[m].setPasteEnabled(false);
            }

        } else {
            // single measure copy, enable the measure paste buttons and disable the song paste button
            this.setPasteEnabled(false);
            for (var m = 0; m < 4; m++) {
                this.measures[m].setPasteEnabled(true);
            }
        }
    }

    copy(section) {
        if (section == "perf") {
            var copyData = new CopyPerformance(this);
            this.setCopyData(copyData);
            this.showPerformanceSelection();

        } else {
            // build copy data for all four measures
            var copyDataList = [];
            for (var m = 0; m < 4; m++) {
                // directly copy measure
                copyDataList.push(new CopyData(this.measures[m], section));
                // flash the selection
                this.measures[m].showSelection(section);
            }
            // set the copy data to a list and enable/disable paste buttons accordingly
            this.setCopyData(copyDataList);
        }
    }

    paste(copyData) {
        this.startActions();
        if (this.copyData.packs) {
            // performance
            this.copyData.apply(this);
            this.showPerformanceSelection();

        } else {
            // paste all four measures
            for (var m = 0; m < 4; m++) {
                this.measures[m].paste(copyData[m]);
            }
        }
        this.endActions();
    }

    clearSelection() {
        if (this.selectBox != null) {
            // clear all selection state and UI
            this.selectBox.remove();
            this.selectBox = null;
        }
    }

    showPerformanceSelection(section) {
        // create the selection box, it's just a div with a border
        var selectBox = document.createElement("div");
        // absolutely position it according to the section
        selectBox.className = "measureSelectBox";
        var bcr = score.sectionContainer.getBoundingClientRect()
        selectBox.style.width = bcr.width;
        selectBox.style.height = bcr.height;
        selectBox.style.left = 0;
        selectBox.style.top = 0;
        // set the color based on the section
        selectBox.style.borderColor = "#ffffff";
        score.sectionContainer.appendChild(selectBox);

        setTimeout(() => {
            selectBox.remove();
        }, 1000);
    }

    setPasteEnabled(enabled) {
        // get the paste button and enabled/disable based on whether something is selected for copy
        setButtonEnabled(getFirstChild(this.buttons, "pasteButton"), enabled);
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
        // update the title in the playlist, if there's an entry selected
        if (this.playlist && this.playlist.selected) {
            this.playlist.selected.updateSong();
        }
    }

    setSectionSource(section, pack) {
        // save the section pack info
        this.sectionPacks[section] = pack;
        // set the audio source
        this.soundPlayer.setSource(section, pack, this.isSectionMono(section));
    }

    precacheSectionSource(section, pack) {
        // set the audio source
        this.soundPlayer.setSource(section, pack, this.isSectionMono(section, pack), true);
    }

    isSectionMono(section, pack=this.sectionPacks[section]) {
        return instrumentNameToPack[pack].mono[section];
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

    togglePlaying(restart=false) {
        // space bar handler
        if (this.playback != null && !restart) {
            // if we are currently playing something, then either pause or resume it.
            this.playback.toggle();
        } else {
            // otherwise pretend the user clicked the song play button
            this.play(getFirstChild(this.buttons, "playButton"), restart);
        }
    }

    play(button, restart=false) {
        // start playback with all four measures
        this.doPlayback(button, this.measures, restart);
    }

    doPlayback(button, m, restart=false) {
        // if there already is a playback in progress
        if (button.playback != null && !restart) {
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

    getPlaybackMarker() {
        // start playback if there isn't one active
        if (!this.playback) {
            this.playback = new Playback(this, document.getElementById("mainPlayButton"), this.measures);
        }
        // get the marker
        return this.playback.marker;
    }

    disableListeners() {
        for (var m = 0; m < 4; m++) {
            this.measures[m].disableListeners();
        }
    }

    resetListeners() {
        for (var m = 0; m < 4; m++) {
            this.measures[m].resetListeners();
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
            "mel": createNoteImagePath(sectionImages["mel"], hidpi),
            "timingbar": createNoteImagePath("timingbar-disabled", hidpi)
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
            + (gridSizeY * 14)
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
        context.fillText("buff0000n.github.io/mandascore", (margin + (gridSizeX * 64)) * scale, (startY + (gridSizeY * 14) + fontSize + (margin / 2)) * scale);

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

// encapsulate the playback marker in its own class
class PlaybackMarker {
    constructor(playback) {
        // playback object back reference
        this.playback = playback;

        // measure and last measure
        // todo: do we need lastMeasure?
        this.measure = null;
        this.lastMeasure = null;

        // last location
        this.lastTick = null;
        this.time = 0;

        // width of the grabbable area
        this.playbackHandleWidth = 10;
        // build the UI
        this.buildUI();
    }

    buildUI() {
        // just a thin div
        this.playbackBox = document.createElement("div");
        // absolutely positioned
        this.playbackBox.className = "playbackBox";
        this.playbackBox.style.width = "4px";
        this.playbackBox.style.height = (gridSizeY * (13 + 1)) + "px";
        this.playbackBox.style.left = 0;
        this.playbackBox.style.top = 0;

        // grab handle is an invisible div
        this.playbackHandle = document.createElement("div");
        // absolutely positioned
        this.playbackHandle.className = "playbackHandle";
        this.playbackHandle.style.width = (4 + this.playbackHandleWidth*2) + "px";
        this.playbackHandle.style.height = (gridSizeY * (13 + 1)) + "px";
        this.playbackHandle.style.left = -this.playbackHandleWidth;
        this.playbackHandle.style.top = 0;
        // back-references
        this.playbackBox.marker = this;
        this.playbackHandle.marker = this;

        // listeners to start dragging
        this.playbackHandle.onmousedown = (e) => { this.startDrag(mouseEventToMTEvent(e)); };
        this.playbackHandle.ontouchstart = (e) => { this.startDrag(touchEventToMTEvent(e)); };
    }

    setTime(measure, time) {
        // move to the new measure, if necessary
        if (measure != this.measure) {
            if (this.measure != null) {
                this.playbackBox.remove();
                this.playbackHandle.remove();
            }
            this.measure = measure;
            this.measure.measureTimingContainer.appendChild(this.playbackBox);
            this.measure.measureTimingContainer.appendChild(this.playbackHandle);
        }
        // set position
        this.playbackBox.style.left = (gridSizeX * 8) * time;
        this.playbackHandle.style.left = ((gridSizeX * 8) * time) - this.playbackHandleWidth;

        // save time and measure
        this.time = time;
        this.lastMeasure = measure;
    }

    remove() {
        // clean up
        this.playbackBox.remove();
        this.playbackHandle.remove();
        this.playbackBox = null;
        this.playbackHandle = null;
    }

    startDrag(e, measure) {
        // setup all actively playing measure for dragging
        for (var m = 0; m < this.playback.measures.length; m++) {
            var measure2 = this.playback.measures[m];
            measure2.disableListeners(false);
        }

        // disable dragging on any non-active measures
        var others = this.playback.getNonPlayingMeasures();
        for (var m = 0; m < others.length; m++) {
            others[m].disableListeners(true);
        }

        // setup the drag listeners
        setupDragDropListeners(
            (mte) => { this.dragEvent(mte); },
            (mte) => { this.dropEvent(mte); }
        )

        // stop playback if it's currently playing
        if (this.playback.playing()) {
            this.didStop = true;
            this.playback.stop();
        } else {
            this.didStop = false;
        }

        // clear last position
        this.lastMeasure = null;
        this.lastTick = null;

        // set the cursor to grabbing
        this.playbackHandle.className = "playbackHandleGrabbing";
        this.playbackBox.className = "playbackBoxGrabbing";

        // immediately move the marker
        this.dragEvent(e, measure);
    }

    dragEvent(e) {
        e.preventDefault();

        // for touch events our only option is to run in the global document listener and then calculate what
        // element we're over top of
        var element = document.elementFromPoint(e.clientX, e.clientY);
        var timingContainer = getParent(element, "measureTimingContainer");
        if (!timingContainer) {
            // dragging outside the measure containers
            return;
        }

        if (timingContainer.disabled) {
            // dragging to a disabled measure
            return;
        }

        // get the relevant measure
        var measure = timingContainer.measure;
        // calcuate the drag position inside the measure
        var targetRect = timingContainer.getBoundingClientRect();
        var x = Math.round(e.clientX - targetRect.left);

        // time in seconds, 16 grid spaces/2 seconds per measure
        var t = x / (gridSizeX * 8);

        // for some reason the timing bar gets events from outside the measure when
        // it's split into multiple lines
        if (t < 0) t = 0;
        else if (t > 2) t = 2;

        // make sure the playback is stopped
        // todo: necessary?
        this.playback.stop();

        // pre-set the marker time so the measure doesn't try to bump all the intervening notes if you
        // move it forward inside the same measure
        this.time = t;
        measure.startPlaybackMarker(this);
        measure.setPlaybackMarkerTime(t);

        // get the current tick
        var tick = Math.floor(t * 8);

        // if we've moved to a new tick
        if (measure != this.lastMeasure || tick != this.lastTick) {
            // sanity check, we can get 16 here if it's dragged to the exact end of a measure
            if (tick >= 0 && tick < 16) {
                // bounce the notes at this tick
                measure.bounceTime(tick);
                // and play them
                measure.playAudioForTime(tick);
            }
            // save the position for next time
            this.lastMeasure = measure;
            this.lastTick = tick;
        }
    }

    dropEvent(e) {
        this.dragEvent(e);

        // reset any listeners on actively playing measures that were
        // set up for dragging
        for (var m = 0; m < this.playback.score.measures.length; m++) {
            var measure = this.playback.score.measures[m];
            measure.resetListeners();
        }

        // reset any listeners on non-active measures
        var others = this.playback.getNonPlayingMeasures();
        for (var m = 0; m < others.length; m++) {
            others[m].resetListeners();
            others[m].disableDrag();
        }

        // clear drag listeners
        clearDragDropListeners();

        // Figuring out the playback time is complicated by the fact that not all measures may be playing
        var measureTime = this.playback.measures.indexOf(this.measure) * 2;

        // commit the playback time
        this.playback.setTime(measureTime + this.time);

        // if we had to pause playback for the drag process then restart it again
        if (this.didStop) {
            this.playback.start();
        }

        // reset the cursor
        this.playbackHandle.className = "playbackHandle";
        this.playbackBox.className = "playbackBox";
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
        this.currentT = 0;
        // sound play column currently scheduled
        this.playT = 0;
        // the last measure we set playback state on
        this.lastMeasure = null;

        // hack flag to prevent moving to the next playlist entry immediately when starting
        this.hasPlayed = false;
        // flag to prevent an extra tick after being stopped
        this.stopped = false;

        // marker reference
        this.marker = new PlaybackMarker(this);

        // hack flag for when the timing marker has been dragged and dropped
        this.dropped = false;

        // disable dragging on any measure not in the list
        var others = this.getNonPlayingMeasures();
        for (var m = 0; m < others.length; m++) {
            others[m].disableDrag();
        }
    }

    getNonPlayingMeasures() {
        // check f it's just all measures
        if (this.measures.length == this.score.measures.length) {
            return Array();
        }
        // pull out score measures that are not the playvak measure list
        var others = Array();
        for (var m = 0; m < this.score.measures.length; m++) {
            var measure = this.score.measures[m];
            if (!this.measures.includes(measure)) {
                others.push(measure);
            }
        }
        return others;
    }

    playing() {
        // we're playing if we have an animation tick scheduled
        return this.animTimeout != null;
    }

    start() {
        // change the Play button to a Loading button while the sounds are loaded
//        this.button.innerHTML= `<img src="img/icon-pause.png" srcset="img2x/icon-pause.png 2x" alt="Loading"/>`;
        this.button.innerHTML= `Loading...`;
        setButtonEnabled(this.button, false);

        // don't start playing until the player has been initialized
        // After the sound player is loaded this should go straight through to loaded()
        this.score.soundPlayer.initialize(() => this.loaded());
    }

    loaded() {
        // change the Play button to a Stop button
        this.button.innerHTML= `<img src="img/icon-stop.png" srcset="img2x/icon-stop.png 2x" alt="Stop"/>`;
        setButtonEnabled(this.button, true);
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
        this.button.innerHTML= `<img src="img/icon-play.png" srcset="img2x/icon-play.png 2x" alt="Play"/>`;

        // set a flag
        this.stopped = true;
    }

    setTime(t) {
        // explicitly set playback time
        // get the current time
        var time = getTime() / 1000;
        // retroactively set time zero for the current iteration of the loop
        this.startTime = time = t;
        // current time within the loop, prevent dragging beyond the end of the currently playing measures
        this.currentTime = t >= this.runTime ? 0 : t;
        // current time column
        this.currentT = Math.floor(this.currentTime * 8);
        // sound play column currently scheduled, set to the next time segment
        this.playT = (this.currentT + 1) % this.runT;
        // have to reset the last measure to prevent weirdness
        this.lastMeasure = this.measures[Math.floor(this.currentTime / 2.0)];
        // set the dropped flag
        this.dropped = true;
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
        // remove the back-reference
        this.button.playback = null;
        this.marker.remove();

        // re-enable dragging on any measure not in the list
        var others = this.getNonPlayingMeasures();
        for (var m = 0; m < others.length; m++) {
            others[m].enableDrag();
        }
    }

    playAudio(delay) {
        // hack to switch to the next song in the playlist
        // only switch if we've played through once, have wrapped back to 0, have four measures,
        // have a playlist, and the playlist is enabled.
        if (this.hasPlayed && !this.dropped && this.playT == 0 && this.runT > 0 && this.measures.length == 4 &&
            this.score.playlist != null && this.score.playlist.looping) {
            this.score.playlist.selectNext();
        }
        this.hasPlayed = true;

        // play the audio for the current playT time column
        // get the correct measure
        var measure = Math.floor(this.playT / 16);
        // play the measure's corresponding time column
        this.measures[measure].playAudioForTime(this.playT - (measure * 16), delay);
        // reset the flag
        this.dropped = false;
    }

    tick(start=false) {
        // check for stopped, we don't want an extra tick
        if (!start && this.stopped) {
            return;
        }
        // reset the flag
        this.stopped = false;

        // schedule the next tick right away, so we get as close to the specified animation speed as possible
        this.animTimeout = setTimeout(() => { this.tick() }, tickms);

        // get the current time in seconds
        var time = getTime() / 1000;

        // flag to keep track of whether we wrapped to the beginning of a measure
        var measureWrapped = false;

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
                // set the flag
                measureWrapped = true;
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
            // start playback on the new measure
            this.lastMeasure = measure;
            // initialize the playback marker to just before the start
            this.marker.setTime(measure, 0);
            measure.startPlaybackMarker(this.marker);
            measureWrapped = true;
        }
        // determining when to bounce the first column of notes in a measure is tricky
        // force the bounce if we're starting playback at the exact beginning of a measure,
        var forceBounce = (this.currentTime % 2 == 0 && start)
            // or if we're in the first column and have just wrapped around to a new measure
            // or the beginning of the same measure
            || ((this.currentTime % 2) < (1 / 8) && measureWrapped);

        if (forceBounce) {
            // still pretty hacky I guess, but not as much as before
            this.marker.time = 0;
        }

        // set the measure's playback state
        measure.setPlaybackMarkerTime(this.currentTime % 2, forceBounce);
    }

}