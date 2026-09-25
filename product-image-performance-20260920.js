(() => {
  'use strict';

  const PUBLIC_BASE = ((window.CHFOOD_SUPABASE_CONFIG?.url || 'https://ynyasrmtzkrjetvvdlbq.supabase.co').replace(/\/$/, '')) + '/storage/v1/render/image/public/';
  const originalSetBlobImage = typeof setBlobImage === 'function' ? setBlobImage : null;

  function mediaLocation(ref) {
    const value = String(ref || '');
    if (!value || value.startsWith('static:')) return null;
    if (value.includes(':')) {
      const split = value.indexOf(':');
      return { bucket: value.slice(0, split), path: value.slice(split + 1) };
    }
    const mapped = data?.settings?.storageMap?.[value];
    return mapped?.bucket && mapped?.path ? mapped : null;
  }

  function publicMediaUrl(ref) {
    const location = mediaLocation(ref);
    if (!location || location.bucket !== 'site-media' || !location.path || location.path.includes('..')) return '';
    const path = String(location.path).split('/').map(encodeURIComponent).join('/');
    return PUBLIC_BASE + encodeURIComponent(location.bucket) + '/' + path + '?width=800&height=800&resize=cover&quality=78';
  }

  function productSignature() {
    if (typeof filteredProducts !== 'function' || typeof productState === 'undefined') return '';
    const items = filteredProducts();
    const total = Math.max(1, Math.ceil(items.length / productState.size));
    const page = Math.min(Math.max(1, productState.page), total);
    const start = (page - 1) * productState.size;
    const visible = items.slice(start, start + productState.size);
    const role = typeof session !== 'undefined' ? session?.role || '' : '';
    return JSON.stringify([
      productState.category, productState.query, page, productState.size, role,
      visible.map(item => [
        item.id, item.updatedAt, item.name, item.category, item.weight, item.desc, item.features,
        item.imageBlobId, publicMediaUrl(item.imageBlobId), item.thumbnailBadges, item.thumbnailBadgeScale, item.visible
      ])
    ]);
  }

  async function hydrateProductImagesFast(root = document) {
    const images = [...root.querySelectorAll?.('.product-image img[data-blob-id]') || []];
    const fallback = [];
    images.forEach((img, index) => {
      const ref = img.dataset.blobId;
      const url = publicMediaUrl(ref);
      img.decoding = 'async';
      img.loading = index < 3 ? 'eager' : 'lazy';
      img.fetchPriority = index === 0 ? 'high' : 'auto';
      if (!img.hasAttribute('width')) img.width = 800;
      if (!img.hasAttribute('height')) img.height = 800;
      if (url) {
        img.dataset.publicSrc = url;
        if (img.getAttribute('src') !== url) img.src = url;
      } else {
        fallback.push({ img, ref });
      }
    });
    await Promise.allSettled(fallback.map(async ({ img, ref }) => {
      const blob = await dbGet(ref).catch(() => null);
      if (!img.isConnected || img.dataset.blobId !== ref) return;
      if (blob && originalSetBlobImage) originalSetBlobImage(img, blob);
      else {
        const product = data.products.find(item => item.id === img.dataset.productId);
        img.src = productImageSrc(product || {});
      }
    }));
  }

  if (originalSetBlobImage) {
    setBlobImage = function (img, blob) {
      if (img?.matches?.('#productGrid .product-image img[data-public-src]')) return;
      return originalSetBlobImage(img, blob);
    };
  }
  hydrateProductImages = hydrateProductImagesFast;

  const previousRenderProducts = renderProducts;
  let lastSignature = '';
  function showProductLoadState(message = '최신 제품 정보를 불러오는 중입니다.', isError = false) {
    const grid = document.getElementById('productGrid');
    const pager = document.getElementById('productPager');
    if (!grid) return;
    grid.setAttribute('aria-busy', isError ? 'false' : 'true');
    grid.innerHTML = `<p class="product-data-state${isError ? ' is-error' : ''}" role="${isError ? 'alert' : 'status'}">${message}</p>`;
    if (pager) pager.innerHTML = '';
  }
  renderProducts = function () {
    if (window.__CH_PRODUCT_DATA_READY__ !== true) {
      showProductLoadState();
      return;
    }
    const nextSignature = productSignature();
    const grid = document.getElementById('productGrid');
    if (grid?.children.length && nextSignature === lastSignature) {
      hydrateProductImagesFast(grid);
      return;
    }
    const result = previousRenderProducts.apply(this, arguments);
    grid?.setAttribute('aria-busy', 'false');
    lastSignature = productSignature();
    hydrateProductImagesFast(document.getElementById('productGrid'));
    return result;
  };

  const style = document.createElement('style');
  style.id = 'product-data-state-style';
  style.textContent = '.product-data-state{grid-column:1/-1;margin:0;min-height:240px;display:grid;place-items:center;color:#6d7b79;font-size:16px;text-align:center}.product-data-state.is-error{color:#9a4b3d}';
  document.head.appendChild(style);
  window.__CH_RENDER_PRODUCT_LOAD_ERROR__ = function () {
    showProductLoadState('제품 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.', true);
  };
  window.__PRODUCT_IMAGE_PERFORMANCE_READY__ = true;
  renderProducts();
})();
