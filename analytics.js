(() => {
  'use strict';
  const config = window.PORTFOLIO_ANALYTICS || {};
  const code = config.goatcounterCode || '';
  const allowedHost = (config.productionHosts || []).includes(location.hostname);
  const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  let localOptOut = false;
  try {localOptOut = localStorage.getItem('portfolio-analytics-opt-out') === 'true';} catch {}
  const configured = /^[a-z0-9][a-z0-9-]{0,62}$/.test(code);
  const enabled = configured && allowedHost && !optedOut && !localOptOut;
  const queue = [];
  let loaded = false, failed = false;
  function send(payload) {
    if (config.debug) console.info('[Portfolio analytics]', payload);
    document.dispatchEvent(new CustomEvent('portfolio:analytics', {detail:payload}));
    if (!enabled || failed) return;
    if (loaded) {try {window.goatcounter.count(payload);} catch {}}
    else if (queue.length < 100) queue.push(payload);
  }
  window.portfolioAnalytics = Object.freeze({
    status: () => ({configured,enabled,loaded,failed}),
    track: (event, section = '') => {
      if (!/^[a-z0-9_-]+$/.test(event) || !/^[a-z0-9_-]*$/.test(section)) return;
      send({path:section ? `${event}-${section}` : event,title:event,event:true,referrer:'',no_session:true});
    }
  });
  if (enabled) {
    window.goatcounter = {no_onload:true,endpoint:`https://${code}.goatcounter.com/count`};
    const script=document.createElement('script');script.async=true;script.src='https://gc.zgo.at/count.js';
    script.onload=()=>{
      loaded=typeof window.goatcounter.count==='function';
      if (loaded) {for (const item of queue.splice(0)) {try {window.goatcounter.count(item);} catch {}}}
    };
    script.onerror=()=>{failed=true;queue.length=0;};
    document.head.append(script);
  }
  // One page view per document load. Section opens are separate events, not inflated visits.
  send({path:'/',title:'Nikita Kustov — Portfolio',event:false,referrer:''});
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link)return;
    const href=link.getAttribute('href'),section=document.querySelector('.panel-page:not([hidden])')?.dataset.page||'me';
    if(/^https:\/\/t\.me\/nekunst(?:[/?#]|$)/.test(href))window.portfolioAnalytics.track('contact-telegram',section);
    else if(href.startsWith('mailto:'))window.portfolioAnalytics.track('contact-email',section);
    else if(href.startsWith('tel:'))window.portfolioAnalytics.track('contact-phone',section);
    else if(href.startsWith('https://enchanting-sorbet-8102f4.netlify.app/'))window.portfolioAnalytics.track('open-polosa-mvp',section);
  });
})();
