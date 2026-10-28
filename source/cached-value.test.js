import {
	beforeEach,
	test,
} from 'node:test';
import CachedValue from './cached-value.ts';
import {
	calledWith,
	createCache,
	resetMocks,
	timeInTheFuture,
} from './testing-utils.js';

const storage = chrome.storage.local;
const testItem = new CachedValue('name');

beforeEach(() => {
	resetMocks();
	createCache(30, {});
});

test('get() with empty cache', async t => {
	t.assert.strictEqual(await testItem.get(), undefined);
});

test('get() with cache', async t => {
	createCache(10, {
		'cache:name': 'Rico',
	});

	t.assert.strictEqual(await testItem.get(), 'Rico');
	t.assert.ok(calledWith(storage.get, 'cache:name'));
});

test('get() with expired cache', async t => {
	createCache(-10, {
		'cache:name': 'Rico',
	});

	t.assert.strictEqual(await testItem.get(), undefined);
});

test('isCached() with empty cache', async t => {
	t.assert.strictEqual(await testItem.isCached(), false);
});

test('isCached() with cache', async t => {
	createCache(10, {
		'cache:name': 'Rico',
	});

	t.assert.strictEqual(await testItem.isCached(), true);
});

test('isCached() with expired cache', async t => {
	createCache(-10, {
		'cache:name': 'Rico',
	});

	t.assert.strictEqual(await testItem.isCached(), false);
});

test('set() without a value', async t => {
	await t.assert.rejects(testItem.set(), {
		name: 'TypeError',
		message: 'Expected a value to be stored',
	});
});

test('set() with undefined', async t => {
	await testItem.set('Anne');
	t.assert.strictEqual(await testItem.isCached(), true);

	await testItem.set(undefined);
	t.assert.strictEqual(await testItem.isCached(), true);
	t.assert.strictEqual(await testItem.get(), undefined);
});

test('set() with value', async t => {
	const maxAge = 20;
	const customLimitItem = new CachedValue('name', {maxAge: {days: maxAge}});

	await customLimitItem.set('Anne');

	const argument = storage.set.mock.calls[0].arguments[0];

	t.assert.deepStrictEqual(Object.keys(argument), ['cache:name']);
	t.assert.strictEqual(argument['cache:name'].data, 'Anne');
	t.assert.ok(argument['cache:name'].maxAge > timeInTheFuture({days: maxAge - 0.5}));
	t.assert.ok(argument['cache:name'].maxAge < timeInTheFuture({days: maxAge + 0.5}));
});
