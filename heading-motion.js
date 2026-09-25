(()=>{
 const headings=[...document.querySelectorAll('.soft-glow-title,[data-soft-glow],#noticeSection .notice-public-title')];
 headings.forEach(el=>el.classList.add('soft-glow-title'));
 if(!('IntersectionObserver' in window))return;
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
   // Reset only after leaving the viewport, avoiding threshold-edge flicker.
   if(!entry.isIntersecting)entry.target.classList.remove('is-in-view');
   else if(entry.intersectionRatio>=.2)entry.target.classList.add('is-in-view');
  }
 },{threshold:[0,.2]});
 headings.forEach(el=>observer.observe(el));
})();
