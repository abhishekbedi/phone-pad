{
  "targets": [
    {
      "target_name": "mac_input",
      "conditions": [
        ["OS=='mac'", {
          "sources": ["native/mac_input.mm"],
          "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
          "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
          "xcode_settings": {
            "OTHER_LDFLAGS": ["-framework CoreGraphics", "-framework ApplicationServices", "-framework AppKit"],
            "CLANG_ENABLE_OBJC_ARC": "YES"
          }
        }]
      ]
    }
  ]
}
