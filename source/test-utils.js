import toMilliseconds from '@sindresorhus/to-milliseconds';

export function timeInTheFuture(time) {
	return Date.now() + toMilliseconds(time);
}

export function createCache(daysFromToday, wholeCache) {
	const store = Object.fromEntries(
		Object.entries(wholeCache).map(([key, data]) => [
			key,
			{
				data,
				maxAge: timeInTheFuture({days: daysFromToday}),
			},
		]),
	);

	chrome.storage.local.get.mockImplementation(async key => {
		if (key === undefined) {
			return {...store};
		}

		if (typeof key === 'string') {
			return key in store ? {[key]: store[key]} : {};
		}

		if (Array.isArray(key)) {
			return Object.fromEntries(
				key
					.filter(key => key in store)
					.map(key => [key, store[key]]),
			);
		}

		return {};
	});

	chrome.storage.local.set.mockImplementation(async items => {
		for (const [key, value] of Object.entries(items)) {
			if (value?.data === undefined) {
				delete store[key];
			} else {
				store[key] = value;
			}
		}
	});

	chrome.storage.local.remove.mockImplementation(async keys => {
		for (const key of [keys].flat()) {
			delete store[key];
		}
	});

	return store;
}
