/* Notice/FAQ detail pages: one-record saves, no schema changes or storage deletion. */
(function(){
 'use strict';
 const LIMIT=20, MAX_BYTES=20*1024*1024;
 function canonical(v){return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;}
 const isImage=a=>/^image\/(jpeg|png|webp|gif)$/.test(a.type||'');
 function validateImages(items){
  if(items.length>LIMIT)throw new Error('상세페이지 이미지는 기존 이미지와 합쳐 최대 20장입니다.');
  for(const a of items){if(!isImage(a))throw new Error('JPG·PNG·WEBP·GIF 이미지만 선택해 주세요.');if(a.size>MAX_BYTES)throw new Error(a.name+': 파일당 20MB 이하로 선택해 주세요.');}
 }
 function mergeRecord(payload,kind,record){
  const key=kind==='notice'?'notices':'faqs', list=[...(payload[key]||[])];
  const i=list.findIndex(x=>x.id===record.id);if(i<0)list.unshift(record);else list[i]=record;
  return {...payload,[key]:list};
 }
 async function saveRecord(client,kind,record,original){
  if(kind==='notice'&&record.type!=='general'){
   const row={id:record.id,type:record.type,title:record.title,content:record.content,pinned:record.pinned,links:record.links,attachments:record.attachments,created_at:record.createdAt,updated_at:new Date().toISOString()};
   const {data:rows,error}=await client.from('secure_notices').upsert(row,{onConflict:'id'}).select('id');
   if(error)throw error;if(!rows?.length)throw new Error('공지 저장 권한을 확인해 주세요.');return;
  }
  const {data:state,error}=await client.from('site_state').select('payload,updated_at').eq('id','main').single();
  if(error)throw error;if(!state?.payload)throw new Error('현재 홈페이지 데이터를 불러오지 못했습니다.');
  const key=kind==='notice'?'notices':'faqs', current=(state.payload[key]||[]).find(x=>x.id===record.id);
  if(original&&JSON.stringify(canonical(current))!==JSON.stringify(canonical(original)))throw new Error('다른 창에서 이 글이 변경되었습니다. 입력 내용을 보관한 뒤 다시 열어 주세요.');
  const payload=mergeRecord(state.payload,kind,record);
  let query=client.from('site_state').update({payload,updated_at:new Date().toISOString()}).eq('id','main');
  query=state.updated_at==null?query.is('updated_at',null):query.eq('updated_at',state.updated_at);
  const {data:rows,error:writeError}=await query.select('id');
  if(writeError)throw writeError;if(!rows?.length)throw new Error('저장 중 다른 변경이 감지되었습니다. 다시 저장해 주세요.');
 }
 if(typeof module==='object'&&module.exports){module.exports={validateImages,mergeRecord,saveRecord};return;}
 const admin=()=>!!(chRemoteReady&&chSupabase&&chProfile?.role==='admin'&&chProfile?.approved);
 let nextDraft=null,activeForm=null;
 const h=esc;
 function formHTML(kind,record={}){
  const original=record.id?JSON.parse(JSON.stringify(record)):null;
  nextDraft={kind,original,record:{...record},items:(record.attachments||[]).map(a=>({...a})),urls:[],busy:false};
  const notice=kind==='notice';
  const fields=notice?`<label>공지 구분<select name="type" ${record.id?'disabled':''}>${Object.entries(NOTICE_TYPES).map(([k,v])=>`<option value="${k}" ${k===(record.type||'general')?'selected':''}>${h(v)}</option>`).join('')}</select></label><label><input name="pinned" type="checkbox" ${record.pinned?'checked':''}> 중요 공지</label><label class="full">제목<input name="title" required maxlength="200" value="${h(record.title||'')}"></label><label class="full">공지 내용 (이미지만 등록해도 됩니다)<textarea name="content" maxlength="100000">${h(record.content||'')}</textarea></label><label class="full">관련 링크 (한 줄에 하나)<textarea name="links">${h((record.links||[]).map(x=>typeof x==='string'?x:x.url||'').join('\n'))}</textarea></label>`:
   `<label>카테고리<input name="category" required maxlength="80" value="${h(record.category||'제품')}" list="contentFaqCategories"><datalist id="contentFaqCategories">${faqCategories().map(c=>`<option value="${h(c)}">`).join('')}</datalist></label><label class="full">질문<input name="question" required maxlength="200" value="${h(record.question||'')}"></label><label class="full">답변 (이미지만 등록해도 됩니다)<textarea name="answer" maxlength="100000">${h(record.answer||'')}</textarea></label>`;
  return `<form class="admin-form content-editor" id="${notice?'contentNoticeForm':'contentFaqForm'}"><fieldset class="full content-fields">${fields}<section class="full content-uploader"><h3>${notice?'공지':'FAQ'} 상세페이지 이미지</h3><label>이미지 선택 · 추가 선택 가능<input type="file" data-detail-files multiple accept="image/jpeg,image/png,image/webp,image/gif"></label><p>기존 이미지와 합쳐 최대 20장 · 파일당 20MB 이하. 표시 순서대로 세로로 이어집니다.</p><p data-detail-count role="status" aria-live="polite"></p><div class="content-file-grid" data-detail-list></div><p>삭제는 목록에서 먼저 제외되며, 저장해야 화면에 반영됩니다. 원본 파일은 보관됩니다.</p></section>${notice?'<label class="full">문서·동영상 추가 첨부<input type="file" data-other-files multiple accept="video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx,.zip"><span>기존 포함 최대 20개 · 파일당 20MB 이하</span></label>':''}<div class="full content-editor-actions"><button class="secondary-admin" type="button" data-detail-preview>상세페이지 미리보기</button><button class="primary-admin" type="submit">저장하고 화면에 반영</button></div></fieldset><p class="full content-save-status" data-save-status role="status" aria-live="polite"></p></form>`;
 }
 noticeForm=n=>formHTML('notice',n);
 faqForm=f=>formHTML('faq',f);
 const oldOpenEditor=openEditor;
 openEditor=function(title,html){
  if(activeForm?._detailState?.busy){toast('저장이 끝날 때까지 기다려 주세요.');return;}
  release(activeForm?._detailState);
  const value=oldOpenEditor(title,html),form=document.querySelector('.content-editor');
  activeForm=form;if(form){form._detailState=nextDraft;nextDraft=null;renderFiles(form);}return value;
 };
 function release(state){if(state)state.urls.splice(0).forEach(URL.revokeObjectURL);}
 function status(form,message,error=false){const el=form.querySelector('[data-save-status]');el.textContent=message;el.classList.toggle('is-error',error);}
 async function imageURL(a,state){
  if(a.preview)return a.preview;
  if(!a.file&&String(a.blobId||'').startsWith('site-media:')){
   a.preview=chSupabase.storage.from('site-media').getPublicUrl(a.blobId.slice(11)).data.publicUrl;return a.preview;
  }
  const blob=a.file||await dbGet(a.blobId);if(!blob)throw new Error('파일을 불러오지 못했습니다.');
  const url=URL.createObjectURL(blob);state.urls.push(url);a.preview=url;return url;
 }
 function renderFiles(form){
  const s=form._detailState,root=form.querySelector('[data-detail-list]');
  form.querySelector('[data-detail-count]').textContent=`상세 이미지 ${s.items.filter(isImage).length} / 20장 · 새로 선택 ${s.items.filter(a=>a.file&&isImage(a)).length}장`;
  root.innerHTML=s.items.map((a,i)=>`<article class="content-file"><div class="content-thumb" data-file-thumb="${i}">${isImage(a)?'미리보기 준비 중…':'문서 / 동영상'}</div><strong>${i+1}. ${h(a.name)}</strong><span>${a.file?'새로 선택':'저장된 파일'} · ${(Number(a.size||0)/1024).toFixed(1)}KB</span><div><button type="button" data-file-move="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="${h(a.name)} 위로 이동">↑</button><button type="button" data-file-move="${i}" data-direction="1" ${i===s.items.length-1?'disabled':''} aria-label="${h(a.name)} 아래로 이동">↓</button><button type="button" data-file-remove="${i}">${a.file?'선택 취소':'삭제'}</button></div></article>`).join('')||'<p>등록된 상세 이미지가 없습니다.</p>';
  s.items.forEach(async(a,i)=>{if(!isImage(a))return;const box=root.querySelector(`[data-file-thumb="${i}"]`);try{const url=await imageURL(a,s);if(!box.isConnected)return;const img=document.createElement('img');img.src=url;img.alt=a.name;box.replaceChildren(img);}catch(e){if(box.isConnected)box.textContent='미리보기를 불러오지 못했습니다. 파일명은 유지됩니다.';}});
 }
 document.addEventListener('change',e=>{
  const form=e.target.closest('.content-editor');if(!form)return;const s=form._detailState;
  if(!e.target.matches('[data-detail-files],[data-other-files]')||s.busy)return;
  const files=Array.from(e.target.files||[]),details=e.target.hasAttribute('data-detail-files');
  try{
   if(details)validateImages([...s.items.filter(isImage),...files]);
   else{if(s.items.filter(a=>!isImage(a)).length+files.length>20)throw new Error('문서·동영상은 기존 포함 최대 20개입니다.');for(const f of files)if(f.size>MAX_BYTES)throw new Error(f.name+': 20MB를 초과했습니다.');}
   for(const file of files)s.items.push({file,name:file.name,size:file.size,type:file.type||'application/octet-stream'});
   status(form,`${files.length}개 파일을 선택했습니다. 저장하면 반영됩니다.`);renderFiles(form);
  }catch(err){status(form,err.message,true);}e.target.value='';
 });
 function draftRecord(form){
  const s=form._detailState,f=new FormData(form),now=new Date().toISOString();
  const r={...s.record,id:s.record.id||uid(s.kind),attachments:s.items.map(({file,preview,...a})=>a),createdAt:s.record.createdAt||now};
  if(s.kind==='notice')Object.assign(r,{type:s.record.id?s.record.type:f.get('type'),title:String(f.get('title')||'').trim(),content:String(f.get('content')||'').trim(),pinned:f.has('pinned'),links:String(f.get('links')||'').split(/\r?\n/).map(safeUrl).filter(Boolean)});
  else Object.assign(r,{category:String(f.get('category')||'').trim(),question:String(f.get('question')||'').trim(),answer:String(f.get('answer')||'').trim()});
  return r;
 }
 async function fillImages(container,items,state){
  container.replaceChildren();
  for(const a of items){
   const holder=document.createElement('div');holder.className='content-detail-item';container.append(holder);
   if(isImage(a)){
    const img=document.createElement('img');img.alt=a.name||'상세페이지 이미지';img.loading='lazy';img.decoding='async';holder.append(img);
    try{img.src=await imageURL(a,state);}catch(e){holder.textContent=a.name+' — 이미지를 불러오지 못했습니다.';}
   }else{
    const b=document.createElement('button');b.type='button';b.className='secondary-admin';b.textContent='첨부파일 열기: '+a.name;holder.append(b);
    b.addEventListener('click',async()=>{b.disabled=true;try{const url=await imageURL(a,state);if((a.type||'').startsWith('video/')){const video=document.createElement('video');video.src=url;video.controls=true;video.preload='metadata';video.style.maxWidth='100%';holder.replaceChildren(video);}else{const link=document.createElement('a');link.href=url;link.download=a.name;link.target='_blank';link.rel='noopener noreferrer';link.click();}}catch(e){toast(e.message)}finally{b.disabled=false}});
   }
  }
 }
 const preview=document.createElement('dialog');preview.className='dialog content-preview';preview.innerHTML='<div class="dialog-head"><h2 data-preview-title></h2><button type="button" data-preview-close aria-label="미리보기 닫기">×</button></div><div class="dialog-body"><p class="content-text" data-preview-text></p><div class="content-detail-images" data-preview-images></div></div>';document.body.append(preview);
 preview.querySelector('[data-preview-close]').onclick=()=>preview.close();
 document.addEventListener('click',e=>{
  const form=e.target.closest('.content-editor');if(!form)return;const s=form._detailState;if(s.busy)return;
  const remove=e.target.closest('[data-file-remove]'),move=e.target.closest('[data-file-move]');
  if(remove){s.items.splice(Number(remove.dataset.fileRemove),1);renderFiles(form);status(form,'목록에서 제외했습니다. 저장해야 반영됩니다.');}
  if(move){const i=Number(move.dataset.fileMove),j=i+Number(move.dataset.direction);if(j>=0&&j<s.items.length){[s.items[i],s.items[j]]=[s.items[j],s.items[i]];renderFiles(form);}}
  if(e.target.closest('[data-detail-preview]')){const r=draftRecord(form);preview.querySelector('[data-preview-title]').textContent=r.title||r.question||'상세페이지 미리보기';preview.querySelector('[data-preview-text]').textContent=r.content||r.answer||'';preview.showModal();fillImages(preview.querySelector('[data-preview-images]'),s.items,s);}
 });
 document.addEventListener('submit',async e=>{
  const form=e.target;if(!form.matches('.content-editor'))return;e.preventDefault();e.stopImmediatePropagation();
  const s=form._detailState;if(s.busy)return;if(!admin()){status(form,'관리자로 다시 로그인한 뒤 저장해 주세요.',true);return;}
  if(!form.reportValidity())return;
  let record;
  try{validateImages(s.items.filter(isImage));record=draftRecord(form);if(!(record.content||record.answer||s.items.length))throw new Error('내용 또는 상세 이미지를 입력해 주세요.');}catch(err){status(form,err.message,true);return;}
  s.record.id=record.id;if(s.kind==='notice')s.record.type=record.type;
  s.busy=true;form.querySelector('fieldset').disabled=true;form.setAttribute('aria-busy','true');
  try{
   for(let i=0;i<s.items.length;i++){
    const a=s.items[i];if(!a.file||a.blobId)continue;status(form,`파일 업로드 중 ${i+1}/${s.items.length} · 창을 닫지 마세요.`);
    const privateNotice=s.kind==='notice'&&record.type!=='general';
    const bucket=privateNotice?'private-media':'site-media';
    const path=(privateNotice?`notices/${record.type}/`:'site/')+crypto.randomUUID()+'-'+a.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const {error}=await chSupabase.storage.from(bucket).upload(path,a.file,{contentType:a.type,upsert:false});if(error)throw error;
    a.blobId=bucket+':'+path;
   }
   record.attachments=s.items.map(({file,preview,...a})=>a);status(form,'서버에 저장하고 있습니다…');
   await saveRecord(chSupabase,s.kind,record,s.original);
   const key=s.kind==='notice'?'notices':'faqs';data[key]=mergeRecord(data,s.kind,record)[key];
   s.busy=false;closeDialog(document.getElementById('adminEditorDialog'));release(s);
   if(s.kind==='notice'){renderNotices();renderPublicNotices();if(!document.getElementById('adminShell').classList.contains('hidden'))renderAdmin('notices');}
   else{renderFaqs();renderPublicFaqs();if(!document.getElementById('adminShell').classList.contains('hidden'))renderAdmin('faqs');}
   toast('서버 저장 완료 · 화면에 반영했습니다.');
  }catch(err){console.error('Content save failed',err);status(form,'저장하지 못했습니다: '+err.message+' 입력 내용은 유지됩니다.',true);}
  finally{s.busy=false;form.querySelector('fieldset').disabled=false;form.removeAttribute('aria-busy');}
 },true);
 // Block accidental closing while an upload is in progress.
 const editor=document.getElementById('adminEditorDialog');
 editor.addEventListener('cancel',e=>{if(activeForm?._detailState?.busy)e.preventDefault();});
 document.addEventListener('click',e=>{if(activeForm?._detailState?.busy&&e.target.closest('#adminEditorDialog')&&!e.target.closest('.content-editor')){e.preventDefault();e.stopImmediatePropagation();toast('저장 중입니다. 잠시 기다려 주세요.');}},true);
 editor.addEventListener('close',()=>{if(!activeForm?._detailState?.busy)release(activeForm?._detailState);});
 let noticeView={urls:[]};
 openNotice=async function(id){
  const n=data.notices.find(x=>x.id===id);if(!n||!canSeeNotice(n))return;
  release(noticeView);noticeView={urls:[]};document.getElementById('noticeDetailTitle').textContent=n.title;
  const body=document.getElementById('noticeDetailBody');body.innerHTML=`<p class="eyebrow">${h(NOTICE_TYPES[n.type]||'공지')}</p><div class="content-text">${h(n.content||'')}</div><div class="link-list">${(n.links||[]).map(x=>{const url=safeUrl(typeof x==='string'?x:x.url);return url?`<a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(typeof x==='string'?x:x.label||url)}</a>`:''}).join('')}</div><div class="content-detail-images"></div>${admin()?`<button class="primary-admin" type="button" data-content-edit-notice="${h(n.id)}">이 공지 수정</button>`:''}`;
  openDialog('noticeDetailDialog');await fillImages(body.querySelector('.content-detail-images'),(n.attachments||[]).map(a=>({...a})),noticeView);
 };
 document.getElementById('noticeDetailDialog').addEventListener('close',()=>release(noticeView));
 document.addEventListener('click',e=>{const b=e.target.closest('[data-content-edit-notice]');if(b&&admin()){const n=data.notices.find(x=>x.id===b.dataset.contentEditNotice);if(n){closeDialog(document.getElementById('noticeDetailDialog'));openEditor('공지 상세페이지 수정',noticeForm(n));}}});
 const oldFaqRender=renderPublicFaqs;let faqViews=[];
 renderPublicFaqs=function(){
  faqViews.forEach(release);faqViews=[];oldFaqRender.apply(this,arguments);
  const q=publicFaqQuery.trim().toLowerCase();const list=data.faqs.filter(f=>mapFaqCategory(f.category)===publicFaqCategory&&(!q||[f.category,f.question,f.answer].some(v=>String(v||'').toLowerCase().includes(q)))).slice((publicFaqPage-1)*5,publicFaqPage*5);
  document.querySelectorAll('#publicFaqList details').forEach((details,i)=>{
   const f=list[i];if(!f?.attachments?.length)return;
   const area=document.createElement('div');area.className='content-detail-images';details.querySelector('.public-answer').append(area);
   const state={urls:[]};faqViews.push(state);let loaded=false;
   details.addEventListener('toggle',()=>{if(details.open&&!loaded){loaded=true;fillImages(area,f.attachments.map(a=>({...a})),state);}});
  });
 };
 renderPublicFaqs();
})();
