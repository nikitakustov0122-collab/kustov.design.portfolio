/* Visibility-driven playback; a deliberate pause is remembered for the document. */
(() => {
  'use strict';
  window.createPortfolioMediaController = (videos, options = {}) => {
    let suspended = true, auto = false;
    const states = new Map();
    const pauseAutomatically = (video, state) => {
      if (!video.paused) { state.pendingPauses++; video.pause(); }
    };
    const shouldPlay = (video, state) => !suspended && auto && state.visible && !state.manualPaused && !state.ended && !video.closest('[hidden]');
    const update = (video, state) => {
      if (!shouldPlay(video,state)) {
        // Reduced motion disables autoplay, but still permits an explicit manual play.
        if (suspended || !state.visible || video.closest('[hidden]') || (state.wasAuto && !auto)) pauseAutomatically(video,state);
        return;
      }
      if (!video.paused || state.starting || state.blocked) return;
      state.starting = true; state.wasAuto = true;
      Promise.resolve(video.play()).then(() => {
        state.starting = false;
        if (!shouldPlay(video,state)) pauseAutomatically(video,state);
      }).catch(() => {state.starting = false; state.blocked = true;});
    };
    for (const video of videos) {
      const state = {visible:false,manualPaused:false,pendingPauses:0,starting:false,wasAuto:false,ended:false,blocked:false};
      states.set(video,state);video.muted=true;video.defaultMuted=true;
      video.addEventListener('pause',()=>{
        if (state.pendingPauses) {state.pendingPauses--;return;}
        if (!video.ended) state.manualPaused=true;
        state.wasAuto=false;
      });
      video.addEventListener('play',()=>{
        state.ended=false;state.blocked=false;
        if (!state.starting) {state.manualPaused=false;state.wasAuto=false;}
        if (suspended || !state.visible || video.closest('[hidden]')) pauseAutomatically(video,state);
      });
      video.addEventListener('ended',()=>{state.ended=true;});
    }
    const Observer=options.Observer || IntersectionObserver;
    const observer = new Observer(entries=>{
      for (const entry of entries) {
        const state=states.get(entry.target);state.visible=entry.isIntersecting && entry.intersectionRatio>=.25;
        update(entry.target,state);
      }
    },{root:null,threshold:[0,.25,.6,1]});
    states.forEach((state,video)=>observer.observe(video));
    return {
      sync(settings) {suspended=settings.suspended;auto=settings.auto;states.forEach((state,video)=>update(video,state));},
      pauseAll() {states.forEach((state,video)=>pauseAutomatically(video,state));},
      destroy() {observer.disconnect();states.forEach((state,video)=>pauseAutomatically(video,state));}
    };
  };
})();
