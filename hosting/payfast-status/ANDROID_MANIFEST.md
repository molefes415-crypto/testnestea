# Android: let payfast_return.php reopen the app
Add inside your launcher `<activity>` in AndroidManifest.xml (set `android:launchMode="singleTask"`):
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="tradenest" android:host="payfast"/>
</intent-filter>
```
In `onNewIntent`/`onCreate`, read `intent.data?.getQueryParameter("payment_id")`, then call
`GET https://tradenestea.com/admin/api/payfast_status.php?platform=android&payment_id=...`
and unlock only when `paid == true`.
iOS: register URL scheme `tradenest` in Info.plist (CFBundleURLSchemes) and do the same check with `platform=ios`.
