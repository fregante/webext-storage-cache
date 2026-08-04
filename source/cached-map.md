_Go back to the [main documentation page.](../readme.md#api)_

# new CachedMap(name, options)

This class lets you manage a namespaced collection of key-value pairs in the cache, preserving their type if you're using TypeScript:

```js
import {CachedMap} from 'webext-storage-cache';

const users = new CachedMap('users');

// Or in TypeScript
const users = new CachedMap<User>('users');
```

> **Note**:
> The name is unique but `webext-storage-cache` doesn't save you from bad usage. Avoid reusing the same name across the extension with different value types, because it will cause conflicts:

```ts
const starredRepos = new CachedMap<Repo[]>('stars', {days: 1});
const starCounts = new CachedMap<number>('stars'); // Bad: they will override each other
```

## name

Type: string

The unique name that will be used in `chrome.storage.local` as `cache:${name}:${key}`

## options

### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire after each `.set()` call.

## CachedMap#get(key)

Returns the cached value of `key` if it exists and hasn't expired, returns `undefined` otherwise.

```js
const cache = new CachedMap('users');
const user = await cache.get('sindresorhus');
// It will be `undefined` if it's not found.
```

## CachedMap#set(key, value)

Caches the value for the amount of time specified in the `CachedMap` constructor. It returns the value itself.

```js
const cache = new CachedMap('users');
const user = await getUser('sindresorhus');
await cache.set('sindresorhus', user); // Cached for 30 days by default
```

## value

Type: `JsonValue | undefined` (any value that can be serialized as JSON, or `undefined`)

## CachedMap#has(key)

Checks whether the item is in the cache, returns a `boolean`.

```js
const cache = new CachedMap('users');
const isCached = await cache.has('sindresorhus');
// true or false
```

## CachedMap#delete(key)

Deletes the requested item from the cache.

```js
const cache = new CachedMap('users');

await cache.set('sindresorhus', user);
console.log(await cache.has('sindresorhus')); // true

await cache.delete('sindresorhus');
console.log(await cache.has('sindresorhus')); // false
```

## License

MIT © [Federico Brigante](https://fregante.com)
