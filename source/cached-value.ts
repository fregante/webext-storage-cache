import {CachedMap} from './cached-map.js';

export default class CachedValue<Value> extends CachedMap<Value> {
	protected override getStorageKey(): string {
		return this.name;
	}

	get(): Promise<Value | undefined> {
		return super.get('');
	}

	set(value: Value): Promise<Value> {
		return super.set('', value);
	}

	delete(): Promise<void> {
		return super.delete('');
	}

	isCached(): Promise<boolean> {
		return super.isCached('');
	}
}