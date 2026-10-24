(() => {
  if (window.__X7_NATIVE_INPUT) return;
  window.__X7_NATIVE_INPUT = true;

  const keyMap = {
    KeyW:[87,'w'], KeyA:[65,'a'], KeyS:[83,'s'], KeyD:[68,'d'],
    Space:[32,' '], ControlLeft:[17,'Control'], ShiftLeft:[16,'Shift'],
    KeyR:[82,'r'], KeyB:[66,'b'], KeyE:[69,'e'], KeyQ:[81,'q'],
    KeyG:[71,'g'], KeyF:[70,'f'], Tab:[9,'Tab'],
    Digit1:[49,'1'], Digit2:[50,'2'], Digit3:[51,'3'],
    Insert:[45,'Insert'], F8:[119,'F8']
  };

  function targets() {
    const canvas = document.querySelector('#game canvas') || document.querySelector('canvas');
    const arr = [window, document, document.activeElement, canvas].filter(Boolean);
    return [...new Set(arr)];
  }

  window.__x7Key = function(code, down) {
    const info = keyMap[code] || [0, code];
    const type = down ? 'keydown' : 'keyup';

    for (const target of targets()) {
      try {
        const ev = new KeyboardEvent(type, {
          code,
          key: info[1],
          bubbles: true,
          cancelable: true,
          repeat: false
        });

        try { Object.defineProperty(ev, 'keyCode', {get:()=>info[0]}); } catch {}
        try { Object.defineProperty(ev, 'which', {get:()=>info[0]}); } catch {}

        target.dispatchEvent(ev);
      } catch {}
    }
  };

  window.__x7Mouse = function(button, down) {
    const type = down ? 'mousedown' : 'mouseup';
    const buttons = down ? (button === 2 ? 2 : 1) : 0;

    const canvas = document.querySelector('#game canvas') || document.querySelector('canvas');
    const target = canvas || document;

    try {
      const rect = canvas ? canvas.getBoundingClientRect() : {
        left:0, top:0, width:innerWidth, height:innerHeight
      };

      const ev = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button,
        buttons,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        view: window
      });

      target.dispatchEvent(ev);
      if (target !== document) document.dispatchEvent(ev);
    } catch {}
  };

  window.__x7Look = function(dx, dy) {
    const canvas = document.querySelector('#game canvas') || document.querySelector('canvas');
    const targets = [canvas, document, window].filter(Boolean);

    for (const target of targets) {
      try {
        const ev = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: innerWidth / 2,
          clientY: innerHeight / 2,
          view: window
        });

        try { Object.defineProperty(ev, 'movementX', {get:()=>dx}); } catch {}
        try { Object.defineProperty(ev, 'movementY', {get:()=>dy}); } catch {}
        try { Object.defineProperty(ev, 'mozMovementX', {get:()=>dx}); } catch {}
        try { Object.defineProperty(ev, 'mozMovementY', {get:()=>dy}); } catch {}

        target.dispatchEvent(ev);
      } catch {}
    }
  };

  // Keep links/popups inside the standalone app instead of throwing the player to Safari.
  try {
    window.open = function(url) {
      if (url) location.href = String(url);
      return window;
    };
  } catch {}

  document.addEventListener('contextmenu', e => e.preventDefault(), true);
})();
