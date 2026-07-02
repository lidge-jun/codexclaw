# Mobile Native UX Conventions

**Last reviewed**: 2026-06-16
**Applies to**: iOS 18+, Android 15+, cross-platform (RN/Flutter/KMP)
**When to read**: Native mobile app UX decisions, platform conventions, deep linking, app store submission, native mobile product work
**Canonical owner**: `dev-uiux-design` — platform UX judgment (when/why)
**Non-goals**: Framework selection and code patterns (→ `dev-frontend/references/stacks/mobile-native.md`), push/offline API (→ `dev-backend/references/core/mobile-api.md`), mobile web UX (→ `dev-frontend/references/core/mobile-ux.md`)

---

## 1. Platform UX Conventions

| Convention | iOS (HIG) | Android (Material 3) | Cross-Platform Guidance |
|-----------|----------|---------------------|------------------------|
| **Navigation** | Tab bar (bottom), back via swipe-right | Bottom nav bar, back via system gesture/button | Use platform-native nav; don't force iOS tabs on Android or vice versa |
| **Primary action** | Right side of nav bar or prominent button | FAB (56dp) or top app bar action | Respect platform placement; FAB on Android, bar button on iOS |
| **Destructive confirm** | Action sheet from bottom | Dialog (centered) | Use platform-native confirmation pattern |
| **Pull to refresh** | Native `UIRefreshControl` spinner | `SwipeRefresh` circular indicator | Use platform-native indicator; don't custom-animate |
| **Settings** | System Settings deep link for permissions | In-app settings screen | iOS: link to Settings app for system permissions; Android: handle in-app |
| **Typography** | SF Pro (system), Dynamic Type support mandatory | Roboto (system), `sp` units for accessibility scaling | Always use system font; support dynamic/accessibility text sizing |
| **Haptics** | `UIImpactFeedbackGenerator` (light/medium/heavy) | `HapticFeedbackConstants` (confirm/reject/long press) | Map semantic haptics to platform API; never skip on destructive actions |

### Platform detection decision

| Approach | When | Risk |
|----------|------|------|
| Single UI, platform-adaptive widgets | MVP, small team, content-heavy apps | May feel "off" to power users |
| Platform-specific UI shells, shared logic | Production apps, platform-critical UX | Higher maintenance, better native feel |
| Fully native per platform | Finance, health, OS-integrated apps | 2x effort, best UX |

---

## 2. Native Gestures

| Gesture | iOS | Android | Usage |
|---------|-----|---------|-------|
| Swipe-to-dismiss | `interactiveDismissTransition` / sheet detent | `predictiveBackGesture` (Android 14+) | Modal/detail screens; always provide alternative close button |
| Long press | `UIContextMenuInteraction` (peek/pop) | `onLongClickListener` → context menu | Secondary actions; discoverable via visible menu icon |
| Pinch zoom | `UIPinchGestureRecognizer` | `ScaleGestureDetector` | Images, maps; show zoom controls for accessibility |
| Edge swipe | System back gesture (left edge) | System back (both edges on gesture nav) | Never override system back; use `popGesture` only within app nav |
| Pull down | Refresh (`UIRefreshControl`) | Notification shade (system) | iOS: pull-to-refresh is standard; Android: avoid pull-to-refresh conflict with notification shade |

### Gesture conflict resolution

| Conflict | Resolution |
|----------|-----------|
| Horizontal swipe (carousel) vs edge-back | Inset carousel 16dp from edges; let edge gesture pass through |
| Pull-to-refresh vs scroll-up | Trigger refresh only when `scrollY === 0` |
| Bottom sheet drag vs list scroll | Lock sheet drag when inner list is scrollable and `scrollY > 0` |

---

## 3. Deep Linking

### Universal Links (iOS) + App Links (Android)

```json
// apple-app-site-association (AASA) — host at /.well-known/
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAMID.com.example.app",
      "paths": ["/product/*", "/invite/*", "/u/*"]
    }]
  }
}
```

```json
// assetlinks.json — host at /.well-known/
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.example.app",
    "sha256_cert_fingerprints": ["AB:CD:..."]
  }
}]
```

### Deferred deep linking (first install)

| Method | Mechanism | Accuracy |
|--------|-----------|----------|
| Clipboard-based | Copy link → app reads on first launch | High but requires user consent prompt (iOS 16+) |
| Fingerprint matching | IP + UA + timestamp → match install to click | ~80%, degrades with VPN/carrier NAT |
| Platform SDK | Firebase Dynamic Links (deprecated) → use Branch.io or Adjust | High, third-party dependency |

### Korean in-app browser fallback

카카오톡, 네이버 앱 내 브라우저는 Universal Links/App Links를 무시하는 경우가 많다.

| Platform | Workaround |
|----------|-----------|
| KakaoTalk in-app | Intent scheme (`intent://...#Intent;scheme=myapp;package=com.example.app;end`) for Android; iOS는 `kakaolink://` scheme으로 외부 브라우저 유도 |
| Naver in-app | `naversearchapp://` intent or JavaScript bridge `openExternalBrowser()` |
| General fallback | `window.location.href = "myapp://path"` → setTimeout → redirect to store |

```javascript
// Universal fallback pattern for Korean in-app browsers
function openAppOrStore(appUrl, iosStore, androidStore) {
  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  const isKakao = /kakaotalk/i.test(ua);
  const isNaver = /naver/i.test(ua);

  if (isAndroid && (isKakao || isNaver)) {
    // Intent scheme bypasses in-app browser restrictions
    location.href = `intent://${appUrl}#Intent;scheme=myapp;package=com.example.app;S.browser_fallback_url=${encodeURIComponent(androidStore)};end`;
  } else {
    location.href = `myapp://${appUrl}`;
    setTimeout(() => {
      location.href = isAndroid ? androidStore : iosStore;
    }, 1500);
  }
}
```

---

## 4. Onboarding & Permissions

### Permission request timing

| Permission | When to Ask | Never Ask |
|-----------|-------------|-----------|
| Push notifications | After first value delivery (e.g., first order placed) | On app launch before any interaction |
| Camera | When user taps "scan" or "take photo" | During onboarding |
| Location | When showing map or nearby results | Before showing why location is needed |
| Contacts | When user taps "invite friends" | During onboarding |
| Tracking (ATT) | After explaining personalized experience benefit | As the very first screen (iOS rejects) |

### Korean privacy compliance (개인정보보호법)

| Requirement | Implementation |
|-------------|---------------|
| 개인정보 수집·이용 동의 | Separate consent checkbox, not bundled with terms of service |
| 마케팅 수신 동의 | Opt-in (not opt-out), separate from service consent |
| 만 14세 미만 | Legal guardian consent required; age gate before signup |
| 수집 항목 명시 | List exact fields collected (이름, 이메일, 전화번호) in consent screen |
| 보유 기간 | State retention period explicitly ("회원 탈퇴 시까지" or specific duration) |

### Consent screen pattern

```
┌─────────────────────────────────┐
│  [서비스 이용약관] (필수) [보기>] │  ☑
│  [개인정보 수집·이용] (필수) [보기>]│  ☑
│  [마케팅 수신 동의] (선택) [보기>]  │  ☐
│  [위치정보 이용] (선택) [보기>]     │  ☐
│                                   │
│  [전체 동의]                       │
│  [다음]                           │
└─────────────────────────────────┘
```

---

## 5. App Store UX

### Screenshot specifications

| Store | Size (iPhone 16 Pro Max) | Size (Pixel 9 Pro) | Count |
|-------|------------------------|--------------------:|-------|
| App Store | 1320 × 2868 px (6.9") | — | 3-10 per locale |
| Google Play | — | 1080 × 2400 px | 2-8 per locale |

| Rule | Detail |
|------|--------|
| First 2 screenshots | Must show core value proposition; 80% of users decide without scrolling further |
| Text overlay | Max 5 words per screenshot, 60pt+ font, high contrast |
| Locale adaptation | Korean screenshots for KR store (not English with Korean subtitle) |
| Status bar | Show realistic status bar (time, signal, battery) or crop above it |

### App icon requirements

| Platform | Size | Shape | Notes |
|----------|------|-------|-------|
| iOS | 1024 × 1024 px | Auto-masked to rounded square | No transparency; no alpha channel |
| Android | 1024 × 1024 px (foreground) + 512 × 512 px (background) | Adaptive icon (foreground + background layers) | Safe zone: inner 66% circle for foreground content |
| Both | — | — | Test at 29px (notification), 60px (home), 1024px (store) |

---

## 6. Anti-Patterns & Pre-flight

### Anti-patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| iOS-style bottom tabs on Android | Users expect Material bottom nav behavior (no swipe between tabs) | Use platform-native navigation component |
| Custom back button overriding system gesture | Predictive back animation breaks, user disoriented | Use system back; add close button only as secondary |
| Permission request on first launch | Low opt-in rate (<30%), user distrust | Ask at point of need with pre-prompt explaining value |
| Alert dialog for everything | User fatigue, dismissed without reading | Action sheets (iOS) / bottom sheets (Android) for choices; dialogs only for confirmations |
| Ignoring Dynamic Type / `sp` scaling | Accessibility failure, app store rejection risk | Test at largest accessibility text size |

### Pre-flight checklist

- [ ] Navigation uses platform-native pattern (tab bar iOS, bottom nav Android)
- [ ] All gestures have accessible button alternatives
- [ ] Deep links configured: AASA (iOS) + assetlinks.json (Android) validated
- [ ] Korean in-app browser (KakaoTalk, Naver) fallback tested
- [ ] 개인정보 수집·이용 동의 separate from 이용약관, 마케팅 opt-in separate
- [ ] Screenshots prepared per locale with Korean text for KR store
- [ ] App icon tested at 29px, 60px, 1024px; Android adaptive icon safe zone verified
- [ ] Dynamic Type (iOS) / `sp` scaling (Android) tested at max accessibility size
