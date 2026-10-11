const assert=require('node:assert/strict'),http=require('node:http');
const batch=require('../js/batch-request');
const processing=require('../js/processing-settings');
const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
assert.deepEqual(processing.load(storage),{gpu:'T4',batch:false,batchSize:4});
processing.save(storage,{gpu:'L4',batch:true,batchSize:8});
assert.deepEqual(processing.load(storage),{gpu:'L4',batch:true,batchSize:8});
assert.throws(()=>processing.save(storage,{gpu:'A100',batch:true,batchSize:4}));
let responseMode='success',requests=0;
const server=http.createServer((req,res)=>{requests++;assert.equal(req.url,'/tag-batch');assert.equal(req.headers.authorization,'Bearer test');req.resume();req.on('end',()=>{
    if(responseMode==='outage'){res.writeHead(502);res.end('Bad Gateway');return}
    const rows=responseMode==='bad-id'?[{id:'wrong.jpg',tags:[]}]:[{id:'1.jpg',error:'bad image'},{id:'0.jpg',tags:['日本語😊']}];
    const body=Buffer.from(JSON.stringify({items:rows}));for(const byte of body)res.write(Buffer.from([byte]));res.end();
})});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const destination={host:'127.0.0.1',port:server.address().port,protocol:'http:',token:'test'};
    const items=[0,1].map(i=>({ext:'jpg',filePath:String(i)}));const cache=new Map();
    await batch.fill({items,start:0,size:4,destination,cache,readFile:()=>Buffer.from('image')});
    assert.deepEqual(cache.get(0),['日本語😊']);assert.equal(cache.get(1).message,'bad image');
    responseMode='bad-id';await assert.rejects(batch.fill({items,start:0,size:4,destination,cache:new Map(),readFile:()=>Buffer.from('image')}),/件数|対応/);
    responseMode='outage';await assert.rejects(batch.fill({items,start:0,size:4,destination,cache:new Map(),readFile:()=>Buffer.from('image')}),error=>error.statusCode===502);
    const before=requests;await batch.fill({items:[{ext:'mp4'}],start:0,size:4,destination,cache:new Map(),readFile:()=>{throw Error('Should not read video')}});assert.equal(requests,before);
    console.log('Batch transport: Unicode, reordered IDs, partial failure, outage, video exclusion and settings persistence verified.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
