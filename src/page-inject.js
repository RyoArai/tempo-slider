// TEMPO Slider - page inject (MAIN world)
//
// HTML <audio> 要素を使わず Web Audio API で直接再生するサイト、
// または DOM 外で new Audio() を使うサイトに対応するため、
// AudioContext.createBufferSource / AudioBufferSourceNode コンストラクタ、
// および HTMLMediaElement.play() をモンキーパッチして、
// 作成・再生されたソースの playbackRate を一括制御する。

(() => {
  'use strict';

  if (window.__tempoSliderInjected) return;
  window.__tempoSliderInjected = true;

  const MSG_TAG = '__tempoSlider';
  let currentRate = 1.0;
  const activeBufferSources = new Set();
  const activeMediaElements = new Set();
  let bufferSourceCount = 0;
  let mediaElementCount = 0;

  function registerBufferSource(source) {
    if (!source) return;
    activeBufferSources.add(source);
    bufferSourceCount++;
    try { source.playbackRate.value = currentRate; } catch (e) {}
    try {
      source.addEventListener('ended', () => activeBufferSources.delete(source));
    } catch (e) {}
  }

  function registerMediaElement(el) {
    if (!el || activeMediaElements.has(el)) return;
    activeMediaElements.add(el);
    mediaElementCount++;
    try { el.playbackRate = currentRate; } catch (e) {}
    try { el.preservesPitch = false; } catch (e) {}
    // 不要になった要素はガベージコレクト任せにせず、できれば明示削除
    // src 変更時にもう一度 register することで、解放のタイミングを取る
    const cleanupEvents = ['emptied'];
    cleanupEvents.forEach(ev => {
      el.addEventListener(ev, () => {
        // 解放しない（同じ要素が src 切替で使い回されるケースがある）
      });
    });
  }

  // ============================================================
  // AudioContext / AudioBufferSourceNode のパッチ
  // ============================================================
  function patchContext(Ctor) {
    if (!Ctor || !Ctor.prototype) return;
    const orig = Ctor.prototype.createBufferSource;
    if (!orig || orig.__tempoSliderPatched) return;
    Ctor.prototype.createBufferSource = function patchedCreateBufferSource() {
      const source = orig.apply(this, arguments);
      registerBufferSource(source);
      return source;
    };
    Ctor.prototype.createBufferSource.__tempoSliderPatched = true;
  }
  patchContext(window.AudioContext);
  patchContext(window.webkitAudioContext);

  if (window.AudioBufferSourceNode && !window.AudioBufferSourceNode.__tempoSliderPatched) {
    const Orig = window.AudioBufferSourceNode;
    const Proxied = new Proxy(Orig, {
      construct(target, args, newTarget) {
        const source = Reflect.construct(target, args, newTarget);
        registerBufferSource(source);
        return source;
      }
    });
    Proxied.__tempoSliderPatched = true;
    try { window.AudioBufferSourceNode = Proxied; } catch (e) {}
  }

  // ============================================================
  // HTMLMediaElement のパッチ
  // play() が呼ばれた要素は、DOM の有無に関わらず捕捉する
  // new Audio() / createElement('audio') どちらも HTMLAudioElement なので共通でカバー
  // ============================================================
  if (window.HTMLMediaElement && !HTMLMediaElement.prototype.play.__tempoSliderPatched) {
    const origPlay = HTMLMediaElement.prototype.play;
    const patchedPlay = function patchedPlay() {
      registerMediaElement(this);
      console.log('[TEMPO Slider] HTMLMediaElement.play()', this.tagName, this.currentSrc || this.src);
      return origPlay.apply(this, arguments);
    };
    patchedPlay.__tempoSliderPatched = true;
    HTMLMediaElement.prototype.play = patchedPlay;
  }

  // Audio コンストラクタもパッチ（DOM に追加されない new Audio() を捕捉）
  if (window.Audio && !window.Audio.__tempoSliderPatched) {
    const OrigAudio = window.Audio;
    const PatchedAudio = function PatchedAudio() {
      const el = OrigAudio.apply(Object.create(OrigAudio.prototype), arguments);
      registerMediaElement(el);
      return el;
    };
    PatchedAudio.prototype = OrigAudio.prototype;
    PatchedAudio.__tempoSliderPatched = true;
    try { window.Audio = PatchedAudio; } catch (e) {}
  }

  // ============================================================
  // テンポ適用
  // ============================================================
  function applyRate(rate) {
    currentRate = rate;
    let applied = 0;
    for (const src of activeBufferSources) {
      try { src.playbackRate.value = rate; applied++; } catch (e) {}
    }
    for (const el of activeMediaElements) {
      try { el.playbackRate = rate; applied++; } catch (e) {}
    }
    return applied;
  }

  // ============================================================
  // content.js との通信
  // ============================================================
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data;
    if (!data || data[MSG_TAG] !== true) return;

    switch (data.type) {
      case 'setRate':
        if (typeof data.rate === 'number' && isFinite(data.rate)) {
          const applied = applyRate(data.rate);
          console.log(`[TEMPO Slider] setRate(${data.rate}) → ${applied}/${activeBufferSources.size + activeMediaElements.size}`);
        }
        break;
      case 'ping':
        window.postMessage({
          [MSG_TAG]: true, type: 'pong',
          bufferSourceCount, mediaElementCount,
          activeBuffer: activeBufferSources.size,
          activeMedia: activeMediaElements.size,
          currentRate
        }, '*');
        break;
    }
  });

  // デバッグ用
  window.__tempoSliderDebug = {
    get state() {
      return {
        bufferSourceCount,
        mediaElementCount,
        activeBuffer: activeBufferSources.size,
        activeMedia: activeMediaElements.size,
        currentRate,
        mediaElements: [...activeMediaElements].map(el => ({
          tag: el.tagName,
          src: el.currentSrc || el.src,
          paused: el.paused,
          rate: el.playbackRate
        }))
      };
    },
    forceRate(r) { return applyRate(r); }
  };

  console.log('[TEMPO Slider] page-inject loaded (AudioContext + HTMLMediaElement patched)');
  window.postMessage({ [MSG_TAG]: true, type: 'inject-ready' }, '*');
})();
