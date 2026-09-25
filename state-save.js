/* Update a single product; never synchronise unrelated notices or delete media. */
(function(){
 'use strict';
 function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
 }
 const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 async function saveProduct(client,product,previous,storageMap={},key='products'){
  if(!['products','popups'].includes(key))throw new Error('허용하지 않는 저장 항목입니다.');
  const {data:state,error}=await client.from('site_state').select('payload,updated_at').eq('id','main').single();
  if(error)throw error;if(!state?.payload)throw new Error('홈페이지 데이터를 불러오지 못했습니다.');
  const list=[...(state.payload[key]||[])],index=list.findIndex(p=>p.id===product.id);
  if(previous&&!equal(list[index],previous))throw new Error('다른 창에서 제품이 변경되었습니다. 현재 입력 내용을 보관한 뒤 다시 열어 주세요.');
  if(index<0)list.push(product);else list[index]=product;
  const refs=[product.imageBlobId,product.detailImageBlobId,...(product.detailImages||[]).map(x=>x.blobId)].filter(Boolean);
  const media=Object.fromEntries(refs.filter(ref=>storageMap[ref]?.bucket==='site-media').map(ref=>[ref,storageMap[ref]]));
  const payload={...state.payload,[key]:list,settings:{...(state.payload.settings||{}),storageMap:{...(state.payload.settings?.storageMap||{}),...media}}};
  let request=client.from('site_state').update({payload,updated_at:new Date().toISOString()}).eq('id','main');
  request=state.updated_at==null?request.is('updated_at',null):request.eq('updated_at',state.updated_at);
  const {data:rows,error:saveError}=await request.select('id');
  if(saveError)throw saveError;if(!rows?.length)throw new Error('다른 변경이 먼저 저장되었습니다. 다시 저장해 주세요.');
  return payload;
 }
 async function saveSettings(client,settings,keys){
  const {data:state,error}=await client.from('site_state').select('payload,updated_at').eq('id','main').single();
  if(error)throw error;if(!state?.payload)throw new Error('홈페이지 설정을 불러오지 못했습니다.');
  const next={...(state.payload.settings||{})};
  for(const key of keys){if(['__proto__','constructor','prototype'].includes(key))throw new Error('허용하지 않는 설정입니다.');if(Object.hasOwn(settings,key))next[key]=settings[key];}
  next.storageMap={...(next.storageMap||{}),...Object.fromEntries(Object.entries(settings.storageMap||{}).filter(([,v])=>v?.bucket==='site-media'))};
  let request=client.from('site_state').update({payload:{...state.payload,settings:next},updated_at:new Date().toISOString()}).eq('id','main');
  request=state.updated_at==null?request.is('updated_at',null):request.eq('updated_at',state.updated_at);
  const {data:rows,error:writeError}=await request.select('id');if(writeError)throw writeError;if(!rows?.length)throw new Error('다른 설정이 먼저 변경되었습니다. 다시 저장해 주세요.');
  return next;
 }
 async function saveInquiry(client,id,status,memo){
  if(!id||!['신규','확인중','답변완료','보류'].includes(status))throw new Error('문의 상태를 확인해 주세요.');
  const {data:rows,error}=await client.from('inquiries').update({status,memo:memo||''}).eq('id',id).select('id');
  if(error)throw error;if(!rows?.length)throw new Error('문의가 없거나 저장 권한이 없습니다.');
 }
 if(typeof module==='object'&&module.exports){module.exports={saveProduct,saveInquiry,saveSettings,equal};return;}
 window.CHState={saveProduct,saveInquiry,saveSettings,equal};
 window.chSaveProduct=async function(product,previous){
  if(!chRemoteReady||!chSupabase||chProfile?.role!=='admin'||!chProfile?.approved)throw new Error('관리자로 다시 로그인해 주세요.');
  const payload=await saveProduct(chSupabase,product,previous,data.settings?.storageMap||{});
  data.products=payload.products;data.settings.storageMap=payload.settings.storageMap;
  return true;
 };
 window.chSaveSettings=async function(keys){
  try{if(!chRemoteReady||!chProfile?.approved||chProfile.role!=='admin')throw new Error('관리자로 다시 로그인해 주세요.');
   await saveSettings(chSupabase,data.settings,keys);return true;
  }catch(err){console.error(err);toast('설정 저장 실패: '+err.message);return false;}
 };
 window.chSavePopup=async function(item,previous){
  try{if(!chRemoteReady||!chProfile?.approved||chProfile.role!=='admin')throw new Error('관리자로 다시 로그인해 주세요.');
   const next=await saveProduct(chSupabase,item,previous,data.settings.storageMap,'popups');data.popups=next.popups;return true;
  }catch(err){console.error(err);toast('팝업 저장 실패: '+err.message);return false;}
 };
})();
