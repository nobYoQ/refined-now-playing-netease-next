const { test, assert, vm, ts, read, load, mainFunction } = require('./helpers.cjs');

test('new JSON credits remain readable, with timestamps and ordinary lyrics intact', () => {
	const { parsePureLyric, parseLyric } = load('src/liblyric/index.ts');
	const credit = JSON.stringify({ t: 1200, c: [{ tx: '编曲 : ' }, { tx: '作者甲', or: 'orpheus://nm/artist/home?id=12&type=artist' }] });
	const result = parsePureLyric(`${credit}\n[00:03.000]正文\n[00:04.00]{"c":[{"tx":"作曲 : 作者乙"}]}`);
	assert.equal(result[0].time, 1200);
	assert.equal(result[0].lyric, '编曲 : 作者甲');
	assert.equal(result[1].lyric, '正文');
	assert.equal(result[2].time, 4000);
	assert.equal(result[2].lyric, '作曲 : 作者乙');
	const parsed = parseLyric(`${credit}\n[00:03.000]正文`, '[00:03.000]译文');
	assert.ok(parsed.some((line) => line.originalLyric === '正文' && line.translatedLyric === '译文'));
	assert.ok(parsed.every((line) => !line.originalLyric.includes('"c"')));
	assert.equal(parsePureLyric('[00:02]{oops}')[0].lyric, '{oops}');
	const karaoke = parseLyric('[00:03]正文', '', '', `${credit}\n[3000,1000](3000,1000,0)正文`);
	assert.ok(karaoke.some((line) => line.originalLyric === '编曲 : 作者甲'));
	assert.ok(karaoke.some((line) => line.dynamicLyric?.[0]?.word === '正文'));
});
