/**
 * Safety net for entrance animations, as a plain inline script so it works even if
 * React never hydrates (a blocked or failed bundle, an extension, a browser that pauses
 * animation frames). About 2.5s after load (the hero finishes in ~1.5s), if anything in
 * the viewport is still at opacity 0, it adds `motion-fallback` to <html> and globals.css
 * shows all page content in its final state. Without JavaScript, the <noscript> rules in
 * layout.tsx do the same.
 */
export const MOTION_FALLBACK_SCRIPT = `(function(){
  function stuck(){
    var vh=innerHeight,vw=innerWidth,els=document.querySelectorAll('main [style*="opacity"]');
    for(var i=0;i<els.length;i++){
      var r=els[i].getBoundingClientRect();
      if(!r.width||!r.height||r.bottom<=0||r.top>=vh||r.right<=0||r.left>=vw)continue;
      if(parseFloat(getComputedStyle(els[i]).opacity)<0.05)return true;
    }
    return false;
  }
  function check(){ if(stuck()) document.documentElement.classList.add("motion-fallback"); }
  function arm(){ setTimeout(check, 2500); }
  if(document.readyState==="complete") arm(); else addEventListener("load", arm);
})();`;
