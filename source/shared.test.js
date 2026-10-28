import {
	beforeEach,
	describe,
	it,
} from 'node:test';
import {calledWith, createCache, resetMocks} from './testing-utils.js';
import {
	timeInTheFuture,
	readItem,
	writeItem,
	deleteItem,
	has,
	deleteExpired,
	deleteWithLogic as clear,
} from './shared.ts';

beforeEach(() => {
	resetMocks();
	createCache(30, {});
});

const storage = chrome.storage.local;

describe('timeInTheFuture()', () => {
	it('returns the current time plus the duration', t => {
		t.mock.method(Date, 'now', () => 1000);

		t.assert.strictEqual(timeInTheFuture({seconds: 1}), 2000);
	});
});

describe('readItem()', () => {
	it('returns a cached item', async t => {
		t.mock.method(Date, 'now', () => 1000);

		storage.get.mock.mockImplementation(async () => ({
			'cache:foo': {
				data: 'bar',
				maxAge: 2000,
			},
		}));

		t.assert.deepStrictEqual(await readItem('foo'), {
			data: 'bar',
			maxAge: 2000,
		});

		t.assert.ok(calledWith(storage.get, 'cache:foo'));
	});

	it('returns the item when it expires exactly now', async t => {
		t.mock.method(Date, 'now', () => 1000);

		storage.get.mock.mockImplementation(async () => ({
			'cache:foo': {
				data: 'bar',
				maxAge: 1000,
			},
		}));

		t.assert.deepStrictEqual(await readItem('foo'), {
			data: 'bar',
			maxAge: 1000,
		});
	});

	it('returns undefined when the item is expired', async t => {
		t.mock.method(Date, 'now', () => 2000);

		storage.get.mock.mockImplementation(async () => ({
			'cache:foo': {
				data: 'bar',
				maxAge: 1000,
			},
		}));

		t.assert.strictEqual(await readItem('foo'), undefined);
	});

	it('returns undefined when the item does not exist', async t => {
		storage.get.mock.mockImplementation(async () => ({}));

		t.assert.strictEqual(await readItem('foo'), undefined);
	});
});

describe('writeItem()', () => {
	it('stores a value and returns it', async t => {
		t.mock.method(Date, 'now', () => 1000);

		const value = {hello: 'world'};

		t.assert.strictEqual(await writeItem('foo', value, {seconds: 1}), value);

		t.assert.ok(calledWith(storage.set, {
			'cache:foo': {
				data: value,
				maxAge: 2000,
			},
		}));
	});

	it('deletes expired entries and retries when storing fails', async t => {
		t.mock.method(Date, 'now', () => 1000);

		const value = {hello: 'world'};
		const error = new Error('Quota exceeded');

		storage.set.mock.mockImplementationOnce(async () => {
			throw error;
		}, 0);
		storage.set.mock.mockImplementationOnce(async () => undefined, 1);

		storage.getKeys.mock.mockImplementation(async () => [
			'cache:expired',
			'cache:fresh',
			'other',
		]);

		storage.get.mock.mockImplementation(async () => ({
			'cache:expired': {
				data: 1,
				maxAge: 999,
			},
			'cache:fresh': {
				data: 2,
				maxAge: 1001,
			},
		}));

		t.assert.strictEqual(await writeItem('foo', value, {seconds: 1}), value);

		t.assert.ok(calledWith(storage.remove, ['cache:expired']));

		t.assert.strictEqual(storage.set.mock.callCount(), 2);
		t.assert.deepStrictEqual(storage.set.mock.calls[0]?.arguments, [{
			'cache:foo': {
				data: value,
				maxAge: 2000,
			},
		}]);
		t.assert.deepStrictEqual(storage.set.mock.calls[1]?.arguments, [{
			'cache:foo': {
				data: value,
				maxAge: 2000,
			},
		}]);
	});

	it('throws when storing still fails after deleting expired entries', async t => {
		t.mock.method(Date, 'now', () => 1000);

		const value = {hello: 'world'};
		const firstError = new Error('Quota exceeded');
		const retryError = new Error('Still full');

		storage.set.mock.mockImplementationOnce(async () => {
			throw firstError;
		}, 0);
		storage.set.mock.mockImplementationOnce(async () => {
			throw retryError;
		}, 1);

		storage.getKeys.mock.mockImplementation(async () => [
			'cache:expired',
		]);

		storage.get.mock.mockImplementation(async () => ({
			'cache:expired': {
				data: 1,
				maxAge: 999,
			},
		}));

		await t.assert.rejects(writeItem('foo', value, {seconds: 1}), retryError);

		t.assert.ok(calledWith(storage.remove, ['cache:expired']));
		t.assert.strictEqual(storage.set.mock.callCount(), 2);
	});
});

describe('deleteItem()', () => {
	it('removes the cache entry', async t => {
		await deleteItem('foo');

		t.assert.ok(calledWith(storage.remove, 'cache:foo'));
	});
});

describe('has()', () => {
	it('returns true when the item exists', async t => {
		t.mock.method(Date, 'now', () => 1000);

		storage.get.mock.mockImplementation(async () => ({
			'cache:foo': {
				data: true,
				maxAge: 2000,
			},
		}));

		t.assert.strictEqual(await has('foo'), true);
	});

	it('returns false when the item is expired', async t => {
		t.mock.method(Date, 'now', () => 2000);

		storage.get.mock.mockImplementation(async () => ({
			'cache:foo': {
				data: true,
				maxAge: 1000,
			},
		}));

		t.assert.strictEqual(await has('foo'), false);
	});
});

describe('deleteExpired()', () => {
	it('removes only expired cache entries', async t => {
		t.mock.method(Date, 'now', () => 1000);

		storage.getKeys.mock.mockImplementation(async () => [
			'cache:expired',
			'cache:fresh',
			'other',
		]);

		storage.get.mock.mockImplementation(async () => ({
			'cache:expired': {
				data: 1,
				maxAge: 999,
			},
			'cache:fresh': {
				data: 2,
				maxAge: 1001,
			},
		}));

		await deleteExpired();

		t.assert.ok(calledWith(storage.remove, ['cache:expired']));
	});

	it('does nothing when there are no expired cache entries', async t => {
		t.mock.method(Date, 'now', () => 1000);

		storage.getKeys.mock.mockImplementation(async () => [
			'cache:fresh',
			'other',
		]);

		storage.get.mock.mockImplementation(async () => ({
			'cache:fresh': {
				data: 1,
				maxAge: 2000,
			},
		}));

		await deleteExpired();

		t.assert.strictEqual(storage.remove.mock.callCount(), 0);
	});

	it('does nothing when storage is empty', async t => {
		storage.getKeys.mock.mockImplementation(async () => []);

		await deleteExpired();

		t.assert.strictEqual(storage.remove.mock.callCount(), 0);
	});
});

describe('clear()', () => {
	it('removes every cache entry', async t => {
		storage.getKeys.mock.mockImplementation(async () => [
			'cache:a',
			'cache:b',
			'other',
		]);

		storage.get.mock.mockImplementation(async () => ({
			'cache:a': {},
			'cache:b': {},
		}));

		await clear();

		t.assert.ok(calledWith(storage.remove, [
			'cache:a',
			'cache:b',
		]));
	});

	it('does nothing when there are no cache entries', async t => {
		storage.getKeys.mock.mockImplementation(async () => ['other']);

		await clear();

		t.assert.strictEqual(storage.remove.mock.callCount(), 0);
	});

	it('does nothing when storage is completely empty', async t => {
		storage.getKeys.mock.mockImplementation(async () => []);

		await clear();

		t.assert.strictEqual(storage.remove.mock.callCount(), 0);
	});
});
