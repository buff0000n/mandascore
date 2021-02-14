function setLibrarySearch() {
    var event = window.event;
    var string = event.currentTarget.value;
    score.library.setSearchString(string);
}

class Library {
    constructor(score) {
        // back reference to the score
        this.score = score;
        // index map, loaded at init time
        this.index = null;
        // database map, loaded in sections depending on which category of songs are selected
        this.database = {};
        // data loader with progress bar
        this.loader = new Loader();

        // build the UI
        this.buildUI();
    }

    buildUI() {
        // main container
        this.libraryBox = document.createElement("div");
        this.libraryBox.className = "libraryBox";
        this.libraryBox.id = "libraryBox";
        // back reference because why not
        this.libraryBox.library = this;

        this.libraryContainer = this.libraryBox;

        // loader container
        this.loaderContainer = document.createElement("div");
        this.loaderContainer.className = "loaderContainer";
        this.loaderContainer.appendChild(this.loader.loadingBox);
        this.libraryContainer.appendChild(this.loaderContainer);

        // menu container, the menu is just a search bar
        this.menuContainer = document.createElement("div");
        this.menuContainer.className = "menuContainer";
        // menu bar, just HTML it
        this.menuContainer.innerHTML = `
            <div class="songTitleDiv">
                <div class="tooltip">
                    <input class="searchBar" type="text" size="36" onkeyup="setLibrarySearch()"/>
                    <span class="tooltiptextbottom">Search by keyword</span>
                </div>
            </div>
        `;
        this.libraryContainer.appendChild(this.menuContainer);

        // index container, this is where the songs are listed
        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);
    }

    init() {
        // load the index if it isn't already loaded
        if (this.index == null) {
            this.loader.load("Loading Index", "db/index.json", (indexJson) => this.indexLoaded(indexJson));
        }
    }

    indexLoaded(indexJson) {
        // callback for when the index is loaded
        // parse it as JSON
        this.index = JSON.parse(indexJson);
        // clear the index DOM, this shouldn't be necessary
        this.indexContainer.innerHTML = "";

        // build the index tree UI and get the entries ready for searching
        this.buildTree(this.indexContainer, this.index, null, []);
    }

    buildCatDiv(categoryName) {
        // build the div for displaying a category
        var catDiv = document.createElement("div");
        catDiv.className = "libCat";
        catDiv.innerHTML = `<span class="libCatLabel">` + categoryName + `</span>`;
        this.initVisibleChildren(catDiv);
        return catDiv;
    }

    buildIndentDiv() {
        // build the div for indenting the entries under a category
        var indentDiv = document.createElement("div");
        indentDiv.className = "libIndent";
        this.initVisibleChildren(indentDiv);
        return indentDiv;
    }

    buildSongDiv(songEntry, dbName) {
        // build the div for displaying a song entry
        var songDiv = document.createElement("div");
        songDiv.className = "libSong";
        var label = "<strong>" + songEntry.name + "</strong>";
        if (songEntry.attr) {
            label = label + " (" + songEntry.attr.join(", ") + ")";
        }
        var songLabelSpan = document.createElement("span");
        songLabelSpan.className = "libSongLabel";
        songLabelSpan.innerHTML = label;
        // click event for selecting a song
        songLabelSpan.onclick = (event) => this.songClick(event)
        // back reference to the song entry
        songLabelSpan.songEntry = songEntry;
        // just easier to put the dbName on each song entry
        songEntry.dbName = dbName;
        songDiv.appendChild(songLabelSpan);

        return songDiv;
    }

    buildTree(parent, map, dbName, cats) {
        // recursive tree builder
        // for some reason we need a defensive copy of the dbName of the recursive method parameter
        var dbName2 = dbName;
        // update the dbName if the category map has one
        if (map.dbName) {
            dbName2 = map.dbName;
        }
        if (map.songs) {
            // it's a leaf category, it only contains a list of songs
            for (var songKey in map.songs) {
                // pull out each song and build a UI for it
                var song = map.songs[songKey];
                var songDiv = this.buildSongDiv(song, dbName2);
                // add to the DOM
                parent.appendChild(songDiv);
                // track the parent's visible children
                this.incrementVisibleChildren(parent);
                // references from the song entry tothe UI
                song.div = songDiv;
                // prepare the song entry for searching
                this.indexSong(song, cats);
            }
        } else {
            // it's a branch category that contains subcategories
            for (var cat in map) {
                // have to add the UI to the DOM before adding songs
                var catDiv = this.buildCatDiv(cat);
                parent.appendChild(catDiv);
                // build an additional layer just for indenting
                var subDiv = this.buildIndentDiv();
                catDiv.appendChild(subDiv);
                // add to the category stack
                cats.push(cat);
                // recursive call to build the subcategory
                this.buildTree(subDiv, map[cat], dbName2, cats);
                // pop off the category stack
                cats.pop();
            }
        }
    }

    initVisibleChildren(parent) {
        // init the variable that will keep track of how many of a parent's children are visible
        // this is so categories whose songs or subcagories are all hidden can go be hidden themselves
        parent.visibleChildren = 0;
    }

    incrementVisibleChildren(parent) {
        // check if this is a valid tracking parent
        if (parent && parent.visibleChildren != null) {
            // increment the visible children
            var count = parent.visibleChildren + 1;
            parent.visibleChildren = count;
            // if the visible count was incremented from 0 to 1 then display the parent
            if (count == 1) {
                parent.style.display = "block";
                // update the parent's parent and display it if necessary
                this.incrementVisibleChildren(parent.parentElement);
            }
        }
    }

    decrementVisibleChildren(parent) {
        // check if this is a valid tracking parent
        if (parent && parent.visibleChildren != null) {
            // decrement the visible children
            var count = parent.visibleChildren - 1;
            parent.visibleChildren = count;
            // if the visible count has decremented from 1 ro 0 then hide the parent
            if (count == 0) {
                parent.style.display = "none";
                // update the parent's parent and hide if necessary
                this.decrementVisibleChildren(parent.parentElement);
            }
        }
    }

    indexSong(song, cats) {
        // todo: better
        // Just concatenate all relevent keywords into a big string and lowercase it.
        song.keywords = (cats.join(" ") + " "
            + song.name + " "
            + (song.attr ? (" " + song.attr.join(" ")) : "")
            + (song.tags ? (" " + song.tags.join(" ")) : "")
        ).toLowerCase();
        // don't need these anymore
        song.name = null;
        song.attr = null;
        song.tags = null;
    }

    setSearchString(string) {
        // todo: better
        // split search string into keywords 3 chars or longer
        var words = string.toLowerCase().split(" ").filter((s) => s.length >= 3);
        if (words.length == 0) {
            // no long enough keywords, show everything
            this.searchSongs(this.index, null, true);
        } else {
            // run the search with one or more keywords
            this.searchSongs(this.index, words, false);
        }
    }

    searchKeywords(keywords, words) {
        // search the keywords string for the given words.  all words must be present
        for (var i = 0; i < words.length; i++) {
            if (keywords.indexOf(words[i]) < 0) {
                // one word not present, filter it out
                return false;
            }
        }
        // all words present
        return true;
    }

    searchSongs(map, words) {
        // recursive search
        if (map.songs) {
            // leaf category: search individual songs for keywords
            for (var songKey in map.songs) {
                var song = map.songs[songKey];
                // the song is displayed if there is no search string or if all of the words are found in its keywords
                if (!words || this.searchKeywords(song.keywords, words)) {
                    this.showSong(song);
                } else {
                    // otherwise, hide the song
                    this.hideSong(song);
                }
            }
        } else {
            // branch category: recursively search each subcategory
            for (var key in map) {
                this.searchSongs(map[key], words);
            }
        }
    }

    showSong(song) {
        // if the song is hidden
        if (song.div.style.display == "none") {
            // show it
            song.div.style.display = "block";
            // show its parent, if necessary
            this.incrementVisibleChildren(song.div.parentElement);
        }
    }

    hideSong(song) {
        // if the song is not hidden
        if (!song.div.style.display || song.div.style.display == "block") {
            // hide it
            song.div.style.display = "none";
            // hide its parent, if necessary
            this.decrementVisibleChildren(song.div.parentElement);
        }
    }

    songClick(event) {
        // pull the id and database name from the song entry
        var songEntry = event.currentTarget.songEntry;
        var id = songEntry.id;
        var dbName = songEntry.dbName;
        // load the database and run a callback when it's loaded
        this.queryDb(dbName, (db) => {
            // load the song data from the db
            var songs = db[id];

            // remember whether we were playing before stopping playback
            var playing = this.score.isPlaying();
            this.score.stopPlayback();

            // fill in the current song
            this.score.setSong(songs[0], false);

            if (songs.length == 1) {
                // just one song
                if (playlistEnabled()) {
                    // playlist is enabled, add the song to the playlist
                    this.score.playlist.add();
                    // disable looping if it's just one song
                    this.score.playlist.setLooping(false);

                } else {
                    // playlist was not manually enabled, hide it and turn off looping
                    hidePlaylist();
                    // clear the playlist
                    this.score.playlist.clear();
                }

            } else {
                // multiple songs
                // show the playlist, but don't enable it automatically
                showPlaylist(false);
                // clear the playlist if it hasn't been manually enabled
                if (!playlistEnabled()) {
                    this.score.playlist.clear();
                }
                // Add the first song, already in the score, to the playlist and select it
                this.score.playlist.add();

                // append the rest of the songs without selecting them
                for (var i = 1; i < songs.length; i++) {
                    this.score.playlist.addSongCode(songs[i], false);
                }

                // enable looping
                this.score.playlist.setLooping(true);
            }

            // resume playing if it was playing before
            if (playing) {
                this.score.togglePlaying();
            }
        });
    }

    queryDb(dbName, func) {
        // todo: something with weak references or a weak map?
        if (this.database[dbName]) {
            // database is already loaded, just query it
            func(this.database[dbName]);
        } else {
            // database needs to be loaded.  Run the loader and query it when it's loaded.
            this.loader.load("Loading " + dbName, "db/" + dbName + ".json", (indexJson) => this.dbLoaded(dbName, indexJson, func));
        }
    }

    dbLoaded(dbName, dbJson, callback) {
        // callback for a newly loaded database
        // parse the database and save it under the database name
        var db = JSON.parse(dbJson);
        this.database[dbName] = db;
        // run the query
        callback(this.database[dbName]);
    }
}

class Loader {
    constructor() {
        // AJAX request object
        this.request = null;
        // build the UI
        this.buildUI();
    }

    buildUI() {
        // this is probably overcomplicated
        // overall container
        this.loadingBox = document.createElement("div");
        this.loadingBox.className = "loadingBox";
        this.loadingBox.id = "loadingBox";

        // label
        this.labelBar = document.createElement("div");
        this.labelBar.className = "loadingLabel";
        this.loadingBox.appendChild(this.labelBar);

        // progress bar container
        this.progressBar = document.createElement("div");
        this.progressBar.className = "loadingProgress";
        this.loadingBox.appendChild(this.progressBar);

        // finished progress bar
        this.progressBarPos = document.createElement("div");
        this.progressBarPos.className = "loadingProgressPos";
        this.progressBarPos.innerHTML = "&nbsp;";
        this.progressBar.appendChild(this.progressBarPos);

        // remaining progress bar
        this.progressBarNeg = document.createElement("div");
        this.progressBarNeg.className = "loadingProgressNeg";
        this.progressBarNeg.innerHTML = "&nbsp;";
        this.progressBar.appendChild(this.progressBarNeg);

        this.hide();
    }

    hide() {
        this.loadingBox.style.display = "none";
    }

    show() {
        this.loadingBox.style.display = "block";
    }

    setProgress(amount) {
        // set the finished progress
        this.progressBarPos.style.width = Math.round(amount * 100) + "%";
        // whatever's left is remaining progress
        this.progressBarNeg.style.width = Math.round((1-amount) * 100) + "%";
    }

    load(label, path, callback) {
        // abort any currently running load operation
        if (this.request != null) {
            this.request.abort();
            this.request = null;
        }
        // set the label
        this.labelBar.innerHTML = label;
        // init progress to 0%
        this.setProgress(0);
        // show the loaded
        this.show();

        // build a new AJAX request
        this.request = new XMLHttpRequest();
        // set some callback data on the AJAX request object because we can
        this.request.callback = callback;
        this.request.loader = this;

        // event listeners
        this.request.addEventListener("progress", (event) => this.updateProgress(event));
        this.request.addEventListener("load", (event) => this.transferComplete(event));
        this.request.addEventListener("error", (event) => this.transferFailed(event));
        this.request.addEventListener("abort", (event) => this.transferCanceled(event));

        // set up the AJAX request
        this.request.open("GET", path);
        // run the request, this runs in the background and call the event listeners
        this.request.send();
    }

    updateProgress(event) {
        // show progress, if applicable
        if (event.lengthComputable) {
            // compute the completion amount
            var completeAmount = event.loaded / event.total;
            // update the UI
            this.setProgress(completeAmount);
        }
    }

    // testing stuff, because the index and databases load too fast when I'm running locally
//    transferComplete(event) {
//        this.fakeProgress(event, 0);
//    }
//
//    fakeProgress(event, percent) {
//        var e = {"lengthComputable": true, "loaded": percent, "total": 100};
//        this.updateProgress(e);
//        if (percent >= 100) {
//            this.transferComplete2(event);
//        } else {
//            setTimeout(() => this.fakeProgress(event, percent + 10), 500);
//        }
//    }
//
//    transferComplete2(event) {
    transferComplete(event) {
        // hide the progress bar
        this.hide();
        // get the loaded data
        var response = event.currentTarget.responseText;
        // get the callback info from the AJAX request object
        var callback = event.currentTarget.callback;
        // clear the request object
        this.request = null;
        // run the callback
        callback(response);
    }

    transferFailed(event) {
        // todo
        this.hide();
        console.log("Transfer failed");
    }

    transferCanceled(event) {
        // todo
        this.hide();
        console.log("Transfer canceled");
    }

}