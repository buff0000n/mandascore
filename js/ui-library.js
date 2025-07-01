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
        // current result size
        this.visibleSongCount = 0;

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
                <input class="titleButton" type="submit" value="Library"/>
                <span class="songTitleDiv">
                    <span class="tooltip">
                        <input class="searchBar" type="text" size="28" onkeyup="setLibrarySearch()"/>
                        <span class="tooltiptextbottom">Search by keyword</span>
                    </span>
                </span>
                <span class="imgButton menuButton tooltip"><img src="img/icon-search.png" srcset="img2x/icon-search.png 2x" alt="Menu"/>
                    <span class="tooltiptextbottom">Library Menu</span>
                </span>
                <span><strong id="visibleSongCount"></strong></span>
            </div>
        `;
        this.libraryContainer.appendChild(this.menuContainer);

        // click handlers
        getFirstChild(this.menuContainer, "titleButton").addEventListener("click", (e) => { this.hide(); });
        getFirstChild(this.menuContainer, "menuButton").addEventListener("click", (e) => { this.showMenu(e); });

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
            <div class="button searchButton tooltip">
                <img class="imgButton" src="img/icon-search.png" srcset="img2x/icon-search.png 2x" alt="Reverse Search"/>
                Reverse Search
                <span class="tooltiptextbottom">Reverse search for the current song in the library</span>
            </div>
            <div class="button statsButton tooltip">
                <img class="imgButton" src="img/icon-search.png" srcset="img2x/icon-search.png 2x" alt="Instrument Stats"/>
                Instrument Stats
                <span class="tooltiptextbottom">Show statistics for instrument sets used in the currently visible songs</span>
            </div>
        `;

        div.innerHTML = html;
        getFirstChild(div, "searchButton").addEventListener("click", () => {
            clearMenus();
            this.matchSearch();
        });
        getFirstChild(div, "statsButton").addEventListener("click", () => {
            clearMenus();
            this.showStats();
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
        this.startFuncSearch(false, false, (song, songList, index, total) => {
            // the song is displayed if there is no search string or if all of the words are found in its keywords
            if (!words || this.searchKeywords(song.keywords, words)) {
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
                    this.score.playlist.addSongCode(songs[i], false, true, true);
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

    startSearchDisplay(endFunc) {
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
        this.startSearchDisplay(() => { this.endMatchSearch(); });

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

    showStats() {
        this.startSearchDisplay(() => { this.endStats(); });

        function partMap() {
            // why is this so hard
            var map = {};
            for (var i = 0 ; i < sectionNames.length; i++) {
                map[sectionNames[i]] = {"value": 0};
            }
            return map;
        }

        var statMap = {};

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
                statBar.className = "statBar";
                statBar.style.backgroundColor = sectionMetaData[sectionNames[b]].color;
                statBar.style.width = "0%";
                statBar.style.height = "0.45em";
                statTd.appendChild(statBar);
                pm[sectionNames[b]].statBar = statBar;
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
                if (max[part].value > maxMax) maxMax = max[part].value;
            }

            function printPartMap(pm) {
                var s0 = "";
                for (var p = 0; p < sectionNames.length; p++) {
                    var part = sectionNames[p];
                    var count = pm[part].value;
                    if (p > 0) s0 += ", ";
                    s0 += part + ": " + count.toFixed(2);
                    if (pm[part].statBar) {
                        var percentage = (100 * (count / totals[part].value));
                        pm[part].statBar.style.width = (percentage * (totals[part].value / maxMax)) + "%";
                        pm[part].statBar.style.height = "0.45em";
                    }
                }
                return s0;
            }

            var s = "";
            for (var i = 0 ; i < packs.length; i++) {
                if (packs[i].concept) {
                    continue;
                }
                var is = packs[i].name;
                s += is + ": (";
                var partMap = statMap[is];
                s += printPartMap(partMap);
                s += ")\n";
            }
            var output = "totals: " + printPartMap(totals) + "\nmax: " + printPartMap(max) + "\n" + s;
            console.log(output);
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