const isLocalPortal=['localhost','127.0.0.1'].includes(window.location.hostname);
// Servido junto com o sistema (em /site/): o botão leva à tela de login do sistema, na mesma porta.
const servedWithSystem=window.location.pathname.startsWith('/site/');
const systemUrl=servedWithSystem?'/entrar':(isLocalPortal?'http://localhost:3000/entrar':null);
document.querySelector('.announcement')?.remove();
document.querySelector('.mobile-toggle')?.addEventListener('click',()=>document.querySelector('.nav-links').classList.toggle('open'));
document.querySelectorAll('.nav > .small-btn').forEach(button=>{button.href=systemUrl||'sistema.html';button.innerHTML='Área do sistema <span>→</span>'});
document.querySelectorAll('.nav-links').forEach(menu=>{if(!menu.querySelector('.mobile-system'))menu.insertAdjacentHTML('beforeend','<a class="mobile-system" href="'+(systemUrl||'sistema.html')+'">Área do sistema <span>→</span></a>')});
document.querySelectorAll('.brand-mark').forEach(mark=>{mark.innerHTML='<img src="mfc-logo.png" alt="Logo do Movimento Familiar Cristão">'});
document.querySelectorAll('.footer').forEach(footer=>{footer.innerHTML=`
  <div class="footer-glow footer-glow-one"></div><div class="footer-glow footer-glow-two"></div>
  <div class="shell footer-shell">
    <section class="footer-invitation">
      <div><span class="footer-kicker">MFC DE TATUÍ</span><h2>Famílias que caminham <em>juntas.</em></h2></div>
      <a class="footer-agenda" href="eventos.html">Ver agenda <span>→</span></a>
    </section>
    <div class="footer-top footer-content">
      <div class="footer-brand"><a class="footer-logo" href="index.html"><img src="mfc-logo.png" alt="MFC de Tatuí"><span>Movimento<br><strong>Familiar Cristão</strong></span></a><p>Uma comunidade de fé, acolhida e serviço que aproxima famílias em Tatuí.</p><a class="footer-instagram" href="https://www.instagram.com/mfctatui/" target="_blank" rel="noopener noreferrer"><b>◎</b> @mfctatui <span>↗</span></a></div>
      <div class="footer-column"><h4>Conheça</h4><a href="mfc-tatui.html">O MFC</a><a href="historias.html">Histórias e fotos</a><a href="eventos.html">Agenda de encontros</a></div>
      <div class="footer-column"><h4>Participar</h4><a href="eventos.html#eventos-abertos">Inscrições abertas</a><a href="contato.html">Fale com a equipe</a><a href="mailto:contato@mfctatui.org.br">Enviar e-mail</a></div>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} MFC de Tatuí · Desde 1965</span><span>Famílias evangelizando famílias.</span><a class="developer-credit" href="https://develoi.com.br" target="_blank" rel="noreferrer">Desenvolvido por <strong>Develoi Soluções Digitais</strong><i>↗</i></a></div>
  </div>`});
document.querySelectorAll('.nav-links a[href="sobre.html"]').forEach(link=>{link.href='mfc-tatui.html';link.textContent='O MFC'});
document.querySelectorAll('a[href="sobre.html"]').forEach(link=>{if(link.textContent.includes('Conheça o MFC'))link.href='mfc-tatui.html'});
document.querySelectorAll('.nav-links').forEach(menu=>{if(!menu.querySelector('a[href="contato.html"]'))(menu.querySelector('.mobile-system')||menu).insertAdjacentHTML(menu.querySelector('.mobile-system')?'beforebegin':'beforeend','<a href="contato.html">Contato</a>')});
document.querySelectorAll('.footer h4').forEach(title=>{if(title.textContent.trim()==='Navegação'&&!title.parentElement.querySelector('a[href="contato.html"]'))title.insertAdjacentHTML('afterend','<a href="contato.html">Contato</a>')});
const systemForm=document.getElementById('login-form');
if(systemForm&&systemUrl){systemForm.innerHTML='<div class="eyebrow">Acesso restrito</div><h2>Entrar no sistema</h2><p>Você será direcionado para a tela oficial de login do MFC Gestão.</p><a class="small-btn" href="'+systemUrl+'">Ir para o login <span>→</span></a><a class="back-link" href="index.html">← Voltar ao site público</a>'}
const revealTargets=document.querySelectorAll('.section-title,.section-copy,.event-card,.story-art,.story-text,.step,.article,.list-event,.cta,.page-head .eyebrow,.page-head h1,.page-head p,.about-grid>div,.contact-band .shell,.how h2,.how-list li,.banner figure,.about-cols>*,.timeline li,.values-list li,.act,.recognition-layout>*,.contact-rows>*,.map-frame,.shop-box,.agenda-title,.stories-list-head,.honor-grid>*,.closing-inner');
const revealObserver=new IntersectionObserver((entries)=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target)}}),{threshold:.14});
revealTargets.forEach((target,index)=>{target.classList.add('reveal');target.style.transitionDelay=(index%3)*90+'ms';revealObserver.observe(target)});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(item=>item.classList.remove('active'));button.classList.add('active')}));

const openEvents=document.getElementById('open-events');
const homeEvents=!openEvents?document.querySelector('.event-grid'):null;
if(openEvents||homeEvents){
  const eventsTarget=openEvents||homeEvents;
  const apiUrl=window.MFC_API_URL||(isLocalPortal?'http://localhost:4000':'');
  const appUrl=window.MFC_APP_URL||(isLocalPortal?'http://localhost:3000':window.location.origin);
  const escapeHtml=value=>String(value||'').replace(/[&<>'"]/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const formatDate=value=>{if(!value)return 'Data a confirmar';const [year,month,day]=value.slice(0,10).split('-');return `${day}/${month}/${year}`};
  const renderEvents=events=>{
    if(!events.length){eventsTarget.innerHTML=openEvents?'<div class="agenda-empty"><span>✦</span><h3>Nenhuma inscrição aberta neste momento.</h3><p>Em breve teremos novos encontros. Volte para conferir a agenda.</p></div>':'<a class="event-card solid" href="eventos.html"><div><div class="event-type">Agenda</div><h3>Novos encontros em breve</h3></div><div><div class="date">Acompanhe a agenda</div><span class="arrow">↗</span></div></a>';return}
    if(!openEvents){eventsTarget.innerHTML=events.slice(0,3).map((event,index)=>{const formLink=`${appUrl}/eventos/inscricao/${encodeURIComponent(event.publicToken)}`;return `<a class="event-card ${index===0?'featured':index===1?'solid':'light'}" href="${formLink}" target="_blank" rel="noopener noreferrer" aria-label="Inscrever-se em ${escapeHtml(event.name)} em nova aba"><div><div class="event-type">${event.bridal?'Encontro de noivos':'Inscrição aberta'}</div><h3>${escapeHtml(event.name)}</h3></div><div><div class="date">${formatDate(event.date)}${event.startTime?` • ${event.startTime}`:''}</div><span class="arrow">↗</span></div></a>`}).join('');return}
    eventsTarget.innerHTML=events.map((event,index)=>{
      const when=[formatDate(event.date),event.startTime].filter(Boolean).join(' • ');
      const formLink=`${appUrl}/eventos/inscricao/${encodeURIComponent(event.publicToken)}`;
      return `<article class="open-event ${index===0?'open-event--featured':''}"><div class="open-event__glow"></div><div class="open-event__ribbon">${event.bridal?'♥ Para o casal':'✦ Vagas abertas'}</div><div class="open-event__top"><span class="open-event__tag">${event.bridal?'Encontro de noivos':'Inscrição aberta'}</span><span class="open-event__number">0${index+1}</span></div><div class="open-event__body"><h3>${escapeHtml(event.name)}</h3><p>${escapeHtml(event.description|| (event.bridal?'Uma experiência de preparação e acolhida para o casal.':'Um encontro especial para viver, partilhar e caminhar junto.'))}</p></div><div class="open-event__footer"><div class="open-event__details"><strong><i>◷</i> ${when}</strong><span><i>⌖</i> ${escapeHtml(event.location||'Tatuí • SP')}</span></div><a href="${formLink}" target="_blank" rel="noopener noreferrer" class="event-signup" aria-label="Abrir inscrição de ${escapeHtml(event.name)} em nova aba">Fazer inscrição <b>→</b></a></div></article>`;
    }).join('');
  };
  if(!apiUrl){eventsTarget.innerHTML='<div class="agenda-empty"><span>✦</span><h3>Abra o site pelo endereço local do sistema.</h3><p>Use <strong>http://localhost:4000/site/</strong> para carregar os eventos e as inscrições abertas.</p></div>'}
  else fetch(`${apiUrl}/events/public-open`).then(response=>response.ok?response.json():Promise.reject()).then(renderEvents).catch(()=>{eventsTarget.innerHTML=openEvents?'<div class="agenda-empty"><span>✦</span><h3>Não foi possível atualizar a agenda agora.</h3><p>Verifique se o sistema está em execução e tente atualizar a página.</p></div>':''});
}

document.querySelectorAll('a').forEach(link=>{if(link.textContent.trim().toLowerCase()==='instagram'){link.href='https://www.instagram.com/mfctatui/';link.target='_blank';link.rel='noopener noreferrer'}});
const blogFeature=document.getElementById('blog-feature');
const blogPosts=document.getElementById('blog-posts');
if(blogFeature||blogPosts){
  const blogApi=window.MFC_API_URL||(isLocalPortal?'http://localhost:4000':'');
  const blogEscape=value=>String(value||'').replace(/[&<>'"]/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const blogImage=value=>value&&value.startsWith('/uploads/')?`${blogApi}${value}`:value;
  const blogDate=value=>value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(value.replace(' ','T'))):'';
  const openStory=post=>{const images=[post.coverImage,...(post.images||[]).map(image=>image.imageUrl)].filter(Boolean);let index=0;const dialog=document.createElement('dialog');dialog.className='story-dialog';const render=()=>{dialog.innerHTML=`<button class="story-close" aria-label="Fechar história">×</button><div class="story-dialog__content">${images.length?`<div class="story-carousel"><img src="${blogEscape(blogImage(images[index]))}" alt="${blogEscape(post.title)}">${images.length>1?`<button class="carousel-arrow prev" aria-label="Foto anterior">‹</button><button class="carousel-arrow next" aria-label="Próxima foto">›</button><span class="carousel-count">${index+1} / ${images.length}</span>`:''}</div>`:''}<div class="story-dialog__text"><small>${blogDate(post.publishedAt)}</small><h2>${blogEscape(post.title)}</h2><p>${blogEscape(post.content||post.excerpt).replace(/\n/g,'<br>')}</p></div></div>`;dialog.querySelector('.story-close').onclick=()=>dialog.close();dialog.querySelector('.prev')?.addEventListener('click',()=>{index=(index-1+images.length)%images.length;render()});dialog.querySelector('.next')?.addEventListener('click',()=>{index=(index+1)%images.length;render()})};render();dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal()};
  const renderBlog=posts=>{const published=posts.filter(post=>post.published);const featured=published.find(post=>post.featured)||published[0];if(blogFeature){blogFeature.innerHTML=featured?`<div class="shell"><article class="feature-story"><div class="feature-story-image" style="background-image:linear-gradient(0deg,rgba(7,30,77,.3),transparent 65%),url('${blogEscape(blogImage(featured.coverImage||featured.images?.[0]?.imageUrl||''))}')"></div><div class="feature-story-copy"><div class="story-label">Destaque · ${blogDate(featured.publishedAt)}</div><h2>${blogEscape(featured.title)}</h2><p>${blogEscape(featured.excerpt||featured.content)}</p><button class="text-link blog-read" data-id="${featured.id}">Ler e ver fotos <span>→</span></button></div></article></div>`:'<div class="shell"><div class="blog-empty">Em breve, novas histórias da nossa caminhada aparecerão aqui.</div></div>'};if(blogPosts){const others=published.filter(post=>post.id!==featured?.id);blogPosts.innerHTML=others.length?others.map(post=>`<article class="article blog-card"><button class="blog-card__image blog-read" data-id="${post.id}" style="background-image:url('${blogEscape(blogImage(post.coverImage||post.images?.[0]?.imageUrl||''))}')"><span>${post.images?.length||0} fotos</span></button><div class="article-body"><small>${blogDate(post.publishedAt)}</small><h2>${blogEscape(post.title)}</h2><p>${blogEscape(post.excerpt||post.content)}</p><button class="text-link blog-read" data-id="${post.id}">Ler história <span>→</span></button></div></article>`).join(''):'<div class="blog-empty">Ainda não há outras publicações. Volte em breve.</div>'}document.querySelectorAll('.blog-read').forEach(button=>button.addEventListener('click',()=>{const post=published.find(item=>item.id===button.dataset.id);if(post)openStory(post)}))};
  if(!blogApi){renderBlog([])}else fetch(`${blogApi}/blog/public`).then(response=>response.ok?response.json():Promise.reject()).then(renderBlog).catch(()=>{if(blogFeature)blogFeature.innerHTML='<div class="shell"><div class="blog-empty">Não foi possível carregar as histórias agora.</div></div>';if(blogPosts)blogPosts.innerHTML=''})
}
const homeStories=document.getElementById('home-stories');
if(homeStories){
  const homeBlogApi=window.MFC_API_URL||(isLocalPortal?'http://localhost:4000':'');
  const homeEscape=value=>String(value||'').replace(/[&<>'"]/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const homeImage=value=>value&&value.startsWith('/uploads/')?`${homeBlogApi}${value}`:value;
  if(!homeBlogApi) homeStories.innerHTML=''; else fetch(`${homeBlogApi}/blog/public`).then(response=>response.ok?response.json():Promise.reject()).then(posts=>{const items=posts.slice(0,3);homeStories.innerHTML=items.length?items.map(post=>`<a class="home-story-card" href="historias.html"><div class="home-story-card__image" style="background-image:url('${homeEscape(homeImage(post.coverImage||post.images?.[0]?.imageUrl||''))}')"></div><div><small>${post.images?.length||0} fotos · História do MFC</small><h3>${homeEscape(post.title)}</h3><p>${homeEscape(post.excerpt||post.content)}</p><span>Ler história →</span></div></a>`).join(''):''}).catch(()=>{homeStories.innerHTML=''})
}

// Efeitos visuais da home e das páginas públicas
(()=>{
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Declaração: palavras acendem conforme o scroll
  const statement=document.querySelector('.statement p');
  if(statement){
    const words=statement.textContent.trim().split(/\s+/);
    statement.setAttribute('aria-label',statement.textContent.trim());
    statement.innerHTML=words.map(w=>'<span class="w" aria-hidden="true">'+w+'</span>').join(' ');
    const spans=[...statement.querySelectorAll('.w')];
    const paint=()=>{
      const r=statement.getBoundingClientRect(),vh=window.innerHeight;
      const p=reduce?1:Math.min(1,Math.max(0,(vh*.88-r.top)/(r.height+vh*.35)));
      const lit=p*(spans.length+3);
      spans.forEach((el,i)=>el.classList.toggle('on',i<lit));
    };
    paint();window.addEventListener('scroll',paint,{passive:true});window.addEventListener('resize',paint);
  }
  if(reduce)return;
  // Parallax leve nas fotos do hero
  const depthEls=[...document.querySelectorAll('[data-depth]')];
  if(depthEls.length){
    let ticking=false;
    const run=()=>{ticking=false;const y=window.scrollY;if(y>900)return;depthEls.forEach(el=>el.style.setProperty('--py',(y*parseFloat(el.dataset.depth)).toFixed(1)+'px'))};
    window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(run)}},{passive:true});
  }
  // Luz que segue o cursor nos cartões
  document.addEventListener('pointermove',event=>{
    const card=event.target.closest?.('.event-card,.open-event,.home-story-card,.honor-text');
    if(!card)return;
    const r=card.getBoundingClientRect();
    card.style.setProperty('--mx',(event.clientX-r.left)+'px');
    card.style.setProperty('--my',(event.clientY-r.top)+'px');
  },{passive:true});
})();

// Menu: ícone animado, estado ao rolar, esconde ao descer e painel no celular
(()=>{
  const header=document.querySelector('body > header');
  const toggle=document.querySelector('.mobile-toggle');
  const menu=document.querySelector('.nav-links');
  if(toggle){toggle.innerHTML='<span></span><span></span><span></span>';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','menu-principal')}
  if(menu)menu.id='menu-principal';
  const setOpen=open=>{
    menu?.classList.toggle('open',open);
    toggle?.setAttribute('aria-expanded',String(open));
    toggle?.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
    document.body.classList.toggle('menu-open',open);
  };
  toggle?.addEventListener('click',e=>{e.stopImmediatePropagation();setOpen(!menu.classList.contains('open'))},true);
  menu?.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});
  window.addEventListener('resize',()=>{if(window.innerWidth>800)setOpen(false)});
  if(!header)return;
  let last=window.scrollY;
  const onScroll=()=>{
    const y=window.scrollY;
    header.classList.toggle('is-scrolled',y>8);
    const down=y>last&&y>160;
    header.classList.toggle('is-hidden',down&&!document.body.classList.contains('menu-open'));
    last=y;
  };
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
})();
