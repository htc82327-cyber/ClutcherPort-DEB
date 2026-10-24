#import <UIKit/UIKit.h>

@class X7JoystickView;

@protocol X7JoystickViewDelegate <NSObject>
- (void)joystick:(X7JoystickView *)joystick changedX:(CGFloat)x y:(CGFloat)y;
- (void)joystickDidEnd:(X7JoystickView *)joystick;
@end

@interface X7JoystickView : UIView
@property(nonatomic,weak) id<X7JoystickViewDelegate> delegate;
@end
