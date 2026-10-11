const http=require('http'),https=require('https'),FormData=require('form-data');
const TYPES={jpg:'image/jpeg',jpeg:'image/jpeg',jfif:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',psd:'image/vnd.adobe.photoshop'};
async function fill({items,start,size,destination,cache,readFile}) {
    const group=[];let bytes=0;
    for(let i=start;i<items.length&&i<start+size;i++) {
        const item=items[i],type=TYPES[item.ext.toLowerCase()];if(!type)break;
        let buffer;
        try{buffer=readFile(item.filePath);if(!buffer.length)throw Error('空の画像ファイルです。');}
        catch(error){cache.set(i,error);continue;}
        if(bytes+buffer.length>32*1024*1024)break;
        bytes+=buffer.length;group.push({index:i,id:String(i)+'.'+item.ext,buffer,type});
    }
    if(!group.length)return;
    const form=new FormData();for(const file of group)form.append('files',file.buffer,{filename:file.id,contentType:file.type});
    const result=await new Promise((resolve,reject)=>{
        const request=(destination.protocol==='https:'?https:http).request({hostname:destination.host,port:destination.port,path:'/tag-batch',method:'POST',headers:{...form.getHeaders(),...(destination.token?{Authorization:'Bearer '+destination.token}:{})},timeout:180000},response=>{
            const chunks=[];response.on('data',chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)));response.on('error',reject);
            response.on('end',()=>{try{if(response.statusCode<200||response.statusCode>=300)throw Object.assign(Error('HTTPエラー: '+response.statusCode),{statusCode:response.statusCode});resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch(error){reject(error)}});
        });request.on('error',reject);request.on('timeout',()=>request.destroy(Object.assign(Error('バッチ通信がタイムアウトしました。'),{code:'ETIMEDOUT'})));form.pipe(request);
    });
    if(!Array.isArray(result.items)||result.items.length!==group.length)throw Error('バッチ結果の件数が不正です。');
    const byId=new Map(result.items.map(row=>[row.id,row]));
    if(byId.size!==group.length||group.some(file=>!byId.has(file.id)))throw Error('バッチ結果と画像の対応が不正です。');
    for(const file of group){const row=byId.get(file.id);cache.set(file.index,row.error?Error(row.error):row.tags);}
}
module.exports={fill};
