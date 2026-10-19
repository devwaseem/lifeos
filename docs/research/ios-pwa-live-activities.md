# iOS PWA Lock Screen and Dynamic Island capabilities

## Conclusion

The installed LifeOS PWA cannot directly create ActivityKit Live Activities or render Dynamic Island content. Apple requires native ActivityKit code plus a Widget Extension whose Lock Screen and Dynamic Island layouts are implemented with WidgetKit and SwiftUI ([ActivityKit](https://developer.apple.com/documentation/activitykit), [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)).

An iOS Home Screen web app can use Web Push notifications. Those notifications can appear on the Lock Screen, in Notification Center, and on a paired Apple Watch, but they are ordinary notifications rather than persistent Live Activities ([Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). WebKit requires push delivery to remain user-visible and does not expose general-purpose silent background execution ([Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)).

## Practical options

### Keep LifeOS as a PWA

Suitable for:

- ordinary Lock Screen notifications;
- workout reminders;
- rest-complete notifications when the platform permits them;
- app badges.

Not suitable for:

- a persistent Lock Screen workout timer;
- Dynamic Island compact, minimal, or expanded presentations;
- continuously updating workout state while the web app is suspended.

### Add a native iOS shell

The smallest path that preserves the SvelteKit UI is:

1. Package the web UI in a Capacitor iOS application using WKWebView.
2. Add a custom Swift Capacitor plugin exposing `start`, `update`, and `end` Live Activity operations to JavaScript.
3. Add a Widget Extension with an ActivityKit `ActivityConfiguration` and SwiftUI layouts for the Lock Screen and Dynamic Island.
4. Add APNs ActivityKit push support if activities must update while the app is suspended.

Capacitor officially supports iOS WKWebView applications and custom native Swift code exposed to JavaScript ([Capacitor iOS](https://capacitorjs.com/docs/ios), [Custom Native iOS Code](https://capacitorjs.com/docs/ios/custom-code), [iOS Plugin Guide](https://capacitorjs.com/docs/plugins/ios)). Apple documents remote Live Activity updates through ActivityKit push notifications and APNs ([Starting and updating Live Activities with ActivityKit push notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)).

## Recommendation

Keep the current PWA for web/Home Screen access. If Dynamic Island and persistent Lock Screen workout state are requirements, add a separate Capacitor iOS target with one focused ActivityKit bridge and Widget Extension. Do not model Live Activities as Web Push notifications; they have different lifecycle, rendering, and background capabilities.
