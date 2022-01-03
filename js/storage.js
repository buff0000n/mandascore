// Wrapper class for local storage
// todo: do some caching so we have to do fewer file higs and less JSON parsing?

class Storage {
    constructor() {
        // prefix under which we'll save all our stuff in local storage
        this.keyPrefix = "mandascore:save:";
        // autosave constant
        this.autosaveName = "Autosave";
//        // idle delay before doing an autosave
//        this.autosaveDelay = 2000;
    }

    // returns [{name, timestamp, date}]
    getListing() {
        var listing = [];
        // look for local storage items that start with the prefix
        for (var i = 0; i < window.localStorage.length; i++) {
            var key = window.localStorage.key(i);
            if (key.startsWith(this.keyPrefix)) {
                var item = window.localStorage.getItem(key);
                var listEntry = this.getListingItem(key, item);
                listing.push(listEntry);
            }
        }

        // the default ordering is basically random, so sort by something
        if (this.isSortByDate()) {
            listing.sort((a, b) => {
                return (a.timestamp - b.timestamp) * (this.isSortAscending() ? 1 : -1);
            });

        } else {
            listing.sort((a, b) => {
                return a.name.localeCompare(b.name) * (this.isSortAscending() ? 1 : -1);
            });
        }

        return listing;
    }

    getListingItem(key, item) {
        // todo: caching?
        // parse the item
        var entry = JSON.parse(item);
        // build a listing entry
        return {
            // remove the prefix from the name
            "name": key.substring(this.keyPrefix.length),
            // the actual item
            "item": entry.item,
            // the save timestamp
            "timestamp": entry.timestamp,
            // format the date for the browser's locale
            "date": new Date(entry.timestamp).toLocaleString()
        };
    }

    isSortByDate() {
        return settings.localStoreSort == "date";
    }

    isSortByName() {
        return !this.isSortByDate();
    }

    isSortAscending() {
        return settings.localStoreSortAsc;
    }

    setSortByName() {
        settings.localStoreSort = "name";
        settings.save();
    }

    setSortByDate() {
        settings.localStoreSort = "date";
        settings.save();
    }

    setSortAscending(asc) {
        settings.localStoreSortAsc = asc;
        settings.save();
    }

    getItem(name) {
        // build the local storage key
        var key = this.keyPrefix + name;
        var entry = window.localStorage.getItem(key);
        if (entry) {
            var json = JSON.parse(entry);
            // just pull out the item
            return json.item;
        }
        return null;
    }

    getAutosaveItem() {
        return this.getItem(this.autosaveName);
    }

    getFullItem(name) {
        var key = this.keyPrefix + name;
        var entry = window.localStorage.getItem(key);
        return entry ? this.getListingItem(key, entry) : null;
    }

    addItem(name, item) {
        // build the local storage key
        var key = this.keyPrefix + name;
        // build an entry
        var entry = {
            "timestamp": new Date().getTime(),
            "item": item
        }
        // check whether the name already exists
        var exists = window.localStorage.getItem(key) != null;
        // save a JSON formatted entry
        window.localStorage.setItem(key, JSON.stringify(entry));
        // return true if something was overwritten
        return exists;
    }

    autosaveItem(item) {
    // there's already a bunch of delays, just go straight to the save
//        // don't autosave immediately on every change, wait a few seconds for things to settle down
//        // cancel any existing scheduled autosave
//        if (this.autosaveTimeout) {
//    		clearTimeout(this.autosaveTimeout);
//        }
//
//        // schedule a new autosave
//    	this.autosaveTimeout = setTimeout(() => {
//    	    // actually add the item after some delay
            this.addItem(this.autosaveName, item);
//    	}, this.autosaveDelay);
    }

    removeItem(name, item) {
        // build the local storage key
        var key = this.keyPrefix + name;
        // check whether it exists
        var exists = window.localStorage.getItem(key) != null;
        if (exists) {
            // remove it
            window.localStorage.removeItem(key);
        }
        // return true if something was actually removed
        return exists;
    }

    containsItem(name) {
        // build the local storage key
        var key = this.keyPrefix + name;
        return window.localStorage.getItem(key) != null;
    }

    containsAutosaveItem() {
        return this.containsItem(this.autosaveName);
    }
}

// static instance
var storage = new Storage();