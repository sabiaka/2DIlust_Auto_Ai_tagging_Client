const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const settings = require('../js/connection-settings');
const source = fs.readFileSync(path.join(__dirname, '../js/plugin.js'), 'utf8');

async function run(config, expectedTransport, failure = null) {
    let captured, saved = false;
    const logs = [];
    const request = transport => ({
        request(options, callback) {
            assert.equal(transport, expectedTransport);
            captured = options;
            const req = new EventEmitter();
            req.callback = callback;
            req.destroy = () => {};
            return req;
        }
    });
    class Form {
        append() {}
        getHeaders() { return {'content-type':'multipart/form-data; boundary=test'}; }
        pipe(req) {
            queueMicrotask(() => {
                const response = new EventEmitter(); response.statusCode = failure === 'http' ? 401 : 200;
                req.callback(response);
                response.emit('data', JSON.stringify(failure === 'http' ? {detail:'Unauthorized'} : {tags:['タグ']})); response.emit('end');
            });
        }
    }
    const elements = new Map();
    const document = {getElementById(id) {
        if (!elements.has(id)) elements.set(id, {style:{},classList:{add(){},remove(){}},addEventListener(){},value:''});
        return elements.get(id);
    }};
    const context = vm.createContext({
        require(name) {
            if (name==='fs') return {readFileSync:() => {
                if (failure === 'file') throw new Error('ENOENT test image');
                return Buffer.from('test image');
            }};
            if (name==='http' || name==='https') return request(name);
            if (name==='form-data') return Form;
            return require(name);
        },
        window:{aiTaggerConnectionSettings:settings,addEventListener(){},appendToLog(message){logs.push(message);}},
        document, localStorage:{getItem:() => JSON.stringify(config)}, log(){},
        eagle:{item:{getSelected:async () => [{name:'test.png',ext:'png',filePath:'test.png',tags:[],save:async () => {saved=true;}}]}},
        console:{log(){}},setTimeout,Buffer,
    });
    vm.runInContext(source,context);
    await vm.runInContext('runAiTagging()',context);
    assert.equal(vm.runInContext('isTagging',context),false);
    assert.equal(logs.some(message => message.includes('ext is not defined')),false);
    if (failure === 'file') {
        assert.equal(saved,false);
        assert.ok(logs.some(message => message.includes('ENOENT test image')));
        return;
    }
    assert.equal(captured.hostname,config.host);
    assert.equal(captured.port,config.port);
    assert.equal(captured.path,'/tag');
    assert.equal(captured.headers['content-type'],'multipart/form-data; boundary=test');
    assert.equal(captured.headers.Authorization,config.token ? 'Bearer '+config.token : undefined);
    assert.equal(saved,!failure);
    if (failure === 'http') assert.ok(logs.some(message => message.includes('Unauthorized')));
}
(async () => {
    await run({host:'example.trycloudflare.com',port:443,protocol:'https:',token:'test-token'},'https');
    await run({host:'127.0.0.1',port:8000},'http');
    await run({host:'example.trycloudflare.com',port:443,protocol:'https:',token:'test-token'},'https','http');
    await run({host:'127.0.0.1',port:8000},'http','file');
    console.log('Client job selects HTTPS + bearer token; legacy HTTP still saves returned tags.');
})().catch(error => { console.error(error); process.exitCode=1; });

