const { test, assert, vm, ts, read, load, mainFunction } = require('./helpers.cjs');

test('only a left click on the record opens the lyric page', () => {
	let opened = 0, suppressed = 0;
	let trigger = { matches: () => true };
	const handler = mainFunction('onNativeNowPlayingTriggerEvent', {
		NATIVE_LYRIC_PAGE_BUTTON_SELECTOR: '.miniVinylWrapper',
		getNativeNowPlayingTrigger: () => trigger,
		stopNativeNowPlayingEvent: () => suppressed++,
		openRnpLyricPageFromNativeEvent: () => opened++,
	});
	for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) handler({ type, button: 0 });
	assert.equal(opened, 1);
	assert.equal(suppressed, 5);
	trigger = { matches: () => false }; // Empty footer background is suppressed.
	handler({ type: 'click', button: 0 });
	assert.equal(opened, 1);
	trigger = null; // Playback buttons and song/artist links are left to the host.
	handler({ type: 'click', button: 0 });
	assert.equal(suppressed, 6);
	trigger = { matches: () => true };
	handler({ type: 'click', button: 2 });
	assert.equal(opened, 1);
});
