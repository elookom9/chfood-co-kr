(()=>{
 let remoteUnreadCount=null;
 const buttons=()=>[...document.querySelectorAll('#publicInquiryBell,#adminInquiryBell')];
 const isAdmin=()=>typeof session!=='undefined'&&session?.role==='admin';
 const localUnreadCount=()=>Array.isArray(data?.inquiries)?data.inquiries.filter(item=>item?.status==='신규').length:0;
 const unreadCount=()=>Number.isInteger(remoteUnreadCount)?remoteUnreadCount:localUnreadCount();
 function renderInquiryBell(){
  const allowed=isAdmin(),count=unreadCount();
  buttons().forEach(button=>{
   button.hidden=!allowed;
   button.querySelector('.inquiry-bell-count').textContent=count>99?'99+':String(count);
   button.setAttribute('aria-label',count?`읽지 않은 문의 ${count}건, 문의 관리 열기`:'읽지 않은 문의 없음, 문의 관리 열기');
  });
 }
 async function refreshInquiryBell(){
  if(!isAdmin()){remoteUnreadCount=null;renderInquiryBell();return;}
  try{
   if(typeof chSupabase!=='undefined'&&chSupabase?.from){
    const {count,error}=await chSupabase.from('inquiries').select('*',{count:'exact',head:true}).eq('status','신규');
    if(!error&&Number.isInteger(count))remoteUnreadCount=count;
   }
  }catch(error){console.warn('Unread inquiry refresh failed',error);}
  renderInquiryBell();
 }
 function openUnreadInquiries(){
  if(!isAdmin())return;
  adminState.inquiryType='전체';adminState.inquiryStatus='신규';adminState.inquiryQuery='';
  openAdmin();renderAdmin('inquiries');
 }
 document.addEventListener('click',event=>{if(event.target.closest('#publicInquiryBell,#adminInquiryBell'))openUnreadInquiries();});
 const previousRenderAccountState=renderAccountState;
 renderAccountState=function(){const result=previousRenderAccountState.apply(this,arguments);queueMicrotask(refreshInquiryBell);return result;};
 const previousRenderAdmin=renderAdmin;
 renderAdmin=function(){const result=previousRenderAdmin.apply(this,arguments);renderInquiryBell();return result;};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshInquiryBell();});
 document.addEventListener('inquiry-read-updated',refreshInquiryBell);
 setInterval(refreshInquiryBell,30000);
 refreshInquiryBell();
})();
