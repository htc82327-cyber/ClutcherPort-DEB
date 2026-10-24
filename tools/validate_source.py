from pathlib import Path
import plistlib

root = Path(__file__).resolve().parents[1]

required = [
    "Makefile",
    "control",
    "main.m",
    "AppDelegate.h",
    "AppDelegate.m",
    "GameViewController.h",
    "GameViewController.m",
    "X7JoystickView.h",
    "X7JoystickView.m",
    "XCLUTCH.js",
    "Bridge.js",
    "Resources/Info.plist",
    "Resources/AppIcon@2x.png",
    "Resources/AppIcon@3x.png",
]

missing = [p for p in required if not (root / p).exists()]
if missing:
    raise SystemExit("Missing: " + ", ".join(missing))

control = (root / "control").read_text(encoding="utf-8")
makefile = (root / "Makefile").read_text(encoding="utf-8")
game = (root / "GameViewController.m").read_text(encoding="utf-8")
bridge = (root / "Bridge.js").read_text(encoding="utf-8")
xcl = (root / "XCLUTCH.js").read_text(encoding="utf-8")

with (root / "Resources/Info.plist").open("rb") as f:
    info = plistlib.load(f)

checks = [
    ("Version: 1.0.0", control),
    ("Architecture: iphoneos-arm64", control),
    ("THEOS_PACKAGE_SCHEME = rootless", makefile),
    ("ARCHS = arm64", makefile),
    ("ClutcherPort_FRAMEWORKS = UIKit WebKit", makefile),
    ("Bridge.js", makefile),
    ('https://www.clutcher.io/', game),
    ("WKWebView", game),
    ("X7JoystickView", game),
    ('@"INS"', game),
    ('@"FIRE"', game),
    ('@"AIM"', game),
    ("cameraPanned:", game),
    ("pathForResource:@\"Bridge\"", game),
    ("window.__x7Look", bridge),
    ("window.__x7Key", bridge),
    ("window.__x7Mouse", bridge),
    ("window.open = function", bridge),
    ("XCLUTCH", xcl),
    ("Visuals", xcl),
    ("Aim", xcl),
    ("Rage", xcl),
    ("Skins", xcl),
    ("Other", xcl),
    ("Trainer", xcl),
    ("FUN", xcl),
    ("Config", xcl),
    ("No Clip / Player Fly", xcl),
    ("Freeze All Bots", xcl),
    ("Third Person", xcl),
    ("made by thxrealx7 only tiktok", xcl),
    ("--xclutch-native-scale", xcl),
]

for needle, haystack in checks:
    if needle not in haystack:
        raise SystemExit("Missing feature: " + needle)

if "preferenceloader" in control.lower():
    raise SystemExit("PreferenceLoader must not be required")

if '@R"JS' in game or ')JS"' in game:
    raise SystemExit("C++ raw string accidentally left in Objective-C .m")

if "contentEdgeInsets" in game:
    raise SystemExit("Do not use contentEdgeInsets")

if '#import <math.h>' not in game:
    raise SystemExit("math.h missing")

if info.get("CFBundleIdentifier") != "com.thxrealx7.clutcherport":
    raise SystemExit("Wrong bundle id")

if info.get("MinimumOSVersion") != "16.0":
    raise SystemExit("Wrong minimum iOS")

if set(info.get("UISupportedInterfaceOrientations", [])) != {
    "UIInterfaceOrientationLandscapeLeft",
    "UIInterfaceOrientationLandscapeRight",
}:
    raise SystemExit("Landscape orientations missing")

print("Clutcher Port v1.0 validation OK")
