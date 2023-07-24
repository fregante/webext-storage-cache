// eslint-disable-next-line n/file-extension-in-import -- Export map unsupported
import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		setupFiles: [
			'./vitest.setup.js',
		],
	},
});
