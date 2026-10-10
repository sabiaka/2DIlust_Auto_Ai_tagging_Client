const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createManager } = require('../js/colab-manager');
const settings = require('../js/connection-settings');
const values = new Map();
const storage = {getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value)};
const root = path.resolve(__dirname);
const config = {helper:path.join(root,'helper.ps1'),connectionFile:path.join(root,'connection.json')};
let calls = 0, fail = false, child;
const messages = [];
const manager = createManager({
    configPath:path.join(root,'colab-auto.json'),storage,settings,
    exists:() => true,
    readFile:file => JSON.stringify(file === config.connectionFile
        ? {url:'https://fresh.trycloudflare.com',token:'private-token'} : config),
    onProgress:message => messages.push(message),
    spawnProcess(executable,args,options) {
        assert.equal(executable,'powershell.exe');
        assert.equal(args.at(-1),config.helper);
        assert.equal(options.windowsHide,true);
        calls++;
        child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill=()=>{};
        setImmediate(() => {
            child.stdout.emit('data',Buffer.from('[colab-auto] Starting T4\nAPI token: private-token\n'));
            child.emit('close',fail ? 1 : 0);
        });
        return child;
    },
});
(async () => {
    assert.equal(manager.enabled(),true);
    const a = manager.ensure(), b = manager.ensure();
    assert.equal(a,b,'Concurrent requests share one recovery');
    const result = await a;
    assert.equal(calls,1);
    assert.equal(result.host,'fresh.trycloudflare.com');
    assert.equal(settings.load(storage).token,'private-token');
    assert.ok(messages.every(message => !message.includes('private-token')));
    manager.setEnabled(false);
    assert.equal(manager.enabled(),false);
    const previous = settings.load(storage);
    fail=true;
    await assert.rejects(manager.ensure(),/自動復旧/);
    assert.deepEqual(settings.load(storage),previous,'Failed recovery preserves previous settings');
    fail=false;
    await manager.ensure();
    assert.equal(calls,3,'A failed recovery allows a later manual retry');
    console.log('Colab auto recovery: settings update, concurrency, privacy and failure checks passed.');
})().catch(error => {console.error(error); process.exitCode=1;});
