//==============================================================
// undo/redo framework
//==============================================================

class Action {
	prepareUndoAction() {
		return true;
	}

	undoAction() {
		throw "not implemented";
	}

	prepareRedoAction() {
		return true;
	}

	redoAction() {
		throw "not implemented";
	}

	toString() {
		throw "not implemented";
	}
}

var undoStack = Array();
var redoStack = Array();
var maxUndoStackSize = 250;

function clearUndoStack() {
    undoStack = Array();
    redoStack = Array();
    updateButtons();
}

function updateUndoRedoButton(button, stack, prefix) {
	if (stack.length > 0) {
	    setButtonEnabled(button, true);
//		button.children[0].title = prefix + " " + stack[stack.length - 1].toString();

	} else {
	    setButtonEnabled(button, false);
		button.alt = prefix;
	}
}

function updateButtons() {
	updateUndoRedoButton(document.getElementById("undoButton"), undoStack, "Undo");
	updateUndoRedoButton(document.getElementById("redoButton"), redoStack, "Redo");
}

function addUndoAction(action) {
	// add to the stack
	undoStack.push(action);
	// trim the back of the stack if it's exceeded the max size
	while (undoStack.length > maxUndoStackSize) {
		undoStack.shift();
	}
	// clear the redo stack
	redoStack = Array();
	// update UI
	updateButtons();
}

function doUndo() {
	// pop the last action
	var action = undoStack.pop();
	// make sure there was a last action
	if (action) {
		// prepare the action, this can be nothing or can involve things like moving the view to where the action
		// took place
		if (!action.prepareUndoAction()) {
			// if we had to prepare, then the user needs to undo again to actually undo the action
			undoStack.push(action);

		} else {
			// we're prepared, so undo the action
			action.undoAction();
			// put it on the redo stack
			redoStack.push(action);
		}
		// update UI
		updateButtons();
	}
}

function doRedo() {
	// pop the next action
	var action = redoStack.pop();
	// make sure is a next action
	if (action) {
		// prepare the action, this can be nothing or can involve things like moving the view to where the action
		// takes place
		if (!action.prepareRedoAction()) {
			// if we had to prepare, then the user needs to redo again to actually redo the action
			redoStack.push(action);

		} else {
			// we're prepared, so redo the action
			action.redoAction();
			// put it back on the undo stack
			undoStack.push(action);
		}
		// update UI
		updateButtons();
	}
}

//==============================================================
// Undo/Redo actions
//==============================================================

class CompositeAction extends Action {
    constructor(actions) {
        super();
        this.actions = actions;
    }

	prepareUndoAction() {
		return this.actions[this.actions.length - 1].prepareUndoAction();
	}

	undoAction() {
	    for (var a = this.actions.length - 1; a >= 0; a--) {
	        this.actions[a].prepareUndoAction();
	        this.actions[a].undoAction();
	    }
	}

	prepareRedoAction() {
		return this.actions[0].prepareRedoAction();
	}

	redoAction() {
	    for (var a = 0; a < this.actions.length; a++) {
	        this.actions[a].prepareRedoAction();
	        this.actions[a].redoAction();
	    }
	}

	toString() {
		return this.actions.length + " action(s)";
	}
}