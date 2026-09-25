(() => {
  'use strict';
  const SITE_KEY="chfood";
  const SITE_LABEL="씨에이치푸드";
  const SUPABASE_URL='https://ynyasrmtzkrjetvvdlbq.supabase.co';
  const PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlueWFzcm10emtyamV0dnZkbGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTQxNDQsImV4cCI6MjEwNDk5MDE0NH0.fP-U6lXCuSfYwl5pI9TqTowP-EX3IKwZxhmucxb5Yo8";
  const nf=new Intl.NumberFormat('ko-KR');

  function client(){
    if(window.chAuthClient)return window.chAuthClient;
    try{if(typeof chSupabase!=='undefined'&&chSupabase)return chSupabase}catch(_){}
    return null;
  }

  async function isApprovedAdmin(){
    const c=client();
    if(!c?.auth)return false;
    try{
      const {data:{session}}=await c.auth.getSession();
      if(!session?.user?.id)return false;
      const {data}=await c.from('profiles').select('role,approved,status').eq('user_id',session.user.id).maybeSingle();
      return data?.role==='admin'&&data?.approved===true&&data?.status==='approved';
    }catch(_){return false}
  }

  async function recordView(){
    if(navigator.webdriver||/bot|crawler|spider|slurp|preview/i.test(navigator.userAgent))return;
    if(await isApprovedAdmin())return;
    const path=(location.pathname||'/').slice(0,160);
    const marker='ch-view:'+SITE_KEY+':'+path;
    try{
      const last=Number(sessionStorage.getItem(marker)||0);
      if(Date.now()-last<5*60*1000)return;
    }catch(_){}
    try{
      const response=await fetch(SUPABASE_URL+'/rest/v1/site_page_view_events',{
        method:'POST',
        headers:{apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+PUBLISHABLE_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
        body:JSON.stringify({site_key:SITE_KEY,page_path:path}),
        keepalive:true
      });
      if(response.ok)try{sessionStorage.setItem(marker,String(Date.now()))}catch(_){}
    }catch(_){}
  }

  function safeNumber(value){const n=Number(value);return Number.isFinite(n)&&n>=0?n:0}
  function cards(summary){
    const items=[['오늘',summary.today,'오늘 방문'],['어제',summary.yesterday,'어제 방문'],['최근 7일',summary.last7,'오늘 포함'],['이번 달',summary.thisMonth,'한국시간 기준'],['전체 누적',summary.total,'통계 적용 이후']];
    return '<div class="analytics-cards">'+items.map(([label,value,note])=>'<div class="analytics-card"><small>'+label+'</small><b>'+nf.format(safeNumber(value))+'</b><span>'+note+'</span></div>').join('')+'</div>';
  }
  function chart(rows,kind){
    const values=rows.map(row=>safeNumber(row.views)),max=Math.max(1,...values);
    const monthly=kind==='monthly';
    return '<div class="analytics-scroll"><div class="analytics-chart '+(monthly?'monthly':'')+'">'+rows.map((row,index)=>{
      const value=values[index],height=value?Math.max(4,Math.round(value/max*100)):0;
      const raw=monthly?String(row.month||''):String(row.date||'');
      const label=monthly?raw.slice(2,7).replace('-','.'):raw.slice(5);
      return '<div class="analytics-bar-item" title="'+raw+' · '+nf.format(value)+'회"><span class="analytics-bar" style="--bar:'+height+'" data-value="'+nf.format(value)+'"></span><span class="analytics-label">'+label+'</span></div>';
    }).join('')+'</div></div>';
  }
  function shell(){
    return '<section class="analytics-dashboard" id="siteAnalyticsDashboard"><div class="analytics-head"><div><h2>'+SITE_LABEL+' 방문 통계</h2><p>공개 홈페이지 조회수를 한국시간 기준으로 집계합니다.</p></div><button type="button" class="analytics-refresh" id="analyticsRefresh">새로고침</button></div><div id="analyticsBody"><div class="analytics-status">조회수를 불러오는 중입니다.</div></div></section>';
  }
  async function loadAnalytics(){
    const body=document.getElementById('analyticsBody'),button=document.getElementById('analyticsRefresh');
    if(!body)return;
    if(button)button.disabled=true;
    body.innerHTML='<div class="analytics-status">조회수를 불러오는 중입니다.</div>';
    const c=client();
    if(!c){body.innerHTML='<div class="analytics-status">통계 연결을 준비하고 있습니다. 잠시 후 새로고침해 주세요.</div>';if(button)button.disabled=false;return}
    try{
      const {data,error}=await c.rpc('get_site_analytics',{p_site_key:SITE_KEY});
      if(error)throw error;
      const summary=data?.summary||{},daily=Array.isArray(data?.daily)?data.daily:[],monthly=Array.isArray(data?.monthly)?data.monthly:[];
      body.innerHTML=cards(summary)+'<div class="analytics-grid"><div class="analytics-panel"><h3>최근 30일 일별 조회수</h3>'+chart(daily,'daily')+'</div><div class="analytics-panel"><h3>최근 12개월 월별 조회수</h3>'+chart(monthly,'monthly')+'</div></div><p class="analytics-note">관리자 접속과 5분 이내 같은 페이지 반복 새로고침은 집계에서 제외합니다.</p>';
    }catch(error){
      body.innerHTML='<div class="analytics-status">조회수를 불러오지 못했습니다. 관리자 로그인 상태를 확인한 뒤 다시 시도해 주세요.</div>';
      console.error('Analytics load failed',error);
    }finally{if(button)button.disabled=false}
  }
  function mountAnalytics(){
    const content=document.getElementById('adminContent');
    if(!content||document.getElementById('siteAnalyticsDashboard'))return;
    const heading=content.querySelector(':scope > h1');
    if(heading)heading.insertAdjacentHTML('afterend',shell());else content.insertAdjacentHTML('afterbegin',shell());
    document.getElementById('analyticsRefresh')?.addEventListener('click',loadAnalytics);
    loadAnalytics();
  }
  function hookDashboard(){
    if(typeof window.renderAdmin!=='function')return;
    const original=window.renderAdmin;
    window.renderAdmin=function(section){
      const result=original.apply(this,arguments);
      if(section==='dashboard')setTimeout(mountAnalytics,0);
      return result;
    };
  }
  const start=()=>{hookDashboard();recordView()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
