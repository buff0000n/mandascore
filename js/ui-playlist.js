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
                <input class="button addButton" type="submit" value="Add" onClick="addToPlaylist(this)"/>
                <input class="button loopButton" type="submit" value="Enable" onClick="loopPlaylist(this)"/>
                <input class="button clearButton" type="submit" value="Clear" onClick="clearPlaylist(this)"/>
                <input class="button editButton" type="submit" value="Copy/Paste" onClick="editPlaylist(this)"/>
                <div class="popup">
                    <input id="playlistCopyUrlButton" class="button urlButton popup" type="submit" value="Link"
                           onClick="copyPlaylistUrl()"/>
                    <div class="popuptext" id="playlistPopupBox">
                        <input id="playlistUrlHolder" type="text" size="60" onblur="hideUrlPopup()"/>
                    </div>
                </div>
            </div>
        `;

        // get a reference to the looping toggle button
        this.loopingButton = getFirstChild(this.playlistBox, "loopButton");

        getFirstChild(this.playlistBox, "titleButton").addEventListener("click", () => { this.hide() });

        this.playlistScollArea = document.createElement("div");
        this.playlistScollArea.className = "playlistScollArea";
        this.playlistBox.appendChild(this.playlistScollArea);
    }

    hide() {
        hidePlaylist();
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

        } else {
            // pre-cache the section packs so we don't have hiccups during payback of a playlist
            // with sectio pack changes
            for (var section in entry.song.packs) {
                this.score.precacheSectionSource(section, entry.song.packs[section]);
            }
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


    incrementName(name) {
        var incrementNameRegex = /(.*?) (\d+)/;
        var match = name.match(incrementNameRegex);
        if (match) {
            return match[1] + " " + (parseInt(match[2]) + 1);
        } else {
            return name + " " + 2;
        }
    }

    add() {
        // make the name unique
        var name = this.score.title;
        for (;;) {
            if (!this.entries.find((entry) => entry.song.name == name)) {
                break;
            }
            name = this.incrementName(name);
        }
        if (name != this.score.title) {
            this.score.setTitle(name, false);
        }
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
        // see if there's a mixer config to export
        var mixerString = this.score.mixer.export();
        if (mixerString != "") {
            // put the mixer config at the end
            str = str + mixerString + "\n";
        }
        return str;
    }

    import(str) {
        // split into lines
        var songCodes = str.split("\n")
        var readEntries = Array();

        var hasMixerConfig = false;
        for (var i = 0; i < songCodes.length; i++) {
            // trim and check for blank lines
            var code = songCodes[i].trim();

            // check for a mixer config
            if (this.score.mixer.isMixerExportString(code)) {
                // make sure the mixer is visible
                showMixer();
                // import the mixer config
                this.score.mixer.import(code);
                hasMixerConfig = true;

            } else if (code != "") {
                // parse the song
                var song = new Song();
                song.parseChatLink(code);
                readEntries.push(song);
            }

            if (!hasMixerConfig) {
                this.score.mixer.resetMixer();
                hideMixer();
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
