function clearPlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();

    // get the playlist
    var playlist = getParent(button, "playlistBox").playlist;

    // clear the playlist, no confirmation necessary because we have undo now
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
    clearErrors();
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
		case "NumpadEnter" :
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
                <input class="titleButton" type="submit" value="Playlist"/>
                <span class="imgButton addButton tooltip" onclick="addToPlaylist(this)"><img src="img/icon-add.png" srcset="img2x/icon-add.png 2x" alt="Add"/>
                    <span class="tooltiptextbottom">Add or duplicate the currently selected song</span>
                </span>
                <span class="imgButton loopButton tooltip" onclick="loopPlaylist(this)"><img src="img/icon-playlist-enabled.png" srcset="img2x/icon-playlist-enabled.png 2x" alt="Enabled"/>
                    <span class="tooltiptextbottom">Disable the playlist advancing to the next song</span>
                </span>
                <span class="imgButton clearButton tooltip" onclick="clearPlaylist(this)"><img src="img/icon-clear.png" srcset="img2x/icon-clear.png 2x" alt="Clear"/>
                    <span class="tooltiptextbottom">Clear the playlist</span>
                </span>
                <span class="imgButton editButton tooltip" onclick="editPlaylist(this)"><img src="img/icon-playlist-copypaste.png" srcset="img2x/icon-playlist-copypaste.png 2x" alt="Copy/Paste"/>
                    <span class="tooltiptextbottom">Copy/Paste the playlist to the clipboard</span>
                </span>
                <span id="playlistCopyUrlButton" class="imgButton urlButton popup tooltip" onclick="copyPlaylistUrl(this)"><img src="img/icon-link.png" srcset="img2x/icon-link.png 2x" alt="Generate Link"/>
                    <div class="popuptext" id="playlistPopupBox">
                        <input id="playlistUrlHolder" type="text" size="60" onblur="hideUrlPopup()"/>
                    </div>
                    <span class="tooltiptextbottom">Generate a link containing the entire playlist</span>
                </span>
            </div>
        `;

        // get a reference to the looping toggle button
        this.loopingButton = getFirstChild(this.playlistBox, "loopButton");

        getFirstChild(this.playlistBox, "titleButton").addEventListener("click", () => { this.hide() });

        this.playlistScrollArea = document.createElement("div");
        this.playlistScrollArea.className = "playlistScrollArea";
        this.playlistBox.appendChild(this.playlistScrollArea);
    }

    hide() {
        hidePlaylist();
    }

    makeNameUnique(song) {
        // make the name unique
        var name = song.name;
        for (;;) {
            if (!this.entries.find((entry) => entry.song.name == name)) {
                break;
            }
            name = this.incrementName(name);
        }
        song.name = name;
    }

    add(action=true) {
        if (this.entries.length == 0 || !this.selected) {
            // pull the current song from the score
            var song = this.score.getSongObject();
            this.makeNameUnique(song);
            // add the song and automatically select it
            this.addSong(song, true, true, action);

        } else {
            this.selected.updateSong();
            var startIndex = -1;
            var endIndex = -1;
            var newSelected = null;
            var newEntryList = [];
            for (var i = 0; i < this.entries.length; i++) {
                var hEntry = this.entries[i];
                if (hEntry.highlighted) {
                    if (startIndex == -1) {
                        startIndex = i;
                    }
                    var newEntry = new PlaylistEntry(hEntry.song, this);
                    newEntryList.push(newEntry);
                    if (hEntry.selected) {
                        newSelected = newEntry;
                    }
                } else if (startIndex > -1) {
                    endIndex = i - 1;
                    break;
                }
            }
            if (endIndex == -1) { endIndex = this.entries.length - 1; }
            this.addSongEntries(newEntryList, newSelected, endIndex + 1, action);
        }
    }

    addSongCode(code, select, insert=true, action=true) {
        var song = new Song();
        song.parseChatLink(code);
        this.addSong(song, select, insert, action);
    }

    addSong(song, select, insert=true, action=true) {
        // variable for index search
        var index = -1;

        if (this.selected && insert) {
            // if there's a selection, the insert the new entry immediately after the selection
            index = this.entries.indexOf(this.selected) + 1;

        } else {
            // otherwise insert the entry at the end
            index = this.entries.length;
        }

        // create a new entry
        var entry = new PlaylistEntry(song, this);

        // add the entry
        this.addSongEntries([entry], select ? entry : null, index, action);
    }

    addSongEntries(entryList, selectEntry, index, action=true) {
        var doReindex = false;
        for (var e = 0; e < entryList.length; e++) {
            var entryIndex = index + e;
            var entry = entryList[e];
            if (entryIndex == 0) {
                // insert at the beginning
                this.entries.unshift(entry);
                // do the same insertion in the dom, probably an easier way
                if (this.entries.length == 1) {
                    this.playlistScrollArea.appendChild(entry.playlistEntryContainer);
                } else {
                    insertBefore(entry.playlistEntryContainer, this.entries[1].playlistEntryContainer);
                }
                doReindex = true;

            } else if (entryIndex < this.entries.length) {
                // insert the song in the middle of the playlist
                this.entries.splice(entryIndex, 0, entry);
                // do the same insertion in the dom
                insertBefore(entry.playlistEntryContainer, this.entries[entryIndex+1].playlistEntryContainer);
                // renumber entries
                doReindex = true;

            } else {
                // insert at the end
                this.entries.push(entry);
                // no need to reindex the whole list
                entry.setIndex(this.entries.length);
                // insert into the dom
                this.playlistScrollArea.appendChild(entry.playlistEntryContainer);
            }
        }

        if (doReindex) {
            // renumber entries
            this.reIndex();
        }

        // start an undo action if we need to
        if (action) {
            this.score.startActions();
            this.score.addAction(new addRemovePlaylistEntryAction(this, entryList, selectEntry, index, true));
        }

        if (selectEntry) {
            // optionally select
            this.select(selectEntry, true, false, action);
            this.clearHighlightedEntries();
            for (var i = 0; i < entryList.length; i++) {
                entryList[i].setHightlighted(true);
            }

        } else {
            this.fixHighlights();

            // pre-cache the section packs so we don't have hiccups during payback of a playlist
            // with section pack changes
            for (var section in entry.song.packs) {
                this.score.precacheSectionSource(section, entry.song.packs[section]);
            }
        }
        // end the undo action
        if (action) {
            this.score.endActions();
        }

        // make sure the playlist is showing but don't auto-enable it
        showPlaylist(false);
    }

    removeEntries(entryList, action=true) {

        var removedSelected = null;
        var firstIndex = -1;
        var lastIndex = -1;
        for (var i = 0; i < entryList.length; i++) {
            var entry = entryList[i];
            // remove from the entry list
            lastIndex = removeFromList(this.entries, entry);
            if (firstIndex == -1) {
                firstIndex = lastIndex;
            }

            // remove from the dom
            deleteNode(entry.playlistEntryContainer);
            // if the entry was selected then select another entry
            if (this.selected == entry) {
                entry.setSelected(false);
                removedSelected = entry;
            }
        }

        // start an undo action of needed
        if (action) {
            this.score.startActions();
            this.score.addAction(new addRemovePlaylistEntryAction(this, entryList, removedSelected, firstIndex, false));
        }

        if (removedSelected) {
            // clear selection
            this.selected = null;
            // if the playlist is nonempty, select the nearest entry
            if (this.entries.length >= 0) {
                // select either the next entry, or the last entry if the deleted one was the last entry
                this.select(this.entries[Math.min(lastIndex, this.entries.length - 1)], true, false, action);
            }
        }

        // renumber entries
        this.reIndex();

        // end the undo action
        if (action) {
            this.score.endActions();
        }

        if (this.entries.length == 0 && !playlistEnabled()) {
            hidePlaylist();
        }
    }

    startDrag(mte, entry) {
        // scroll speed parameters, guessed
        var maxScrollDistance = 30;
        var scrollWait = 100;

        // get the index of the highlight, or selected entry if it's not highlighted
        if (entry.highlighted) {
            var startIndex = -1;
            var endIndex = -1;
            var entryList = [];
            for (var i = 0; i < this.entries.length; i++) {
                var hEntry = this.entries[i];
                if (hEntry.highlighted) {
                    if (startIndex == -1) {
                        startIndex = i;
                    }
                    entryList.push(hEntry);
                }
                if (startIndex >= 0 && !hEntry.highlighted) {
                    endIndex = i;
                    break;
                }
            }
            if (endIndex == -1) { endIndex = this.entries.length - 1; }

        } else {
            var startIndex = this.entries.indexOf(entry);
            var endIndex = startIndex;
            var entryList = [entry];
        }

        var index = startIndex;
        var index2 = endIndex;

        // get the screen coordinates of the scroll area and the entry div
        var areaRect = this.playlistScrollArea.getBoundingClientRect();

        for (var i = 0; i < entryList.length; i++) {
            hEntry = entryList[i];
            // get the relative click offset inside the entry div
            hEntry.rect = hEntry.playlistEntryContainer.getBoundingClientRect();
            hEntry.clickOffsetX = mte.clientX - hEntry.rect.left;
            hEntry.clickOffsetY = mte.clientY - hEntry.rect.top;

            // build a placeholder div to keep a blank space where the entry will go
            hEntry.placeholder = document.createElement("div");
            // try our best to make the placeholder div exactly the same height as the entry div
            hEntry.placeholder.innerHTML = `<span class="playlistEntryContainerPlaceholder"><img src="img/icon-blank.png" srcset="img2x/icon-blank.png 2x" width="32" height="20"/>`+(index+i+1)+hEntry.song.name+`</span>`;
            // start it right by the entry div
            insertAfter(hEntry.placeholder, hEntry.playlistEntryContainer);

            // set the entry div to absolute positioning
            hEntry.playlistEntryContainer.className = "playlistEntryContainerDrag";
            // set the button cursor style to grabbing
            hEntry.grabSpan.style.cursor = "grabbing";
        }

        // function to iteratively move the entry and its placeholder around the list, following the cursor
        var followPlaceholder = (mte) => {
            // calculate the center height of the dragged entry inside the scroll area
            // don't use the cursor position because it gets weird when it's close to the boundary between two entries
            var y2 = entry.playlistEntryContainer.top + (entry.rect.height / 2);

            var newIndex = index;
            // if we're not at the beginning and the cursor is above the placeholder
            if (index > 0 && y2 < entry.placeholder.getBoundingClientRect().top - areaRect.top - this.playlistScrollArea.scrollTop) {
                // we need to move the placeholder up
                newIndex -= 1;
            }
            // if we're not at the end and the cursor is below the placeholder
            if (index < this.entries.length - entryList.length &&
                    y2 > entry.placeholder.getBoundingClientRect().bottom - areaRect.top - this.playlistScrollArea.scrollTop) {
                // we need to move the placeholder down
                newIndex += 1;
            }
            // if there's no change in index then we're done
            if (index != newIndex) {
                // easier to move a single entry around the highlighted entries
                if (newIndex > index) {
                    // move the entry after the highlight to be before the highlight
                    this.moveEntry([this.entries[index + entryList.length]], index, index + entryList.length, false, false);

                } else {
                    // move the entry before the highlight to be after the highlight
                    this.moveEntry([this.entries[index -1]], index + entryList.length - 1, index - 1, false, false);
                }

                index = newIndex;

                // yield the event handling thread so it can re-position elements
                // we'll do another iteration once that's done
                setTimeout(() => { followPlaceholder(mte); }, 1);
            }
        };

        // scrolling timeout callback
        var dragTimeout = null;

        // drag event handler
        var dragEvent = (mte) => {
            // prevent things like selecting text while dragging
            mte.preventDefault();
            // move the dragged entry
            for (var i = 0; i < entryList.length; i++) {
                var hEntry = entryList[i];
                hEntry.playlistEntryContainer.style.left = mte.clientX - areaRect.left - hEntry.clickOffsetX + this.playlistScrollArea.scrollLeft;
                var top = mte.clientY - areaRect.top - hEntry.clickOffsetY + this.playlistScrollArea.scrollTop;
                hEntry.playlistEntryContainer.top = top;
                hEntry.playlistEntryContainer.style.top = top;
            }

            // clear the timeout
            if (dragTimeout) {
        		clearTimeout(dragTimeout);
        		dragTimeout = null;
            }

            // get the top position of the dragged entry div, the entry that was actually clicked on
            var top = mte.clientY - entry.clickOffsetY;
            // get the bottom position of the dragged entry div
            var bottom = mte.clientY - entry.clickOffsetY + entry.rect.height;

            var scrollAmount = 0;
            // check if the entry div is past the top of the scroll area
            if (top < areaRect.top) {
                // calculate the scroll amount based on how far the entry div is past the top of the scroll area
                scrollAmount = -maxScrollDistance * Math.min((areaRect.top - top) / entry.rect.height, 1);
            }
            // check if the entry div is past the bottom of the scroll area
            if (bottom > areaRect.bottom) {
                // calculate the scroll amount based on how far the entry div is past the bottom of the scroll area
                scrollAmount = maxScrollDistance * Math.min((bottom - areaRect.bottom) / entry.rect.height, 1);
            }

            // check if there is a scroll amount
            if (scrollAmount != 0) {
                // scroll the scroll area
                this.playlistScrollArea.scrollBy(0, scrollAmount);
                // scheule a timeout so the area will keep scrolling when the cursor isn't moving
                dragTimeout = setTimeout(() => { dragEvent(mte); }, scrollWait);
            }

            // move the placeholder so it's under the dragged entry
            followPlaceholder(mte);
        };

        // drop event handler
        var dropEvent =  (mte) => {
            // prevent defaults again
            mte.preventDefault();
            // reset global drag/drop listeners
            clearDragDropListeners();
            this.score.resetListeners();
            for (var i = 0; i < entryList.length; i++) {
                var hEntry = entryList[i];
                // reset the entry's style to regular positioning, it's already in the correct location in the DOM
                hEntry.playlistEntryContainer.className = "playlistEntryContainer";
                hEntry.playlistEntryContainer.style.left = "";
                hEntry.playlistEntryContainer.style.top = "";
                // reset the button cursor style
                hEntry.grabSpan.style.cursor = "grab";
                // remove the placeholder
                deleteNode(hEntry.placeholder);
                hEntry.placeholder = null;
                hEntry.rect = null;
                hEntry.clickOffsetX = null;
                hEntry.clickOffsetY = null;
            }

            // reindex entries
            this.reIndex();

            // clear the timeout
            if (dragTimeout) {
        		clearTimeout(dragTimeout);
        		dragTimeout = null;
            }

            // if there was an index change then add an undo action
            if (index != startIndex) {
                this.score.startActions();
                this.score.addAction(new movePlaylistEntryAction(this, entryList, startIndex, index));
                this.score.endActions();
            }
        }

        // setup global drag/drop listeners
        setupDragDropListeners(dragEvent, dropEvent);
        this.score.disableListeners();

        // call the drag listener right away
        dragEvent(mte);
    }

    moveEntry(entryList, newIndex, oldIndex=null, action=true, highlight=true) {
        // get the index of the entry, if not provided
        if (oldIndex == null) {
            oldIndex = this.entries.indexOf(entryList[0]);
        }

        // start an undo action if needed
        if (action) {
            this.score.startActions();
            this.score.addAction(new movePlaylistEntryAction(this, entryList, oldIndex, newIndex));
        }

        // assume the entries are contiguous

        // remove the whole list
        this.entries.splice(oldIndex, entryList.length);
        // add each item back at the right index
        for (var i = 0; i < entryList.length; i++) {
            var entry = entryList[i];
            this.entries.splice(newIndex + i, 0, entry);
            // remove the entry div
            deleteNode(entry.playlistEntryContainer);
            // remove the entry placeholder if present
            if (entry.placeholder) {
                deleteNode(entry.placeholder);
            }
            // use insertBefore unless it's at the end of the list
            if (newIndex + i < this.entries.length - 1) {
                insertBefore(entry.playlistEntryContainer, this.entries[newIndex + i + 1].playlistEntryContainer);

            } else {
                // insert after the previous entry's placeholder, if present, otherwise after the previous entry itself
                insertAfter(entry.playlistEntryContainer,
                    this.entries[newIndex + i - 1].placeholder ?
                        this.entries[newIndex + i - 1].placeholder :
                        this.entries[newIndex + i - 1].playlistEntryContainer);
            }

            // insert the placeholder, if present
            if (entry.placeholder) {
                insertAfter(entry.placeholder, entry.playlistEntryContainer);
            }
        }

        if (highlight) {
            for (var i = 0; i < entryList.length; i++) {
                var entry = entryList[i];
                entry.setHightlighted(true);
            }
            this.fixHighlights();
        }
	    this.reIndex();

        // end the undo action
        if (action) {
            this.score.endActions();
        }
    }

    fixHighlights() {
        var highlightStart = -1;
        var hasSelectedEntry = false;

        for (var i = 0; i < this.entries.length; i++) {
            var entry = this.entries[i];
            if (entry.highlighted) {
                if (highlightStart == -1) {
                    highlightStart = i;
                }
                if (entry.selected) {
                    hasSelectedEntry = true;
                }

            } else if (highlightStart >= 0) {
                if (!hasSelectedEntry) {
                    for (var j = highlightStart; j < i; j++) {
                        this.entries[j].setHightlighted(false);
                    }
                }
                var highlightStart = -1;
                var hasSelectedEntry = false;
            }
        }
    }

    reIndex() {
        // lazy, just loop through and re-index eveything.
        for (var i = 0; i < this.entries.length; i++) {
            this.entries[i].setIndex(i + 1);
        }
    }

    select(entry, setScore, resetPlayback=false, action=true) {
        // already selected
        if (this.selected == entry) {
            return;
        }
        // start an undo action if needed
        if (action) {
            this.score.startActions();
            this.score.addAction(new selectPlaylistEntryAction(this, this.selected, entry));
        }

        var hasSelected = this.selected;
        // check if there is already a selection
        if (hasSelected) {
            // update the playlist entry's song, if this isn't an add action
            if (setScore) {
                this.selected.updateSong();
            }
            // clear selection
            this.selected.setSelected(false);
        }

        // temporarily clear the selection to prevent changing the score from looping back and doing an update
        this.selected = null;

        // if there is a selection then change state
        if (entry != null) {
            // select the new entry
            entry.setSelected(true);
            // update the score, if this isn't an add action
            if (setScore) {
                // don't add undo actions for this
                this.score.setSongObject(entry.song, action && !hasSelected, resetPlayback);
            }
        }

        // change the selection
        this.selected = entry;

        this.clearHighlightedEntries();

        // end the undo action
        if (action) {
            this.score.endActions();
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

    highlightEntries(endEntry) {
        var startIndex = this.entries.indexOf(this.selected);
        var endIndex = this.entries.indexOf(endEntry);

        if (startIndex > endIndex) {
            var t = startIndex;
            startIndex = endIndex;
            endIndex = t;
        }

        this.clearHighlightedEntries();
        this.highlightedEntries = [];
        for (var i = startIndex; i <= endIndex; i++) {
            this.entries[i].setHightlighted(true);
            this.highlightedEntries.push(this.entries[i]);
        }
    }

    clearHighlightedEntries() {
        for (var i = 0; i < this.entries.length; i++) {
            this.entries[i].setHightlighted(false);
        }
        this.highlightedEntries = null;
    }

    clear(action=true) {
        // add an undo action if needed
        if (action) {
            this.score.startActions();
            this.score.addAction(new changePlaylistAction(this, this.entries, this.selected, this.score.mixer.export(), null, null, null));
            this.score.endActions();
        }
        // delete from the dom
        for (var i = 0; i < this.entries.length; i++) {
            deleteNode(this.entries[i].playlistEntryContainer);
        }
        // clear state
        this.entries = Array();
        this.selected = null;
    }


    incrementName(name) {
        var incrementNameRegex = /(.*?) (\d+)/;
        var match = name.match(incrementNameRegex);
        if (match) {
            return match[1] + " " + (parseInt(match[2]) + 1);
        } else {
            return name + " " + 2;
        }
    }

    toggleLoop() {
        this.setLooping(!this.looping)
    }

    setLooping(looping) {
        if (!looping) {
            this.loopingButton.innerHTML = `<img src="img/icon-playlist-disabled.png" srcset="img2x/icon-playlist-disabled.png 2x" alt="Disabled"/><span class="tooltiptextbottom">Enable the playlist advancing to the next song</span>`;
            this.looping = false;
        } else {
            this.loopingButton.innerHTML = `<img src="img/icon-playlist-enabled.png" srcset="img2x/icon-playlist-enabled.png 2x" alt="Enabled"/><span class="tooltiptextbottom">Disable the playlist advancing to the next song</span>`;
            this.looping = true;
        }
    }

    export() {
        // build a string with each playlist song's code on a new line
        var str = "";
        for (var i = 0; i < this.entries.length; i++) {
            str = str + this.entries[i].song.formatAsChatLink() + "\n";
        }
        // see if there's a mixer config to export
        var mixerString = this.score.mixer.export();
        if (mixerString != "") {
            // put the mixer config at the end
            str = str + mixerString + "\n";
        }
        return str;
    }

    import(str, action=true) {
        // split into lines
        var songCodes = str.split("\n")
        var readEntries = Array();
        // mixer code
        var mixerCode = "";

        for (var i = 0; i < songCodes.length; i++) {
            // trim and check for blank lines
            var code = songCodes[i].trim();

            // check for a mixer config
            if (this.score.mixer.isMixerExportString(code)) {
                // just store the code
                mixerCode = code;

            } else if (code != "") {
                // parse the song
                var song = new Song();
                song.parseChatLink(code);
                readEntries.push(new PlaylistEntry(song, this));
            }
        }

        // don't make any changes if we didn't read any valid songs
        // we also avoid making any changes if there was an error parsing the song list
        // todo: import just mixer code?
        if (readEntries.length > 0) {
            this.importEntries(readEntries, mixerCode, action);
        }
    }
    
    importEntries(entries, mixerCode, action=true, selectEntry=null) {
        // select the first entry by default
        if (!selectEntry && entries && entries.length > 0) {
            selectEntry = entries[0];
        }

        // start an undo action if needed
        if (action) {
            this.score.startActions();
            this.score.addAction(new changePlaylistAction(this, this.entries, this.selected, this.score.mixer.export(), entries, selectEntry, mixerCode));
        }
        // clear the current playlist
        this.clear(false);
        if (entries && entries.length > 0) {
            // make sure the playlist is showing but don't enable it automatically
            showPlaylist(false);
            // add it to end of the playlist, without affecting the selection
            this.addSongEntries(entries, null, this.entries.length, false);

            this.select(selectEntry, true, true, false);

        } else if (!playlistEnabled()) {
            hidePlaylist();
        }

        // check for mixed config
        if (mixerCode && mixerCode != "") {
            // make sure the mixer is visible
            showMixer();
            // import the mixer config
            this.score.mixer.import(mixerCode);

        } else {
            // reset and hide the mixer
            this.score.mixer.resetMixer(action);
            hideMixer();
        }

        // end the undo action
        if (action) {
            this.score.endActions();
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
            span.innerHTML = `<img src="img/icon-playlist-delete.png" srcset="img2x/icon-playlist-delete.png 2x" width="32" height="20" alt="Delete"/>`;
            this.deleteSpan = span;
            this.playlistEntryContainer.appendChild(this.deleteSpan);
        }
        {
            var span = document.createElement("span");
            span.className = "smallButton";
            span.onclick = this.highlightPlaylistEntry
            span.entry = this;
            span.innerHTML = `<img src="img/icon-playlist-select.png" srcset="img2x/icon-playlist-select.png 2x" width="32" height="20" alt="Select"/>`;
            this.selectSpan = span;
            this.playlistEntryContainer.appendChild(this.selectSpan);
        }
        {
            var span = document.createElement("span");
            span.className = "smallButton";
            span.style.cursor = "grab";
            span.onmousedown = (e) => { this.startPlayListEntryDrag(mouseEventToMTEvent(e)); }
            span.ontouchstart = (e) => { this.startPlayListEntryDrag(touchEventToMTEvent(e)); }
            span.entry = this;
            span.innerHTML = `↑↓`;
            span.innerHTML = `<img src="img/icon-playlist-move.png" srcset="img2x/icon-playlist-move.png 2x" width="32" height="20" alt="Move"/>`;
            this.grabSpan = span;
            this.playlistEntryContainer.appendChild(this.grabSpan);
        }

        {
            // we need to keep a reference to the index span to change its color when selected
            var span = document.createElement("span");
            span.className = "playlistEntry";
            span.onclick = this.selectPlaylistEntry
            span.entry = this;
            this.indexBar = span;
            this.playlistEntryContainer.appendChild(this.indexBar);
        }
        {
            // we need to keep a reference to the title span to change its color when selected
            var span = document.createElement("span");
            span.className = "playlistEntry";
            span.onclick = this.selectPlaylistEntry
            span.entry = this;
            span.innerHTML = this.song.getName();
            this.titleBar = span;
            this.playlistEntryContainer.appendChild(this.titleBar);
        }
    }

    setIndex(index) {
        this.indexBar.innerHTML = index;
    }

    deletePlaylistEntry() {
        // todo: delete all highlighted entries?
        this.entry.playlist.removeEntries([this.entry]);
    }

    highlightPlaylistEntry() {
        this.entry.playlist.highlightEntries(this.entry);
    }

    startPlayListEntryDrag(mte) {
        this.playlist.startDrag(mte, this);
    }

    selectPlaylistEntry() {
        this.entry.playlist.select(this.entry, true);
    }

    setSelected(selected) {
        this.selected = selected;
        this.updateHighlighting();
        if (selected) {
            // scroll the playlist viewer to the selected entry, either at the top or the botton, whichever is nearest
            this.playlistEntryContainer.scrollIntoView({"behavior": "auto", "block": "nearest", "inline": "nearest"});
        }
    }

    setHightlighted(highlighted) {
        this.highlighted = highlighted;
        this.updateHighlighting();
    }

    updateHighlighting() {
        // change the css depending on whether it's selected
        this.indexBar.className = this.selected ? "playlistEntrySelected" : "playlistEntry";
        this.titleBar.className = this.selected ? "playlistEntrySelected" : "playlistEntry";
        // change the css depending on whether it's selected or highlighted
        this.deleteSpan.className = this.highlighted || this.selected ? "smallButtonSelected" : "smallButton";
        if (this.highlighted || this.selected) {
            this.selectSpan.className = "smallButtonSelected";
            this.selectSpan.innerHTML = `<img src="img/icon-playlist-selected.png" srcset="img2x/icon-playlist-selected.png 2x" width="32" height="20" alt="Select"/>`;
        } else {
            this.selectSpan.className = "smallButton";
            this.selectSpan.innerHTML = `<img src="img/icon-playlist-select.png" srcset="img2x/icon-playlist-select.png 2x" width="32" height="20" alt="Select"/>`;
        }
        this.grabSpan.className = this.highlighted || this.selected ? "smallButtonSelected" : "smallButton";
    }

    updateSong() {
        // load the current song from the score
        this.song = this.playlist.score.getSongObject();
        // update the title
        this.titleBar.innerHTML = this.song.getName();
    }
}

class selectPlaylistEntryAction extends Action {
    constructor(playlist, oldEntry, newEntry) {
        super();
        this.playlist = playlist;
        this.oldEntry = oldEntry;
        this.newEntry = newEntry;
    }

	undoAction() {
	    this.playlist.select(this.oldEntry, true, false, false);
	}

	redoAction() {
	    this.playlist.select(this.newEntry, true, false, false);
	}

	toString() {
	    return "Select " + this.newEntry.song.title;
	}
}

class addRemovePlaylistEntryAction extends Action {
    constructor(playlist, entryList, selectedEntry, index, add) {
        super();
        this.playlist = playlist;
        this.entryList = entryList;
        this.selectedEntry = selectedEntry;
        this.index = index;
        this.add = add;
    }

	undoAction() {
	    this.doAction(!this.add);
	}

	redoAction() {
	    this.doAction(this.add);
	}

	doAction(add) {
	    if (add) {
    	    this.playlist.addSongEntries(this.entryList, this.selectedEntry, this.index, false);

	    } else {
    	    this.playlist.removeEntries(this.entryList, false);
	    }
	}

	toString() {
	    return (this.add ? "Add " : "Remove ") + this.entryList.length + " songs";
	}
}

class changePlaylistAction extends Action {
    constructor(playlist, oldEntries, oldSelectedEntry, oldMixerCode, newEntries, newSelectedEntry, newMixerCode) {
        super();
        this.playlist = playlist;
        this.oldEntries = oldEntries;
        this.oldSelectedEntry = oldSelectedEntry;
        this.oldMixerCode = oldMixerCode;
        this.newEntries = newEntries;
        this.newSelectedEntry = newSelectedEntry;
        this.newMixerCode = newMixerCode;
    }

	undoAction() {
	    this.playlist.importEntries(this.oldEntries, this.oldMixerCode, false, this.oldSelectedEntry);
	}

	redoAction() {
	    this.playlist.importEntries(this.newEntries, this.newMixerCode, false, this.newSelectedEntry);
	}

	toString() {
	    return this.newEntries ? "Import playlist" : "Clear playlist";
	}
}

class movePlaylistEntryAction extends Action {
    constructor(playlist, entryList, oldIndex, newIndex) {
        super();
        this.playlist = playlist;
        this.entryList = entryList;
        this.oldIndex = oldIndex;
        this.newIndex = newIndex;
    }

	undoAction() {
	    this.doAction(this.newIndex, this.oldIndex);
	}

	redoAction() {
	    this.doAction(this.oldIndex, this.newIndex);
	}

	doAction(fromIndex, toIndex) {
	    this.playlist.moveEntry(this.entryList, toIndex, fromIndex, false);
	}

	toString() {
	    return (this.add ? "Add " : "Remove ") + this.entry.song.title;
	}
}

