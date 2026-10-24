# Clutcher Port v1.0

Standalone jailbreak app for **iPhone X / iOS 16 / Dopamine rootless**.

## What it does
- opens `clutcher.io` inside its own WKWebView app, not Safari;
- keeps popup/new-window navigation inside the app;
- landscape fullscreen;
- native mobile controls:
  - left joystick = W/A/S/D;
  - swipe on the right side = camera look;
  - FIRE / AIM;
  - JUMP / crouch / reload;
  - B buy, E use/plant/defuse;
  - 1 / 2 / 3 / Q / G / F / TAB;
- separate `INS` button;
- bundled **XCLUTCH v15** with no key/auth check;
- XCLUTCH tabs: Visuals, Aim, Rage, Skins, Other, Trainer, FUN, Config;
- native `PORT` panel:
  - show/hide Mobile HUD;
  - HUD scale;
  - HUD opacity;
  - XCLUTCH scale;
- compact XCLUTCH mobile layout;
- `↻` reload button.

## Build
Upload the contents of this ZIP to the root of the GitHub repository.

Then:
`Actions → Build Clutcher Port → ClutcherPort-DEB`

The generated package is rootless `iphoneos-arm64` for iOS 16.
