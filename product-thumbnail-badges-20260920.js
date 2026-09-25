(()=>{
 const ASSET_BASE='/assets/product-badges-original-v3/';
 const BADGES=[
  {id:'free_shipping',side:'left',label:'무료 배송 신청'},
  {id:'direct_delivery',side:'left',label:'직접전달 빠른배송 신청'},
  {id:'visit_pickup',side:'left',label:'방문 수거'},
  {id:'free_return',side:'left',label:'무료 반품'},
  {id:'years_22',side:'right',label:'22년 제조노하우'},
  {id:'haccp',side:'right',label:'HACCP 식품의약품안전처'},
  {id:'no_preservatives',side:'right',label:'무방부제'},
  {id:'made_to_order',side:'right',label:'주문 생산'},
  {id:'domestic_rice',side:'right',label:'국내산 쌀'},
  {id:'gluten_free',side:'right',label:'밀가루 0%'},
  {id:'salt_free',side:'right',label:'쌀 함유'}
 ];
 const badgeSrc=item=>`${ASSET_BASE}${item.id}.png`;
 const BADGE_SCALES={'0':1,'20':1.2,'30':1.3,'45':1.45};
 const BADGE_IDS=new Set(BADGES.map(item=>item.id));
 const byId=id=>BADGES.find(item=>item.id===id);
 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 function selectedBadges(product){let raw=product?.thumbnailBadges||[];if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{raw=[]}}return [...new Set(Array.isArray(raw)?raw:[])].filter(id=>BADGE_IDS.has(id));}
 function selectedBadgeScale(product){const value=String(product?.thumbnailBadgeScale??'0');return Object.hasOwn(BADGE_SCALES,value)?value:'0';}
 function sideBadges(product,side){return selectedBadges(product).map(byId).filter(item=>item?.side===side);}
 function stackMarkup(items,side,product){if(!items.length)return '';const ratio=side==='left'?.768:.977,gap=.75,size=(side==='left'?16.6:12.57)*BADGE_SCALES[selectedBadgeScale(product)],height=size*ratio,naturalStep=height+gap,fitStep=items.length>1?(98-height)/(items.length-1):0,step=items.length>1?Math.min(naturalStep,fitStep):0,total=height+step*(items.length-1),start=Math.max(1,(100-total)/2);return `<span class="product-thumb-badge-stack ${side}" style="--badge-size:${size.toFixed(2)}%;--badge-count:${items.length}">${items.map((item,index)=>`<img class="product-thumb-badge" style="--badge-top:${(start+index*step).toFixed(2)}%" src="${badgeSrc(item)}" alt="" data-badge-position="${side==='left'?'좌':'우'}${index+1}">`).join('')}</span>`;}
 function badgeMarkup(product){const left=sideBadges(product,'left'),right=sideBadges(product,'right');if(!left.length&&!right.length)return '';return `<span class="product-thumb-badges" aria-hidden="true">${stackMarkup(left,'left',product)}${stackMarkup(right,'right',product)}</span>`;}
 function decorateProductImages(){document.querySelectorAll('.product-image').forEach(image=>{const button=image.closest('[data-product-id]'),product=data.products.find(item=>item.id===button?.dataset.productId);image.querySelector('.product-thumb-badges')?.remove();if(product)image.insertAdjacentHTML('beforeend',badgeMarkup(product));});}
 function decorateDialog(product){const media=document.querySelector('.product-detail-media');if(!media)return;media.querySelector('.product-thumb-badges')?.remove();media.insertAdjacentHTML('beforeend',badgeMarkup(product));}
 function positions(selected){const result={};for(const side of ['left','right'])selected.filter(id=>byId(id)?.side===side).forEach((id,index)=>result[id]=`${side==='left'?'좌':'우'}${index+1}`);return result;}
 function editorMarkup(product){const selected=selectedBadges(product),scale=selectedBadgeScale(product),position=positions(selected);const option=item=>`<label class="thumbnail-badge-option ${item.side}"><input type="checkbox" value="${item.id}" ${selected.includes(item.id)?'checked':''}><img class="thumbnail-badge-swatch" src="${badgeSrc(item)}" alt=""><span>${escapeHtml(item.label)}</span><b class="thumbnail-badge-position" data-badge-id="${item.id}">${position[item.id]||'—'}</b></label>`;const scaleOptions=[['0','기본'],['20','20% 확대'],['30','30% 확대'],['45','45% 확대']].map(([value,label])=>`<option value="${value}" ${scale===value?'selected':''}>${label}</option>`).join('');return `<fieldset class="full thumbnail-badge-editor"><legend>대표 썸네일 배지 (선택)</legend><input type="hidden" name="thumbnailBadges" value="${escapeHtml(JSON.stringify(selected))}"><label class="thumbnail-badge-scale-control"><strong>배지 크기</strong><select name="thumbnailBadgeScale" aria-label="배지 크기">${scaleOptions}</select></label><p class="hint">체크한 순서가 <b>좌1·좌2 / 우1·우2</b> 순서가 됩니다. 선택한 크기로 표시하되, 배지가 많으면 캔버스 밖으로 잘리지 않도록 자동 조정됩니다.</p><div class="thumbnail-badge-columns"><div><strong>왼쪽 안내 배지</strong><div class="thumbnail-badge-options">${BADGES.filter(item=>item.side==='left').map(option).join('')}</div></div><div><strong>오른쪽 품질·특징 배지</strong><div class="thumbnail-badge-options">${BADGES.filter(item=>item.side==='right').map(option).join('')}</div></div></div></fieldset>`;}
 function readSelection(form){const input=form?.querySelector('[name="thumbnailBadges"]');if(!input)return [];try{return [...new Set(JSON.parse(input.value||'[]'))].filter(id=>BADGE_IDS.has(id))}catch{return []}}
 function updatePositions(form,selected){const position=positions(selected);form.querySelectorAll('.thumbnail-badge-position').forEach(node=>node.textContent=position[node.dataset.badgeId]||'—');}
 function syncBadgeInput(option){const form=option.closest('form'),input=form?.querySelector('[name="thumbnailBadges"]');if(!input)return;let selected=readSelection(form);if(option.checked&&!selected.includes(option.value))selected.push(option.value);if(!option.checked)selected=selected.filter(id=>id!==option.value);input.value=JSON.stringify(selected);updatePositions(form,selected);}
 const injectBadgeEditor=(form,product)=>form.replace(/(<label class="full product-blog-url-field">)/,`${editorMarkup(product)}$1`);
 const originalProductForm=productForm;productForm=function(product={}){return injectBadgeEditor(originalProductForm(product),product);};
 if(typeof publicInlineProductForm==='function'){const originalPublicInlineProductForm=publicInlineProductForm;publicInlineProductForm=function(product={}){return injectBadgeEditor(originalPublicInlineProductForm(product),product);};productForm=publicInlineProductForm;}
 const originalRenderProducts=renderProducts;renderProducts=function(){const result=originalRenderProducts.apply(this,arguments);decorateProductImages();return result;};
 const originalOpenProduct=openProduct;openProduct=async function(id){const result=await originalOpenProduct.apply(this,arguments);decorateDialog(data.products.find(item=>item.id===id));return result;};
 document.addEventListener('change',event=>{const option=event.target.closest('.thumbnail-badge-option input');if(option)syncBadgeInput(option);});
 decorateProductImages();
})();
