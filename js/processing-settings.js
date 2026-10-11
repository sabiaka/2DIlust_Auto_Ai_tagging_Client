const KEY = 'ai-tagger.processing.v1';
function load(storage) {
    try {
        const data = JSON.parse(storage.getItem(KEY)) || {};
        return { gpu: data.gpu === 'L4' ? 'L4' : 'T4', batch: data.batch === true, batchSize: [4,8,12].includes(data.batchSize) ? data.batchSize : 4 };
    } catch { return {gpu:'T4',batch:false,batchSize:4}; }
}
function save(storage, config) {
    if (!['T4','L4'].includes(config.gpu) || ![4,8,12].includes(Number(config.batchSize))) throw Error('処理設定が不正です。');
    const value={gpu:config.gpu,batch:Boolean(config.batch),batchSize:Number(config.batchSize)};
    storage.setItem(KEY,JSON.stringify(value));return value;
}
module.exports={load,save};
