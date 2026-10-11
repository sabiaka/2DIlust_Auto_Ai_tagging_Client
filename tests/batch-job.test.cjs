const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const settings=require('../js/connection-settings');
const source=fs.readFileSync(path.join(__dirname,'../js/plugin.js'),'utf8');
let fills=0,recoveries=0;const saved=[],backups=[];
const items=[0,1,2].map(i=>({id:String(i),name:i+'.jpg',ext:'jpg',filePath:i+'.jpg',tags:['既存','壊れ�'],save:async()=>saved.push(i)}));
const initial={host:'old.trycloudflare.com',protocol:'https:',port:443,token:'old'};
const updated={...initial,host:'new.trycloudflare.com',token:'new'};
const elements=new Map(),document={getElementById(id){if(!elements.has(id))elements.set(id,{style:{},textContent:'',classList:{add(){},remove(){}}});return elements.get(id)}};
class Form {append(){} getHeaders(){return {}}}
const context=vm.createContext({__dirname:path.join(__dirname,'..'),Buffer,setTimeout,console:{log(){}},document,
    localStorage:{getItem:key=>key==='ai-tagger.processing.v1'?JSON.stringify({gpu:'L4',batch:true,batchSize:4}):key==='ai-tagger.repair-mojibake.v1'?'true':JSON.stringify(initial)},
    window:{aiTaggerConnectionSettings:settings,addEventListener(){},appendToLog(){}},eagle:{item:{getSelected:async()=>items}},
    require(name){
        if(name.endsWith('colab-manager.js'))return {createManager:()=>({enabled:()=>true,sync:()=>initial,ensure:async options=>{assert.equal(options.gpu,'L4');recoveries++;if(recoveries>1)assert.equal(options.forceRestart,true);return recoveries===1?initial:updated}})};
        if(name.endsWith('batch-request.js'))return {fill:async({cache,destination})=>{fills++;if(fills===1)throw Object.assign(Error('HTTP 502'),{statusCode:502});assert.equal(destination.host,updated.host);cache.set(0,['新タグ0']);cache.set(1,Error('bad image'));cache.set(2,['新タグ2'])}};
        if(name==='fs')return {readFileSync:()=>Buffer.from('image'),mkdirSync(){},appendFileSync(file,data){backups.push(JSON.parse(data))}};
        if(name==='form-data')return Form;
        if(name==='http'||name==='https')return {request(){throw Error('Cached batch results must not be sent again')}};
        return require(name);
    }});
vm.runInContext(source,context);
vm.runInContext('runAiTagging()',context).then(()=>{
    assert.deepEqual(saved,[0,2]);assert.deepEqual(Array.from(items[0].tags),['既存','新タグ0']);assert.deepEqual(items[1].tags,['既存','壊れ�']);assert.deepEqual(Array.from(items[2].tags),['既存','新タグ2']);assert.equal(backups.length,2);assert.equal(fills,2);assert.equal(recoveries,2);console.log('Batch job: L4 recovery, correct per-image saves, partial failure and repair backups verified.');
}).catch(error=>{console.error(error);process.exitCode=1});
