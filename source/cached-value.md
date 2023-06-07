_Go back to the [main documentation page.](../readme.md#api)_

# new CachedValue(key, options)

This class lets you manage a specific value in the cache, preserving its type if you're using TypeScript:

```js
import {CachedValue} from 'webext-storage-cache';

const url = new CachedValue('cached-url');

// Or in TypeScript
const url = new CachedValue<string>('cached-url');
```

> **Note**:
> The name is unique but `webext-storage-cache` doesn't save you from bad usage. Avoid reusing the same key across the extension with different values, because it will cause conflicts:

```ts
const starNames = new CachedValue<string[]>('stars', {days: 1});
const starCount = new CachedValue<number>('stars'); // Bad: they will override each other
```

## key

Type: string

The unique name that will be used in `chrome.storage.local` as `cache:${key}`

## options

### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire after being each `.set()` call.

# CachedValue#get()

Returns the cached value of key if it exists and hasn't expired, returns `undefined` otherwise.

```js
const cache = new CachedValue('cached-url');
const url = await cache.get();
// It will be `undefined` if it's not found.
```

# CachedValue#set(value)

Caches the value for the amount of time specified in the `CachedValue` constructor. It returns the value itself.

```js
const cache = new CachedValue('core-info');
const info = await getInfoObject();
await cache.set(info); // Cached for 30 days by default
```

## value

Type: `string | number | boolean` or `array | object` of those three types.

`undefined` will remove the cached item. For this purpose it's best to use [`CachedValue#delete()`](#CachedValue-delete) instead

# CachedValue#isCached()

Checks whether the item is in the cache, returns a `boolean`.

```js
const url = new CachedValue('url');
const isCached = await url.isCached();
// true or false
```

# CachedValue.delete()

Deletes the requested item from the cache.

```js
const url = new CachedValue('url');

await url.set('https://github.com');
console.log(await url.isCached()); // true

await url.delete();
console.log(await url.isCached()); // false
```

## License

MIT © [Federico Brigante](https://fregante.com)
