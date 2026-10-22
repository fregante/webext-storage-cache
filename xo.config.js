/**
@type {import('xo').FlatXoConfig}
*/
const xoConfig = [
	{
		// `test-utils.js` is a helper, not a test file
		files: ['source/**/*.test.*'],
		rules: {
			'node-test/no-import-test-files': 'off',
		},
	},
	{
		languageOptions: {
			globals: {
				chrome: true,
			},
		},
		rules: {
			'import-x/extensions': 'off',
		},
	},
];

export default xoConfig;
