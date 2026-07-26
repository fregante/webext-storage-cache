/* eslint-disable @typescript-eslint/naming-convention */
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
	timeInTheFuture,
	readItem,
	writeItem,
	deleteItem,
	has,
	deleteExpired,
	clear,
} from './legacy.js';

const {storage} = vi.hoisted(() => ({
	storage: {
		get: vi.fn(),
		set: vi.fn(),
		remove: vi.fn(),
	},
}));

vi.mock('webext-polyfill-kinda', () => ({
	default: {
		storage: {
			local: storage,
		},
		alarms: undefined,
	},
}));

vi.mock('webext-detect', () => ({
	isBackground: () => false,
	isExtensionContext: () => false,
}));

vi.mock('@sindresorhus/to-milliseconds', () => ({
	default: vi.fn(() => 1000),
}));

beforeEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();

	storage.get.mockResolvedValue({});
	storage.set.mockResolvedValue(undefined);
	storage.remove.mockResolvedValue(undefined);
});

describe('timeInTheFuture()', () => {
	it('returns the current time plus the duration', () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		expect(timeInTheFuture({seconds: 1})).toBe(2000);
	});
});

describe('readItem()', () => {
	it('returns a cached item', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: 'bar',
				maxAge: 2000,
			},
		});

		await expect(readItem('foo')).resolves.toEqual({
			data: 'bar',
			maxAge: 2000,
		});

		expect(storage.get).toHaveBeenCalledWith('cache:foo');
	});

	it('returns the item when it expires exactly now', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: 'bar',
				maxAge: 1000,
			},
		});

		await expect(readItem('foo')).resolves.toEqual({
			data: 'bar',
			maxAge: 1000,
		});
	});

	it('returns undefined when the item is expired', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(2000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: 'bar',
				maxAge: 1000,
			},
		});

		await expect(readItem('foo')).resolves.toBeUndefined();
	});

	it('returns undefined when the item does not exist', async () => {
		await expect(readItem('foo')).resolves.toBeUndefined();
	});
});

describe('writeItem()', () => {
	it('stores a value and returns it', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		const value = {hello: 'world'};

		await expect(writeItem('foo', value, {seconds: 1})).resolves.toBe(value);

		expect(storage.set).toHaveBeenCalledWith({
			'cache:foo': {
				data: value,
				maxAge: 2000,
			},
		});
	});
});

describe('deleteItem()', () => {
	it('removes the cache entry', async () => {
		await deleteItem('foo');

		expect(storage.remove).toHaveBeenCalledWith('cache:foo');
	});
});

describe('has()', () => {
	it('returns true when the item exists', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: true,
				maxAge: 2000,
			},
		});

		await expect(has('foo')).resolves.toBe(true);
	});

	it('returns false when the item is expired', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(2000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: true,
				maxAge: 1000,
			},
		});

		await expect(has('foo')).resolves.toBe(false);
	});
});

describe('deleteExpired()', () => {
	it('removes only expired cache entries', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.get.mockResolvedValue({
			'cache:expired': {
				data: 1,
				maxAge: 999,
			},
			'cache:fresh': {
				data: 2,
				maxAge: 1001,
			},
			other: {
				data: 3,
				maxAge: 0,
			},
		});

		await deleteExpired();

		expect(storage.remove).toHaveBeenCalledWith(['cache:expired']);
	});

	it('does nothing when there are no expired cache entries', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.get.mockResolvedValue({
			'cache:fresh': {
				data: 1,
				maxAge: 2000,
			},
			other: {
				data: 2,
				maxAge: 0,
			},
		});

		await deleteExpired();

		expect(storage.remove).not.toHaveBeenCalled();
	});

	it('does nothing when storage is empty', async () => {
		await deleteExpired();

		expect(storage.remove).not.toHaveBeenCalled();
	});
});

describe('clear()', () => {
	it('removes every cache entry', async () => {
		storage.get.mockResolvedValue({
			'cache:a': {},
			'cache:b': {},
			other: {},
		});

		await clear();

		expect(storage.remove).toHaveBeenCalledWith([
			'cache:a',
			'cache:b',
		]);
	});

	it('does nothing when there are no cache entries', async () => {
		storage.get.mockResolvedValue({
			other: {},
		});

		await clear();

		expect(storage.remove).not.toHaveBeenCalled();
	});

	it('does nothing when storage is completely empty', async () => {
		await clear();

		expect(storage.remove).not.toHaveBeenCalled();
	});
});
