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
var maxUndoStackSize = 100;

function updateUndoRedoButton(button, stack, prefix) {
	if (stack.length > 0) {
		button.disabled = false;
//		button.children[0].title = prefix + " " + stack[stack.length - 1].toString();

	} else {
		button.disabled = true;
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
	    for (var a = this.actions.length - 1; a > 0; a--) {
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

//class MoveRoomAction extends Action {
//	constructor(room) {
//		super();
//		this.room = room;
//		this.recordFrom(this.room);
//	}
//
//	recordFrom() {
//		this.fromMX = this.room.mv.x;
//		this.fromMY = this.room.mv.y;
//		this.fromFloor = this.room.floor;
//		this.fromR = this.room.rotation;
//	}
//
//	recordTo() {
//		this.toMX = this.room.mv.x;
//		this.toMY = this.room.mv.y;
//		this.toFloor = this.room.floor;
//		this.toR = this.room.rotation;
//	}
//
//	isAMove() {
//		this.recordTo(this.room);
//		return this.fromMX != this.toMX
//				|| this.fromMY != this.toMY
//				|| this.fromFloor != this.toFloor
//				|| this.fromR != this.toR;
//	}
//
//	prepareUndoAction() {
//		centerViewOnIfNotVisible(this.fromMX, this.fromMY, this.fromFloor);
//		// having a prepare step to show what's about to change feels more confusing than not having it
//		return true;
//	}
//
//	undoAction() {
//		if (this.fromFloor != this.toFloor) {
//		    removeFloorRoom(this.room);
//		}
//		this.room.disconnectAllDoors();
//		this.room.setPositionAndConnectDoors(this.fromMX, this.fromMY, this.fromFloor, this.fromR);
//		if (this.fromFloor != this.toFloor) {
//		    addFloorRoom(this.room);
//		}
//		selectRoom(this.room)
//		saveModelToUrl();
//	}
//
//	prepareRedoAction() {
//		centerViewOnIfNotVisible(this.toMX, this.toMY, this.toFloor);
//		// having a prepare step to show what's about to change feels more confusing than not having it
//		return true;
//	}
//
//	redoAction() {
//		if (this.fromFloor != this.toFloor) {
//		    removeFloorRoom(this.room);
//		}
//		this.room.disconnectAllDoors();
//		this.room.setPositionAndConnectDoors(this.toMX, this.toMY, this.toFloor, this.toR);
//		if (this.fromFloor != this.toFloor) {
//		    addFloorRoom(this.room);
//		}
//		selectRoom(this.room)
//		saveModelToUrl();
//	}
//
//	toString() {
//		return "Move " + this.room.metadata.name;
//	}
//}
//
//class AddDeleteRoomAction extends Action {
//	constructor(room, add) {
//		super();
//		this.room = room;
//		this.record(this.room);
//		this.add = add;
//	}
//
//	record() {
//		this.MX = this.room.mv.x;
//		this.MY = this.room.mv.y;
//		this.Floor = this.room.floor;
//		this.R = this.room.rotation;
//	}
//
//	prepareUndoAction() {
//		centerViewOnIfNotVisible(this.MX, this.MY, this.Floor);
//		// having a prepare step to show what's about to change feels more confusing than not having it
//		return true;
//	}
//
//	prepareRedoAction() {
//		return this.prepareUndoAction();
//	}
//
//	undoAction() {
//		this.doAction(false);
//	}
//
//	redoAction() {
//		this.doAction(true);
//	}
//
//	doAction(redo) {
//		// there's no logical XOR in Javascript?!
//		if (!this.add && redo) this.removeAction();
//		else if (!this.add && !redo) this.addAction();
//		else if (this.add && redo) this.addAction();
//		else if (this.add && !redo) this.removeAction();
//	}
//
//	addAction() {
//	    addRoom(this.room);
//		// hax to force it to think the floor has changed and setup its display
//		this.room.floor = 100;
//	    this.room.setPositionAndConnectDoors(this.MX, this.MY, this.Floor, this.R);
//		selectRoom(this.room)
//		saveModelToUrl();
//	}
//
//	removeAction() {
//	    removeRoom(this.room);
//	}
//
//	toString() {
//		return (this.add ? "Add " : "Delete ") + this.room.metadata.name;
//	}
//}