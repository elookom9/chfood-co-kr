(()=>{
 const pending=new Set();
 document.addEventListener('click',async event=>{
  const button=event.target.closest?.('.view-inquiry');
  if(!button||typeof chProfile==='undefined'||!chProfile?.approved||chProfile.role!=='admin')return;
  const item=data.inquiries.find(x=>x.id===button.dataset.id);
  if(!item)return;
  event.preventDefault();event.stopImmediatePropagation();
  openEditor('문의 상세',inquiryForm(item));
  if(item.status!=='신규'||pending.has(item.id))return;
  pending.add(item.id);
  const form=document.querySelector('#inquiryAdminForm');
  const select=form?.querySelector('[name="status"]'),submit=form?.querySelector('button.primary-admin');
  if(select)select.disabled=true;if(submit)submit.disabled=true;
  try{
   const {data:rows,error}=await chSupabase.from('inquiries').update({status:'확인중'}).eq('id',item.id).eq('status','신규').select('id,status');
   if(error)throw error;
   if(!rows?.length)throw new Error('문의 상태가 변경됐습니다. 목록을 새로 열어 주세요.');
   item.status=rows[0].status;
   if(select)select.value=item.status;
   const row=button.closest('tr'),cell=row?.querySelector('.inquiry-read-cell');
   if(cell)cell.innerHTML='<span class="status">읽음</span>';
   const status=row?.children[4]?.querySelector('.status');
   if(status){status.textContent=item.status;status.classList.remove('new');}
   document.dispatchEvent(new Event('inquiry-read-updated'));
  }catch(error){toast('읽음 표시 저장 실패: '+error.message);}
  finally{pending.delete(item.id);if(select)select.disabled=false;if(submit)submit.disabled=false;}
 },true);
})();
