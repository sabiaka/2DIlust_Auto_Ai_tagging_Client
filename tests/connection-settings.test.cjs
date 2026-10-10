const assert = require('node:assert/strict');
const settings = require('../js/connection-settings');
const values = new Map();
const storage = { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value) };
assert.deepEqual(settings.load(storage), {host:'127.0.0.1',port:8000});
assert.deepEqual(settings.save(storage,' 192.168.1.23 ','9000'), {host:'192.168.1.23',port:9000});
assert.deepEqual(settings.load(storage), {host:'192.168.1.23',port:9000});
assert.equal(settings.format(settings.validate('[::1]',8000)), 'http://[::1]:8000');
assert.equal(settings.validate('tagger.local',8000).host, 'tagger.local');
for (const host of ['','http://192.168.1.23','192.168.1.23/tag','999.1.1.1','bad host']) {
    assert.throws(() => settings.save(storage,host,8000));
}
for (const port of ['','1.5',0,65536,'8000abc']) assert.throws(() => settings.save(storage,'localhost',port));
assert.deepEqual(settings.load(storage), {host:'192.168.1.23',port:9000});
storage.setItem('ai-tagger.connection.v1','broken');
assert.deepEqual(settings.load(storage), {host:'127.0.0.1',port:8000});
assert.throws(() => settings.save({setItem() {throw Error('disk');}},'localhost',8000), /保存できません/);
console.log('Settings validation and persistence checks passed.');
