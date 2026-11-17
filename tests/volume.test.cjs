const { test, assert, vm, ts, read, load, mainFunction } = require('./helpers.cjs');

const volumeFixture = () => {
	const settings = new Map([['NM_SETTING_PLAYER', JSON.stringify({ volume: 0.4, unrelated: true })]]);
	const commands = [], events = [];
	let slider = null;
	const api = load('src/player-volume.js', {
		document: { querySelector: () => slider },
		localStorage: { getItem: (key) => settings.get(key), setItem: (key, value) => settings.set(key, value) },
		window: { dispatchEvent: (event) => events.push(event) },
		CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
		channel: { call: (...args) => commands.push(args) },
	});
	return { api, settings, commands, events, setSlider: (next) => { slider = next; } };
};

test('volume fallback persists settings, preserves other settings and accepts external changes', () => {
	const { api, settings, commands, events } = volumeFixture();
	assert.equal(api.getCurrentVolumeFromPlayer(), 0.4);
	api.setPlayerVolume(0.72);
	assert.equal(commands[0][0], 'audioplayer.setVolume');
	assert.equal(commands[0][2][2], 0.72);
	assert.equal(api.getCurrentVolumeFromPlayer(), 0.72);
	assert.equal(JSON.parse(settings.get('NM_SETTING_PLAYER')).unrelated, true);
	assert.equal(events[0].detail, 0.72);
	settings.set('NM_SETTING_PLAYER', '{"volume":0.23}');
	assert.equal(api.getCurrentVolumeFromPlayer(), 0.23);
	assert.equal(api.getVolumeFromEventArgs('track-id', { volume: 0.31 }), 0.31);
	assert.equal(api.getVolumeFromEventArgs(null, false, ''), null);
	assert.equal(api.normalizeVolumeValue(undefined), null);
	assert.equal(api.getVolumeFromEventArgs({ detail: 0 }), 0);
});

test('native controlled volume slider is updated through its own handler', () => {
	const fixture = volumeFixture();
	let current = 45;
	const props = { max: 100, value: current, onChange: (value) => { current = value; props.value = value; } };
	fixture.setSlider({
		__reactFiber$test: { memoizedProps: {}, return: { memoizedProps: props } },
		getAttribute: (name) => name === 'aria-valuenow' ? String(current) : name === 'aria-valuemax' ? '100' : null,
	});
	assert.equal(fixture.api.getCurrentVolumeFromPlayer(), 0.45);
	fixture.api.setPlayerVolume(0.63);
	assert.equal(current, 63);
	assert.equal(fixture.commands.length, 0);
	assert.equal(fixture.api.getCurrentVolumeFromPlayer(), 0.63);
	current = 18;
	assert.equal(fixture.api.getCurrentVolumeFromPlayer(), 0.18);
	delete props.max; // Some native sliders expose their default max only in ARIA.
	fixture.api.setPlayerVolume(0.51);
	assert.equal(current, 51);
});
