_Go back to the [main documentation page.](../readme.md#api)_

# new CacheItem(key, options)

This class lets you manage a specific value in the cache, preserving its type if you're using TypeScript:

```js
import {CacheItem} from 'webext-storage-cache';

const url = new CacheItem('cached-url');

// Or in TypeScript
const url = new CacheItem<string>('cached-url');
```

> **Note**:
> The name is unique but `webext-storage-cache` doesn't save you from bad usage. Avoid reusing the same key across the extension with different values, because it will cause conflicts:

```ts
const starNames = new CacheItem<string[]>('stars', {days: 1});
const starCount = new CacheItem<number>('stars'); // Bad: they will override each other
```

## key

Type: string

The unique name that will be used in `chrome.storage.local` as `cache:${key}`

## options

### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire after being each `.set()` call.

# CacheItem#get()

Returns the cached value of key if it exists and hasn't expired, returns `undefined` otherwise.

```js
const cache = new CacheItem('cached-url');
const url = await cache.get();
// It will be `undefined` if it's not found.
```

# CacheItem#set(value)

Caches the value for the amount of time specified in the `CacheItem` constructor. It returns the value itself.

```js
const cache = new CacheItem('core-info');
const info = await getInfoObject();
await cache.set(info); // Cached for 30 days by default
```

## value

Type: `string | number | boolean` or `array | object` of those three types.

`undefined` will remove the cached item. For this purpose it's best to use [`CacheItem#delete()`](#cacheitem-delete) instead

# CacheItem#isCached()

Checks whether the item is in the cache, returns a `boolean`.

```js
const url = new CacheItem('url');
const isCached = await url.isCached();
// true or false
```

# CacheItem.delete()

Deletes the requested item from the cache.

```js
const url = new CacheItem('url');

await url.set('https://github.com');
console.log(await url.isCached()); // true

await url.delete();
console.log(await url.isCached()); // false
```

## License

MIT © [Federico Brigante](https://fregante.com)
