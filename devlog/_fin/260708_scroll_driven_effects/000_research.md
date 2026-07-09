 # Scroll-Driven Effects Research
 
 **Date**: 2026-07-08
 **Method**: GPT-5.5 explorer x5 parallel web search
 **Context**: `cxc-dev-frontend` motion.md 확장을 위한 스크롤 드리븐 효과 전수 조사
 
 ---
 
 ## 1. 수평 스크롤 (Horizontal Scroll in Vertical Page)
 
 두 가지 패턴이 있다:
 - **Native horizontal rail**: `overflow-x: auto` + `scroll-snap-type: x mandatory`로 진짜 수평 스크롤
 - **Fake horizontal scrollytelling**: 수직 스크롤 progress를 `translateX()`에 매핑, sticky pin 안에서 수평 이동
 
 NN/g는 scrolljacking이 제어감, 발견성, 효율성, 과업 성공률을 해칠 수 있다고 경고.
 ([NN/g](https://www.nngroup.com/articles/scrolljacking-101/))
 
 ### 기법 비교
 
 | 기법 | 핵심 패턴 | 장점 | 단점 | 적합한 곳 |
 |------|-----------|------|------|-----------|
 | Native rail + CSS Scroll Snap | `overflow-x:auto`, `scroll-snap-type:x mandatory` | 네이티브, 접근성, 모바일 | 데스크탑에서 어포던스 부족 | 카드, 갤러리, Apple Store |
 | Sticky + JS translateX | section height = travel, sticky pin, progress -> translateX | 경량, 프레임워크 불필요 | 리사이즈/포커스 직접 관리 | 일회성 스토리텔링 |
 | GSAP ScrollTrigger pin | `pin:true`, `scrub:true`, `xPercent` 애니메이션 | 성숙, 리사이즈/snap/타임라인 | 라이브러리 의존, 라이선스 | 브랜드/캠페인 사이트 |
 | CSS scroll-driven | `animation-timeline: scroll()` + translateX keyframes | 선언적, 오프메인스레드 가능 | MDN "Limited availability" | Progressive enhancement |
 | Lenis / Locomotive | 스무스 스크롤 래퍼 + 애니메이션 레이어 | Lenis 경량, Locomotive v5 9.4kB | 유저 제어감 주의 | 에이전시/WebGL |
 
 ### 코드 패턴
 
 **Native rail:**
 ```css
 .rail {
   display: flex; gap: 24px;
   overflow-x: auto;
   overscroll-behavior-inline: contain;
   scroll-snap-type: x mandatory;
 }
 .card { flex: 0 0 min(82vw, 420px); scroll-snap-align: start; }
 ```
 
 **Sticky + JS:**
 ```css
 .h-section { height: calc(100vh + var(--travel)); }
 .h-sticky { position: sticky; top: 0; height: 100vh; overflow: hidden; }
 .h-track { display: flex; will-change: transform; }
 .panel { flex: 0 0 100vw; }
 ```
 ```js
 const section = document.querySelector('.h-section');
 const track = document.querySelector('.h-track');
 function update() {
   const rect = section.getBoundingClientRect();
   const max = track.scrollWidth - innerWidth;
   const progress = Math.min(1, Math.max(0, -rect.top / (section.offsetHeight - innerHeight)));
   track.style.transform = `translateX(${-max * progress}px)`;
 }
 addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
 ```
 
 **GSAP ScrollTrigger:**
 ```js
 gsap.to('.h-track', {
   xPercent: -100 * (panels.length - 1),
   ease: 'none',
   scrollTrigger: {
     trigger: '.h-wrap', pin: true, scrub: 1,
     snap: 1 / (panels.length - 1),
     end: () => '+=' + document.querySelector('.h-track').offsetWidth
   }
 });
 ```
 
 **CSS scroll-driven:**
 ```css
 @supports (animation-timeline: scroll()) {
   .h-track {
     animation: move-x linear both;
     animation-timeline: scroll(root block);
   }
   @keyframes move-x { to { transform: translateX(calc(-100% + 100vw)); } }
 }
 ```
 
 ### 프로덕션 사례
 - [Apple Store](https://www.apple.com/store) - 수평 카드 레일
 - [Bulgari Eclettica](https://www.awwwards.com/sites/bulgari-eclettica) - GSAP + 수평 레이아웃
 - [Ducati Superleggera V4](https://www.awwwards.com/sites/ducati-superleggera-v4) - 시네마틱 스크롤텔링
 - [Transmissions / Balenciaga Museum](https://www.awwwards.com/sites/transmissions) - Locomotive Scroll
 
 ---
 
 ## 2. 슬라이드/페이지 전환 효과
 
 ### 기법 비교
 
 | 기법 | 핵심 | 장점 | 단점 |
 |------|------|------|------|
 | CSS scroll-snap (y mandatory) | `scroll-snap-type: y mandatory`, 섹션 `100svh` | 네이티브, 경량 | 짧은 섹션/폼에서 공격적 |
 | Sticky card stacking | `position: sticky`, 카드마다 `top` 증가 | 자연스러운 문서 흐름, 스토리텔링 | overflow 주의, z-index 관리 |
 | View Transitions API | `document.startViewTransition()` + IO | 섹션 간 morph 효과 | 연속 스크롤 아닌 이산 전환용 |
 | CSS scroll-driven fade/slide | `animation-timeline: view()`, `animation-range` | 선언적, 오프메인스레드 | Firefox 지원 주의 |
 | IntersectionObserver | 진입시 클래스 토글 | 안정적, 폴백으로 적합 | 이산적, 스크롤 정밀도 낮음 |
 | GSAP / Motion / Lenis | pin + scrub + snap 오케스트레이션 | 복잡한 시퀀스 제어 | 의존성, 번들 비용 |
 
 ### Sticky Card Stacking 코드
 ```css
 .stack { position: relative; }
 .card {
   position: sticky; top: 2rem;
   transform-origin: top;
 }
 .card:nth-child(2) { top: 4rem; }
 .card:nth-child(3) { top: 6rem; }
 ```
 ref: [CodyHouse Stacking Cards](https://codyhouse.co/tutorials/how-stacking-cards)
 
 ### fullPage.js 대안 (2026)
 - CSS Scroll Snap: 단순 풀스크린 슬라이드 기본값
 - GSAP ScrollTrigger: 핀/스크럽/스냅 스토리텔링
 - Motion/Framer Motion `useScroll`: React 앱
 - Lenis + `lenis/snap`: 고급 인터랙티브
 - Swiper vertical/mousewheel: "슬라이드" 멘탈 모델
 
 ### 모바일 규칙
 - `100svh` 또는 `100dvh` 사용 (100vh는 모바일 툴바에 의해 오버플로우)
 - `prefers-reduced-motion: reduce` 시 `scroll-snap-type: y proximity`로 전환
 
 ---
 
 ## 3. CSS Scroll-Driven Animations API (2026 현황)
 
 ### API Surface
 
 | 속성/API | 역할 |
 |----------|------|
 | `animation-timeline` | 애니메이션을 `scroll()` 또는 `view()` 타임라인에 연결 |
 | `scroll()` | 스크롤러의 진행률 0-100%에 매핑 |
 | `view()` | 요소가 뷰포트에 진입/통과/이탈하는 진행률에 매핑 |
 | `animation-range` | 타임라인 중 활성 구간 제한 (entry/exit/cover/contain) |
 | `scroll-timeline` / `view-timeline` | 네임드 타임라인 (다른 요소가 참조 가능) |
 | `timeline-scope` | 네임드 타임라인을 상위로 호이스팅 |
 | JS `ScrollTimeline` / `ViewTimeline` | WAAPI 타임라인 객체 |
 
 ### 브라우저 지원 (2026-07)
 
 Can I Use 기준 **83.66% global usage**.
 
 | 브라우저 | 상태 |
 |----------|------|
 | Chrome/Edge | 115+부터 지원 |
 | Safari/iOS | Safari 26+, iOS Safari 26+ |
 | Opera | 101+ |
 | Samsung Internet | 23+ |
 | Firefox desktop | 155에서 서브피처 지원, 메인 테이블은 미지원 표시 - 주의 |
 | Firefox Android | 미지원 |
 
 ### 성능 데이터
 
 Chrome 케이스 스터디: Tokopedia가 커스텀 JS 스크롤 로직을 교체한 결과
 - 코드 80% 감소
 - 스크롤 중 CPU 사용률 **50% -> 2%** 감소
 
 ref: [Chrome ecommerce case study](https://developer.chrome.com/blog/css-ui-ecommerce-sda)
 
 ### 주의사항
 - `animation` shorthand가 `animation-timeline`을 리셋함 -> 반드시 뒤에 선언
 - 스크롤 가능한 overflow가 없으면 타임라인 비활성
 - `animation-fill-mode: both` 필수 (아니면 범위 밖에서 스타일 점프)
 - view timeline range는 변환 전 box 기준 (scale/translate가 range 계산에 영향 안 줌)
 - 폴리필: [flackr/scroll-timeline](https://github.com/flackr/scroll-timeline)
 
 ### 프로덕션 적합도
 **Progressive enhancement로 사용 가능**: 프로그레스 바, reveal, 패럴랙스, 캐러셀 인디케이터, 프레임 시퀀스.
 핵심 콘텐츠나 네비게이션을 이것에만 의존하지 말고 `@supports` 폴백 필수.
 
 ---
 
 ## 4. 패럴랙스, 줌, 깊이 효과
 
 ### 기법 비교
 
 | 기법 | 장점 | 단점 | 성능 |
 |------|------|------|------|
 | CSS scroll-driven parallax | JS 불필요, 선언적 | 지원 폴백 필요 | transform만 쓰면 좋음 |
 | CSS 3D perspective | 진짜 깊이 모델 | 스태킹/스케일 복잡 | GPU 메모리 주의 |
 | JS parallax (rAF) | 완전한 브라우저 지원 | 레이아웃 읽기/쓰기로 jank 가능 | passive listener + RAF |
 | GSAP ScrollTrigger | 성숙, 시퀀싱, 핀 | 의존성 | scrub + pin 신중하게 |
 | Blur/focus transition | 피사계 심도 효과 | `filter: blur()` 비쌈 | 작은 요소에만 |
 | Text reveal / kinetic | 에디토리얼, 임팩트 | DOM 무거움 | semantic + decorative 분리 |
 | Text as video mask | "텍스트 창문" 효과 | 크로스브라우저 mask | 영상은 muted autoplay |
 | SVG path drawing | 타임라인, 루트맵 | 복잡한 path 비용 | 길이 프리컴퓨트 |
 
 ### 추천
 - 간단한 패럴랙스/줌/reveal -> CSS scroll-driven
 - 핀 씬, 타임라인 동기화, 이미지 시퀀스, SVG 드로잉 -> GSAP ScrollTrigger
 - 경량 이미지 패럴랙스 -> Rellax / simpleParallax
 
 ---
 
 ## 5. 비디오/프레임 시퀀스 스크롤 재생
 
 ### 기법 비교
 
 | 기법 | 적합한 곳 | 비고 |
 |------|-----------|------|
 | Canvas 프레임 시퀀스 | 포토리얼 제품, Apple 스타일 | 정석. 프레임 프리로드 -> canvas drawImage |
 | video currentTime 스크럽 | 간단한 영상 효과 | 프레임 정확도 보장 안 됨, 모바일 불안정 |
 | All-I-frame 비디오 | 파일 수 최소화 | GOP interval 1로 인코딩, 파일 큼 |
 | Progressive loading | 긴 시퀀스 | frame 0, last, midpoint, quarters 순 로드 |
 | Sprite sheet | 소규모 시퀀스 | 요청 적음, 전체 디코딩 필요 |
 | Lottie scrub | 벡터 모션 | ScrollTrigger + goToAndStop. 포토리얼 부적합 |
 
 ### 이미지 포맷 추천
 
 | 포맷 | 용도 | 비고 |
 |------|------|------|
 | **WebP** | 기본값 | 압축 좋고 디코드 빠름, 넓은 지원 |
 | **AVIF** | 대역폭 최우선 | JPEG 대비 60% 절약, WebP 대비 35% (web.dev) |
 | JPEG | 폴백 | 인코드/디코드 단순할 때만 |
 
 실무 선택: canvas 시퀀스는 **WebP 우선**, `<picture>`는 **AVIF primary + WebP fallback**.
 
 ### 최적화 전략
 1. IntersectionObserver로 시퀀스 진입 시에만 프리로드
 2. 체크포인트 우선 로드 (Apple 방식: 0 -> last -> mid -> fill)
 3. rAF + passive listener, 프레임 인덱스 변경 시에만 drawImage
 4. 데스크탑/모바일 별도 시퀀스 (canvas 크기 차이)
 5. `prefers-reduced-motion`: 정적 포스터 또는 짧은 자동재생
 
 ### AI 생성 파이프라인 (ima2)
 ```
 ima2 gen "product scene" --quality high
     -> ima2 video "motion prompt" --ref image.png --duration 10 --resolution 1080p
         -> ffmpeg -i motion.mp4 -vf "fps=24,scale=1440:-1" frames/%04d.webp
             -> Canvas scroll-driven playback
 ```
 
 ---
 
 ## 6. 공통 가드레일
 
 ### 성능
 - `transform`과 `opacity`만 애니메이트 (layout 속성 금지)
 - `will-change: transform` 절제, 애니메이션 후 제거
 - passive scroll listener + requestAnimationFrame
 - 레이아웃 측정 캐시, 프레임마다 getBoundingClientRect 호출 금지
 
 ### 접근성
 - `prefers-reduced-motion: reduce` 필수 대응
 - 키보드 포커스가 오프스크린 translateX 콘텐츠에 갇히지 않도록
 - 시맨틱 텍스트 유지, 장식용 split은 별도 레이어
 
 ### 모바일
 - `100dvh`/`100svh` 사용 (`100vh` 금지)
 - 모바일에서 fake-horizontal pinning -> 수직 스택 또는 네이티브 스와이프 레일로 전환
 - 터치 타겟 44px 이상
 
 ### CSS Scroll-Driven 폴백
 ```css
 .reveal { opacity: 1; transform: none; }
 @supports (animation-timeline: view()) {
   .reveal {
     animation: reveal linear both;
     animation-timeline: view();
     animation-range: entry 15% cover 40%;
   }
 }
 ```
 
 ---
 
 ## 7. 2026 의사결정 트리
 
 ```
 스크롤 효과가 필요한가?
   |
   +-- 카드/갤러리 수평 스크롤 --> CSS Scroll Snap (native rail)
   |
   +-- 풀페이지 슬라이드 전환 --> CSS scroll-snap: y mandatory
   |
   +-- 간단한 reveal/fade --> CSS animation-timeline: view() + @supports 폴백
   |
   +-- 패럴랙스/줌 --> CSS scroll-driven (단순) / GSAP ScrollTrigger (복잡)
   |
   +-- 수평 스크롤텔링 (핀) --> GSAP ScrollTrigger pin + scrub
   |
   +-- 프레임 시퀀스 재생 --> Canvas + Image sequence + sticky
   |
   +-- 섹션 카드 스태킹 --> position: sticky + incremental top
   |
   +-- 벡터 모션 스크럽 --> Lottie + ScrollTrigger
   |
   +-- 비디오 스크럽 --> video.currentTime (간단) / Canvas 시퀀스 (정밀)
 ```
 
 ---
 
 ## 8. motion.md 업데이트 계획
 
 현재 motion.md에 없거나 보강이 필요한 패턴:
 
 1. **Horizontal scroll-in-vertical**: sticky + translateX 패턴, GSAP pin, CSS scroll-driven
 2. **Sticky card stacking**: position: sticky 활용 카드 스태킹
 3. **Frame sequence scrolltelling**: AI 생성 파이프라인 + Canvas + 프로그레시브 로딩
 4. **Video currentTime scrub**: 간단 영상 효과용 패턴 + 한계
 5. **View Transitions + scroll**: IO 기반 이산 전환
 6. **Text mask/reveal**: clip-path, SVG mask, kinetic typography
 7. **SVG path drawing**: stroke-dashoffset 스크롤 연동
 8. **이미지 포맷 가이드**: WebP vs AVIF vs JPEG for sequences
 9. **Progressive frame loading**: Apple 방식 체크포인트 로딩
 10. **Lottie scroll scrub**: 벡터 모션 스크롤 연동
 
 ---
 
 ## Sources
 
 | Topic | Source |
 |-------|--------|
 | CSS Scroll-Driven Animations | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations), [Chrome](https://developer.chrome.com/docs/css-ui/scroll-driven-animations), [WebKit](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/) |
 | Browser support | [Can I Use](https://caniuse.com/wf-scroll-driven-animations) |
 | Performance case study | [Chrome/Tokopedia](https://developer.chrome.com/blog/css-ui-ecommerce-sda) |
 | CSS Scroll Snap | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-type), [web.dev](https://web.dev/articles/css-scroll-snap) |
 | Scrolljacking UX | [NN/g](https://www.nngroup.com/articles/scrolljacking-101/) |
 | Apple frame sequence | [CSS-Tricks](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/), [geyer.dev](https://geyer.dev/blog/css-image-sequence-animations/) |
 | GSAP ScrollTrigger | [GSAP docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) |
 | Lenis | [GitHub](https://github.com/darkroomengineering/lenis) |
 | Locomotive Scroll v5 | [locomotive.ca](https://scroll.locomotive.ca/) |
 | View Transitions | [Chrome](https://developer.chrome.com/docs/web-platform/view-transitions), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) |
 | Image formats | [web.dev AVIF](https://web.dev/articles/avif-updates-2023), [MDN image types](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types) |
 | Polyfill | [flackr/scroll-timeline](https://github.com/flackr/scroll-timeline) |
 | Viewport units | [web.dev](https://web.dev/blog/viewport-units) |
 | Stacking cards | [CodyHouse](https://codyhouse.co/tutorials/how-stacking-cards) |
 | Text mask on scroll | [Olivier Larose](https://blog.olivierlarose.com/tutorials/text-clip-mask-on-scroll) |
 | SVG mask transitions | [Codrops](https://tympanus.net/codrops/2026/03/11/svg-mask-transitions-on-scroll-with-gsap-and-scrolltrigger/) |
 | Reduced motion | [web.dev](https://web.dev/articles/prefers-reduced-motion), [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) |
