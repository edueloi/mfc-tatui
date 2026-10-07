const isLocalPortal=['localhost','127.0.0.1'].includes(window.location.hostname);
const systemUrl=isLocalPortal?'http://localhost:3000':null;
document.querySelector('.announcement')?.remove();
document.querySelector('.mobile-toggle')?.addEventListener('click',()=>document.querySelector('.nav-links').classList.toggle('open'));
document.querySelectorAll('.nav > .small-btn').forEach(button=>{button.href=systemUrl||'sistema.html';button.innerHTML='Área do sistema <span>→</span>'});
document.querySelectorAll('.nav-links').forEach(menu=>{if(!menu.querySelector('.mobile-system'))menu.insertAdjacentHTML('beforeend','<a class="mobile-system" href="'+(systemUrl||'sistema.html')+'">Área do sistema <span>→</span></a>')});
document.querySelectorAll('.brand-mark').forEach(mark=>{mark.innerHTML='<img src="mfc-logo.png" alt="Logo do Movimento Familiar Cristão">'});
document.querySelectorAll('.footer-bottom').forEach(footer=>{footer.innerHTML='<span>© MFC de Tatuí • Desde 1965</span><a class="developer-credit" href="https://develoi.com.br" target="_blank" rel="noreferrer">Desenvolvido por <strong>Develoi Soluções Digitais</strong><span>↗</span></a>'});
document.querySelectorAll('.nav-links a[href="sobre.html"]').forEach(link=>{link.href='mfc-tatui.html';link.textContent='O MFC'});
document.querySelectorAll('a[href="sobre.html"]').forEach(link=>{if(link.textContent.includes('Conheça o MFC'))link.href='mfc-tatui.html'});
document.querySelectorAll('.nav-links').forEach(menu=>{if(!menu.querySelector('a[href="contato.html"]'))(menu.querySelector('.mobile-system')||menu).insertAdjacentHTML(menu.querySelector('.mobile-system')?'beforebegin':'beforeend','<a href="contato.html">Contato</a>')});
document.querySelectorAll('.footer h4').forEach(title=>{if(title.textContent.trim()==='Navegação'&&!title.parentElement.querySelector('a[href="contato.html"]'))title.insertAdjacentHTML('afterend','<a href="contato.html">Contato</a>')});
const systemForm=document.getElementById('login-form');
if(systemForm&&systemUrl){systemForm.innerHTML='<div class="eyebrow">Acesso restrito</div><h2>Entrar no sistema</h2><p>Você será direcionado para a tela oficial de login do MFC Gestão.</p><a class="small-btn" href="'+systemUrl+'">Ir para o login <span>→</span></a><a class="back-link" href="index.html">← Voltar ao site público</a>'}
const revealTargets=document.querySelectorAll('.section-title,.section-copy,.event-card,.story-art,.story-text,.step,.article,.list-event,.cta,.page-head .eyebrow,.page-head h1,.page-head p,.about-grid>div,.contact-band .shell');
const revealObserver=new IntersectionObserver((entries)=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target)}}),{threshold:.14});
revealTargets.forEach((target,index)=>{target.classList.add('reveal');target.style.transitionDelay=(index%3)*90+'ms';revealObserver.observe(target)});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(item=>item.classList.remove('active'));button.classList.add('active')}));
