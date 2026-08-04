import {isBackground} from 'webext-detect';
import {deleteWithLogic as clear, init} from './shared.js';

export {default as CachedValue} from './cached-value.js';
export {default as CachedFunction} from './cached-function.js';

export const globalCache = {
	clear,
};

// Automatically clear expired entries every day
if (isBackground()) {
	init();
}
