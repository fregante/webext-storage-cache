/* eslint-disable n/file-extension-in-import -- No alternative until this file is changed to .test.ts */
import nodeAssert from 'node:assert';
import {test, beforeEach, assert} from 'vitest';
import toMilliseconds from '@sindresorhus/to-milliseconds';
import CachedValue from './cached-value.ts';

function timeInTheFuture(time) {
	return Date.now() + toMilliseconds(time);
}

const testItem = new CachedValue('name');

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

test('get() with empty cache', async () => {
	assert.equal(await testItem.get(), undefined);
});

test('get() with cache', async () => {
	createCache(10, {
		'cache:name': 'Rico',
	});
	assert.equal(await testItem.get(), 'Rico');
});

test('get() with expired cache', async () => {
	createCache(-10, {
		'cache:name': 'Rico',
	});
	assert.equal(await testItem.get(), undefined);
});

test('isCached() with empty cache', async () => {
	assert.equal(await testItem.isCached(), false);
});

test('isCached() with cache', async () => {
	createCache(10, {
		'cache:name': 'Rico',
	});
	assert.equal(await testItem.isCached(), true);
});

test('isCached() with expired cache', async () => {
	createCache(-10, {
		'cache:name': 'Rico',
	});
	assert.equal(await testItem.isCached(), false);
});

test('set() without a value', async () => {
	await nodeAssert.rejects(testItem.set(), {
		name: 'TypeError',
		message: 'Expected a value to be stored',
	});
});

// TODO: must check chrome#set or chrome#delete calls
test.skip('set() with undefined', async () => {
	await testItem.set('Anne');
	assert.equal(await testItem.isCached(), true);

	await testItem.set(undefined);
	assert.equal(await testItem.isCached(), false);
});

test('set() with value', async () => {
	const maxAge = 20;
	const customLimitItem = new CachedValue('name', {maxAge: {days: maxAge}});
	await customLimitItem.set('Anne');
	const arguments_ = chrome.storage.local.set.lastCall.args[0];
	assert.deepEqual(Object.keys(arguments_), ['cache:name']);
	assert.equal(arguments_['cache:name'].data, 'Anne');
	assert.ok(arguments_['cache:name'].maxAge > timeInTheFuture({days: maxAge - 0.5}));
	assert.ok(arguments_['cache:name'].maxAge < timeInTheFuture({days: maxAge + 0.5}));
});
