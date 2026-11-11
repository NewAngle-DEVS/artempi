(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.body.classList.add('js-ready');
  $('#year').textContent = new Date().getFullYear();
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), {threshold: .08});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  const menu = $('.menu-toggle');
  function closeMenu() { menu.setAttribute('aria-expanded', 'false'); $('#navigation').classList.remove('open'); menu.setAttribute('aria-label', 'Abrir menu'); }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); $('#navigation').classList.toggle('open', open);
  });
  $('#navigation').addEventListener('click', e => { if(e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => {if(e.key === 'Escape') closeMenu();});
  window.addEventListener('resize', () => {if(innerWidth > 760) closeMenu();});
  let scrollPending = false;
  window.addEventListener('scroll', () => {
    if (scrollPending) return; scrollPending = true;
    requestAnimationFrame(() => { const max = document.documentElement.scrollHeight - innerHeight; $('.scroll-progress').style.width = `${max > 0 ? scrollY / max * 100 : 0}%`; scrollPending = false; });
  }, {passive:true});
  const privacy = $('#privacy-dialog');
  $('#privacy-open').addEventListener('click', () => privacy.showModal());
  $('.dialog-close').addEventListener('click', () => privacy.close());
  privacy.addEventListener('click', e => { if(e.target === privacy) {const r = privacy.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) privacy.close();} });

  // Clearly labelled scripted preview. No microphone, AI endpoint or credentials.
  const answers={
    business:'Meu conhecimento é preparado com as informações do seu negócio: serviços, horários, endereço e perguntas frequentes. Assim, cada conversa começa com o que realmente importa para seus clientes.',
    devices:'A proposta do ARTEMPI é ser leve. O próprio navegador desenha e anima o avatar, enquanto a inteligência funciona no servidor. Você precisa de um dispositivo compatível e conexão com a internet.',
    voice:'Sim! No atendimento real, você permite o microfone e conversa por voz. Pode até me interromper para fazer outra pergunta. Nesta prévia, você pode ativar a voz para ouvir as respostas de exemplo.'
  };
  const log=$('#chat-log'),initial=log.innerHTML;
  const shell=$('.demo-shell'),stopButton=$('#stop-demo'),resetButton=$('#reset-demo');
  let timer=0, sound=false, generation=0, speechToken=0, phase='ready', activeMessage=null;
  const explored=new Set();
  const synth=window.speechSynthesis;
  const wave=$('.demo-wave');
  for(let i=0;i<31;i++){const bar=document.createElement('i');bar.style.setProperty('--delay',`${(i%7)*-.09}s`);bar.style.setProperty('--amplitude',`${.3+Math.sin(i*1.7)**2*.7}`);wave.append(bar);}
  const buttons=[...document.querySelectorAll('[data-question]')];
  function status(state,text){
    phase=state;shell.dataset.state=state;
    const labels={ready:'À sua disposição',preparing:'Preparando a resposta',responding:'Respondendo',speaking:'Falando com você',interrupted:'Você tem a palavra',error:'Continue por texto'};
    $('#presence-label').textContent=labels[state];$('#demo-status').textContent=text;
    $('.demo-visual').classList.toggle('is-speaking',state==='responding'||state==='speaking');
    stopButton.disabled=!['preparing','responding','speaking'].includes(state);
  }
  function message(author,text,kind){
    const el=document.createElement('div');el.className=`chat-message ${kind}-message`;
    const label=document.createElement('span');label.className='message-author';
    if(kind==='avatar'){const mark=document.createElement('span');mark.className='author-mark';mark.setAttribute('aria-hidden','true');mark.textContent='✳';label.append(mark);}
    label.append(document.createTextNode(author));const p=document.createElement('p');p.textContent=text;
    el.append(label,p);log.append(el);while(log.children.length>40)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;return p;
  }
  function cancelCurrent(markInterrupted=false){
    clearTimeout(timer);generation++;speechToken++;
    if(synth)synth.cancel();
    if(activeMessage&&['preparing','responding'].includes(phase)){
      activeMessage.parentElement.classList.remove('is-pending');
      if(markInterrupted){
        if(phase==='preparing')activeMessage.textContent='Resposta interrompida antes de começar.';
        activeMessage.parentElement.classList.add('is-interrupted');
        const hint=document.createElement('p');hint.className='message-hint';hint.textContent='Você interrompeu. Escolha qualquer pergunta para continuar.';activeMessage.parentElement.append(hint);
      }
    }
    activeMessage=null;log.setAttribute('aria-busy','false');
  }
  function speak(text){
    if(!sound||!synth)return;
    const id=++speechToken;
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang='pt-BR';utterance.rate=1;
    const voice=synth.getVoices().find(v=>v.lang.toLowerCase()==='pt-br');if(voice)utterance.voice=voice;
    status('speaking','Ouça a resposta ou interrompa quando quiser.');
    utterance.onend=()=>{if(id===speechToken)status('ready','O próximo assunto é com você.');};
    utterance.onerror=()=>{if(id===speechToken){sound=false;$('#sound-toggle').setAttribute('aria-pressed','false');$('#sound-toggle span').textContent='Ouvir respostas';status('error','A voz está indisponível. A resposta continua aqui.');}};
    try{synth.speak(utterance);}catch{utterance.onerror();}
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{
    cancelCurrent(true);const id=generation;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    resetButton.disabled=false;
    message('VOCÊ',button.querySelector('.question-label').textContent,'user');
    log.setAttribute('aria-busy','true');
    const key=button.dataset.question,text=answers[key],target=message('ARTEMPI','Preparando a resposta…','avatar');
    activeMessage=target;target.parentElement.classList.add('is-pending');const words=text.split(' ');let i=0;
    status('preparing','Um instante. A conversa já vai continuar.');
    const write=()=>{
      if(id!==generation)return;
      if(i===0){status('responding','Você pode interromper ou escolher outra pergunta.');target.parentElement.classList.remove('is-pending');}
      i=reduced.matches?words.length:i+1;target.textContent=words.slice(0,i).join(' ');log.scrollTop=log.scrollHeight;
      if(i<words.length)timer=setTimeout(write,36);
      else{activeMessage=null;log.setAttribute('aria-busy','false');explored.add(key);$('#demo-progress').textContent=`${String(explored.size).padStart(2,'0')} / 03`;status('ready','O próximo assunto é com você.');speak(text);}
    };
    timer=setTimeout(write,280);
  }));
  stopButton.addEventListener('click',()=>{cancelCurrent(true);status('interrupted','Escolha uma pergunta para retomar.');});
  resetButton.addEventListener('click',()=>{
    cancelCurrent();log.innerHTML=initial;log.scrollTop=0;explored.clear();$('#demo-progress').textContent='00 / 03';
    buttons.forEach(b=>b.setAttribute('aria-pressed','false'));resetButton.disabled=true;status('ready','Escolha um assunto para começar.');buttons[0].focus({preventScroll:true});
  });
  if(!synth||!window.SpeechSynthesisUtterance){$('#sound-toggle').disabled=true;$('#sound-toggle span').textContent='Voz indisponível';$('#sound-toggle').title='Leitura por voz não disponível neste navegador';}
  $('#sound-toggle').addEventListener('click',()=>{
    sound=!sound;$('#sound-toggle').setAttribute('aria-pressed',String(sound));$('#sound-toggle span').textContent=sound?'Voz ativada':'Ouvir respostas';
    if(!sound){speechToken++;synth.cancel();if(phase==='speaking')status('ready','Leitura encerrada. Continue por texto.');}
    else if(!['preparing','responding'].includes(phase))status('ready','Voz ativada. Escolha uma pergunta para ouvir.');
  });
  window.addEventListener('pagehide',()=>{cancelCurrent();});
  window.addEventListener('pageshow',()=>{if(['preparing','responding','speaking'].includes(phase))status('ready','Escolha um assunto para continuar.');});
  const effectsObserver=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.toggleAttribute('data-offscreen',!entry.isIntersecting)),{rootMargin:'120px'});
  document.querySelectorAll('main>section,.hero-journey').forEach(el=>effectsObserver.observe(el));
  document.addEventListener('visibilitychange',()=>document.body.classList.toggle('page-inactive',document.hidden));
})();
