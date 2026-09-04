#include <napi.h>
#include <unistd.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ApplicationServices/ApplicationServices.h>
#import <AppKit/AppKit.h>

namespace {

// Safely extract a number from N-API args, returns 0.0 if not a number
static double SafeDouble(const Napi::CallbackInfo& info, size_t index, double defaultVal = 0.0) {
    if (index >= info.Length() || info[index].IsUndefined() || info[index].IsNull()) {
        return defaultVal;
    }
    if (!info[index].IsNumber()) {
        return defaultVal;
    }
    return info[index].As<Napi::Number>().DoubleValue();
}

// Track current mouse position for relative moves
CGPoint GetCurrentMousePosition() {
    CGEventRef event = CGEventCreate(NULL);
    CGPoint point = CGEventGetLocation(event);
    CFRelease(event);
    return point;
}

// Move mouse by relative delta
// Also handles hot corner triggering when cursor is pushed into a corner
static int cornerDwellCount = 0;
static int lastCorner = 0; // 0=none, 1=TL, 2=TR, 3=BL, 4=BR

Napi::Value MoveMouse(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double dx = SafeDouble(info, 0);
    double dy = SafeDouble(info, 1);
    
    CGPoint current = GetCurrentMousePosition();
    CGPoint newPos = CGPointMake(current.x + dx, current.y + dy);
    
    // Get total bounds across all displays (virtual coordinate space)
    uint32_t displayCount = 0;
    CGGetActiveDisplayList(0, NULL, &displayCount);
    
    CGFloat minX = 0, minY = 0, maxX = 0, maxY = 0;
    if (displayCount > 0) {
        CGDirectDisplayID displays[16];
        CGGetActiveDisplayList(16, displays, &displayCount);
        
        for (uint32_t i = 0; i < displayCount; i++) {
            CGRect bounds = CGDisplayBounds(displays[i]);
            if (bounds.origin.x < minX) minX = bounds.origin.x;
            if (bounds.origin.y < minY) minY = bounds.origin.y;
            if (bounds.origin.x + bounds.size.width > maxX) maxX = bounds.origin.x + bounds.size.width;
            if (bounds.origin.y + bounds.size.height > maxY) maxY = bounds.origin.y + bounds.size.height;
        }
        
        if (newPos.x < minX) newPos.x = minX;
        if (newPos.y < minY) newPos.y = minY;
        if (newPos.x >= maxX) newPos.x = maxX - 1;
        if (newPos.y >= maxY) newPos.y = maxY - 1;
    }
    
    // Detect if cursor is being pushed into a corner
    int currentCorner = 0;
    bool atLeft = (newPos.x <= minX);
    bool atRight = (newPos.x >= maxX - 1);
    bool atTop = (newPos.y <= minY);
    bool atBottom = (newPos.y >= maxY - 1);
    
    if (atLeft && atTop) currentCorner = 1;
    else if (atRight && atTop) currentCorner = 2;
    else if (atLeft && atBottom) currentCorner = 3;
    else if (atRight && atBottom) currentCorner = 4;
    
    if (currentCorner > 0 && currentCorner == lastCorner) {
        cornerDwellCount++;
    } else {
        cornerDwellCount = currentCorner > 0 ? 1 : 0;
        lastCorner = currentCorner;
    }
    
    CGEventRef moveEvent = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, newPos, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, moveEvent);
    CFRelease(moveEvent);
    
    return env.Undefined();
}

// Get current hot corner state (for server-side hot corner detection)
Napi::Value GetCornerState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);
    result.Set("corner", Napi::Number::New(env, lastCorner)); // 0=none, 1=TL, 2=TR, 3=BL, 4=BR
    result.Set("dwell", Napi::Number::New(env, cornerDwellCount));
    return result;
}

// Reset corner state after triggering
Napi::Value ResetCornerState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    cornerDwellCount = 0;
    lastCorner = 0;
    return env.Undefined();
}

// Click with specified button
// Uses AX API to activate the window under cursor (CGEvent clicks alone don't switch apps)
Napi::Value Click(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string button = "left";
    if (info.Length() > 0 && info[0].IsString()) {
        button = info[0].As<Napi::String>().Utf8Value();
    }
    
    CGPoint pos = GetCurrentMousePosition();
    
    // Activate the window/app under the cursor using Accessibility API
    if (button == "left") {
        AXUIElementRef systemWide = AXUIElementCreateSystemWide();
        AXUIElementRef elementUnderCursor = NULL;
        AXError err = AXUIElementCopyElementAtPosition(systemWide, pos.x, pos.y, &elementUnderCursor);
        if (err == kAXErrorSuccess && elementUnderCursor) {
            // Get the application that owns this element
            pid_t pid = 0;
            AXUIElementGetPid(elementUnderCursor, &pid);
            if (pid > 0) {
                // Activate the app using NSRunningApplication
                NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
                [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
            }
            CFRelease(elementUnderCursor);
        }
        CFRelease(systemWide);
        usleep(50000); // 50ms for app activation to complete
    }
    
    CGMouseButton btn;
    CGEventType downType, upType;
    
    if (button == "right") {
        btn = kCGMouseButtonRight;
        downType = kCGEventRightMouseDown;
        upType = kCGEventRightMouseUp;
    } else if (button == "middle") {
        btn = kCGMouseButtonCenter;
        downType = kCGEventOtherMouseDown;
        upType = kCGEventOtherMouseUp;
    } else {
        btn = kCGMouseButtonLeft;
        downType = kCGEventLeftMouseDown;
        upType = kCGEventLeftMouseUp;
    }
    
    CGEventRef down = CGEventCreateMouseEvent(NULL, downType, pos, btn);
    CGEventRef up = CGEventCreateMouseEvent(NULL, upType, pos, btn);
    
    CGEventSetIntegerValueField(down, kCGMouseEventClickState, 1);
    CGEventSetIntegerValueField(up, kCGMouseEventClickState, 1);
    
    CGEventPost(kCGHIDEventTap, down);
    usleep(10000);
    CGEventPost(kCGHIDEventTap, up);
    
    CFRelease(down);
    CFRelease(up);
    
    return env.Undefined();
}

// Scroll wheel
Napi::Value Scroll(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    int32_t dx = (int32_t)(SafeDouble(info, 0) * 3.0);
    int32_t dy = (int32_t)(SafeDouble(info, 1) * 3.0);
    
    CGEventRef scrollEvent = CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitPixel, 2, dy, dx);
    CGEventPost(kCGHIDEventTap, scrollEvent);
    CFRelease(scrollEvent);
    
    return env.Undefined();
}

// Pinch zoom - Use Cmd+Plus/Minus which works reliably in Chrome, VS Code, and most apps
// Accumulates sub-pixel deltas across calls to avoid firing too frequently
static double pinchAccumulator = 0.0;
static bool pinchSessionActive = false;

Napi::Value PinchZoom(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double scale = SafeDouble(info, 0, 1.0);
    
    if (scale == 1.0) {
        pinchAccumulator = 0.0;
        pinchSessionActive = false;
        return env.Undefined();
    }
    
    // On first pinch event of a session, click to activate window under cursor
    if (!pinchSessionActive) {
        pinchSessionActive = true;
        CGPoint pos = GetCurrentMousePosition();
        CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pos, kCGMouseButtonLeft);
        CGEventPost(kCGHIDEventTap, down);
        CFRelease(down);
        usleep(30000);
        CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pos, kCGMouseButtonLeft);
        CGEventPost(kCGHIDEventTap, up);
        CFRelease(up);
        usleep(100000); // 100ms for window to become key window
    }
    
    // Convert scale factor to accumulated value
    // scale > 1 = zoom in, scale < 1 = zoom out
    double delta = (scale - 1.0) * 10.0;
    pinchAccumulator += delta;
    
    // Fire Cmd+Plus or Cmd+Minus when threshold is reached
    if (pinchAccumulator > 1.0) {
        // Zoom in: Cmd+=  (key code 24)
        CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateCombinedSessionState);
        CGEventRef keyDown = CGEventCreateKeyboardEvent(source, 24, true);
        CGEventRef keyUp = CGEventCreateKeyboardEvent(source, 24, false);
        CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
        CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);
        CGEventPost(kCGHIDEventTap, keyDown);
        usleep(30000); // 30ms delay for Electron apps (VSCode) to register the key
        CGEventPost(kCGHIDEventTap, keyUp);
        if (source) CFRelease(source);
        CFRelease(keyDown);
        CFRelease(keyUp);
        pinchAccumulator = 0.0;
    } else if (pinchAccumulator < -1.0) {
        // Zoom out: Cmd+-  (key code 27)
        CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateCombinedSessionState);
        CGEventRef keyDown = CGEventCreateKeyboardEvent(source, 27, true);
        CGEventRef keyUp = CGEventCreateKeyboardEvent(source, 27, false);
        CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
        CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);
        CGEventPost(kCGHIDEventTap, keyDown);
        usleep(30000); // 30ms delay for Electron apps (VSCode) to register the key
        CGEventPost(kCGHIDEventTap, keyUp);
        if (source) CFRelease(source);
        CFRelease(keyDown);
        CFRelease(keyUp);
        pinchAccumulator = 0.0;
    }
    
    return env.Undefined();
}

// Page zoom (Cmd+Plus/Minus)
Napi::Value PageZoom(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double scale = SafeDouble(info, 0, 1.0);
    
    // Use Cmd+= for zoom in, Cmd+- for zoom out
    CGKeyCode keyCode = (scale > 1.0) ? 24 : 27; // 24 = '=', 27 = '-'
    
    CGEventRef keyDown = CGEventCreateKeyboardEvent(NULL, keyCode, true);
    CGEventRef keyUp = CGEventCreateKeyboardEvent(NULL, keyCode, false);
    CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
    CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);
    
    CGEventPost(kCGHIDEventTap, keyDown);
    CGEventPost(kCGHIDEventTap, keyUp);
    
    CFRelease(keyDown);
    CFRelease(keyUp);
    
    return env.Undefined();
}

// Drag start (mouse down)
Napi::Value DragStart(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    CGPoint pos = GetCurrentMousePosition();
    CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pos, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, down);
    CFRelease(down);
    
    return env.Undefined();
}

// Drag move (mouse dragged)
Napi::Value DragMove(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double dx = SafeDouble(info, 0);
    double dy = SafeDouble(info, 1);
    
    CGPoint current = GetCurrentMousePosition();
    CGPoint newPos = CGPointMake(current.x + dx, current.y + dy);
    
    CGEventRef dragEvent = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDragged, newPos, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, dragEvent);
    CFRelease(dragEvent);
    
    return env.Undefined();
}

// Drag end (mouse up)
Napi::Value DragEnd(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    CGPoint pos = GetCurrentMousePosition();
    CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pos, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, up);
    CFRelease(up);
    
    return env.Undefined();
}

// Double click
Napi::Value DoubleClick(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    CGPoint pos = GetCurrentMousePosition();
    
    CGEventRef down1 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pos, kCGMouseButtonLeft);
    CGEventRef up1 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pos, kCGMouseButtonLeft);
    CGEventRef down2 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pos, kCGMouseButtonLeft);
    CGEventRef up2 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pos, kCGMouseButtonLeft);
    
    CGEventSetIntegerValueField(down1, kCGMouseEventClickState, 1);
    CGEventSetIntegerValueField(up1, kCGMouseEventClickState, 1);
    CGEventSetIntegerValueField(down2, kCGMouseEventClickState, 2);
    CGEventSetIntegerValueField(up2, kCGMouseEventClickState, 2);
    
    CGEventPost(kCGHIDEventTap, down1);
    CGEventPost(kCGHIDEventTap, up1);
    CGEventPost(kCGHIDEventTap, down2);
    CGEventPost(kCGHIDEventTap, up2);
    
    CFRelease(down1);
    CFRelease(up1);
    CFRelease(down2);
    CFRelease(up2);
    
    return env.Undefined();
}

// Triple click (select line)
Napi::Value TripleClick(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    CGPoint pos = GetCurrentMousePosition();
    
    CGEventRef down1 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pos, kCGMouseButtonLeft);
    CGEventRef up1 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pos, kCGMouseButtonLeft);
    CGEventRef down2 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pos, kCGMouseButtonLeft);
    CGEventRef up2 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pos, kCGMouseButtonLeft);
    CGEventRef down3 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pos, kCGMouseButtonLeft);
    CGEventRef up3 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pos, kCGMouseButtonLeft);
    
    CGEventSetIntegerValueField(down1, kCGMouseEventClickState, 1);
    CGEventSetIntegerValueField(up1, kCGMouseEventClickState, 1);
    CGEventSetIntegerValueField(down2, kCGMouseEventClickState, 2);
    CGEventSetIntegerValueField(up2, kCGMouseEventClickState, 2);
    CGEventSetIntegerValueField(down3, kCGMouseEventClickState, 3);
    CGEventSetIntegerValueField(up3, kCGMouseEventClickState, 3);
    
    CGEventPost(kCGHIDEventTap, down1);
    CGEventPost(kCGHIDEventTap, up1);
    CGEventPost(kCGHIDEventTap, down2);
    CGEventPost(kCGHIDEventTap, up2);
    CGEventPost(kCGHIDEventTap, down3);
    CGEventPost(kCGHIDEventTap, up3);
    
    CFRelease(down1);
    CFRelease(up1);
    CFRelease(down2);
    CFRelease(up2);
    CFRelease(down3);
    CFRelease(up3);
    
    return env.Undefined();
}

// Simulate a key press with modifiers via CGEvent
// Uses an event source and session tap for system-wide shortcuts
Napi::Value KeyPress(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        return env.Undefined();
    }
    
    CGKeyCode keyCode = (CGKeyCode)info[0].As<Napi::Number>().Int32Value();
    
    // Build modifier flags from optional second argument (array of strings or flags number)
    CGEventFlags flags = 0;
    if (info.Length() >= 2) {
        if (info[1].IsNumber()) {
            flags = (CGEventFlags)info[1].As<Napi::Number>().Int64Value();
        } else if (info[1].IsArray()) {
            Napi::Array mods = info[1].As<Napi::Array>();
            for (uint32_t i = 0; i < mods.Length(); i++) {
                std::string mod = mods.Get(i).As<Napi::String>().Utf8Value();
                if (mod == "cmd" || mod == "command") flags |= kCGEventFlagMaskCommand;
                else if (mod == "ctrl" || mod == "control") flags |= kCGEventFlagMaskControl;
                else if (mod == "alt" || mod == "option") flags |= kCGEventFlagMaskAlternate;
                else if (mod == "shift") flags |= kCGEventFlagMaskShift;
                else if (mod == "fn") flags |= kCGEventFlagMaskSecondaryFn;
            }
        }
    }
    
    // Create an event source — combinedSessionState works for system shortcuts
    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateCombinedSessionState);
    
    CGEventRef keyDown = CGEventCreateKeyboardEvent(source, keyCode, true);
    CGEventRef keyUp = CGEventCreateKeyboardEvent(source, keyCode, false);
    
    if (flags) {
        CGEventSetFlags(keyDown, flags);
        CGEventSetFlags(keyUp, flags);
    }
    
    // Post to HID event tap — this is where system shortcuts are intercepted
    CGEventPost(kCGHIDEventTap, keyDown);
    usleep(50000); // 50ms delay for system to recognize the shortcut
    CGEventPost(kCGHIDEventTap, keyUp);
    
    if (source) CFRelease(source);
    CFRelease(keyDown);
    CFRelease(keyUp);
    
    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("moveMouse", Napi::Function::New(env, MoveMouse));
    exports.Set("getCornerState", Napi::Function::New(env, GetCornerState));
    exports.Set("resetCornerState", Napi::Function::New(env, ResetCornerState));
    exports.Set("click", Napi::Function::New(env, Click));
    exports.Set("scroll", Napi::Function::New(env, Scroll));
    exports.Set("pinchZoom", Napi::Function::New(env, PinchZoom));
    exports.Set("pageZoom", Napi::Function::New(env, PageZoom));
    exports.Set("dragStart", Napi::Function::New(env, DragStart));
    exports.Set("dragMove", Napi::Function::New(env, DragMove));
    exports.Set("dragEnd", Napi::Function::New(env, DragEnd));
    exports.Set("doubleClick", Napi::Function::New(env, DoubleClick));
    exports.Set("tripleClick", Napi::Function::New(env, TripleClick));
    exports.Set("keyPress", Napi::Function::New(env, KeyPress));
    return exports;
}

} // namespace

NODE_API_MODULE(mac_input, Init)
