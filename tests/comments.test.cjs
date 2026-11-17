const { test, assert, vm, ts, read, load, mainFunction } = require('./helpers.cjs');

test('comments use the current track and the native shortcut, with a song detail fallback', () => {
	let songId = '12', closed = 0, clicked = 0, route;
	const target = {};
	let buttons = [target];
	const open = mainFunction('openCommentsFromNativeUI', {
		getPlayingSongId: () => songId,
		document: { querySelectorAll: () => buttons },
		getElementDescriptor: () => '查看评论',
		closeRnpLyricPage: () => closed++,
		invokeReactJumpHandler: () => { clicked++; return true; },
		navigateWithinApp: (href) => { route = href; return true; },
	});
	assert.equal(open(), true);
	assert.equal(clicked, 1);
	assert.equal(closed, 1);
	buttons = [];
	songId = '34';
	open();
	assert.equal(route, '#/m/song/?id=34');
	songId = 'local-file';
	assert.equal(open(), false);
});
