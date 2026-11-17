const { test, assert, vm, ts, read, load, mainFunction } = require('./helpers.cjs');

test('comments invoke the exact native button before closing the lyric panel', () => {
	let songId = '12';
	const calls = [];
	const target = { testId: 'tid_playbar_comment_btn' };
	const open = mainFunction('openCommentsFromNativeUI', {
		getPlayingSongId: () => songId,
		document: { querySelector: (selector) => {
			assert.equal(selector, 'footer [data-testid="tid_playbar_comment_btn"]');
			return target;
		} },
		getReactProps: (element) => {
			assert.equal(element, target);
			return { onClick: () => calls.push(`comments:${songId}`) };
		},
		createSyntheticNativeEvent: (element) => ({ target: element }),
		closeRnpLyricPage: () => calls.push('close'),
	});
	assert.equal(open(), true);
	assert.deepEqual(calls, ['comments:12', 'close']);
	songId = '34';
	open();
	assert.deepEqual(calls.slice(-2), ['comments:34', 'close']);
	songId = 'local-file';
	assert.equal(open(), false);
});

test('nested comment icon resolves to its button when test IDs are unavailable', () => {
	let clicked = 0;
	const target = { click: () => clicked++ };
	const open = mainFunction('openCommentsFromNativeUI', {
		getPlayingSongId: () => '12',
		document: { querySelector: (selector) => selector.includes('data-testid') ? null : { closest: () => target } },
		getReactProps: () => null,
		closeRnpLyricPage() {},
	});
	assert.equal(open(), true);
	assert.equal(clicked, 1);
});

test('missing or broken native comment handlers keep the lyric panel open', () => {
	const globals = {
		getPlayingSongId: () => '12',
		document: { querySelector: () => null, querySelectorAll: () => [] },
		closeRnpLyricPage: () => assert.fail('Must not close a panel without opening comments'),
		console: { debug() {} },
	};
	assert.equal(mainFunction('openCommentsFromNativeUI', { ...globals })(), false);
	globals.document.querySelector = () => ({});
	globals.getReactProps = () => ({ onClick: () => { throw new Error('Native handler failed'); } });
	globals.createSyntheticNativeEvent = () => ({});
	assert.equal(mainFunction('openCommentsFromNativeUI', { ...globals })(), false);
});
