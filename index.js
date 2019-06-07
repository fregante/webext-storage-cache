const {isBackgroundPage} = require('webext-detect-page');

const storage = browser.storage.local;

async function has(key) {
	const cachedKey = `cache:${key}`;
	const values = await storage.get(cachedKey);
	return values[cachedKey] !== undefined;
}

async function get(key) {
	const cachedKey = `cache:${key}`;
	const values = await storage.get(cachedKey);
	const value = values[cachedKey];
	// If it's not in the cache, it's best to return "undefined"
	if (value === undefined) {
		return undefined;
	}

	if (Date.now() > value.expiration) {
		await storage.remove(cachedKey);
		return undefined;
	}

	console.log('CACHE: found', key, value.data);
	return value.data;
}

function set(key, value, expiration /* in days */) {
	console.log('CACHE: setting', key, value);
	const cachedKey = `cache:${key}`;
	return storage.set({
		[cachedKey]: {
			data: value,
			expiration: Date.now() + (1000 * 3600 * 24 * expiration)
		}
	});
}

async function purge() {
	const values = await storage.get();
	const removableItems = [];
	for (const [key, value] of Object.entries(values)) {
		if (key.startsWith('cache:') && Date.now() > value.expiration) {
			removableItems.push(key);
		}
	}

	if (removableItems.length > 0) {
		await storage.remove(removableItems);
	}
}

// Automatically clear cache every day
if (isBackgroundPage()) {
	setTimeout(purge, 60000); // Purge cache on launch, but wait a bit
	setInterval(purge, 1000 * 3600 * 24);
}

Object.defineProperty(exports, '__esModule', {value: true});

exports.default = {
	has,
	get,
	set
};
