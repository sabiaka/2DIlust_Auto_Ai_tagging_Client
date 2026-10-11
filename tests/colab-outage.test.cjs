const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {EventEmitter}=require('node:events');
const settings=require('../js/connection-settings');
const source=fs.readFileSync(path.join(__dirname,'../js/plugin.js'),'utf8');
async function scenario({persistent=false,recoveryFails=false,automatic=true,network=false,status=530,failuresBeforeSuccess=1,eachItemFailsOnce=false}={}) {
    let requests=0,recoveries=0; const uploads=[],destinations=[],saved=[],logs=[];
    const initial={host:'old.trycloudflare.com',port:443,protocol:'https:',token:'old-token'};
    const updated={...initial,host:'new.trycloudflare.com',token:'new-token'};
    const manager={enabled:()=>automatic,sync:()=>initial,ensure:async(options)=>{recoveries++;if(recoveries>1&&!network)assert.equal(options.forceRestart,true);if(recoveryFails&&recoveries>1)throw Error('Recovery failed');return recoveries>1?updated:initial}};
    const transport={request(options,callback){destinations.push(options);const req=new EventEmitter();req.destroy=()=>{};req.callback=callback;return req}};
    const uploadCounts=new Map();
    class Form {
        append(key,bytes,options){this.filename=options.filename}
        getHeaders(){return {}}
        pipe(req){uploads.push(this.filename);requests++;const count=(uploadCounts.get(this.filename)||0)+1;uploadCounts.set(this.filename,count);const failed=persistent||(eachItemFailsOnce?count===1:requests<=failuresBeforeSuccess);queueMicrotask(()=>{
            if(failed&&network){req.emit('error',Object.assign(Error('DNS unavailable'),{code:'ENOTFOUND'}));return}
            const response=new EventEmitter();response.statusCode=failed?status:200;req.callback(response);
            response.emit('data',failed?'<html>Unavailable</html>':JSON.stringify({tags:['tag']}));response.emit('end');
        })}
    }
    const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,{style:{},textContent:'',classList:{add(){},remove(){}}});return elements.get(id)}};
    const names=eachItemFailsOnce?['one.png','two.png','three.png','four.png']:['one.png','two.png','three.png'];
    const items=names.map(name=>({name,ext:'png',filePath:name,tags:[],save:async()=>saved.push(name)}));
    const context=vm.createContext({require(name){if(name.endsWith('colab-manager.js'))return {createManager:()=>manager};if(name==='fs')return {readFileSync:()=>Buffer.from('image')};if(name==='form-data')return Form;if(name==='http'||name==='https')return transport;return require(name)},
        __dirname:path.join(__dirname,'..'),window:{aiTaggerConnectionSettings:settings,addEventListener(){},appendToLog:message=>logs.push(message)},document,
        localStorage:{getItem:()=>JSON.stringify(initial)},eagle:{item:{getSelected:async()=>items}},console:{log(){}},Buffer,setTimeout});
    vm.runInContext(source,context);await vm.runInContext('runAiTagging()',context);
    assert.equal(vm.runInContext('isTagging',context),false);
    if(persistent||recoveryFails||!automatic){
        assert.deepEqual(saved,[]);
        assert.equal(requests,persistent&&automatic?4:1,'Stop before sending subsequent items');
        if(persistent&&automatic)assert.ok(logs.some(line=>line.includes('3回復旧')));
        assert.ok(logs.some(line=>line.includes('タグ付けを停止しました')));
        assert.ok(!logs.some(line=>line.includes('ぜんぶ終わった')));
    } else {
        assert.deepEqual(uploads,eachItemFailsOnce?names.flatMap(name=>[name,name]):[...Array(failuresBeforeSuccess+1).fill('one.png'),'two.png','three.png']);
        assert.deepEqual(saved,names);
        assert.equal(recoveries,eachItemFailsOnce?5:1+failuresBeforeSuccess);
        assert.equal(destinations[1].hostname,updated.host);
        assert.equal(destinations[1].headers.Authorization,'Bearer new-token');
    }
}
(async()=>{await scenario();await scenario({status:502});await scenario({status:502,failuresBeforeSuccess:2});await scenario({status:502,eachItemFailsOnce:true});await scenario({status:502,persistent:true});await scenario({network:true});await scenario({persistent:true});await scenario({recoveryFails:true});await scenario({automatic:false});console.log('Mid-job outage: repeated 502 retry, independent later recoveries, force restart and three attempts per image verified.');})().catch(error=>{console.error(error);process.exitCode=1});
