// no comment

var menus = Array();

function showMenu(menuDiv, container, element, fullWidth = false, autohide=true) {
	var elementBcr = element.getBoundingClientRect();
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
        menu.remove();
    }
}

function clearMenu() {
    clearMenus(getCurrentMenuLevel() - 1);
}

function showMenuAt(container, menuDiv, left, top) {
    // need to do this first before calculating any bounding rectangles
    menuDiv.style.position = "absolute";

    container.appendChild(menuDiv);

    var bcr = menuDiv.getBoundingClientRect();
	var w = window.innerWidth;
	var h = window.innerHeight;

	if (left < 0) left = 0;

	if (top < 0) top = 0;

    if (left + bcr.width > w) {
        left = Math.max(0, w - bcr.width);
    }
    if (top + bcr.height > h) {
        top = Math.max(0, h - bcr.height);
    }

    menuDiv.style.left = left;
    menuDiv.style.top = top;
    menuDiv.style.zIndex = 10;

    menus.push(menuDiv);

	setTimeout(function() { menuPlacementHack1(menuDiv) }, 100);
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
