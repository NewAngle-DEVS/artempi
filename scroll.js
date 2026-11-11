/* A native-scroll film: no wheel interception, no scroll acceleration. */
(() => {
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hero=document.querySelector('.hero'),journey=document.querySelector('.hero-journey');
 const intro=document.querySelector('.hero-content');
 const chapters=[document.querySelector('.chapter-listen'),document.querySelector('.chapter-connect')];
 const scenes=[...document.querySelectorAll('[data-scene]')];
 const story=document.querySelector('.presence-story'),ticker=document.querySelector('.ticker');
 const vision=document.querySelector('.vision'),contact=document.querySelector('.contact-section');
 const cards=[...document.querySelectorAll('.world')];
 const fine=matchMedia('(hover:hover) and (pointer:fine)');
 const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
 const ramp=(v,a,b)=>clamp((v-a)/(b-a));
 let enabled=false,moving=false,pending=0,measurePending=0,lastProgress=-1,phase=-1;
 let bounds={};
 function measure(){
   const y=scrollY;
   bounds={top:journey.getBoundingClientRect().top+y,range:Math.max(1,journey.offsetHeight-hero.offsetHeight)};
   for(const [key,el] of Object.entries({story,vision,ticker,contact}))bounds[key]={top:el.getBoundingClientRect().top+y,height:el.offsetHeight};
   bounds.cards=cards.map(el=>({top:el.getBoundingClientRect().top+y,height:el.offsetHeight}));
   request();
 }
 function setChapter(el,opacity,offset){el.style.opacity=opacity.toFixed(3);el.style.transform=`translate3d(0,${offset.toFixed(1)}px,0)`;const active=opacity>.06;el.toggleAttribute('data-visible',active);el.setAttribute('aria-hidden',String(!active));}
 function update(){
   pending=0;if(!enabled)return;
   const y=scrollY,h=innerHeight,p=clamp((y-bounds.top)/bounds.range);
   if(Math.abs(p-lastProgress)>.0005){
   const initial=1-ramp(p,.12,.23),listen=ramp(p,.25,.36)*(1-ramp(p,.56,.65)),connect=ramp(p,.68,.8);
   hero.style.setProperty('--intro-opacity',initial.toFixed(3));hero.style.setProperty('--intro-y',`${-ramp(p,.05,.3)*64}px`);
   intro.toggleAttribute('data-inactive',initial<.01);intro.inert=initial<.01;
   setChapter(chapters[0],listen,(1-ramp(p,.25,.36))*42-ramp(p,.56,.65)*42);
   setChapter(chapters[1],connect,(1-connect)*42);
   hero.style.setProperty('--rail-opacity',String(1-ramp(p,.1,.35)*.65));
   hero.style.setProperty('--selector-opacity',String(1-ramp(p,.1,.35)*.4));
   hero.style.setProperty('--line-opacity',String(ramp(p,.13,.7)*.75));
   hero.style.setProperty('--ring-angle',`${p*75-25}deg`);hero.style.setProperty('--ring-scale',String(.8+p*.5));
   const current=p<.3?0:p<.66?1:2;
   if(current!==phase){phase=current;scenes.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===phase)));}
   scenes.forEach((b,i)=>b.style.setProperty('--scene-fill',String(clamp(p*3-i))));
   hero.dispatchEvent(new CustomEvent('artempi:scroll',{detail:{progress:p}}));lastProgress=p;
   }
   if(!moving)return;
   const progressFor=b=>clamp((y+h-b.top)/(h+b.height));
   const sp=progressFor(bounds.story);
   story.style.setProperty('--story-shift',`${(sp-.5)*(innerWidth>760?110:25)}px`);
   story.style.setProperty('--story-fill',`${ramp(sp,.18,.7)*100}%`);
   story.style.setProperty('--grid-y',`${(sp-.5)*100}px`);
   vision.style.setProperty('--asterisk-angle',`${progressFor(bounds.vision)*160}deg`);
   ticker.style.setProperty('--ticker-x',`${-progressFor(bounds.ticker)*350}px`);
   cards.forEach((card,i)=>card.style.setProperty('--art-y',`${(progressFor(bounds.cards[i])-.5)*-65}px`));
   const cp=progressFor(bounds.contact);
   contact.style.setProperty('--contact-angle',`${cp*45}deg`);contact.style.setProperty('--contact-scale',String(.85+cp*.35));
 }
 function request(){if(enabled&&!pending)pending=requestAnimationFrame(update);}
 function sync(){
   enabled=!reduced.matches&&innerHeight>=700;
   moving=enabled&&!document.body.classList.contains('motion-paused');
   document.body.classList.toggle('scroll-cinema',enabled);document.body.classList.toggle('scroll-effects',moving);
   if(!enabled){cancelAnimationFrame(pending);pending=0;intro.inert=false;intro.removeAttribute('data-inactive');chapters.forEach(el=>{el.removeAttribute('data-visible');el.setAttribute('aria-hidden','true');});}
   lastProgress=-1;measure();
 }
 scenes.forEach(b=>b.addEventListener('click',()=>{const stops=[0,.46,.94];scrollTo({top:bounds.top+stops[Number(b.dataset.scene)]*bounds.range,behavior:reduced.matches?'instant':'smooth'});}));
 cards.forEach(card=>{
   let rect=null;
   card.addEventListener('pointerenter',()=>{if(moving&&fine.matches)rect=card.getBoundingClientRect();});
   card.addEventListener('pointermove',e=>{if(!moving||!fine.matches||!rect)return;const x=clamp((e.clientX-rect.left)/rect.width),y=clamp((e.clientY-rect.top)/rect.height);card.style.setProperty('--tilt-x',`${(y-.5)*-5}deg`);card.style.setProperty('--tilt-y',`${(x-.5)*6}deg`);card.style.setProperty('--light-x',`${x*100}%`);card.style.setProperty('--light-y',`${y*100}%`);card.style.setProperty('--light-on','1');});
   card.addEventListener('pointerleave',()=>{rect=null;card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');card.style.setProperty('--light-on','0');});
 });
 function scheduleMeasure(){if(!measurePending)measurePending=requestAnimationFrame(()=>{measurePending=0;measure();});}
 new ResizeObserver(scheduleMeasure).observe(document.querySelector('main'));
 addEventListener('scroll',request,{passive:true});addEventListener('resize',sync,{passive:true});
 document.addEventListener('artempi:motion',sync);reduced.addEventListener('change',sync);
 if(document.fonts)document.fonts.ready.then(measure);
 addEventListener('pageshow',measure);
 sync();
})();
