var storageCache = (function () {
	'use strict';

	function unwrapExports (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var webextDetectPage = createCommonjsModule(function (module, exports) {
	// https://github.com/bfred-it/webext-detect-page
	Object.defineProperty(exports, "__esModule", { value: true });
	function isBackgroundPage() {
	    return location.pathname === '/_generated_background_page.html' &&
	        !location.protocol.startsWith('http') &&
	        Boolean(typeof chrome === 'object' && chrome.runtime);
	}
	exports.isBackgroundPage = isBackgroundPage;
	function isContentScript() {
	    return location.protocol.startsWith('http') &&
	        Boolean(typeof chrome === 'object' && chrome.runtime);
	}
	exports.isContentScript = isContentScript;
	function isOptionsPage() {
	    if (typeof chrome !== 'object' || !chrome.runtime) {
	        return false;
	    }
	    const { options_ui } = chrome.runtime.getManifest();
	    if (typeof options_ui !== 'object' || typeof options_ui.page !== 'string') {
	        return false;
	    }
	    const url = new URL(options_ui.page, location.origin);
	    return url.pathname === location.pathname &&
	        url.origin === location.origin;
	}
	exports.isOptionsPage = isOptionsPage;

	});

	unwrapExports(webextDetectPage);
	var webextDetectPage_1 = webextDetectPage.isBackgroundPage;
	var webextDetectPage_2 = webextDetectPage.isContentScript;
	var webextDetectPage_3 = webextDetectPage.isOptionsPage;

	// https://github.com/bfred-it/webext-storage-cache
	// @ts-ignore
	async function p(fn, ...args) {
	    return new Promise((resolve, reject) => {
	        // @ts-ignore
	        fn(...args, result => {
	            if (chrome.runtime.lastError) {
	                reject(chrome.runtime.lastError);
	            }
	            else {
	                resolve(result);
	            }
	        });
	    });
	}
	const _get = chrome.storage.local.get.bind(chrome.storage.local);
	const _set = chrome.storage.local.set.bind(chrome.storage.local);
	const _remove = chrome.storage.local.remove.bind(chrome.storage.local);
	async function has(key) {
	    const cachedKey = `cache:${key}`;
	    const values = await p(_get, cachedKey);
	    return values[cachedKey] !== undefined;
	}
	async function get(key) {
	    const cachedKey = `cache:${key}`;
	    const values = await p(_get, cachedKey);
	    const value = values[cachedKey];
	    // If it's not in the cache, it's best to return "undefined"
	    if (value === undefined) {
	        return undefined;
	    }
	    if (Date.now() > value.expiration) {
	        await p(_remove, cachedKey);
	        return undefined;
	    }
	    return value.data;
	}
	async function set(key, value, expiration = 30 /* days */) {
	    const cachedKey = `cache:${key}`;
	    return p(_set, {
	        [cachedKey]: {
	            data: value,
	            expiration: Date.now() + (1000 * 3600 * 24 * expiration)
	        }
	    });
	}
	async function delete_(key) {
	    const cachedKey = `cache:${key}`;
	    return p(_remove, cachedKey);
	}
	async function purge() {
	    const values = await p(_get);
	    const removableItems = [];
	    for (const [key, value] of Object.entries(values)) {
	        if (key.startsWith('cache:') && Date.now() > value.expiration) {
	            removableItems.push(key);
	        }
	    }
	    if (removableItems.length > 0) {
	        await p(_remove, removableItems);
	    }
	}
	// Automatically clear cache every day
	if (webextDetectPage_1()) {
	    setTimeout(purge, 60000); // Purge cache on launch, but wait a bit
	    setInterval(purge, 1000 * 3600 * 24);
	}
	var index = {
	    has,
	    get,
	    set,
	    delete: delete_
	};

	return index;

}());
