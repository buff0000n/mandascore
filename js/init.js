
//==============================================================
// UI Builders
//==============================================================

function buildUI() {
    // the song UI goes inside the scoreArea div
    buildScore(document.getElementById("scoreArea"));
}

//==============================================================
// Song Code updating
//==============================================================

// song code update state
var songCodeUpdateDelay = 1000;
var songCodeUpdateTimeout = null;
var updatedSongCode = null;

function updateSongCode() {
    // clear the old timeout if there is one
    if (songCodeUpdateTimeout) {
        clearTimeout(songCodeUpdateTimeout);
    }

    // set a timeout to update the code.  We don't want to do it with every single click.
    songCodeUpdateTimeout = setTimeout(() => { actuallyUpdateSongCode() }, songCodeUpdateDelay);
}

function actuallyUpdateSongCode() {
    // extract a song code from the UI
    updatedSongCode = getSongCode();
    // fill in the song code input box
    document.getElementById("songCode").value = updatedSongCode;

    // update the URL depending on whether the playlist is open or not
    if (playlistVisible() && score.playlist.entries.length > 0) {
        modifyUrlQueryParam("playlist", encodePlaylistToUrl(getPlaylistCode()));
        removeUrlQueryParam("song");

    } else {
        modifyUrlQueryParam("song", urlEncodeString(updatedSongCode, false));
        removeUrlQueryParam("playlist");
    }

    // clear state
    songCodeUpdateTimeout = null;
}

function getSongCode() {
    return score.getSong();
}

function getPlaylistCode() {
    return score.playlist.export();
}

songcodePrefixStrip = /^song[0-9]+=/;

function songCodeUpdated() {
    // pull the song code from the input box
    var input = document.getElementById("songCode");
    songCode = input.value.trim();
    songCode = songCode.replace(songcodePrefixStrip, "");
    // check if it's non-empty and changed
    if (songCode != null && songCode != "" && songCode != updatedSongCode) {
        // chrome is doing strange things with clicked buttons so just unfocus it
        input.blur();
        // load the song into the UI
        updateSong(songCode);
    }
}

function songCodeClicked() {
    // automatically select the whole song code if the input box is clicked
    var input = document.getElementById("songCode");
    input.select();
}

function setSongCode(songCode, disableUndo=false) {
    // set the song code explicitly, from the URL or the library
    if (songCode !== null && songCode.length > 0) {
        // set the song code box
        var input = document.getElementById("songCode");
        input.value = updatedSongCode;
        // chrome is doing strange things with clicked buttons so just unfocus it
        input.blur();
        // load the song into the UI
        updateSong(songCode, disableUndo);
    }
}

function updateSong(songCode, disableUndo=false) {
    try {
        // load the song into the UI and reset the playback
        score.setSong(songCode, !disableUndo, true);
        // success
        clearErrors();

    } catch (error) {
        // fail
        showErrors([error]);
        throw error;
    }
}

//==============================================================
// Model-View control
//==============================================================

var showHelpUrlString = "&h=yes";

function initModel() {
    // javascript is working
    clearErrors();

    // set up the error listener
    window.onerror = windowOnError;
    // window.onerror = (e) => { windowOnError(e + "\n" + e.stack); };
    // get the window size for menu placement
    doonresize();

    // load the URL
    var url = window.location.href;

//    // show the help section if the query prop is set
//    if (getQueryParam(url, "h")) {
//        about();
//    }

    // init the UI
    buildUI();

    // load the model from the URL, if present
    reinitModel(url);
}

function reinitModel(url) {
    // on page load, see if there's a "song=..." query string
    var songCode = getQueryParam(url, "song", false);
    if (songCode) {
        // if there is, then initialize our song
        setSongCode(decodeSongCodeFromUrl(songCode), true);
    } else {
        // check for a playlist
        var playlistString = getQueryParam(url, "playlist", false);
        if (playlistString) {
            setPlaylistFromUrlString(playlistString);
        }
    }
    // check for a search=... query string
    var librarySearch = getQueryParam(url, "search", false);
    if (librarySearch) {
        // show the library and auto-start a search
        toggleLibrary();
        score.library.setLibrarySearch(librarySearch);

    }
}

function setPlaylistFromUrlString(playlistString, enable=true) {
    setPlaylistCode(decodePlaylistFromUrl(playlistString), enable);
}

function decodeSongCodeFromUrl(urlString) {
    var code = urlDecodeString(urlString, false);
    // Dammit, I'm doing everything right but YouTube's link system is still replacing '%20's with '+'s.
    // We can't consider '+' to always be a space because it can appear in the base64 sction.
    // Just convert '+'s in the title section to spaces.
    // As of November 2020 this messes up exactly one song in my catalog.
    for (;;) {
        // only way I can think of doing this is in a loop
        var code2 = code.replace(/^([^:]+)\+/, "$1 ");
        if (code2 == code) break;
        code = code2;
    }
    return code;
}

function decodePlaylistFromUrl(playlist) {
    // gunzip the playlist string
    return LZString.decompressFromEncodedURIComponent(playlist);
}

function encodePlaylistToUrl(playlistCode) {
    // gzip the playlist string
    return LZString.compressToEncodedURIComponent(playlistCode);
}

function setPlaylistCode(playlistCode, enable=true) {
    showPlaylist(enable);
    score.playlist.setLooping(true);
    score.playlist.import(playlistCode, false);
}

function copyModelUrl() {
    // build a model from the UI
    var songCode = getSongCode();

    var query = "?song=" + urlEncodeString(songCode, false);

    // build a full URL using the current URL
    var url = buildQueryUrl(query);

    // find the pop-up URL text field and set its contents
    var textField = document.getElementById("urlHolder");
    textField.value = url;
    // show the popup
    var popup = document.getElementById("popupBox");
    popup.classList.toggle("show");
    // focus and select the contents of the text field
    textField.focus();
    textField.select();
}

function copyPlaylistUrl() {
    // build a playlist from the UI
    var playlistCode = getPlaylistCode();

    var query = "?playlist=" + encodePlaylistToUrl(playlistCode)

    // build a full URL using the current URL
    var url = buildQueryUrl(query);

    // find the pop-up URL text field and set its contents
    var textField = document.getElementById("playlistUrlHolder");
    textField.value = url;
    // show the popup
    var popup = document.getElementById("playlistPopupBox");
    popup.classList.toggle("show");
    // focus and select the contents of the text field
    textField.focus();
    textField.select();
}

function hideUrlPopup() {
    // hide the popup when the text field loses focus
    var popup = document.getElementById("popupBox");
    popup.classList.remove("show");
    // todo: the onBlur() event fails to get called sometimes in Chrome

    var popup2 = document.getElementById("playlistPopupBox");
    if (popup2) {
        popup2.classList.remove("show");
    }
}

function generatePng(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // show the PNG menu and generate an image
    runPngMenu(button);
}

function generateWav(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    // show the PNG menu and generate an image
    runWavMenu(button);
}

function playlistEnabled() {
    return !document.getElementById("playlistButton").classList.contains("gray");
}

function playlistVisible() {
    var display = document.getElementById("playlistBox").style.display
    return display && display != "";
}

function togglePlaylist(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();

    if (!playlistVisible() || !playlistEnabled()) {
        showPlaylist(true);

    } else {
        hidePlaylist();
    }
}

function showPlaylist(enabled=true) {
    var playlistBox = document.getElementById("playlistBox");
    playlistBox.style.display = "inline-block";
    score.playlist.setLooping(true);
    if (enabled) {
        document.getElementById("playlistButton").classList.remove("gray");
    }
}

function hidePlaylist() {
    document.getElementById("playlistBox").style.display = "";
    score.playlist.setLooping(false);
    document.getElementById("playlistButton").classList.add("gray");
}

function toggleLibrary(button = null) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    if (button) button.blur();
    var libraryBox = document.getElementById("libraryBox");
    if (!libraryBox || libraryBox.style.display == "") {
        libraryBox = document.getElementById("libraryBox");
        libraryBox.style.display = "inline-block";
        document.getElementById("libraryButton").classList.remove("gray");
        score.library.init();
    } else {
        libraryBox.style.display = "";
        document.getElementById("libraryButton").classList.add("gray");
    }
}

function toggleMixer(button) {
    // chrome is doing strange things with clicked buttons so just unfocus it
    button.blur();
    var mixerBox = document.getElementById("mixerBox");
    if (!mixerBox || mixerBox.style.display == "") {
        showMixer();
    } else {
        hideMixer();
    }
}

function showMixer() {
    mixerBox = document.getElementById("mixerBox");
    mixerBox.style.display = "inline-block";
    document.getElementById("mixerButton").classList.remove("gray");
    score.mixer.init();
}

function hideMixer() {
    mixerBox.style.display = "";
    document.getElementById("mixerButton").classList.add("gray");
}

function about() {
    // chrome is weird with button focus now, make sure the about button is not in focus
    document.getElementById("about").blur();

    var container = document.getElementById("lotsOfWordsContainer")

    // check if it's hidden
    if (container.style.display === "none") {
        // cripes, doesn't seem to be any way to do this without math
        // calculate the height of enbedded help page by taking the screen height and subtracting
        // the height of bottom bar without the help page, also subtract an extra 25 for no obvious reason
        var embedHeight = window.innerHeight - document.getElementById("bottomBar").getBoundingClientRect().height - 25;
        // embed the help hage
        container.innerHTML = `<embed id="helpEmbed" src="help.html"/>`;
        // set the embed height so the entier bottom bar just fills the screen
        document.getElementById("helpEmbed").style.height = embedHeight + "px";
        // unhide it
        container.style.display = "block";
        // scroll to it
        document.scrollingElement.scrollTo(0, document.scrollingElement.scrollTop + document.getElementById("bottomBar").getBoundingClientRect().top);

    // otherwise, it's not hidden
    } else {
        // hide it
        container.style.display = "none";
        // remove the help page
        container.innerHTML = ``;
    }

//    if (container.style.display === "none") {
//        container.style.display = "block";
//
//        // perform some history shenanigans to make sure that if you display Help, click a link, and then go back,
//        // then Help is still displayed and you don't lose your place.
//        var href = window.location.href;
//
//        if (href.indexOf(showHelpUrlString) < 0) {
//            if (href.indexOf("?") < 0) {
//                href += "?";
//            }
//            href += showHelpUrlString;
//            history.replaceState( {} , document.title, href );
//        }
//
//    } else {
//        container.style.display = "none";
//        var href = window.location.href;
//        var index = href.indexOf(showHelpUrlString)
//        if (index >= 0) {
//            href = href.substring(0, index) + href.substring(index + showHelpUrlString.length);
//            history.replaceState( {} , document.title, href );
//        }
//    }
}
