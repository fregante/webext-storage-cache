import {isDeepStrictEqual} from 'node:util';
import toMilliseconds from '@sindresorhus/to-milliseconds';

export function timeInTheFuture(time) {
	return Date.now() + toMilliseconds(time);
}

export function createCache(daysFromToday, wholeCache) {
	const store = Object.fromEntries(Object.entries(wholeCache).map(([key, data]) => [
		key,
		{
			data,
			maxAge: timeInTheFuture({days: daysFromToday}),
		},
	]));

	chrome.storage.local.get.mock.mockImplementation(async key => {
		if (key === undefined) {
			return {...store};
		}

		if (typeof key === 'string') {
			return Object.hasOwn(store, key)
				? {[key]: store[key]}
				: {};
		}

		if (Array.isArray(key)) {
			return Object.fromEntries(key
				.filter(cacheKey => Object.hasOwn(store, cacheKey))
				.map(cacheKey => [cacheKey, store[cacheKey]]));
		}

		return {};
	});

	chrome.storage.local.getKeys.mock.mockImplementation(async () => Object.keys(store));

	chrome.storage.local.set.mock.mockImplementation(async items => {
		Object.assign(store, items);
	});

	chrome.storage.local.remove.mock.mockImplementation(async keys => {
		for (const cacheKey of [keys].flat()) {
			delete store[cacheKey];
		}
	});

	return store;
}

export function resetMocks() {
	for (const function_ of Object.values(chrome.storage.local)) {
		function_.mock.resetCalls();
	}
}

export function calledWith(function_, ...expected) {
	return function_.mock.calls.some(call => isDeepStrictEqual(call.arguments, expected));
}
