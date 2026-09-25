(function(){
  const categories=['매장·현장','제품·메뉴','행사·납품','기계·설비'];
  let selected='전체';
  const category=g=>categories.includes(g.category)?g.category:categories[0];
  const canEdit=()=>session?.role==='admin'&&chProfile?.role==='admin'&&chProfile.approved&&chProfile.status==='approved';
  const publicEditing=()=>canEdit()&&document.getElementById('adminShell').classList.contains('hidden');
  renderGallery=function(){
    const root=document.getElementById('galleryGrid');if(!root)return;
    const admin=publicEditing();
    document.getElementById('chGalleryToolbar').hidden=!admin;
    document.getElementById('chGalleryTabs').innerHTML=['전체',...categories].map(c=>`<button type="button" data-gallery-category="${esc(c)}" aria-pressed="${selected===c}">${esc(c)}</button>`).join('');
    const items=(data.gallery||[]).filter(g=>(admin||g.visible!==false)&&(selected==='전체'||category(g)===selected)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    root.innerHTML=items.map(g=>`<article class="gallery-card ${g.visible===false?'ch-gallery-hidden':''}">
      <button type="button" class="ch-gallery-card-link" data-gallery-detail="${esc(g.id)}" aria-label="${esc(g.title)} 상세 보기">
        <div class="gallery-image"><img loading="lazy" alt="${esc(g.title||'갤러리 사진')}" ${g.imageBlobId?`data-blob-id="${esc(g.imageBlobId)}"`:''}></div>
        <div class="gallery-body"><small class="ch-gallery-tag">${esc(category(g))}${g.visible===false?' · 숨김':''}</small><b>${esc(g.title)}</b><p>${esc(g.desc||'')}</p></div>
      </button>
      ${admin?`<div class="ch-gallery-actions"><button type="button" data-gallery-edit="${esc(g.id)}">수정</button><button type="button" data-gallery-toggle="${esc(g.id)}">${g.visible===false?'공개하기':'숨기기'}</button></div>`:''}
    </article>`).join('')||`<p class="gallery-empty">이 카테고리에 등록된 갤러리가 없습니다.${admin?' 위의 ‘갤러리 등록’ 버튼으로 사진을 추가해 주세요.':''}</p>`;
    hydrateGalleryImages(root);
  };
  galleryForm=function(g={}){
    return `<form class="admin-form" id="chGalleryForm">
      <input type="hidden" name="id" value="${esc(g.id||'')}">
      <label class="full">제목<input name="title" maxlength="150" value="${esc(g.title||'')}" required></label>
      <label>카테고리<select name="category">${categories.map(c=>`<option ${category(g)===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <label>공개 여부<select name="visible"><option value="true" ${g.visible!==false?'selected':''}>공개</option><option value="false" ${g.visible===false?'selected':''}>숨김</option></select></label>
      <label class="full">썸네일 소개<textarea name="desc" maxlength="1000" rows="3">${esc(g.desc||'')}</textarea></label>
      <label class="full">상세 내용<textarea name="content" maxlength="20000" rows="9" placeholder="사진에 담긴 현장, 제품, 행사 등의 상세 내용을 입력해 주세요.">${esc(g.content||g.desc||'')}</textarea></label>
      <label class="full">대표 사진${g.imageBlobId?' (변경할 때만 선택)':' *'}<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" ${g.imageBlobId?'':'required'}><span class="hint">JPG·PNG·WEBP·GIF, 20MB 이하</span></label>
      <p class="ch-gallery-status" role="status" aria-live="polite"></p>
      <button class="primary-admin full" type="submit">갤러리 저장</button>
    </form>`;
  };
  async function verifyAdmin(){
    if(!chSupabase||!chRemoteReady)throw new Error('서버 연결이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');
    const {data:auth,error}=await chSupabase.auth.getUser();
    if(error||!auth.user)throw new Error('관리자 로그인이 필요합니다. 다시 로그인해 주세요.');
    await chLoadProfile(auth.user);
    if(!canEdit())throw new Error('승인된 관리자만 갤러리를 수정할 수 있습니다.');
  }
  // Save only gallery content and its new media reference, preserving other sections.
  async function persistItem(item,media){
    await verifyAdmin();
    const {data:current,error}=await chSupabase.from('site_state').select('payload,updated_at').eq('id','main').maybeSingle();
    if(error)throw error;
    const payload=current?.payload||chPublicState();
    const list=[...(payload.gallery||[])];
    const index=list.findIndex(g=>g.id===item.id);
    if(index<0)list.unshift(item);else list[index]=item;
    const next={...payload,gallery:list};
    if(media)next.settings={...(payload.settings||{}),storageMap:{...(payload.settings?.storageMap||{}),[media.id]:media.destination}};
    let request;
    if(current){
      request=chSupabase.from('site_state').update({payload:next,updated_at:new Date().toISOString()}).eq('id','main');
      request=current.updated_at?request.eq('updated_at',current.updated_at):request.is('updated_at',null);
    }else request=chSupabase.from('site_state').insert({id:'main',payload:next,updated_at:new Date().toISOString()});
    const {data:saved,error:saveError}=await request.select('id');
    if(saveError)throw saveError;
    if(!saved?.length)throw new Error('다른 변경 내용이 먼저 저장되었습니다. 다시 저장해 주세요.');
    data.gallery=list;
    if(media)data.settings.storageMap={...(data.settings.storageMap||{}),[media.id]:media.destination};
    return true;
  }
  const detail=document.createElement('dialog');detail.id='chGalleryDetail';detail.className='dialog';
  detail.innerHTML='<div class="dialog-head"><h2 id="chGalleryDetailTitle"></h2><button type="button" class="dialog-close" data-close aria-label="갤러리 상세 닫기">×</button></div><div class="dialog-body" id="chGalleryDetailBody"></div>';
  document.body.appendChild(detail);
  detail.querySelector('[data-close]').addEventListener('click',()=>closeDialog(detail));
  detail.addEventListener('click',e=>{if(e.target===detail)closeDialog(detail)});
  detail.addEventListener('cancel',e=>{e.preventDefault();closeDialog(detail)});
  async function showDetail(id){
    const g=(data.gallery||[]).find(x=>x.id===id);if(!g||(g.visible===false&&!canEdit()))return;
    document.getElementById('chGalleryDetailTitle').textContent=g.title||'갤러리';
    const body=document.getElementById('chGalleryDetailBody');
    body.innerHTML=`<small class="ch-gallery-tag">${esc(category(g))}</small>${g.imageBlobId?`<img class="ch-gallery-detail-photo" data-blob-id="${esc(g.imageBlobId)}" alt="${esc(g.title)}">`:''}<div class="ch-gallery-detail-copy">${esc(g.content||g.desc||'')}</div>`;
    openDialog('chGalleryDetail');await hydrateGalleryImages(body);
  }
  document.getElementById('gallery').addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-gallery-category')){selected=button.dataset.galleryCategory;renderGallery();return}
    if(button.hasAttribute('data-gallery-detail')){showDetail(button.dataset.galleryDetail);return}
    if(!canEdit())return;
    if(button.hasAttribute('data-gallery-add')){openEditor('갤러리 등록',galleryForm({category:selected==='전체'?categories[0]:selected}));return}
    const g=data.gallery.find(x=>x.id===(button.dataset.galleryEdit||button.dataset.galleryToggle));if(!g)return;
    if(button.hasAttribute('data-gallery-edit')){openEditor('갤러리 수정',galleryForm(g));return}
    if(button.hasAttribute('data-gallery-toggle')){
      button.disabled=true;
      try{await persistItem({...g,visible:g.visible===false,updatedAt:new Date().toISOString()});renderGallery();toast('갤러리 공개 설정을 저장했습니다.')}
      catch(error){toast(error.message||'저장하지 못했습니다. 다시 시도해 주세요.');button.disabled=false}
    }
  });
  document.addEventListener('submit',async e=>{
    if(e.target.getAttribute('id')!=='chGalleryForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    const form=e.target,button=form.querySelector('[type=submit]'),status=form.querySelector('.ch-gallery-status');
    if(button.disabled)return;
    button.disabled=true;status.textContent='갤러리를 저장하고 있습니다…';
    let uploaded='';
    try{
      await verifyAdmin();
      const values=new FormData(form),id=values.get('id'),old=(data.gallery||[]).find(g=>g.id===id);
      const item={...(old||{id:uid('gallery'),createdAt:new Date().toISOString()}),title:String(values.get('title')||'').trim(),category:String(values.get('category')),desc:String(values.get('desc')||'').trim(),content:String(values.get('content')||'').trim(),visible:values.get('visible')==='true',updatedAt:new Date().toISOString()};
      const file=form.querySelector('[name=image]').files[0];let media=null;
      if(!item.title)throw new Error('제목을 입력해 주세요.');
      if(file){
        if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>20*1024*1024)throw new Error('20MB 이하 JPG·PNG·WEBP·GIF 파일을 선택해 주세요.');
        uploaded=uid('gallery-image');await dbPut(uploaded,file);
        item.imageBlobId=uploaded;item.imageName=file.name;
        media={id:uploaded,destination:data.settings.storageMap[uploaded]};
      }
      if(!item.imageBlobId)throw new Error('대표 사진을 선택해 주세요.');
      await persistItem(item,media);uploaded='';
      closeDialog(document.getElementById('adminEditorDialog'));renderGallery();
      if(!document.getElementById('adminShell').classList.contains('hidden'))renderAdmin('gallery');
      toast('갤러리를 저장했습니다.');
    }catch(error){
      if(uploaded){await dbDelete(uploaded).catch(()=>{});delete data.settings.storageMap?.[uploaded]}
      status.textContent=error.message||'저장하지 못했습니다. 다시 시도해 주세요.';
    }finally{button.disabled=false}
  },true);
  for(const name of ['renderAccountState','openAdmin','closeAdmin']){
    const original=window[name];window[name]=function(...args){const result=original.apply(this,args);renderGallery();return result};
  }
  renderGallery();
})();
