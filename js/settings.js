// Wrapper class for persistent settings

class Settings {
    constructor() {
        // local storage key
        this.key = "mandascore:settings";

        // default setting values
        this.autosave = true;
        this.localStoreSort = "name";
        this.localStoreSortAsc = true;

        // load from local storage
        this.load();
    }

    load() {
        // load the local storage item
        var json = window.localStorage.getItem(this.key);
        if (json) {
            // parse json
            var props = JSON.parse(json);

            // check for each setting and override the default if present
            if (props.autosave != null) {
                this.autosave = props.autosave;
            }
            if (props.localStoreSort != null) {
                this.localStoreSort = props.localStoreSort;
            }
            if (props.localStoreSortAsc != null) {
                this.localStoreSortAsc = props.localStoreSortAsc;
            }
        }
    }

    save() {
        // build something we can JSONify
        var props = {
            "autosave": this.autosave,
            "localStoreSort": this.localStoreSort,
            "localStoreSortAsc": this.localStoreSortAsc
        }
        // format as JSON and save to local storage
        window.localStorage.setItem(this.key, JSON.stringify(props));
    }
}

var settings = new Settings();
