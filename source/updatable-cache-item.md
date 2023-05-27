_Go back to the [main documentation page.](../readme.md#api)_

# UpdatableCacheItem(key, options)

You can think of `UpdatableCacheItem` as an advanced "memoize" function that you can call with any arguments, but also:

- verify whether a specific set of arguments is cached (`.isCached()`)
- only get the cached value if it exists (`.getCached()`)
- only get the fresh value, skipping the cache (but still caching the result) (`.getFresh()`)
- delete a cached value (`.delete()`)

## key

Type: string

The unique name that will be used in `chrome.storage.local` combined with the function arguments, like `cache:${key}:{arguments}`.

For example, these two calls:

```js
const pages = new UpdatableCacheItem('pages', {updater: fetchText});

await pages.get();
await pages.get('./contacts');
await pages.get('./about', 2);
```

Will create two items in the cache:

```json
{
	"cache:pages": "You're on the homepage",
	"cache:pages:[\"./contacts\"]": "You're on the contacts page",
	"cache:pages:[\"./about\",2]": "You're on the about page"
}
```

## options

### updater

Required. <br>
Type: `async function` that returns a cacheable value.

Returning `undefined` will delete the item from the cache.

### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire after being each `.set()` call.

### staleWhileRevalidate

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 0}` (disabled)

Specifies how much longer an item should be kept in cache after its expiration. During this extra time, the item will still be served from cache instantly, but `updater` will be also called asynchronously to update the cache. A later call will return the updated and fresher item.

```js
const operate = new UpdatableCacheItem('posts', {
	updater: operate,
	maxAge: {
		days: 10,
	},
	staleWhileRevalidate: {
		days: 2,
	},
});

await operate.get(); // It will run `operate` and cache it for 10 days
await operate.get(); // It will return the cache

/* 3 days later, cache is expired, but still there */

await operate.get(); // It will return the cache
// Asynchronously, it will also run `operate` and cache the new value for 10 more days

/* 13 days later, cache is expired and deleted */

await operate.get(); // It will run `operate` and cache it for 10 days
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

const content = new UpdatableCacheItem('content', {
	updater: getContent,

	// If it's a string, it's in the old format and a new value will be fetched and cached
	shouldRevalidate: cachedValue => typeof cachedValue === 'string',
});

const json = await content.get('https://google.com');
// Even if it's cached as a regular string, the cache will be discarded and `getContent` will be called again
```

### cacheKey

Type: `(args: any[]) => string`
Default: `JSON.stringify`

By default, the function’s `arguments` JSON-stringified array will be used to create the cache key.

```js
const posts = new UpdatableCacheItem('posts', {updater: fetchPosts});
const user = {id: 123, name: 'Fregante'};
await posts.get(user);
// Its result will be stored in the key 'cache:fetchPosts:[{"id":123,name:"Fregante"}]'
```

You can pass a `cacheKey` function to customize how the key is generated, saving storage and making it more sensible:

```js
const posts = new UpdatableCacheItem('posts', {
	updater: fetchPosts,
	cacheKey: (args) => args[0].id, // ✅ Use only the user ID
});

const user = {id: 123, name: 'Fregante'};
await posts.get(user);
// Its result will be stored in the key 'cache:fetchPosts:123'
```

## License

MIT © [Federico Brigante](https://fregante.com)
