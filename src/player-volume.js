import { dispatchNCMAction, getNCMStore } from './ncm-compat.js';

// v3's native volume slider reads playing.playingVolume and dispatches playing/setVolume.
export const normalizeVolumeValue = (value) => {
	if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
	const number = Number(value);
	if (!Number.isFinite(number) || number < 0 || number > 100) return null;
	return number > 1 ? number / 100 : number;
};

export const getCurrentVolumeFromPlayer = () => {
	const volume = normalizeVolumeValue(getNCMStore()?.getState?.()?.playing?.playingVolume);
	if (volume !== null) return volume;
	try {
		const settings = JSON.parse(localStorage.getItem('NM_SETTING_PLAYER') || '{}');
		return [settings?.volume, settings?.vol, settings?.volumeValue]
			.map(normalizeVolumeValue).find((value) => value !== null) ?? null;
	} catch {
		return null;
	}
};

export const subscribePlayerVolume = (onChange) => {
	const store = getNCMStore();
	if (!store) return null;
	let currentVolume = getCurrentVolumeFromPlayer();
	return store.subscribe(() => {
		const nextVolume = getCurrentVolumeFromPlayer();
		if (nextVolume !== null && nextVolume !== currentVolume) {
			currentVolume = nextVolume;
			onChange(nextVolume);
		}
	});
};

export const getVolumeFromEventArgs = (...args) => {
	for (const arg of [...args].reverse()) {
		if (arg && typeof arg === 'object') {
			const value = [arg.volume, arg.vol, arg.value, arg.currentVolume, arg.detail]
				.map(normalizeVolumeValue).find((value) => value !== null);
			if (value !== undefined) return value;
		} else {
			const value = normalizeVolumeValue(arg);
			if (value !== null) return value;
		}
	}
	return null;
};

export const setPlayerVolume = (value) => {
	const volume = Math.min(1, Math.max(0, Number(value) || 0));
	if (dispatchNCMAction({ type: 'playing/setVolume', payload: { volume } })) {
		// The host updates the audio backend, both UIs and its persisted setting.
		return true;
	}
	const adapter = window.legacyNativeCmder?._envAdapter;
	if (typeof adapter?.callAdapter === 'function') {
		adapter.callAdapter('audioplayer.setVolume', () => {}, ['', '', volume]);
	} else if (typeof channel !== 'undefined' && typeof channel.call === 'function') {
		channel.call('audioplayer.setVolume', () => {}, ['', '', volume]);
	} else {
		return false;
	}
	// Same-document localStorage writes do not produce a storage event.
	try {
		const settings = JSON.parse(localStorage.getItem('NM_SETTING_PLAYER') || '{}');
		localStorage.setItem('NM_SETTING_PLAYER', JSON.stringify({ ...settings, volume }));
	} catch (error) {
		console.debug('Failed to persist player volume', error);
	}
	window.dispatchEvent(new CustomEvent('rnp-volume-changed', { detail: volume }));
	return true;
};
