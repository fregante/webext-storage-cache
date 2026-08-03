import nodeAssert from 'node:assert';
import {
	assert, expect, beforeEach, test, vi,
} from 'vitest';
import CachedValue from './cached-value.ts';
import {
	createCache,
	timeInTheFuture,
} from './test-utils.js';

const storage = chrome.storage.local;
const testItem = new CachedValue('name');

beforeEach(() => {
	vi.resetAllMocks();
	createCache(30, {});
});

test('get() with empty cache', async () => {
	assert.equal(await testItem.get(), undefined);
});

test('get() with cache', async () => {
	createCache(10, {
		'cache:name': 'Rico',
	});

	assert.equal(await testItem.get(), 'Rico');
	expect(storage.get).toHaveBeenCalledWith('cache:name');
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

test('set() with undefined', async () => {
	await testItem.set('Anne');
	assert.equal(await testItem.isCached(), true);

	await testItem.set(undefined);
	assert.equal(await testItem.isCached(), false);
});

test('set() with value', async () => {
	const maxAge = 20;
	const customLimitItem = new CachedValue('name', {maxAge: {days: maxAge}});

	await customLimitItem.set('Anne');

	const argument = storage.set.mock.calls[0][0];

	assert.deepEqual(Object.keys(argument), ['cache:name']);
	assert.equal(argument['cache:name'].data, 'Anne');
	assert.ok(argument['cache:name'].maxAge > timeInTheFuture({days: maxAge - 0.5}));
	assert.ok(argument['cache:name'].maxAge < timeInTheFuture({days: maxAge + 0.5}));
});
