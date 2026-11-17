const { test, assert, vm, ts, read, load, mainFunction } = require('./helpers.cjs');

const volumeFixture = ({ native = false, initialVolume = 0.52 } = {}) => {
	const settings = new Map([['NM_SETTING_PLAYER', JSON.stringify({ volume: 0.14, unrelated: true })]]);
	const commands = [], events = [], actions = [], listeners = new Set();
	let state = { playing: { playingVolume: initialVolume } };
	const setNativeVolume = (volume) => {
		state = { playing: { playingVolume: volume } };
		listeners.forEach((listener) => listener());
	};
	const store = {
		getState: () => state,
		subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
		dispatch: (action) => {
			actions.push(action);
			if (action.type === 'playing/setVolume') setNativeVolume(action.payload.volume);
		},
	};
	const compat = load('src/ncm-compat.js', {
		document: { getElementById: () => native ? {
			_reactRootContainer: { _internalRoot: { current: { child: { child: { memoizedProps: { store } } } } } },
		} : null },
	});
	const api = load('src/player-volume.js', {
		require: () => compat,
		localStorage: { getItem: (key) => settings.get(key), setItem: (key, value) => settings.set(key, value) },
		window: { dispatchEvent: (event) => events.push(event) },
		CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
		channel: { call: (...args) => commands.push(args) },
	});
	return { api, settings, commands, events, actions, listeners, setNativeVolume };
};

test('v3 volume uses live store state even when the native popover is absent and storage is stale', () => {
	const { api, settings, setNativeVolume } = volumeFixture({ native: true });
	assert.equal(JSON.parse(settings.get('NM_SETTING_PLAYER')).volume, 0.14);
	assert.equal(api.getCurrentVolumeFromPlayer(), 0.52);
	setNativeVolume(0);
	assert.equal(api.getCurrentVolumeFromPlayer(), 0);
	setNativeVolume(1);
	assert.equal(api.getCurrentVolumeFromPlayer(), 1);
});

test('lyric volume dispatches the same action as the native slider and avoids a separate backend write', () => {
	const { api, actions, commands, settings } = volumeFixture({ native: true });
	assert.equal(api.setPlayerVolume(0.63), true);
	assert.equal(actions.length, 1);
	assert.equal(actions[0].type, 'playing/setVolume');
	assert.equal(actions[0].payload.volume, 0.63);
	assert.equal(commands.length, 0);
	assert.equal(api.getCurrentVolumeFromPlayer(), 0.63);
	assert.equal(JSON.parse(settings.get('NM_SETTING_PLAYER')).volume, 0.14);
});

test('external volume changes sync immediately and subscriptions are released', () => {
	const { api, setNativeVolume, listeners } = volumeFixture({ native: true });
	const values = [];
	const unsubscribe = api.subscribePlayerVolume((value) => values.push(value));
	setNativeVolume(0.27);
	setNativeVolume(0.27); // Unrelated store updates must not notify the UI again.
	setNativeVolume(0);
	assert.deepEqual(values, [0.27, 0]);
	assert.equal(listeners.size, 1);
	unsubscribe();
	setNativeVolume(0.82);
	assert.deepEqual(values, [0.27, 0]);
	assert.equal(listeners.size, 0);
});

test('volume fallback persists settings, preserves other settings and accepts external changes', () => {
	const { api, settings, commands, events } = volumeFixture();
	assert.equal(api.getCurrentVolumeFromPlayer(), 0.14);
	assert.equal(api.subscribePlayerVolume(() => {}), null);
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
