#import "X7JoystickView.h"

@interface X7JoystickView ()
@property(nonatomic,strong) UIView *knob;
@end

@implementation X7JoystickView

- (instancetype)init {
    self = [super init];
    if (self) {
        self.multipleTouchEnabled = NO;
        self.backgroundColor = [UIColor colorWithWhite:0.05 alpha:0.30];
        self.layer.cornerRadius = 58.0;
        self.layer.borderWidth = 1.0;
        self.layer.borderColor = [UIColor colorWithWhite:1.0 alpha:0.20].CGColor;

        _knob = [[UIView alloc] initWithFrame:CGRectZero];
        _knob.userInteractionEnabled = NO;
        _knob.backgroundColor = [UIColor colorWithWhite:1.0 alpha:0.24];
        _knob.layer.cornerRadius = 28.0;
        _knob.layer.borderWidth = 1.0;
        _knob.layer.borderColor = [UIColor colorWithWhite:1.0 alpha:0.35].CGColor;
        [self addSubview:_knob];
    }
    return self;
}

- (void)layoutSubviews {
    [super layoutSubviews];

    if (CGRectEqualToRect(self.knob.frame, CGRectZero)) {
        self.knob.bounds = CGRectMake(0, 0, 56, 56);
        self.knob.center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
    }
}

- (void)updateForTouch:(UITouch *)touch {
    CGPoint p = [touch locationInView:self];
    CGPoint c = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));

    CGFloat dx = p.x - c.x;
    CGFloat dy = p.y - c.y;
    CGFloat radius = MIN(self.bounds.size.width, self.bounds.size.height) * 0.34;
    CGFloat len = hypot(dx, dy);

    if (len > radius && len > 0.001) {
        dx = dx / len * radius;
        dy = dy / len * radius;
    }

    self.knob.center = CGPointMake(c.x + dx, c.y + dy);

    CGFloat nx = radius > 0 ? dx / radius : 0;
    CGFloat ny = radius > 0 ? dy / radius : 0;

    [self.delegate joystick:self changedX:nx y:ny];
}

- (void)reset {
    CGPoint c = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));

    [UIView animateWithDuration:0.12 animations:^{
        self.knob.center = c;
    }];

    [self.delegate joystickDidEnd:self];
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    UITouch *touch = touches.anyObject;
    if (touch) [self updateForTouch:touch];
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    UITouch *touch = touches.anyObject;
    if (touch) [self updateForTouch:touch];
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    [self reset];
}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    [self reset];
}

@end
