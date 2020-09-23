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

var windowWidth;
var windowHeight;

function onresize() {
    var h = Math.max(document.documentElement.clientHeight, window.innerHeight);
    var w = Math.max(document.documentElement.clientWidth, window.innerWidth);
    windowSizeChanged(h, w);
}

function windowSizeChanged(h, w) {
	windowHeight = h;
	windowWidth = w;
}

//==============================================================
// misc UI
//==============================================================

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
