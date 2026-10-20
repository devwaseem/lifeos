# Apple Health sync for LifeOS Training

## Bottom line

### Observed Apple platform facts

HealthKit is Apple’s native `HealthKit` framework, accessed through `HKHealthStore`. Its documented availability is for Apple OS app platforms—not a Safari or browser API—and Apple’s setup requires an app target with the HealthKit capability, entitlements, and `Info.plist` purpose strings ([HealthKit](https://developer.apple.com/documentation/healthkit), [Configuring HealthKit access](https://developer.apple.com/documentation/xcode/configuring-healthkit-access)). Apple documentation reviewed here does **not** make an explicit statement about Safari or installed PWAs. However, it documents no JavaScript/Web HealthKit API, and the documented access path requires a native app target. Therefore, direct HealthKit access from the existing SvelteKit PWA is not a documented/supported integration path; an iOS app (or native bridge in an iOS app) must perform HealthKit calls.

HealthKit is available only when `HKHealthStore.isHealthDataAvailable()` reports it is, so a native client must gate the feature at runtime ([`isHealthDataAvailable()`](https://developer.apple.com/documentation/healthkit/hkhealthstore/ishealthdataavailable())).

### Project recommendation

Keep LifeOS’s detailed workout model in IndexedDB/D1 as the canonical record. Add a **thin native iOS shell around the existing SvelteKit app** with a focused HealthKit bridge, and provide an opt-in, initially **one-way LifeOS → Apple Health** export of completed workouts. This reuses the current UI and local-first flow, exports workouts even before cloud sync, and also gives the project the native host needed for the Live Activity path already documented in this repository. Do not make HealthKit the authority for exercises or sets; its workout model is intentionally more aggregate than LifeOS’s.

## What can be represented

`HKWorkout` represents one physical activity with an activity type, start/end time and duration, optional events and workout-associated samples. Its documented summary fields include energy and distance, and additional samples such as active energy or heart rate can be associated with the workout ([`HKWorkout`](https://developer.apple.com/documentation/healthkit/hkworkout)). Use a strength activity classification appropriate to the completed session: [`traditionalStrengthTraining`](https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype/traditionalstrengthtraining) is for primarily machines or free weights, while [`functionalStrengthTraining`](https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype/functionalstrengthtraining) covers primarily free weights and body weight.

| LifeOS field | HealthKit representation | Boundary / rule |
| --- | --- | --- |
| Workout ID and completed start/end timestamps | One `HKWorkout`, its activity type, start/end and duration | Direct fit. Export only a completed workout; `HKWorkout` instances are mostly immutable after saving. |
| Workout kind | `traditionalStrengthTraining` or `functionalStrengthTraining` | Pick one that describes the session. Do not manufacture a new activity type per program or exercise. |
| Measured active energy, heart rate, distance | Matching documented `HKQuantitySample` types associated with the workout | Optional and only when LifeOS has a genuine value with the required unit; do not derive a health measurement from sets/reps. HealthKit uses associated samples for workout detail ([`HKWorkout`](https://developer.apple.com/documentation/healthkit/hkworkout)). |
| Ordered exercise names; set order; reps; load; per-set timestamps; rest timer; RPE | **No documented first-class general strength-set/exercise record** | The documented workout/activity and quantity models do not define a general exercise, set, repetition, lifted-load, rest, or subjective-RPE sample. Retain these data in LifeOS. Custom workout metadata is permitted where appropriate, but it is contextual metadata—not a portable replacement for LifeOS’s rich, ordered model ([`HKWorkout`](https://developer.apple.com/documentation/healthkit/hkworkout)). |
| Workout notes / a stable LifeOS link | Minimal custom workout metadata, if needed | Store only a stable identifier/version needed for reconciliation; avoid copying the full routine or notes into HealthKit metadata. |

Apple also exposes a `workoutEffortScore` quantity identifier on current OS releases, but the documented type alone does not define a mapping from LifeOS per-set RPE to that score. Do not write RPE to it without an Apple-defined semantic and a product decision ([`workoutEffortScore`](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/workouteffortscore)).

## Authorization, ownership, and reconciliation

### Observed Apple requirements

- Authorization is fine-grained by sample type and direction: request only the read and share/write sets that the feature uses. Users can change permissions at any time ([Authorizing access to health data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)).
- An app cannot determine whether a user denied a **read** permission. A denied read can yield only samples previously written by that app; an empty result is not proof that no data exists or that access was denied. Users may also allow only a recent historical window ([Authorizing access to health data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)). `authorizationStatus(for:)` is for saving/sharing status, not a read-permission oracle.
- An app can delete only HealthKit objects that it previously saved ([`delete(_:withCompletion:)`](https://developer.apple.com/documentation/healthkit/hkhealthstore/delete(_:withcompletion:)-17hzm)). Treat samples from Apple Watch or other apps as externally owned, even when read permission exists.
- HealthKit supports idempotent replacement using `HKMetadataKeySyncIdentifier` plus the required `HKMetadataKeySyncVersion`: saving a newer version with the same identifier replaces the older object ([`HKMetadataKeySyncIdentifier`](https://developer.apple.com/documentation/healthkit/hkmetadatakeysyncidentifier)). This is the supported update mechanism for the otherwise mostly immutable workout model.

### Project recommendation

For every exported workout, use a deterministic opaque sync identifier derived from the LifeOS workout ID and a monotonically increasing LifeOS revision as the sync version. Persist the resulting HealthKit UUID and export state in a native local store; keep the LifeOS revision in the workout record synchronized through D1. On a LifeOS edit, write the new version rather than duplicate the workout. Only delete objects that the native app originated, and never silently recreate an exported workout after the user deleted it in Health; treat that as a user-controlled unlink until they explicitly re-export.

Do not enable two-way workout edits in the initial release. Importing Health workouts cannot reconstruct LifeOS exercise/set/load/RPE data, and user edits or deletions in Health need an explicit conflict policy. If later importing summaries, keep external HealthKit workouts read-only in LifeOS and preserve their source/UUID; never overwrite another source’s sample.

## Incremental and background sync

### Observed Apple capabilities

An `HKAnchoredObjectQuery` returns additions, deletions, and a new opaque anchor. Save the returned anchor and use it on the next query to process only changes; deleted-object records are available through the query ([`HKAnchoredObjectQuery`](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery), [`HKDeletedObject`](https://developer.apple.com/documentation/healthkit/hkdeletedobject)).

`HKObserverQuery` is a long-running notification that a matching sample was saved or deleted; it does not contain the changed samples. Run an anchored (or other) query after notification, persist the new anchor only after successful processing, and call the observer completion handler when processing is complete ([Executing Observer Queries](https://developer.apple.com/documentation/healthkit/executing-observer-queries)). Background delivery is opt-in per sample type through `enableBackgroundDelivery`; it wakes the native app at most at the requested delivery frequency. Apple requires enabling the nested HealthKit **Background Delivery** capability, which adds its entitlement ([Configuring HealthKit access](https://developer.apple.com/documentation/xcode/configuring-healthkit-access)). It is not continuous or guaranteed real-time execution.

### Project recommendation

For initial LifeOS → Health export, sync immediately after the native shell durably saves a completed workout and reconcile outstanding LifeOS revisions whenever the app becomes active or finishes a cloud merge. An observer/anchored-query pipeline is only necessary when the product later imports Health changes. If added, observe `HKWorkoutType` (and only the explicitly approved quantity types), retain one anchor per type locally, make uploads idempotent, and complete the observer callback only after durable local state is updated. Do not use a PWA service worker as a substitute for HealthKit background delivery.

## Shipping and privacy requirements

### Observed Apple requirements

- Enable the HealthKit capability for each native target that accesses HealthKit. Xcode links the framework and adds the HealthKit entitlement; Apple says the capability is available for iOS and watchOS app targets ([Configuring HealthKit access](https://developer.apple.com/documentation/xcode/configuring-healthkit-access)).
- Provide accurate `NSHealthShareUsageDescription` for reads and `NSHealthUpdateUsageDescription` for writes. Apple says the purpose strings are an App Store requirement for any HealthKit-integrating app ([Configuring HealthKit access](https://developer.apple.com/documentation/xcode/configuring-healthkit-access)).
- Health data is sensitive: Apple requires user authorization and prohibits using HealthKit data for advertising, marketing, or use-based data mining. Disclosure to third parties needs the user’s express permission and must provide a health or fitness service to the user ([Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)).
- The App Store guidelines require a privacy-policy link in App Store metadata and within the app, and App Store privacy disclosures must reflect actual collection and use ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)).

### Project recommendation

Request write access to `HKWorkoutType` only for the first export release; do not request read access merely to check whether export worked. If importing becomes a user-facing feature, request the minimal read types at that point and explain the limited-history behavior. The native app’s purpose strings, in-app privacy policy, App Store privacy answers, and D1 data flow must specifically disclose which workout/health data leave the device, why, retention/deletion behavior, and that the data are not sent to advertising or marketing SDKs.

## Architecture choices

| Option | What it enables | Tradeoffs |
| --- | --- | --- |
| **Native iOS shell with a HealthKit bridge — recommended** | Reuses the SvelteKit UI and IndexedDB-first workout flow. A small Swift bridge owns HealthKit authorization and export, so a workout can be written locally without waiting for D1. The same native host can support the repository’s planned Live Activity integration. | Adds an iOS/Capacitor project and App Store release process. Native reconciliation state and the JavaScript-to-Swift contract must remain small and versioned. |
| **Thin native companion using the existing cloud API** | A focused Swift app owns HealthKit and reads completed LifeOS records through the authenticated D1/cloud API while the PWA remains separate. | Clean boundary, but it adds a second user experience and authentication flow. Offline PWA records cannot export until cloud sync succeeds, and the current API/authentication contract needs a native-client design. |
| **Full native iOS client** | Native offline workout capture, direct HealthKit authorization/export, and later observer/anchored imports/background delivery. | Best Apple integration, but duplicates the PWA’s UI/state logic or requires a deliberate shared domain layer. Highest build and maintenance cost. |
| **One-way export without native HealthKit** | Exports LifeOS workout details as a user-visible CSV/JSON/shareable report. No HealthKit permission, entitlement, or native app. | Preserves all exercises, sets, reps, load, RPE, timers, and notes, but creates no Apple Health workout and provides no automatic reconciliation. Do not present this as Apple Health sync. |

The recommended shell should start with explicit user-enabled outbound export, stable HealthKit sync metadata, and rich-data retention in LifeOS. Add HealthKit reads or background import only after a concrete read use case and conflict policy exist.
