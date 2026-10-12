/* Strony artykułów: zgoda na osadzone posty (ten sam klucz co strona główna) i wczytanie posta po zgodzie. */
(function(){
  var $=function(id){return document.getElementById(id)};
  var KEY='hypers-consent', TTL=365*864e5;
  function getConsent(){try{var c=JSON.parse(localStorage.getItem(KEY));return c&&c.v&&Date.now()-c.t<TTL?c.v:null}catch(e){return null}}
  function allowed(){return (window.__consent||getConsent())==='all'}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function loadScript(src,id){return new Promise(function(res){if(document.getElementById(id)){res();return}
    var s=document.createElement('script');s.src=src;s.async=true;s.id=id;s.onload=res;s.onerror=res;document.body.appendChild(s)})}
  function mount(){
    var box=$('embed'); if(!box||box.dataset.mounted) return; box.dataset.mounted='1';
    var p=box.dataset.p, id=box.dataset.id, url=box.dataset.url, t=box.dataset.title;
    if(p==='yt') box.innerHTML='<iframe class="embed-frame embed-yt" src="https://www.youtube-nocookie.com/embed/'+esc(id)+'" title="'+esc(t)+' – film na YouTube" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>';
    if(p==='tt') box.innerHTML='<iframe class="embed-frame embed-tt" src="https://www.tiktok.com/embed/v2/'+esc(id)+'" title="'+esc(t)+' – film na TikToku" allow="encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe>';
    if(p==='ig'){
      box.innerHTML='<blockquote class="instagram-media" data-instgrm-permalink="'+esc(url)+'" data-instgrm-version="14" data-instgrm-captioned><a href="'+esc(url)+'" target="_blank" rel="noopener">Zobacz post na Instagramie</a></blockquote>';
      loadScript('https://www.instagram.com/embed.js','ig-embed').then(function(){if(window.instgrm)window.instgrm.Embeds.process()});
    }
    if(p==='x'){
      box.innerHTML='<blockquote class="twitter-tweet" data-dnt="true" data-lang="pl"><a href="'+esc(url)+'">Zobacz wpis na X</a></blockquote>';
      loadScript('https://platform.twitter.com/widgets.js','x-embed').then(function(){if(window.twttr&&twttr.widgets)twttr.widgets.load(box)});
    }
  }
  function setConsent(v){try{localStorage.setItem(KEY,JSON.stringify({v:v,t:Date.now()}))}catch(e){}
    window.__consent=v; $('consent').hidden=true; if(v==='all') mount()}
  function showConsent(){$('consent').hidden=false}
  $('c-yes').onclick=function(){setConsent('all')};
  $('c-no').onclick=function(){setConsent('necessary')};
  $('c-open').onclick=showConsent;
  if(!getConsent()) showConsent();
  var box=$('embed');
  if(box){
    if(allowed()) mount();
    else{
      var l=box.querySelector('[data-load]'), a=box.querySelector('[data-always]');
      if(l) l.onclick=mount; if(a) a.onclick=function(){setConsent('all')};
    }
  }
  /* miniatura maxresdefault nie zawsze istnieje: wtedy hqdefault */
  document.querySelectorAll('img[data-fallback]').forEach(function(img){
    function fb(){img.onerror=null;img.src=img.dataset.fallback}
    if(img.complete&&img.naturalWidth===0) fb(); else img.onerror=fb;
  });
})();
