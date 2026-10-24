// ==UserScript==
// @name         XCLUTCH v15 | Fixed Trainer and FUN
// @namespace    local.xclutch.clutcher
// @version      15.0.0
// @description  Local-only visual ESP and optional aim assistance for game builds exposing window.game (Insert menu).
// @match        https://clutcher.io/*
// @match        https://www.clutcher.io/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(() => {
  'use strict';
  if (window.__XCLUTCH_MENU) return;
  window.__XCLUTCH_MENU = true;

  const KEY = 'xclutch_clutcher_v8';
  const defaults = {
    esp: true, box: true, names: true, health: true, distance: true,
    tracers: false, aim: false, aimFov: 14, smooth: 7, showFov: true,
    aimBone: 'head', color: '#ae79ff', visibleOnly:true, triggerbot:false, rage:false, bhop:false, speed:false, speedMult:1.45, noRecoil:false, skinChanger:false, skinPreset:'original', skinCustomColor:'#aa66ff', knifeModel:'default', thirdPerson:false, thirdDistance:3.6, povFov:0, mapMode:'original', arenaLift:45, noClip:false, flySpeed:9, freezeBots:false, aimTrainer:false, trainerDuration:60, mapFill:false, mapFillColor:'#888888', liteRender:false, rainbowCrosshair:false, funNight:false, funVhs:false, funCinema:false, funPixel:false, funInvert:false, funGiantBots:false, funPulse:false
  };
  let cfg;
  try { cfg = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('x7_purple_clutcher_v7') || localStorage.getItem('x7_purple_clutcher_v6') || '{}')); }
  catch { cfg = { ...defaults }; }
  // User requested WH on immediately on every fresh page load, even if a previous profile was disabled.
  cfg.esp = true;
  // Never resume a training session without an explicit new click.
  cfg.aimTrainer = false;
  cfg.mapFill = false; // Do not reapply an experimental map style on reload.
  cfg.noClip = false;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const angleDiff = (a,b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
  let open = false, lastAim = 0, lastDraw = 0, lastTrigger=0;
  let canvas, ctx, menu, indicator, toggleHint, status, oldLock = null;
  let W=0,H=0,dpr=1, lastError='';

  const styles = `
    #x7-screen{position:fixed;inset:0;z-index:2147483640;pointer-events:none}
    #x7-indicator{display:none!important;position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483642;pointer-events:auto;cursor:pointer;
      width:116px;height:32px;display:grid;place-items:center;background:rgba(20,10,33,.82);
      border:1px solid rgba(176,104,255,.65);color:#dfc4ff;border-radius:9px;
      font:900 14px/1 Segoe UI,Arial,sans-serif;letter-spacing:1.8px;
      box-shadow:0 3px 17px #10061ca8;transition:background .15s,box-shadow .15s}
    #x7-indicator:hover{background:#3b2058;box-shadow:0 0 16px #8944e64f}
    #x7-panel{position:fixed;z-index:2147483646;left:50%;top:50%;transform:translate(-50%,-50%);
      width:min(820px,calc(100vw - 24px));height:min(560px,calc(100vh - 24px));
      border:1px solid #8b60ba68;border-radius:14px;box-shadow:0 20px 90px #05020cd9,0 0 50px #8a4de52b;
      background:linear-gradient(143deg,#191027f9,#0b0914fc 68%);color:#f2eaff;
      font-family:Segoe UI,Arial,sans-serif;display:none;overflow:hidden}
    #x7-panel.show{display:flex}
    #x7-panel *{box-sizing:border-box}
    #x7-panel .x7-sidebar{width:188px;flex-shrink:0;padding:26px 14px 15px;background:#190e29b5;border-right:1px solid #a76aff20;display:flex;flex-direction:column}
    #x7-panel .x7-mark{font-weight:900;letter-spacing:1.7px;font-size:20px;margin-left:8px;color:#d8bcff;text-shadow:0 0 19px #a166ff6b}
    #x7-panel .x7-ver{font-size:10px;letter-spacing:2px;color:#9379aa;margin:5px 8px 20px}
    #x7-panel .x7-nav{width:100%;font-size:13px;font-weight:650;background:none;color:#9687ae;border:1px solid transparent;border-radius:7px;text-align:left;margin:2px 0;padding:12px 16px;cursor:pointer}
    #x7-panel .x7-nav.active{color:#e5d3ff;background:#9860de24;border:1px solid #a470e843;box-shadow:inset 3px 0 #b987ff}

    /* XCLUTCH v10: compact identity only inside the menu (never in the game HUD). */
    #x7-panel .xc-brand{display:flex;align-items:center;gap:11px;padding:0 5px 15px;margin:0 0 10px;border-bottom:1px solid #a56add29}
    #x7-panel .xc-emblem{width:42px;height:42px;flex:0 0 42px;border-radius:11px;border:1px solid #c693ff8c;
      background:linear-gradient(145deg,#462868,#1a1029);display:grid;place-items:center;color:#eee0ff;font:900 19px/1 Segoe UI,Arial,sans-serif;
      letter-spacing:-2px;text-shadow:0 0 12px #cba2ff94;box-shadow:inset 0 1px 0 #ffffff25,0 0 14px #7b42b027}
    #x7-panel .xc-brand{flex-direction:column;align-items:flex-start;gap:1px;padding:8px 4px 16px;}
    #x7-panel .xc-brandwords{padding-left:3px;min-width:0;flex:1}
    #x7-panel .xc-brandwords .x7-mark{font-size:18px;margin:0;letter-spacing:1.15px;white-space:nowrap}
    #x7-panel .xc-credit{font-size:9px;line-height:1.35;letter-spacing:0;color:#c49ae8;white-space:normal;margin-top:4px}
    #x7-panel .xc-build{font-size:9px;color:#8c79a1;letter-spacing:1px;margin-top:5px}

    #x7-panel .x7-meta{margin:auto 5px 0;line-height:1.8;color:#8b7ca0;font-size:10px}
    #x7-panel .x7-body{flex:1;min-width:0;overflow:auto;padding:27px 27px 18px}
    #x7-panel h2{font-size:21px;font-weight:750;letter-spacing:.3px;margin:0 0 4px}
    #x7-panel .x7-sub{font-size:12px;color:#a79aba;margin-bottom:23px}
    #x7-panel .x7-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
    #x7-panel .x7-card{background:#21152cb0;border:1px solid #a56add24;border-radius:9px;padding:14px}
    #x7-panel .x7-card h3{font-size:11px;letter-spacing:1.5px;color:#c69fff;margin:0 0 11px;text-transform:uppercase}
    #x7-panel .x7-row{min-height:43px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #b887e411}
    #x7-panel .x7-row:last-child{border:0}
    #x7-panel .x7-row span{font-size:12px;color:#d8cce8}
    #x7-panel .x7-tgl{appearance:none;width:35px;height:20px;border-radius:99px;background:#40324e;border:1px solid #9f75c441;position:relative;cursor:pointer;flex-shrink:0;outline:none}
    #x7-panel .x7-tgl::after{content:'';position:absolute;width:12px;height:12px;border-radius:50%;background:#c8b9d8;left:3px;top:3px;transition:.15s}
    #x7-panel .x7-tgl:checked{background:#9d60ee;border-color:#b988ff;box-shadow:0 0 11px #894dcb50}
    #x7-panel .x7-tgl:checked::after{left:18px;background:white}
    #x7-panel input[type=range]{width:125px;accent-color:#ac78f9;cursor:pointer}
    #x7-panel select{background:#2c1e3c;border:1px solid #78559f;color:#ede1ff;padding:6px 8px;border-radius:6px;outline:none}
    #x7-panel .x7-rangeval{min-width:43px;text-align:right;font-size:11px;color:#b98cff}
    #x7-panel .x7-tip{margin-top:15px;color:#8f7ea3;font-size:11px;line-height:1.6}
    #x7-panel .x7-bottom{margin-top:16px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #8b5fba2d;padding-top:13px;gap:8px}
    #x7-panel .x7-sys{font-size:11px;color:#af8cce}
    #x7-panel button.x7-reset{background:#332042;border:1px solid #8054aa;color:#ddc7fa;border-radius:6px;padding:8px 14px;font-size:11px;cursor:pointer}
    #x7-panel .x7-page{display:none}
    #x7-panel .x7-page.active{display:block}
    #xcl-trainer-hud{display:none;position:fixed;top:80px;right:24px;z-index:2147483638;pointer-events:none;background:#170d27e8;color:#eed8ff;padding:12px 16px;border:1px solid #a77ae5;border-radius:12px;font:700 14px Segoe UI,Arial,sans-serif;box-shadow:0 6px 28px #0009;min-width:180px}
    #xcl-trainer-hud.on{display:block}
    #xcl-trainer-hud small{display:block;font-size:10px;color:#bea4d7;margin-top:4px}
    #xcl-trainer-finish{display:none;position:fixed;top:32%;left:50%;transform:translateX(-50%);z-index:2147483639;pointer-events:none;
      padding:20px 30px;text-align:center;border:1px solid #b98bff;background:#110a1ff0;color:#f6eaff;border-radius:12px;
      font:800 25px Segoe UI,Arial,sans-serif;text-shadow:0 0 12px #bc81ff;box-shadow:0 8px 45px #000a}
    #xcl-trainer-finish.show{display:block}#xcl-trainer-finish small{display:block;font:500 12px Segoe UI,Arial;margin-top:12px;color:#caa8ef}
    #xcl-vhsfx{display:none;position:fixed;inset:0;z-index:2147483600;pointer-events:none;background:repeating-linear-gradient(to bottom,transparent 0px,transparent 3px,#00000038 4px);mix-blend-mode:multiply}
    body.xcl-vhs #xcl-vhsfx{display:block}
    body.xcl-fun-pulse #crosshair{animation:xcl-pulse .9s ease-in-out infinite alternate}
    @keyframes xcl-pulse{from{scale:1}to{scale:1.28}}
    body.xcl-cinema #hud,body.xcl-cinema #crosshair{visibility:hidden!important}
    body.xcl-cinema #xcl-trainer-hud,body.xcl-cinema #xcl-trainer-finish{visibility:visible!important} 
    @keyframes xcl-hue{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}
    body.xcl-rainbow #crosshair .chline,body.xcl-rainbow #crosshair .chout,body.xcl-rainbow #crosshair .chdot{animation:xcl-hue 2.1s linear infinite}

    #x7-panel .x7-accent{height:4px;width:90px;border-radius:9px;background:linear-gradient(90deg,#752acf,#de9dff);margin-bottom:14px}
    @media(max-width:610px){#x7-panel .x7-sidebar{width:130px;padding:26px 7px 15px}#x7-panel .x7-mark{font-size:17px;margin-left:6px}#x7-panel .x7-body{padding:27px 12px 18px}#x7-panel .x7-grid{grid-template-columns:1fr}}
  `;
  function addEl(tag, attrs={}, parent=document.body) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => (k==='html'?el.innerHTML=v:el.setAttribute(k,v)));
    parent.appendChild(el); return el;
  }
  function init() {
    if (!document.body) return false;
    if (menu) return true;
    addEl('style',{html:styles},document.head || document.documentElement);
    canvas = addEl('canvas',{id:'x7-screen'});
    ctx=canvas.getContext('2d', {alpha:true});
    indicator=addEl('div',{id:'x7-indicator'});
    addEl('div',{id:'xcl-trainer-hud'});
    addEl('div',{id:'xcl-trainer-finish'});
    addEl('div',{id:'xcl-vhsfx'});
    menu=addEl('div',{id:'x7-panel',html:`
      <aside class="x7-sidebar"><div class="xc-brand"><div class="xc-brandwords"><div class="x7-mark">XCLUTCH</div><div class="xc-credit">made by thxrealx7 only tiktok</div><div class="xc-build">BUILD / 15.0</div></div></div>
      <button class="x7-nav active" data-tab="visual">Visuals</button><button class="x7-nav" data-tab="aim">Aim</button><button class="x7-nav" data-tab="rage">Rage</button><button class="x7-nav" data-tab="skins">Skins</button><button class="x7-nav" data-tab="other">Other</button><button class="x7-nav" data-tab="trainer">Trainer</button><button class="x7-nav" data-tab="fun">FUN</button><button class="x7-nav" data-tab="config">Config</button>
      <div class="x7-meta">INSERT / MOBILE BUTTON</div></aside>
      <main class="x7-body">
        <section class="x7-page active" data-page="visual"><div class="x7-accent"></div><h2>Visuals</h2><div class="x7-sub">Подсветка игровых противников</div>
          <div class="x7-grid">
            <div class="x7-card"><h3>ESP</h3>
              <div class="x7-row"><span>Enable ESP</span><input class="x7-tgl" type="checkbox" data-opt="esp"></div>
              <div class="x7-row"><span>Box ESP</span><input class="x7-tgl" type="checkbox" data-opt="box"></div>
              <div class="x7-row"><span>Name ESP</span><input class="x7-tgl" type="checkbox" data-opt="names"></div>
              <div class="x7-row"><span>Health Bars</span><input class="x7-tgl" type="checkbox" data-opt="health"></div>
            </div>
            <div class="x7-card"><h3>Information</h3>
              <div class="x7-row"><span>Third Person (local)</span><input class="x7-tgl" type="checkbox" data-opt="thirdPerson"></div>
              <div class="x7-row"><span>Camera Distance</span><input type="range" data-opt="thirdDistance" min="2" max="7" step="0.2"><b class="x7-rangeval" data-out="thirdDistance">3.6</b></div>
              <div class="x7-row"><span>POV / Camera FOV</span><input type="range" data-opt="povFov" min="0" max="115" step="5"><b class="x7-rangeval" data-out="povFov">Auto</b></div>
              <div class="x7-row"><span>Distance ESP</span><input class="x7-tgl" type="checkbox" data-opt="distance"></div>
              <div class="x7-row"><span>Tracers</span><input class="x7-tgl" type="checkbox" data-opt="tracers"></div>
              <div class="x7-row"><span>FOV Circle</span><input class="x7-tgl" type="checkbox" data-opt="showFov"></div>
              <div class="x7-row"><span>Accent</span><select data-opt="color"><option value="#ae79ff">Purple</option><option value="#e99cff">Pink</option><option value="#8bb9ff">Blue</option></select></div>
            </div>
          </div>
        </section>
        <section class="x7-page" data-page="aim"><div class="x7-accent"></div><h2>Aim Assist</h2><div class="x7-sub">Наведение работает при включённом переключателе, без удержания ПКМ</div>
          <div class="x7-grid"><div class="x7-card"><h3>Targeting</h3>
            <div class="x7-row"><span>Enable Aim</span><input class="x7-tgl" type="checkbox" data-opt="aim"></div>
            <div class="x7-row"><span>Aim Point</span><select data-opt="aimBone"><option value="head">Head</option><option value="body">Body</option></select></div>
            <div class="x7-row"><span>Activation</span><b style="color:#b991ec;font-size:11px">AUTO (ON/OFF)</b></div>
            <div class="x7-row"><span>Visible Only</span><input class="x7-tgl" type="checkbox" data-opt="visibleOnly"></div>
            <div class="x7-row"><span>Triggerbot</span><input class="x7-tgl" type="checkbox" data-opt="triggerbot"></div>
          </div><div class="x7-card"><h3>Precision</h3>
            <div class="x7-row"><span>FOV</span><input type="range" min="2" max="36" step="1" data-opt="aimFov"><output class="x7-rangeval" data-out="aimFov"></output></div>
            <div class="x7-row"><span>Smoothing</span><input type="range" min="1" max="20" step="1" data-opt="smooth"><output class="x7-rangeval" data-out="smooth"></output></div>
          </div></div><div class="x7-tip">Visible Only проверяет прямую видимость средствами игрового движка. Triggerbot пытается вызвать штатный метод выстрела только при наведении на видимую цель. Без доступа к движку эти функции не выполняются.</div>
        </section>
        <section class="x7-page" data-page="rage"><div class="x7-accent"></div><h2>Rage</h2><div class="x7-sub">Агрессивное автоматическое наведение</div>
          <div class="x7-grid">
            <div class="x7-card"><h3>Rage Aim</h3>
              <div class="x7-row"><span>Enable Rage</span><input class="x7-tgl" type="checkbox" data-opt="rage"></div>
              <div class="x7-row"><span>Visible Only</span><input class="x7-tgl" type="checkbox" data-opt="visibleOnly"></div>
              <div class="x7-row"><span>Triggerbot</span><input class="x7-tgl" type="checkbox" data-opt="triggerbot"></div>
            </div>
            <div class="x7-card"><h3>Movement</h3>
              <div class="x7-row"><span>Bunny Hop (hold Space)</span><input class="x7-tgl" type="checkbox" data-opt="bhop"></div>
              <div class="x7-row"><span>Speed Hack (local)</span><input class="x7-tgl" type="checkbox" data-opt="speed"></div>
              <div class="x7-row"><span>Speed Multiplier</span><input type="range" min="1" max="2.5" step=".05" data-opt="speedMult"><output class="x7-rangeval" data-out="speedMult"></output></div>
              <div class="x7-row"><span>No Recoil (camera / view)</span><input class="x7-tgl" type="checkbox" data-opt="noRecoil"></div>
            </div>
          </div>
          <div class="x7-tip">Bhop выполняет повторный прыжок при удержании Space. Speed меняет клиентскую скорость; сервер может её ограничивать. No Recoil применяется сразу после оружейного обновления, убирая отображаемый рывок и увод прицела. Разброс и проверки сервера не изменяются.</div>
        </section>
        <section class="x7-page" data-page="skins"><div class="x7-accent"></div><h2>Skin Changer</h2>
          <div class="x7-sub">Только локальное оформление оружия, без изменения серверного инвентаря</div>
          <div class="x7-grid">
            <div class="x7-card"><h3>Cosmetics</h3>
              <div class="x7-row"><span>Enable Skin Changer</span><input class="x7-tgl" type="checkbox" data-opt="skinChanger"></div>
              <div class="x7-row"><span>Weapon Fill</span><select data-opt="skinPreset"><option value="original">Original Color</option><option value="violet">Violet</option><option value="emerald">Emerald</option><option value="crimson">Crimson</option><option value="gold">Gold</option><option value="ice">Ice</option><option value="custom">Custom Fill</option></select></div>
              <div class="x7-row"><span>Fill Color</span><input type="color" data-opt="skinCustomColor" title="Choose custom color" style="width:58px;height:34px;padding:3px;border:1px solid #9465d6;border-radius:5px;background:#20112f;cursor:pointer"></div>
              <div class="x7-tip">Original Color восстанавливает исходный материал. Выбор цвета в палитре автоматически включает Custom Fill. Заливка влияет только на твой вид оружия.</div>
            </div>
            <div class="x7-card"><h3>Knife Model</h3>
              <div class="x7-row"><span>Replace Default Knife</span><select data-opt="knifeModel">
                <option value="default">Original Knife</option>
                <option value="knife_butterfly">Butterfly Knife</option>
                <option value="knife_m9">M9 Bayonet</option>
                <option value="knife_karambit">Karambit</option>
                <option value="knife_bayonet">Bayonet</option>
                <option value="knife_flip">Flip Knife</option>
                <option value="knife_skeleton">Skeleton Knife</option>
                <option value="knife_huntsman">Huntsman Knife</option>
              </select></div>
              <div class="x7-row"><span>Inventory</span><b style="font-size:11px;color:#c9aeed">Not modified</b></div>
              <div class="x7-tip">При активном Skin Changer подменяется только локальная модель ножа от первого лица. Используются модели, которые уже зарегистрированы в движке; загрузка требует наличия ресурсов на сайте.</div>
            </div>
          </div>
        </section>
        <section class="x7-page" data-page="other"><div class="x7-accent"></div><h2>Other / Map Change</h2>
          <div class="x7-sub">Локальная тренировочная сцена. Изменения не отправляются на сервер.</div>
          <div class="x7-grid"><div class="x7-card"><h3>Map Change</h3>
            <div class="x7-row"><span>Training Map</span><select data-opt="mapMode">
              <option value="original">Original Map</option>
              <option value="platform">Floating Platform</option>
            </select></div>
            <div class="x7-row"><span>Current Map</span><b class="x7-rangeval" id="x7-map-name">Unknown</b></div>
            <div class="x7-tip">Квадрат 24×24 расположен выше зданий. Для него добавляется коллайдер в локальную физику. В сетевой игре изменения не выполняются.</div>
            <div class="x7-row"><span>Platform Height</span><input type="range" data-opt="arenaLift" min="20" max="100" step="5"><b class="x7-rangeval" data-out="arenaLift">45</b></div>
            <div class="x7-row"><span>Platform status</span><b class="x7-rangeval" id="xcl-arena-state">Inactive</b></div>
            <div class="x7-row"><span>No Clip / Player Fly</span><input class="x7-tgl" type="checkbox" data-opt="noClip"></div>
            <div class="x7-row"><span>Freeze All Bots</span><input class="x7-tgl" type="checkbox" data-opt="freezeBots"></div>
            <div class="x7-row"><span>Fly Speed</span><input type="range" data-opt="flySpeed" min="3" max="24" step="1"><b class="x7-rangeval" data-out="flySpeed">9</b></div>
            <div class="x7-tip">No Clip: W/S — вперёд или назад по направлению взгляда, A/D — вбок, Space — вверх, Ctrl — вниз, Shift — ускорение. Игрок не проходит в онлайне. Freeze All Bots останавливает обновление локальных ботов. В сетевой игре режимы недоступны.</div>
          </div><div class="x7-card"><h3>Compatibility</h3>
            <div class="x7-tip">Только локальная тренировочная сцена. Платформа регистрируется как коллайдер в локальной физике карты. Реальный полёт персонажа и остановка ботов разрешены только при отсутствии сетевого соединения, другие игроки изменений не увидят.</div>
          </div></div>
        </section>
        <section class="x7-page" data-page="trainer"><div class="x7-accent"></div><h2>AIM TRAINER / PRACTICE</h2>
          <div class="x7-sub">Только офлайн-матч с ботами. При выходе таймер и расположение игроков восстанавливаются.</div>
          <div class="x7-grid">
            <div class="x7-card"><h3>Aim Trainer</h3>
              <div class="x7-row"><span>Trainer / Return to Map</span><input class="x7-tgl" type="checkbox" data-opt="aimTrainer"></div>
              <div class="x7-row"><span>Session Length</span><select data-opt="trainerDuration"><option value="30">30 seconds</option><option value="60">60 seconds</option><option value="120">120 seconds</option></select></div>
              <div class="x7-row"><span>Trainer status</span><b class="x7-rangeval" style="min-width:120px" id="xcl-trainer-state">Ready</b></div>
              <div class="x7-row"><span>Hits / Shots</span><b class="x7-rangeval" id="xcl-trainer-score">0 / 0</b></div>
              <div class="x7-row"><span>Accuracy</span><b class="x7-rangeval" id="xcl-trainer-accuracy">0%</b></div>
              <div class="x7-tip">Создаёт настоящие круглые 3D-мишени вместо ботов. Таймер игры останавливается, Aim / Rage / Triggerbot отключаются. После окончания ждёт выключения переключателя.</div>
            </div>
            <div class="x7-card"><h3>Performance / Fun</h3>
              <div class="x7-row"><span>Solid Map Color</span><input class="x7-tgl" type="checkbox" data-opt="mapFill"></div>
              <div class="x7-row"><span>Map Fill Color</span><input type="color" data-opt="mapFillColor" style="width:57px;height:32px;background:#20112f;border:1px solid #9465d6;border-radius:5px;cursor:pointer"></div>
              <div class="x7-row"><span>FPS Lite (70% resolution)</span><input class="x7-tgl" type="checkbox" data-opt="liteRender"></div>
              <div class="x7-row"><span>Rainbow Crosshair</span><input class="x7-tgl" type="checkbox" data-opt="rainbowCrosshair"></div>
              <div class="x7-row"><span>Map mode</span><b class="x7-rangeval" style="min-width:100px" id="xcl-perf-state">Normal</b></div>
              <div class="x7-tip">Режим одноцветной карты не затрагивает оружие и персонажей. Если движок меняет материалы, можно вернуть исходные через переключатель. FPS Lite снижает рендер-разрешение.</div>
            </div>
          </div>
        </section>
        <section class="x7-page" data-page="fun"><div class="x7-accent"></div><h2>FUN / VISUAL LAB</h2>
          <div class="x7-sub">Все эффекты только у тебя в браузере. Каждый можно выключить отдельно.</div>
          <div class="x7-grid">
            <div class="x7-card"><h3>Visual Modes</h3>
              <div class="x7-row"><span>Night Vision (green)</span><input class="x7-tgl" type="checkbox" data-opt="funNight"></div>
              <div class="x7-row"><span>VHS / Scanlines</span><input class="x7-tgl" type="checkbox" data-opt="funVhs"></div>
              <div class="x7-row"><span>Pixel Art Mode</span><input class="x7-tgl" type="checkbox" data-opt="funPixel"></div>
              <div class="x7-row"><span>Negative Colors</span><input class="x7-tgl" type="checkbox" data-opt="funInvert"></div>
              <div class="x7-tip">Визуальные фильтры камеры, не меняют настоящие материалы карты. Сочетаются друг с другом.</div>
            </div>
            <div class="x7-card"><h3>Party / Recording</h3>
              <div class="x7-row"><span>Cinematic HUD</span><input class="x7-tgl" type="checkbox" data-opt="funCinema"></div>
              <div class="x7-row"><span>Giant Bots (visual)</span><input class="x7-tgl" type="checkbox" data-opt="funGiantBots"></div>
              <div class="x7-row"><span>Pulse Crosshair</span><input class="x7-tgl" type="checkbox" data-opt="funPulse"></div>
              <div class="x7-tip">Cinematic скрывает HUD, но Insert открывает XCLUTCH. Giant Bots изменяет только размер отображаемой модели, не хитбокс.</div>
            </div>
          </div>
        </section>
        <section class="x7-page" data-page="config"><div class="x7-accent"></div><h2>Config</h2><div class="x7-sub">Локальные настройки на этом компьютере</div>
          <div class="x7-card"><h3>Compatibility</h3><div class="x7-row"><span>Engine</span><b id="x7-engine-status" style="color:#c59eff;font-size:12px">Waiting...</b></div>
           <div class="x7-row"><span>Activation</span><b style="color:#c59eff;font-size:12px">INSERT / F8</b></div>
           <div class="x7-row"><span>Network</span><b style="color:#a79db5;font-size:12px">LOCAL ONLY</b></div>
          </div><div class="x7-tip">Интерфейс зависит от координат ботов и камеры, доступных в текущей версии игры. На других движках функции останутся выключенными.</div>
        </section>
        <div class="x7-bottom"><span class="x7-sys" id="x7-status">Waiting for game...</span><button class="x7-reset" id="x7-reset">Reset settings</button></div>
      </main>`});
    status=menu.querySelector('#x7-status');
    toggleHint=menu.querySelector('#x7-engine-status');
    menu.querySelectorAll('.x7-nav').forEach(btn=>btn.addEventListener('click',()=>{
      menu.querySelectorAll('.x7-nav').forEach(x=>x.classList.toggle('active',x===btn));
      menu.querySelectorAll('.x7-page').forEach(x=>x.classList.toggle('active',x.dataset.page===btn.dataset.tab));
    }));
    menu.querySelectorAll('[data-opt]').forEach(el=>{
      const k=el.dataset.opt;
      if(el.type==='checkbox') el.checked=Boolean(cfg[k]);
      else el.value=cfg[k];
      el.addEventListener('input',()=>{cfg[k]=el.type==='checkbox'?el.checked:(el.type==='range'?Number(el.value):el.value);if(k==='skinCustomColor')cfg.skinPreset='custom';
        if(k==='arenaLift'&&arena.enabled&&!trainer.active)stopArena();
        if(k==='aimTrainer') { if(!cfg.aimTrainer)stopTrainer(trainer.finished?'Completed':'Stopped'); else trainer.requested=true; }
        if(k==='mapMode'&&trainer.active){cfg.mapMode='platform';}
        if(k==='mapFillColor'){ mapStyle.changed=true; }
        if(k==='mapFill'&&!cfg.mapFill)restoreMapFill();
        if(k==='noClip'&&!cfg.noClip)resetFreecam();
        if(k==='noClip'&&cfg.noClip){cfg.thirdPerson=false;}
        if(k==='thirdPerson'&&cfg.thirdPerson){cfg.noClip=false;resetFreecam();}
        save();updateUI();});
    });
    menu.querySelector('#x7-reset').addEventListener('click',()=>{stopTrainer('Reset');restoreMapFill();restoreLite();if(arena.enabled)stopArena();resetFreecam();cfg={...defaults};save();updateUI();});
    indicator.title='Открыть XCLUTCH (Insert / F8)';
    indicator.addEventListener('click', ev=>{ev.stopPropagation();toggleMenu();});
    updateUI(); return true;
  }
  function updateUI() {
    if (!menu) return;
    menu.querySelectorAll('[data-opt]').forEach(el=>{
      if(el.type==='checkbox') el.checked=!!cfg[el.dataset.opt];
      else el.value=cfg[el.dataset.opt];
    });
    menu.querySelectorAll('[data-out]').forEach(el=>{const k=el.dataset.out;el.textContent=k==='povFov'?(Number(cfg.povFov)>0?cfg.povFov+'°':'Auto'):cfg[k] + (k==='aimFov'?'°':k==='speedMult'?'x':'');});
    const g=window.game;
    const found=!!(g&&g.player&&g.camera&&g.botMgr);
    indicator.textContent='XCLUTCH';indicator.title=`XCLUTCH · WH ${cfg.esp?'ON':'OFF'} · Insert/F8`;
    toggleHint.textContent=found?'Detected':'Not detected';toggleHint.style.color=found?'#a8efb9':'#e6ae8a';
    const tc=menu.querySelector('#xcl-trainer-state');if(tc)tc.textContent=trainer.active?(trainer.finished?'Finished · switch OFF':Math.ceil(trainer.remaining)+'s'):(trainer.requested?'Preparing':trainer.message);
    const sc=menu.querySelector('#xcl-trainer-score');if(sc)sc.textContent=trainer.hits+' / '+trainer.shots;
    const acc=menu.querySelector('#xcl-trainer-accuracy');if(acc)acc.textContent=trainer.shots?Math.round(trainer.hits/trainer.shots*100)+'%':'0%';
    const per=menu.querySelector('#xcl-perf-state');if(per)per.textContent=cfg.mapFill?'Solid color':cfg.liteRender?'Lite':'Normal';
    status.textContent=!found?'Waiting for window.game on clutcher.io':(!g.physics?.lineClear?'Physics visibility unavailable':'Engine / visibility available');
  }
  function toggleMenu(){
    if(!init())return;
    open=!open;window.__XCLUTCH_OPEN=open;menu.classList.toggle('show',open);
    if(open){oldLock=document.pointerLockElement;try{document.exitPointerLock?.()}catch{}}
    else {try { if(oldLock && oldLock.isConnected) oldLock.requestPointerLock?.() } catch{};oldLock=null;}
    updateUI();
  }
  function hotkey(ev){
    // Window capture runs before site's document or canvas handlers.
    if(!['Insert','F8'].includes(ev.code)||ev.repeat)return;
    ev.preventDefault();ev.stopImmediatePropagation();toggleMenu();
  }
  window.addEventListener('keydown',hotkey,true);

  function getBots(g){
    if(!g || !g.player || !g.camera || !g.botMgr) return [];
    return Array.isArray(g.botMgr.bots)?g.botMgr.bots:[];
  }
  function enemy(bot,player){
    return bot && bot!==player && bot.alive!==false && Number(bot.health)>0 &&
      String(bot.team||'').toUpperCase()!==String(player.team||'').toUpperCase();
  }
  function viewport(g){
    const el=g.renderer?.domElement || g.input?.canvas || document.querySelector('#game canvas') || document.querySelector('canvas');
    if(!(el instanceof HTMLElement))return false;
    const rect=el.getBoundingClientRect();
    if(rect.width<20||rect.height<20)return false;
    W=rect.width;H=rect.height;dpr=Math.min(devicePixelRatio||1,2);
    canvas.style.left=rect.left+'px';canvas.style.top=rect.top+'px';canvas.style.right='auto';canvas.style.bottom='auto';
    canvas.style.width=W+'px';canvas.style.height=H+'px';
    let pxW=Math.round(W*dpr),pxH=Math.round(H*dpr);
    if(canvas.width!==pxW||canvas.height!==pxH){canvas.width=pxW;canvas.height=pxH;}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return true;
  }
  function project(x,y,z,cam){
    const v=cam.matrixWorldInverse?.elements,m=cam.projectionMatrix?.elements;
    if(!v||!m)return null;
    let X=v[0]*x+v[4]*y+v[8]*z+v[12],Y=v[1]*x+v[5]*y+v[9]*z+v[13],Z=v[2]*x+v[6]*y+v[10]*z+v[14],V=v[3]*x+v[7]*y+v[11]*z+v[15];
    let clipW=m[3]*X+m[7]*Y+m[11]*Z+m[15]*V;
    if(!Number.isFinite(clipW)||clipW<.04)return null;
    let cx=m[0]*X+m[4]*Y+m[8]*Z+m[12]*V,cy=m[1]*X+m[5]*Y+m[9]*Z+m[13]*V;
    return {x:W*(.5+.5*cx/clipW),y:H*(.5-.5*cy/clipW)};
  }
  function bounds(b,g){
    const x=Number(b.x),y=Number(b.y),z=Number(b.z);
    if(![x,y,z].every(Number.isFinite))return null;
    const h=clamp(Number(b.height)||1.8,1.0,2.7),r=clamp(Number(b.radius)||.37,.2,.8);
    let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9,found=0;
    for(const Y of [y+.07,y+h])for(const X of [x-r,x+r])for(const Z of [z-r,z+r]){
      const p=project(X,Y,Z,g.camera);if(!p)continue;
      minx=Math.min(minx,p.x);miny=Math.min(miny,p.y);maxx=Math.max(maxx,p.x);maxy=Math.max(maxy,p.y);found++;
    }
    if(found<4)return null;
    const w=maxx-minx,h2=maxy-miny;
    if(w<2||h2<6||w>W*1.25||h2>H*2||maxx<0||minx>W||maxy<0||miny>H)return null;
    return {x:minx,y:miny,w,h:h2};
  }
  function paintBot(bot,b,g){
    const c=cfg.color||'#ae79ff';
    ctx.save();
    if(cfg.box){
      ctx.lineWidth=3.5;ctx.strokeStyle='#06020dcc';ctx.strokeRect(b.x,b.y,b.w,b.h);
      ctx.lineWidth=1.7;ctx.strokeStyle=c;ctx.strokeRect(b.x,b.y,b.w,b.h);
      const d=clamp(Math.min(b.w,b.h)*.22,5,16);ctx.lineWidth=2.5;ctx.strokeStyle='#e9d7ff';ctx.beginPath();
      for(const [X,sx] of [[b.x,1],[b.x+b.w,-1]])for(const [Y,sy] of [[b.y,1],[b.y+b.h,-1]]){
        ctx.moveTo(X,Y+sy*d);ctx.lineTo(X,Y);ctx.lineTo(X+sx*d,Y);
      }ctx.stroke();
    }
    if(cfg.health){
      const hp=clamp(Number(bot.health)||0,0,100);ctx.fillStyle='#160c24de';ctx.fillRect(b.x-8,b.y,5,b.h);
      ctx.fillStyle=hp>50?'#a5eeae':hp>20?'#e7d37b':'#f082a5';ctx.fillRect(b.x-7,b.y+b.h*(1-hp/100),3,b.h*hp/100);
    }
    if(cfg.names||cfg.distance){
      const d=Math.round(Math.hypot(Number(bot.x)-Number(g.player.x),Number(bot.z)-Number(g.player.z)));
      let t=(cfg.names?String(bot.name||'ENEMY').slice(0,15):'')+(cfg.distance?'  '+d+'m':'');
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 11px Segoe UI,Arial,sans-serif';
      const textX=b.x+b.w/2,textY=Math.max(12,b.y-14),tw=ctx.measureText(t).width;
      ctx.fillStyle='#120a20e8';ctx.fillRect(textX-tw/2-6,textY-9,tw+12,19);
      ctx.fillStyle='#e2bfff';ctx.fillText(t,textX,textY);
    }
    if(cfg.tracers){ctx.strokeStyle=c+'ab';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(W/2,H);ctx.lineTo(b.x+b.w/2,b.y+b.h);ctx.stroke();}
    ctx.restore();
  }
  function isVisible(g,b){
    // Use the game's physical occlusion test. Unknown geometry is not treated as visible.
    const physics=g.physics;
    if(typeof physics?.lineClear!=='function')return false;
    const p=g.player,ey=Number(p.y)+(Number(p.eyeH)||1.61),ty=Number(b.y)+clamp(Number(b.height)||1.8,1.0,2.7)*.82;
    try{return !!physics.lineClear(Number(p.x),ey,Number(p.z),Number(b.x),ty,Number(b.z))}catch{return false}
  }
  function targetAngles(g,b,bone){
    const p=g.player,dx=Number(b.x)-Number(p.x),dz=Number(b.z)-Number(p.z);
    const dist=Math.hypot(dx,dz);
    if(!Number.isFinite(dist)||dist<.2)return null;
    const eye=Number(p.y)+(Number(p.eyeH)||1.61);
    const h=clamp(Number(b.height)||1.8,1.0,2.7);
    const ty=Number(b.y)+h*(bone==='body'?.61:.86);
    return {yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(ty-eye,dist),distance:dist,bot:b};
  }
  function chooseTarget(g){
    const p=g.player;
    if(!p||!Number.isFinite(p.yaw)||!Number.isFinite(p.pitch))return null;
    let best=null,rad=cfg.rage?Math.PI:cfg.aimFov*Math.PI/360;
    for(const b of getBots(g)){
      if(!enemy(b,p)||cfg.visibleOnly&&!isVisible(g,b))continue;
      const info=targetAngles(g,b,cfg.aimBone);
      if(!info)continue;
      const delta=Math.hypot(angleDiff(info.yaw,p.yaw)*Math.cos(p.pitch),info.pitch-p.pitch);
      if(delta>=rad)continue;
      rad=delta;best=info;
    }
    return best;
  }
  function assist(g,dt){
    if(trainer.active||!(cfg.aim||cfg.rage)||open||!document.pointerLockElement)return;
    const p=g.player,info=chooseTarget(g);
    if(!info)return;
    const dy=angleDiff(info.yaw,p.yaw),dp=info.pitch-p.pitch;
    if(cfg.rage){p.yaw+=dy;p.pitch=clamp(info.pitch,-Math.PI/2+.01,Math.PI/2-.01);return;}
    let ratio=1-Math.exp(-dt*(42/(Math.max(1,cfg.smooth)*.8+1)));
    p.yaw+=clamp(dy*ratio,-.095,.095);
    p.pitch=clamp(p.pitch+clamp(dp*ratio,-.07,.07),-Math.PI/2+.01,Math.PI/2-.01);
  }
  function maybeTrigger(g,time){
    if(trainer.active||!cfg.triggerbot||open||!document.pointerLockElement||time-lastTrigger<75)return;
    const p=g.player,w=g.weapons;
    if(!p?.alive||!w||typeof w.fire!=='function'||typeof w.def!=='function'||typeof w.state!=='function')return;
    const def=w.def(),st=w.state();
    if(!def||['knife','c4','grenade','zeus'].includes(def.class)||!st||!(st.ammo>0)||w.drawT>0||w.reloading||w.charging||g.frozen||g.time<w.nextFire)return;
    for(const b of getBots(g)){
      if(!enemy(b,p)||!isVisible(g,b))continue;
      const a=targetAngles(g,b,'head');if(!a)continue;
      const yawDiff=angleDiff(a.yaw,p.yaw),pitchDiff=a.pitch-p.pitch;
      // Match a modest target angular radius; no blind through-wall firing.
      const hitAngle=Math.hypot(yawDiff*Math.cos(p.pitch),pitchDiff);
      const radius=Math.atan2(.23,Math.max(1,a.distance));
      if(hitAngle>radius)continue;
      try{w.fire();lastTrigger=time;}catch(e){console.warn('[XCLUTCH] Triggerbot unavailable:',e)}
      return;
    }
  }
  // XCLUTCH v8: self-contained procedural 3D avatar; loaded agent clone is only a fallback.
  // Restore camera projection and position after every render call.
  const thirdState={game:null,root:null,renderer:null,origRender:null,fromBot:false};
  function cleanupThird(){
    if(thirdState.root){try{thirdState.root.parent?.remove(thirdState.root)}catch{}}
    thirdState.root=null;
    if(thirdState.renderer&&thirdState.origRender&&thirdState.renderer.render!==thirdState.origRender){
      try{thirdState.renderer.render=thirdState.origRender}catch{}
    }
    thirdState.renderer=null;thirdState.origRender=null;thirdState.game=null;
  }
  function modelSample(g){
    let sample=null;
    g.scene?.traverse?.(node=>{
      if(sample||!node?.isMesh||node.isInstancedMesh||node.isSkinnedMesh||!node.geometry?.getAttribute||
         !node.geometry?.setAttribute||typeof node.constructor!=='function'||!node.material||Array.isArray(node.material)||
         typeof node.material.clone!=='function')return;
      const att=node.geometry.getAttribute('position');
      if(att?.constructor&&typeof node.geometry.constructor==='function')sample=node;
    });
    return sample;
  }
  function createBox(sample,width,height,depth,color){
    const G=sample.geometry.constructor, A=sample.geometry.getAttribute('position').constructor;
    const geo=new G(),x=width*.5,y=height*.5,z=depth*.5;
    // Six faces, each built from two triangles. Avoid reliance on a global THREE variable.
    const faces=[
      [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]],
      [[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]],
      [[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]],
      [[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]],
      [[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]],
      [[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]]
    ];
    const v=[];
    for(const f of faces)for(const k of [0,1,2,0,2,3])v.push(...f[k]);
    geo.setAttribute('position',new A(new Float32Array(v),3));geo.computeVertexNormals?.();
    const mat=sample.material.clone();
    if(mat.color?.setHex)mat.color.setHex(color);
    for(const field of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','lightMap','alphaMap','bumpMap'])if(field in mat)mat[field]=null;
    if('vertexColors' in mat)mat.vertexColors=false;
    mat.side=2;mat.transparent=false;mat.visible=true;mat.needsUpdate=true;
    const result=new sample.constructor(geo,mat);
    result.frustumCulled=false;result.visible=true;return result;
  }
  function makeAvatar(g){
    if(thirdState.root?.parent===g.scene)return true;
    if(!g?.scene)return false;
    try{
      const sample=modelSample(g);
      if(sample){
        const root=new g.scene.constructor();root.name='XCLUTCH_LOCAL_PLAYER_MODEL';
        const part=(w,h,d,x,y,z,col)=>{const m=createBox(sample,w,h,d,col);m.position.set(x,y,z);root.add(m);};
        // Model origin = ground, local +Y is up, forward = -Z.
        part(.65,.78,.36, 0,1.24,0,0x293c56); // tactical torso
        part(.54,.54,.13, 0,1.27,-.23,0x202d38); // vest
        part(.26,.34,.25, 0,1.88,0,0xc99975); // face
        part(.30,.14,.27, 0,2.08,0,0x263448); // helmet
        for(const side of [-1,1]){
          part(.24,.7,.25,side*.18,.56,0,0x29323b); // legs
          part(.25,.17,.37,side*.18,.13,-.06,0x151a21); // boots
          part(.22,.65,.23,side*.46,1.27,-.02,0x394957); // arms
          part(.23,.18,.25,side*.46,.86,-.02,0x101b28); // gloves
        }
        g.scene.add(root);thirdState.root=root;thirdState.game=g;thirdState.fromBot=false;
        return true;
      }
      const actor=(g.botMgr?.bots||[]).find(b=>b.alive&&b.cs2Agent?.root);
      if(!actor)return false;
      const root=actor.cs2Agent.root.clone(true);
      root.name='XCLUTCH_LOCAL_PLAYER_MODEL';root.visible=true;
      root.traverse?.(node=>{if(node.isMesh){node.frustumCulled=false;node.visible=true}});
      g.scene.add(root);thirdState.root=root;thirdState.game=g;thirdState.fromBot=true;
      return true;
    }catch(err){console.warn('[XCLUTCH] Avatar creation failed:',err);return false}
  }
  function updateAvatar(g){
    if(!thirdState.root||!g.player)return;
    const p=g.player;
    const show=!!(cfg.thirdPerson&&p.alive&&g.state==='playing');
    thirdState.root.visible=show;
    if(!show)return;
    thirdState.root.position.set(p.x,p.y,p.z);
    thirdState.root.rotation.y=p.yaw||0;
    thirdState.root.updateMatrixWorld?.(true);
  }
  // Input tracking for local player flight. Not sent to the network.
  const freecam={pos:null,last:0,keys:new Set(),game:null};
  const flightKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight','ShiftLeft','ShiftRight']);
  window.addEventListener('keydown',e=>{if(flightKeys.has(e.code)&&!e.repeat)freecam.keys.add(e.code)},true);
  window.addEventListener('keyup',e=>{freecam.keys.delete(e.code)},true);
  window.addEventListener('blur',()=>freecam.keys.clear());
  function resetFreecam(){freecam.pos=null;freecam.last=0;freecam.game=null;freecam.keys.clear();}
  function updateFreecam(g,oldPos){
    if(freecam.game!==g){resetFreecam();freecam.game=g;}
    if(!freecam.pos){freecam.pos=oldPos.clone();freecam.last=performance.now();}
    const now=performance.now(),dt=clamp((now-freecam.last)/1000,0,0.05);freecam.last=now;
    if(open || document.activeElement?.matches?.('input,textarea,select'))return freecam.pos;
    const pressed=k=>freecam.keys.has(k);
    const f=Number(pressed('KeyW')||pressed('ArrowUp'))-Number(pressed('KeyS')||pressed('ArrowDown'));
    const r=Number(pressed('KeyD')||pressed('ArrowRight'))-Number(pressed('KeyA')||pressed('ArrowLeft'));
    const v=Number(pressed('Space'))-Number(pressed('ControlLeft')||pressed('ControlRight'));
    const len=Math.hypot(f,r,v);
    if(len){
      const yaw=Number(g.player?.yaw)||0;
      const speed=clamp(Number(cfg.flySpeed)||9,3,24)*(pressed('ShiftLeft')||pressed('ShiftRight')?2:1);
      const t=dt*speed/len;
      freecam.pos.x+=(Math.sin(yaw)*f+Math.cos(yaw)*r)*t;
      freecam.pos.z+=(-Math.cos(yaw)*f+Math.sin(yaw)*r)*t;
      freecam.pos.y+=v*t;
    }
    return freecam.pos;
  }
  function hookThirdPerson(g){
    if(!g?.renderer||!g.camera||!g.scene)return;
    if(thirdState.renderer&&thirdState.renderer!==g.renderer)cleanupThird();
    if(thirdState.renderer)return;
    const renderer=g.renderer,original=renderer.render;
    if(typeof original!=='function')return;
    thirdState.renderer=renderer;thirdState.origRender=original;thirdState.game=g;
    renderer.render=function(scene,camera,...args){
      const active=cfg.thirdPerson&&!cfg.noClip&&g.state==='playing'&&g.player?.alive;
      const flying=false; // Player noclip is integrated in player.update, not renderer.
      const setFov=Number(cfg.povFov)>=55;
      if(scene===g.viewmodel?.scene && (active||flying))return;
      if(scene!==g.scene||camera!==g.camera)return original.call(this,scene,camera,...args);
      const oldPos=camera.position.clone(),oldQuat=camera.quaternion.clone(),oldFov=camera.fov;
      try{
        if(setFov && Number.isFinite(oldFov)){camera.fov=clamp(Number(cfg.povFov),55,115);camera.updateProjectionMatrix?.()}
        if(active&&makeAvatar(g)){
          updateAvatar(g);
          const p=g.player,yaw=p.yaw||0,d=clamp(Number(cfg.thirdDistance)||3.6,2,7);
          const shoulder=.30,eye=(p.eyeH||1.6),focusY=p.y+eye*.8;
          camera.position.set(p.x+Math.sin(yaw)*d+Math.cos(yaw)*shoulder,
            focusY+.6+Math.max(-.5,Math.min(.5,p.pitch||0))*.3,
            p.z+Math.cos(yaw)*d-Math.sin(yaw)*shoulder);
          camera.lookAt(p.x,focusY,p.z);camera.updateMatrixWorld?.(true);
        }
        return original.call(this,scene,camera,...args);
      }finally{
        camera.position.copy(oldPos);camera.quaternion.copy(oldQuat);
        if(camera.fov!==oldFov){camera.fov=oldFov;camera.updateProjectionMatrix?.()}
        camera.updateMatrixWorld?.(true);
      }
    };
  }
  // Gameplay-changing features require offline/local-bot mode; do not override online sessions.
  function localSandbox(g){
    return !!(g?.state==='playing' && g.player?.alive && Array.isArray(g.botMgr?.bots)
      && !g.network?.connected && !g.multiplayer?.connected && !g.net?.connected
      && !g.client?.connected && !g.ws?.readyState);
  }
  const botHooks=new WeakMap();
  function hookFreezeBots(g){
    if(!localSandbox(g))return;
    for(const bot of g.botMgr.bots){
      if(!bot || botHooks.has(bot) || typeof bot.update!=='function')continue;
      const original=bot.update;
      botHooks.set(bot,original);
      bot.update=function(...args){
        if((cfg.freezeBots||trainer.active)&&localSandbox(g)){
          this.vx=0;this.vy=0;this.vz=0;
          this.onGround=true;
          return;
        }
        return original.apply(this,args);
      };
    }
  }
  const playerHooks=new WeakMap();
  function hookPlayerNoClip(g){
    const p=g?.player;
    if(!p||playerHooks.has(p)||typeof p.update!=='function')return;
    const native=p.update;
    playerHooks.set(p,native);
    p.update=function(dt,...args){
      if(trainer.active&&trainer.finished&&localSandbox(g))return;
      if(!cfg.noClip||!localSandbox(g)||open)return native.call(this,dt,...args);
      const x=this.x,y=this.y,z=this.z;
      // Native update processes mouse look and equipment; player position is then
      // advanced by the local noclip integrator rather than the collision solver.
      const result=native.call(this,dt,...args);
      const keys=freecam.keys;
      const pressed=k=>keys.has(k);
      const f=Number(pressed('KeyW')||pressed('ArrowUp'))-Number(pressed('KeyS')||pressed('ArrowDown'));
      const r=Number(pressed('KeyD')||pressed('ArrowRight'))-Number(pressed('KeyA')||pressed('ArrowLeft'));
      const v=Number(pressed('Space'))-Number(pressed('ControlLeft')||pressed('ControlRight'));
      const len=Math.hypot(f,r,v)||1;
      const speed=clamp(Number(cfg.flySpeed)||9,3,24)*(pressed('ShiftLeft')||pressed('ShiftRight')?2:1);
      const distance=clamp(Number(dt)||0,0,.06)*speed/len;
      const yaw=Number(this.yaw)||0,pitch=Number(this.pitch)||0;
      this.x=x+(Math.sin(yaw)*Math.cos(pitch)*f+Math.cos(yaw)*r)*distance;
      this.z=z+(-Math.cos(yaw)*Math.cos(pitch)*f+Math.sin(yaw)*r)*distance;
      this.y=y+(v+Math.sin(pitch)*f)*distance;
      this.vx=0;this.vy=0;this.vz=0;this.onGround=true;
      this.fallTime=0;this.fallDistance=0;this.jumpBuffer=0;
      return result;
    };
  }
  // Local physics sandbox. No remote map state is modified.
  const arena={game:null,mesh:null,y:0,cx:0,cz:0,ground:null,collider:null,players:[],bots:new WeakSet(),botUpdates:new WeakMap(),enabled:false,reason:'Inactive'};
  function snapToPlatform(e,y){
    if(!e)return;
    e.y=y; // Game entities store world-space foot position as y in this version.
    for(const k of ['vy','velY','velocityY','jumpVel'])if(typeof e[k]==='number')e[k]=0;
    for(const k of ['onGround','grounded'])if(typeof e[k]==='boolean')e[k]=true;
    if(typeof e.airTime==='number')e.airTime=0;
    if(typeof e.fallTime==='number')e.fallTime=0;
    if(typeof e.fallDistance==='number')e.fallDistance=0;
  }
  // Load the same Three.js build as the game, rather than constructing a Mesh
  // from an arbitrary map object's constructor (which caused "reading u...").
  let threeExports=null, threePending=null, threeError='', threeTriedAt=-10000;
  async function getThree(g){
    if(threeExports)return threeExports;
    if(threePending)return threePending;
    // Prefer the exact module file already loaded by the browser.
    const names=performance.getEntriesByType('resource').map(x=>x.name)
      .filter(x=>/\/src\/three-[^/]+\.js(?:\?|$)/.test(x)&&new URL(x).origin===location.origin);
    const chosen=names[0]||'/src/three-7ielApeD.js';
    threeTriedAt=performance.now();
    threePending=import(chosen).then(mod=>{
      if(typeof mod.C!=='function'||typeof mod.st!=='function'||typeof mod.ct!=='function'||typeof mod.S!=='function')throw Error('Three.js exports changed');
      threeExports=mod;threeError='';return mod;
    }).catch(err=>{threeError=String(err?.message||err);return null}).finally(()=>{threePending=null});
    return threePending;
  }
  function basicPlatform(g){
    if(!threeExports){
      arena.reason=threeError?'Three.js unavailable: '+threeError.slice(0,48):'Loading 3D platform module';
      if(!threePending&&performance.now()-threeTriedAt>5000)getThree(g);
      return null;
    }
    let geo=null,mat=null;
    try{
      const TH=threeExports;
      // A single simple square, 24 x 24. No walls or composite map meshes.
      geo=new TH.C();
      geo.setAttribute('position',new TH.S(new Float32Array([
        -12,0,-12,   12,0,-12,    12,0,12,
        -12,0,-12,   12,0,12,   -12,0,12
      ]),3));
      geo.computeVertexNormals?.();
      // This material does not rely on UVs, PBR textures, or skinning.
      mat=new TH.ct({color:0x9766c4,side:2,transparent:false,depthWrite:true});
      const mesh=new TH.st(geo,mat);
      mesh.name='XCLUTCH_LOCAL_SQUARE_PLATFORM';mesh.frustumCulled=false;
      g.scene.add(mesh);
      return mesh;
    }catch(e){
      geo?.dispose?.();mat?.dispose?.();
      arena.reason='Platform mesh: '+String(e?.message||e).slice(0,74);
      console.warn('[XCLUTCH] Cannot create platform:',e);return null;
    }
  }
  function startArena(g){
    if(arena.enabled)return true;
    if(g.state!=='playing'||!g.player||!Array.isArray(g.botMgr?.bots)){arena.reason='Waiting for offline match';return false;}
    // Do not change collision / bot state in remote multiplayer sessions.
    if(!localSandbox(g)){arena.reason='Online mode: training platform disabled';return false;}
    const p=g.player;
    // Use the middle of the map waypoints where available (Mirage, Dust etc.).
    const waypoints=(g.map?.waypoints||[]).filter(pt=>Number.isFinite(pt?.x)&&Number.isFinite(pt?.z));
    let cx=p.x,cz=p.z;
    if(waypoints.length>2){
      const xs=waypoints.map(pt=>pt.x), zs=waypoints.map(pt=>pt.z);
      cx=(Math.min(...xs)+Math.max(...xs))/2;
      cz=(Math.min(...zs)+Math.max(...zs))/2;
    }
    const ground=typeof g.physics?.groundHeight==='function' ?
      g.physics.groundHeight(cx,p.y+100,cz) : p.y;
    const tallestBot=Math.max(p.y,...g.botMgr.bots.map(b=>Number(b.y)||0));
    // v11's +8 put the square inside tall Mirage buildings and stairs.
    // Relative to both the waypoint ground and the highest character, default +45.
    const y=Math.max(tallestBot,Number.isFinite(ground)?ground:0)+clamp(Number(cfg.arenaLift)||45,20,100);
    const mesh=basicPlatform(g);
    if(!mesh)return false;
    const physics=g.physics;
    if(!physics||!Array.isArray(physics.boxes)||typeof physics.addBox!=='function'||typeof physics.finalize!=='function'){
      mesh.parent?.remove(mesh);mesh.geometry?.dispose?.();mesh.material?.dispose?.();
      arena.reason='Game physics.addBox unavailable';return false;
    }
    let collider;
    try {
      physics.addBox(cx-12,y-.45,cz-12,cx+12,y,cz+12,'concrete',7);
      collider=physics.boxes[physics.boxes.length-1];
      physics.finalize();
    }catch(e){
      if(collider){const i=physics.boxes.indexOf(collider);if(i>=0)physics.boxes.splice(i,1);}
      try{physics.finalize();}catch{}
      mesh.parent?.remove(mesh);mesh.geometry?.dispose?.();mesh.material?.dispose?.();
      arena.reason='Physics collider: '+String(e?.message||e).slice(0,55);return false;
    }
    arena.reason='Active / physics collider added';
    arena.collider=collider;arena.game=g;arena.mesh=mesh;arena.cx=cx;arena.cz=cz;arena.y=y;
    arena.ground=g.physics?.groundHeight;
    arena.players=[{obj:p,x:p.x,y:p.y,z:p.z}];
    arena.bots=new WeakSet();arena.enabled=true;
    mesh.position.set(cx,y,cz);
    p.x=cx;p.z=cz;snapToPlatform(p,y+.08);
    for(let i=0;i<g.botMgr.bots.length;i++){
      const b=g.botMgr.bots[i];
      arena.players.push({obj:b,x:b.x,y:b.y,z:b.z});
      const angle=i*Math.PI*2/Math.max(1,g.botMgr.bots.length),r=5+(i%3);
      b.x=cx+Math.cos(angle)*r;b.z=cz+Math.sin(angle)*r;
      snapToPlatform(b,y+.08);b.path=[];b.pathI=0;b.repathT=99;
    }
    return true;
  }
  function stopArena(){
    if(!arena.enabled)return;
    const g=arena.game;
    for(const old of arena.players){
      try{old.obj.x=old.x;old.obj.z=old.z;
        snapToPlatform(old.obj,old.y);
        if(Array.isArray(old.obj.path))old.obj.path=[];}catch{}
      const fn=arena.botUpdates.get(old.obj);
      if(fn)try{old.obj.update=fn}catch{}
    }
    arena.botUpdates=new WeakMap();
    if(g?.physics&&arena.collider){
      try{const i=g.physics.boxes.indexOf(arena.collider);if(i>=0)g.physics.boxes.splice(i,1);g.physics.finalize();}
      catch(err){console.warn('[XCLUTCH] Collider restore:',err);}
    }
    if(arena.mesh){try{arena.mesh.parent?.remove(arena.mesh);arena.mesh.geometry?.dispose?.();arena.mesh.material?.dispose?.();}catch{}}
    arena.enabled=false;arena.game=null;arena.mesh=null;arena.players=[];arena.ground=null;arena.collider=null;arena.reason='Inactive';
  }
  function tickArena(g){
    if(cfg.mapMode!=='platform'||g.state!=='playing'||!g.player?.alive){if(arena.enabled)stopArena();return;}
    if(arena.enabled&&arena.game!==g)stopArena();
    if(!arena.enabled){startArena(g);return;}
    const p=g.player;
    p.x=clamp(p.x,arena.cx-10.5,arena.cx+10.5);
    p.z=clamp(p.z,arena.cz-10.5,arena.cz+10.5);
    // Native collision against the injected floor keeps grounded animation stable.
    if(!cfg.noClip&&p.y<arena.y-2){snapToPlatform(p,arena.y+.08);}
    for(const b of g.botMgr?.bots||[]){
      if(trainer.active)continue;
      if(!b||b.alive===false)continue;
      b.x=clamp(b.x,arena.cx-10.5,arena.cx+10.5);
      b.z=clamp(b.z,arena.cz-10.5,arena.cz+10.5);
      if(!(cfg.freezeBots||trainer.active)&&b.y<arena.y-2)snapToPlatform(b,arena.y+.08);
    }
  }

  const originalMethods = new WeakMap();
  function hookMovement(g){
    const input=g?.input, w=g?.weapons;
    if(input&&typeof input.wasPressedA==='function'&&!originalMethods.has(input)){
      const original=input.wasPressedA;
      originalMethods.set(input,original);
      input.wasPressedA=function(action,...args){
        if(action==='jump'&&cfg.bhop&&g.state==='playing'&&g.player?.alive&&!g.frozen&&g.player?.onGround&&typeof this.downA==='function'&&this.downA('jump'))return true;
        return original.call(this,action,...args);
      };
    }
    if(w&&typeof w.maxSpeed==='function'&&!originalMethods.has(w)){
      const original=w.maxSpeed;
      originalMethods.set(w,original);
      w.maxSpeed=function(...args){
        const normal=original.apply(this,args);
        return cfg.speed&&g.state==='playing'?normal*clamp(Number(cfg.speedMult)||1,1,2.5):normal;
      };
    }
  }
  // The engine writes punchP/punchY/shkP/shkY during weapons.update().
  // Changing them only in requestAnimationFrame was too late for some frames.
  // Apply view recoil suppression at the end of the native update and after fire.
  const recoilWrapped = new WeakSet();
  function suppressViewRecoil(w){
    if(!cfg.noRecoil)return;
    for(const k of ['punchP','punchY','shkP','shkY','shkR','shkPV','shkRV','sprayP','sprayY'])
      if(typeof w[k]==='number')w[k]=0;
    const p=w.punch;
    if(p)for(const k of ['aimPitch','aimYaw','velPitch','velYaw','viewPitch','viewYaw'])
      if(typeof p[k]==='number')p[k]=0;
    // Deliberately do not change the punch index, spread or recoil server calculations.
  }
  function hookRecoil(g){
    const w=g?.weapons;
    if(!w||recoilWrapped.has(w))return;
    recoilWrapped.add(w);
    if(typeof w.update==='function'){
      const update=w.update;
      w.update=function(...args){
        const result=update.apply(this,args);
        if(g.state==='playing'&&cfg.noRecoil)suppressViewRecoil(this);
        return result;
      };
    }
    if(typeof w.fire==='function'){
      const fire=w.fire;
      w.fire=function(...args){
        const result=fire.apply(this,args);
        if(g.state==='playing'&&cfg.noRecoil)suppressViewRecoil(this);
        return result;
      };
    }
  }
  // Hook the engine's own viewmodel selection instead of swapping server inventory.
  // _povLoadout returns {wid,paintOpts} and the engine reloads its rig when wid changes.
  const modelWrapped=new WeakSet();
  function hookKnifeModel(g){
    if(!g||modelWrapped.has(g)||typeof g._povLoadout!=='function')return;
    modelWrapped.add(g);
    const original=g._povLoadout;
    const choices=new Set(['knife_butterfly','knife_m9','knife_karambit','knife_bayonet','knife_flip','knife_skeleton','knife_huntsman']);
    g._povLoadout=function(...args){
      const result=original.apply(this,args);
      if(!cfg.skinChanger||!choices.has(cfg.knifeModel)||!result?.wid)return result;
      const id=String(result.wid);
      if(!(id==='knife_ct'||id==='knife_t'||id.startsWith('knife_')))return result;
      if(g.spectating||g.state!=='playing'||g.weapons?.current!=='knife')return result;
      return {...result,wid:cfg.knifeModel,paintOpts:{...result.paintOpts,kit:null,item:null}};
    };
  }
  // Color fill intentionally disables the original diffuse texture so the
  // selected color shows as a true fill rather than getting multiplied by an
  // existing dark skin texture. Restore never changes the original materials.
  const colorPresets={violet:0xaf65fd,emerald:0x51d2a0,crimson:0xe25b7e,gold:0xe5ae50,ice:0x78bcef};
  let skinRoot=null,skinsUsed=new Map(),lastSkinTime=0,lastSkinKey='';
  function restoreSkins(){
    for(const [mesh,record] of skinsUsed){
      try{if(mesh.material===record.replacement)mesh.material=record.original;}catch{}
      const mats=Array.isArray(record.replacement)?record.replacement:[record.replacement];
      for(const m of mats){try{if(m&&m!==record.original)m.dispose?.();}catch{}}
    }
    skinsUsed.clear();skinRoot=null;lastSkinKey='';
  }
  function recolorSkin(g,time){
    if(!cfg.skinChanger||g?.state!=='playing'||cfg.skinPreset==='original'){
      if(skinsUsed.size)restoreSkins();return;
    }
    const rig=g.cs2?.rig;
    const cs2Root=g.cs2Ready&&(rig?._paintGun?.traverse?rig._paintGun:rig?.gun?.traverse?rig.gun:null);
    const root=cs2Root||g.viewmodel?.current;
    if(!root||typeof root.traverse!=='function'){if(skinsUsed.size)restoreSkins();return;}
    const key=String(cfg.skinPreset)+':'+String(cfg.skinCustomColor);
    const tint=cfg.skinPreset==='custom'
      ? (/^#[0-9a-f]{6}$/i.test(String(cfg.skinCustomColor))?parseInt(cfg.skinCustomColor.slice(1),16):colorPresets.violet)
      : (colorPresets[cfg.skinPreset]??colorPresets.violet);
    if(root!==skinRoot||key!==lastSkinKey)restoreSkins();
    skinRoot=root;lastSkinKey=key;lastSkinTime=time;
    root.traverse(mesh=>{
      if(!mesh?.isMesh||!mesh.material)return;
      const name=(mesh.name||'').toLowerCase();
      if(/arm|sleeve|hand|glove|skin|finger/.test(name))return;
      const old=skinsUsed.get(mesh);
      if(old){
        if(mesh.material===old.replacement)return;
        // Engine replaced the material even though it reused this mesh.
        const mats=Array.isArray(old.replacement)?old.replacement:[old.replacement];
        mats.forEach(m=>{try{m?.dispose?.()}catch{}});skinsUsed.delete(mesh);
      }
      const original=mesh.material;
      const cloneMat=m=>{
        if(!m||typeof m.clone!=='function')return m;
        const copy=m.clone();
        if(copy.color?.setHex){copy.color.setHex(tint);copy.map=null;copy.vertexColors=false;copy.needsUpdate=true;}
        return copy;
      };
      const replacement=Array.isArray(original)?original.map(cloneMat):cloneMat(original);
      if(replacement===original)return;
      skinsUsed.set(mesh,{original,replacement});mesh.material=replacement;
    });
  }

  // === XCLUTCH v15: local 3D target trainer (no bot hitboxes required) ===
  const trainer={active:false,finished:false,requested:false,game:null,remaining:60,started:0,lastNow:0,hits:0,shots:0,
    message:'Ready',old:null,hooked:new WeakSet(),targets:[],meshes:[],hidden:[],lastUi:0};
  const trainerHooks=new WeakSet();
  function shotRay(g){
    const cam=g.camera;
    if(!cam)return null;
    cam.updateMatrixWorld?.(true);
    const e=cam.matrixWorld?.elements;
    if(e?.length>=16){return {x:e[12],y:e[13],z:e[14],dx:-e[8],dy:-e[9],dz:-e[10]};}
    const p=g.player,yaw=Number(p.yaw)||0,pitch=Number(p.pitch)||0;
    return {x:p.x,y:p.y+1.6,z:p.z,dx:-Math.sin(yaw)*Math.cos(pitch),dy:Math.sin(pitch),dz:-Math.cos(yaw)*Math.cos(pitch)};
  }
  function trainerHitTest(g){
    const r=shotRay(g);if(!r)return false;
    // Ray / sphere intersection. Targets are regular Three.js meshes but use
    // this independent ray test because gameplay hitboxes belong to real bots.
    let best=Infinity,found=null;
    for(const target of trainer.targets){
      const vx=target.x-r.x,vy=target.y-r.y,vz=target.z-r.z;
      const t=vx*r.dx+vy*r.dy+vz*r.dz;
      if(t<=0||t>=160)continue;
      const dx=vx-r.dx*t,dy=vy-r.dy*t,dz=vz-r.dz*t;
      if(dx*dx+dy*dy+dz*dz<=target.radius*target.radius&&t<best){best=t;found=target;}
    }
    if(found){trainer.hits++;trainer.message='Hit!';return true;}
    return false;
  }
  function hookTrainer(g){
    if(trainerHooks.has(g))return;
    trainerHooks.add(g);
    if(typeof g.dealDamage==='function'){
      const orig=g.dealDamage;
      g.dealDamage=function(target,damage,attacker,...args){
        if(trainer.active&&trainer.game===g&&localSandbox(g))return;
        return orig.call(this,target,damage,attacker,...args);
      };
    }
    if(g.weapons&&typeof g.weapons.fire==='function'){
      const w=g.weapons,original=w.fire;
      w.fire=function(...args){
        if(trainer.active&&trainer.game===g&&trainer.finished)return;
        const before=typeof this.state==='function'?Number(this.state()?.ammo):NaN;
        const result=original.apply(this,args);
        const after=typeof this.state==='function'?Number(this.state()?.ammo):NaN;
        if(trainer.active&&trainer.game===g&&Number.isFinite(before)&&Number.isFinite(after)&&after<before){
          trainer.shots++;trainerHitTest(g);
        }
        return result;
      };
    }
  }
  const modesWrapped=new WeakSet();
  function hookRoundTimer(g){
    const mode=g.modeCtl;
    if(mode&&typeof mode.update==='function'&&!modesWrapped.has(mode)){
      modesWrapped.add(mode);const original=mode.update;
      mode.update=function(...args){
        if(trainer.active&&trainer.game===g&&localSandbox(g))return;
        return original.apply(this,args);
      };
    }
  }
  // Color-coded circular targets made from shared, very cheap BufferGeometry.
  function targetDiskMesh(g,radius,color){
    const TH=threeExports,n=32,positions=[];
    for(let i=0;i<n;i++){
      const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;
      positions.push(0,0,0,Math.cos(a)*radius,Math.sin(a)*radius,0,Math.cos(b)*radius,Math.sin(b)*radius,0);
    }
    const geo=new TH.C();geo.setAttribute('position',new TH.S(new Float32Array(positions),3));geo.computeVertexNormals?.();
    const mat=new TH.ct({color,side:2,depthWrite:true});const mesh=new TH.st(geo,mat);
    mesh.name='XCLUTCH_TRAINING_TARGET';mesh.frustumCulled=false;g.scene.add(mesh);trainer.meshes.push(mesh);return mesh;
  }
  function createTargets(g){
    if(!arena.enabled||!threeExports)return false;
    const p=g.player,yaw=Number(p.yaw)||0;
    const forward={x:-Math.sin(yaw),z:-Math.cos(yaw)},side={x:Math.cos(yaw),z:-Math.sin(yaw)};
    const positions=[[-5,11],[-2.6,14],[0,17],[2.6,14],[5,11]];
    trainer.targets=[];
    for(let i=0;i<positions.length;i++){
      const [sideOffset,distance]=positions[i];
      const x=p.x+forward.x*distance+side.x*sideOffset;
      const z=p.z+forward.z*distance+side.z*sideOffset;
      const y=arena.y+1.7+(i%2)*.35;
      const parts=[{r:1.03,color:0x291a42},{r:.83,color:0xf7f1fa},{r:.63,color:0xf05b83},{r:.43,color:0xfdf5f6},{r:.23,color:0xb52464}];
      let targetHead;
      parts.forEach((ring,k)=>{
        const mesh=targetDiskMesh(g,ring.r,ring.color);
        mesh.position.set(x,y,z);
        mesh.lookAt?.(p.x,p.y+1.6,p.z);
        // Move each smaller disk a tiny bit toward player to avoid z-fighting.
        if(k){const vec={x:p.x-x,y:p.y+1.6-y,z:p.z-z},len=Math.hypot(vec.x,vec.y,vec.z)||1;
          mesh.position.x+=vec.x/len*k*.009;mesh.position.y+=vec.y/len*k*.009;mesh.position.z+=vec.z/len*k*.009;}
        if(k===0)targetHead=mesh;
      });
      trainer.targets.push({x,y,z,radius:.98,mesh:targetHead});
    }
    return trainer.targets.length>0;
  }
  function removeTargets(){
    for(const mesh of trainer.meshes){try{mesh.parent?.remove(mesh);mesh.geometry?.dispose?.();mesh.material?.dispose?.();}catch{}}
    trainer.meshes=[];trainer.targets=[];
    for(const h of trainer.hidden){try{h.root.visible=h.visible;}catch{}}
    trainer.hidden=[];
  }
  function startTrainer(g){
    if(!localSandbox(g)){trainer.message='Offline bot match required';trainer.requested=false;cfg.aimTrainer=false;return;}
    if(trainer.active)return;
    if(!threeExports){
      if(!threePending&&performance.now()-threeTriedAt>1000)getThree(g);
      trainer.message=threeError?'Waiting for Three.js: '+threeError.slice(0,45):'Loading practice platform';
      if(threeError&&performance.now()-threeTriedAt>12000){trainer.requested=false;cfg.aimTrainer=false;}
      return;
    }
    const previous={aim:cfg.aim,rage:cfg.rage,triggerbot:cfg.triggerbot,freezeBots:cfg.freezeBots,
      noClip:cfg.noClip,mapMode:cfg.mapMode,roundTimeLeft:Number(g.roundTimeLeft)};
    cfg.aim=false;cfg.rage=false;cfg.triggerbot=false;cfg.freezeBots=true;cfg.noClip=false;cfg.mapMode='platform';
    if(arena.enabled)stopArena();
    if(!startArena(g)){
      Object.assign(cfg,previous);trainer.message=arena.reason||'Platform unavailable';
      trainer.requested=false;cfg.aimTrainer=false;return;
    }
    trainer.old=previous;trainer.game=g;trainer.active=true;trainer.finished=false;trainer.requested=false;
    trainer.remaining=Number(cfg.trainerDuration)||60;trainer.started=performance.now();trainer.lastUi=0;
    trainer.hits=0;trainer.shots=0;trainer.message='Training';
    // Player at back of arena; bots remain frozen and hidden, no ESP rectangles.
    const yaw=Number(g.player.yaw)||0;
    g.player.x=arena.cx+Math.sin(yaw)*7;g.player.z=arena.cz+Math.cos(yaw)*7;
    snapToPlatform(g.player,arena.y+.08);
    for(const b of getBots(g)){
      const root=b?.cs2Agent?.root;
      if(root){trainer.hidden.push({root,visible:root.visible});root.visible=false;}
      b.x=arena.cx+120;b.z=arena.cz+120;snapToPlatform(b,arena.y+.1);
    }
    try{if(!createTargets(g))throw Error('Could not create targets');}
    catch(e){removeTargets();stopTrainer('Target error: '+String(e.message||e).slice(0,60));return;}
    document.getElementById('xcl-trainer-finish')?.classList.remove('show');
    hookTrainer(g);hookRoundTimer(g);save();updateUI();
  }
  function stopTrainer(reason='Stopped'){
    if(!trainer.active){trainer.requested=false;cfg.aimTrainer=false;trainer.message=reason;return;}
    const previous=trainer.old;
    trainer.active=false;trainer.finished=false;trainer.requested=false;cfg.aimTrainer=false;
    removeTargets();
    if(arena.enabled)stopArena();
    if(previous)for(const k of ['aim','rage','triggerbot','freezeBots','noClip','mapMode'])cfg[k]=previous[k];
    trainer.old=null;trainer.game=null;
    trainer.message=reason+' • '+trainer.hits+' hits / '+trainer.shots+' shots';
    document.getElementById('xcl-trainer-finish')?.classList.remove('show');
    save();updateUI();
  }
  function tickTrainer(g,now){
    const hud=document.getElementById('xcl-trainer-hud');
    if(trainer.active){
      if(!localSandbox(g)||g!==trainer.game||!arena.enabled){stopTrainer('Interrupted');return;}
      if(!trainer.finished){
        trainer.remaining=Math.max(0,(Number(cfg.trainerDuration)||60)-(now-trainer.started)/1000);
        if(trainer.remaining<=0){
          trainer.remaining=0;trainer.finished=true;trainer.message='Training finished';
          const finish=document.getElementById('xcl-trainer-finish');
          if(finish){finish.classList.add('show');finish.innerHTML='ТРЕНИРОВКА ЗАКОНЧЕНА'+
             '<small>Hits '+trainer.hits+' / Shots '+trainer.shots+' · Accuracy '+(trainer.shots?Math.round(trainer.hits/trainer.shots*100):0)+'%<br>Нажми Insert → Trainer и выключи переключатель, чтобы вернуться</small>';}
        }
      }
      if(!g.modeCtl&&Number.isFinite(g.roundTimeLeft)&&Number.isFinite(trainer.old?.roundTimeLeft)){
        g.roundTimeLeft=trainer.old.roundTimeLeft;
      }
      for(const h of trainer.hidden){if(h.root)h.root.visible=false;}
      if(hud){hud.classList.add('on');hud.innerHTML=(trainer.finished?'AIM TRAINER · FINISHED':'AIM TRAINER · '+Math.ceil(trainer.remaining)+'s')+
        '<br>Hits '+trainer.hits+' / Shots '+trainer.shots+
        '<small>Accuracy '+(trainer.shots?Math.min(100,Math.round(trainer.hits/trainer.shots*100)):0)+'% • Aim & Trigger OFF</small>';}
    }else if(hud)hud.classList.remove('on');
    if(trainer.requested&&!trainer.active&&g&&localSandbox(g))startTrainer(g);
  }

  // === Safe map geometry tint: static level meshes only, no dynamic actors ===
  const mapStyle={game:null,saved:new Map(),flat:null,color:null,changed:false};
  function safeMapMesh(mesh,g){
    if(!mesh?.isMesh||mesh.isSkinnedMesh||!mesh.geometry||!mesh.material)return false;
    if(mesh.name==='XCLUTCH_LOCAL_SQUARE_PLATFORM'||mesh.name==='XCLUTCH_TRAINING_TARGET')return false;
    const roots=[g.viewmodel?.root,g.cs2?.root,g.player?.cs2Agent?.root,...getBots(g).map(b=>b?.cs2Agent?.root)];
    for(let n=mesh;n;n=n.parent){if(roots.includes(n))return false;}
    const label=(mesh.name||'').toLowerCase();
    const matNames=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>String(m?.name||'')).join(' ').toLowerCase();
    const words=label+' '+matNames;
    if(/weapon|viewmodel|agent|body|player|arm|glove|knife|muzzle|bullet|tracer|particle|crosshair|blood|glass|window|water|sky|foliage|leaf|palm|tree|vegetation|decal|sprite|flag|fx|smoke|fire|light/i.test(words))return false;
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(mats.some(m=>!m||m.transparent||m.opacity<1||m.alphaTest>0||m.depthWrite===false))return false;
    if(!mesh.geometry.getAttribute?.('position'))return false;
    // Restrict to large, static geometry. Small props and detailed materials
    // retain original appearance instead of breaking the map's shader pipeline.
    if(typeof mesh.geometry.computeBoundingBox==='function'){
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      const b=mesh.geometry.boundingBox;
      const dimensions=[b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z];
      const scale=mesh.scale||{x:1,y:1,z:1};
      if(Math.max(dimensions[0]*Math.abs(scale.x),dimensions[1]*Math.abs(scale.y),dimensions[2]*Math.abs(scale.z))<2.2)return false;
    }
    return true;
  }
  function restoreMapFill(){
    for(const [mesh,material] of mapStyle.saved){try{mesh.material=material;}catch{}}
    mapStyle.saved.clear();mapStyle.flat?.dispose?.();mapStyle.flat=null;mapStyle.game=null;mapStyle.color=null;
  }
  function applyMapFill(g){
    if(!cfg.mapFill||!localSandbox(g)){if(mapStyle.saved.size)restoreMapFill();return;}
    if(mapStyle.game&&mapStyle.game!==g)restoreMapFill();
    const hex=/^#[0-9a-f]{6}$/i.test(cfg.mapFillColor)?cfg.mapFillColor:'#888888';
    if(!threeExports){if(!threePending&&performance.now()-threeTriedAt>5000)getThree(g);return;}
    try{
      if(!mapStyle.flat){mapStyle.flat=new threeExports.ct({color:hex,side:2,depthWrite:true});mapStyle.game=g;mapStyle.color=hex;}
      if(hex!==mapStyle.color){mapStyle.flat.color?.set?.(hex);mapStyle.color=hex;}
      // Some level meshes stream into the scene; keep them in sync and avoid
      // touching any meshes belonging to the local trainer or viewmodel.
      let count=0;
      g.scene?.traverse?.(obj=>{
        if(count>=1500||!safeMapMesh(obj,g))return;
        if(!mapStyle.saved.has(obj))mapStyle.saved.set(obj,obj.material);
        if(obj.material!==mapStyle.flat)obj.material=mapStyle.flat;
        count++;
      });
      if(!count){restoreMapFill();cfg.mapFill=false;}
    }catch(e){console.warn('[XCLUTCH] Map tint unavailable:',e);restoreMapFill();cfg.mapFill=false;}
  }
  const lite={renderer:null,pixelRatio:null,shadows:null,active:false};
  function restoreLite(){
    if(lite.active&&lite.renderer){
      try{lite.renderer.setPixelRatio?.(lite.pixelRatio);if(lite.renderer.shadowMap&&lite.shadows!==null)lite.renderer.shadowMap.enabled=lite.shadows;}catch{}
    }
    lite.renderer=null;lite.active=false;lite.pixelRatio=null;lite.shadows=null;
  }
  function tickLite(g){
    if(!cfg.liteRender||!localSandbox(g)){if(lite.active)restoreLite();return;}
    const r=g.renderer;
    if(!r||typeof r.setPixelRatio!=='function')return;
    if(lite.active&&lite.renderer!==r)restoreLite();
    if(!lite.active){
      lite.renderer=r;lite.pixelRatio=r.getPixelRatio?.()||Math.min(window.devicePixelRatio||1,2);
      lite.shadows=r.shadowMap?.enabled??null;lite.active=true;
    }
    // 70% resolution significantly reduces fragment work on weaker computers.
    r.setPixelRatio(Math.min(lite.pixelRatio,Math.max(.5,lite.pixelRatio*.70)));
    if(r.shadowMap)r.shadowMap.enabled=false;
  }
  // === Independent, reversible FUN modes ===
  const funState={canvas:null,filter:null,botScales:new Map()};
  function restoreFun(){
    if(funState.canvas){funState.canvas.style.filter=funState.filter??'';funState.canvas=null;funState.filter=null;}
    for(const [root,scale] of funState.botScales){try{root.scale.set(scale.x,scale.y,scale.z);}catch{}}
    funState.botScales.clear();
    for(const cls of ['xcl-vhs','xcl-cinema','xcl-fun-pulse'])document.body?.classList.remove(cls);
  }
  function tickFun(g){
    const body=document.body;if(!body)return;
    body.classList.toggle('xcl-vhs',!!cfg.funVhs);
    body.classList.toggle('xcl-cinema',!!cfg.funCinema);
    body.classList.toggle('xcl-fun-pulse',!!cfg.funPulse);
    const canvas=g?.renderer?.domElement || document.querySelector('#game canvas');
    if(funState.canvas!==canvas){if(funState.canvas)funState.canvas.style.filter=funState.filter??'';
      funState.canvas=canvas||null;funState.filter=canvas?canvas.style.filter:null;}
    if(canvas){
      const effects=[];
      if(cfg.funNight)effects.push('grayscale(1)','sepia(1)','hue-rotate(64deg)','saturate(5)','brightness(1.15)');
      if(cfg.funInvert)effects.push('invert(1)');
      if(cfg.funPixel)effects.push('contrast(1.65)','saturate(1.4)');
      canvas.style.filter=effects.join(' ')||(funState.filter??'');
      canvas.style.imageRendering=cfg.funPixel?'pixelated':'';
    }
    if(!g||!localSandbox(g)||!cfg.funGiantBots){
      for(const [root,scale] of funState.botScales){try{root.scale.set(scale.x,scale.y,scale.z)}catch{}}
      funState.botScales.clear();return;
    }
    for(const bot of getBots(g)){
      const root=bot?.cs2Agent?.root;
      if(!root?.scale||trainer.active)continue;
      if(!funState.botScales.has(root))funState.botScales.set(root,{x:root.scale.x,y:root.scale.y,z:root.scale.z});
      const old=funState.botScales.get(root);
      root.scale.set(old.x*1.75,old.y*1.75,old.z*1.75);
    }
  }
  let performanceTick=0;
  function tickPerformance(g,now){
    document.body?.classList.toggle('xcl-rainbow',!!cfg.rainbowCrosshair);
    if(now-performanceTick<850)return;
    performanceTick=now;
    if(g){tickLite(g);applyMapFill(g);tickFun(g);}
    else{restoreLite();restoreMapFill();tickFun(null);}
  }
  function draw(time){
    requestAnimationFrame(draw);
    if(!init())return;
    let g=window.game;
    const good=!!(g&&g.player&&g.camera&&g.botMgr&&g.state==='playing');
    if(good&&(cfg.aim||cfg.rage)&&!trainer.active&&!open){
      const dt=lastAim?clamp((time-lastAim)/1000,.005,.05):.016;
      assist(g,dt);
    }
    if(good){hookTrainer(g);hookRoundTimer(g);hookPlayerNoClip(g);hookFreezeBots(g);hookMovement(g);hookRecoil(g);hookKnifeModel(g);if(cfg.noRecoil)suppressViewRecoil(g.weapons);maybeTrigger(g,time);recolorSkin(g,time);
      if(cfg.thirdPerson||Number(cfg.povFov)>=55){hookThirdPerson(g);if(cfg.thirdPerson)updateAvatar(g);else if(thirdState.root)thirdState.root.visible=false;}else if(thirdState.root)thirdState.root.visible=false;
      tickArena(g);tickTrainer(g,time);
      if(freecam.pos)resetFreecam();
    }else{if(trainer.active)stopTrainer('Interrupted');if(freecam.pos)resetFreecam();if(skinsUsed.size)restoreSkins();if(thirdState.root)thirdState.root.visible=false;if(arena.enabled)stopArena();}
    if(menu){const mapLabel=menu.querySelector('#x7-map-name');if(mapLabel)mapLabel.textContent=g?.map?.name||'Unknown';
      const state=menu.querySelector('#xcl-arena-state');if(state)state.textContent=arena.reason.slice(0,90);
    }
    tickPerformance(good?g:null,time);
    if(menu&&trainer.active&&time-(trainer.lastUi||0)>=400){trainer.lastUi=time;updateUI();}
    lastAim=time;
    if(time-lastDraw<33)return;lastDraw=time;
    if(!g || !viewport(g)){ctx?.clearRect(0,0,W,H);if(menu)updateUI();return;}
    ctx.clearRect(0,0,W,H);
    if(!good||open)return;
    try {
      g.camera.updateMatrixWorld?.();
      if(cfg.showFov&&(cfg.aim||cfg.rage)){
        let fovDegrees=Number(g.camera.fov)||76;
        let radius=clamp(W*.5*Math.tan((cfg.aimFov*Math.PI/360))/Math.tan((fovDegrees*Math.PI/360)),10,W*.45);
        ctx.strokeStyle='#af7bec70';ctx.lineWidth=1;ctx.beginPath();ctx.arc(W/2,H/2,radius,0,2*Math.PI);ctx.stroke();
      }
      if(cfg.esp&&!trainer.active)for(const b of getBots(g))if(enemy(b,g.player)){let rect=bounds(b,g);if(rect)paintBot(b,rect,g);}
      lastError='';
    } catch(e){if(String(e)!==lastError){lastError=String(e);console.warn('[XCLUTCH] Compatibility:',e);}}
    if(toggleHint&&open)updateUI();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();requestAnimationFrame(draw);},{once:true});
  else {init();requestAnimationFrame(draw);}
})();


;(() => {
  if (window.__XCLUTCH_IOS_PORT_PATCH) return;
  window.__XCLUTCH_IOS_PORT_PATCH = true;

  const style = document.createElement('style');
  style.id = 'xclutch-ios-port-style';
  style.textContent = `
    :root { --xclutch-native-scale: .84; }

    @media (max-width: 1000px), (max-height: 600px) {
      #x7-panel {
        width: min(68vw, 620px) !important;
        height: min(82vh, 390px) !important;
        min-width: 500px;
        transform: translate(-50%,-50%) scale(var(--xclutch-native-scale)) !important;
        transform-origin: center center !important;
        border-radius: 12px !important;
      }

      #x7-panel .x7-sidebar {
        width: 122px !important;
        padding: 14px 7px 9px !important;
      }

      #x7-panel .x7-body {
        padding: 15px 13px 11px !important;
      }

      #x7-panel .x7-nav {
        padding: 8px 10px !important;
        font-size: 11px !important;
        margin: 1px 0 !important;
      }

      #x7-panel .xc-brand {
        padding: 4px 3px 9px !important;
        margin-bottom: 5px !important;
      }

      #x7-panel .xc-brandwords .x7-mark {
        font-size: 15px !important;
      }

      #x7-panel .xc-credit,
      #x7-panel .xc-build {
        font-size: 7.8px !important;
      }

      #x7-panel .x7-meta {
        font-size: 8px !important;
        line-height: 1.45 !important;
      }

      #x7-panel h2 {
        font-size: 17px !important;
      }

      #x7-panel .x7-sub {
        font-size: 10px !important;
        margin-bottom: 12px !important;
      }

      #x7-panel .x7-grid {
        gap: 8px !important;
      }

      #x7-panel .x7-card {
        padding: 9px !important;
      }

      #x7-panel .x7-row {
        min-height: 34px !important;
      }

      #x7-panel .x7-row span {
        font-size: 10px !important;
      }

      #x7-panel input[type=range] {
        width: 92px !important;
      }

      #x7-panel select {
        max-width: 110px !important;
        font-size: 10px !important;
        padding: 4px !important;
      }

      #x7-indicator {
        display: none !important;
      }
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  window.__x7SetMenuScale = function(v) {
    const value = Math.max(.62, Math.min(1.0, Number(v) || .84));
    document.documentElement.style.setProperty('--xclutch-native-scale', String(value));
    try { localStorage.setItem('xclutch_ios_menu_scale', String(value)); } catch {}
  };

  try {
    window.__x7SetMenuScale(localStorage.getItem('xclutch_ios_menu_scale') || .84);
  } catch {
    window.__x7SetMenuScale(.84);
  }
})();
