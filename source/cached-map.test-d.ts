import {expectType} from 'tsd';
import CachedMap from './cached-map.js';

const stringMap = new CachedMap<string>('key');

expectType<Promise<string | undefined>>(stringMap.get('key'));
expectType<Promise<string>>(stringMap.set('key', 'value'));
expectType<Promise<void>>(stringMap.delete('key'));
expectType<Promise<boolean>>(stringMap.has('key'));

// Object maps with numbers and strings work fine
const dataMap = new CachedMap<{id: number; name: string}>('data');

expectType<Promise<{id: number; name: string} | undefined>>(dataMap.get('key1'));
expectType<Promise<{id: number; name: string}>>(dataMap.set('key1', {id: 1, name: 'Alice'}));
expectType<Promise<void>>(dataMap.delete('key1'));
expectType<Promise<boolean>>(dataMap.has('key1'));

// @ts-expect-error -- Wrong type for set
void dataMap.set('key1', 'not an object');

// @ts-expect-error -- Missing properties
void dataMap.set('key1', {id: 1});

const mapWithOptions = new CachedMap<string>('key', {
	maxAge: {days: 20},
});

expectType<Promise<string | undefined>>(mapWithOptions.get('key'));
