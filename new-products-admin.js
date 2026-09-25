/* Extend the existing authenticated CMS without changing its stored content. */
(() => {
  const route = '/new-products.html';
  const originalNormalize = normalizeLinkBannerUrl;
  normalizeLinkBannerUrl = value => String(value).trim() === route ? route : originalNormalize(value);
  const originalBanners = renderLinkBanners;
  renderLinkBanners = function () {
    (data.settings.linkBanners || []).forEach((item, index) => {
      if (item.id === 'link-banner-new' || index === 2) item.url = route;
    });
    originalBanners();
  };
  const originalNav = renderAdminNav;
  renderAdminNav = function () {
    originalNav();
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.admin = 'newProductPage';
    button.textContent = '신상품 상세 관리';
    button.classList.toggle('active', adminSection === 'newProductPage');
    document.querySelector('[data-admin="linkBanners"]')?.after(button);
  };
  let draftImages = [];
  let busy = false;
  const allowed = () => chRemoteReady && chSupabase && chProfile?.approved && chProfile.role === 'admin';
  function imageURL(ref) {
    if (!/^site-media:site\/[\w./-]+$/.test(ref || '') || ref.includes('..')) return '';
    return CHFOOD_SUPABASE_CONFIG.url + '/storage/v1/object/public/site-media/' + ref.slice('site-media:'.length);
  }
  function renderImages() {
    const root = document.getElementById('newProductImages');
    if (!root) return;
    root.innerHTML = draftImages.map((item, i) => `<li style="margin:16px 0"><img src="${esc(imageURL(item.blobId))}" alt="${esc(item.name || '상세이미지')}" style="width:100px;max-height:140px;object-fit:contain;vertical-align:middle"> <span>${esc(item.name || '상세이미지')}</span> <button type="button" data-new-move="${i}" ${i === 0 ? 'disabled' : ''}>위로</button> <button type="button" data-new-remove="${i}">목록에서 제거</button></li>`).join('');
  }
  const originalAdmin = renderAdmin;
  renderAdmin = function (section) {
    if (busy && adminSection === 'newProductPage') return toast('저장이 끝날 때까지 기다려 주세요.');
    if (section !== 'newProductPage') {
      originalAdmin(section);
      if (section === 'linkBanners') {
        const input = document.querySelector('[name="linkBannerUrl_2"]');
        if (input) { input.value = route; input.readOnly = true; }
      }
      return;
    }
    adminSection = section;
    renderAdminNav();
    const page = data.settings.newProductPage || {};
    draftImages = (page.attachments || []).map(x => ({...x}));
    document.getElementById('adminContent').innerHTML = `<h1>신상품 상세 관리</h1><p>홈페이지의 ‘신상품 안내’를 누르면 열리는 페이지입니다. 저장하면 모든 방문자에게 공개됩니다.</p><p><a href="${route}" target="_blank" rel="noopener">공개 페이지 보기 ↗</a></p><form id="newProductForm"><fieldset style="border:0;padding:0;display:grid;gap:18px"><label>제목<input name="title" required maxlength="120" value="${esc(page.title || '신상품 안내')}" style="display:block;width:100%"></label><label>상세 설명<textarea name="content" rows="12" maxlength="20000" style="display:block;width:100%">${esc(page.content || '')}</textarea></label><label>상세이미지 추가<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple style="display:block"></label><p>JPG·PNG·WebP / 이미지당 최대 20MB / 총 10장. 등록 순서대로 길게 표시됩니다. 이미지는 저장 버튼을 누르면 업로드됩니다.</p><ol id="newProductImages"></ol><button type="submit" class="btn primary">저장 및 공개</button></fieldset><p id="newProductStatus" role="status" aria-live="polite"></p></form>`;
    renderImages();
  };
  document.addEventListener('click', event => {
    const remove = event.target.closest('[data-new-remove]');
    const move = event.target.closest('[data-new-move]');
    if (busy || (!remove && !move)) return;
    if (remove) draftImages.splice(Number(remove.dataset.newRemove), 1);
    if (move) { const i = Number(move.dataset.newMove); if (i > 0) [draftImages[i-1], draftImages[i]] = [draftImages[i], draftImages[i-1]]; }
    renderImages();
  });
  document.addEventListener('submit', async event => {
    if (event.target.getAttribute('id') !== 'newProductForm') return;
    event.preventDefault();
    if (busy) return;
    const form = event.target, status = form.querySelector('[role="status"]');
    if (!allowed()) { status.textContent = '관리자 로그인과 서버 연결을 확인한 뒤 다시 시도해 주세요.'; return; }
    const fields = new FormData(form), files = [...form.elements.images.files];
    const title = String(fields.get('title') || '').trim();
    if (!title) { status.textContent = '제목을 입력해 주세요.'; return; }
    if (files.length + draftImages.length > 10 || files.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > 20 * 1024 * 1024)) {
      status.textContent = '이미지 형식·용량·개수를 확인해 주세요.'; return;
    }
    busy = true; form.querySelector('fieldset').disabled = true; status.textContent = '이미지 업로드 및 저장 중입니다…';
    try {
      // Retain successful uploads on retry so a network error does not duplicate them.
      for (const file of files) {
        const blobId = await dbPut(uid('new-product'), file);
        draftImages.push({blobId, name:file.name});
        const remaining = new DataTransfer();
        for (const pending of files.slice(files.indexOf(file) + 1)) remaining.items.add(pending);
        form.elements.images.files = remaining.files;
      }
      form.elements.images.value = '';
      renderImages();
      const page = {title, content:String(fields.get('content') || '').trim(), attachments:draftImages.map(x => ({...x})), updatedAt:new Date().toISOString()};
      const {data:latest, error:readError} = await chSupabase.from('site_state').select('payload').eq('id','main').single();
      if (readError || !latest?.payload) throw readError || new Error('기존 홈페이지 데이터를 확인하지 못했습니다.');
      const payload = {...latest.payload, settings:{...latest.payload.settings, newProductPage:page}};
      const {error} = await chSupabase.from('site_state').upsert({id:'main',payload,updated_at:page.updatedAt},{onConflict:'id'});
      if (error) throw error;
      data.settings.newProductPage = page;
      status.textContent = '저장 완료. 신상품 상세페이지에 공개되었습니다.';
      toast('신상품 상세페이지 저장 완료');
    } catch (error) {
      renderImages();
      status.textContent = '저장하지 못했습니다. 입력 내용은 유지됩니다. ' + (error.message || '연결 상태를 확인해 주세요.');
    } finally { busy = false; form.querySelector('fieldset').disabled = false; }
  });
  renderLinkBanners();
})();
