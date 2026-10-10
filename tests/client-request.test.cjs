const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const settings = require('../js/connection-settings');
const source = fs.readFileSync(path.join(__dirname, '../js/plugin.js'), 'utf8');

async function run(config, expectedTransport) {
    let captured, saved = false;
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
                const response = new EventEmitter(); response.statusCode = 200;
                req.callback(response);
                response.emit('data', JSON.stringify({tags:['タグ']})); response.emit('end');
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
            if (name==='fs') return {readFileSync:() => Buffer.from('test image')};
            if (name==='http' || name==='https') return request(name);
            if (name==='form-data') return Form;
            return require(name);
        },
        window:{aiTaggerConnectionSettings:settings,addEventListener(){}},
        document, localStorage:{getItem:() => JSON.stringify(config)}, log(){},
        eagle:{item:{getSelected:async () => [{name:'test.png',ext:'png',filePath:'test.png',tags:[],save:async () => {saved=true;}}]}},
        console:{log(){}},setTimeout,Buffer,
    });
    vm.runInContext(source,context);
    await vm.runInContext('runAiTagging()',context);
    assert.equal(captured.hostname,config.host);
    assert.equal(captured.port,config.port);
    assert.equal(captured.path,'/tag');
    assert.equal(captured.headers['content-type'],'multipart/form-data; boundary=test');
    assert.equal(captured.headers.Authorization,config.token ? 'Bearer '+config.token : undefined);
    assert.equal(saved,true);
}
(async () => {
    await run({host:'example.trycloudflare.com',port:443,protocol:'https:',token:'test-token'},'https');
    await run({host:'127.0.0.1',port:8000},'http');
    console.log('Client job selects HTTPS + bearer token; legacy HTTP still saves returned tags.');
})().catch(error => { console.error(error); process.exitCode=1; });

