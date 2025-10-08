// no comment

var menus = Array();

function showMenu(menuDiv, container, element, fullWidth = false, autohide=true) {
	var elementBcr = element.getBoundingClientRect();
	container = document.body;
	var containerBcr = container.getBoundingClientRect();
	if (getCurrentMenuLevel() == 0) {
		var left = fullWidth ? 0 : elementBcr.left - containerBcr.left;
		var top = elementBcr.bottom - containerBcr.top;

	} else {
		var left = fullWidth ? 0 : elementBcr.right - containerBcr.left;
		var top = elementBcr.top - containerBcr.top;
	}

	showMenuAt(container, menuDiv, left, top);

	kickCleanupEventListener();
	menuDiv.addEventListener("click", kickCleanupEventListener);
}

function kickCleanupEventListener() {
    document.body.removeEventListener("click", autoHideMenus)
    // hack: schedule the cleanup listener to be added after this event is finished processing
    setTimeout(function() {document.body.addEventListener("click", autoHideMenus);}, 1);
}

function autoHideMenus() {
    var e = window.event;
    var menu = getParent(e.currentTarget.measure, "menu");
    if (!menu) {
        clearMenus();
        document.body.removeEventListener("click", autoHideMenus)
    }
}

function getCurrentMenuLevel() {
	return menus.length;
}

function clearMenus(leave = 0) {
    leave = Math.max(leave, 0);
    while (getCurrentMenuLevel() > leave) {
        var menu = menus.pop();
        if (menu.cleanup) {
            menu.cleanup();
        }
        menu.remove();
    }
}

function clearMenu() {
    clearMenus(getCurrentMenuLevel() - 1);
}

// arbitrary margin between the window border and the menu container
var placementMargin = 10;
// guessing at the space we need to leave below and to the left of a menu to account for the window scrollbars
var scrollbarSizeGuess = 16;
// delay in running rounds 2 and three of the layout mechanism.
var menuDelay = 50;

function showMenuAt(container, menuDiv, left, top, scrollEnabled = true) {
    // Cripes on a cracker this is way harder than it should be.

    // get the window dimensions before adding the menu
    var wx1 = window.scrollX + placementMargin
    var wx2 = window.scrollX + window.innerWidth - (placementMargin * 2) - scrollbarSizeGuess;
    var wy1 = window.scrollY + placementMargin;
    var wy2 = window.scrollY + window.innerHeight - (placementMargin * 2) - scrollbarSizeGuess;

    // initialize the menu location
    menuDiv.style.position = "absolute";
    menuDiv.style.left = left + "px";
    menuDiv.style.top = top + "px";
    // just throw it on the top level document
    document.body.style.position = "relative";
    document.body.appendChild(menuDiv);

    // save to the menu stack
    menus.push(menuDiv);

    // let the browser lay it out where we put it, then we'll adjust
    setTimeout(function() {
        // get the global position of the element
        var bcr = menuDiv.getBoundingClientRect();
        var left = bcr.left + window.scrollX;
        var top = bcr.top + window.scrollY;
        var width = bcr.width;
        var height = bcr.height;

        // snap to the left, if overlapping
        if (left < wx1) left = wx1;

        // snap to the top, if overlapping
        if (top < wy1) top = wy1;

        // snap to the right, if overlapping and it won't push it back over the left border
        if (left + width > wx2) {
            left = Math.max(wx1, wx2 - width);
        }

        // snap to the bottom, if overlapping and it won't push it back over the top border
        if (top + height > wy2) {
            top = Math.max(wy1, wy2 - height);
        }

        // place the menu container
        if (left != bcr.left) menuDiv.style.left = left + "px";
        if (top != bcr.top) menuDiv.style.top = top + "px";

        // check to see if it's still too wide
        if (left + width > wx2) {
            width = wx2 - wx1;
        }

        // check to see if it's still too tall
        if (top + height > wy2) {
            height = wy2 - wy1;
        }

        // scrollbar flags
        var needsScrollY = false;
        var needsScrollX = false;

        // check if we need to resize vertically
        if (height != bcr.height) {
            menuDiv.style.height = height + "px";
            needsScrollY = true;
        }

        // check if we need to resize horizontally
        if (width != bcr.width) {
            menuDiv.style.width = width + "px";
            needsScrollX = true;
        }

        // check if the scrollbar is enabled and we need it
        if (scrollEnabled && (needsScrollX || needsScrollY)) {
            // give the browser one more chance to lay things out before resizing
            setTimeout(function() {
                // sigh, we need to account for the vertical size if the title bar, if present
                //var titleBar = DomUtils.getFirstChild(menuDiv, "menu-title-bar", 1);
                // get the scrollbar container
                var scroll = menuDiv;//DomUtils.getFirstChild(menuDiv, "menu-content-scroll", 3);

                // get the top level menu div size
                var bcr = menuDiv.getBoundingClientRect();
                // get the height of the title bar, if present
                var titleHeight = 0;//titleBar ? titleBar.getBoundingClientRect().height : 0;

                // 8px margin and 8px padding on both sides
                var totalPadding = 32;

                if (needsScrollY) {
                    // enable vertical scrollbar
                    scroll.style.overflowY = "scroll";
                    // explicitly set the height of the scrollbar div
                    // this is the only way I've found to reliably keep the scroll section inside the menu div
                    scroll.style.height = (bcr.height - totalPadding - titleHeight) + "px";
                }
                if (needsScrollX) {
                    // enable horizontal scrollbar
                    scroll.style.overflowX = "scroll";
                    // explicitly set the width of the scrollbar div
                    scroll.style.width = (bcr.width - totalPadding) + "px";
                }
            }, menuDelay);
        }
    }, menuDelay);
}

function menuPlacementHack1(menuDiv) {
    var bcr = menuDiv.getBoundingClientRect();

    if (bcr.right > windowWidth) {
        menuDiv.style.left = "";
        menuDiv.style.right = "0px";
    }

	setTimeout(function() { menuPlacementHack2(menuDiv) }, 100);
}

function menuPlacementHack2(menuDiv) {
    var bcr = menuDiv.getBoundingClientRect();

    if (bcr.bottom > windowHeight) {
        menuDiv.style.top = "";
        menuDiv.style.bottom = "0px";
    }
}
