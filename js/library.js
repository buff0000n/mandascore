function setLibrarySearch() {
    var event = window.event;
    var string = event.currentTarget.value;
    score.library.setSearchString(string);
}

class Library {
    constructor(score) {
        // back reference to the score
        this.score = score;
        this.index = null;
        this.database = {};
        this.loader = new Loader();
        // build the UI
        this.buildUI();
    }

    buildUI() {
        // this will expand vertically with the library
        // todo: figure out a good cross-browser way to add a scrollbar
        this.libraryBox = document.createElement("div");
        this.libraryBox.className = "libraryBox";
        this.libraryBox.id = "libraryBox";
        // back reference because why not
        this.libraryBox.library = this;

        this.libraryContainer = this.libraryBox;

        this.loaderContainer = document.createElement("div");
        this.loaderContainer.className = "loaderContainer";
        this.loaderContainer.appendChild(this.loader.loadingBox);
        this.libraryContainer.appendChild(this.loaderContainer);

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

        this.indexContainer = document.createElement("div");
        this.indexContainer.className = "indexContainer";
        this.libraryContainer.appendChild(this.indexContainer);

//        var container = document.getElementById("libraryArea");
//        container.appendChild(this.libraryBox);
    }

    init() {
        if (this.index == null) {
            this.loader.load("Loading Index", "db/index.json", (indexJson) => this.indexLoaded(indexJson));
        }
    }

    indexLoaded(indexJson) {
        this.index = JSON.parse(indexJson);
        this.indexContainer.innerHTML = "";

        this.buildTree(this.indexContainer, this.index, null, []);
    }

    buildCatDiv(categoryName) {
        var catDiv = document.createElement("div");
        catDiv.className = "libCat";
        catDiv.innerHTML = `<span class="libCatLabel">` + categoryName + `</span>`;
        this.initVisibleChildren(catDiv);
        return catDiv;
    }

    buildIndentDiv() {
        var indentDiv = document.createElement("div");
        indentDiv.className = "libIndent";
        this.initVisibleChildren(indentDiv);
        return indentDiv;
    }

    buildSongDiv(songEntry, dbName) {
    songEntry.dbName = dbName;
        var songDiv = document.createElement("div");
        songDiv.className = "libSong";
        var label = "<strong>" + songEntry.name + "</strong>";
        if (songEntry.attr) {
            label = label + " (" + songEntry.attr.join(", ") + ")";
        }
        var songLabelSpan = document.createElement("span");
        songLabelSpan.className = "libSongLabel";
        songLabelSpan.innerHTML = label;
        songLabelSpan.onclick = (event) => this.songClick(event)
        songLabelSpan.songEntry = songEntry;
        songDiv.appendChild(songLabelSpan);
        return songDiv;
    }

    buildTree(parent, map, dbName, cats) {
        var dbName2 = dbName;
        if (map.dbName) {
            dbName2 = map.dbName;
        }
        if (map.songs) {
            for (var songKey in map.songs) {
                var song = map.songs[songKey];
                var songDiv = this.buildSongDiv(song, dbName2);
                parent.appendChild(songDiv);
                this.incrementVisibleChildren(parent);
                song.div = songDiv;
                this.indexSong(song, cats);
            }
        } else {
            for (var cat in map) {
                // have to add to the DOM before adding songs
                var catDiv = this.buildCatDiv(cat);
                parent.appendChild(catDiv);
                var subDiv = this.buildIndentDiv();
                catDiv.appendChild(subDiv);
                cats.push(cat);
                this.buildTree(subDiv, map[cat], dbName2, cats);
                cats.pop();
            }
        }
    }


    initVisibleChildren(parent) {
        parent.visibleChildren = 0;
    }

    incrementVisibleChildren(parent) {
        if (parent && parent.visibleChildren != null) {
            var count = parent.visibleChildren + 1;
            parent.visibleChildren = count;
            if (count == 1) {
                parent.style.display = "block";
                this.incrementVisibleChildren(parent.parentElement);
            }
        }
    }

    decrementVisibleChildren(parent) {
        if (parent && parent.visibleChildren != null) {
            var count = parent.visibleChildren - 1;
            parent.visibleChildren = count;
            if (count == 0) {
                parent.style.display = "none";
                this.decrementVisibleChildren(parent.parentElement);
            }
            if (count < 0) {
                console.log("OH NOE!!!");
            }
        }
    }

    indexSong(song, cats) {
        // todo: better
        song.keywords = (cats.join(" ") + " " +
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
        // no long enough keywords, show everything
        if (words.length == 0) {
            this.searchSongs(this.index, null, true);
        } else {
            this.searchSongs(this.index, words, false);
        }
    }

    searchKeywords(keywords, words) {
        for (var i = 0; i < words.length; i++) {
            if (keywords.indexOf(words[i]) < 0) {
                return false;
            }
        }
        return true;
    }

    searchSongs(map, words) {
        if (map.songs) {
            for (var songKey in map.songs) {
                var song = map.songs[songKey];
                if (!words || this.searchKeywords(song.keywords, words)) {
                    this.showSong(song);
                } else {
                    this.hideSong(song);
                }
            }
        } else {
            for (var key in map) {
                this.searchSongs(map[key], words);
            }
        }
    }

    showSong(song) {
        if (song.div.style.display == "none") {
            song.div.style.display = "block";
            this.incrementVisibleChildren(song.div.parentElement);
        }
    }

    hideSong(song) {
        if (!song.div.style.display || song.div.style.display == "block") {
            song.div.style.display = "none";
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
            func(this.database[dbName]);
        } else {
            this.loader.load("Loading " + dbName, "db/" + dbName + ".json", (indexJson) => this.dbLoaded(dbName, indexJson, func));
        }
    }

    dbLoaded(dbName, dbJson, callback) {
        var db = JSON.parse(dbJson);
        this.database[dbName] = db;
        callback(this.database[dbName]);
    }
}

class Loader {
    constructor() {
        this.request = null;
        this.buildUI();
    }

    buildUI() {
        this.loadingBox = document.createElement("div");
        this.loadingBox.className = "loadingBox";
        this.loadingBox.id = "loadingBox";

        this.labelBar = document.createElement("div");
        this.labelBar.className = "loadingLabel";
        this.loadingBox.appendChild(this.labelBar);
        
        this.progressBar = document.createElement("div");
        this.progressBar.className = "loadingProgress";
        this.loadingBox.appendChild(this.progressBar);

        this.progressBarPos = document.createElement("div");
        this.progressBarPos.className = "loadingProgressPos";
        this.progressBarPos.innerHTML = "&nbsp;";
        this.progressBar.appendChild(this.progressBarPos);

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
        this.progressBarPos.style.width = Math.round(amount * 100) + "%";
        this.progressBarNeg.style.width = Math.round((1-amount) * 100) + "%";
    }

    load(label, path, callback) {
        if (this.request != null) {
            this.request.abort();
            this.request = null;
        }
        this.labelBar.innerHTML = label;
        this.setProgress(0);
        this.show();

        this.request = new XMLHttpRequest();
        this.request.callback = callback;
        this.request.loader = this;

        this.request.addEventListener("progress", (event) => this.updateProgress(event));
        this.request.addEventListener("load", (event) => this.transferComplete(event));
        this.request.addEventListener("error", (event) => this.transferFailed(event));
        this.request.addEventListener("abort", (event) => this.transferCanceled(event));

        this.request.open("GET", path);
        this.request.send();
    }

    updateProgress(event) {
        if (event.lengthComputable) {
            var completeAmount = event.loaded / event.total;
            this.setProgress(completeAmount);
        }
    }

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
        this.hide();
        var response = event.currentTarget.responseText;
        var callback = event.currentTarget.callback;
        this.request = null;
        callback(response);
    }

    transferFailed(event) {
        this.hide();
        console.log("Transfer failed");
    }

    transferCanceled(event) {
        this.hide();
        console.log("Transfer canceled");
    }

}