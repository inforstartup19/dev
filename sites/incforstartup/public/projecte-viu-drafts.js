(function(root){
 const key='quelcom.project-drafts.v1';
 function open(storage){let baseline=null,data=Object.create(null),blocked=false,failed=false;
 try{baseline=storage.getItem(key);if(baseline){const parsed=JSON.parse(baseline);if(!parsed||parsed.version!==1||!parsed.forms||typeof parsed.forms!=='object'||Array.isArray(parsed.forms))throw Error('invalid');for(const [id,fields] of Object.entries(parsed.forms)){if(!fields||typeof fields!=='object'||Array.isArray(fields))continue;data[id]=Object.fromEntries(Object.entries(fields).filter(([name,value])=>['title','question','intention','origin','task','criterion','result','evidence','reason','decision','needs'].includes(name)&&typeof value==='string').map(([name,value])=>[name,value.slice(0,3000)]));}}}catch{blocked=true;}
 function flush(){try{if(blocked||storage.getItem(key)!==baseline)throw Error('conflict');const raw=JSON.stringify({version:1,forms:data});storage.setItem(key,raw);baseline=raw;failed=false;return true}catch{failed=true;return false}}
 return {get(id){return data[id]||{}},all(){return JSON.parse(JSON.stringify(data))},set(id,name,value){data[id]||=Object.create(null);data[id][name]=String(value).slice(0,3000);return flush()},clear(id){delete data[id];return flush()},unsafe(){return failed||blocked},count(){return Object.keys(data).length}};
 }
 const api={open,key};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuelcomDrafts=api;
})(typeof window==='undefined'?globalThis:window);
