(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const panel=$('#content-panel'),pages=[...document.querySelectorAll('[data-page]')],nodes=[...document.querySelectorAll('.graph-node')];
  const contact=$('#contact-dialog'),viewer=$('#image-dialog'),graph=$('.graph'),canvas=$('.graph-lines'),ctx=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),small=matchMedia('(max-width:700px)');
  const metrics=document.createElement('canvas').getContext('2d');
  const labels={me:['About me','Обо мне'],'x-global':['X.Global education','Школа X.Global'],polosa:['Polosa. pet project','Полоса. пет-проект'],impact:['Supported Access','Supported Access'],sela:['SELA','SELA']};
  let language='en',motionPaused=false;
  try{language=localStorage.getItem('portfolio-language')==='ru'?'ru':'en';motionPaused=localStorage.getItem('portfolio-motion')==='paused';}catch{}
  const media=window.createPortfolioMediaController(document.querySelectorAll('.panel-page video'));
  let active='me',transition=null,mediaOrigin=null,mediaKind='image',currentCaption=null;
  let width=0,height=0,raf=0,last=0,phase=0,rx=0,ry=0,targetX=0,targetY=0,hovered=false,touching=false;
  let positions=new Map(),pendingFrame=0;
  const scrollPositions=new Map(),title=key=>labels[key][language==='ru'?1:0];
  const track=(name,section=active)=>window.portfolioAnalytics?.track(name,section);
  document.documentElement.dataset.input='pointer';
  document.addEventListener('pointerdown',()=>document.documentElement.dataset.input='pointer',{passive:true});
  document.addEventListener('keydown',e=>{if(['Tab','ArrowDown','ArrowUp','Enter',' '].includes(e.key))document.documentElement.dataset.input='keyboard';});
  function applyLanguage(){
    document.documentElement.lang=language;
    document.querySelectorAll('[data-en][data-ru]').forEach(el=>el.textContent=el.dataset[language]);
    for(const attr of ['alt','aria'])document.querySelectorAll(`[data-en-${attr}][data-ru-${attr}]`).forEach(el=>el.setAttribute(attr==='aria'?'aria-label':attr,el.getAttribute(`data-${language}-${attr}`)));
    $('.language-button').textContent=language==='en'?'RU':'EN';
    $('.language-button').setAttribute('aria-label',language==='en'?'Switch to Russian':'Переключить на английский');
    document.title=language==='en'?'Nikita Kustov — Product & UX/UI Designer | Portfolio':'Никита Кустов — продуктовый и UX/UI дизайнер | Портфолио';
    $('meta[name=description]').content=language==='en'?'Nikita Kustov, Product and UX/UI Designer in Saint Petersburg. Portfolio: X.Global, Polosa, SELA, Supported Access and communication design.':'Никита Кустов — продуктовый и UX/UI дизайнер, Санкт-Петербург. Портфолио: X.Global, Полоса, SELA, Supported Access и коммуникационный дизайн.';
    panel.setAttribute('aria-label',title(active));$('#section-status').textContent=title(active);
    nodes.forEach(node=>{
      const key=node.dataset.target;node.setAttribute('aria-label',title(key));node.querySelector('.node-long').textContent=title(key);
      metrics.font=`${small.matches?12:13}px Arial`;
      const wanted=metrics.measureText(title(key)).width+40;
      node.style.setProperty('--expanded-width',`${Math.min(small.matches?210:260,Math.max(small.matches?115:150,wanted))}px`);
    });
    updateMotionControl();
  }
  function setBackground(key){
    document.querySelectorAll('[data-background]').forEach(el=>el.classList.toggle('is-active',el.dataset.background===key));
    document.documentElement.dataset.section=key;
    syncMedia();
  }
  function selectPage(key,animate=true){
    if(!labels[key])key='me';
    const changed=active!==key;scrollPositions.set(active,panel.scrollTop);
    transition?.cancel();
    media.pauseAll();
    const focusInPanel=panel.contains(document.activeElement);active=key;
    pages.forEach(p=>p.hidden=p.dataset.page!==key);
    nodes.forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.target===key)));
    panel.scrollTop=scrollPositions.get(key)||0;panel.setAttribute('aria-label',title(key));$('#section-status').textContent=title(key);
    setBackground(key);
    if(focusInPanel)panel.focus({preventScroll:true});
    if(animate&&!reduced.matches&&!motionPaused)transition=$(`#page-${key}`).animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.22,.8,.25,1)'});
    if(changed)track('section-open',key);
    if(small.matches&&changed&&animate){$('.content-shell').scrollIntoView({behavior:reduced.matches||motionPaused?'instant':'smooth',block:'start'});}
    scheduleDraw();
  }
  function fromHash(initial=false){
    let hash='';try{hash=decodeURIComponent(location.hash.slice(1));}catch{}
    if(hash==='content-panel')return;
    const aliases={top:'me',cv:'me',visual:'me',art:'me',work:'me',contacts:'me'};
    selectPage(aliases[hash]||hash||'me',!initial);
    if(hash==='contacts'&&!contact.open)contact.showModal();
    if(hash==='cv'||hash==='visual'||hash==='art'){
      const target=hash==='cv'?$('#cv'):$('#visual');
      if(hash!=='cv')target.querySelector('details').open=true;
      panel.scrollTop+=target.getBoundingClientRect().top-panel.getBoundingClientRect().top-15;
    }
  }
  nodes.forEach(n=>n.addEventListener('click',()=>{
    const key=n.dataset.target;if(location.hash===`#${key}`)selectPage(key);else{history.pushState(null,'',`#${key}`);selectPage(key);}
  }));
  document.querySelectorAll('a[href="#me"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#me');selectPage('me');}));
  window.addEventListener('hashchange',()=>fromHash());window.addEventListener('popstate',()=>fromHash());
  $('.language-button').addEventListener('click',()=>{language=language==='en'?'ru':'en';try{localStorage.setItem('portfolio-language',language);}catch{}applyLanguage();scheduleDraw();});
  $('[data-contact]').addEventListener('click',()=>{contact.showModal();syncMedia();track('contact-open');});
  contact.addEventListener('close',syncMedia);
  $('.dialog-close').addEventListener('click',()=>contact.close());
  contact.addEventListener('click',e=>{if(e.target===contact){const r=contact.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)contact.close();}});
  function openMedia(kind,src,caption,origin,at=0){
    mediaOrigin=origin;mediaKind=kind;currentCaption=caption;
    const im=viewer.querySelector('img'),video=viewer.querySelector('video');
    im.hidden=kind!=='image';video.hidden=kind!=='video';$('.viewer-zoom').hidden=kind!=='image';viewer.classList.remove('is-zoomed');
    $('.viewer-zoom').textContent=language==='en'?'Zoom in':'Увеличить';
    $('.viewer-caption').textContent=caption;
    if(kind==='image'){im.src=src;im.alt=caption;}else{
      media.pauseAll();video.src=src;video.poster=origin.closest('figure')?.querySelector('video')?.poster||'';
      video.muted=true;video.playsInline=true;
      video.onloadedmetadata=()=>{if(at>0&&at<video.duration)video.currentTime=at;if(!motionPaused&&!reduced.matches&&viewer.open)video.play().catch(()=>{});};
    }
    document.body.classList.add('viewer-open');viewer.showModal();syncMedia();$('.viewer-stage').scrollTop=0;track('media-open');
  }
  document.querySelectorAll('.panel-page a[data-media="image"]').forEach(link=>link.addEventListener('click',e=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();openMedia('image',link.getAttribute('href'),link.querySelector('img').alt,link);
  }));
  document.querySelectorAll('.expand-video').forEach(button=>button.addEventListener('click',()=>{
    const v=button.closest('figure').querySelector('video');openMedia('video',button.dataset.video,button.closest('figure').querySelector('figcaption')?.textContent||'',button,v.currentTime);
  }));
  // A click on video content opens the viewer; the lower native-control strip remains usable.
  document.querySelectorAll('.panel-page video').forEach(video=>video.addEventListener('click',event=>{
    const r=video.getBoundingClientRect();if(event.clientY<r.bottom-48){const b=video.closest('figure')?.querySelector('.expand-video');if(b){event.preventDefault();b.click();}}
  }));
  $('.image-close').addEventListener('click',()=>viewer.close());
  $('.viewer-zoom').addEventListener('click',()=>{const zoomed=viewer.classList.toggle('is-zoomed');$('.viewer-zoom').textContent=language==='en'?(zoomed?'Fit to screen':'Zoom in'):(zoomed?'Вписать в экран':'Увеличить');});
  viewer.addEventListener('click',e=>{if(e.target===viewer||e.target.classList.contains('viewer-stage'))viewer.close();});
  viewer.addEventListener('close',()=>{
    const v=viewer.querySelector('video');v.pause();v.removeAttribute('src');v.load();v.onloadedmetadata=null;
    document.body.classList.remove('viewer-open');viewer.classList.remove('is-zoomed');
    if(mediaOrigin?.isConnected)mediaOrigin.focus({preventScroll:true});
    syncMedia();
  });
  // Four spokes only. Every peripheral point is connected to Me once.
  const points={me:[0,0,.3],'x-global':[-.7,-.65,.08],polosa:[.7,-.65,-.15],sela:[-.7,.65,-.12],impact:[.7,.65,.16]};
  const edges=[['me','x-global'],['me','polosa'],['me','sela'],['me','impact']];
  nodes.forEach((n,i)=>n.style.setProperty('--node-index',i));
  function draw(time){
    if(!width||!height)return;
    const dt=Math.min((time-last)||16,40);last=time;
    const focused=graph.contains(document.activeElement)&&document.documentElement.dataset.input==='keyboard';
    const freeze=hovered||touching||focused||reduced.matches||motionPaused||contact.open||viewer.open;
    if(!freeze){phase+=dt/1000;rx+=(targetX-rx)*.028;ry+=(targetY-ry)*.028;}
    ctx.clearRect(0,0,width,height);
    const next=new Map();
    nodes.forEach((node,index)=>{
      const key=node.dataset.target,[x,y,z]=points[key];
      const xx=x*Math.cos(ry)+z*Math.sin(ry),zz=-x*Math.sin(ry)+z*Math.cos(ry),yy=y*Math.cos(rx)-zz*Math.sin(rx);
      const drift=key==='me'?2:small.matches?4:7;
      let px=width/2+xx*width*.43+Math.sin(phase*.29+index*1.8)*drift;
      let py=height/2+yy*height*.43+Math.cos(phase*.24+index*1.6)*drift;
      // Fixed safe anchors avoid chasing the point as its label expands.
      const edge=small.matches?62:95;px=Math.max(edge,Math.min(width-edge,px));py=Math.max(45,Math.min(height-45,py));
      const buttonWidth=node.getBoundingClientRect().width;
      // Grow peripheral labels toward the centre, keeping the point's outer anchor stable.
      const correction=key==='me'?0:x<0?Math.max(0,buttonWidth/2+5-px):Math.min(0,width-5-buttonWidth/2-px);
      node.style.left=`${px+correction}px`;node.style.top=`${py}px`;
      next.set(key,{x:px+correction,y:py,w:buttonWidth,h:node.getBoundingClientRect().height});
    });
    positions=next;
    for(const [a,b]of edges){const p=positions.get(a),q=positions.get(b);if(!p||!q)continue;
      const dx=q.x-p.x,dy=q.y-p.y,dist=Math.hypot(dx,dy);if(dist<1)continue;
      const trim=(node)=>Math.min(Math.abs(dx)>0?node.w/2/Math.abs(dx/dist):Infinity,Math.abs(dy)>0?node.h/2/Math.abs(dy/dist):Infinity);
      const ra=trim(p)+2,rb=trim(q)+2;
      ctx.beginPath();ctx.moveTo(p.x+dx/dist*ra,p.y+dy/dist*ra);ctx.lineTo(q.x-dx/dist*rb,q.y-dy/dist*rb);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.82)';ctx.stroke();
    }
  }
  function scheduleDraw(){cancelAnimationFrame(pendingFrame);pendingFrame=requestAnimationFrame(draw);}
  function loop(t){draw(t);raf=requestAnimationFrame(loop);}
  function run(){syncMedia();cancelAnimationFrame(raf);last=performance.now();if(!document.hidden&&!reduced.matches&&!motionPaused)raf=requestAnimationFrame(loop);else scheduleDraw();}
  function resize(){const r=graph.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);applyLanguage();scheduleDraw();}
  graph.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=graph.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    hovered=[...positions.values()].some(p=>Math.abs(x-p.x)<p.w/2+45&&Math.abs(y-p.y)<p.h/2+45);
    if(!hovered){targetY=(x/width-.5)*.1;targetX=-(y/height-.5)*.08;}
  });
  graph.addEventListener('pointerleave',()=>{hovered=false;targetX=targetY=0;});
  graph.addEventListener('pointerdown',()=>touching=true,{passive:true});
  window.addEventListener('pointerup',()=>touching=false,{passive:true});window.addEventListener('pointercancel',()=>touching=false,{passive:true});
  graph.addEventListener('focusin',scheduleDraw);graph.addEventListener('transitionend',scheduleDraw);
  document.addEventListener('visibilitychange',()=>{document.documentElement.classList.toggle('page-hidden',document.hidden);run();});
  function updateMotionControl(){document.documentElement.dataset.motion=motionPaused||reduced.matches?'paused':'running';const btn=$('.motion-toggle');btn.setAttribute('aria-pressed',String(motionPaused));btn.textContent=language==='en'?(motionPaused?'Resume motion':'Pause motion'):(motionPaused?'Включить анимацию':'Остановить анимацию');}
  function syncMedia(){
    const suspended=document.hidden||contact.open||viewer.open;
    const auto=!motionPaused&&!reduced.matches;
    media.sync({suspended,auto});
    document.querySelectorAll('.ambient video').forEach(video=>{
      const wanted=video.dataset.background===active&&!suspended&&auto;
      if(wanted){
        if(!video.getAttribute('src')){video.src=video.dataset.src;video.muted=true;video.load();}
        if(video.paused)video.play().then(()=>{if(video.dataset.background!==active||document.hidden||motionPaused||reduced.matches||contact.open||viewer.open)video.pause();}).catch(()=>{});
      }else video.pause();
    });
    if((document.hidden||motionPaused||reduced.matches)&&!viewer.querySelector('video').paused)viewer.querySelector('video').pause();
  }
  $('.motion-toggle').addEventListener('click',()=>{motionPaused=!motionPaused;try{localStorage.setItem('portfolio-motion',motionPaused?'paused':'running');}catch{}updateMotionControl();run();});
  reduced.addEventListener('change',()=>{updateMotionControl();run();});
  const arrival=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){graph.classList.add('has-arrived');arrival.disconnect();}},{threshold:.4});arrival.observe(graph);
  new ResizeObserver(resize).observe(graph);

  // Galleries retain natural image proportions and fit inside the reading frame.
  new ResizeObserver(()=>{
    const maxHeight=Math.min(520,panel.clientHeight*.68,panel.clientHeight-140);
    panel.style.setProperty('--gallery-media-height',`${Math.max(140,Math.floor(maxHeight))}px`);
  }).observe(panel);
  document.querySelectorAll('.media-gallery').forEach(gallery=>{
    const track=gallery.querySelector('.gallery-track'),items=[...track.querySelectorAll(':scope > figure')];
    const prev=gallery.querySelector('.gallery-prev'),next=gallery.querySelector('.gallery-next'),counter=gallery.querySelector('.gallery-count');
    let current=0,frame=0;
    function update(){
      const end=track.scrollWidth-track.clientWidth;
      if(track.scrollLeft>=end-2&&end>2)current=items.length-1;
      else{const left=track.getBoundingClientRect().left;let distance=Infinity;items.forEach((item,i)=>{const d=Math.abs(item.getBoundingClientRect().left-left-4);if(d<distance){distance=d;current=i;}});}
      counter.textContent=`${current+1} / ${items.length}`;prev.disabled=track.scrollLeft<=2;next.disabled=track.scrollLeft>=end-2;
    }
    function move(direction){
      const index=Math.max(0,Math.min(items.length-1,current+direction));
      const left=track.scrollLeft+items[index].getBoundingClientRect().left-track.getBoundingClientRect().left-4;
      track.scrollTo({left,behavior:motionPaused||reduced.matches?'auto':'smooth'});
    }
    prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
    track.addEventListener('keydown',event=>{if(event.target===track&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}});
    track.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);},{passive:true});
    new ResizeObserver(update).observe(track);update();
  });

  function placeNavigation(){const workspace=$('.workspace');if(small.matches)workspace.insertBefore(graph,$('.content-shell'));else workspace.append(graph);}
  small.addEventListener('change',placeNavigation);placeNavigation();
  applyLanguage();fromHash(true);run();
})();
