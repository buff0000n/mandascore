var shotTags = ["Double", "Triple", "Quadruple", "QUINTUPLE", "6x", "7x", "8x", "9x", "10x"];

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
        // current result size
        this.visibleSongCount = 0;
        // instrument filter, if present
        this.instrumentFilter = null;
        this.instrumentFilterChanged = false;
        // filter flags
        this.filterFlagNoDemo = false;
        this.filterFlagOnlyPerfect = false;
        this.filterFlagOnlyFilled = false;
        this.filterFlagOnlyMulti = false;
        this.filterTagList = [];
        this.filterTagListChanged = false;


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
        this.menuContainer.className = "scoreButtonContainer";
        // menu bar, just HTML it
        this.menuContainer.innerHTML = `
            <div class="scoreButtonRow">
                <span class="imgButton titleButton closeButton tooltip"><img src="img/icon-clear.png" srcset="img2x/icon-clear.png 2x" alt="Back"/>
                    <span class="tooltiptextbottom">Go back</span>
                </span>
                <span class="songTitleDiv">
                    <span class="tooltip">
                        <input class="searchBar" type="text" size="24"/>
                        <span class="tooltiptextbottom">Search by keyword</span>
                    </span>
                </span>
                <span class="titleButton" id="visibleSongCount"></span>
                <span class="imgButton menuButton tooltip"><img src="img/icon-burger.png" srcset="img2x/icon-burger.png 2x" alt="Menu"/>
                    <span class="tooltiptextbottom">Library Menu</span>
                </span>
            </div>
        `;
        this.libraryContainer.appendChild(this.menuContainer);

        // click handlers
        getFirstChild(this.menuContainer, "closeButton").addEventListener("click", (e) => { this.hide(); });
        getFirstChild(this.menuContainer, "menuButton").addEventListener("click", (e) => {
            clearMenus();
            this.showMenu(e);
        });
        getFirstChild(this.menuContainer, "searchBar").addEventListener("keyup", (e) => { this.setLibrarySearch(e); });

        // index container, this is where the songs are listed
        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);
    }

    showMenu(e) {
        var button = e.currentTarget;
        var div = document.createElement("div");
        div.className = "menu";
        div.button = button;

        // build the section menu out of buttons
        var html = `
            <div class="button filterButton tooltip">
                <img class="imgButton" src="img/icon-filter.png" srcset="img2x/icon-filter.png 2x" alt="Instrument Filter"/>
                Filter
                <span class="tooltiptextbottom">Set a filter for instrument sets and parts</span>
            </div>
            <div class="button statsButton tooltip">
                <img class="imgButton" src="img/icon-stats.png" srcset="img2x/icon-stats.png 2x" alt="Instrument Stats"/>
                Statistics
                <span class="tooltiptextbottom">Show statistics for instrument sets used in the currently visible songs</span>
            </div>
            <div class="button flagNoDemoButton tooltip">
                <input type="checkbox" class="checkboxFlagNoDemo"/>
                Don't show demo songs
                <span class="tooltiptextbottom">Hide demo songs</span>
            </div>
            <div class="button flagPerfectButton tooltip">
                <input type="checkbox" class="checkboxFlagPerfect"/>
                Only Show Perfect Songs
                <span class="tooltiptextbottom">Show only songs that translate perfectly to the Mandachord</span>
            </div>
            <div class="button flagFilledButton tooltip">
                <input type="checkbox" class="checkboxFlagFilled"/>
                Only Show Filled Melodies
                <span class="tooltiptextbottom">Show only filled-melody meta songs</span>
            </div>
            <div class="button flagMultiButton tooltip">
                <input type="checkbox" class="checkboxFlagMulti"/>
                Only Show Multi-shots
                <span class="tooltiptextbottom">Show only entries with multiple Mandachord loops</span>
            </div>
            <!-- todo this search sucks
            <div class="button searchButton tooltip">
                <img class="imgButton" src="img/icon-search.png" srcset="img2x/icon-search.png 2x" alt="Reverse Search"/>
                Reverse Search
                <span class="tooltiptextbottom">Reverse search for the current song in the library</span>
            </div>
            -->
        `;

        div.innerHTML = html;
        /*
        getFirstChild(div, "searchButton").addEventListener("click", (e) => {
            clearMenus();
            this.matchSearch(e);
        });
        */
        getFirstChild(div, "filterButton").addEventListener("click", (e) => {
            clearMenus();
            this.showFilter(button);
        });
        getFirstChild(div, "statsButton").addEventListener("click", (e) => {
            clearMenus();
            this.showStats(e);
        });

        getFirstChild(div, "checkboxFlagNoDemo").checked = this.filterFlagNoDemo;
        getFirstChild(div, "checkboxFlagNoDemo").library = this;
        getFirstChild(div, "checkboxFlagNoDemo").addEventListener("change", (e) => {
            this.filterFlagNoDemo = e.currentTarget.checked;
            e.currentTarget.library.setFilterFlag("!Demo", e.currentTarget.checked);
        });
        getFirstChild(div, "checkboxFlagPerfect").checked = this.filterFlagPerfect;
        getFirstChild(div, "checkboxFlagPerfect").library = this;
        getFirstChild(div, "checkboxFlagPerfect").addEventListener("change", (e) => {
            this.filterFlagPerfect = e.currentTarget.checked;
            e.currentTarget.library.setFilterFlag("Perfect", e.currentTarget.checked);
        });
        getFirstChild(div, "checkboxFlagFilled").checked = this.filterFlagFilled;
        getFirstChild(div, "checkboxFlagFilled").library = this;
        getFirstChild(div, "checkboxFlagFilled").addEventListener("change", (e) => {
            this.filterFlagFilled = e.currentTarget.checked;
            e.currentTarget.library.setFilterFlag("Filled", e.currentTarget.checked);
        });
        getFirstChild(div, "checkboxFlagMulti").checked = this.filterFlagMulti;
        getFirstChild(div, "checkboxFlagMulti").library = this;
        getFirstChild(div, "checkboxFlagMulti").addEventListener("change", (e) => {
            this.filterFlagMulti = e.currentTarget.checked;
            e.currentTarget.library.setFilterFlag("Multi", e.currentTarget.checked);
        });

        // put the menu in the clicked button's parent and anchor it to button
        showMenu(div, getParent(button, "scoreButtonRow"), button);
    }

    init() {
        // start the loading process if it isn't already loaded
        if (this.index == null) {
            this.loader.load("Loading Demo Index", "db/index-demo.json", (indexJson) => this.demoIndexLoaded(indexJson));
        }
    }

    hide() {
        toggleLibrary(getFirstChild(this.menuContainer, "titleButton"));
    }

    updateVisibleSongCount() {
        var countElement = document.getElementById("visibleSongCount")
        if (countElement) {
            countElement.innerHTML = this.visibleSongCount;
        }
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

        this.updateVisibleSongCount();

        // build the search queue prototype, no point in building this every time
        this.searchQueuePrototype = [];
        this.queueSongLists(this.index, this.searchQueuePrototype, false);
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
                }
            }
        }
        if (songEntry.multi && songEntry.multi > 1) {
            label = label + '<span class="tagShot">(' + shotTags[songEntry.multi - 2] + ')</span>';
            if (!songEntry.tags) {
                songEntry.tags = [];
            }
            songEntry.tags.push("Multi");
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
                this.incrementVisibleChildren(parent, true);
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

    incrementVisibleChildren(parent, isSong = false) {
        // check if this is a valid tracking parent
        if (parent && parent.visibleChildren != null) {
            // increment search result size if this is a song
            if (isSong) {
                this.visibleSongCount += 1;
            }
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

    decrementVisibleChildren(parent, isSong = false) {
        // check if this is a valid tracking parent
        if (parent && parent.visibleChildren != null) {
            // decrement search result size if this is a song
            if (isSong) {
                this.visibleSongCount -= 1;
            }
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
        // Just concatenate all relevant keywords into a big string and lowercase it.
        song.keywords = (cats.join(" ") + " "
            + song.name + " "
            + (song.attr ? (" " + song.attr.join(" ")) : "")
            + (song.tags ? (" " + song.tags.join(" ")) : "")
        ).toLowerCase();
        // don't need these anymore
        song.name = null;
        song.attr = null;
        //song.tags = null;
    }

    setLibrarySearch() {
        var event = window.event;
        var string = event.currentTarget.value;
        this.setSearchString(string);
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

    searchInstrumentFilter(songList) {
        var songListAllowed = false;
        for (var i = 0; i < songList.length; i++) {
            var songObject = new Song();
            songObject.parseChatLink(songList[i]);
            var songAllowed = true;
            for (var part in songObject.packs) {
                var pack = songObject.packs[part];
                // if any pack + part in any song in the list is disabled in the filter then allow the song to be shown
                if (!this.instrumentFilter[pack][part]) {
                    songAllowed = false;
                    break;
                }
            }
            songListAllowed |= songAllowed;
        }
        return songListAllowed;
    }

    startWordSearch(words) {
        // only do this crap if the search has actually changed
        // todo: check filter tags
        if (!this.instrumentFilterChanged && !this.filterTagListChanged && listEquals(words, this.searchWords)) {
            return;
        }
        // save the current search criteria
        this.searchWords = words;
        this.instrumentFilterChanged = false;
        this.filterTagListChanged = false;

        this.filterTagListCopy = Array();
        this.filterTagListNegate = Array();
        for (var f = 0; f < this.filterTagList.length; f++) {
            var filterTag = this.filterTagList[f];
            if (filterTag.startsWith("!")) {
                this.filterTagListCopy.push(filterTag.substring(1));
                this.filterTagListNegate.push(true);
            } else {
                this.filterTagListCopy.push(filterTag);
                this.filterTagListNegate.push(false);
            }
        }

        // start the search
        this.startFuncSearch(this.instrumentFilter != null, false, (song, songList, index, total) => {
            // the song is displayed if there is no search string or if all of the words are found in its keywords
            var tagged = true;
            if (this.filterTagListCopy.length > 0) {
                for (var f = 0; f < this.filterTagListCopy.length; f++) {
                    var filterTag = this.filterTagListCopy[f];
                    if (this.filterTagListNegate[f] ?
                        song.tags != null && song.tags.indexOf(filterTag) >= 0 :
                        song.tags == null || song.tags.indexOf(filterTag) < 0
                    ){
                        tagged = false;
                    }
                }
            }
            if (tagged &&
                (!words || this.searchKeywords(song.keywords, words)) &&
                (!this.instrumentFilter || this.searchInstrumentFilter(songList))) {
                this.showSong(song);
            } else {
                // otherwise, hide the song
                this.hideSong(song);
            }
        }, () => {
            this.updateVisibleSongCount();
        })
    }

    startFuncSearch(loadSongData, omitHidden, searchFunc, endBatchFunc=null, endFunc=endBatchFunc) {
        // cancel any search in progress
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        // get a copy of the search queue
        if (!omitHidden) {
            var searchQueue = this.searchQueuePrototype.slice();
        } else {
            var searchQueue = [];
            this.queueSongLists(this.index, searchQueue, omitHidden);
        }
        // store the total
        var total = searchQueue.length;
        // start the search
        this.searchTimeout = setTimeout(() => this.runSearch(searchQueue, total, loadSongData, searchFunc, endBatchFunc, endFunc), this.searchDelay);
    }

    queueSongLists(map, queue, omitHidden=false) {
        // recursive search
        if (map.songs) {
            // leaf category: search individual songs for keywords
            if (!omitHidden) {
                queue.push(map.songs);
            } else {
                queue.push(map.songs.filter(s => !this.isSongHidden(s)));
            }
        } else {
            // branch category: recursively search each subcategory
            for (var key in map) {
                var skip = !omitHidden ? false : map[key].songs && map[key].songs[0].div.parentElement.style.display == 'none';
                if (!skip) {
                    this.queueSongLists(map[key], queue, omitHidden);
                }
            }
        }
    }

    runSearch(searchQueue, totalItems, loadSongData, searchFunc, endBatchFunc=null, endFunc=endBatchFunc) {
        // count songs searched
        var count = 0;
        // search song lists until we exceed the batch size
        while (count < this.searchBatchLimit) {
            // nothing left in the queue
            if (searchQueue.length == 0) {
                // clear the timeout
                this.searchTimeout = null;
                // end the search
                if (endFunc) endFunc();
                return;
            }

            // if we need to load song data then check to see if the song's database is loaded
            if (loadSongData && !this.database[searchQueue[0][0].dbName]) {
                // continue this search after loading the database
                this.queryDb(searchQueue[0][0].dbName, () => {
                    this.runSearch(searchQueue, totalItems, loadSongData, searchFunc, endBatchFunc, endFunc);
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
                searchFunc(song, songList, index, totalItems);
            }
            // increment the count
            count += songs.length;
        }

        if (endBatchFunc) endBatchFunc();
        // schedule the next batch
        this.searchTimeout = setTimeout(() => this.runSearch(searchQueue, totalItems, loadSongData, searchFunc, endBatchFunc, endFunc), this.searchDelay);
    }

    showSong(song) {
        // if the song is hidden
        if (song.div.style.display == "none") {
            // show it
            song.div.style.display = "block";
            // show its parent, if necessary
            this.incrementVisibleChildren(song.div.parentElement, true);
        }
    }

    isSongHidden(song) {
        return song.div.style.display == "none";
    }

    hideSong(song) {
        // if the song is not hidden
        if (!this.isSongHidden(song)) {
            // hide it
            song.div.style.display = "none";
            // hide its parent, if necessary
            this.decrementVisibleChildren(song.div.parentElement, true);
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

            // put all this into one undo action
            this.score.startActions();

            if (playlistEnabled()) {
                // if the playlist is fully enabled then just add the first song and select it
                this.score.playlist.addSongCode(songs[0], true, true, true);

            } else if (playlistVisible()) {
                // if the playlist is visible but not enabled, then clear it
                // it must have been enabled by a previous multi-song library entry
                this.score.playlist.clear(true);
                if (songs.length == 1) {
                    // if there's only one song in this library entry then hide the playlist
                    // and set the song in the score
                    hidePlaylist();
                    this.score.setSong(songs[0], true, false);

                } else {
                    // there are more songs to come, just add the first song and select it
                    this.score.playlist.addSongCode(songs[0], true, true, true);
                }

            } else if (songs.length > 1) {
                // if the playlist is not visible and there is more than one song the
                // show the playlist, but don't enable it automatically
                showPlaylist(false);
                // clear it for grins
                this.score.playlist.clear(true);
                // there are more songs to come, just add the first song and select it
                this.score.playlist.addSongCode(songs[0], true, true, true);

            } else {
                // if there's no playlist visible and only one song in the library entry then
                // just set the song in the score
                this.score.setSong(songs[0], true, false);
            }

            if (songs.length > 1) {
                // append the rest of the songs, without selecting them and appended after the first one
                for (var i = 1; i < songs.length; i++) {
                    this.score.playlist.addSongCode(songs[i], false, false, true);
                }

                // enable looping
                this.score.playlist.setLooping(true);

            } else if (playlistVisible()) {
                // disable looping if it's just one song
                this.score.playlist.setLooping(false);
            }

            // close the undo action
            this.score.endActions();

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

    startSearchDisplay(extraButtonHtml, endFunc) {
        // experimental song match search

        // remove the regular menu and index containers temporarily
        this.menuContainer.remove();
        this.menuContainerSaved = this.menuContainer;
        this.indexContainer.remove();
        this.indexContainerSaved = this.indexContainer;

        // build special menu container
        this.menuContainer = document.createElement("div");
        this.menuContainer.className = "scoreButtonContainer";
        // menu bar, just HTML it
        this.menuContainer.innerHTML = `
            <div class="scoreButtonRow">
                <span class="imgButton titleButton tooltip"><img src="img/icon-clear.png" srcset="img2x/icon-clear.png 2x" alt="Back"/>
                    <span class="tooltiptextbottom">Go back</span>
                </span>
                ${extraButtonHtml}
            </div>
        `;

        // build a second loader just for the progress bar
        this.searchLoader = new Loader();
        this.searchLoader.setLabel("Searching");
        this.searchLoader.log = true;
        this.menuContainer.appendChild(this.searchLoader.loadingBox);
        this.libraryContainer.appendChild(this.menuContainer);

        getFirstChild(this.menuContainer, "titleButton").addEventListener("click", () => { endFunc(); });
    }

    endSearchDisplay() {
        // restore the original menu bar and index
        this.menuContainer.remove();
        this.menuContainer = this.menuContainerSaved;
        this.libraryContainer.appendChild(this.menuContainer);

        this.indexContainer.remove();
        this.indexContainer = this.indexContainerSaved;
        this.libraryContainer.appendChild(this.indexContainer);
    }

    matchSearch() {
        this.startSearchDisplay("", () => { this.endMatchSearch(); });

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
        this.startFuncSearch(true, false, (song, songList, index, total) => {
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
        this.endSearchDisplay();
        this.searchLoader = null;
    }

    sortNonMiscCategories() {
        var catCounts = [];
        this.getCategoryCounts("main", this.index, catCounts, (n) => {return !n.startsWith("Misc")});

        catCounts.sort( (a, b) => {
            return b.count - a.count;
        })

        return catCounts;
    }

    getCategoryCounts(name, cat, catCounts, filter=null) {
        if (filter && !filter(name)) {
            return;
        }
        console.log("Counting " + name);
        if (cat.songs) {
            catCounts.push( { "name": name, "count": cat.songs.length });
            return;
        }
        for (var name2 in cat) {
            var cat2 = cat[name2];
            this.getCategoryCounts(name2, cat2, catCounts, filter);
        }
    }

    setFilterFlag(tag, enabled) {
        if (enabled) {
            addToListIfNotPresent(this.filterTagList, tag);
        } else {
            removeFromList(this.filterTagList, tag);
        }
        this.filterTagListChanged = true;

        this.startWordSearch(this.searchWords);
    }

    getInstrumentFilter(create=false) {
        if (this.instrumentFilter == null && !create) {
            return null;
        }
        return this.instrumentFilter != null ? this.instrumentFilter: this.newInstrumentFilter();
    }

    newInstrumentFilter() {
        var filter = {};
        for (var p = 0 ; p < packs.length; p++) {
            var partFilter = {};
            for (var b = 0 ; b < sectionNames.length; b++) {
                partFilter[sectionNames[b]] = true;
            }
            filter[packs[p].name] = partFilter;
        }
        return filter;
    }

    hasFilters(newInstrumentFilter) {
        for (var p in newInstrumentFilter) {
            var parts = newInstrumentFilter[p];
            for (var b in parts) {
                if (parts[b] == false) {
                    return true;
                }
            }
        }
        return false;
    }

    setInstrumentFilter(newInstrumentFilter) {
        if (newInstrumentFilter == null || !this.hasFilters(newInstrumentFilter)) {
            this.instrumentFilterChanged = this.instrumentFilter != null;
            this.instrumentFilter = null;
        } else {
            this.instrumentFilterChanged = true;
            this.instrumentFilter = newInstrumentFilter;
        }

        if (this.instrumentFilterChanged) {
            this.startWordSearch(this.searchWords);
        }
    }

    showFilter(button) {
        //var button = e.currentTarget;

        var partNames = sectionNames;
        var packNames = packs.map(p => p.name);

        var instrumentFilter = this.getInstrumentFilter(true);
        var filterGrid = Array();

        for (k = 0; k <= packNames.length; k++) {
            var packRow = Array();
            filterGrid.push(packRow);
            for (r = 0; r <= partNames.length; r++) {
                packRow.push({"enabled": false, "checkbox": null});
            }
        }

        function setFilterValues(pack1, pack2, part1, part2, enabled) {
            for (var k = pack1; k <= pack2; k++) {
                for (var r = part1; r <= part2; r++) {
                    var filter = filterGrid[k][r];
                    if (filter.enabled != enabled) {
                        filter.enabled = enabled;
                        filter.checkbox.checked = enabled;
                        if (k > 0 && r > 0) {
                            instrumentFilter[packNames[k - 1]][partNames[r - 1]] = enabled;
                        }
                    }
                }
            }
        }

        function checkState() {
            var allEnabled = true;

            // go through by part column and make sure the column header is good
            for (r = 1; r <= partNames.length; r++) {
                var partEnabled = true;
                for (k = 1; k <= packNames.length; k++) {
                    if (!filterGrid[k][r].enabled) {
                        partEnabled = false;
                        break;
                    }
                }
                setFilterValues(0, 0, r, r, partEnabled);
                allEnabled &= partEnabled;
            }

            // go through by pack row and make sure the row header is good
            for (k = 1; k <= packNames.length; k++) {
                var packEnabled = true;
                for (r = 1; r <= partNames.length; r++) {
                    if (!filterGrid[k][r].enabled) {
                        packEnabled = false;
                        break;
                    }
                }
                setFilterValues(k, k, 0, 0, packEnabled);
                allEnabled &= packEnabled;
            }

            setFilterValues(0, 0, 0, 0, allEnabled);
        }
        
        function changeFilter(library, pack, part, enabled) {
            if (filterGrid[pack][part].enabled == enabled) return;
            
            // check or uncheck the appropriate cells
            if (part == 0) {
                if (pack == 0) {
                    // pack == 0, part == 0, this is the "all" checkbox, modify everything
                    setFilterValues(0, packNames.length, 0, partNames.length, enabled);
                } else {
                    // part == 0, this is a checkbox for the whole pack row, modify the row
                    setFilterValues(pack, pack, 0, partNames.length, enabled);
                }
            } else if (pack == 0) {
                // pack == 0, this is a checkbox for the whole part column, modify the column
                setFilterValues(0, packNames.length, part, part, enabled);
            } else {
                // normal cell, just modify the one value
                setFilterValues(pack, pack, part, part, enabled);
            }

            checkState();

            library.setInstrumentFilter(instrumentFilter);
        }

        function checkboxListener(e) {
            var cb = e.currentTarget;
            cb.blur();
            changeFilter(cb.library, cb.pack, cb.part, cb.checked);
        }

        // jesus this is gonna be a lot of javascript HTML creation

        function checkbox(library, pack, part) {
            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = "filtercheckbox";
            cb.pack = pack;
            cb.part = part;
            cb.library = library;
            cb.addEventListener("change", checkboxListener, { passive: false });
            filterGrid[pack][part].checkbox = cb;
            return cb;
        }

        function label(string) {
            var l = document.createElement("strong");
            l.className = "filterLabel";
            l.innerHTML = string;
            return l;
        }

        var menuDiv = document.createElement("div");
        menuDiv.className = "menu";
        menuDiv.button = button;

        var div = document.createElement("div");
        div.className = "libraryMenu";
        menuDiv.appendChild(div);

        var buttonRow = document.createElement("div");
        buttonRow.className = "scoreButtonRow";
        div.appendChild(buttonRow);

        buttonRow.innerHTML = `
            <span class="imgButton titleButton tooltip">
                <img src="img/icon-clear.png" srcset="img2x/icon-clear.png 2x" alt="Close">
                <span class="tooltiptextbottom">Close</span>
            </span>
            <span class="imgButton tooltip resetButton">
                <img src="img/icon-reset.png" srcset="img2x/icon-reset.png 2x" alt="Reset">
                <span class="tooltiptextbottom">Reset Filter</span>
            </span>
        `;

        getFirstChild(div, "titleButton").addEventListener("click", (e) => {
            clearMenus();
        }, { passive: false });

        getFirstChild(div, "resetButton").library = this;
        getFirstChild(div, "resetButton").addEventListener("click", (e) => {
            changeFilter(e.currentTarget.library, 0, 0, true);
        }, { passive: false });

        var table = document.createElement("table");
        table.className = "filterTable";
        div.appendChild(table);

        {
            var headTr = document.createElement("tr");
            headTr.className = "filterRow filterHeadRow";
            table.appendChild(headTr);

            var headTd = document.createElement("td");
            headTd.className = "filterCell";
            headTd.colSpan = 2;
            headTr.appendChild(headTd);

            for (var r = 0 ; r < partNames.length; r++) {
                var part = partNames[r];
                var td = document.createElement("td");
                td.className = "filterCell";
                headTr.appendChild(td);

                var img = document.createElement("img");
                img.src = `img/${sectionImages[part]}.png`;
                img.srcset = `img2x/${sectionImages[part]}.png 2x`;
                img.alt = `${sectionMetaData[part].displayName}`;
                td.appendChild(img);
            }
        }

        {
            var headTr = document.createElement("tr");
            headTr.className = "filterRow filterHeadRow";
            table.appendChild(headTr);

            var headTd = document.createElement("td");
            headTd.className = "filterCell";
            headTr.appendChild(headTd);
            var allCb = checkbox(this, 0, 0);
            headTd.appendChild(allCb);

            var labelTd = document.createElement("td");
            labelTd.className = "filterCell";
            labelTd.appendChild(label("All"));
            headTr.appendChild(labelTd);

            for (var r = 0; r < partNames.length; r++) {
                var part = partNames[r];
                var td = document.createElement("td");
                td.className = "filterCell";
                headTr.appendChild(td);

                var cb = checkbox(this, 0, r + 1);
                td.appendChild(cb);
            }
        }

        for (var k = 0 ; k < packs.length; k++) {
            var tr = document.createElement("tr");
            tr.className = "filterRow";
            table.appendChild(tr);

            var headTd = document.createElement("td");
            headTd.className = "filterCell";
            tr.appendChild(headTd);
            var allCb = checkbox(this, k + 1, 0);
            headTd.appendChild(allCb);

            var labelTd = document.createElement("td");
            labelTd.className = "filterCell";
            labelTd.appendChild(label(packs[k].displayName));
            tr.appendChild(labelTd);

            for (var r = 0 ; r < partNames.length; r++) {
                var part = partNames[r];
                var td = document.createElement("td");
                td.className = "filterCell";
                tr.appendChild(td);

                var cb = checkbox(this, k + 1, r + 1);
                td.appendChild(cb);
            }
        }

        for (k = 0; k < packNames.length; k++) {
            for (r = 0; r < partNames.length; r++) {
                setFilterValues(k + 1, k + 1, r + 1, r + 1, instrumentFilter[packNames[k]][partNames[r]]);
            }
        }
        checkState();

        // put the menu in the clicked button's parent and anchor it to button
        showMenu(menuDiv, button.parentElement, button);
    }

    showStats() {
        var extraButtons = `
            <span class="imgButton titleButton tooltip"><img src="img/icon-clear.png" srcset="img2x/icon-clear.png 2x" alt="Back"/>
                <span class="tooltiptextbottom">Go back</span>
            </span>
        `;

        var partList = ["all", "perc", "bass", "mel"];
        var extraButtonHtml = "";
        for (var i = 0; i < partList.length; i++) {
            var part = partList[i];
            var m = sectionMetaData[part];
            extraButtonHtml += `
            <span class="imgButton tooltip select${part}" id="select${part}Tab"><img src="img/${sectionImages[part]}.png" srcset="img2x/${sectionImages[part]}.png 2x" alt="${m.displayName}"/>
                <span class="tooltiptextbottom">Show ${m.displayName}</span>
            </span>`;
        }

        this.startSearchDisplay(extraButtonHtml, () => { this.endStats(); });

        function partMap() {
            // why is this so hard
            var map = {};
            for (var i = 0 ; i < sectionNames.length; i++) {
                map[sectionNames[i]] = {"value": 0};
            }
            return map;
        }

        var statMap = {};
        var showPart = null;

        // index container, this is where the songs are listed
        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);

        var table = document.createElement("table");
        table.className = "statTable";
        table.style.width = "100%";
        this.indexContainer.appendChild(table);

        for (var p = 0 ; p < packs.length; p++) {
            if (packs[p].concept) continue;

            var pm = partMap();

            statMap[packs[p].name] = pm;

            var tr = document.createElement("tr");
            tr.className = "statRow";
            table.appendChild(tr);

            var nameTd = document.createElement("td");
            nameTd.className = "statLabel";
            nameTd.style.textAlign = "right";
            nameTd.innerHTML = `<strong>${packs[p].displayName}</strong>`;
            tr.appendChild(nameTd);

            var statTd = document.createElement("td");
            statTd.className = "statCell";
            statTd.style.width = "100%";
            tr.appendChild(statTd);

            for (var b = 0 ; b < sectionNames.length; b++) {
                var statBar = document.createElement("div");
                statBar.className = "statBar quicktooltip";
                statBar.style.backgroundColor = sectionMetaData[sectionNames[b]].color;
                statBar.style.width = "0%";
                statBar.style.height = "0.45em";
                statTd.appendChild(statBar);

                var statBarTooltip = document.createElement("div");
                statBarTooltip.className = "quicktooltiptext";
                statBarTooltip.innerHTML = "";
                statBar.appendChild(statBarTooltip);

                pm[sectionNames[b]].statBar = statBar;
                pm[sectionNames[b]].statBarTooltip = statBarTooltip;

            }
        }

        var totals = partMap();
        var max = partMap();

        function incrementStat(instrumentSet, part, amount) {
            // filter out concept instrument sets
            if (instrumentNameToPack[instrumentSet].concept) {
                return;
            }
            // console.log("incrementing: " + instrumentSet + "/" + part + " by " + amount);
            var partMap = statMap[instrumentSet];
            partMap[part].value += amount;
            totals[part].value += amount;
            if (max[part].value < partMap[part].value) max[part].value = partMap[part].value;
        }

        function renderStats() {
            var maxMax = 0;
            for (var part in max) {
                if (showPart == null || showPart == part) {
                    if (max[part].value > maxMax) maxMax = max[part].value;
                }
            }

            function updatePart(pm) {
                for (var p = 0; p < sectionNames.length; p++) {
                    var part = sectionNames[p];
                    var count = pm[part].value;
                    if (pm[part].statBar) {
                        if (showPart == null || showPart == part) {
                            var percentage = (100 * (count / totals[part].value));
                            pm[part].statBar.style.display = "block";
                            pm[part].statBar.style.width = (percentage * (totals[part].value / maxMax)) + "%";
                            pm[part].statBar.style.height = showPart == null ? "0.45em" : "1.35em";
                            pm[part].statBarTooltip.innerHTML = `${percentage.toFixed(2)}% (${count.toFixed(2)})`;

                        } else {
                            pm[part].statBar.style.display = "none";
                        }
                    }
                }
            }

            for (var i = 0 ; i < packs.length; i++) {
                if (packs[i].concept) {
                    continue;
                }
                var is = packs[i].name;
                var partMap = statMap[is];
                updatePart(partMap);
            }
        }

        function setShowPart(part) {
            showPart = (part == "all") ? null : part;

            for (var r = 0; r < partList.length; r++) {
                var partName = partList[r];
                document.getElementById(`select${partName}Tab`).style.padding = part == partName ? "0.5ex 1ex 1ex 1ex" : "0.5ex 1ex 0 1ex";
            }

            renderStats();
        }

        for (var i = 0; i < partList.length; i++) {
            var partName = partList[i];
            var partButton = getFirstChild(this.menuContainer, `select${partName}`);
            partButton.partName = partName;
            partButton.addEventListener("click", (e) => { setShowPart(e.currentTarget.partName); });
        }

        this.startFuncSearch(true, true, (song, songList, index, total) => {
            var numSongs = songList.length;
            for (var i = 0; i < numSongs; i++) {
                // parse to a song object
                var songObject = new Song();
                songObject.parseChatLink(songList[i]);
                // increment statistics for each instrument set part used
                for (var part in songObject.packs) {
                    // if a song entry has multiple songs, then weight each instrument set part
                    // so the totals still add up to 1
                    incrementStat(songObject.packs[part], part, (1.0/numSongs));
                }
            }
        }, renderStats);

        setShowPart("all");
    }

    endStats() {
        this.endSearchDisplay();
        this.searchLoader = null;
    }

}




class Loader extends ProgressBar {
    constructor() {
        super();
        // AJAX request object
        this.request = null;
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