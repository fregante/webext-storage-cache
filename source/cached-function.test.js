/* eslint-disable n/file-extension-in-import -- No alternative until this file is changed to .test.ts */
import {
	test, beforeEach, vi, assert, expect,
} from 'vitest';
import toMilliseconds from '@sindresorhus/to-milliseconds';
import CachedFunction from './cached-function.ts';

const getUsernameDemo = async name => name.slice(1).toUpperCase();

function timeInTheFuture(time) {
	return Date.now() + toMilliseconds(time);
}

function createCache(daysFromToday, wholeCache) {
	for (const [key, data] of Object.entries(wholeCache)) {
		chrome.storage.local.get
			.withArgs(key)
			.yields({
				[key]: {
					data,
					maxAge: timeInTheFuture({days: daysFromToday}),
				},
			});
	}
}

beforeEach(() => {
	chrome.flush();
	chrome.storage.local.get.yields({});
	chrome.storage.local.set.yields(undefined);
	chrome.storage.local.remove.yields(undefined);
});

test('getCached() with empty cache', async () => {
	const spy = vi.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});
	assert.equal(await testItem.getCached(), undefined);
	expect(spy).not.toHaveBeenCalled();
});

test('getCached() with cache', async () => {
	const spy = vi.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});
	createCache(10, {
		'cache:name': 'Rico',
	});
	assert.equal(await testItem.getCached(), 'Rico');
	expect(spy).not.toHaveBeenCalled();
});

test('getCached() with expired cache', async () => {
	const spy = vi.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});
	createCache(-10, {
		'cache:name': 'Rico',
	});
	assert.equal(await testItem.getCached(), undefined);
	expect(spy).not.toHaveBeenCalled();
});

test('`updater` with empty cache', async () => {
	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne"]');
	expect(spy).toHaveBeenNthCalledWith(1, '@anne');
	assert.equal(chrome.storage.local.set.lastCall.args[0]['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` with cache', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne"]');
	assert.equal(chrome.storage.local.set.callCount, 0);
	expect(spy).not.toHaveBeenCalled();
});

test('`updater` with expired cache', async () => {
	createCache(-10, {
		'cache:spy:["@anne"]': 'ONNA-expired-name',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');
	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne"]');
	expect(spy).toHaveBeenNthCalledWith(1, '@anne');
	assert.equal(chrome.storage.local.set.lastCall.args[0]['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` with empty cache and staleWhileRevalidate', async () => {
	const maxAge = 1;
	const staleWhileRevalidate = 29;

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: maxAge},
		staleWhileRevalidate: {days: staleWhileRevalidate},
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne"]');
	assert.equal(chrome.storage.local.set.callCount, 1);
	const arguments_ = chrome.storage.local.set.lastCall.args[0];
	assert.deepEqual(Object.keys(arguments_), ['cache:spy:["@anne"]']);
	assert.equal(arguments_['cache:spy:["@anne"]'].data, 'ANNE');

	const expectedExpiration = maxAge + staleWhileRevalidate;
	assert.ok(arguments_['cache:spy:["@anne"]'].maxAge > timeInTheFuture({days: expectedExpiration - 0.5}));
	assert.ok(arguments_['cache:spy:["@anne"]'].maxAge < timeInTheFuture({days: expectedExpiration + 0.5}));
});

test('`updater` with fresh cache and staleWhileRevalidate', async () => {
	createCache(30, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	// Cache is still fresh, it should be used
	expect(spy).not.toHaveBeenCalled();
	assert.equal(chrome.storage.local.set.callCount, 0);

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// Cache is still fresh, it should never be revalidated
	expect(spy).not.toHaveBeenCalled();
});

test('`updater` with stale cache and staleWhileRevalidate', async () => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne"]');
	assert.equal(chrome.storage.local.set.callCount, 0);

	// It shouldn’t be called yet
	expect(spy).not.toHaveBeenCalled();

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// It should be revalidated
	expect(spy).toHaveBeenCalledOnce();
	assert.equal(chrome.storage.local.set.callCount, 1);
	assert.equal(chrome.storage.local.set.lastCall.args[0]['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` varies cache by function argument', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');
	expect(spy).not.toHaveBeenCalled();

	assert.equal(await updaterItem.get('@mari'), 'MARI');
	expect(spy).toHaveBeenCalledOnce();
});

test('`updater` accepts custom cache key generator', async () => {
	createCache(10, {
		'cache:spy:["@anne",1]': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await updaterItem.get('@anne', 1);
	expect(spy).not.toHaveBeenCalled();

	await updaterItem.get('@anne', 2);
	expect(spy).toHaveBeenCalledOnce();

	assert.equal(chrome.storage.local.get.firstCall.args[0], 'cache:spy:["@anne",1]');
	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne",2]');
});

test('`updater` accepts custom string-based cache key', async () => {
	createCache(10, {
		'cache:CUSTOM:["@anne",1]': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('CUSTOM', {updater: spy});

	await updaterItem.get('@anne', 1);
	expect(spy).not.toHaveBeenCalled();

	await updaterItem.get('@anne', 2);
	expect(spy).toHaveBeenCalledOnce();

	assert.equal(chrome.storage.local.get.firstCall.args[0], 'cache:CUSTOM:["@anne",1]');
	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:CUSTOM:["@anne",2]');
});

test('`updater` accepts custom string-based with non-primitive parameters', async () => {
	createCache(10, {
		'cache:CUSTOM:["@anne",{"user":[1]}]': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('CUSTOM', {updater: spy});

	await updaterItem.get('@anne', {user: [1]});
	expect(spy).not.toHaveBeenCalled();

	await updaterItem.get('@anne', {user: [2]});
	expect(spy).toHaveBeenCalledOnce();

	assert.equal(chrome.storage.local.get.firstCall.args[0], 'cache:CUSTOM:["@anne",{"user":[1]}]');
	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:CUSTOM:["@anne",{"user":[2]}]');
});

test('`updater` verifies cache with shouldRevalidate callback', async () => {
	createCache(10, {
		'cache:@anne': 'anne@',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		shouldRevalidate: value => value.endsWith('@'),
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');
	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne"]');
	assert.equal(chrome.storage.local.set.lastCall.args[0]['cache:spy:["@anne"]'].data, 'ANNE');
	expect(spy).toHaveBeenCalledOnce();
});

test('`updater` avoids concurrent function calls', async () => {
	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	expect(spy).not.toHaveBeenCalled();

	// Parallel calls
	updaterItem.get('@anne');
	updaterItem.get('@anne');
	await updaterItem.get('@anne');
	expect(spy).toHaveBeenCalledOnce();

	// Parallel calls
	updaterItem.get('@new');
	updaterItem.get('@other');
	await updaterItem.get('@idk');
	expect(spy).toHaveBeenCalledTimes(4);
});

test('`updater` avoids concurrent function calls with complex arguments via cacheKey', async () => {
	const spy = vi.fn(async (transform, user) => transform(user.name));

	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		cacheKey: ([function_, user]) => JSON.stringify([function_.name, user]),
	});

	expect(spy).not.toHaveBeenCalled();
	const cacheMePlease = name => name.slice(1).toUpperCase();

	// Parallel calls
	updaterItem.get(cacheMePlease, {name: '@anne'});
	updaterItem.get(cacheMePlease, {name: '@anne'});

	await updaterItem.get(cacheMePlease, {name: '@anne'});
	expect(spy).toHaveBeenCalledOnce();

	// Parallel calls
	updaterItem.get(cacheMePlease, {name: '@new'});
	updaterItem.get(cacheMePlease, {name: '@other'});

	await updaterItem.get(cacheMePlease, {name: '@idk'});
	expect(spy).toHaveBeenCalledTimes(4);
});

test('`updater` uses cacheKey at every call, regardless of arguments', async () => {
	const cacheKey = vi.fn(arguments_ => arguments_.length);

	const updaterItem = new CachedFunction('spy', {
		updater() {},
		cacheKey,
	});

	await updaterItem.get();
	await updaterItem.get();
	expect(cacheKey).toHaveBeenCalledTimes(2);

	await updaterItem.get('@anne');
	await updaterItem.get('@anne');
	expect(cacheKey).toHaveBeenCalledTimes(4);
});

test('`updater` always loads the data from storage, not memory', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	assert.equal(chrome.storage.local.get.callCount, 1);
	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne"]');

	createCache(10, {
		'cache:spy:["@anne"]': 'NEW ANNE',
	});

	assert.equal(await updaterItem.get('@anne'), 'NEW ANNE');

	assert.equal(chrome.storage.local.get.callCount, 2);
	assert.equal(chrome.storage.local.get.lastCall.args[0], 'cache:spy:["@anne"]');
});

test('.getFresh() ignores cached value', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'OVERWRITE_ME',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});
	assert.equal(await updaterItem.getFresh('@anne'), 'ANNE');

	expect(spy).toHaveBeenNthCalledWith(1, '@anne');
	assert.equal(chrome.storage.local.get.callCount, 0);
	assert.equal(chrome.storage.local.set.lastCall.args[0]['cache:spy:["@anne"]'].data, 'ANNE');
});

// TODO: Test .applyOverride
