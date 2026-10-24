ARCHS = arm64
TARGET = iphone:clang:latest:16.0
THEOS_PACKAGE_SCHEME = rootless

include $(THEOS)/makefiles/common.mk

APPLICATION_NAME = ClutcherPort

ClutcherPort_FILES = main.m AppDelegate.m GameViewController.m X7JoystickView.m
ClutcherPort_FRAMEWORKS = UIKit WebKit
ClutcherPort_CFLAGS = -fobjc-arc -Wno-error=deprecated-declarations
ClutcherPort_INSTALL_PATH = /Applications
ClutcherPort_RESOURCE_FILES = Resources/AppIcon@2x.png Resources/AppIcon@3x.png XCLUTCH.js Bridge.js

include $(THEOS_MAKE_PATH)/application.mk
