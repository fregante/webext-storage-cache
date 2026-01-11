import nodeAssert from 'node:assert';
import {test, beforeEach, assert} from 'vitest';
import toMilliseconds from '@sindresorhus/to-milliseconds';
import CachedMap from './cached-map.ts';

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

test('get() with empty cache', async () => {
	const map = new CachedMap('users');
	assert.equal(await map.get('user1'), undefined);
});

test('get() with cache', async () => {
	createCache(10, {
		'cache:users:["user1"]': {name: 'Alice', id: 1},
	});
	const map = new CachedMap('users');
	assert.deepEqual(await map.get('user1'), {name: 'Alice', id: 1});
});

test('get() with expired cache', async () => {
	createCache(-10, {
		'cache:users:["user1"]': {name: 'Alice', id: 1},
	});
	const map = new CachedMap('users');
	assert.equal(await map.get('user1'), undefined);
});

test('set() and get() roundtrip', async () => {
	const map = new CachedMap('users');
	const userData = {name: 'Bob', id: 2};

	await map.set('user2', userData);

	const setArguments = chrome.storage.local.set.lastCall.args[0];
	assert.deepEqual(Object.keys(setArguments), ['cache:users:["user2"]']);
	assert.deepEqual(setArguments['cache:users:["user2"]'].data, userData);
});

test('set() without a value', async () => {
	const map = new CachedMap('users');
	await nodeAssert.rejects(map.set('user1'), {
		name: 'TypeError',
		message: 'Expected a value to be stored',
	});
});

test('set() with custom maxAge', async () => {
	const maxAge = 20;
	const map = new CachedMap('users', {maxAge: {days: maxAge}});
	await map.set('user1', {name: 'Charlie', id: 3});

	const setArguments = chrome.storage.local.set.lastCall.args[0];
	assert.deepEqual(Object.keys(setArguments), ['cache:users:["user1"]']);
	assert.deepEqual(setArguments['cache:users:["user1"]'].data, {name: 'Charlie', id: 3});
	assert.ok(setArguments['cache:users:["user1"]'].maxAge > timeInTheFuture({days: maxAge - 0.5}));
	assert.ok(setArguments['cache:users:["user1"]'].maxAge < timeInTheFuture({days: maxAge + 0.5}));
});

test('has() with empty cache', async () => {
	const map = new CachedMap('users');
	assert.equal(await map.has('user1'), false);
});

test('has() with cache', async () => {
	createCache(10, {
		'cache:users:["user1"]': {name: 'Dave', id: 4},
	});
	const map = new CachedMap('users');
	assert.equal(await map.has('user1'), true);
});

test('has() with expired cache', async () => {
	createCache(-10, {
		'cache:users:["user1"]': {name: 'Eve', id: 5},
	});
	const map = new CachedMap('users');
	assert.equal(await map.has('user1'), false);
});

test('delete() removes cached value', async () => {
	createCache(10, {
		'cache:users:["user1"]': {name: 'Frank', id: 6},
	});
	const map = new CachedMap('users');

	await map.delete('user1');

	assert.equal(chrome.storage.local.remove.lastCall.args[0], 'cache:users:["user1"]');
});

test('multiple keys can be stored independently', async () => {
	const map = new CachedMap('users');

	await map.set('user1', {name: 'Alice', id: 1});
	await map.set('user2', {name: 'Bob', id: 2});

	assert.equal(chrome.storage.local.set.callCount, 2);

	createCache(10, {
		'cache:users:["user1"]': {name: 'Alice', id: 1},
		'cache:users:["user2"]': {name: 'Bob', id: 2},
	});

	assert.deepEqual(await map.get('user1'), {name: 'Alice', id: 1});
	assert.deepEqual(await map.get('user2'), {name: 'Bob', id: 2});
});

test('different map names are isolated', async () => {
	const usersMap = new CachedMap('users');
	const postsMap = new CachedMap('posts');

	await usersMap.set('item1', {name: 'Alice'});
	await postsMap.set('item1', {title: 'Hello'});

	const firstCall = chrome.storage.local.set.firstCall.args[0];
	const secondCall = chrome.storage.local.set.lastCall.args[0];

	assert.ok(Object.keys(firstCall)[0].includes('users'));
	assert.ok(Object.keys(secondCall)[0].includes('posts'));
});
