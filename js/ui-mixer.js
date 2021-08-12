class Mixer {
    constructor(score) {
        // back reference to the score
        this.score = score;

        // build the UI
        this.buildUI();
    }

    buildUI() {
        // main container
        this.mixerBox = document.createElement("div");
        this.mixerBox.className = "mixerBox";
        this.mixerBox.id = "mixerBox";
        // back reference because why not
        this.mixerBox.mixer = this;

        this.container = this.mixerBox;

        // button container
        this.buttons = document.createElement("div");
        this.buttons.className = "scoreButtonContainer";
        // back-reference
        this.buttons.score = this;
        // build the buttons in a single row
        this.buttons.innerHTML = `
            <div class="scoreButtonRow">
                <input class="titleButton" type="submit" value="Mixer"/>
                <input class="button resetButton" type="submit" value="Reset"/>
            </div>
        `;
        this.container.appendChild(this.buttons);

        // hook up events
        getFirstChild(this.container, "resetButton").addEventListener("click", () => { this.resetMixerButton() });
        getFirstChild(this.container, "titleButton").addEventListener("click", () => { this.hide() });

        // table fon containing the mixer list
        var table = document.createElement("table");

        // build a row slider
        this.masterSlider = new MixerSlider(this, true, null, null, true);

        // build the beginning of the mixer row
        var tr = document.createElement("tr");
        tr.className = "sectionRow";
        tr.innerHTML = `<td style="text-align:right">Master</td><td/>`;

        // add the slider and toggle
        this.masterSlider.buildUI(tr);
        // add the mixer row to the table
        table.appendChild(tr);

        // build the mixer UI for each section
        for (var name in this.score.sections) {
            this.score.sections[name].buildMixerUI(table);
        }

        // add the table to a scrollable container div
        var tableDiv = document.createElement("div");
        tableDiv.className = "mixerlistScollArea";
        tableDiv.appendChild(table);

        // add mixer list to container
        this.container.appendChild(tableDiv);
    }

    init() {
        // nothing to init
    }

    hide() {
        toggleMixer(getFirstChild(this.container, "titleButton"));
    }

    resetMixerButton(e) {
        // chrome thing
        getFirstChild(this.container, "resetButton").blur();
        this.resetMixer();
    }

    resetMixer() {
        // reset each section
        for (name in this.score.sections) {
            this.score.sections[name].resetMixer();
        }
    }

    mixerVolumeChange(isMixer, row, value, commit, secondary=false) {
        // only called by the master slider
        this.score.soundPlayer.setMasterVolume(value);
    }


    export() {
        // moxer config code header
        var string = "[Mixer";
        var first = true;
        var hasAdjustments = false;
        // go over the sections
        for (name in this.score.sections) {
            // section delimiter
            string += ":";
            // get the section's config string
            var sectionString = this.score.sections[name].exportMixer();
            // add to the mixer config
            string += sectionString;
            // check if there actually was any section mixer config
            if (sectionString.length > 0) {
                hasAdjustments = true;
            }
        }

        // if all sections are at default values then we don't need a mixer config at all
        if (!hasAdjustments) {
            return "";

        } else {
            // add the footer and return the config string
            string += "]";
            return string;
        }
    }

    isMixerExportString(string) {
        // check an import line for the mixer config format
        return string.startsWith("[Mixer:") && string.endsWith("]");
    }

    import(string) {
        // format check
        if (!this.isMixerExportString(string)) {
            throw "Invalid mixer format";
        }
        // extract the inside of the config and split by the section delimiter
        var importSections = string.slice(7, -1).split(":");
        // format check
        // It's surprisingly hard to get the size of an associative array.
        if (importSections.length != Object.getOwnPropertyNames(this.score.sections).length) {
            throw "Invalid mixer format";
        }

        // iterate over the sections and config strings
        var i = 0;
        for (name in this.score.sections) {
            // import mixer config into the section
            this.score.sections[name].importMixer(importSections[i]);
            i++;
        }
    }
}
