(function(){
  const fallbackAddress='인천광역시 남동구 고잔동 653-2';
  let generation=0,loadedKey='',loading;
  const address=()=>String(data.settings.address||fallbackAddress).trim();
  const box=document.getElementById('directionsMap');
  function fallback(){box.replaceChildren();const p=document.createElement('p');p.textContent='네이버 지도에서 위치와 방문 경로를 확인해 주세요.';box.appendChild(p)}
  function sdk(key){
    if(loadedKey===key&&window.naver?.maps?.Service)return Promise.resolve();
    if(loading&&loadedKey===key)return loading;
    if(loadedKey&&loadedKey!==key)return Promise.reject(new Error('reload'));
    loadedKey=key;
    loading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');const timeout=setTimeout(()=>reject(new Error('timeout')),12000);
      window.navermap_authFailure=()=>{clearTimeout(timeout);reject(new Error('auth'))};
      script.src='https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='+encodeURIComponent(key)+'&submodules=geocoder';
      script.onload=()=>{clearTimeout(timeout);window.naver?.maps?.Service?resolve():reject(new Error('sdk'))};
      script.onerror=()=>{clearTimeout(timeout);reject(new Error('network'))};document.head.appendChild(script);
    });return loading;
  }
  async function renderDirections(){
    const turn=++generation,query=address();
    document.getElementById('directionsAddress').textContent=query;
    document.getElementById('directionsLink').href='https://map.naver.com/p/search/'+encodeURIComponent(query);
    fallback();
    if(document.getElementById('directions').classList.contains('is-collapsed'))return;
    const key=String(data.settings.naverMapKey||EXTERNAL_LINKS.naverMapKey||'').trim();
    if(!key||!/^[A-Za-z0-9_-]+$/.test(key))return;
    try{
      await sdk(key);if(turn!==generation)return;
      naver.maps.Service.geocode({query},(status,response)=>{
        if(turn!==generation||status!==naver.maps.Service.Status.OK)return;
        const result=response.v2?.addresses?.[0];if(!result)return;
        const lat=Number(result.y),lng=Number(result.x);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
        try{box.replaceChildren();const center=new naver.maps.LatLng(lat,lng);const map=new naver.maps.Map(box,{center,zoom:16,scrollWheel:false});new naver.maps.Marker({position:center,map,title:'씨에이치푸드'});}catch(e){fallback()}
      });
    }catch(e){if(turn===generation)fallback()}
  }
  const previous=renderSettings;
  renderSettings=function(){const value=previous.apply(this,arguments);renderDirections();return value};
  const settings=adminSettings;
  adminSettings=function(){return settings.apply(this,arguments).replace('</form>',`<label class="full">네이버 지도 API Key ID<input name="naverMapKey" value="${esc(data.settings.naverMapKey||EXTERNAL_LINKS.naverMapKey||'')}" pattern="[A-Za-z0-9_-]*" autocomplete="off" placeholder="네이버 클라우드 Maps의 Key ID"></label><p class="hint full">Dynamic Map과 Geocoding을 활성화하고 웹 서비스 URL에 http://chfood.co.kr을 등록해 주세요. Secret Key는 입력하지 마세요. 키를 변경한 뒤에는 홈페이지를 새로고침해 주세요.</p></form>`)};
  document.getElementById('directionsCopy').addEventListener('click',async()=>{const status=document.getElementById('directionsStatus');try{await navigator.clipboard.writeText(address());status.textContent='주소를 복사했습니다.'}catch(e){status.textContent='주소를 선택해서 복사해 주세요: '+address()}});
  const banner=document.getElementById('directions');
  const toggle=document.getElementById('directionsToggle');
  function collapse(value){banner.classList.toggle('is-collapsed',value);toggle.setAttribute('aria-expanded',String(!value));toggle.textContent=value?'지도 보기 +':'접기 −';if(!value)renderDirections()}
  toggle.addEventListener('click',()=>collapse(!banner.classList.contains('is-collapsed')));
  document.querySelectorAll('a[href="#directions"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();collapse(false);toggle.focus()}));
  // Start collapsed in HTML, so no map panel jumps during initial loading.
  renderDirections();
})();
