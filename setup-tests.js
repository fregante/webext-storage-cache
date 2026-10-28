import {mock} from 'node:test';

/* eslint-disable unicorn/no-global-object-property-assignment, node-test/prefer-context-mock -- Shared by every test, calls are reset in `beforeEach` */
globalThis.chrome = {
	storage: {
		local: {
			get: mock.fn(),
			set: mock.fn(),
			remove: mock.fn(),
			getKeys: mock.fn(),
		},
	},
};
/* eslint-enable unicorn/no-global-object-property-assignment, node-test/prefer-context-mock */
