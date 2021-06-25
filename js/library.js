function setLibrarySearch() {
    var event = window.event;
    var string = event.currentTarget.value;
    score.library.setSearchString(string);
}

var shotTags = {"Double":true, "Triple":true, "Quadruple":true, "QUINTUPLE":true}

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

        // search job state
        // we can't just do the whole search in one event handler because it interrupts audio playback for some
        // unknown reason when it transitions from some filter back to no filter.  So split the search into batches.

        // delay between search batches
        this.searchDelay = 10;
        // rough size of each search batch
        this.searchBatchLimit = 250;
        // timeout reference, if we need to cancel it
        this.searchTimeout = null;
        // search terms
        this.searchWords = null;
        // current search queue
        this.searchQueue = null;

        // search queue prototype, we only need to build this once
        this.searchQueuePrototype = null;

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
        // put the progress bar roughly where the index container actually starts
        this.libraryContainer.style.position = "relative";
        this.loader.loadingBox.style.top = 48;
        this.libraryContainer.appendChild(this.loader.loadingBox);

        // menu container, the menu is just a search bar
        this.menuContainer = document.createElement("div");
        this.menuContainer.className = "menuContainer";
        // menu bar, just HTML it
        this.menuContainer.innerHTML = `
            <input class="button titleButton" type="submit" value="Library"/>
            <div class="songTitleDiv">
                <div class="tooltip">
                    <input class="searchBar" type="text" size="36" onkeyup="setLibrarySearch()"/>
                    <span class="tooltiptextbottom">Search by keyword</span>
                </div>
            </div>
        `;
        this.libraryContainer.appendChild(this.menuContainer);

        getFirstChild(this.menuContainer, "titleButton").addEventListener("click", () => { this.clicked() });

        // index container, this is where the songs are listed
        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);
    }

    init() {
        // start the loading process if it isn't already loaded
        if (this.index == null) {
            this.loader.load("Loading Demo Index", "db/index-demo.json", (indexJson) => this.demoIndexLoaded(indexJson));
        }
    }

    clicked() {
        var event = window.event;
        if (event.shiftKey) {
            // super secret experimental match search when you shift-click the Library button don't tell anybody
            this.matchSearch();

        } else {
            // normal action: hide the library
            this.hide();
        }
    }

    hide() {
        toggleLibrary(getFirstChild(this.menuContainer, "titleButton"));
    }

    demoIndexLoaded(indexJson) {
        // callback for when the demo index is loaded
        // parse it as JSON
        var demoIndex = JSON.parse(indexJson);
        // just set it as our index
        this.index = demoIndex;

        // load the main index
        this.loader.load("Loading Index", "db/index.json", (indexJson) => this.indexLoaded(indexJson));
    }

    indexLoaded(indexJson) {
        // callback for when the index is loaded
        // parse it as JSON
        var mainIndex = JSON.parse(indexJson);
        // concat with the existing demo index
        for (var name in mainIndex) {
            this.index[name] = mainIndex[name];
        }
        mainIndex = null;

        // clear the index DOM, this shouldn't be necessary
        this.indexContainer.innerHTML = "";

        // build the index tree UI and get the entries ready for searching
        this.buildTree(this.indexContainer, this.index, null, []);

        // build the search queue prototype, no point in building this every time
        this.searchQueuePrototype = [];
        this.queueSongLists(this.index, this.searchQueuePrototype);
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
        if (songEntry.tags) {
            for (i = 0; i < songEntry.tags.length; i++) {
                var tag = songEntry.tags[i];
                if (tag == "Filled") {
                    label = label + '<span class="tagFilled">(' + tag + ')</span>';
                } else if (tag == "Sparse") {
                    label = label + '<span class="tagSparse">(' + tag + ')</span>';
                } else if (tag == "Perfect") {
                    label = label + '<span class="tagPerfect">(' + tag + ')</span>';
                } else if (tag in instrumentDisplayNameToPack) {
                    label = label + '<span class="tagInstrument">(' + tag + ')</span>';
                } else if (tag in shotTags) {
                    label = label + '<span class="tagShot">(' + tag + ')</span>';
                }
            }
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

    cloneSongDiv(div) {
        var div2 = div.cloneNode(true);
        // not everything gets cloned
        var songLabelSpan = getFirstChild(div, "libSongLabel");
        var songLabelSpan2 = getFirstChild(div2, "libSongLabel");
        songLabelSpan2.onclick = songLabelSpan.onclick;
        songLabelSpan2.songEntry = songLabelSpan.songEntry;
        // reset the display style in case the original is hidden
        div2.style.display = "block";
        return div2;
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
            this.startWordSearch(null);
        } else {
            // run the search with one or more keywords
            this.startWordSearch(words);
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

    startWordSearch(words) {
        // only do this crap if the search has actually changed
        if (listEquals(words, this.searchWords)) {
            return;
        }
        // save the current search criteria
        this.searchWords = words;

        // start the search
        this.startFuncSearch(false, (song, songList, index, total) => {
            // the song is displayed if there is no search string or if all of the words are found in its keywords
            if (!words || this.searchKeywords(song.keywords, words)) {
                this.showSong(song);
            } else {
                // otherwise, hide the song
                this.hideSong(song);
            }
        })
    }

    startFuncSearch(loadSongData, func) {
        // cancel any search in progress
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        // get a copy of the search queue
        var searchQueue = this.searchQueuePrototype.slice();
        // store the total
        var total = searchQueue.length;
        // start the search
        this.searchTimeout = setTimeout(() => this.runSearch(searchQueue, total, loadSongData, func), this.searchDelay);
    }

    queueSongLists(map, queue) {
        // recursive search
        if (map.songs) {
            // leaf category: search individual songs for keywords
            queue.push(map.songs);
        } else {
            // branch category: recursively search each subcategory
            for (var key in map) {
                 this.queueSongLists(map[key], queue);
            }
        }
    }

    runSearch(searchQueue, totalItems, loadSongData, func) {
        // count songs searched
        var count = 0;
        // search song lists until we exceed the batch size
        while (count < this.searchBatchLimit) {
            // nothing left in the queue
            if (searchQueue.length == 0) {
                // clear the timeout
                this.searchTimeout = null;
                // end the search
                return;
            }

            // if we need to load song data then check to see if the song's database is loaded
            if (loadSongData && !this.database[searchQueue[0][0].dbName]) {
                // continue this search after loading the database
                this.queryDb(searchQueue[0][0].dbName, () => {
                    this.runSearch(searchQueue, totalItems, loadSongData, func);
                });
                return;
            }

            // dequeue
            var songs = searchQueue.shift();
            // current index
            var index = totalItems - searchQueue.length;
            // iterate over the songs
            for (var songKey in songs) {
                var song = songs[songKey];
                // get the song data if necessary
                var songList = loadSongData ? this.database[song.dbName][song.id] : null;
                // run the search function on the song
                func(song, songList, index, totalItems);
            }
            // increment the count
            count += songs.length;
        }

        // schedule the next batch
        this.searchTimeout = setTimeout(() => this.runSearch(searchQueue, totalItems, loadSongData, func), this.searchDelay);
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

            // fill in the current song and reset playback
            this.score.setSong(songs[0], false, true);

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

                // append the rest of the songs, without selecting them and appended to the end of the playlist
                for (var i = 1; i < songs.length; i++) {
                    this.score.playlist.addSongCode(songs[i], false, false);
                }

                // enable looping
                this.score.playlist.setLooping(true);
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

    matchSearch() {
        // experimental song match search

        // remove the regular menu and index containers temporarily
        this.menuContainer.remove();
        this.menuContainerSaved = this.menuContainer;
        this.indexContainer.remove();
        this.indexContainerSaved = this.indexContainer;

        // build special menu container
        this.menuContainer = document.createElement("div");
        this.menuContainer.className = "menuContainer";
        // menu bar, just HTML it
        this.menuContainer.innerHTML = `
            <input class="button titleButton" type="submit" value="Back"/>
        `;
        // build a second loaded just for the progress bar
        this.searchLoader = new Loader();
        this.searchLoader.setLabel("Searching");
        this.searchLoader.log = true;
        this.menuContainer.appendChild(this.searchLoader.loadingBox);
        this.libraryContainer.appendChild(this.menuContainer);

        getFirstChild(this.menuContainer, "titleButton").addEventListener("click", () => { this.endMatchSearch() });

        // index container, this is where the songs are listed
        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);

        // auto-start the match search
        this.startMatchSearch();
    }

    startMatchSearch() {
        // pull the match to look for from the current score
        var searchSongObject = score.getSongObject();
        // search result array
        var matchListing = Array();
        // start the search
        this.startFuncSearch(true, (song, songList, index, total) => {
            // min match value
            var match = 0;

            // get the highest match value among all the songs in this entry
            for (var i = 0; i < songList.length; i++) {
                // parse to a song object
                var songObject = new Song();
                songObject.parseChatLink(songList[i]);
                // calculate a match value
                // match in both directions and add the result.  Why not, I'm making this up as I go anyway.
                var songMatch = songObject.matchSong(searchSongObject) +
                                searchSongObject.matchSong(songObject);
                // save the highest one
                if (songMatch > match) {
                    match = songMatch;
                }
            }

            // arbitrarily cut off at 0
            if (match > 0) {
                // clone the original song listing element
                var div = this.cloneSongDiv(song.div);
                // append the numeric match values
                var span = document.createElement("span")
                span.innerHTML = `&nbsp;(${match.toFixed(2)})`;
                span.className = "tagMisc";
                div.appendChild(span);

                // create a result object
                var matchEntry = {"match": match, "div": div};
                // search the results for the first result that's worse
                var insertIndex = matchListing.findIndex((e) => { return e.match < match; } );
                if (insertIndex > -1) {
                    // insert this result before the first worse result
                    this.indexContainer.insertBefore(div, matchListing[insertIndex].div);
                    matchListing.splice(insertIndex, 0, matchEntry);
                } else {
                    // no worse result, append this result to the end
                    this.indexContainer.appendChild(div);
                    matchListing.push(matchEntry);
                }
            }

            this.searchLoader.setProgress(index / total);
        })
    }

    endMatchSearch() {
        // restore the original menu bar and index
        this.menuContainer.remove();
        this.menuContainer = this.menuContainerSaved;
        this.libraryContainer.appendChild(this.menuContainer);

        this.indexContainer.remove();
        this.indexContainer = this.indexContainerSaved;
        this.libraryContainer.appendChild(this.indexContainer);

        this.searchLoader = null;
    }
}

class Loader {
    constructor() {
        // AJAX request object
        this.request = null;
        this.lastAmount = -1;
        // build the UI
        this.buildUI();
    }

    buildUI() {
        // overall container
        this.loadingBox = document.createElement("div");
        this.loadingBox.className = "loadingBox";
        // we need something in it to give it height
        this.loadingBox.innerHTML = "&nbsp;";

        this.progressBar = document.createElement("div");
        this.progressBar.className = "loadingProgressPos";
        // we need something in it to give it height
        this.progressBar.innerHTML = "&nbsp;";
        this.loadingBox.appendChild(this.progressBar);

        // label
        this.labelBar = document.createElement("div");
        this.labelBar.className = "loadingLabel";
        this.loadingBox.appendChild(this.labelBar);

        // start hidden
        this.hide();
    }

    hide() {
        this.loadingBox.style.display = "none";
    }

    show() {
        this.loadingBox.style.display = "inline-block";
    }

    setProgress(amount) {
        // short circuit if there's no change
        if (amount == this.lastAmount) {
            return;
        }
        // set the progress bar width
        this.progressBar.style.width = (amount * 100) + "%";

        if (amount == 1) {
            // automatically hide at 100%
            this.hide();

        } else {
            // otherwise, make sure it's showing
            this.show();
        }
        // save amount
        this.lastAmount = amount;
    }

    setLabel(text) {
        this.labelBar.innerHTML = text;
    }

    load(label, path, callback) {
        // abort any currently running load operation
        if (this.request != null) {
            this.request.abort();
            this.request = null;
        }
        // set the label
        this.setLabel(label);
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