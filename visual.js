/* ARTEMPI / digital matter. GPU particles, no runtime libraries or remote models. */
(() => {
  'use strict';
  const canvas = document.querySelector('#presence-canvas');
  const stage = document.querySelector('#visual-stage');
  const hero = document.querySelector('.hero');
  const motion = document.querySelector('.motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, inView = true, frame = 0, time = 0, last = 0;
  let targetShape = 0, shape = 0, mx = 0, my = 0, rx = 0, ry = 0;
  let width = 1, height = 1, dpr = 1, burst = 0, scrollProgress = 0;
  const gl = canvas.getContext('webgl', {alpha:true,antialias:false,powerPreference:'low-power',premultipliedAlpha:true});
  const forms = [...document.querySelectorAll('[data-form]')];
  function setMotion(){
    document.body.classList.toggle('motion-paused',paused);
    motion.setAttribute('aria-pressed',String(paused));
    motion.setAttribute('aria-label',paused?'Ativar efeitos animados':'Pausar efeitos animados');
    motion.innerHTML=paused?'▷ <span>Ativar efeitos</span>':'Ⅱ <span>Pausar efeitos</span>';
    if(paused){cancelAnimationFrame(frame);frame=0;draw();}else start();
    document.dispatchEvent(new CustomEvent('artempi:motion',{detail:{paused}}));
  }
  motion.addEventListener('click',()=>{paused=!paused;setMotion();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;setMotion();});
  let program, buffer, uniforms={};
  const mobileDevice=matchMedia('(max-width:760px)').matches;
  const economical=Boolean(navigator.connection?.saveData)||(navigator.hardwareConcurrency||8)<=4;
  const count = economical ? 12288 : mobileDevice ? 24576 : 40960;
  const vertex = `
    precision highp float;
    attribute vec3 aSeed;
    uniform float uTime,uShape,uScale,uSize,uHalo,uBurst,uScroll;
    uniform vec2 uResolution,uCenter,uMouse;
    varying vec3 vColor;
    varying float vAlpha;
    const float PI=3.14159265;
    vec3 curve(float t){return vec3((2.0+.62*cos(3.0*t))*cos(2.0*t),(2.0+.62*cos(3.0*t))*sin(2.0*t),.85*sin(3.0*t))*.64;}
    mat3 turnY(float a){return mat3(cos(a),0.,sin(a),0.,1.,0.,-sin(a),0.,cos(a));}
    mat3 turnX(float a){return mat3(1.,0.,0.,0.,cos(a),-sin(a),0.,sin(a),cos(a));}
    void main(){
      float t=aSeed.x*2.0*PI, v=aSeed.y*2.0*PI;
      vec3 c=curve(t), tangent=normalize(curve(t+.003)-c);
      vec3 n=normalize(cross(tangent,vec3(0.,0.,1.))), b=cross(tangent,n);
      float radius=.31+.055*sin(t*8.0+uTime*.48);
      vec3 normal=cos(v)*n+sin(v)*b;
      vec3 knot=c+normal*radius;
      float lat=acos(2.0*aSeed.x-1.0);
      float ripple=.07*sin(lat*17.0+v*3.0+uTime*.55)+.035*cos(v*9.0-uTime);
      vec3 sphere=vec3(sin(lat)*cos(v),cos(lat),sin(lat)*sin(v))*(1.6+ripple);
      float wx=(aSeed.x-.5)*3.9, wy=(aSeed.y-.5)*3.3;
      vec3 wave=vec3(wx,wy,.55*sin(wx*2.0+uTime*.6)*cos(wy*1.5-uTime*.35)+.16*sin(wx*5.0+wy*4.0+uTime*.8));
      vec3 p=mix(knot,sphere,clamp(uShape,0.,1.));
      p=mix(p,wave,clamp(uShape-1.,0.,1.));
      p+=normalize(p+.001)*uBurst*.13*sin(aSeed.z*24.0);
      p+=normalize(p+.001)*sin(uScroll*6.28318)*.11*sin(aSeed.z*18.0+uTime*.3);
      mat3 rot=turnY(-.38+uTime*.075+uMouse.x*.45+uScroll*.85)*turnX(.4+uMouse.y*.3-uScroll*.3);
      p=rot*p;
      float perspective=4.8/(4.8+p.z);
      vec2 pos=uCenter+p.xy*vec2(1.,-1.)*uScale*perspective;
      gl_Position=vec4(pos/uResolution*2.0-1.0,0.,1.);
      gl_Position.y=-gl_Position.y;
      float edge=pow(abs(dot(rot*normal,vec3(.4,.3,1.))),2.0);
      float gold=clamp(.5+.48*sin(t*1.0+v*.35)+edge*.2,0.,1.);
      vec3 emerald=vec3(.345,.612,.502), amber=vec3(.922,.682,.161), cream=vec3(.961,.933,.824);
      vColor=mix(emerald,amber,gold);
      vColor=mix(vColor,cream,edge*.28);
      float depth=clamp(1.-(p.z+2.0)/5.0,.15,1.0);
      vAlpha=(.52+edge*.4)*depth;
      if(uHalo>0.5){vAlpha*=.028;}
      gl_PointSize=(uHalo>0.5?8.0:2.2)*uSize*perspective*(.6+aSeed.z*.7);
    }`;
  const fragment=`precision highp float;varying vec3 vColor;varying float vAlpha;uniform float uHalo;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float glow=uHalo>.5?pow(1.-d,2.):smoothstep(1.,.3,d);float a=vAlpha*glow;gl_FragColor=vec4(vColor*a,a);}`;
  function compile(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  let available=false;
  if(gl){try{
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const data=new Float32Array(count*3);let seed=42;
    for(let i=0;i<count;i++){seed=(seed*16807)%2147483647;data[i*3]=(i%256+.5)/256;data[i*3+1]=(Math.floor(i/256)+.5)/(count/256);data[i*3+2]=seed/2147483647;}
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(program,'aSeed');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);
    for(const name of ['uTime','uShape','uScale','uSize','uHalo','uBurst','uScroll','uResolution','uCenter','uMouse'])uniforms[name]=gl.getUniformLocation(program,name);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    available=true;hero.classList.add('webgl-ready');
  }catch(error){console.warn('Visual 3D indisponível; composição estática ativada.',error.message);}}
  if(!available){canvas.hidden=true;forms.forEach(b=>{b.disabled=true;b.title='Variações 3D indisponíveis neste navegador';});document.querySelector('.visual-selector>.mono').textContent='COMPOSIÇÃO ESTÁTICA';}
  function resize(){const rect=stage.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(available)gl.viewport(0,0,canvas.width,canvas.height);draw();}
  function draw(){if(!available||!width)return;gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);
    const mobile=innerWidth<=760;
    gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uShape,shape);gl.uniform1f(uniforms.uBurst,burst);gl.uniform1f(uniforms.uScroll,scrollProgress);
    gl.uniform2f(uniforms.uResolution,width,height);gl.uniform2f(uniforms.uCenter,width*(mobile?.5:.74-scrollProgress*.025),height*(mobile?.53:.46+scrollProgress*.06));
    gl.uniform1f(uniforms.uScale,Math.min(height*(mobile?.25:.225),width*(mobile?.235:.265))*(1+Math.sin(scrollProgress*Math.PI)*.08));
    gl.uniform1f(uniforms.uSize,dpr);gl.uniform2f(uniforms.uMouse,rx,ry);
    if(!economical&&!mobileDevice){gl.uniform1f(uniforms.uHalo,1);gl.drawArrays(gl.POINTS,0,count);}
    gl.uniform1f(uniforms.uHalo,0);gl.drawArrays(gl.POINTS,0,count);
  }
  function tick(now){frame=0;if(paused||!inView||document.hidden)return;
    if(now-last>32){const dt=Math.min(now-last,60)/1000;last=now;time+=dt;shape+=(targetShape-shape)*.065;rx+=(mx-rx)*.04;ry+=(my-ry)*.04;burst*=.93;draw();}
    frame=requestAnimationFrame(tick);
  }
  function start(){if(available&&!frame&&!paused&&inView&&!document.hidden){last=performance.now();frame=requestAnimationFrame(tick);}}
  forms.forEach(b=>b.addEventListener('click',()=>{targetShape=Number(b.dataset.form);burst=1;forms.forEach(el=>el.setAttribute('aria-pressed',String(el===b)));if(paused){shape=targetShape;burst=0;draw();}}));
  hero.addEventListener('artempi:scroll',e=>{
    if(paused||reduced.matches)return;
    scrollProgress=e.detail.progress;targetShape=Math.min(2,scrollProgress/.87*2);
    forms.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.form)===Math.round(targetShape))));
    start();
  });
  hero.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=hero.getBoundingClientRect();mx=(e.clientX-r.left)/r.width-.5;my=(e.clientY-r.top)/r.height-.5;});
  hero.addEventListener('pointerleave',()=>{mx=my=0;});
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)start();},{threshold:0}).observe(hero);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();});
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});window.addEventListener('pageshow',start);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();available=false;cancelAnimationFrame(frame);frame=0;hero.classList.remove('webgl-ready');forms.forEach(b=>b.disabled=true);});
  resize();setMotion();
})();
