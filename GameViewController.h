#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import "X7JoystickView.h"

@interface GameViewController : UIViewController
    <WKNavigationDelegate, WKUIDelegate, UIGestureRecognizerDelegate, X7JoystickViewDelegate>
@end
