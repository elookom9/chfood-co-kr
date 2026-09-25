(() => {
  const base = 'https://ynyasrmtzkrjetvvdlbq.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlueWFzcm10emtyamV0dnZkbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTQxNDQsImV4cCI6MjEwNDk5MDE0NH0.fP-U6lXCuSfYwl5pI9TqTowP-EX3IKwZxhmucxb5Yo8';
  const $ = id => document.getElementById(id);
  async function load() {
    $('retry').hidden = true; $('detail').hidden = true; $('status').hidden = false;
    $('status').textContent = '신상품 정보를 불러오는 중입니다…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(base + '/rest/v1/site_state?id=eq.main&select=payload', {headers:{apikey:key},signal:controller.signal,cache:'no-store'});
      if (!response.ok) throw new Error('load');
      const rows = await response.json();
      const page = rows[0]?.payload?.settings?.newProductPage;
      if (!page) { $('status').textContent = '신상품 소식을 준비 중입니다.'; return; }
      $('pageTitle').textContent = page.title || '신상품 안내';
      document.title = (page.title || '신상품 안내') + ' | 씨에이치푸드';
      $('content').textContent = page.content || '';
      $('images').replaceChildren();
      for (const [i,item] of (page.attachments || []).entries()) {
        const ref = String(item.blobId || '');
        if (!/^site-media:site\/[\w./-]+$/.test(ref) || ref.includes('..')) continue;
        const img = document.createElement('img');
        img.src = base + '/storage/v1/object/public/site-media/' + ref.slice('site-media:'.length);
        img.alt = (page.title || '신상품') + ' 상세이미지 ' + (i + 1);
        img.loading = i === 0 ? 'eager' : 'lazy';
        img.addEventListener('error', () => {
          const note = document.createElement('p'); note.textContent = '상세이미지를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'; img.replaceWith(note);
        });
        $('images').append(img);
      }
      $('status').hidden = true; $('detail').hidden = false;
    } catch (_) {
      $('status').textContent = '신상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      $('retry').hidden = false;
    } finally { clearTimeout(timer); }
  }
  $('retry').addEventListener('click', load);
  load();
})();
