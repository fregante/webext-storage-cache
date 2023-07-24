import chrome from 'sinon-chrome';

globalThis.location = new URL('chrome://1234/_generated_background_page.html');
globalThis.chrome = chrome;
globalThis.window = {};
