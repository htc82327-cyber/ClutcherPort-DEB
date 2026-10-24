#import "GameViewController.h"
#import <math.h>

static NSString * const X7GameURL = @"https://www.clutcher.io/";

@interface GameViewController ()

@property(nonatomic,strong) WKWebView *webView;

@property(nonatomic,strong) UIView *hudContainer;
@property(nonatomic,strong) X7JoystickView *joystick;

@property(nonatomic,strong) UIButton *portButton;
@property(nonatomic,strong) UIButton *insButton;
@property(nonatomic,strong) UIButton *reloadButton;

@property(nonatomic,strong) UIVisualEffectView *settingsPanel;
@property(nonatomic,strong) UISlider *hudScaleSlider;
@property(nonatomic,strong) UISlider *opacitySlider;
@property(nonatomic,strong) UISlider *menuScaleSlider;

@property(nonatomic,strong) NSMutableSet<NSString *> *heldKeys;
@property(nonatomic,assign) BOOL hudEnabled;
@property(nonatomic,assign) BOOL menuOpen;
@property(nonatomic,assign) BOOL hudWasEnabledBeforeMenu;

@property(nonatomic,assign) CGPoint lastCameraPoint;
@property(nonatomic,assign) BOOL cameraGestureAccepted;

@end

@implementation GameViewController

#pragma mark - Life cycle

- (void)viewDidLoad {
    [super viewDidLoad];

    self.view.backgroundColor = UIColor.blackColor;
    self.heldKeys = [NSMutableSet set];

    [self setupWebView];
    [self setupNativeHUD];
    [self setupTopButtons];
    [self setupSettingsPanel];
    [self loadSavedPortSettings];
    [self loadGame];
}

- (BOOL)prefersStatusBarHidden {
    return YES;
}

- (BOOL)prefersHomeIndicatorAutoHidden {
    return YES;
}

- (UIRectEdge)preferredScreenEdgesDeferringSystemGestures {
    return UIRectEdgeAll;
}

- (UIInterfaceOrientationMask)supportedInterfaceOrientations {
    return UIInterfaceOrientationMaskLandscape;
}

#pragma mark - WebView

- (NSString *)inputBridgeJavaScript {
    NSString *path =
        [NSBundle.mainBundle pathForResource:@"Bridge" ofType:@"js"];

    NSString *source =
        [NSString stringWithContentsOfFile:path
                                  encoding:NSUTF8StringEncoding
                                     error:nil];

    return source ?: @"";
}

- (void)setupWebView {
    WKWebViewConfiguration *config = [WKWebViewConfiguration new];
    config.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
    config.allowsInlineMediaPlayback = YES;
    config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;

    WKUserContentController *controller = [WKUserContentController new];

    WKUserScript *inputScript =
        [[WKUserScript alloc] initWithSource:[self inputBridgeJavaScript]
                              injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                           forMainFrameOnly:YES];

    [controller addUserScript:inputScript];

    NSString *xclutchPath =
        [NSBundle.mainBundle pathForResource:@"XCLUTCH" ofType:@"js"];

    NSString *xclutch =
        [NSString stringWithContentsOfFile:xclutchPath
                                  encoding:NSUTF8StringEncoding
                                     error:nil];

    if (xclutch.length > 0) {
        WKUserScript *xclutchScript =
            [[WKUserScript alloc] initWithSource:xclutch
                                  injectionTime:WKUserScriptInjectionTimeAtDocumentEnd
                               forMainFrameOnly:YES];

        [controller addUserScript:xclutchScript];
    }

    config.userContentController = controller;

    if (@available(iOS 14.0, *)) {
        WKWebpagePreferences *pagePrefs = [WKWebpagePreferences new];
        pagePrefs.allowsContentJavaScript = YES;
        config.defaultWebpagePreferences = pagePrefs;
    }

    self.webView =
        [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];

    self.webView.translatesAutoresizingMaskIntoConstraints = NO;
    self.webView.navigationDelegate = self;
    self.webView.UIDelegate = self;
    self.webView.opaque = YES;
    self.webView.backgroundColor = UIColor.blackColor;

    self.webView.scrollView.bounces = NO;
    self.webView.scrollView.contentInsetAdjustmentBehavior =
        UIScrollViewContentInsetAdjustmentNever;

    [self.view addSubview:self.webView];

    [NSLayoutConstraint activateConstraints:@[
        [self.webView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
        [self.webView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [self.webView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [self.webView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor]
    ]];

    UIPanGestureRecognizer *camera =
        [[UIPanGestureRecognizer alloc] initWithTarget:self
                                               action:@selector(cameraPanned:)];

    camera.delegate = self;
    camera.cancelsTouchesInView = NO;
    camera.maximumNumberOfTouches = 1;
    [self.webView addGestureRecognizer:camera];
}

- (void)loadGame {
    NSURL *url = [NSURL URLWithString:X7GameURL];
    NSURLRequest *request =
        [NSURLRequest requestWithURL:url
                        cachePolicy:NSURLRequestUseProtocolCachePolicy
                    timeoutInterval:30.0];

    [self.webView loadRequest:request];
}

#pragma mark - Standalone navigation

- (void)webView:(WKWebView *)webView
decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction
decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {

    NSURL *url = navigationAction.request.URL;

    if (!url) {
        decisionHandler(WKNavigationActionPolicyAllow);
        return;
    }

    NSString *scheme = url.scheme.lowercaseString ?: @"";

    if ([scheme isEqualToString:@"http"] ||
        [scheme isEqualToString:@"https"] ||
        [scheme isEqualToString:@"about"] ||
        [scheme isEqualToString:@"blob"] ||
        [scheme isEqualToString:@"data"]) {

        if (navigationAction.targetFrame == nil) {
            [webView loadRequest:navigationAction.request];
            decisionHandler(WKNavigationActionPolicyCancel);
            return;
        }

        decisionHandler(WKNavigationActionPolicyAllow);
        return;
    }

    // Do not throw unknown game links to Safari.
    decisionHandler(WKNavigationActionPolicyCancel);
}

- (WKWebView *)webView:(WKWebView *)webView
createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration
forNavigationAction:(WKNavigationAction *)navigationAction
windowFeatures:(WKWindowFeatures *)windowFeatures {

    if (navigationAction.request.URL) {
        [webView loadRequest:navigationAction.request];
    }

    return nil;
}

- (void)webView:(WKWebView *)webView
didFinishNavigation:(WKNavigation *)navigation {

    [self applyXCLUTCHScale];
}

#pragma mark - HUD helpers

- (UIButton *)buttonWithTitle:(NSString *)title size:(CGFloat)size {
    UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
    button.translatesAutoresizingMaskIntoConstraints = NO;
    button.backgroundColor = [UIColor colorWithWhite:0.04 alpha:0.43];
    button.layer.cornerRadius = size / 2.0;
    button.layer.borderWidth = 1.0;
    button.layer.borderColor = [UIColor colorWithWhite:1.0 alpha:0.22].CGColor;

    [button setTitle:title forState:UIControlStateNormal];
    [button setTitleColor:UIColor.whiteColor forState:UIControlStateNormal];

    button.titleLabel.font =
        [UIFont systemFontOfSize:MAX(10.0, size * 0.24)
                          weight:UIFontWeightSemibold];

    [NSLayoutConstraint activateConstraints:@[
        [button.widthAnchor constraintEqualToConstant:size],
        [button.heightAnchor constraintEqualToConstant:size]
    ]];

    return button;
}

- (UIButton *)keyButton:(NSString *)title code:(NSString *)code size:(CGFloat)size {
    UIButton *button = [self buttonWithTitle:title size:size];
    button.accessibilityIdentifier = code;

    [button addTarget:self
               action:@selector(keyButtonDown:)
     forControlEvents:UIControlEventTouchDown];

    [button addTarget:self
               action:@selector(keyButtonUp:)
     forControlEvents:(UIControlEventTouchUpInside |
                       UIControlEventTouchUpOutside |
                       UIControlEventTouchCancel)];

    return button;
}

- (UIButton *)mouseButton:(NSString *)title button:(NSInteger)mouseButton size:(CGFloat)size {
    UIButton *button = [self buttonWithTitle:title size:size];
    button.tag = 100 + mouseButton;

    [button addTarget:self
               action:@selector(mouseButtonDown:)
     forControlEvents:UIControlEventTouchDown];

    [button addTarget:self
               action:@selector(mouseButtonUp:)
     forControlEvents:(UIControlEventTouchUpInside |
                       UIControlEventTouchUpOutside |
                       UIControlEventTouchCancel)];

    return button;
}

- (void)setupNativeHUD {
    self.hudContainer = [UIView new];
    self.hudContainer.translatesAutoresizingMaskIntoConstraints = NO;
    self.hudContainer.backgroundColor = UIColor.clearColor;
    [self.view addSubview:self.hudContainer];

    [NSLayoutConstraint activateConstraints:@[
        [self.hudContainer.topAnchor constraintEqualToAnchor:self.view.topAnchor],
        [self.hudContainer.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [self.hudContainer.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [self.hudContainer.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor]
    ]];

    self.joystick = [X7JoystickView new];
    self.joystick.translatesAutoresizingMaskIntoConstraints = NO;
    self.joystick.delegate = self;
    [self.hudContainer addSubview:self.joystick];

    [NSLayoutConstraint activateConstraints:@[
        [self.joystick.leadingAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.leadingAnchor constant:18.0],
        [self.joystick.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-18.0],
        [self.joystick.widthAnchor constraintEqualToConstant:116.0],
        [self.joystick.heightAnchor constraintEqualToConstant:116.0]
    ]];

    UIButton *fire = [self mouseButton:@"FIRE" button:0 size:70.0];
    UIButton *aim = [self mouseButton:@"AIM" button:2 size:54.0];

    UIButton *jump = [self keyButton:@"JUMP" code:@"Space" size:52.0];
    UIButton *crouch = [self keyButton:@"C" code:@"ControlLeft" size:46.0];
    UIButton *reload = [self keyButton:@"R" code:@"KeyR" size:44.0];
    UIButton *buy = [self keyButton:@"B" code:@"KeyB" size:42.0];
    UIButton *use = [self keyButton:@"E" code:@"KeyE" size:42.0];

    for (UIButton *button in @[fire, aim, jump, crouch, reload, buy, use]) {
        [self.hudContainer addSubview:button];
    }

    UILayoutGuide *safe = self.view.safeAreaLayoutGuide;

    [NSLayoutConstraint activateConstraints:@[
        [fire.trailingAnchor constraintEqualToAnchor:safe.trailingAnchor constant:-18.0],
        [fire.bottomAnchor constraintEqualToAnchor:safe.bottomAnchor constant:-18.0],

        [aim.trailingAnchor constraintEqualToAnchor:fire.leadingAnchor constant:-12.0],
        [aim.centerYAnchor constraintEqualToAnchor:fire.centerYAnchor constant:-5.0],

        [jump.trailingAnchor constraintEqualToAnchor:fire.trailingAnchor constant:-4.0],
        [jump.bottomAnchor constraintEqualToAnchor:fire.topAnchor constant:-12.0],

        [crouch.trailingAnchor constraintEqualToAnchor:aim.trailingAnchor],
        [crouch.bottomAnchor constraintEqualToAnchor:aim.topAnchor constant:-10.0],

        [reload.trailingAnchor constraintEqualToAnchor:jump.leadingAnchor constant:-10.0],
        [reload.centerYAnchor constraintEqualToAnchor:jump.centerYAnchor],

        [buy.trailingAnchor constraintEqualToAnchor:safe.trailingAnchor constant:-18.0],
        [buy.topAnchor constraintEqualToAnchor:safe.topAnchor constant:54.0],

        [use.trailingAnchor constraintEqualToAnchor:buy.leadingAnchor constant:-9.0],
        [use.centerYAnchor constraintEqualToAnchor:buy.centerYAnchor]
    ]];

    UIStackView *weapons = [UIStackView new];
    weapons.translatesAutoresizingMaskIntoConstraints = NO;
    weapons.axis = UILayoutConstraintAxisHorizontal;
    weapons.spacing = 7.0;

    for (NSArray *item in @[
        @[@"1", @"Digit1"],
        @[@"2", @"Digit2"],
        @[@"3", @"Digit3"],
        @[@"Q", @"KeyQ"],
        @[@"G", @"KeyG"],
        @[@"F", @"KeyF"],
        @[@"TAB", @"Tab"]
    ]) {
        UIButton *button = [self keyButton:item[0] code:item[1] size:38.0];
        [weapons addArrangedSubview:button];
    }

    [self.hudContainer addSubview:weapons];

    [NSLayoutConstraint activateConstraints:@[
        [weapons.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
        [weapons.topAnchor constraintEqualToAnchor:safe.topAnchor constant:8.0]
    ]];

    self.hudEnabled = YES;
}

- (void)setupTopButtons {
    self.portButton = [self buttonWithTitle:@"PORT" size:42.0];
    self.insButton = [self buttonWithTitle:@"INS" size:42.0];
    self.reloadButton = [self buttonWithTitle:@"↻" size:42.0];

    [self.portButton addTarget:self
                        action:@selector(portTapped)
              forControlEvents:UIControlEventTouchUpInside];

    [self.insButton addTarget:self
                       action:@selector(insTapped)
             forControlEvents:UIControlEventTouchUpInside];

    [self.reloadButton addTarget:self
                          action:@selector(reloadTapped)
                forControlEvents:UIControlEventTouchUpInside];

    [self.view addSubview:self.portButton];
    [self.view addSubview:self.insButton];
    [self.view addSubview:self.reloadButton];

    UILayoutGuide *safe = self.view.safeAreaLayoutGuide;

    [NSLayoutConstraint activateConstraints:@[
        [self.portButton.leadingAnchor constraintEqualToAnchor:safe.leadingAnchor constant:8.0],
        [self.portButton.topAnchor constraintEqualToAnchor:safe.topAnchor constant:8.0],

        [self.reloadButton.leadingAnchor constraintEqualToAnchor:self.portButton.trailingAnchor constant:8.0],
        [self.reloadButton.topAnchor constraintEqualToAnchor:self.portButton.topAnchor],

        [self.insButton.trailingAnchor constraintEqualToAnchor:safe.trailingAnchor constant:-8.0],
        [self.insButton.topAnchor constraintEqualToAnchor:safe.topAnchor constant:8.0]
    ]];
}

#pragma mark - Port settings panel

- (UILabel *)settingsLabel:(NSString *)text {
    UILabel *label = [UILabel new];
    label.translatesAutoresizingMaskIntoConstraints = NO;
    label.text = text;
    label.textColor = UIColor.whiteColor;
    label.font = [UIFont systemFontOfSize:11.5 weight:UIFontWeightMedium];
    return label;
}

- (UISlider *)settingsSliderMin:(float)min max:(float)max action:(SEL)action {
    UISlider *slider = [UISlider new];
    slider.translatesAutoresizingMaskIntoConstraints = NO;
    slider.minimumValue = min;
    slider.maximumValue = max;
    slider.continuous = YES;
    [slider addTarget:self action:action forControlEvents:UIControlEventValueChanged];
    return slider;
}

- (void)setupSettingsPanel {
    UIBlurEffect *blur = [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemChromeMaterialDark];
    self.settingsPanel = [[UIVisualEffectView alloc] initWithEffect:blur];
    self.settingsPanel.translatesAutoresizingMaskIntoConstraints = NO;
    self.settingsPanel.layer.cornerRadius = 14.0;
    self.settingsPanel.layer.masksToBounds = YES;
    self.settingsPanel.hidden = YES;

    [self.view addSubview:self.settingsPanel];

    [NSLayoutConstraint activateConstraints:@[
        [self.settingsPanel.leadingAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.leadingAnchor constant:12.0],
        [self.settingsPanel.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:58.0],
        [self.settingsPanel.widthAnchor constraintEqualToConstant:250.0],
        [self.settingsPanel.heightAnchor constraintEqualToConstant:202.0]
    ]];

    UIStackView *stack = [UIStackView new];
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    stack.axis = UILayoutConstraintAxisVertical;
    stack.spacing = 8.0;
    stack.layoutMargins = UIEdgeInsetsMake(12, 14, 12, 14);
    stack.layoutMarginsRelativeArrangement = YES;

    [self.settingsPanel.contentView addSubview:stack];

    [NSLayoutConstraint activateConstraints:@[
        [stack.topAnchor constraintEqualToAnchor:self.settingsPanel.contentView.topAnchor],
        [stack.leadingAnchor constraintEqualToAnchor:self.settingsPanel.contentView.leadingAnchor],
        [stack.trailingAnchor constraintEqualToAnchor:self.settingsPanel.contentView.trailingAnchor],
        [stack.bottomAnchor constraintEqualToAnchor:self.settingsPanel.contentView.bottomAnchor]
    ]];

    UILabel *title = [self settingsLabel:@"CLUTCHER PORT"];
    title.font = [UIFont systemFontOfSize:14.0 weight:UIFontWeightBold];
    [stack addArrangedSubview:title];

    UIButton *hudToggle = [UIButton buttonWithType:UIButtonTypeSystem];
    [hudToggle setTitle:@"Show / Hide Mobile HUD" forState:UIControlStateNormal];
    [hudToggle setTitleColor:UIColor.whiteColor forState:UIControlStateNormal];
    hudToggle.titleLabel.font = [UIFont systemFontOfSize:12.0 weight:UIFontWeightSemibold];
    hudToggle.contentHorizontalAlignment = UIControlContentHorizontalAlignmentLeft;
    [hudToggle addTarget:self action:@selector(toggleHUD) forControlEvents:UIControlEventTouchUpInside];
    [stack addArrangedSubview:hudToggle];

    [stack addArrangedSubview:[self settingsLabel:@"HUD scale"]];
    self.hudScaleSlider = [self settingsSliderMin:0.65 max:1.05 action:@selector(hudScaleChanged:)];
    [stack addArrangedSubview:self.hudScaleSlider];

    [stack addArrangedSubview:[self settingsLabel:@"HUD opacity"]];
    self.opacitySlider = [self settingsSliderMin:0.35 max:1.0 action:@selector(opacityChanged:)];
    [stack addArrangedSubview:self.opacitySlider];

    [stack addArrangedSubview:[self settingsLabel:@"XCLUTCH scale"]];
    self.menuScaleSlider = [self settingsSliderMin:0.62 max:1.0 action:@selector(menuScaleChanged:)];
    [stack addArrangedSubview:self.menuScaleSlider];
}

- (void)loadSavedPortSettings {
    NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;

    float hudScale = [defaults objectForKey:@"hudScale"]
        ? [defaults floatForKey:@"hudScale"]
        : 0.80f;

    float opacity = [defaults objectForKey:@"hudOpacity"]
        ? [defaults floatForKey:@"hudOpacity"]
        : 0.82f;

    float menuScale = [defaults objectForKey:@"menuScale"]
        ? [defaults floatForKey:@"menuScale"]
        : 0.84f;

    self.hudScaleSlider.value = hudScale;
    self.opacitySlider.value = opacity;
    self.menuScaleSlider.value = menuScale;

    [self applyHUDScale:hudScale];
    self.hudContainer.alpha = opacity;
}

- (void)applyHUDScale:(CGFloat)scale {
    self.hudContainer.transform = CGAffineTransformMakeScale(scale, scale);
}

- (void)applyXCLUTCHScale {
    CGFloat scale = self.menuScaleSlider.value > 0
        ? self.menuScaleSlider.value
        : 0.84;

    NSString *js =
        [NSString stringWithFormat:
            @"window.__x7SetMenuScale && window.__x7SetMenuScale(%0.3f);",
            scale];

    [self.webView evaluateJavaScript:js completionHandler:nil];
}

- (void)hudScaleChanged:(UISlider *)slider {
    [self applyHUDScale:slider.value];
    [NSUserDefaults.standardUserDefaults setFloat:slider.value forKey:@"hudScale"];
}

- (void)opacityChanged:(UISlider *)slider {
    self.hudContainer.alpha = slider.value;
    [NSUserDefaults.standardUserDefaults setFloat:slider.value forKey:@"hudOpacity"];
}

- (void)menuScaleChanged:(UISlider *)slider {
    [NSUserDefaults.standardUserDefaults setFloat:slider.value forKey:@"menuScale"];
    [self applyXCLUTCHScale];
}

- (void)portTapped {
    self.settingsPanel.hidden = !self.settingsPanel.hidden;
}

- (void)reloadTapped {
    [self releaseAllInputs];
    [self.webView reload];
}

- (void)toggleHUD {
    self.hudEnabled = !self.hudEnabled;
    self.hudContainer.hidden = !self.hudEnabled;
}

#pragma mark - INS / XCLUTCH

- (void)insTapped {
    self.menuOpen = !self.menuOpen;

    if (self.menuOpen) {
        self.hudWasEnabledBeforeMenu = self.hudEnabled;
        self.hudContainer.hidden = YES;
        [self releaseAllInputs];
    } else {
        self.hudContainer.hidden = !self.hudWasEnabledBeforeMenu;
        self.hudEnabled = self.hudWasEnabledBeforeMenu;
    }

    [self sendKeyCode:@"Insert" down:YES];

    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.04 * NSEC_PER_SEC)),
        dispatch_get_main_queue(),
        ^{
            [self sendKeyCode:@"Insert" down:NO];
        }
    );
}

#pragma mark - Native input

- (void)evaluate:(NSString *)javascript {
    if (javascript.length == 0) return;
    [self.webView evaluateJavaScript:javascript completionHandler:nil];
}

- (void)sendKeyCode:(NSString *)code down:(BOOL)down {
    if (code.length == 0) return;

    NSString *safe =
        [code stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];

    NSString *js =
        [NSString stringWithFormat:
            @"window.__x7Key && window.__x7Key('%@', %@);",
            safe,
            down ? @"true" : @"false"];

    [self evaluate:js];
}

- (void)sendMouseButton:(NSInteger)button down:(BOOL)down {
    NSString *js =
        [NSString stringWithFormat:
            @"window.__x7Mouse && window.__x7Mouse(%ld, %@);",
            (long)button,
            down ? @"true" : @"false"];

    [self evaluate:js];
}

- (void)sendLookX:(CGFloat)dx y:(CGFloat)dy {
    CGFloat sensitivity = 1.05;

    NSString *js =
        [NSString stringWithFormat:
            @"window.__x7Look && window.__x7Look(%0.3f,%0.3f);",
            dx * sensitivity,
            dy * sensitivity];

    [self evaluate:js];
}

- (void)keyButtonDown:(UIButton *)button {
    NSString *code = button.accessibilityIdentifier;
    if (!code) return;

    [self.heldKeys addObject:code];
    [self sendKeyCode:code down:YES];
}

- (void)keyButtonUp:(UIButton *)button {
    NSString *code = button.accessibilityIdentifier;
    if (!code) return;

    [self.heldKeys removeObject:code];
    [self sendKeyCode:code down:NO];
}

- (void)mouseButtonDown:(UIButton *)button {
    [self sendMouseButton:button.tag - 100 down:YES];
}

- (void)mouseButtonUp:(UIButton *)button {
    [self sendMouseButton:button.tag - 100 down:NO];
}

- (void)releaseAllInputs {
    for (NSString *code in self.heldKeys.copy) {
        [self sendKeyCode:code down:NO];
    }

    [self.heldKeys removeAllObjects];
    [self sendMouseButton:0 down:NO];
    [self sendMouseButton:2 down:NO];
}

#pragma mark - Joystick

- (void)setMovementCode:(NSString *)code active:(BOOL)active {
    BOOL already = [self.heldKeys containsObject:code];

    if (active && !already) {
        [self.heldKeys addObject:code];
        [self sendKeyCode:code down:YES];
    } else if (!active && already) {
        [self.heldKeys removeObject:code];
        [self sendKeyCode:code down:NO];
    }
}

- (void)joystick:(X7JoystickView *)joystick changedX:(CGFloat)x y:(CGFloat)y {
    CGFloat dead = 0.26;

    [self setMovementCode:@"KeyW" active:(y < -dead)];
    [self setMovementCode:@"KeyS" active:(y > dead)];
    [self setMovementCode:@"KeyA" active:(x < -dead)];
    [self setMovementCode:@"KeyD" active:(x > dead)];
}

- (void)joystickDidEnd:(X7JoystickView *)joystick {
    for (NSString *code in @[@"KeyW", @"KeyA", @"KeyS", @"KeyD"]) {
        [self setMovementCode:code active:NO];
    }
}

#pragma mark - Camera swipe

- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)gestureRecognizer {
    if (![gestureRecognizer isKindOfClass:UIPanGestureRecognizer.class]) {
        return YES;
    }

    if (!self.hudEnabled || self.menuOpen || !self.settingsPanel.hidden) {
        return NO;
    }

    CGPoint point = [gestureRecognizer locationInView:self.webView];

    // Right 55% of screen acts like mouse-look, while the left remains free for movement/menu touches.
    return point.x >= self.webView.bounds.size.width * 0.45;
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)otherGestureRecognizer {
    return YES;
}

- (void)cameraPanned:(UIPanGestureRecognizer *)gesture {
    CGPoint point = [gesture locationInView:self.webView];

    if (gesture.state == UIGestureRecognizerStateBegan) {
        self.lastCameraPoint = point;
        self.cameraGestureAccepted = YES;
        return;
    }

    if (!self.cameraGestureAccepted) return;

    if (gesture.state == UIGestureRecognizerStateChanged) {
        CGFloat dx = point.x - self.lastCameraPoint.x;
        CGFloat dy = point.y - self.lastCameraPoint.y;

        self.lastCameraPoint = point;

        if (fabs(dx) < 60.0 && fabs(dy) < 60.0) {
            [self sendLookX:dx y:dy];
        }
    }

    if (gesture.state == UIGestureRecognizerStateEnded ||
        gesture.state == UIGestureRecognizerStateCancelled ||
        gesture.state == UIGestureRecognizerStateFailed) {
        self.cameraGestureAccepted = NO;
    }
}

@end
