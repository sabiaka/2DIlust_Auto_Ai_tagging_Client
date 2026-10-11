const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {EventEmitter}=require('node:events');
const settings=require('../js/connection-settings');
const source=fs.readFileSync(path.join(__dirname,'../js/plugin.js'),'utf8');
async function run({mode=true,tags=['正常な新タグ'],saveFails=false,backupFails=false}={}) {
    const sent=[],saved=[],backups=[],logs=[];
    const items=[
        {id:'a',name:'broken.png',ext:'png',tags:['正常な既存タグ','ウマ娘���']},
        {id:'b',name:'failed.png',ext:'png',tags:['保持するタグ','ウサギ耳��']},
        {id:'c',name:'clean.png',ext:'png',tags:['正常なタグ']},
        {id:'d',name:'video.mp4',ext:'mp4',tags:['動画��']},
    ];
    for(const item of items){item.filePath=item.name;item.save=async()=>{if(saveFails)throw Error('save failed');saved.push(item.name)}}
    const originals=items.map(item=>[...item.tags]);
    const transport={request(options,callback){const request=new EventEmitter();request.callback=callback;request.destroy=()=>{};return request}};
    class Form {
        append(key,data,options){this.name=options.filename}
        getHeaders(){return {}}
        pipe(request){sent.push(this.name);queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=this.name==='failed.png'?400:200;request.callback(response);response.emit('data',Buffer.from(JSON.stringify(response.statusCode===200?{tags}:{detail:'bad image'})));response.emit('end')})}
    }
    const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,{style:{},textContent:'',classList:{add(){},remove(){}}});return elements.get(id)}};
    const context=vm.createContext({require(name){
        if(name==='fs')return {readFileSync:()=>Buffer.from('image'),mkdirSync(){},appendFileSync(file,data){if(backupFails)throw Error('backup failed');backups.push(JSON.parse(data))}};
        if(name.endsWith('colab-manager.js'))return {createManager:()=>({enabled:()=>false})};
        if(name==='form-data')return Form;if(name==='http'||name==='https')return transport;return require(name);
    },__dirname:path.join(__dirname,'..'),localStorage:{getItem:key=>key==='ai-tagger.repair-mojibake.v1'?String(mode):null},
        window:{aiTaggerConnectionSettings:settings,addEventListener(){},appendToLog:message=>logs.push(message)},document,eagle:{item:{getSelected:async()=>items}},console:{log(){}},Buffer,setTimeout});
    vm.runInContext(source,context);await vm.runInContext('runAiTagging()',context);
    assert.equal(vm.runInContext('isTagging',context),false);
    if(mode){
        assert.deepEqual(sent,['broken.png','failed.png'],'Only corrupted images are uploaded');
        assert.deepEqual(items[1].tags,originals[1],'Failed response preserves original tags');
        assert.deepEqual(items[2].tags,originals[2],'Clean image untouched');
        assert.deepEqual(items[3].tags,originals[3],'Videos untouched in image repair mode');
        const valid=Array.isArray(tags)&&tags.length>0&&tags.every(tag=>typeof tag==='string'&&!tag.includes('�'));
        if(valid&&!saveFails&&!backupFails){
            assert.deepEqual(Array.from(items[0].tags),['正常な既存タグ',...tags]);
            assert.deepEqual(backups[0].tags,originals[0]);
            assert.deepEqual(saved,['broken.png']);
        } else {
            assert.deepEqual(Array.from(items[0].tags),originals[0]);
            assert.deepEqual(saved,[]);
        }
    } else {
        assert.equal(sent.length,4);
        assert.ok(items[0].tags.includes('ウマ娘���'),'Normal mode never removes existing tags');
        assert.equal(backups.length,0);
    }
}
(async()=>{await run();await run({tags:[]});await run({tags:['まだ���']});await run({tags:'invalid'});await run({saveFails:true});await run({backupFails:true});await run({mode:false});console.log('Repair mode: image filtering, backup, safe replacement, failed/empty/malformed results, save rollback and normal mode verified.');})().catch(error=>{console.error(error);process.exitCode=1});
