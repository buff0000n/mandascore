

imgGrid = Array(
    "measure-1",
    "measure-2",
    "measure-3",
    "measure-4"
);

imgNote = Array(
    "note-perc-1",
    "note-perc-2",
    "note-perc-3",
    "note-bass",
    "note-bass",
    "note-bass",
    "note-bass",
    "note-bass",
    "note-mel",
    "note-mel",
    "note-mel",
    "note-mel",
    "note-mel"
);

imgNoteHover = Array(
    "note-perc-1-hover",
    "note-perc-2-hover",
    "note-perc-3-hover",
    "note-bass-hover",
    "note-bass-hover",
    "note-bass-hover",
    "note-bass-hover",
    "note-bass-hover",
    "note-mel-hover",
    "note-mel-hover",
    "note-mel-hover",
    "note-mel-hover",
    "note-mel-hover"
);

imgNoteColHover = Array(
    "note-perc-1-col-hover",
    "note-perc-2-col-hover",
    "note-perc-3-col-hover",
    "note-bass-col-hover",
    "note-bass-col-hover",
    "note-bass-col-hover",
    "note-bass-col-hover",
    "note-bass-col-hover",
    "note-mel-col-hover",
    "note-mel-col-hover",
    "note-mel-col-hover",
    "note-mel-col-hover",
    "note-mel-col-hover"
);

function measureMouseover() {
    var e = window.event;
    var measure = e.currentTarget.measure;
    measure.doMouseover();
    measureMousemove();
}

function measureMousedown() {
    measureMouseEvent(true);
}

function measureMousemove() {
    measureMouseEvent(false);
}

function measureMouseEvent(click=false) {
    var e = window.event;
    e.preventDefault();
    var measure = e.currentTarget.measure;
    var targetRect = e.target.getBoundingClientRect();
    var x = Math.round(e.clientX - targetRect.left);
    var y = Math.round(e.clientY - targetRect.top);
    var down = e.buttons != 0;
    measure.doMousemove(x, y, down, click);
}

function measureMouseout() {
    var e = window.event;
    e.preventDefault();
    var measure = e.currentTarget.measure;
    measure.doMouseout();
}

function createNoteImage(baseName) {
        img = document.createElement("img");
        img.src = "img/" + baseName + ".png";
        img.srcset = "img2x/" + baseName + ".png 2x";
        img.baseName = baseName;
        return img;
}

class Note {
    constructor(measure, time, row) {
        this.measure = measure;
        this.time = time;
        this.row = row;
        this.enabled = false;
        this.hover = false;
        this.timeHover = false;
        this.img = null;
    }

    setImg(baseName) {
        if (baseName == null) {
            if (this.img != null) {
                this.measure.removeImage(this.img);
                this.img = null;
            }
            return;
        }

        if (this.img != null) {
            if (this.img.baseName == baseName) {
                return;
            }
            // todo: modify in place?
            this.measure.removeImage(this.img);
            this.img = null;
        }

        this.img = createNoteImage(baseName);
        this.measure.addImage(this.img, this.time, this.row);
    }
    
    updateState() {
        if (this.enabled) {
            this.setImg(imgNote[this.row]);

        } else if (this.hover) {
            this.setImg(imgNoteHover[this.row]);

        } else if (this.timeHover) {
            this.setImg(imgNoteColHover[this.row]);

        } else {
            this.setImg(null);
        }
    }
    
    toggleEnabled() {
        this.enabled = !this.enabled;
        this.updateState();
    }

    setHover(hover) {
        this.hover = hover;
        this.updateState();
    }

    setTimeHover(timeHover) {
        this.timeHover = timeHover;
        this.updateState();
    }
}

class Measure {
    constructor(number) {
        this.number = number;

        this.noteSpacingX = 4;
        this.noteSpacingY = 1;
        this.noteOffsetX = 2;
        this.noteOffsetY = 0;
        this.noteSizeX = 18;
        this.noteSizeY = 24;

        this.gridSizeX = this.noteSpacingX + this.noteSizeX;
        this.gridSizeY = this.noteSpacingY + this.noteSizeY;

        this.element = document.createElement("div");
        this.element.measure = this;
        this.element.style = "padding:0; margin:0; border0;";
        this.element.style.position = "relative";
        this.element.style.display = "inline-block";
        this.element.style.width = (this.gridSizeX * 16) + "px";
        this.element.style.height = (this.gridSizeY * 13) + "px";

        this.gridImg = createNoteImage(imgGrid[this.number]);
        this.gridImg.measure = this;
        this.gridImg.style.position = "absolute";
        this.gridImg.style.left = 0;
        this.gridImg.style.top = 0;
        this.gridImg.onmouseover = measureMouseover;
        this.gridImg.onmousemove = measureMousemove;
        this.gridImg.onmousedown = measureMousedown;
//        this.gridImg.onmousedrag = measureMousedrag;
        this.gridImg.onmouseout = measureMouseout;

        this.element.appendChild(this.gridImg);

        this.hovering = false;
        this.hoveredTime = -1;
        this.hoveredRow = -1;

        this.notes = Array(16);
        for (var t = 0; t < this.notes.length; t++) {
            this.notes[t] = new Array(13);
            for (var r = 0; r < this.notes[t].length; r++) {
                this.notes[t][r] = new Note(this, t, r);
            }
        }
    }

    removeImage(img) {
//        this.element.removeChild(img);
        img.remove();
    }

    addImage(img, time, row) {
        img.style.position = "absolute";
        img.style.left = this.noteOffsetX + (this.gridSizeX * time);
        img.style.top = this.noteOffsetY + (this.gridSizeY * row);
//        img.style.zIndex = "10";
        img.style.pointerEvents = "none";
        this.element.appendChild(img);
    }

    getRow(y) {
        var row = Math.floor(y / this.gridSizeY);
        return row < 0 || row > 13 ? -1 : row;
    }

    getTime(x) {
        var time = Math.floor(x / this.gridSizeX);
        return time < 0 || time > 15 ? -1 : time;
    }

    doMouseover() {
        this.hovering = true;
    }

    doMousemove(x, y, down=false, click=false) {
        if (!this.hovering) {
            return;
        }

        var time = this.getTime(x);
        var row = this.getRow(y);
        this.hover(time, row, down, click);
    }

    doMouseout() {
        this.hovering = false;
        this.hover(-2, -2);
    }

    hover(time, row, down=false, click=false) {
        if (this.hoveredTime != -1 && (time != this.hoveredTime || row < 0)) {
            for (var r = 0; r < 13; r++) {
                this.notes[this.hoveredTime][r].setTimeHover(false);
            }
            this.notes[this.hoveredTime][this.hoveredRow].setHover(false);

        } else if (this.hoveredRow != -1 && (row != this.hoveredRow || time < 0)) {
            this.notes[this.hoveredTime][this.hoveredRow].setHover(false);
        }

        if (time >= 0 && row >= 0) {
            this.notes[time][row].setHover(true);
            for (var r = 0; r < 13; r++) {
                this.notes[time][r].setTimeHover(true);
            }

            if (click || (down && (this.hoveredRow != row || this.hoveredTime != time))) {
                this.notes[time][row].toggleEnabled();
            }

            this.hoveredTime = time;
            this.hoveredRow = row;

        } else {
            this.hoveredTime = -1;
            this.hoveredRow = -1;
        }
    }
}


var measures = Array();

function buildMeasures(container) {
    for (var m = 0; m < 4; m++) {
        var measure = new Measure(m);
        measures.push(measure);
        container.appendChild(measure.element);
    }
}
