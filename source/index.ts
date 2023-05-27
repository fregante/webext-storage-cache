import cache from './legacy.js'

export {default as CacheItem} from './cache-item.js';
export {default as UpdatableCacheItem} from './updatable-cache-item.js';

export const globalCache = {
	clear: cache.clear,
}
