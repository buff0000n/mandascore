//==============================================================
// Utility DOM functions
// probably doing some of these the hard way but nothing else
// was reliable enough
// Most UI elements are identified by class instead of ID
// because they're added dynamically and there can be more than
// one of them in the DOM
//==============================================================

function getParent(node, parentClass) {
    // walk up the DOM until we find a parent with the given class name or run out of parents
    while (node != null && (!node.className || !node.className.includes(parentClass))) {
        node = node.parentNode;
    }
    return node;
}

function getFirstChild(node, childClass) {
    // perform a depth first search from the first child to the last,
    // until we find an element with the given class name
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
        var child = node.children[i];
        if (child.classList.contains(childClass)) {
            return child;
        }
        // recursive call
        var child2 = getFirstChild(child, childClass);
        if (child2 !== null) {
            return child2;
        }
    }
    return null;
}

function getLastChild(node, childClass) {
    // perform a depth first search going from the last child to the first,
    // until we find an element with the given class name
    var children = node.children;
    // go over the children in reverse order
    for (var i = children.length - 1; i >= 0; i--) {
        var child = node.children[i];
        if (child.classList.contains(childClass)) {
            return child;
        }
        // recursive call
        var child2 = getLastChild(child, childClass);
        if (child2 !== null) {
            return child2;
        }
    }
    return null;
}

function getAllChildren(node, childClass) {
    // find all the children with the given class name
    return getAllChildren0(node, childClass, Array());
}

function getAllChildren0(node, childClass, list) {
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
        var child = node.children[i];
        if (child.classList.contains(childClass)) {
            list.push(child);
        }
        getAllChildren0(child, childClass, list);
    }
    return list;
}

function deleteNode(node) {
    // delete an element from its parent
    node.parentNode.removeChild(node);
}

// returns the index of the item was removed, or -1 if nothing was removed
function removeFromList(list, item) {
	var index = list.indexOf(item);
	if (index >= 0) {
		list.splice(index, 1);
		return index;

	} else {
		return -1;
	}
}

// returns true if the list was changed
function addToListIfNotPresent(list, item) {
	var index = list.indexOf(item);
	if (index == -1) {
		list.push(item);
		return true;

	} else {
		return false;
	}
}

function insertAfter(el, referenceNode) {
    referenceNode.parentNode.insertBefore(el, referenceNode.nextSibling);
}
function insertBefore(el, referenceNode) {
    referenceNode.parentNode.insertBefore(el, referenceNode);
}

function listEquals(a, b) {
    return a == null ? b == null :
        b == null ? false :
        a.length == b.length && a.every((val, index) => val == b[index]);
}

//==============================================================
// window size tracking
//==============================================================

var windowWidth;
var windowHeight;

function doonresize() {
    var h = Math.max(document.documentElement.clientHeight, window.innerHeight);
    var w = Math.max(document.documentElement.clientWidth, window.innerWidth);
    windowSizeChanged(h, w);
}

function windowSizeChanged(h, w) {
	windowHeight = h;
	windowWidth = w;
}

//==============================================================
// error display
//==============================================================

function showError(error) {
    showErrors([error]);
}

function showErrors(errors) {
    // find the error bar
    var errorBarElement = document.getElementById("errorBar");
    // build and error div with a line for each error in the list
    var html = `<div id="error">`;
    for (var error in errors) {
        html += `<div class="errorLine">${errors[error]}</div>`;
    }
    html += `</div>`;
    // show
    errorBarElement.innerHTML = html;
}

function clearErrors() {
    // find the error bar and clear it out
    var errorBarElement = document.getElementById("errorBar");
    errorBarElement.innerHTML = "";
}

function windowOnError(msg, url, lineNo, columnNo, error) {
    showErrors([msg.replace("Uncaught ", "")]);
    return false;
}

var debugCount = 0;

function showDebug(msg) {
    // find the error bar
    var debugBarElement = document.getElementById("debugBar");
    if (debugBarElement.children.length == 0) {
        debugBarElement.innerHTML = `<div id="debug">`;
    }
    var debugElement = document.getElementById("debug");

    var line = document.createElement("div");
    line.className = "debugLine";
    debugCount += 1;
    // why the hell is replaceAll() not working
    // line.innerHTML = debugCount + ": " + msg.replaceAll("\n", "<br/>");
    line.innerHTML = debugCount + ": " + msg;

    debugElement.appendChild(line);
    var kids = debugElement.children
    while (kids.length > 5) {
        kids.item(0).remove();
    }
}

//==============================================================
// PNG
//==============================================================

function convertToPngLink(canvas, name) {
    // builds a huuuuge URL with the base-64 encoded PNG data embedded inside it
    var src = canvas.toDataURL();
    // generate a file name
    var fileName = name + ".png";

    var a = document.createElement("a");
    a.download = fileName;
    a.href = src;
    a.innerHTML = fileName;
    a.onclick = doPngClick;
    return a;
}

function doPngClick(e) {
    var e = e || window.event;
    if (e.altKey) {
        // super-secret debug mode: alt-click on an image link to just show it instead of downloading it
        e.preventDefault();

	    var link = e.currentTarget;
	    var src = link.href;

	    var img = document.createElement("img");
	    img.src = link.href;
	    img.srcset = link.href + " 2x";;

	    var parent = link.parentNode;
	    parent.innerHTML = "";
	    parent.appendChild(img);
    }
}

function loadImages(paths, callback) {
    new imageLoader(paths, callback).load();
}

class imageLoader {
    constructor(pathMap, callback) {
        this.pathMap = pathMap;
        this.callback = callback;
        this.count = 0;
        this.imageMap = {};
    }

    load() {
        for (var key in this.pathMap) {
            this.count++;
            var img = new Image();
            img.loader = this;
            img.key = key;
            img.onload = function() {
                this.loader.onload(this);
            }
            img.src = this.pathMap[key];
        }
    }

    onload(img) {
        this.imageMap[img.key] = img;
        this.count--;
        if (this.count <= 0) {
            this.callback(this.imageMap);
        }
    }
}

//==============================================================
// WAV
//==============================================================

function convertToWavLink(buffer, name) {
    // build a wav file link
    var src = makeWavDownloadLink(buffer);

    var hrefElement = document.createElement("a");

    // generate a file name
    var fileName = name + ".wav";

    var a = document.createElement("a");
    a.download = fileName;
    a.href = src;
    a.innerHTML = fileName;
    a.onclick = doWavClick;
    return a;
}

function doWavClick(e) {
    var e = e || window.event;
    if (e.altKey) {
        // super-secret debug mode: alt-click on a wav link to create a player instead of downloading it
        e.preventDefault();

	    var link = e.currentTarget;

	    if (link.altClicked) {
	        return;
	    }
	    link.altClicked = true;

	    var src = link.href;

	    var audio = document.createElement("audio");
	    audio.controls = true;
	    audio.autoplay = true;

	    var source = document.createElement("source");
	    source.src = link.href;
	    source.type = "audio/wav";
	    audio.appendChild(source);

	    var parent = link.parentNode;
	    parent.appendChild(document.createElement("br"));
	    parent.appendChild(document.createElement("br"));
	    parent.appendChild(audio);
    }
}

//==============================================================
// Progress bar
//==============================================================

class ProgressBar {
    constructor() {
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
}

class ProgressBar2 {
    constructor() {
        this.lastAmount = -1;
        // build the UI
        this.buildUI();
    }

    buildUI() {
        // overall container
        this.loadingBox = document.createElement("div");
        this.loadingBox.width = "100%";

        this.progressBar = document.createElement("div");
        this.progressBar.width = "0%";
        this.progressBar.className = "progressBar2";
        // we need something in it to give it height
        this.progressBar.innerHTML = "&nbsp;";
        this.loadingBox.appendChild(this.progressBar);

        // label
        this.labelBar = document.createElement("div");
        this.labelBar.width = "100%";
        this.labelBar.textAlign = "center";
        this.loadingBox.appendChild(this.labelBar);

        // start hidden
        this.hide();
    }

    hide() {
        this.loadingBox.style.display = "none";
    }

    show() {
        this.loadingBox.style.display = "block";
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
        if (this.label != text) {
            this.labelBar.innerHTML = text;
            this.label = text;
        }
    }
}

//==============================================================
// URL stuff
//==============================================================

	function urlEncodeString(string, plusIsSpace=true) {
	    // urlencode some things
	    string = encodeURIComponent(string);

	    if (plusIsSpace) {
            // replace whitespace with '+'
            string = string.replace(/\s/g, "+");
        }
        return string;
	}

	function urlDecodeString(string, plusIsSpace=true) {
	    if (plusIsSpace) {
            // un-replace '+' with a space
            string = string.replace(/\+/g, " ");
        }

	    // urldecode some things
	    string = decodeURIComponent(string);

	    // no funny business
	    string = string.replace(/[<>\"]/g, "");
	    return string;
	}

    function buildQueryUrl(query) {
        // get the current URL and strip out any query string
        var url = window.location.href;
        url = url.replace(/\?.*/, "");
        // append our parameters
        url += query;

        return url;
    }
    function getQueryParam(url, name, plusIsSpace=true) {
        // from https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
        // weird that there's no built in function for this
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        var results = regex.exec(url);
        if (!results) {
            return null;
        }
        if (!results[2]) {
            return '';
        }

        var res = results[2];

        if (plusIsSpace) {
            res = res.replace(/\+/g, ' ')
        }

        return decodeURIComponent(res);
    }

    var hrefUpdateDelay = 1000;
    var hrefUpdateTimeout = null;
    var hrefToUpdate = null;

    // modify a URL parameter directly in the browser location bar
    function modifyUrlQueryParam(key, value) {
        var href = getHref();

        if (href.match(new RegExp("[?&]" + key + "="))) {
            href = href.replace(new RegExp("([?&]" + key + "=)[^&#]*"), "$1" + value);

        } else if (href.indexOf("?") > 0) {
            href += "&" + key + "=" + value;
        } else {
            href += "?" + key + "=" + value;
        }

        updateHref(href);
    }

    function removeUrlQueryParam(key) {
        var href = getHref();

        // corner cases the stupid way
        href = href.replace(new RegExp("([?&])" + key + "=[^&#]*&"), "$1");
        href = href.replace(new RegExp("[&?]" + key + "=[^&#]*"), "");

        updateHref(href);
    }

    function getHref() {
        return hrefToUpdate ? hrefToUpdate : window.location.href;
    }

    function updateHref(href) {
        if (hrefUpdateTimeout) {
            clearTimeout(hrefUpdateTimeout);
        }

        hrefToUpdate = href;
        hrefUpdateTimeout = setTimeout(actuallyModifyUrl, hrefUpdateDelay);
    }

    function actuallyModifyUrl() {
        // shenanigans
        history.replaceState( {} , document.title, hrefToUpdate );
        hrefUpdateTimeout = null;
        hrefToUpdate = null;
    }

//==============================================================
// high precision timing, or as high a precision as the browser allows
// yoinked from: https://stackoverflow.com/questions/4874408/better-way-of-getting-time-in-milliseconds-in-javascript
//==============================================================

window.performance = window.performance || {};
performance.now = (function() {
    return performance.now       ||
        performance.mozNow    ||
        performance.msNow     ||
        performance.oNow      ||
        performance.webkitNow ||
        Date.now  /*none found - fallback to browser default */
})();

function getTime() {
    return window.performance.now();
}