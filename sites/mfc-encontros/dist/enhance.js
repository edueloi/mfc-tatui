/* MFC de Tatuí · camada extra de interação (progresso, cabeçalho, contadores, eventos, WhatsApp). */
(()=>{
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];

  /* Barra de progresso + cabeçalho que encolhe */
  const bar=document.createElement('div');bar.className='sp-bar';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar);
  const header=document.querySelector('body>header.shell');
  let ticking=false;
  const onScroll=()=>{
    if(ticking)return;ticking=true;
    requestAnimationFrame(()=>{
      const max=document.documentElement.scrollHeight-window.innerHeight;
      bar.style.setProperty('--p',max>0?Math.min(1,window.scrollY/max).toFixed(4):0);
      if(header)header.classList.toggle('is-scrolled',window.scrollY>12);
      ticking=false;
    });
  };
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  /* Entradas animadas com atraso escalonado */
  const revealIO=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-in');revealIO.unobserve(entry.target)}
  }),{threshold:.12,rootMargin:'0px 0px -6% 0px'});
  $$('[data-reveal]').forEach(el=>{
    const siblings=$$('[data-reveal]',el.parentElement).filter(s=>s.parentElement===el.parentElement);
    el.style.transitionDelay=reduce?'0ms':(siblings.indexOf(el)*90)+'ms';
    revealIO.observe(el);
  });

  /* Contadores */
  const fmt=n=>Math.round(n).toLocaleString('pt-BR');
  const countIO=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    const el=entry.target;countIO.unobserve(el);
    const sinceYear=Number(el.dataset.yearsSince);
    const target=sinceYear?new Date().getFullYear()-sinceYear:Number(el.dataset.count);
    const suffix=el.dataset.suffix||'';
    if(reduce||!isFinite(target)){el.innerHTML=fmt(target)+suffix;return}
    const t0=performance.now(),dur=1500;
    const step=now=>{
      const p=Math.min(1,(now-t0)/dur),eased=1-Math.pow(1-p,3);
      el.innerHTML=fmt(target*eased)+suffix;
      if(p<1)requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }),{threshold:.6});
  $$('[data-count],[data-years-since]').forEach(el=>{
    if(el.dataset.yearsSince)el.innerHTML=(new Date().getFullYear()-Number(el.dataset.yearsSince))+(el.dataset.suffix||'');
    countIO.observe(el);
  });

  /* Brilho que segue o cursor nos cards */
  const addSpot=card=>{
    if(card.dataset.spot)return;card.dataset.spot='1';
    card.classList.add('spot');
    const glow=document.createElement('i');glow.className='spot-glow';glow.setAttribute('aria-hidden','true');card.prepend(glow);
    card.addEventListener('pointermove',e=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty('--mx',(e.clientX-r.left)+'px');card.style.setProperty('--my',(e.clientY-r.top)+'px');
    },{passive:true});
  };
  const spotCards=()=>$$('.event-card:not(.skeleton-card),.num-card,.val-card,.honor-photo,.home-story-card').forEach(addSpot);
  spotCards();

  /* Eventos: selo de data, contagem regressiva e layout conforme a quantidade */
  const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const daysUntil=iso=>{
    const [y,m,d]=iso.slice(0,10).split('-').map(Number);
    const today=new Date();today.setHours(0,0,0,0);
    return Math.round((new Date(y,m-1,d)-today)/86400000);
  };
  const chipText=n=>n<0?'Em andamento':n===0?'É hoje!':n===1?'É amanhã':n<=45?`Faltam ${n} dias`:'Inscrições abertas';
  const applyEvents=events=>{
    events=events||[];
    const home=document.querySelector('.event-grid'),agenda=document.querySelector('.open-events');
    const target=agenda||home;
    if(!target||!events.length)return;
    target.classList.remove('n1','n2');
    const shown=agenda?events.length:Math.min(3,events.length);
    if(shown===1)target.classList.add('n1');else if(shown===2&&!agenda)target.classList.add('n2');
    const cards=$$(agenda?'.open-event':'.event-card',target);
    cards.forEach((card,i)=>{
      const ev=events[i];if(!ev||!ev.date||card.querySelector('.ev-meta'))return;
      const [,m,d]=ev.date.slice(0,10).split('-');
      const meta=document.createElement('div');meta.className='ev-meta';
      meta.innerHTML=`<span class="dbadge"><b>${d}</b><small>${MONTHS[Number(m)-1]||''}</small></span><span class="cd-chip">${chipText(daysUntil(ev.date))}</span>`;
      const anchor=agenda?card.querySelector('.open-event__top'):card.querySelector(':scope>div');
      if(agenda)anchor.append(meta);else anchor.prepend(meta);
    });
    spotCards();
  };
  document.addEventListener('mfc:events',e=>applyEvents(e.detail));
  // Se os eventos já foram desenhados antes deste arquivo carregar, aplica agora.
  if(window.__mfcEvents)applyEvents(window.__mfcEvents);

  /* Histórias: esconde o bloco enquanto não há nada publicado (evita um espaço vazio na home) */
  const stories=document.getElementById('home-stories');
  if(stories){
    const check=()=>{if(!stories.querySelector('.home-story-card')&&!stories.querySelector('.blog-loading')){const s=stories.closest('section');if(s)s.hidden=true}};
    setTimeout(check,2500);setTimeout(check,7000);
  }

  /* WhatsApp flutuante (fora da página de contato, que já tem o botão) */
  if(!/contato\.html$/.test(location.pathname)&&!/sistema\.html$/.test(location.pathname)){
    const msg=encodeURIComponent('Olá! Vim pelo site do MFC de Tatuí e gostaria de mais informações.');
    const a=document.createElement('a');
    a.className='wa-float';a.href='https://wa.me/551532590683?text='+msg;a.target='_blank';a.rel='noopener noreferrer';
    a.setAttribute('aria-label','Falar com o MFC de Tatuí no WhatsApp');
    a.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3C9.4 3 4 8.36 4 14.96c0 2.1.56 4.15 1.62 5.95L4 29l8.3-2.18a12.1 12.1 0 0 0 5.74 1.46C24.66 28.28 30 22.92 30 16.32 30 9.72 24.66 3 16.04 3Zm0 22.1c-1.8 0-3.56-.48-5.1-1.4l-.37-.22-4.93 1.3 1.32-4.8-.24-.38a9.9 9.9 0 0 1-1.52-5.3c0-5.45 4.5-9.9 10.04-9.9 5.54 0 10 4.45 10 9.9 0 5.47-4.46 9.8-9.2 9.8Zm5.5-7.36c-.3-.15-1.8-.88-2.08-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.08-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.46.13-.6.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.24-.25-.58-.5-.5-.68-.5h-.58c-.2 0-.53.08-.8.38-.28.3-1.06 1.04-1.06 2.5 0 1.48 1.08 2.9 1.23 3.1.15.2 2.1 3.2 5.1 4.48.7.3 1.26.5 1.7.62.72.23 1.37.2 1.88.12.58-.08 1.8-.74 2.05-1.45.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z"/></svg><span>Fale conosco</span>';
    document.body.appendChild(a);
  }
})();
