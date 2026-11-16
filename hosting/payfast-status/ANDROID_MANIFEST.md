# Android and native iOS payment return integration

The PHP server cannot register links in an installed app. Rebuild Android with the following settings. The reference package is `com.whiteyforex.tradenestea`; change the intent package in `payfast-mobile.js` if the installed app uses another package.

Add inside your existing launcher `<activity>` in AndroidManifest.xml (set `android:launchMode="singleTask"` and `android:exported="true"`; keep its launcher filter):
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="tradenest" android:host="payfast"/>
</intent-filter>
```
Add Internet permission if absent: `<uses-permission android:name="android.permission.INTERNET"/>` outside the application element.

Use the included `PayFastReturnHandler.kt` with your existing `PayFastApi.kt`:

1. After creating checkout, call `handler.rememberCheckout(payment)` **before** `PayFastCheckout.open(context, payment)`.
2. In `onCreate`, `onNewIntent`, and `onResume`, call `handler.verifyReturn(intent.data)` from your existing lifecycle coroutine. In `onNewIntent`, call `setIntent(intent)` first. On ordinary resume call `verifyReturn()` without a URL.
3. Only when it returns true, refresh the existing client's account/access and navigate to Robot List / Add Robot. Keep pending users locked. Never unlock based on the link's `state=success`.
4. Retry after temporary network failures; do not clear the pending reference until account/access refresh succeeds.

Chrome may block automatic app launches. The return page keeps an **Open TradeNest** button for an explicit tap and does not remove it with a timed browser redirect.

## Native iOS

Register `tradenest` under `CFBundleURLTypes` / `CFBundleURLSchemes` in Info.plist and use `IOS_PAYMENT_RETURN.swift` from `.onOpenURL` and on active scene resume. Reverify the locally remembered payment ID before navigation. For native iOS builds only, set the iPhone branch in `payfast-return-controller.js` to `ios-native`.

## iPhone Add-to-Home-Screen app

This is a web app, not a native iOS app: it cannot register `tradenest://`. Keep the default `ios` web return. Safari may stay in the browser instead of reopening the home-screen app; clients can reopen TradeNest from its icon, where payment status must be checked again. A server cannot guarantee automatic reopening of an iOS home-screen app.
