_Go back to the [main documentation page.](../readme.md#api)_

# memoize(updater, options)

You can think of `memoize` as an advanced memoization utility that returns a callable function with additional methods attached to it:

- call the function and get/cache the value (`.get()` or calling the function directly)
- verify whether a specific set of arguments is cached (`.isCached()`)
- only get the cached value if it exists (`.getCached()`)
- only get the fresh value, skipping the cache (but still caching the result) (`.getFresh()`)
- delete a cached value (`.delete()`)
- override or set a cached value manually (`.setCached()`)

## key

Type: string

The unique name that will be used in `chrome.storage.local` combined with the function arguments, like `cache:${key}:{arguments}`.

For example, these two calls:

```js
const pages = memoize(fetchText, {key: 'pages'});

await pages();
await pages('./contacts');
await pages('./about', 2);
await pages(); // Will be retrieved from cache
```

Will call `fetchText` 3 times and create 3 items in the storage:

```json
{
	"cache:pages": "You're on the homepage",
	"cache:pages:[\"./contacts\"]": "You're on the contacts page",
	"cache:pages:[\"./about\",2]": "You're on the about page"
}
```

## options

### key

Required. <br>
Type: `string`

The unique name used as a namespace in `chrome.storage.local`.

### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire after each cache update.

### staleWhileRevalidate

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 0}` (disabled)

Specifies how much longer an item should be kept in cache after its expiration. During this extra time, the item will still be served from cache instantly, but the updater function will also be called asynchronously to update the cache. A later call will return the updated and fresher item.

```js
const operate = memoize(myOperateFunction, {
	key: 'posts',
	maxAge: {
		days: 10,
	},
	staleWhileRevalidate: {
		days: 2,
	},
});

await operate(); // It will run `myOperateFunction` and cache it for 10 days
await operate(); // It will return the cache

/* 3 days later, cache is expired, but still there */

await operate(); // It will return the cache
// Asynchronously, it will also run `myOperateFunction` and cache the new value for 10 more days

/* 13 days later, cache is expired and deleted */

await operate(); // It will run `myOperateFunction` and cache it for 10 days
```

### shouldRevalidate

Type: `(cachedValue) => boolean`<br>
Default: `() => false`

You may want to have additional checks on the cached value, for example after updating its format.

```js
async function getContent(url) {
	const response = await fetch(url);
	return response.json(); // For example, you used to return plain text, now you return a JSON object
}

const content = memoize(getContent, {
	key: 'content',

	// If it's a string, it's in the old format and a new value will be fetched and cached
	shouldRevalidate: cachedValue => typeof cachedValue === 'string',
});

const json = await content('[https://google.com](https://google.com)');
// Even if it's cached as a regular string, the cache will be discarded and `getContent` will be called again
```

### cacheKey

Type: `(args: any[]) => string`
Default: `JSON.stringify`

By default, the function’s `arguments` JSON-stringified array will be used to create the cache key.

```js
const posts = memoize(fetchPosts, {key: 'posts'});
const user = {id: 123, name: 'Fregante'};
await posts(user);
// Its result will be stored in the key 'cache:posts:[{"id":123,name:"Fregante"}]'
```

You can pass a `cacheKey` function to customize how the key is generated, saving storage and making it more sensible:

```js
const posts = memoize(fetchPosts, {
	key: 'posts',
	cacheKey: (args) => args[0].id, // ✅ Use only the user ID
});

const user = {id: 123, name: 'Fregante'};
await posts(user);
// Its result will be stored in the key 'cache:posts:123'
```

## memoizedFunction(...arguments)

Calling the memoized function directly is equivalent to calling your updater function with the specified parameters, unless the result of a previous call is already in the cache:

```js
const repositories = memoize(repoApi, {key: 'repositories'});
await repositories('fregante', 'doma'); // Will call repoApi('fregante', 'doma')
await repositories('fregante', 'doma'); // Will return the item from the cache
await repositories('fregante', 'webext-base-css'); // Will call repoApi('fregante', 'webext-base-css')
```

## memoizedFunction.getFresh(...arguments)

This updates the cache just like calling the function directly, except it always calls the updater regardless of cache state. It's meant to be used as a "refresh cache" action:

```js
const repositories = memoize(repoApi, {key: 'repositories'});
await repositories('fregante', 'doma'); // Will call repoApi('fregante', 'doma')
await repositories.getFresh('fregante', 'doma'); // Will call repoApi('fregante', 'doma') regardless of cache state
```

## memoizedFunction.getCached(...arguments)

This only returns the value of a previous call with the same arguments, but it never calls your updater:

```js
const repositories = memoize(repoApi, {key: 'repositories'});
await repositories.getCached('fregante', 'doma'); // It can be undefined
```

## memoizedFunction.isCached(...arguments)

```js
const repositories = memoize(repoApi, {key: 'repositories'});
await repositories.isCached('fregante', 'doma');
// => true / false
```

## memoizedFunction.delete(...arguments)

```js
const repositories = memoize(repoApi, {key: 'repositories'});
await repositories.delete('fregante', 'doma');
```

## memoizedFunction.setCached(newValue, ...arguments)

This method should only be used if you want to override the cache with a custom value, but you should prefer calling the function or `getFresh` instead, keeping the logic exclusively in your updater function.

```js
const repositories = memoize(repoApi, {key: 'repositories'});
// Will override the local cache for the `repoApi('fregante', 'doma')` call
await repositories.setCached({id: 134, lastUpdated: 199837738894}, 'fregante', 'doma');
```

## License

MIT © [Federico Brigante](https://fregante.com)
