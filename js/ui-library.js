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
        this.searchWordsChanged = false;
        // current search queue
        this.searchQueue = null;
        // current result size
        this.visibleSongCount = 0;
        // instrument filter, if present
        this.instrumentFilter = null;
        this.instrumentFilterChanged = false;
        // tag filter list
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

        // search bar handler
        getFirstChild(this.menuContainer, "searchBar").addEventListener("keyup", (e) => { this.setLibrarySearch(e); });

        // index container, this is where the songs are listed
        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);
    }

    showMenu(e) {
        // place the menu under the burger button
        var button = e.currentTarget;
        // top level container
        var div = document.createElement("div");
        div.className = "menu";
        div.button = button;

        // build the menu buttons the easy way
        var html = `
            <div class="button expandButton tooltip">
                <img class="imgButton" src="img/icon-add.png" srcset="img2x/icon-add.png 2x" alt="Expand All"/>
                Expand All
                <span class="tooltiptextbottom">Expand all visible categories</span>
            </div>
            <div class="button collapseButton tooltip">
                <img class="imgButton" src="img/icon-subtract.png" srcset="img2x/icon-subtract.png 2x" alt="Collapse All"/>
                Collapse All
                <span class="tooltiptextbottom">Collapse all visible categories</span>
            </div>
            <div class="button filterButton tooltip">
                <img class="imgButton" src="img/icon-filter.png" srcset="img2x/icon-filter.png 2x" alt="Instrument Filter"/>
                Instrument Filter
                <span class="tooltiptextbottom">Set a filter for instrument packs and parts</span>
            </div>
            <div class="button flagPerfectButton tooltip">
                <input type="checkbox" class="checkboxFlagPerfect"/>
                Perfect Melody Filter
                <span class="tooltiptextbottom">Show only songs with a melody that translate perfectly to the Mandachord</span>
            </div>
            <div class="button flagFilledButton tooltip">
                <input type="checkbox" class="checkboxFlagFilled"/>
                Filled Melody Filter
                <span class="tooltiptextbottom">Show only filled-melody meta songs</span>
            </div>
            <div class="button flagSparseButton tooltip">
                <input type="checkbox" class="checkboxFlagSparse"/>
                Sparse Melody Filter
                <span class="tooltiptextbottom">Show only songs with sparse melodies</span>
            </div>
            <div class="button flagMultiButton tooltip">
                <input type="checkbox" class="checkboxFlagMulti"/>
                Multi-shot Filter
                <span class="tooltiptextbottom">Show only entries with multiple Mandachord loops</span>
            </div>
            <div class="button flagNoDemoButton tooltip">
                <input type="checkbox" class="checkboxFlagNoDemo"/>
                Hide Demo Songs
                <span class="tooltiptextbottom">Hide demo songs</span>
            </div>
            <div class="button resetButton tooltip">
                <img class="imgButton" src="img/icon-reset.png" srcset="img2x/icon-reset.png 2x" alt="Reset All"/>
                Reset All Filters
                <span class="tooltiptextbottom">Reset all filters</span>
            </div>
            <div class="button statsButton tooltip">
                <img class="imgButton" src="img/icon-stats.png" srcset="img2x/icon-stats.png 2x" alt="Instrument Stats"/>
                Instrument Statistics
                <span class="tooltiptextbottom">Show statistics for instrument packs used in the currently visible songs</span>
            </div>
            <div class="button dateStatsButton tooltip">
                <img class="imgButton" src="img/icon-date.png" srcset="img2x/icon-date.png 2x" alt="Instrument Stats"/>
                Date Statistics
                <span class="tooltiptextbottom">Show statistics on publish dates</span>
            </div>
            <!-- todo the reverse search sucks
            <div class="button searchButton tooltip">
                <img class="imgButton" src="img/icon-search.png" srcset="img2x/icon-search.png 2x" alt="Reverse Search"/>
                Reverse Search
                <span class="tooltiptextbottom">Reverse search for the current song in the library</span>
            </div>
            -->
        `;

        div.innerHTML = html;
        /*
        // todo the reverse search sucks
        getFirstChild(div, "searchButton").addEventListener("click", (e) => {
            clearMenus();
            this.matchSearch(e);
        });
        */
        // expand all button
        getFirstChild(div, "expandButton").addEventListener("click", (e) => {
            this.updateCatCounts(true, true);
        });
        // collapse all button
        getFirstChild(div, "collapseButton").addEventListener("click", (e) => {
            this.updateCatCounts(false, true);
        });
        // instrument filter popup
        getFirstChild(div, "filterButton").addEventListener("click", (e) => {
            clearMenus();
            this.showFilter(button);
        });
        // stats mode
        getFirstChild(div, "statsButton").addEventListener("click", (e) => {
            clearMenus();
            this.showStats(e);
        });
        // date stats mode
        getFirstChild(div, "dateStatsButton").addEventListener("click", (e) => {
            clearMenus();
            this.showDateStats(e);
        });

        // convenience function for setting up the tag filter checkboxes
        function setupTagFilterCheckbox(library, element, tag) {
            element.checked = library.filterTagList.indexOf(tag) >= 0;
            element.library = library;
            element.tag = tag;
            element.addEventListener("change", (e) => {
                e.currentTarget.library.setFilterFlag(e.currentTarget.tag, e.currentTarget.checked);
            });
        }

        // setup tag filter checkboxes
        setupTagFilterCheckbox(this, getFirstChild(div, "checkboxFlagNoDemo"), "!Demo");
        setupTagFilterCheckbox(this, getFirstChild(div, "checkboxFlagPerfect"), "Perfect");
        setupTagFilterCheckbox(this, getFirstChild(div, "checkboxFlagFilled"), "Filled");
        setupTagFilterCheckbox(this, getFirstChild(div, "checkboxFlagSparse"), "Sparse");
        setupTagFilterCheckbox(this, getFirstChild(div, "checkboxFlagMulti"), "Multi");

        // setup reset button
        getFirstChild(div, "resetButton").addEventListener("click", (e) => {
            this.resetAllFilters();
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
            // make sure the "no results" message is displayed if the count is zero
            this.showNoResultMessage(this.visibleSongCount == 0);
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
        this.buildTree(this.indexContainer, this.index);

        // build the no result message
        this.indexContainer.appendChild(this.buildNoResultMessage());

        this.updateVisibleSongCount();

        // build the search queue prototype, no point in building this every time
        this.searchQueuePrototype = [];
        this.queueSongLists(this.index, this.searchQueuePrototype, false);
    }

    buildNoResultMessage() {
        var div = document.createElement("div");
        div.className = "disabled";
        div.style.display = "none";
        div.innerHTML = "No results";
        this.noResultMessage = div;
        return div;
    }

    showNoResultMessage(show) {
        this.noResultMessage.style.display = show ? "block" : "none";
    }

    buildCatDiv(categoryName, catClickCallback) {
        // build the div for displaying a category
        var catDiv = document.createElement("div");
        catDiv.className = "libCat";
        catDiv.innerHTML = `
        <span class="libCatHeader">
            <span class="libCatButton">
                <img src="img/icon-expand.png" srcset="img2x/icon-expand.png 2x" alt="Expand"/>
            </span>
            <span class="libCatLabel">${categoryName}</span>
            <span class="libCatCount">(0)</span>
        </span>`;
        this.initVisibleChildren(catDiv, getFirstChild(catDiv, "libCatCount"));
        getFirstChild(catDiv, "libCatHeader").addEventListener("click", catClickCallback, { passive: false });
        return catDiv;
    }

    buildIndentDiv() {
        // build the div for indenting the entries under a category
        var indentDiv = document.createElement("div");
        indentDiv.className = "libIndent";
        this.initIndent(indentDiv);
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
        // generate multi-shot tag and UI element from the multi count
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

    buildTree(parent, map) {
        this.buildTree0(parent, map, null, [], (e) => { this.catClicked(e); });
        this.updateCatCounts();
    }

    buildTree0(parent, map, dbName, cats, catClickCallback) {
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
                // easy way to initialize this, automatically skips demo songs
                if (song.date) this.visibleSongCount += 1;
                // references from the song entry to the UI
                song.div = songDiv;
                // prepare the song entry for searching
                this.indexSong(song, cats);
            }
        } else {
            // it's a branch category that contains subcategories
            for (var cat in map) {
                // have to add the UI to the DOM before adding songs
                var catDiv = this.buildCatDiv(cat, catClickCallback);
                parent.appendChild(catDiv);
                // build an additional layer for indenting and manual hiding/showing
                var subDiv = this.buildIndentDiv();
                catDiv.appendChild(subDiv);
                // add to the category stack
                cats.push(cat);
                // recursive call to build the subcategory
                this.buildTree0(subDiv, map[cat], dbName2, cats, catClickCallback);
                // pop off the category stack
                cats.pop();
            }
        }
    }

    updateCatCounts(isKeywordSearch = false, overrideManual = false) {
        // ffs I really gotta convert this whole file to a function scope
        var thiz = this;

        function update(parent) {
            var children = parent.children;
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                // skip category label
                if (child.className == "libCatHeader") continue;
                // If a song is encountered, skip all the children
                if (child.className == "libSongLabel") break;
                // if there are visible children and a count element then update the element
                if (child.visibleChildren > 0 && child.countElement) {
                    child.countElement.innerHTML = child.visibleChildren;
                // if it's an indent object then automatically show or hide depending
                // on whether there is a keyword search active
                } else if (child.manualShow != null) {
                    thiz.showIndent(child, overrideManual ? isKeywordSearch : isKeywordSearch || child.manualShow, overrideManual);
                }
                // recurse if it's a visible category or an indent
                if (child.visibleChildren > 0 || child.manualShow != null) {
                    update(child);
                }
            }
        }

        update(this.indexContainer);
    }

    initVisibleChildren(parent, countElement = null) {
        // init the variable that will keep track of how many of a parent's children are visible
        // this is so categories whose songs or subcategories are all hidden can go be hidden themselves
        parent.visibleChildren = 0;
        // save a reference to the count element so we can easily get to it
        if (countElement) {
            parent.countElement = countElement;
        }
    }

    incrementVisibleChildren(parent, isSong = false) {
        // skip the indent div
        parent = parent ? parent.parentElement : parent;
        // check if this is a valid tracking parent
        if (parent && parent.visibleChildren != null) {
            // increment the visible children
            var count = parent.visibleChildren + 1;
            parent.visibleChildren = count;
            // if the visible count was incremented from 0 to 1 then display the parent
            if (count == 1) {
                parent.style.display = "block";
            }

            // update the parent's parent and display it if necessary
            this.incrementVisibleChildren(parent.parentElement);
        }
    }

    decrementVisibleChildren(parent, isSong = false) {
        // skip the indent div
        parent = parent ? parent.parentElement : parent;
        // check if this is a valid tracking parent
        if (parent && parent.visibleChildren != null) {
            // decrement the visible children
            var count = parent.visibleChildren - 1;
            parent.visibleChildren = count;
            // if the visible count has decremented from 1 to 0 then hide the parent
            if (count == 0) {
                parent.style.display = "none";
            }

            // update the parent's parent and hide if necessary
            this.decrementVisibleChildren(parent.parentElement);
        }
    }

    initIndent(indent) {
        // flag for whether it's been manually expanded
        indent.manualShow = false;
        // start off collapsed
        indent.style.display = "none";
    }

    catClicked(e) {
        // get the indent element
        var parent = e.currentTarget.parentElement;
        var indent = getFirstChild(parent, "libIndent");
        // toggle depending on the current display style
        this.showIndent(indent, indent.style.display == "none", true);
    }

    showIndent(indent, show, setManual = false) {
        // check if we're showing a currently hidden indent
        if (show && indent.style.display == "none") {
            indent.style.display = "block";
            var button = getFirstChild(indent.parentElement, "libCatButton");
            button.innerHTML = `<img src="img/icon-collapse.png" srcset="img2x/icon-collapse.png 2x" alt="Collapse"/>`;
            // update the flag if specified
            if (setManual) indent.manualShow = true;

        // check if we're hiding a currently shown indent
        } else if (!show && indent.style.display != "none") {
            indent.style.display = "none";
            var button = getFirstChild(indent.parentElement, "libCatButton");
            button.innerHTML = `<img src="img/icon-expand.png" srcset="img2x/icon-expand.png 2x" alt="Expand"/>`;
            // update the flag if specified
            if (setManual) indent.manualShow = false;
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
        // get the search bar contents and kick off a search
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

    searchKeywords(keywords) {
        var words = this.searchWords;
        // short-circuit if there are no keywords
        if (!words) return true;
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
        // short-circuit if there is no instrument filter
        if (!this.instrumentFilter) return true;

        var songListAllowed = false;
        // search song list for a song matching the current instrument filter
        for (var i = 0; i < songList.length; i++) {
            // parse into a song object
            var songObject = new Song();
            // just skip full playlist songs when an instrument filter is active
            if (songList[i].startsWith("playlist=")) continue;
            songObject.parseChatLink(songList[i]);
            var songAllowed = true;
            // loop over the song's parts
            for (var part in songObject.packs) {
                // get the instrument pack for that part
                var pack = songObject.packs[part];
                // if any pack + part in the song is disabled in the filter then this song is filtered out
                if (!this.instrumentFilter[pack][part]) {
                    songAllowed = false;
                    break;
                }
            }
            // the song list is allowed if at least one of of its songs is allowed
            songListAllowed |= songAllowed;
        }
        return songListAllowed;
    }

    preprocessTagFilter() {
        // preprocess the tag filters so we don't have to parse them
        // for every song
        this.filterTagListCopy = Array();
        this.filterTagListNegate = Array();
        for (var f = 0; f < this.filterTagList.length; f++) {
            var filterTag = this.filterTagList[f];
            if (filterTag.startsWith("!")) {
                // if the tag filter starts with "!" then this is a negative filter,
                // only songs that do *not* have the tag will be allowed
                this.filterTagListCopy.push(filterTag.substring(1));
                this.filterTagListNegate.push(true);
            } else {
                // otherwise this is a normal filter, only songs that have the tag
                // will be allowed
                this.filterTagListCopy.push(filterTag);
                this.filterTagListNegate.push(false);
            }
        }
    }

    searchTagFilter(song) {
        // short-circuit if there are no tag filters
        if (this.filterTagListCopy.length == 0) return true;

        var tagged = true;
        // search through the current tag filters and make sure the song matches all of them
        for (var f = 0; f < this.filterTagListCopy.length; f++) {
            var filterTag = this.filterTagListCopy[f];
            // if the flag filter is negative then make sure the song has no tags or does not contain the tag
            // if the flag filter is positive then make sure the song has tags and contains the tag
            if (this.filterTagListNegate[f] ?
                song.tags != null && song.tags.indexOf(filterTag) >= 0 :
                song.tags == null || song.tags.indexOf(filterTag) < 0
            ){
                // failed the filter
                tagged = false;
            }
        }
        return tagged;
    }

    startWordSearch(words) {
        if (listEquals(words, this.searchWords)) {
            return;
        }
        // save the current search criteria
        this.searchWords = words;
        this.searchWordsChanged = true;
        this.startSearch();
    }

    startSearch() {
        // only do this crap if the search has actually changed
        if (!this.searchWordsChanged && !this.instrumentFilterChanged && !this.filterTagListChanged) {
            return;
        }
        // reset change flags
        this.searchWordsChanged = false;
        this.instrumentFilterChanged = false;
        this.filterTagListChanged = false;

        // do some pre-processing on the tag filters, if present
        this.preprocessTagFilter();

        // start the search
        // whether we need to load the actual songs is dependent on whether we have an instrument pack filter
        this.startFuncSearch(this.instrumentFilter != null, false, (song, songList, index, total) => {
            // the song entry is displayed
            //   - if there is no tag filter of if the tag filter passes
            //   - if there is no search string or if all of the words are found in its keywords
            //   - if there is no instrument pack filter or the instrument pack filter passes on at least one of its songs
            if (this.searchTagFilter(song) &&
                    this.searchKeywords(song.keywords) &&
                    this.searchInstrumentFilter(songList)) {
                // show the song
                this.showSong(song);
            } else {
                // otherwise, hide the song
                this.hideSong(song);
            }
        }, () => {
            // batch completion callback updates the song count
            this.updateVisibleSongCount();
            // update the category song counts and indent hiding
            this.updateCatCounts(this.searchWords);
        });
    }

    // omitHidden: only search the currently visible songs, this is how the stats are calculated
    startFuncSearch(loadSongData, omitHidden, searchFunc, endBatchFunc=null, endFunc=endBatchFunc) {
        // cancel any search in progress
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        // get a copy of the search queue
        if (!omitHidden) {
            // doing a full search of the library
            var searchQueue = this.searchQueuePrototype.slice();
        } else {
            // doing a partial search of just what's currently visible
            // this is for the statistics calculation
            var searchQueue = [];
            this.queueSongLists(this.index, searchQueue, omitHidden);
        }
        // store the total
        var total = searchQueue.length;
        // start the search
        this.searchTimeout = setTimeout(() => this.runSearch(searchQueue, total, loadSongData, searchFunc, endBatchFunc, endFunc), this.searchDelay);
    }

    // omitHidden: only search the currently visible songs, this is how the stats are calculated
    queueSongLists(map, queue, omitHidden=false) {
        // recursive search
        if (map.songs) {
            // leaf category: search individual songs for keywords
            if (!omitHidden) {
                // doing a full search of the library
                queue.push(map.songs);
            } else {
                // just queue up the visible songs
                queue.push(map.songs.filter(s => !this.isSongHidden(s)));
            }
        } else {
            // branch category: recursively search each subcategory
            for (var key in map) {
                // determine if the entire subcategory is hidden by seeing if the parent element of the first song in the
                // subcategory is hidden
                // have to go two parents up to find the category div
                var skip = !omitHidden ? false : map[key].songs && map[key].songs[0].div.parentElement.parentElement.style.display == 'none';
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
            // increment search result size if this is a non-demo song
            if (song.date) {
                this.visibleSongCount += 1;
            }
        }
    }

    isSongHidden(song) {
        // hack
        return song.div.style.display == "none";
    }

    hideSong(song) {
        // if the song is not hidden
        if (!this.isSongHidden(song)) {
            // hide it
            song.div.style.display = "none";
            // hide its parent, if necessary
            this.decrementVisibleChildren(song.div.parentElement, true);
            // decrement search result size if this is a non-demo song
            if (song.date) {
                this.visibleSongCount -= 1;
            }
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

            if (songs.length == 1 && songs[0].startsWith("playlist=")) {
                if (!playlistEnabled()) {
                    // if the playlist is not visible and there is more than one song the
                    // show the playlist, but don't enable it automatically
                    showPlaylist(false);
                }
                setPlaylistFromUrlString(songs[0].substring("playlist=".length), false);

            } else {
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

    replaceUI(extraButtonHtml, endFunc) {
        // replace the library listing with something else
        // currently, this is either the statistics display or 
        // the experimental song match search

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

        // add a handler for the X button
        getFirstChild(this.menuContainer, "titleButton").addEventListener("click", () => { endFunc(); });
    }

    endReplaceUI() {
        // restore the original menu bar and index
        this.menuContainer.remove();
        this.menuContainer = this.menuContainerSaved;
        this.libraryContainer.appendChild(this.menuContainer);

        this.indexContainer.remove();
        this.indexContainer = this.indexContainerSaved;
        this.libraryContainer.appendChild(this.indexContainer);
    }

    // run the match search
    matchSearch() {
        this.replaceUI("", () => { this.endMatchSearch(); });

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
        this.endReplaceUI();
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
        // update the filter tag list depending on whether it's being
        // enabled or disabled
        if (enabled) {
            addToListIfNotPresent(this.filterTagList, tag);
        } else {
            removeFromList(this.filterTagList, tag);
        }
        // set the change flag
        this.filterTagListChanged = true;

        // start a search
        this.startSearch();
    }

    getInstrumentFilter(create=false) {
        // if we don't have a filter and don't have to create one then return null
        if (this.instrumentFilter == null && !create) {
            return null;
        }
        // return the instrument filter if present, otherwise create new new filter with everything enabled
        return this.instrumentFilter != null ? this.instrumentFilter: this.newInstrumentFilter();
    }

    newInstrumentFilter() {
        // pack map
        var filter = {};
        // loop over the pack list
        for (var p = 0 ; p < packs.length; p++) {
            // part map
            var partFilter = {};
            // loop over the parts
            for (var b = 0 ; b < sectionNames.length; b++) {
                // add an enabled entry for this part to the part map
                partFilter[sectionNames[b]] = true;
            }
            // add the packs' part map to the pack map
            filter[packs[p].name] = partFilter;
        }
        return filter;
    }

    hasFilters(newInstrumentFilter) {
        // determine of any of the entries in the map are disabled
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
        // check if the new filter is null or has everything enabled
        if (newInstrumentFilter == null || !this.hasFilters(newInstrumentFilter)) {
            // set the change flag on whether we already had a filter
            this.instrumentFilterChanged = this.instrumentFilter != null;
            // clear out the filter
            this.instrumentFilter = null;
        } else {
            // replacing one partial filter with another partial filter
            // I don't feel like doing a diff, so just assume something has changed
            this.instrumentFilterChanged = true;
            // save the new filter
            this.instrumentFilter = newInstrumentFilter;
        }

        // start a search if there is a change
        if (this.instrumentFilterChanged) {
            this.startSearch();
        }
    }

    showFilter(button) {
        // convenience references to static data
        var partNames = sectionNames;
        var packNames = packs.map(p => p.name);

        // get the current filter
        var instrumentFilter = this.getInstrumentFilter(true);

        // we will build a frickin array of checkboxes
        var filterGrid = Array();

        // create one row for each pack, plus an extra one for the "all" row
        for (k = 0; k <= packNames.length; k++) {
            // create row array
            var packRow = Array();
            filterGrid.push(packRow);
            // create one column for each part, plus an extra one for the "all" part
            for (r = 0; r <= partNames.length; r++) {
                // each grid entry contains a boolean flag and a checkbox element
                packRow.push({"enabled": false, "checkbox": null});
            }
        }

        // set a block of filter values, on rows pack1 to pack2 and columns part1 to part2.
        function setFilterValues(pack1, pack2, part1, part2, enabled) {
            // loop ove rows
            for (var k = pack1; k <= pack2; k++) {
                // loop over columns
                for (var r = part1; r <= part2; r++) {
                    // get the grid entry
                    var filter = filterGrid[k][r];
                    // sanity check
                    if (filter.enabled != enabled) {
                        // update the flag and checkbox
                        filter.enabled = enabled;
                        filter.checkbox.checked = enabled;
                        // if this grid entry corresponds to a filter entry, i.e. it's not an "all" row or column
                        if (k > 0 && r > 0) {
                            // update the filter
                            instrumentFilter[packNames[k - 1]][partNames[r - 1]] = enabled;
                        }
                    }
                }
            }
        }

        // check the state of the grid and make sure the "all" columns reflect the state of their respective rows or columns
        function checkState() {
            // state of the the overall "all" checkbox, start off true
            var allEnabled = true;

            // go through by part column and make sure the all entry is correct
            for (r = 1; r <= partNames.length; r++) {
                // state of the part "all" checkbox, start off true
                var partEnabled = true;
                // loop over the packs
                for (k = 1; k <= packNames.length; k++) {
                    // check the filter grid entry for the pack and part
                    if (!filterGrid[k][r].enabled) {
                        // found one unchecked, the "all" part checkbox must be unchecked
                        partEnabled = false;
                        break;
                    }
                }
                // update the "all" part checkbox
                setFilterValues(0, 0, r, r, partEnabled);
                // update the overall "all" checkbox
                allEnabled &= partEnabled;
            }

            // go through by pack row and make sure the row header is good
            for (k = 1; k <= packNames.length; k++) {
                // state of the pack "all" checkbox, start off true
                var packEnabled = true;
                // loop over the parts
                for (r = 1; r <= partNames.length; r++) {
                    // check the filter grid entry for the pack and part
                    if (!filterGrid[k][r].enabled) {
                        // found one unchecked, the "all" pack checkbox must be unchecked
                        packEnabled = false;
                        break;
                    }
                }
                // update the "all" part checkbox
                setFilterValues(k, k, 0, 0, packEnabled);
                // update the overall "all" checkbox, probably redundant but whatever
                allEnabled &= packEnabled;
            }

            // finally, update the overall "all" checkbox
            setFilterValues(0, 0, 0, 0, allEnabled);
        }
        
        function changeFilter(library, pack, part, enabled) {
            // sanity check
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

            // update the "all" checkboxes
            checkState();

            // set the filter and kick off a search
            library.setInstrumentFilter(instrumentFilter);
        }

        // listener function for all the checkboxes
        function checkboxListener(e) {
            // get the checkbox
            var cb = e.currentTarget;
            // there is a reason for this and I don't remember what it is
            cb.blur();
            // pull row and column info off the checkbox itself and update accordingly
            changeFilter(cb.library, cb.pack, cb.part, cb.checked);
        }

        // jesus this is gonna be a lot of javascript HTML creation

        // build a checkbox
        function checkbox(library, pack, part) {
            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = "filtercheckbox";
            // save some properties for the listener
            cb.pack = pack;
            cb.part = part;
            cb.library = library;
            // add the listener
            cb.addEventListener("change", checkboxListener, { passive: false });
            // fill in the checkbox element in the grid
            filterGrid[pack][part].checkbox = cb;
            // we did it
            return cb;
        }

        // build a label element
        function label(string) {
            var l = document.createElement("strong");
            l.className = "filterLabel";
            l.innerHTML = string;
            return l;
        }

        // pop-up container
        var menuDiv = document.createElement("div");
        menuDiv.className = "menu";
        menuDiv.button = button;

        // top-level container
        var div = document.createElement("div");
        div.className = "libraryMenu";
        menuDiv.appendChild(div);

        // top button container
        var buttonRow = document.createElement("div");
        buttonRow.className = "scoreButtonRow";
        div.appendChild(buttonRow);

        // add buttons the easy way
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

        // close button handler
        getFirstChild(buttonRow, "titleButton").addEventListener("click", (e) => {
            clearMenus();
        }, { passive: false });

        // reset button handler
        getFirstChild(buttonRow, "resetButton").library = this;
        getFirstChild(buttonRow, "resetButton").addEventListener("click", (e) => {
            changeFilter(e.currentTarget.library, 0, 0, true);
        }, { passive: false });

        // table for the checkbox grid
        var table = document.createElement("table");
        table.className = "filterTable";
        div.appendChild(table);

        // add the top row, which contains the part icons
        {
            // row element
            var headTr = document.createElement("tr");
            headTr.className = "filterRow filterHeadRow";
            table.appendChild(headTr);

            // first element in the row spans two columns
            var headTd = document.createElement("td");
            headTd.className = "filterCell";
            headTd.colSpan = 2;
            headTr.appendChild(headTd);

            // loop over the parts
            for (var r = 0 ; r < partNames.length; r++) {
                // cell element
                var part = partNames[r];
                var td = document.createElement("td");
                td.className = "filterCell";
                headTr.appendChild(td);

                // build the part icon
                td.innerHTML = `<img src="img/${sectionImages[part]}.png" srcset="img2x/${sectionImages[part]}.png 2x" alt="${sectionMetaData[part].displayName}"/>`;
            }
        }

        // next row is the "all" row, with the overall "all" checkbox and the part "all" checkboxes
        {
            // row element
            var headTr = document.createElement("tr");
            headTr.className = "filterRow filterHeadRow";
            table.appendChild(headTr);

            // first cell is the overall "all" checkbox
            var headTd = document.createElement("td");
            headTd.className = "filterCell";
            headTr.appendChild(headTd);
            // sets grid position (0, 0)
            var allCb = checkbox(this, 0, 0);
            headTd.appendChild(allCb);

            // second cell is the "All" label
            var labelTd = document.createElement("td");
            labelTd.className = "filterCell";
            labelTd.appendChild(label("All"));
            headTr.appendChild(labelTd);

            // loop over the parts
            for (var r = 0; r < partNames.length; r++) {
                // cell element
                var part = partNames[r];
                var td = document.createElement("td");
                td.className = "filterCell";
                headTr.appendChild(td);
                // sets grid position (0, part index)
                var cb = checkbox(this, 0, r + 1);
                td.appendChild(cb);
            }
        }

        // loop over the packs
        for (var k = 0 ; k < packs.length; k++) {
            // row element
            var tr = document.createElement("tr");
            tr.className = "filterRow";
            table.appendChild(tr);

            // first cell is the pack "all" checkbox
            var headTd = document.createElement("td");
            headTd.className = "filterCell";
            tr.appendChild(headTd);
            // sets grid position (pack index, 0)
            var allCb = checkbox(this, k + 1, 0);
            headTd.appendChild(allCb);

            // second cell is the pack label
            var labelTd = document.createElement("td");
            labelTd.className = "filterCell";
            labelTd.appendChild(label(packs[k].displayName));
            tr.appendChild(labelTd);

            // loop over the parts
            for (var r = 0 ; r < partNames.length; r++) {
                var part = partNames[r];
                // cell element
                var td = document.createElement("td");
                td.className = "filterCell";
                tr.appendChild(td);
                // sets grid position (pack index, part index)
                var cb = checkbox(this, k + 1, r + 1);
                td.appendChild(cb);
            }
        }

        // copy the filter state to the grid
        for (k = 0; k < packNames.length; k++) {
            for (r = 0; r < partNames.length; r++) {
                setFilterValues(k + 1, k + 1, r + 1, r + 1, instrumentFilter[packNames[k]][partNames[r]]);
            }
        }
        // update the "all" checkboxes
        checkState();

        // put the menu in the clicked button's parent and anchor it to button
        showMenu(menuDiv, button.parentElement, button);
    }

    resetAllFilters() {
        // reset keywords
        this.searchWords = null;
        this.searchWordsChanged = true;
        // have to update the UI
        getFirstChild(this.menuContainer, "searchBar").value = "";

        // reset instrument filter
        this.instrumentFilter = null;
        this.instrumentFilterChanged = true;

        // reset tag filters
        this.filterTagList = [];
        this.filterTagListChanged = true;

        // meh
        clearMenus();
        this.startSearch();
    }

    showStats() {
        // part list plus "all".  too lazy to build from sectionNames
        var partList = ["all", "perc", "bass", "mel"];
        var tabList = ["all", "perc", "bass", "mel", "overall"];

        // build extra button UI
        var extraButtonHtml = "";
        // loop over sections
        for (var i = 0; i < partList.length; i++) {
            // get the part name and metadata
            var part = partList[i];
            var m = sectionMetaData[part];
            // build the part button
            extraButtonHtml += `
            <span class="imgButton tooltip select${part}" id="select${part}Tab">
                <img src="img/${sectionImages[part]}.png" srcset="img2x/${sectionImages[part]}.png 2x" alt="${m.displayName}"/>
                <span class="tooltiptextbottom">Show ${m.displayName}</span>
            </span>`;
        }

        {
            extraButtonHtml += `
            <span class="imgButton tooltip selectoverall" id="selectoverallTab">
                <img src="img/overall.png" srcset="img2x/overall.png 2x" alt="Overall"/>
                <span class="tooltiptextbottom">Show Overall</span>
            </span>`;
        }

        // might as well throw in the song count
        extraButtonHtml += `
            <span class="titleButton visibleSongCount">0</span>
        `;

        extraButtonHtml += `
            <span class="imgButton menuButton tooltip"><img src="img/icon-burger.png" srcset="img2x/icon-burger.png 2x" alt="Menu"/>
                <span class="tooltiptextbottom">Statistics Menu</span>
            </span>
        `;

        // replace the library UI with the statistics UI
        this.replaceUI(extraButtonHtml, () => {
            // when the stats close button is called, revert to the library UI
            this.endReplaceUI();
            this.searchLoader = null;
        });

        // get the count element
        var visibleCountElement = getFirstChild(this.menuContainer, "visibleSongCount");

        // build a map from part name to a structure
        function partMap() {
            // why is this so hard
            var map = {};
            for (var i = 0 ; i < partList.length; i++) {
                // the structure contains a numeric value, and references to its stat bar and tooltip
                map[partList[i]] = {"value": 0, "statBar": null, "statBarTooltip": null};
            }
            return map;
        }

        // static state
        var packToIndex = {};
        var numPacks = 0;

        // dynamic state
        // map from pack name to part map
        var statMap = {};
        // currently selected single part, if there is one
        var showPart = null;

        // top combo list UI element
        var comboGrid = Array();
        // top combos array
        var topCombos = Array();
        // max top combos to show
        var maxTopCombos = 20;

        // keep track of how many songs were released
        // since each instrument pack release date
        var songCountsByDate = {};
        // earliest instrument pack release date
        var startDate = null;
        // loop over the instrument packs
        for (name in instrumentNameToPack) {
            // get the release date of the instrument pack
            var date = instrumentNameToPack[name].releaseDate;
            // check if it's in the map
            if (!songCountsByDate[date]) {
                // initialize the map element
                songCountsByDate[date] = 0;
                // keep track of the earliest date
                if (startDate == null || startDate > date) {
                    startDate = date;
                }
            }
        }

        // UI state
        // flag for whether to weight each instrument pack's usage
        // by songs created since its release date
        // default to true
        var weightByDateAdded = true;

        // override the index container
        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);

        // create a table to contain the histogram
        var table = document.createElement("table");
        table.className = "statTable";
        this.indexContainer.appendChild(table);

        // loop over the packs
        for (var p = 0 ; p < packs.length; p++) {
            // skip concept packs
            if (packs[p].concept) continue;

            // keep track of pack index and the number of packs
            packToIndex[packs[p].name] = numPacks;
            numPacks++;

            // create a new part map and save it to the pack map
            var pm = partMap();
            statMap[packs[p].name] = pm;

            // build a row
            var tr = document.createElement("tr");
            tr.className = "statRow";
            table.appendChild(tr);

            // first cell is the label
            var nameTd = document.createElement("td");
            nameTd.className = "statLabel";
            nameTd.innerHTML = `<strong>${packs[p].displayName}</strong>`;
            tr.appendChild(nameTd);

            // second cell contains the histogram
            var statTd = document.createElement("td");
            statTd.className = "statCell";
            tr.appendChild(statTd);

            // loop over the parts
            for (var b = 0 ; b < partList.length; b++) {
                // create a basic div to be the histogram bar
                var statBar = document.createElement("div");
                statBar.className = "statBar quicktooltip";
                // set the color based on the part
                statBar.style.backgroundColor = sectionMetaData[partList[b]].color;
                // starting sizing
                statBar.style.width = "0%";
                statBar.style.height = "0.45em";
                statTd.appendChild(statBar);

                // create a tooltip for the bar
                var statBarTooltip = document.createElement("div");
                statBarTooltip.className = "quicktooltiptext";
                // no contents yet
                statBarTooltip.innerHTML = "";
                statBar.appendChild(statBarTooltip);

                // save reference to the stat bar and tooltip
                pm[partList[b]].statBar = statBar;
                pm[partList[b]].statBarTooltip = statBarTooltip;
            }
        }

        // combo list container
        var topComboContainer = document.createElement("div");
        this.indexContainer.appendChild(topComboContainer);

        // combo list label
        var topComboLabel = document.createElement("p");
        topComboContainer.appendChild(topComboLabel);
        topComboLabel.innerHTML = `<strong>Top ${maxTopCombos} Combinations</strong>`;

        // combo list itself is a table
        var topComboTable = document.createElement("table");
        topComboContainer.appendChild(topComboTable);

        // initialize combo grid: 3-dimensional array of all
        // possible combinations of instrument packs
        for (var p = 0 ; p < numPacks; p++) {
            var comboGrid2 = Array();
            for (var b = 0 ; b < numPacks; b++) {
                var comboGrid3 = Array();
                for (var m = 0 ; m < numPacks; m++) {
                    // each element is a dict with blank values
                    // packs will get filled in when it's populated for the first time
                    comboGrid3.push({"packs": null, "count": 0});
                }
                comboGrid2.push(comboGrid3);
            }
            comboGrid.push(comboGrid2);
        }

        // increase a specific stat
        function incrementStat(pack, part, amount) {
            // filter out concept instrument packs
            if (instrumentNameToPack[pack].concept) {
                return;
            }
            // console.log("incrementing: " + instrumentpack + "/" + part + " by " + amount);
            // get the pack's part map
            var partMap = statMap[pack];
            // increment the part's total
            partMap[part].value += amount;
            // increment the overall pack's total, divided by 3 so it still adds up the same
            partMap["all"].value += amount / 3;
        }

        function incrementCombo(packs, amount) {
            // make sure the packs appear in the combo grid, I guess this is to filter out concept packs?
            if (!(packToIndex[packs["perc"]] >= 0 && packToIndex[packs["bass"]] >= 0 && packToIndex[packs["perc"]] >= 0)) return;
            // get the combo grid element corresponding to the song's pack selections
            // criminy that's a lot of square brackets
            var stat = comboGrid[packToIndex[packs["perc"]]][packToIndex[packs["bass"]]][packToIndex[packs["mel"]]];
            // update the combo grid stat
            stat.count += amount;
            if (!stat.packs) stat.packs = packs;

            // find the stat in the combo list, using object identity equality
            var index = topCombos.indexOf(stat);
            // if the stat is not in the combo list but the combo list is either not
            // at its maximum size, or the lowest element in the combo list is less than this stat,
            // then add it to the list and update the index
            if (index < 0 && (topCombos.length < maxTopCombos || topCombos[topCombos.length - 1].count < stat.count)) {
                index = topCombos.length;
                topCombos.push(stat);
            }
            // if the stat is in the combo list
            if (index >= 0) {
                // while the stat is out of order with the next highest combo, move the
                // stat up one place
                while (index > 0 && topCombos[index - 1].count < stat.count) {
                    topCombos[index] = topCombos[index - 1];
                    index -= 1;
                    topCombos[index] = stat;
                }
            }
            // drop the lowest combo, if necessary
            while (topCombos.length > maxTopCombos) {
                topCombos.pop();
            }
        }

        // update the song count by date map
        function incrementSongCountsByDate(releaseDate) {
            for (var date in songCountsByDate) {
                // update each element of the map that is on or later than the given release date
                if (releaseDate >= date) {
                    songCountsByDate[date] += 1;
                }
            }
        }

        // update the UI
        function renderStats() {
            // absolute total entries is the song count from the earliest instrument pack release date
            var totalEntries = songCountsByDate[startDate];
            // update the UI with the total song count
            visibleCountElement.innerHTML = totalEntries.toFixed(0);

            // update a specific pack's part map
            function updatePack(pack, pm, scale=0) {
                var maxPercentage = 0;
                // loop over the parts
                for (var p = 0; p < partList.length; p++) {
                    // get the part name and pull out the statistic structure
                    var part = partList[p];
                    var count = pm[part].value;
                    // if the part has a UI (todo: this is always true now?)
                    if (pm[part].statBar) {
                        // check against the part filter if there is one
                        if ((showPart == null && part != "all") || showPart == part) {
                            // calculate the percentage based on the total for this part
                            // use the release date song count if the flag is set
                            var percentage = (100 * (count / songCountsByDate[weightByDateAdded ? instrumentNameToPack[pack].releaseDate : startDate]));
                            // track the max percentage
                            if (percentage > maxPercentage) {
                                maxPercentage = percentage;
                            }
                            // if there's a scale, then go on to actually update the UI
                            if (scale > 0) {
                                // make sure the bar is displayed
                                pm[part].statBar.style.display = "block";
                                // scale the percentage so the max stat ends up at 100%, and set that as
                                // the element width
                                pm[part].statBar.style.width = (percentage * scale) + "%";
                                // make it thinner or wider depending on whether there is a part filter present
                                pm[part].statBar.style.height = showPart == null ? "0.45em" : "1.35em";
                                // update the tooltip with the percentage and raw value
                                var text =`${percentage.toFixed(2)}%`;
                                // add a blurb about the release date if the flag is set
                                if (weightByDateAdded && instrumentNameToPack[pack].releaseDate != startDate) {
                                    text += ` since ${instrumentNameToPack[pack].releaseDate}`;
                                }
                                // raw value
                                text += ` (${count.toFixed(2)})`
                                pm[part].statBarTooltip.innerHTML = text;
                            }

                        } else if (scale > 0) {
                            // this part is filtered out, hide it
                            pm[part].statBar.style.display = "none";
                        }
                    }
                }
                // return the max calculated percentage
                return maxPercentage;
            }

            // run the update for all packs, actually updating the UI if scale != 0
            function updatePacks(scale=0) {
                // keep track of the max percentage across all instrument packs
                var maxPercentage2 = 0;
                // loop over packs
                for (var k = 0 ; k < packs.length; k++) {
                    // skip concept... again
                    if (packs[k].concept) {
                        continue;
                    }
                    // get the pack name and lookup the part map
                    var pack = packs[k].name;
                    var partMap = statMap[pack];
                    // get the pack's max percentage or update its UI
                    var percentage = updatePack(pack, partMap, scale);
                    // update the max
                    if (percentage > maxPercentage2) {
                        maxPercentage2 = percentage;
                    }
                }
                // return the max
                return maxPercentage2;
            }

            // do a dry run updating all packs to determine the max percentage
            var maxP = updatePacks(0);
            // update the packs for real, using the max percentage as the scale
            updatePacks(100.0 / maxP);

            // gotta make a ton of <td> elements
            function makeTd(contents) {
                var td = document.createElement("td");
                td.innerHTML = contents;
                return td;
            }
            // easy way, just clear the top combos and create them anew
            topComboTable.innerHTML = "";
            // loop over the top combos
            for (var i = 0; i < topCombos.length; i++) {
                var combo = topCombos[i];
                // crap out a table row
                var tr = document.createElement("tr");
                topComboTable.appendChild(tr);
                // column 1: index
                tr.appendChild(makeTd(i + 1));
                // column 2: raw count
                tr.appendChild(makeTd(combo.count.toFixed(2)));
                // column 3: percentage
                tr.appendChild(makeTd( "(" + ((100 * combo.count / totalEntries).toFixed(2)) + "%)"));
                // column 4-6: pack names
                tr.appendChild(makeTd(instrumentNameToPack[combo.packs["perc"]] .displayName));
                tr.appendChild(makeTd(instrumentNameToPack[combo.packs["bass"]].displayName));
                tr.appendChild(makeTd(instrumentNameToPack[combo.packs["mel"]].displayName));
            }

        }

        // handler for the part buttons
        function setShowPart(part) {
            // set the part filter depending on whether the "all" button was selected
            showPart = (part == "all") ? null : part == "overall" ? "all" : part;

            // update the buttons, raising up the currently active one and lowering the others
            for (var r = 0; r < tabList.length; r++) {
                // get the button for this part
                var partName = tabList[r];
                var button = document.getElementById(`select${partName}Tab`);
                // set the style based on the current filter
                if (part == partName) {
                    button.classList.add("imgButtonRaised");
                    button.classList.remove("imgButton");
                } else {
                    button.classList.add("imgButton");
                    button.classList.remove("imgButtonRaised");
                }
            }

            // re-render the stats
            renderStats();
        }

        // set up the handlers for the part buttons
        for (var i = 0; i < tabList.length; i++) {
            // get the part name and button container
            var partName = tabList[i];
            var partButton = getFirstChild(this.menuContainer, `select${partName}`);
            // save the part name as a property
            partButton.partName = partName;
            // add handler
            partButton.addEventListener("click", (e) => {
                setShowPart(e.currentTarget.partName);
            });
        }

        // stats menu popup handler
        getFirstChild(this.menuContainer, "menuButton").addEventListener("click", (e) => {
            clearMenus();
            showStatsMenu(e);
        });

        function showStatsMenu(e) {
            // place the menu under the burger button
            var button = e.currentTarget;
            // top level container
            var div = document.createElement("div");
            div.className = "menu";
            div.button = button;

            // build the menu buttons the easy way
            var html = `
                <div class="button flagPerfectButton tooltip">
                    <input type="checkbox" class="checkboxFlagWeight"/>
                    Weight instrument packs by release date
                    <span class="tooltiptextbottom">Calculate percentages based on how many songs date from after the instrument pack was released.</span>
                </div>
            `;

            div.innerHTML = html;

            // setup tag filter checkboxes
            var checkboxFlagWeight = getFirstChild(div, "checkboxFlagWeight");
            checkboxFlagWeight.checked = weightByDateAdded;
            checkboxFlagWeight.addEventListener("change", (e) => {
                weightByDateAdded = e.currentTarget.checked;
                renderStats();
            });

            // put the menu in the clicked button's parent and anchor it to button
            showMenu(div, getParent(button, "scoreButtonRow"), button);
        }


        // finally ready to kick off the statistics collection
        // re-use the current search functionality, make sure that
        // omitHidden = true so it only searches the currently visible entries
        this.startFuncSearch(true, true, (song, songList, index, total) => {
            if (!song.date) {
                // If the song doesn't have a release date then skip it.  this is a demo song
                return;
            }
            // search handler for a single song entry
            // loop over the songs in the list
            var numSongs = songList.length;
            for (var i = 0; i < numSongs; i++) {
                // parse to a song object
                var songObject = new Song();
                songObject.parseChatLink(songList[i]);
                // increment statistics for each instrument pack part used
                for (var part in songObject.packs) {
                    // if a song entry has multiple songs, then weight each instrument pack part
                    // so the totals still add up to 1
                    incrementStat(songObject.packs[part], part, (1.0/numSongs));
                }
                // update top combo tracking
                incrementCombo(songObject.packs, (1.0/numSongs))
            }
            // update song counts by instrument pack release date map
            incrementSongCountsByDate(song.date);
        }, renderStats);

        // initialize the selected part to "all"
        setShowPart("all");
    }

    showDateStats() {
        var thiz = this;
        // build extra button UI
        var extraButtonHtml = "";
        
        var grainList = ["Years", "Months", "Weeks"];

        for (var i = 0; i < grainList.length; i++) {
            // get the part name and metadata
            var grain = grainList[i];
            // build the grain button
            extraButtonHtml += `
            <span class="imgButton tooltip select${grain}" id="select${grain}Tab">
                ${grain}
                <span class="tooltiptextbottom">Show song ${grain}</span>
            </span>`;
        }

        // might as well throw in the song count
        extraButtonHtml += `
            <span class="titleButton visibleSongCount">0</span>
        `;

        // replace the library UI with the statistics UI
        this.replaceUI(extraButtonHtml, () => {
            // when the stats close button is called, revert to the library UI
            this.endReplaceUI();
            this.searchLoader = null;
        });

        // get the count element
        var visibleCountElement = getFirstChild(this.menuContainer, "visibleSongCount");

        // state variables
        var songCountsByDate, startDate, endDate, totalCount, maxCount;

        // reset function, we need to be able to re-run this
        function reset() {
            table.innerHTML = "";
            songCountsByDate = {};
            startDate = null;
            endDate = null;
            totalCount = 0;
            maxCount = 0;
        }

        function truncateDateStringYear(dateString) {
            // easy
            return dateString.substring(0, 4);
        }

        function offsetDateStringYear(dateString, amount) {
            // pretty easy
            return (parseInt(dateString) + amount).toString();
        }

        function truncateDateStringMonth(dateString) {
            // easy
            return dateString.substring(0, 7);
        }

        function offsetDateStringMonth(dateString, amount) {
            // not as easy
            var year = parseInt(dateString.substring(0, 4));
            var month = parseInt(dateString.substring(5, 7)) + amount;
            while (month > 12) {
                year += 1;
                month -= 12;
            }
            while (month < 1) {
                year -= 1;
                month += 12;
            }
            return year + "-" + month.toString().padStart(2, "0");
        }

        function fullDateToString(date) {
            // dealing with the javascript Date object is an exercise in pain tolerance
            return `${date.getYear() + 1900}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
        }

        function fullStringToDate(dateString) {
            // dealing with the javascript Date object is an exercise in pain tolerance
            var year = parseInt(dateString.substring(0, 4));
            var month = parseInt(dateString.substring(5, 7)) - 1;
            var day = parseInt(dateString.substring(8, 10));
            return new Date(year, month, day);
        }
        
        function offsetDateByDays(date1, days) {
            // abusing the Date object to take an out-of-bounds day of the month value and convert to the correct date.
            // ffs, getYear() is relative to 1900, but the Date() constructor takes the absolute year
            return new Date(date1.getYear() + 1900, date1.getMonth(), date1.getDate() + days);
        }

        function truncateDateStringWeek(dateString) {
            var date1 = fullStringToDate(dateString);
            // subtract the day of the week to get the previous Sunday, or the same day if it is a Sunday
            var sunday = offsetDateByDays(date1, -date1.getDay());
            return fullDateToString(sunday);
        }

        function offsetDateStringWeek(dateString, amount) {
            var date1 = fullStringToDate(dateString);
            // add the given amount of weeks to the date
            var otherWeek = offsetDateByDays(date1, amount * 7);
            return fullDateToString(otherWeek);
        }

        // put the grain-related functions into a convenient map
        var grainFunctions = {
            "Years": {
                "truncate": truncateDateStringYear,
                "offset": offsetDateStringYear
            },
            "Months": {
                "truncate": truncateDateStringMonth,
                "offset": offsetDateStringMonth
            },
            "Weeks": {
                "truncate": truncateDateStringWeek,
                "offset": offsetDateStringWeek
            }
        };

        // override the index container
        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);

        // create a table to contain the histogram
        var table = document.createElement("table");
        table.className = "statTable";
        this.indexContainer.appendChild(table);

        // create a date row
        function createDate(date, prepend = false) {
            // build a row
            var tr = document.createElement("tr");
            tr.className = "statRow";
            if (prepend) {
                table.insertBefore(tr, table.children[0]);
            } else {
                table.appendChild(tr);
            }

            // first cell is the label
            var nameTd = document.createElement("td");
            nameTd.className = "statLabel";
            nameTd.innerHTML = `<strong>${date}</strong>`;
            tr.appendChild(nameTd);

            // second cell contains the histogram
            var statTd = document.createElement("td");
            statTd.className = "statCell";
            tr.appendChild(statTd);

            // create a basic div to be the histogram bar
            var statBar = document.createElement("div");
            statBar.className = "statBar quicktooltip";
            // set the color based on the part
            statBar.style.backgroundColor = sectionMetaData["all"].color;
            // starting sizing
            statBar.display = "block";
            statBar.style.width = "0%";
            statBar.style.height = "1.35em";
            statTd.appendChild(statBar);

            // create a tooltip for the bar
            var statBarTooltip = document.createElement("div");
            statBarTooltip.className = "quicktooltiptext";
            // no contents yet
            statBarTooltip.innerHTML = "";
            statBar.appendChild(statBarTooltip);

            // save reference to the stat bar and count
            var dateStat = {"count": 0, "statBar": statBar, "statBarTooltip": statBarTooltip};
            songCountsByDate[date] = dateStat;
            return dateStat;
        }

        // get a count object for the given date
        function getDateCount(date, truncateFunction, offsetFunction) {
            // convert to date identifier
            var dateString = truncateFunction(date);
            // quick lookup
            if (songCountsByDate[dateString]) {
                // found it
                return songCountsByDate[dateString];
            }
            // if we have no date entries, start with this one
            if (startDate == null) {
                startDate = dateString;
                endDate = dateString;
                return createDate(dateString);
            }
            // if the date is before our current range expand the range earlier until reaching it
            while (startDate > dateString) {
                startDate = offsetFunction(startDate, -1);
                var added = createDate(startDate, true);
                if (startDate == dateString) {
                    return added;
                }
            }
            // if the date is after our current range expand the range later until reaching it
            while (endDate < dateString) {
                endDate = offsetFunction(endDate, 1);
                var added = createDate(endDate, false);
                if (endDate == dateString) {
                    return added;
                }
            }
            // shrugs
            throw "oh no";
        }

        // actual stat collecting function
        function incrementDate(date, truncateFunction, offsetFunction) {
            // get the entry for the given date
            var dateEntry = getDateCount(date, truncateFunction, offsetFunction);
            // update the entry count, total count, and max count
            dateEntry.count += 1;
            totalCount += 1;
            if (dateEntry.count > maxCount) maxCount = dateEntry.count;
        }

        // update the UI
        function renderStats() {
            // update the UI with the total song count
            visibleCountElement.innerHTML = totalCount;

            // update a specific date's amount
            function updateDate(entry, scale) {
                var percentage = (100 * (entry.count / (1.0 * maxCount)));
                // scale the percentage so the max stat ends up at 100%, and set that as
                // the element width
                entry.statBar.style.width = percentage + "%";
                // update the tooltip with the percentage and raw value
                // raw value
                var text = `${entry.count}`;
                entry.statBarTooltip.innerHTML = text;
            }

            // just go through and update all the date entries
            for (var dateString in songCountsByDate) {
                updateDate(songCountsByDate[dateString]);
            }
        }

        // run the collection process
        function runStats(truncateFunction, offsetFunction) {
            // clear the UI and state so we can start again
            reset();
            // re-use the current search functionality, make sure that
            // omitHidden = true so it only searches the currently visible entries
            thiz.startFuncSearch(false, true, (song, songList, index, total) => {
                if (!song.date) {
                    // If the song doesn't have a release date then skip it.  this is a demo song
                    return;
                }
                // search handler for a single song entry
                incrementDate(song.date, truncateFunction, offsetFunction);
            }, renderStats);
        }

        // handler for the grain buttons
        function setShowGrain(grain) {
            // update the buttons, raising up the currently active one and lowering the others
            for (var r = 0; r < grainList.length; r++) {
                // get the button for this grain
                var grainName = grainList[r];
                var button = document.getElementById(`select${grainName}Tab`);
                // set the style based on the current filter
                if (grain == grainName) {
                    button.classList.add("imgButtonRaised");
                    button.classList.remove("imgButton");
                } else {
                    button.classList.add("imgButton");
                    button.classList.remove("imgButtonRaised");
                }
            }

            // re-run the stats
            runStats(grainFunctions[grain]["truncate"], grainFunctions[grain]["offset"]);
        }

        // set up the handlers for the grain buttons
        for (var i = 0; i < grainList.length; i++) {
            // get the grain name and button container
            var grainName = grainList[i];
            var grainButton = getFirstChild(this.menuContainer, `select${grainName}`);
            // save the grain name as a property
            grainButton.grainName = grainName;
            // add handler
            grainButton.addEventListener("click", (e) => {
                setShowGrain(e.currentTarget.grainName);
            });
        }

        // start off with years
        setShowGrain("Years");
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