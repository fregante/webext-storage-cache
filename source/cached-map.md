_Go back to the [main documentation page.](../readme.md#api)_

# CachedMap(name, options)

`CachedMap` provides a Map-like interface for caching individual items without requiring an updater function. This is useful when you want to manually cache multiple related items under a single namespace, without refactoring your code to use `CachedFunction`.

Unlike `CachedFunction`, `CachedMap` does not automatically fetch or update values. You must manually `set()` values and later `get()` them.

## name

Type: string

The unique name that will be used in `chrome.storage.local` combined with the key, like `cache:${name}:${key}`.

For example:

```js
const userCache = new CachedMap('users');

await userCache.set('alice', {id: 1, name: 'Alice'});
await userCache.set('bob', {id: 2, name: 'Bob'});
```

Will create 2 items in the storage:

```json
{
	"cache:users:[\"alice\"]": {"id": 1, "name": "Alice"},
	"cache:users:[\"bob\"]": {"id": 2, "name": "Bob"}
}
```

## options

### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire after being set.

## CachedMap#get(key)

Gets a cached value by key. Returns `undefined` if the key is not cached or has expired.

```js
const userCache = new CachedMap('users');
const user = await userCache.get('alice'); // Can be undefined
```

## CachedMap#set(key, value)

Stores a value in the cache with the specified key.

```js
const userCache = new CachedMap('users');
await userCache.set('alice', {id: 1, name: 'Alice'});
```

## CachedMap#has(key)

Checks if a key exists in the cache and has not expired.

```js
const userCache = new CachedMap('users');
await userCache.has('alice');
// => true / false
```

## CachedMap#delete(key)

Removes a cached value by key.

```js
const userCache = new CachedMap('users');
await userCache.delete('alice');
```

## Use Case Example

This is particularly useful when you have existing code that caches items individually and you don't want to refactor it to use `CachedFunction`:

```js
import {CachedMap} from 'webext-storage-cache';

// Instead of using a plain object or Map:
// const cache = {};
// cache[userId] = userData;

// Use CachedMap for persistent, expiring cache:
const userCache = new CachedMap('github-users', {
	maxAge: {days: 7},
});

async function getUserData(userId) {
	// Check if we have it cached
	let userData = await userCache.get(userId);
	
	if (!userData) {
		// Fetch fresh data
		userData = await fetchUserFromAPI(userId);
		
		// Cache it
		await userCache.set(userId, userData);
	}
	
	return userData;
}
```

## Comparison with CachedFunction

If you're building new code, `CachedFunction` is often more convenient as it handles the fetch-and-cache logic automatically:

```js
// With CachedMap (manual)
const userCache = new CachedMap('users');
let user = await userCache.get('alice');
if (!user) {
	user = await fetchUser('alice');
	await userCache.set('alice', user);
}

// With CachedFunction (automatic)
const getUser = new CachedFunction('users', {
	updater: fetchUser,
});
const user = await getUser.get('alice');
```

However, `CachedMap` is useful when:
- You're refactoring existing code that manually manages cache
- You want explicit control over when values are cached
- The same key might need different values at different times
- You're building a Map-like abstraction layer

## License

MIT © [Federico Brigante](https://fregante.com)
