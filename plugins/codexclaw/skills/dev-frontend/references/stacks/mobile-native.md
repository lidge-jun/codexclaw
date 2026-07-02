# Mobile Native Development

**Last reviewed**: 2026-07-02
**Applies to**: Expo SDK 57 / React Native 0.86 / React 19.2.3, Flutter 3.44+, Kotlin Multiplatform 2.2+, Swift 6, Jetpack Compose M3 1.4+
**When to read**: Native mobile app development, cross-platform framework selection, change-surface: native mobile
**Canonical owner**: `dev-frontend` — framework selection and component patterns
**Non-goals**: Mobile web responsive (→ `responsive-viewport.md`, `mobile-ux.md`), push/offline/auth API (→ `dev-backend/references/core/mobile-api.md`), native UX conventions (→ `dev-uiux-design/references/mobile-native-ux.md`)

---

## §1 Domain Routing

| Need | Go To |
|------|-------|
| Framework selection + component patterns | This file |
| iOS HIG vs Material 3, gestures, deep linking | `dev-uiux-design/references/mobile-native-ux.md` |
| Push notifications, offline sync, mobile BFF | `dev-backend/references/core/mobile-api.md` |
| Mobile web responsive layout | `dev-frontend/references/core/responsive-viewport.md` |
| Mobile web UX (thumb zone, sticky CTA) | `dev-frontend/references/core/mobile-ux.md` |
| App store screenshots, icon specs | `dev-uiux-design/references/mobile-native-ux.md` §5 |

---

## §2 Framework Selection 2026

| Criterion | React Native + Expo | Flutter | Kotlin Multiplatform | Swift (iOS) / Kotlin (Android) |
|-----------|-------------------|---------|---------------------|-------------------------------|
| **Language** | TypeScript | Dart | Kotlin (shared) + Swift/Kotlin (UI) | Swift / Kotlin |
| **Rendering** | Native views via Fabric | Skia/Impeller (own canvas) | Native views per platform | Native views |
| **Code sharing** | ~90% (JS logic + RN components) | ~95% (single widget tree) | ~70% (logic only, UI per platform) | 0% (per platform) |
| **AI agent friendliness** | High — TS ecosystem, npm, large training corpus | Medium — Dart has smaller corpus, widget DSL learning curve | Medium — Kotlin corpus good, KMP-specific patterns sparse | Medium — per-platform, no sharing |
| **Hot reload** | Yes (Metro + Hermes) | Yes (Dart VM) | Partial (compose preview) | Xcode previews (limited) |
| **2026 state** | New Architecture default, Hermes, Expo SDK 57 / RN 0.86 | 3.44 SPM default, Impeller stable | KotlinConf'26 restructure, Compose Multiplatform 1.8 | Swift 6 strict concurrency, SwiftUI 6 |
| **Best for** | JS/TS teams, rapid iteration, Expo managed workflow | Pixel-perfect custom UI, animation-heavy apps | Existing Kotlin backend teams sharing logic | Single-platform apps needing full native API access |

**Default recommendation**: React Native + Expo for most cross-platform projects. Switch to Flutter for heavy custom UI/animation, KMP for Kotlin-first backend teams sharing domain logic, native-only when platform API depth demands it.

---

## §3 React Native + Expo (Default Path)

### Expo SDK 57 baseline (2026-07)

| Feature | Status | Notes |
|---------|--------|-------|
| New Architecture | Default on | Fabric renderer + TurboModules; opt-out deprecated |
| Hermes | Default engine | Use Expo defaults unless a native constraint proves otherwise |
| `expo/fetch` | Stable | WinterCG-compatible fetch, replaces `whatwg-fetch` polyfill |
| Expo Router | Stable | File-based routing, typed routes, API routes |
| EAS Build | Production | Cloud builds for iOS/Android, no local Xcode/Gradle needed |
| EAS Submit | Production | Automated App Store Connect + Google Play upload |
| Expo Modules API | Stable | Swift/Kotlin native module authoring without ejecting |

Version grounding: Expo's SDK 57 release notes list React Native 0.86 and React
19.2.3 as the default pair. Verify live Expo docs before shipping a new mobile
baseline because Expo/RN pairings move together.

### TurboModule spec pattern

```typescript
// specs/NativeDeviceInfo.ts
import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  getDeviceId(): string;
  getBatteryLevel(): Promise<number>;
  getLocale(): string;
}

export default TurboModuleRegistry.getEnforcing<Spec>("DeviceInfo");
```

### Project structure (Expo Router)

```
app/
  (tabs)/
    index.tsx          # Home tab
    settings.tsx       # Settings tab
    _layout.tsx        # Tab navigator layout
  (auth)/
    login.tsx
    register.tsx
    _layout.tsx        # Auth stack layout
  _layout.tsx          # Root layout (providers, fonts)
modules/               # Expo Modules (native Swift/Kotlin)
  device-info/
    src/DeviceInfoModule.swift
    src/DeviceInfoModule.kt
    expo-module.config.json
```

### EAS Build + Submit workflow

```json
// eas.json
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "team@example.com", "ascAppId": "1234567890" },
      "android": { "serviceAccountKeyPath": "./pc-api-key.json", "track": "internal" }
    }
  }
}
```

```bash
# Build + submit pipeline
eas build --platform all --profile production
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

## §4 Flutter (Custom UI Path)

### Flutter 3.44 baseline (2026-06)

| Feature | Status | Notes |
|---------|--------|-------|
| Impeller | Default (iOS + Android) | GPU-accelerated, no shader jank |
| SPM integration | Default for iOS | Replaces CocoaPods; `flutter pub add` handles native deps |
| Material 3 | Default theme | `ThemeData(useMaterial3: true)` is now the only path |
| Riverpod 3.x | Community standard | Compile-safe DI, code generation with `riverpod_generator` |
| Dart 3.7 | Stable | Sealed classes, pattern matching, class modifiers |

### State management decision

| Size | Approach | Package |
|------|----------|---------|
| Prototype / small | `ValueNotifier` + `ListenableBuilder` | Built-in |
| Medium app | Riverpod 3.x | `flutter_riverpod` + `riverpod_generator` |
| Large / team | Riverpod 3.x + `freezed` for immutable models | `riverpod` + `freezed` |

### Riverpod provider pattern

```dart
// providers/user_provider.dart
@riverpod
class UserNotifier extends _$UserNotifier {
  @override
  Future<User> build() => ref.read(userRepositoryProvider).getCurrentUser();

  Future<void> updateName(String name) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(userRepositoryProvider).updateName(name),
    );
  }
}
```

---

## §5 Kotlin Multiplatform

### KotlinConf'26 structure

| Layer | Shared (KMP) | Platform-specific |
|-------|-------------|-------------------|
| Domain models | `shared/src/commonMain/` | — |
| Use cases / business logic | `shared/src/commonMain/` | — |
| Networking (Ktor 3.x) | `shared/src/commonMain/` | Engine: `iosMain/` (Darwin), `androidMain/` (OkHttp) |
| UI | — | `androidApp/` (Compose), `iosApp/` (SwiftUI) |
| Compose Multiplatform 1.8 | Optional: shared UI for Android + Desktop | iOS support in beta |

### Shared module pattern

```kotlin
// shared/src/commonMain/kotlin/com/example/UserRepository.kt
class UserRepository(private val api: UserApi, private val db: UserDb) {
    suspend fun getUser(id: String): User {
        return db.getUser(id) ?: api.fetchUser(id).also { db.save(it) }
    }
}

// shared/src/commonMain/kotlin/com/example/UserApi.kt
class UserApi(private val client: HttpClient) {
    suspend fun fetchUser(id: String): User =
        client.get("users/$id").body()
}
```

---

## §6 Swift / Kotlin Native

### Swift 6 (iOS native)

| Feature | Impact |
|---------|--------|
| Strict concurrency | `Sendable` enforcement by default; data races are compile errors |
| `@Observable` macro | Replaces `ObservableObject`; simpler SwiftUI state |
| Structured concurrency | `async let`, `TaskGroup`, `AsyncStream` as primary patterns |
| SwiftUI 6 | `@Bindable`, improved navigation (`NavigationStack`), `containerRelativeFrame` |

### Jetpack Compose M3 1.4+ (Android native)

| Feature | Impact |
|---------|--------|
| Material 3 Expressive | New components: `FloatingToolbar`, `LoadingIndicator`, shape morphing |
| Adaptive layouts | `ListDetailPaneScaffold` for tablet/foldable |
| Compose compiler 2.1 | K2 compiler, faster builds, strong skipping default |
| Lifecycle 2.9 | `collectAsStateWithLifecycle` for flow-safe collection |

### SwiftUI view pattern

```swift
@Observable
final class UserViewModel {
    var user: User?
    var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        user = try? await UserService.shared.fetchUser()
    }
}

struct UserView: View {
    @State private var viewModel = UserViewModel()

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView()
            } else if let user = viewModel.user {
                Text(user.name)
            }
        }
        .task { await viewModel.load() }
    }
}
```

---

## §7 Anti-Patterns & Pre-flight

### Anti-patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| `react-native link` in Expo managed | Build fails, native deps break | Use Expo Modules API or config plugins |
| JSC engine in production (RN 0.86+) | Slower cold start, no Intl support | Hermes is default; never opt out |
| New Architecture opt-out (`newArchEnabled: false`) | Missing Fabric perf, TurboModule access blocked | Remove opt-out; New Arch is default since 0.76 |
| CocoaPods in Flutter 3.44+ | Dep resolution conflicts with SPM | Migrate to SPM (`flutter pub deps --style=spm`) |
| `setState` everywhere in Flutter | Widget rebuilds cascade, jank on complex screens | Riverpod or `ValueNotifier` for state outside widgets |
| `ObservableObject` in Swift 6 | Verbose, requires `@Published` on every field | Migrate to `@Observable` macro |
| Blocking main thread for network (Kotlin) | ANR on Android, UI freeze | `suspend fun` + `Dispatchers.IO` for all I/O |

### Pre-flight checklist

- [ ] Framework selected using §2 decision table with documented rationale
- [ ] RN: Hermes V1 enabled, New Architecture active (`newArchEnabled` absent or `true`)
- [ ] RN: Expo SDK 57 / React Native 0.86 / React 19.2.3 with `expo/fetch`, no `whatwg-fetch` polyfill
- [ ] Flutter: Impeller enabled (default), SPM for iOS deps (no CocoaPods)
- [ ] KMP: Shared module compiles for all target platforms (`./gradlew :shared:allTests`)
- [ ] Native: Swift 6 strict concurrency mode enabled; Compose compiler 2.1+
- [ ] Deep linking configured (→ `mobile-native-ux.md` §3)
- [ ] Push notification token management (→ `mobile-api.md` §2)
- [ ] App store assets prepared (→ `mobile-native-ux.md` §5)
