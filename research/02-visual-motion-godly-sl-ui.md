# B. Визуальный язык и моушн: Godly + SL UI Library — полное исследование источников

Дата: 2026-11-02. Исследователь: агент B.
Изменение задачи по ходу работы (от владельца через координатора): сравнение с нашим сайтом и раздел «Применимо к Напарнику» убраны; наш сайт не снимался и не анализировался. Отчёт — только честное и полное изучение двух источников.

Все пути ниже относительно `` (скриншоты — в `shots/B/`).

## 0. Как изучалось (метод) и чек-лист покрытия

Инструменты: Playwright Chromium (headless, swiftshader WebGL), ffmpeg, разбор CSS/JS через `getComputedStyle` и `document.styleSheets` прямо на живых страницах; RPC-API каталога Godly; клонированный репозиторий SL (`repos/sl-ui-library-clone/repo`, читался, но не запускался; JS пакетов исполнялся только как часть опубликованных страниц на github.io в браузере).

| Пункт | Статус | Где лежит |
|---|---|---|
| godly.website открыт | ✅ 301 → `recent.design/?ref=godly` (Godly ребрендинг; раздел Websites — это каталог Godly) | `shots/B/godly_home_1440.png`, `godly_websites_1440.png`, `godly_websites_390.jpg` |
| Весь каталог Websites пройден | ✅ 99 из 99 (пагинация RPC `api.recent.design/rpc/items/list` до `nextCursor=null`; сортировки recent/popular/featured дают тот же набор) | `scriptsB/godly_catalog.json`, Приложение A |
| Фильтры/категории | ✅ 21 категория (All, AI, Agency, Portfolio, SaaS, Ecommerce, Startup, Product, Technology, Finance, Food & Drink, Music, Art, Photography, Architecture, Health, Education, Entertainment, Web3, Crypto, Editorial, Personal); Health = 6 сайтов; фильтр меняет URL `?category=health` | `shots/B/godly_filter_health.jpg` |
| Видео-превью всех сайтов | ✅ 85 записей скачаны (480p), по 8 кадров каждой; 14 позиций без видео — карточки 2880 px | `godly_videos/`, `godly_frames/rows/*.png`, листы `shots/B/catalog/sheet_01..15.png`, `cards_novideo.png` |
| Глубокие разборы ≥15 | ✅ 24 сайта: живой визит 1440×900 (10 кадров интро 0–6,5 с, 14 шагов скролла + промежуточные кадры), 390×844 (4 кадра интро + 5 экранов), hover/CTA, вычисленные стили; для 20 — ещё 720p-запись Godly, 30 кадров | `shots/B/sites/<slug>/`, `shots/B/video/*.jpg` |
| Детальная страница Godly | ✅ (метаданные: Impressions, Outbound, Source, Category, Style, Color, Framework) | `shots/B/godly_detail_endel.jpg` |
| SL UI Library — сайт | ✅ герой, курсор, CTA hover/press/focus, переход «Explore library» (18 кадров), каталог, категории, карточки, showcase, studio-motion, мобильный | `shots/B/sl/` |
| SL — репозиторий | ✅ клонирован (6269 файлов, 175 МБ); прочитаны README, AGENTS/QA/CONTRIBUTING, docs/development/reports, shell-эксперименты (все CSS/MJS/tokens), каталог-данные; статический разбор всех 219 уникальных CSS пакетов | `repos/sl-ui-library-clone/repo` |
| SL — каждый компонент | ✅ 388 из 388, 6 состояний каждый (2328 кадров) | `sl_states/`, `shots/B/sl/inventory/`, `shots/B/sl/states/`, Приложение B |

Ограничения, честно:
- Многие живые сайты за время с момента попадания в Godly **переделаны** (Amie, Mixpanel, SquadEasy, The Browser Company, Honk «sunset», MAD). Для них описаны обе версии: архивная (по записи Godly) и текущая (живой визит).
- WebGL-сцены Pacôme Pertant, Nothing to Watch после кнопки-ворот не отрисовались в headless swiftshader → изучены по записям Godly. avara.xyz закрыт Cloudflare-проверкой от ботов → только запись Godly. nevflynn.com отдаёт 500.
- Длительности/кривые из CSS измерены точно; JS-анимации (Framer Motion, GSAP, WAAPI) оценены по кадрам (шаг 150–1000 мс), это приближение. FPS в headless без GPU не меряется.

## 1. Godly сегодня: как устроен сам источник

- godly.website → 301 на recent.design (тот же автор, расширенный «daily curation»: Design, Launch Videos, Websites, OG Images, App Screenshots, App Icons, Tools, Skills, Jobs). Каталог сайтов Godly = раздел **Websites**, 99 позиций.
- Лента: 4 колонки карточек 16:10, у каждой видео-превью (scroll-запись сайта, 7–101 с, медиана ≈25 с); после наведения/появления в кадре все видео играют (`paused:false` у 6 из 6 после hover). Стрелка ↗ в углу; фирменная мелочь — «живые» курсоры других посетителей (цветные стрелки поверх ленты).
- Детальная страница: слева описание + метаданные (Impressions/Outbound/Source/Category/Style/Color/Framework), справа запись в рамке на сером.
- Статистика каталога (99 сайтов). Категории: agency 22, portfolio 17, ecommerce 10, health 6, saas/ai/finance/product по 4, entertainment/photography/art/personal/technology/editorial по 3, прочее ≤2.
  Самые частые стиль-теги: Large Type 68, Minimal 57, Typographic 52, Clean 43, Transitions 34, Vibrant 28, Editorial 26, Dark 25, Experimental 25, 3D 22, Gradient 21, Playful 20, Muted 17, Light 17, Animation 13, Illustrative 12, Interactive 11, Long Scrolling 11, Three.js 11, Pastel 11, GSAP 10, Big Background Image 10, Lenis 10, Motion 10, Scrolling Animation 10, Textured 6, Neon 6, 3D Illustration 6, Earthy 4.
  Вывод из статистики: «премиальность» по версии Godly — это в первую очередь крупная типографика + минимализм + переходы; иллюстрация/персонажи — 12–20 % каталога и почти всегда в связке Playful/Pastel/Dark.

## 2. Глубокие разборы (24 сайта)

Отбор: всё Health (6), всё с тегами Illustrative/Playful/3D Illustration/Character, тёмные иллюстрированные, лендинги приложений, сайты с заметными микро-взаимодействиями. Для каждого: живой сайт + запись Godly. Ниже — рабочие заметки, собранные по ходу (со ссылками на кадры).

### endel-manifesto (manifesto.endel.io)
- Live: black splash gate — logo (line glyph) + "Manifesto / How Endel will reshape our collective future" + grey button "Find Out" (Roboto 24px, bg #4D4D4D, r10, pad 0 60, hover bg #333 — no transform). Splash fades in (Preview_fadeIn 1s ease-in-out) between 200-700ms. Content locked until click. Keyframes: Header_slideUp (margin-top 40%→0), Header_heightDown (min-height window→0) — the header collapses from full-screen to top on entry. Next.js, no GSAP, Roboto only.
### lovi (lovi.care) — Framer + Lenis
- Hero: centered 3-line H1 "Science-backed / AI Cosmetologist / you can trust" (ES Rebond Grotesque 400, tight lh ~0.9-1.0, ls -1px), tiny sub; pill badge above ("Lóvi won Beauty Innovation Award!", r56, white 20% + double soft shadow 0 5 20 rgba(0,0,0,.1)); face photo with frosted glass phone overlay "Face scan in progress…" (backdrop-filter x9). Store badges top-right; floating round black button bottom-right.
- Intro: hero visible by 200ms, face image settles (subtle scale) ~1-1.5s.
- Scroll: inline-icon sentences ("track changes with ◉ face scanner"), word-by-word grey→black text reveal ("Lóvi is a comprehensive approach..."), pastel lilac/pink radial blurs behind cards, chat UI demo with gradient slider "How does your skin feel today?" (emoji-scale slider pink→lilac), suggestion pills (blue gradient, arrow icon) — conversational onboarding as product demo; quiz "So, do you love the current state of your skin? Yes/No"; FAQ accordion; closing big soft-focus portrait w/ gradient veil.
- will-change on 113 nodes; filters 14; framer motion JS-driven (CSS transitions near-zero).
### superpower (superpower.com) — Webflow + GSAP/ScrollTrigger
- Hero: dark video bg (black in headless), left-aligned H1 "Your new health membership" NB International Pro 56px/1.0, ls -0.02em; two pill CTAs (white solid 'Become a member' + 10% white ghost 'See what we test', r999, 13x19 pad); trust row bottom (3 small columns).
- At ~4.5s a centered MODAL slides in over warm amber interior photo: "Get a complimentary follow-up test ($99) — To claim, tell us what brings you here" + 5 stacked white pill choices (Low energy, Weight, Sleep/stress/trouble focusing, Disease prevention, Other) — ONE-QUESTION intake as conversion device.
- Motion tokens (computed): eases cubic-bezier(0.32,0.72,0,1) [iOS sheet curve] x52, (0.22,1,0.36,1) [easeOutQuint] x46, (0.25,1,0.5,1) x45, (0.16,1,0.3,1) [expo-out] x23; durations 0.15/0.25/0.35/0.4/0.6s. CTA: padding 0.25s expo-out + scale 0.15s ease-out (press), background 0.25s. Keyframes sp2BlurIn/sp2BlurOut (blur-fade), sp2_ripple, hiws-tap/pop/note (how-it-works phone demo). prefers-reduced-motion respected. backdrop-filter on 48 nodes.
### him-hers (app.forhims.com)
- Hand holding phone centered on lilac/pink radial glow; giant pale grey words scroll horizontally behind phone ("it's all in the app"); phone screen video changes per section (scroll-pinned).
- Large blue text paragraph reveal (sofia 500); pinned tabs "Care / Programs / Shop" — active black, others ghost, with floating 3D soft white tiles holding icons; progress ring "50%" stat; card mosaic of portraits/colour cards.
- Eases: cubic-bezier(0.19,1,0.22,1) (expo-out) 0.6s transforms; (0.215,0.61,0.355,1) easeOutCubic 0.2s opacity. CTA 'Download now' white pill r52 shadow 0 8 30 rgba(0,0,0,.06).
### squadeasy (squadeasy.com) — live site redesigned vs Godly capture
- Godly capture: neon green, white 3D dog/ghost mascot peeking from behind headline letters, 'Cool !' copy, sticker counters.
- Live now: beige/tan, 80px Black condensed caps 'VOUS N'AVEZ JAMAIS ÉTÉ AUSSI PROCHE DE / RAPPROCHER VOS SALARIÉS' (pink highlight words), tilted polaroid photo cutouts scattered around headline, lime pill CTA; sticky rounded nav bar. Sticky-note stat cards (yellow/green/lilac, slightly rotated) '79%','7.4'. Coloured full-bleed blocks (sky blue, lilac, lime). Handwritten 'Sharpie' font accent. FOUT at 0ms (Times fallback visible) — anti-pattern.
- Motion: transform 0.2s ease (93 nodes hover lifts), opacity .8s ease reveals, stroke-dash draw 0.6s (0.4,0,0.2,1); keyframes bounceIn/bounceInDown/fadeUp/translateY(3s infinite float).
- endel after click: splash fades (150-800ms), then black page; first statement "We're not evolving / fast enough" rises from center to top (Header_slideUp margin-top 40%→0) ~1.3-3s; white thin-stroke line illustrations (city skyline, head profile, crescent moon, stars) drawn as SVG outline; centered statements Roboto ~36px + small 14px body; ONE warm moment: big radial SUNRISE half-disc (orange→red→magenta→violet) with radiating black lines and triangle "eye" — "Mindfulness practices help greatly"; boxed "19|68" quote frame; tiny twinkling star dots all over; dashed colour streak lines (motion lines) at section "But mindfulness alone is not the answer". Shots: endel-manifesto/i_s02.jpg (sunrise), i_01_click_*.jpg.
### superpower (after modal/ cookie): warm amber photography (sunset backlight portraits, golden flare), "Health is your superpower" over golden face; testimonials carousel; 'Biological age 38↘' stat card on photo; '$199/yr' pricing card; clinicians 'Clinicians' Choice' laurel badge; FAQ; footer w/ QR to App Store. Cookie banner bottom-left persistent.
### david-heckhoff (david-hckh.com) — Three.js + Lenis, Urbanist + ProFontWindows (pixel mono for HUD)
- Hero: cream (#F3ECE3-ish) bg, left 'David Heckhoff' Urbanist 900 + tilted navy sticker 'WEB DEVELOPER'; right a 3D isometric room (desk, monitors with code, pinboard, plant, penguin toy, music notes floating) with chibi 3D character seen from behind typing. Center-top pill nav (About/Projects/Contact, active orange pill), orange 'GET IN TOUCH' pill + sound toggle. Scroll cue mouse icon w/ dot anim (1s infinite).
- Scroll: camera dives into monitor → BLUE holographic 'scanner' room: character on glowing platform, gets X-rayed into wireframe hologram while counter 046→074→100 runs and HUD panels (pixel font) list skills — scroll-scrubbed character transformation. Then cream 'Projects' cards (rounded 16px), 'Start a new project +' dashed card. Contact: character stands with crossed arms among cardboard boxes, follows cursor; when idle it FALLS ASLEEP (head droops + 'zZ' glyph) — idle-state personality (frame i_s07/08).
- Tokens: --ease-smooth cubic-bezier(.6,0,.25,1), --ease-power2-out (.25,.46,.45,.94), --ease-power2-in (.165,.84,.44,1) [sic], --transition-route-duration .5s; radii 6/12/16; hover transitions 0.1-0.2s ease-in-out. Respects prefers-reduced-motion (no-preference gating). Sound on/off toggle (music by HM Surf).
### no-10 (y-n10.com) — Three.js isometric voxel world
- Gate: dark #121212 loader bar → minimal Times 16px text 'Yamauchi No.10 Family Office / Since 2020 / Enter'. After Enter: endless isometric voxel diorama (castles, fountain, trees, people, animals, cars, waterfall) on black, with the manifesto written IN the world as voxel Japanese characters lying on the ground; scrolling pans the camera diagonally across the map; little side nav (Statement/Legacy/Philosophy/About) with active item. Small moving voxel actors (cars, people) give life. keyframes bgColorRotation1/2 on loader.
### avara (avara.xyz) — live site blocked by Cloudflare bot check in headless; studied via Godly 720p recording (img/B-video-20_avara.jpg)
- Pure black stage; 4 sticker-style flat CHARACTERS in a row (ghost in a cap, red-outlined square frame, cloud with sleepy smile, green smiley) each = a product (Aave Labs, Family, Lens, GHO). Hover shows tiny label tooltip above character. Click: chosen character scales up to hero size and slides left while others slide off/dim; dark side panel (#151515) with product name, description, meta rows, pagination dots slides in from right. Characters have thick coloured outlines + soft inner shading, idle bob. Lottie + Howler (sound on interactions). Navigation = characters, no text menu. Wordmark AVARA tiny bottom centre.
### amie (archived Godly recording; live amie.so is now an "AI note taker" plain white page — redesigned)
- Opening: product UI inside a ROUNDED WINDOW floating on grey, which zooms/expands to full-bleed SKY (card→fullscreen transition, radius shrinking).
- Whole page is a DAY-CYCLE SKY JOURNEY driven by scroll: warm dusk sky with peach clouds → bright noon sky with sun flare and white clouds → lilac/pink dusk → deep night (purple→black) for footer with a glowing 3D logo cloud on a pedestal.
- Live personalised sentence with inline mini-icons: "Happy Wednesday! It's [clock] 9:58 PM and [weather icon] clear in [map] Canberra. You got [mail] 2 emails and have [card] 2 meetings today." — words light up white as the scroll progresses (unread words translucent white ~40%).
- Soft matte 3D pastel blobs (peach, pink, lilac, mint pills/clovers) drift slowly in parallax depth layers — ambient, never interactive.
- Feature carousel of frosted cards (NLP Scheduling, Widgets, Multiple accounts w/ memoji, POMODORO card '28:49s' ring + bar chart, Timezones), pagination pill.
- Floating glass bottom bar (Watch film · Pricing · Download), tiny logo top-centre only — chrome minimal so the sky dominates.
- "Your [song] listened songs. Your [moon] sleep duration and stages. Your workouts. Your meditation. Your [heart] heart rate. On one calendar." — inline coloured pill icons.
- Footer copy: "We're a remote software company. Care for joy as much as productivity."
- Key frames: img/B-video-amie_key4.jpg, 36_amie.jpg.
### squadeasy archived (Godly 720p, img/B-video-84_squadeasy.jpg) vs live (beige collage, see sites/squadeasy)
- Neon-green full-bleed; a glossy 3D DOG MASCOT head sits INSIDE the headline, replacing a letter ("It is beli[dog]ed that the world is changing"), with white comic 'burst' lines radiating around it on every reveal; it wobbles/tilts as words change. Mascot recurs per section ("And it works great g[dog]d", 'Statements of love'), and a white circle CTA "Join we →" with circular text ring around it. Stats as tilted green sticky cards with hand-drawn doodles (hands, clouds, paper planes) "79% of users feel better", "96%". Playful copy: "Cool! And it works really?" / "tell us what you think of pineapple pizzas". Red ticker bar "Recommend us in your company".
### mixpanel archived (Godly; live site rebranded to plum/magenta product page)
- Hero "Progress is possible" + small pill CTA, under it a concentric rounded-rect GRADIENT PORTAL (violet outer→coral→peach→white core, like a glowing doorway). Scroll ZOOMS THROUGH the portal into a warm painted desert illustration (coral/ochre mesas, lilac sky with clouds, explorers with a jeep & an antenna) — scroll-driven scale transition from abstract light into illustrated world.
- Deep navy/indigo sections with rounded bottom corners lifting like cards; "It's okay to not have all the answers" (empathy line) then "We'll help you get started" + 'Let's Build'; input placeholder cycles "What are you building?" → "What is it for?" (typewriter question).
### how-to-talk-to-white-kids-about-racism (live = WebGL book; Godly 720p shots/B/video/49_...jpg)
- Dark charcoal stage with faint diagonal brush/grain texture; a 3D BOOK falls in tumbling from the top, settles, idles with a gentle hover-bob (keyframes bookHover); dedication text below in Canela serif ("To: Kiri, Ama, and Naya / May you grow up..."). Hover cue "Open book". Click: book rotates to face you and OPENS (cover hinge), page-turns are real 3D page curls between spreads; each spread a richly textured illustration with hand-lettered giant word (EDUCATE, PRIVILEGE, HEROES, CHALLENGE, NEW FRIENDS) and animal characters (bunnies, fox, raccoon, lion) in saturated palettes (rose, vermilion, forest green, periwinkle, teal, ochre) with paper grain + halftone texture; arrows left/right + dot pagination with colour-coded dot per chapter. Transitions all 1s ease-in-out.
### pacome-pertant (pacomepertant.com) — Three.js + Lenis + Lottie + Howler
- Gate: black, tiny green glossy blob logo, "motion & sound designer based in paris", white pill "enter with sound" (r50, 14px pad) — sound opt-in as ritual.
- Enter → a cloud of ~20 project cards floating in 3D space, drifting/rotating slowly; tilted rotating sticker badge bottom-left ("2025 • showreel"); clicking 'play' flies the camera into a showreel scene: a smooth gradient CHARACTER bust (faceless, two white square eyes, glowing gradient brain) in indigo→violet light, with UI chips 'play!', audio waveform pills, moons/planets at screen edges, timeline scrubber at bottom.
- Menu: white rounded panel slides in from right with huge 80px words 'works / about / contact' (Indivisible var 500, ls -4px) + round icon buttons.
- Project list: centred 20px list where hovered item goes bright white, others 40% grey, and a thumbnail follows the cursor.
- EASING: CSS linear() spring curves (≈ overshoot to 1.0084 at 42%, settle) at 0.3s/0.5s/0.8s — native CSS springs; 88 elements on 'moveAlong' 12s linear infinite (marquee/orbit).
### the-browser-company (thebrowser.company) — Godly 720p (live now a different cream/serif page w/ Dia/Arc links, WebGL canvas, EB Garamond 28px, ABCDiatypeMono 14px ls 0.15em CTAs, marquee keyframes, prefers-reduced-motion)
- Archived: dark #1a1a1a stage with a single outlined browser-window frame; inside it a SCROLL-DRIVEN SLIDESHOW of single centred sentences (one idea per screen): "This is a web browser." → "It's just a frame, with some buttons and toolbars." → "It's our window to everything on the internet." → UI fragments pile up chaotically (chat bubbles, cookie modal "cookies. Are you cool with that? Okay", maps, ads) → "We love the internet, but it can be overwhelming." → "What if a browser could help us make sense of it all?" → "Could a browser keep us focused, organized and in control?" — then the window falls away to a saturated electric-blue manifesto with highlighted inline links and a 'Join the Waitlist' white pill; serif wordmark in footer. Text enters bottom→centre, exits top (scroll-linked).
### jonnie-hallman (destroytoday.com) — plain system font, heavy illustration per section
- Each project section has its own full-bleed colour world; 'Cushion' section: sky-blue (#3498DB-ish) with flat layered MOUNTAIN RIDGES (3 tones of blue), pine silhouettes, small cloud puffs, scattered tiny stars and a CRESCENT MOON — the night illustration parallaxes as you scroll (ridges move at different speeds). Copy: "I built my own app to bring peace of mind to freelancers". Stripe section: isometric blue staircase + rising orange line. Pencil section on charcoal with product rotating on scroll. Design Town on bottle-green with photo collage.
- Motion: opacity/transform 0.75s cubic-bezier(0.23,1,0.32,1) (easeOutQuint) for reveals; colour 0.35s (0.37,0,0.63,1) (easeInOutSine); transform 1s (0.165,0.84,0.44,1) (easeOutQuart). Shots: sites/jonnie-hallman/d_scroll_07.jpg, d_scroll_08.jpg.
### stripe-press (press.stripe.com) — Three.js, Ivar type family
- Dark warm brown-black (#201819) stage; a vertical STACK OF 3D BOOK SPINES (each real cover art/colour) that scroll-rotates like a shelf; each spine is a full-width link; hovering slides/tilts a book; selecting opens the book to show cover art. Interludes: 'We are as gods' cosmic illustration, 'Beneath the surface' red circle stamp over a dark isometric city. Typography: Ivar Display/Headline/Text serif, small 16-17px uppercase-ish headings, generous leading. CSS: transform 0.4s ease (128 els), 0.3s ease-out (100 els) — book hover tilt; mix-blend on 27 nodes; filters 27.
### 1password-a-vision-of-the-future (Godly 720p, shots/B/video/53_...jpg)
- Deep navy (#0B1E4B-ish) canvas with a single continuous thin glowing LINE (circuit/road) that the scroll follows from section to section — a guiding thread; line-icon doodles (G, f, fingerprint) along it. "Signing in has become a real hassle" with a growing TIMELINE 2000→2010→2020 where login form fields multiply and error toasts pile up (complexity visualised). Then a radial blue glow 'portal' "Say hello to Universal Sign On" and a carousel of app login cards with 1Password key card centred. Pastel-tinted dashboard cards (pink/teal/lavender). Ending: 'Stay in the loop' with two stacked pill CTAs.
### nothing-to-watch (nothing-to-watch.port80.ch) — Three.js, DM Sans
- Gate screen: "There's nothing / to watch" italic 900 40px + 'Continue' button. Then a sphere of thousands of movie posters in black void; idle: sphere drifts and rotates, a random title surfaces with year & genre chips top-left; scroll/drag zooms the camera INTO the sphere (fish-eye wall of posters), selected poster grows centred, info card with synopsis, rating, 'Close'. Concept explicitly "cure decision paralysis" by serving one random pick.
- the-browser-company LIVE (2026): calm single-screen cream (#EEEEE7) page: small circular engraved seal logo, italic EB Garamond 28px line "We're building better ways to use the internet with Dia and Arc." (product names underlined), two mono-caps links w/ tiny icons (ABCDiatypeMono 14px ls 2.1px), mono caps footer row, bottom strip of tiny pixel-art glyphs; "THEME" toggle top-left. Extreme restraint. (sites/the-browser-company/i_s00.jpg)
- pacome-pertant & nothing-to-watch: WebGL scenes don't render under headless swiftshader after gate click → rely on Godly recordings (video/23_pacome-pertant.jpg, img/B-video-01_nothing-to-watch.jpg).
### family (family.co) — Next.js, own 'Family' display face 500 (68px/1.1, ls -0.02em), Inter body
- Archived & live: white page, hero "Your crypto. Family style." surrounded by a confetti of flat chunky colour SHAPES (hearts, stars, gears, blobs, arrows in red/green/blue/yellow) that settle in; live hero text fades/blur-ins late (blank first ~2 s in headless — heavy hydration; anti-pattern).
- Bento feature cards on warm off-white (#FAF9F7 ≈ display-p3 .984 .98 .976): "Easy / Secure / Fast / Powerful / Fun" each with a live micro-demo: 'Backing Up' pill with spinner ring → check, transaction timeline Submitted→Pending→Completed with live timestamp, 'Urgent ~23 secs' gas selector, round emoji tokens carousel. Copy "Family takes fun seriously. Delightful interactions with every tap."
- A calm MASCOT moment: a blue square-blob character with closed eyes meditating (floating, with a padlock) — "Relentless protection. Restful ease." (security = rest, not fear).
- Motion: transform 1s cubic-bezier(0.19,1,0.22,1) (expo-out) on 56 nodes (scroll reveals), 0.22s same curve for hover; 'all .2s ease-out' on 120 nodes; nav pills hover bg 0.2s; marquee 120s linear.
### aside (aside.com) — Next.js, Geist + display font, Three.js canvases
- Hero: real SKY photograph (blue with cumulus clouds) as background; centred "The most intelligent AI assistant, but it's a browser." (display 40-ish px, two lines), black pill 'Download' with dropdown chevron; product window (white, macOS chrome) rises from bottom edge overlapping the sky. Tiny pill 'Backed by Y Combinator' above heading. End CTA: blue-sky gradient card "Crafted for both human and agent. Start using today."
- Keyframes: show-top-mask/hide-bottom-mask (scroll masks), thinking-gradient (AI shimmer), tw-shimmer, caret-blink; all UI transitions 0.15s cubic-bezier(0.4,0,0.2,1). prefers-reduced-motion respected.
### augen (augen.pro) — Nuxt + Lenis, PP Neue Montreal 300/350 only
- Ultra-light grey/black type, tiny sizes (27px headline, 10-16px), floating dark pill nav centred; soft blurred grey profile silhouette hero ("Beyond Humanware."); alternating light grey/charcoal sections; one saturated electric-blue block 'Scientific Evidence'; product (earbud) object over giant thin "Invisible Approach" type in light blue. All transitions plain 'ease' 0.2–0.6s. Restraint/whitespace luxury.
### honk (honk.me) — app sunset ("Honk has been sunset" announcement pill)
- Electric blue (#0088FF) full-bleed; 'Really, / real-time / messaging.' Honk Header 700 52px/64px ls -0.6px, first word in yellow; phone mockup cycling demos (game win confetti, voice waveform, flood of heart/fire emoji reactions) with bouncy yellow flower sticker and pale-blue heart speech bubble overlapping the phone edges.
- Tokens worth noting: --ease-snappy cubic-bezier(0.175,0.885,0.32,1.1) @220ms (slight overshoot), --ease-swift cubic-bezier(0.19,1,0.22,1) @750ms.
### mad (mad.ac) — live redesigned to monochrome minimal (ABC Walter Neue var + InputMono). Archived (card): warm peach→orange gradient canvas with floating soft white OS-like cards (notes, 'Commandments' checklist with ticks, 3D keycap), playful layout.
### reboot (reboot.studio) — Next.js, Inter 500
- Hero IS a paragraph: 40px/64px Inter 500, first sentence ink (#232323), rest 25%-grey; as you scroll words darken one by one (scroll-scrubbed reading progress); inline 3D app icons (Framer logo etc.) and emoji pop in between words ('Book a call ✌'). All 0.5s cubic-bezier(0.4,0,0.2,1); one back-overshoot (0.68,-0.55,0.27,1.55).
### mixpanel (live 2026): plum/aubergine gradient sections, Garnett + ABC Arizona Text Light Italic accent; pill CTAs 12px with trailing chevron circle; many small keyframes (enterUp .4s ease-out, an-cardPop .5s cubic-bezier(0.34,1.4,0.5,1) — springy pop, sparkshimmer 2.2s, caretBlink, drawLine, heatBloom) = product micro-demos animating when in view.
### lovi mobile: 36px/36px H1, badge pill shrinks to 28px height; content identical, single column; floating round button stays bottom-right.
### nev-flynn (nevflynn.com): 500 Internal Server Error at visit time — only Godly recording (bento widgets grid; light→dark theme toggle re-tints every tile).

## 3. Наблюдения по всему каталогу (все 85 записей + 14 карточек)

Каждая запись просмотрена как лента из 8 кадров (листы `shots/B/catalog/sheet_01..15.png`, карточки без видео — `shots/B/catalog/cards_novideo.png`). Заметки по каждому сайту:

- 01 nothing-to-watch: black bg, 3D sphere of film posters; sphere zooms to fill screen (camera dolly into sphere), selected title text overlays top-left. Single object hero, decision-paralysis cure.
- 02 augen: white, soft profile silhouette (blurred grayscale) hero, small type; big 'Invisible Approach' light-blue display type with product image; full-bleed blue section; dark footer w/ lists.
- 03 x-advertising: white; concentric circle diagram w/ black dot; dashed orbit ellipse w/ "Get $25" pill; light->dark section switch at end.
- 04 shopify-editions (winter26): classical painting (renaissance) bg w/ product UI cards floating; huge "B2B"/"Developer" display type over engraving art. Earthy, textured.
- 05 shopify-design: "Make the new normal" huge black type; image collage falls/scatters; red line arc drawing animation; city names cycling big type.
- 06 displace: macOS-desktop metaphor, windows open (notes/terminal/calendar), dock.
- 07 gregor-collienne: floating collage of photos around name, then grid, big centered OVERVIEW/WORK type.
- 08 harry-atkins: huge 'HARRY ATKINS' type letters split H .. A on scroll; project index list.
- 09 interfere: SaaS pastel pink->lilac gradient header, "Ship software that never *breaks*" (serif italic accent word), product UI cards.
- 10 becane-paris: row of tiny full-figure models (collection), hover zooms one figure, others fade ghosted; then full-bleed editorial.
- 11 cathy-dolle: grayscale image stacks scrolling, grid of objects.
- 12 astro-dither: black, pixel/dither neon pink hand + chromatic-aberration starfield, marquee text "YOU CRAZY, SLOW DOWN".
- 13 meech213: off-white canvas, magazine-cover cards tilted & floating, drifting.
- 14 podium: ink-blob morph shapes (liquid) masking photos; black project index list.
- 15 shopify-editions-spring26: dark cinematic scenes (aurora, nebula, glowing 3D), large light words 'Sidekick','Operations','Shop app','Finance' over scene, product cards.
- 16 belen-jones: pastel bg per project, giant outlined repeated type behind rotating 3D box with project images.
- 17 icebug: outdoor photo hero, editorial shoe grid; dark UI.
- 18 orior-ai: white, centered portrait crossfading between faces under 'The new era of influencing'; then dark section.
- 19 dirt: row of circular 3D spheres, white; huge chrome/glass outline 'dirt' wordmark at end.
- 20 avara: BLACK bg, CHARACTER MASCOTS (ghost w/ cap, cloud face, smiley) in a row; each character enlarges & becomes hero of its product section (Lens/GHO/Aave Labs) — character-led product nav. Lottie.
- 21 aave: lavender pastel, phone mockup with balances, "Savings for Everyone"; alternating light/dark rounded panels; FAQ accordion.
- 22 topology: iridescent rainbow contour rings (3D topographic), "Meet us at the edge."; dark sections.
- 23 pacome-pertant: dark, flying cards in 3D space, a cute glossy 3D CHARACTER (round head w/ glowing eyes, holographic) in purple light; white card menu "works about contact".
- 24 area-technology: giant AREA wordmark, magenta lion, rapid identity flips.
- 25 silo: product configurator, prices with -0+ steppers, aluminium parts.
- 26 aside: SKY w/ clouds hero photo, white, "The most intelligent AI assistant, but it's a browser"; ends with blue-sky gradient CTA card "Crafted for both human and agent".
- 27 ragged-edge: rainbow speed-line spectrum hero; case cards incl. pink square with big googly eyes (Marshmallow).
- 28 mintlify: white, faint green gradient lines, product UI.
- 29 unveil: diagonal stacked cards fanning (coverflow), expand to full image.
- 30 superpower: starts black hyperspace streaks; white health sections w/ product objects; ends dark with warm AMBER/ORANGE edge glow (sun-like) "Unlock all the potential your life holds".
- 31 bigpicture-company: oversized grotesk text blocks, marquee lists.
- 32 desktop-fm: grey; 3D CD spinning, green laser lines, then red/blue CD on black; coming-soon card.
- 33 reboot: paragraph-reveal text (grey->black word by word as you scroll) with inline emoji/icons in sentence.
- 34 logan-liffick: calendar grid of colored squares; cards expand to journal entries (photos), playful.
- 35 lovi: white/pastel, face scan hero, phone mockups, AI chat bubbles (pastel gradient), "Pocket cosmetologist Available 24/7", FAQ.
- 36 amie: "Todos, email, calendar. One and done." then SUNSET-SKY gradient bg (peach/blue) with sentence-with-inline-icons "Happy Wednesday! It's 9:58 PM and clear in Canberra. You got 2 emails and 2 meetings today" — floating 3D pastel objects (pills/blobs) drifting; phone & desktop UI.
- 37 authkit: navy-black, glowing UI login cards in 3D perspective grid, soft blue spotlight.
- 38 spring-summer: red/cream; huge red "10"; phone mockups in fashion photos.
- 39 paste: white "Once Again" then colorful pinboard cards fan out; blue/orange gradient feature tiles.
- 40 family: white, scattered playful colourful shapes (blobs, stars) around "Your crypto. Family style."; phone screens; FAQ.
- 41 jp: 3D rotating boxes with project images between bracketed words "(CLARK", then scattered photoreal objects (egg, coffee, steak) playful.
- 42 mixpanel: "Progress is possible" warm peach/orange gradient glowing rounded portal; WARM ILLUSTRATED LANDSCAPE (desert, sunset, pastel) section; navy sections, "It's okay to not have all the answers" (warm empathic copy).
- 43 mike-matas: chronological product showcase, white.
- 44 genius: dark macOS desktop, cursor demo.
- 45 fora: serif split wordmark FO/RA over portraits, color blocks.
- 46 daniel-triendl: grid of vibrant character illustrations (lion, characters), handwritten-ish serif headline w/ inline icon.
- 47 postevand: water carton product 3D, huge wordmark.
- 48 next-js-conf: black, prism with rainbow beams, static-ish hero.
- 49 how-to-talk...: dark stage, a BOOK opens, illustrated cards carousel (pink/red/blue/orange) w/ textured illustrated lettering 'EDUCATE','HEROES','FRIENDS', paper grain.
- 50 heart-aerospace: plane over sky, huge "ES-19".
- 51 atlason: cycling words list (Studio/Furniture/Packaging) fading.
- 52 vitra chair finder: scattered chairs grid filtered by sliders — chairs drift/rearrange as you answer.
- 53 1password future: navy blue, line illustration path, floating UI cards growing in complexity.
- 54 macbook-air: huge AIR type w/ laptops, product reel.
- 55 clou-architects: orbital ring of thumbnails around central preview, ring rotates.
- 56 endel-manifesto: BLACK, thin white LINE ILLUSTRATIONS (heads, body, sound), centered small serif/sans text paragraphs, one hot sunset gradient arc (red/orange/magenta) w/ triangle — a single warm glow moment in a monochrome manifesto; icon row; app store badges. Slow, meditative.
- 57 resident: furniture, white grid.
- 58 zikd: giant outlined ZIKD pill wordmark, glossy 3D purple/red blobs with typography tumbling.
- 59 rainbowkit: wallet modal over gradient that changes color per accent choice (live theming), chips row for accent colors.
- 60 david-heckhoff: warm cream bg, 3D ILLUSTRATED CHARACTER (Pixar-like boy at desk), 'Hi, my name is David.', blue holo scanner scene, card carousel, character returns at contact (character as narrative thread).
- 61 the-browser-company: dark, browser-frame illustration, typewriter sentences "It's just a frame..." "What if a browser could..."; then vivid blue manifesto w/ highlighted links.
- 62 increase: grey/white, "Build your bank." with ghost-grey second word, lime/teal 3D N.
- 63 jonnie-hallman: illustrated section breaks; one is a NIGHT MOUNTAIN landscape with crescent moon (flat illustration, blue).
- 64 basic-geometry: ribbed ceramics orbit around big type.
- 65 nev-flynn: bento grid widgets (map, spotify, twitter, memoji avatar), light->dark theme switch animates all tiles.
- 66 honk: electric blue, "Really, real-time messaging." phone cycling chats/games, bouncy yellow badge.
- 67 unknown-untitled: spare type, metadata as hero ("website, 1440x900px, date, Paris").
- 68 block: orange/cyan liquid gradient + morphing 3D polyhedron.
- 69 jeen-yuhs: VHS glitch, chapter numbers, huge type.
- 71 snog: collage of photos animating across white, huge red condensed captions.
- 72 him-hers: "Total care. Totally different." lilac gradient, hand-held phone, giant ghosted words behind phone; nav words Care/Programs/Shop — active one big black, others pale (scroll-driven).
- 73 twomuch: tumbling white 3D objects + chrome lettering.
- 74 simon-rogers: blue serif text on curved paths, rotating.
- 75 miranda: broadsheet newspaper layout, illustrated portraits, textured paper.
- 76 seksy-planety: neon, huge black/white type with pop-up window cards.
- 80 little-troop: spinning cube with project images.
- 81 schemas-of-uncertainty: dense essay columns, glitching letterforms.
- 82 unlirice: swirling oval photos.
- 83 stripe-press: dark, 3D stack of book spines, scroll flips books; detail page w/ engraving illustration.
- 84 squadeasy: neon green, playful 3D mascot (white dog/ghost) peeking out of headline letters, emoji badges; 'Cool!' playful copy; 'Statements of love' testimonials.
- 85 no-10: dark isometric VOXEL WORLD scrolled across (pixel buildings, trees, Japanese text) — a explorable world map as narrative.
- 86 alt-studios: list of 'Less X / More Y' rising manifesto on white.
- 87 opx-studio: black/white/colored panels, 'Hi Shaan, how are you feeling today?' on phone.
- 88 shivam-sinha: dark, cursor-reactive WebGL light ribbon swirl in spectral colors.
- 92 claudio-guglieri: black, words morph 'Why Don't We Try?' each in different 3D material (orange balls, chrome, puffy).
- (no-video cards) 70 porto-rocha: live clock + newsroom list + poster photo; 77 george-hatton: open book spread w/ blue ghost crowd (soft, grainy riso); 78 friends-of-the-new: B&W photo checker grid, huge serif wordmark on warm off-white; 79 artworld: condensed serif names list + heavy display wordmark; 89 dries-bros: wireframe 3D box + table; 90 mad: WARM PEACH->ORANGE gradient canvas with floating soft white cards (notes, "Commandments" checklist, keycap 3D) — OS-like playful; 91 no-ideas: letters swirling in 2 clusters; 93 julia-johnson: huge 'Julia' + portraits; 94 eduardo-del-fraile: black stage, ceramic gorilla + glowing orange; 95 newtab: pink, huge NewTab; 96 fidele: golden huge type + blue line-drawn cloud/flag nav shapes, orange gradient bottom; 97 ezekiel-aquino: circular score; 98 studio-ba: circle over vertical lines, live clocks; 99 studio-lathe: list + pill tags.

## 4. Извлечённые паттерны (Godly)

### 4.1 Композиция героя — 7 повторяющихся схем
1. **Одно предложение по центру + один объект/сцена** (Endel, Nothing to Watch, Aside, Lovi, Him&Hers, SL). Заголовок 2–3 строки, подзаголовок мелкий, одна-две пилюли-CTA. Сцена (небо, лицо, телефон в руке, шар постеров) занимает 60–100 % кадра, текст — 10–15 %.
2. **Персонаж как навигация/герой** (Avara: 4 персонажа = 4 продукта; David Heckhoff: 3D-мальчик за столом; SquadEasy: собака внутри заголовка; Pacôme: градиентный бюст; Family: медитирующий блоб). Персонаж почти всегда: (а) один стиль на весь сайт, (б) возвращается в нескольких секциях, (в) имеет «состояние покоя» (бобинг, моргание, сон Heckhoff, медитация Family).
3. **Сцена-мир, по которой едет скролл** (Amie — небо через сутки; No.10 — воксельный остров с манифестом на земле; Mixpanel — портал в иллюстрированную пустыню; 1Password — одна светящаяся линия-путь через всю страницу; Jonnie Hallman — свой «мир» на каждую секцию).
4. **Ворота-ритуал до контента** (Endel «Find Out», No.10 «Enter», Pacôme «enter with sound», Nothing to Watch «Continue», How-to-talk — книга, которую надо открыть). Один экран, одна кнопка, тишина; задаёт темп «медленно».
5. **Абзац-герой с прогрессом чтения** (Reboot, Lovi, Him&Hers, Amie): слова темнеют/светлеют по скроллу; в текст вшиты мини-иконки/3D-объекты (Amie: часы, погода, карта, почта; Reboot: 3D-иконки; Lovi: ◉ face scanner).
6. **Огромная типографика + объект** (Heart Aerospace «ES-19», Basic Geometry, ZIKD, Harry Atkins) — доминирующий тренд Godly, но для тёплых/персонажных сайтов почти не встречается.
7. **Одна-вопросная анкета как конверсия** (Superpower: модалка «что привело вас сюда?» с 5 пилюлями; Lovi: «So, do you love the current state of your skin? Yes/No»; Mixpanel: плейсхолдер «What are you building?» → «What is it for?»).

### 4.2 Тайминги и кривые (измерено на живых сайтах)

| Сайт | Кривые (кол-во элементов) | Длительности | Комментарий |
|---|---|---|---|
| Superpower | (0.32,0.72,0,1)×52 — iOS sheet; (0.22,1,0.36,1)×46 — easeOutQuint; (0.25,1,0.5,1)×45; (0.16,1,0.3,1)×23 — expo-out; (0.4,0,0.2,1)×24 | 0.15 / 0.25 / 0.35 / 0.4 / 0.6 s | CTA: padding .25s expo-out + **scale .15s ease-out на нажатие**; keyframes BlurIn/BlurOut |
| Him&Hers | (0.19,1,0.22,1) | 0.6 s transform | opacity 0.2 s easeOutCubic |
| Family | (0.19,1,0.22,1)×98 | 1 s reveals, 0.22 s hover | all .2s ease-out ×120 |
| Honk | snappy (0.175,0.885,0.32,1.1) | 220 ms | swift (0.19,1,0.22,1) 750 ms |
| Jonnie Hallman | (0.23,1,0.32,1) | 0.75 s reveals | colour 0.35 s easeInOutSine (0.37,0,0.63,1); 1 s (0.165,0.84,0.44,1) |
| David Heckhoff | --ease-smooth (.6,0,.25,1) | route .5 s, hover .1–.2 s | токены в :root, prefers-reduced-motion |
| Pacôme Pertant | CSS `linear()` пружина (перелёт до 1.0084 на 42 %) | .3 / .5 / .8 s | нативные CSS-пружины |
| Mixpanel (live) | cardPop (0.34,1.4,0.5,1) | .4–.6 s; shimmer 2.2 s | enterUp .4 s ease-out |
| Reboot | (0.4,0,0.2,1)×104 | 0.5 s | один back-overshoot (0.68,-0.55,0.27,1.55) |
| Squadeasy | ease ×183 | 0.2 s hover, 0.8 s reveal | float translateY 3 s infinite |
| Stripe Press | ease ×475, ease-out ×188 | .1–.4 s | книги: transform .4 s |
| Endel | ease-in-out | 1 s fade | splash → header slideUp |
| Aside / Nothing to Watch / Amie | (0.4,0,0.2,1) | 0.15 s | shadcn/Tailwind-база |
| How-to-talk | ease-in-out | 1 s | книга: bookHover бесконечный бобинг |

Сводка: **вход/раскрытие** — «экспоненциальный выход» (0.16–0.23, 1, 0.3–0.36, 1) на 0.6–1.0 с; **hover** — 0.15–0.25 с; **нажатие** — 0.09–0.15 с с `scale(.98)`/`translateY(1px)`; **перелёт** используют редко и точечно (Honk 1.1, Mixpanel cardPop 1.4, Pacôme `linear()`-пружина). Бесконечные циклы — только медленные (bookHover, float 3 s, marquee 12–120 s, Amie-блобы). prefers-reduced-motion учитывают: Superpower, Heckhoff, Aside, Browser Company, SL (100 %); не учитывают: Lovi, SquadEasy, Family, Honk, Mixpanel.

### 4.3 Скролл-хореография
- **Плавный скролл** Lenis: Lovi, Augen, Heckhoff, Pacôme (+ 10 сайтов каталога). GSAP ScrollTrigger: Superpower.
- **Пиннинг сцены + смена содержимого внутри рамки**: Browser Company (одно предложение на экран внутри рамки браузера), Him&Hers (телефон в руке закреплён, меняются экраны и огромные бледные слова сзади), Heckhoff (камера «ныряет» в монитор).
- **Суточный/цветовой переход как прогресс**: Amie (рассвет → полдень → сумерки → ночь к футеру), Superpower (тёмный гиперпрыжок → белое → тёплый янтарный финал), 1Password (одна линия-нить).
- **Зум через портал**: Mixpanel (градиентная арка → иллюстрация), Nothing to Watch (камера внутрь сферы), SL (спуск через рельефный фон в каталог).
- **Секции-карточки со скруглённым низом**, «поднимающиеся» над следующим (Mixpanel, Aave, Superpower).

### 4.4 Микро-взаимодействия, которые стоит запомнить
- Like/героические микро-демо внутри bento-карточек (Family: «Backing Up» → галочка; таймлайн транзакции с живым временем; селектор «Urgent ~23 secs»).
- Персонаж реагирует на бездействие (Heckhoff — засыпает с «zZ»), на курсор (Heckhoff — следит), на выбор (Avara — выбранный персонаж вырастает, остальные уходят).
- Hover-подсказка-ярлык над персонажем (Avara), курсор-превью проекта над списком (Pacôme).
- Звук как opt-in ритуал (Pacôme «enter with sound», Heckhoff тумблер звука, Avara — Howler).
- Плейсхолдер, задающий вопросы по кругу (Mixpanel), предложение, собранное из живых данных пользователя (Amie: день недели, время, погода, город, письма, встречи).
- Наклейки/стикеры поверх краёв мокапа (Honk), повёрнутые стикеры-статистики (SquadEasy), вращающийся круговой текст вокруг круглой CTA (SquadEasy «Join we →», Pacôme showreel badge).

### 4.5 Типографика (измерено)
| Сайт | Display | Размер/интерлиньяж/трекинг героя (1440) | Мобильный |
|---|---|---|---|
| Lovi | ES Rebond Grotesque 400 | 44/40, −1px | 36/36 |
| Superpower | NB International Pro 400 | 56/56, −0.02em | — |
| Family | Family 500 | 68/74.8, −0.02em | 44/48 |
| Honk | Honk Header 700 | 52/64, −0.6px | 44/52.8 |
| Amie (live) | Inter 700 | 56/64, −0.7px | 28/35 |
| SquadEasy | Black (condensed) 700 caps | 80/80, −2px | 40/40 |
| Pacôme | Indivisible var 500 | 80/80, −4px (меню) | 80/80 |
| Reboot | Inter 500 | 40/64 (абзац-герой) | 30/48 |
| Nothing to Watch | DM Sans 900 italic | 40.8/40.8 | 36/36 |
| Browser Company (live) | EB Garamond italic | 28/33.6 | 28 |
| Stripe Press | Ivar Display/Headline/Text | 16–17.6 заголовки, сериф | — |
| Augen | PP Neue Montreal 300/350 | 27/32.4, −0.02em | 25/30 |
| Endel | Roboto 400 | ~36 центр + 14 текст | — |
Тренд: тесный трекинг (−0.02…−0.05em) и интерлиньяж ≈1.0 у display; серифный курсив как «тёплый» акцент (Interfere *breaks*, Browser Company, Mixpanel ABC Arizona Italic, Stripe Press); рукописный акцент (SquadEasy «Sharpie»). Мобильный display = 0.65–0.8 от десктопа.

### 4.6 CTA (измерено)
- Пилюли r = 999/50/52 px, высота 38–54 px, padding 13–16 × 19–32 px; основной — сплошной (чёрный/белый/бренд), вторичный — 10 % полупрозрачный (Superpower `rgba(255,255,255,.1)`).
- Hover почти везде — смена фона 0.15–0.25 с, **без** подпрыгивания; нажатие — `scale` 0.15 с (Superpower). Тень у светлых CTA мягкая и низкоконтрастная: Him&Hers `0 8px 30px rgba(0,0,0,.06)`, Lovi двойная `0 5px 20px rgba(0,0,0,.1)` + контактная.
- Ворота-CTA (Endel «Find Out» серая плашка r10; Pacôme «enter with sound» белая пилюля; Nothing to Watch белый блок) — нарочно скромные.
- Круглая CTA с вращающимся текстом (SquadEasy), пилюля с иконкой-шевроном в кружке (Mixpanel 2026).

### 4.7 Текстура, зерно, свет
- Зерно/бумага: How-to-talk (бумажная фактура + полутон на иллюстрациях, диагональный «мазок» на фоне), Miranda (газетная бумага), George Hatton (riso-зерно), Shopify Editions (гравюры/живопись).
- Свет как событие: Endel — единственный тёплый «восход» среди чёрно-белой графики; Superpower — янтарный контровой свет в финале; Mixpanel — градиентный портал; Authkit — голубой прожектор; SL — медленный голубой «блик», путешествующий за рельефом (30 с).
- Небо как фон-состояние: Amie (суточный цикл), Aside (фото неба), Jonnie Hallman (ночные горы с месяцем, слоистый параллакс, звёзды-точки), Endel (звёзды-точки, месяц линией).
- Матовые пастельные 3D-объекты, дрейфующие в глубине (Amie, ZIKD, Twomuch) — только как фон, не кликабельны.

## 5. SL UI Library (sltowl.github.io/sl-ui-library + github.com/SLtowl/sl-ui-library)

### 5.1 Что это
Версия 1.2.4: **388 интерактивных компонентов** (390 вариантов экспорта), 10 категорий: Buttons 79, Toggles (id `selection`) 52, Inputs 51, Data display 42, Checkboxes 36, Sliders 35, Menus 26, Navigation 24, Feedback 23, Overlays 20. Каждый пакет — vanilla HTML/CSS/JS без зависимостей + React/Next.js-обёртки, шрифт Instrument Sans (OFL) внутри пакета, инлайн-SVG иконки. Распространяется как AI-плагин (Claude Code/Codex/Hermes) с CLI `library.mjs`. MIT.
Репозиторий: 6269 файлов (5900 — `public/packages`), 1571 jsx, 1013 js, 932 mjs, 413 css, 394 woff2; тесты Playwright в `tests/`, отчёты по каждой партии в `docs/development/reports/*.md`.

### 5.2 Сайт: герой и переход в каталог (`shots/B/sl/`)
- **Герой** (`home_1440.png`, `m_hero.jpg`): белый «рельеф» — фотография мягких глянцевых волн (`relief-bg-neutral-v2.png`, 1.4 МБ), по центру «Made to interact» (Plus Jakarta Sans 600, трекинг −0.05em) и одна кнопка «Explore library». Больше ничего.
- **Живой свет**: SVG-эллипс с голубым радиальным градиентом (#83b4ff → прозрачный) едет вдоль кромки волны по пути `M0 550 C210 550 …` **за** передним краем (clip-path), WAAPI, `duration 30s`, `alternate`, `ease-in-out`, начальная фаза 0.65, интенсивность 0.3; выключается при `prefers-reduced-motion`, `forced-colors`, скрытой вкладке и вне вьюпорта. Токены: `experiments/library-shell/ambient-motion.tokens.json`.
- **CTA из трёх слоёв** (`cta_states.jpg`): `.explore-base` (тень-подложка #d9dee5, `0 14px 25px #4b586123, 0 3px 5px #4b586111`) + `.explore-face` (градиент 160° #fff→#f3f5f8, бордер #e0e5ec, inset-блик, **поднята на −3px**) + `.explore-light` (блик под курсором: радиальный голубой 150×95 px в точке указателя + диагональный «отблеск», сила = smoothstep от расстояния до кнопки в радиусе 160 px — кнопка «чувствует» курсор ещё до наведения). Hover: `scale(1.07)` 200 ms `cubic-bezier(.2,0,0,1)`, лицо −4px; active: `scale(1.01)`, лицо опускается в 0 за 100 ms (физическое «нажатие клавиши»). Фокус с клавиатуры = тот же вид, что hover. Reduced-motion: без трансформаций, только opacity .9.
- **Курсор**: браузерный (без DOM-follower) кастомный SVG-стрелка 14×18, на интерактивных — 17×22; отключается при reduced-motion/forced-colors/тач.
- **Переход «Explore library»** (`sheet_enter.jpg`, 18 кадров по ~150 мс): реальный скролл документа к каталогу за **1250 ms** по «асимметричному smootherstep» (`t³(6t²−15t+10)` от `1−(1−t)^2.25`); заголовок гаснет к 25 %; фон-рельеф едет вверх на 18 % и масштабируется до 1.22, гаснет 28–98 %; превью компонентов «выпрыгивают» с шагом **120 ms**: scale 0.68 → 1.045 (пик на 60 %) → 1, длительность 320 ms; затем сборка интерфейса: шапка с шагом 45 ms, категории с 130 ms по 22 ms, заголовок 200 ms, карточки 270 ms по 30 ms, инспектор 430 ms, смещение 8 px. Колесо мыши мгновенно перехватывает анимацию («пользовательский скролл всегда главнее»). Возврат — 950 ms. Токены: `scroll-motion.tokens.json`.
- **Каталог** (`d_catalog_full.jpg`, `m_catalog_direct.jpg`): фон #f6f7f8, шапка-плашка r≈16 с поиском «Find a component», слева рейка из 11 иконок категорий (активная — #e5edfc), заголовок «Components 388», фильтры-чипы, сетка 3×N карточек: верх — сцена-превью с градиентом (радиальный #fafbfd + 145° #f0f2f6→#e7ecf3), метка «SL ORIGINAL», три точки палитры (светлая/графит/синяя) — перекрашивают живой компонент без перемонтажа; низ — имя, категория, «View code </>». Hover карточки: тень `0 8px 22px #1d35530b`. Клик по превью = работа самого компонента (тоггл включается прямо в карточке). Длительности шелла: short 180 ms, medium 320 ms, page 520 ms, ease `cubic-bezier(.2,0,0,1)`.
- **Showcase / Studio motion** (`showcase_studio4.jpg`): «Made to be felt. Small details. Real interactions.» — 6 живых карточек на тёплом #f4f3f0; студийный фильм: графитовые панели в CSS-3D изометрии на кремовом фоне, компоненты сами переключаются (Save→Saved, Like→Liked, рейтинг, тема, вкладки) — без курсора.

### 5.3 Дизайн-контракт компонентов (из репозитория и замеров)
- Палитра по умолчанию в пакетах — **нейтральный графит** (#222/#2e2e2e/#3f3f3f, текст #fafafa), серые акценты; в каталоге — светлая «стальная» тема. Все цвета — семантические переменные (`--action-*`, `--field-*`, `--sl-*`, `--dd-*`, `--toggle-*`), перекраска = переопределение переменных.
- Статический анализ **всех 219 уникальных CSS** пакетов: `prefers-reduced-motion` — в 219/219 (100 %), `forced-colors` — повсеместно. Кривые: `cubic-bezier(.22,1,.36,1)` ×198 (основная, easeOutQuint), `(.4,0,.2,1)` ×58, `(.22,.61,.36,1)` ×40, `(.2,0,0,1)` ×39, `(.05,.7,.1,1)` ×5. Длительности (частота): **180 ms ×451, 220 ×328, 200 ×182, 300 ×166, 160 ×142, 360 ×136, 240 ×119, 260 ×102, 280 ×83, 340 ×75, 100 ×73, 380 ×67** … максимум ≈480–650 ms. Радиусы: 10 px ×399, 14 ×308, 50 % ×215, 12 ×199, 8 ×181. Ключевых кадров всего 9 видов (pending-wash 0.16→0.48, sl-everyday-arrive translateY 6px→0, check-draw, fb-breathe точки-«дыхание» −4 px, spin/shimmer) — правило проекта: **«никакого декоративного бесконечного движения»** (`docs/development/parallel-batches.md`), всё обратимо.
- Motion-тэги каталога (388 шт.): Soft press 152, Reversible reveal 94, Soft selection 51, Reversible feedback 25, Soft feedback 20, Reversible field focus 20, Immediate range tracking 14, Switch travel 11, Reversible selection 10, Reversible panel reveal 10, Soft local reveal 10, Reversible fade 10, Smooth validation 10, State transition 7, Check draw 6, Fade-through 4, Label fade 3, Floating label 3, …, Heart fill, Lid motion, Shackle close, Plus to check, Arrow to check, Progress to check, Ribbon fill, Slash dissolve, Icon morph.
- **Канонический пример — Like** (`packages/like/buttons.css`, `buttons.js`):
  - поверхность: hover `translateY(-2px)` + светлее + тень `0 6px 12px -8px #00000047`, 350 ms `(.22,1,.36,1)`; active `translateY(1px) scale(.98)` за **120 ms**; фокус — `outline 2px`, `offset 6px`;
  - «заливка» сердца — `clip-path: inset(100% 0 0 0) → inset(0)` 480 ms снизу вверх; фон-«wash» 650 ms;
  - подпись: старая гаснет 180 ms → текст меняется → новая проявляется 300 ms (WAAPI, прерываемо с текущей opacity);
  - сердце: `scale .9 → 1.14 → .985 → 1` за 620 ms при включении, мягче (`.94 → 1`, 420 ms) при выключении — **асимметрия «включил — праздник, выключил — тихо»**;
  - `aria-pressed`, `role=status` текст «Liked. Click again to undo.», reduced-motion → мгновенно.
- Тоггл темы (`theme-toggle`): ползунок 580 ms `(.22,.61,.36,1)`, иконка солнца проявляется с задержкой 150 ms; колокольчик: волны гаснут 340 ms с задержкой 140, перечёркивание рисуется `stroke-dashoffset` 420 ms с задержкой 100.
- Hold-to-confirm: удержание 1.2 с (500–5000 настраивается), заливка `scaleX` слева, отпускание/уход/Escape отменяют; с клавиатуры — без таймера, обычное подтверждение.
- Контракт контроллера: `mount`/`mountPreview`, `reset()`, `destroy()` идемпотентны, async-колбэки с `AbortSignal`, демо никогда не изображает успешный серверный ответ, каждое действие сопровождается строкой статуса в `aria-live`.

### 5.4 Что показали 6 снятых состояний × 388 компонентов (`shots/B/sl/states/`)
- **Hover**: почти у всех кнопок — подъём на 1–2 px и чуть светлее; у полей — светлее рамка; у тумблеров/чекбоксов — едва заметно.
- **Press** (110 мс): кнопки «проседают» (`scale .98`, +1 px), у составных — только поверхность, подпись остаётся.
- **+150 мс после клика**: у кнопок с результатом подпись в середине «перехода» (полупрозрачна или пустая — fade-through), иконка в промежуточной форме (Download — прогресс, Like — сердце в пульсе).
- **+900 мс**: новое устойчивое состояние со сменой глагола: Copy → «Try again» (буфер недоступен в headless — компонент честно сообщает), Like → «Liked», Download → «Complete», Bookmark → «Bookmarked», Play → «Pause», Delete → «Deleted», Save → «Saving…», Notifications On → Off (колокольчик перечёркнут). Тумблеры: ползунок доехал, подпись статуса сменилась (On/Off, Light/Dark, Playing/Muted). Чекбоксы: галочка/крест/звезда/сердце рисуются за 150–300 мс. Меню/оверлеи: открыты (панель с overline-заголовком, разделители, иконки), модалка с затемнением фона, drawer справа, sheet снизу, popover под триггером. Feedback: прогресс, реконнект («Reconnecting» → «You are connected»), retry («Trying again» → «Files are ready»), skeleton → «Loading…».
- **Tab-фокус**: везде видимое двойное кольцо (outline 2 px со смещением 4–6 px) — фокус всегда виден, но не кричит.
- Ошибки съёмки: 0 после повторного прогона (первые 10 кнопок и Tree navigation перегнаны отдельно).

### 5.5 Что делает SL «премиальным» (наблюдения)
1. Свет и материал вместо цвета: белый рельеф, кнопка из трёх физических слоёв, блик под курсором.
2. Одна медленная фоновая петля (30 с), всё остальное — ответ на действие; ни одной декоративной бесконечной анимации в 388 компонентах.
3. Короткие, «мягкие» длительности 160–360 мс с одной основной кривой `(.22,1,.36,1)`; нажатие быстрее отпускания.
4. Каждое действие = смена глагола + строка статуса, состояние всегда обратимо («Click again to undo»).
5. 100 % reduced-motion и forced-colors; пользовательский скролл всегда прерывает автоматическую анимацию.

## 6. Ключевые скриншоты (самые информативные)
- `img/B-video-amie_key4.jpg` — Amie (архив): небо-сутки, живое предложение с инлайн-иконками, пастельные 3D-блобы, карточка Pomodoro.
- `img/B-sites-endel-manifesto-i_s02.jpg` — Endel: единственный тёплый «восход» в чёрно-белом линейном манифесте.
- `img/B-sites-david-heckhoff-sheet_iscroll.jpg` — Heckhoff: 3D-персонаж, сканер-сцена по скроллу, персонаж засыпает («zZ») при бездействии.
- `img/B-video-84_squadeasy.jpg` и `img/B-video-20_avara.jpg` — маскот внутри заголовка; персонажи как навигация.
- `img/B-sl-sheet_enter.jpg` + `img/B-sl-cta_states.jpg` + `img/B-sl-states-states_00.jpg` — SL: переход в каталог, трёхслойная кнопка hover/press, 6 состояний кнопок.
- Ещё: `img/B-video-49_how-to-talk-to-white-kids-about-racism.jpg` (книга с текстурными иллюстрациями), `img/B-video-42_mixpanel.jpg` (портал → иллюстрация), `img/B-sites-jonnie-hallman-d_scroll_08.jpg` (ночные горы с месяцем), `img/B-video-53_1password-a-vision-of-the-future.jpg` (линия-нить), `img/B-video-01_nothing-to-watch.jpg`.

## Приложение A. Полный каталог Godly → recent.design / Websites (99 из 99 позиций, лента `websites`, сортировка recent)

Колонки: № · сайт · категория · стиль-теги Godly · описание Godly · палитра (5 доминирующих цветов из кадра записи) · визуальная лента (8 кадров записи) или карточка.

| № | Сайт | Кат. | Теги | Описание | Палитра | Кадры |
|---|---|---|---|---|---|---|
| 1 | [Nothing to Watch](https://nothing-to-watch.port80.ch/) | entertainment | Dark, Radix UI, Transitions, 3D, Interactive, Animation | A movie discovery app that presents a spinning 3D sphere of film posters, surfacing random titles with ratings, genres, and synopses to cure decision paralysis. | #070706 #332D29 #584E46 #786F64 #241919 | `godly_frames/rows/01_nothing-to-watch.png` |
| 2 | [Augen](https://augen.pro/?ref=godly) | health | GSAP, Minimal, Clean, 3D, Big Background Image, Large Type, Long Scrolling, Lenis, PWA, Startup, AI | Augen Pro is an Italian AI-driven wearable health tech startup engineering neural and sensory devices designed to enhance everyday human life. | #0D0E0F #F5F5F6 #0A75DD #CFCFD0 #2B2929 | `godly_frames/rows/02_augen.png` |
| 3 | [X Advertising](https://business.x.com/en/advertising) | saas | Base UI, Motion, Typographic, Geometric, Minimal, Clean, Large Type | A stark X Ads landing page mixing minimalist typography, geometric visuals, and light-to-dark sections to promote business advertising tools. | #FCFCFC #030303 #D4D4D4 #2A2A2A #B5B5B5 | `godly_frames/rows/03_x-advertising.png` |
| 4 | [Shopify Editions](https://www.shopify.com/editions/winter2026) | ecommerce | Muted, Earthy, Scrolling Animation, Cart Functionality, Typographic, Big Background Image, Large Type, Editorial, Textured, Long Scrolling, Lenis, Three.js, Theatre.js | An editorial Shopify launch page blending classical artwork with bold product storytelling across commerce, AI, and developer updates. | #D9DACE #372F28 #F6F7EF #131516 #4D4D43 | `godly_frames/rows/04_shopify-editions.png` |
| 5 | [Shopify Design](https://shopify.design/) | ecommerce | Transitions, Scrolling Animation, GSAP, Typographic, Minimal, Clean, Large Type, Light, Three.js, Showcase, Design | A bold, minimalist showcase of Shopify’s design culture, public conversations, and curated work samples. | #FDFDFD #050707 #CBCFD4 #AEAEAE #4E4F4D | `godly_frames/rows/05_shopify-design.png` |
| 6 | [Displace](https://displace.agency/) | agency | Dark, Gradient, Motion, Minimal, Retro, Interactive | A Mac-inspired agency site that turns the homepage into an interactive desktop with apps, notes, and terminal demos. | #211D23 #FAFAFA #492121 #4E4C51 #686970 | `godly_frames/rows/06_displace.png` |
| 7 | [Gregor Collienne](https://gregorcollienne.com/) | photography | Typographic, Minimal, Clean, Large Type, Editorial, Portfolio | A minimalist photography portfolio that presents editorial portraits, landscapes, and commercial work through a floating image collage and bold typographic navigation. | #F4F3F0 #0D0B0C #6F6E6B #B2B1A7 #54524D | `godly_frames/rows/07_gregor-collienne.png` |
| 8 | [Harry Atkins](https://harryjatkins.com/) | portfolio | Transitions, Typographic, Minimal, Clean, Large Type, Editorial, Light | A sparse portfolio showcasing large typography, project indexes, and an understated personal introduction, with a monochrome toggle for project previews. | #FCFCFC #101010 #D0D0D0 #2E2E2E #B0B1B2 | `godly_frames/rows/08_harry-atkins.png` |
| 9 | [Interfere](https://interfere.com/) | saas | Pastel, Gradient, Base UI, Radix UI, Motion, Typographic, Minimal, Clean, Large Type, PWA | A polished SaaS landing page for app issue detection and triage with crisp typography, soft gradients, and product UI mockups. | #FCFBFB #D4D4D4 #F0D8DE #B5B2B3 #949394 | `godly_frames/rows/09_interfere.png` |
| 10 | [Becane Paris](https://www.becaneparis.com/) | ecommerce | Transitions, Motion, Cart Functionality, Typographic, Minimal, Clean, Big Background Image, Large Type, Editorial, Three.js, PWA | A minimalist fashion shop presenting technical womenswear through clean product browsing and bold editorial lookbook imagery. | #F5F5F5 #0B0909 #D6D5D3 #2E2B27 #BEB5B1 | `godly_frames/rows/10_becane-paris.png` |
| 11 | [Cathy Dolle](https://www.cathydolle.com/) | portfolio | Muted, GSAP, Experimental, Minimal, Clean, Interactive, Editorial, Lenis, Three.js | A stark, minimalist portfolio gallery that showcases image studies, fashion objects, and experimental visual compositions. | #FEFEFE #D3D3D3 #0B0B0C #B1B1B1 #2D2D2E | `godly_frames/rows/11_cathy-dolle.png` |
| 12 | [Astro Dither](https://astrodither.robertborghesi.is/) | art | Dark, Vibrant, Neon, GSAP, Experimental, 3D, Interactive, Animation, Textured, Howler.js, Three.js, PWA | An experimental audiovisual site built around a pixelated neon hand, glitch effects, and reactive motion on a black background. | #090A0A #292B2A #565559 #1A1C1A #6B646C | `godly_frames/rows/12_astro-dither.png` |
| 13 | [Meech213](https://www.meech213.com/) | portfolio | Transitions, Scrolling Animation, GSAP, Minimal, Clean, Editorial, Light, Lenis, Three.js | A fashion-forward portfolio site that presents editorial imagery as floating print-style cards across a minimal canvas. | #F4F3EE #0E1010 #2C2826 #B4B0AA #D3D0CA | `godly_frames/rows/13_meech213.png` |
| 14 | [Podium](https://podium.global/) | agency | Transitions, Scrolling Animation, GSAP, Typographic, Minimal, Large Type, Long Scrolling, Lenis, Three.js | A striking sports-focused agency site with kinetic project showcases, bold typography, and a stark black-and-white framework punctuated by colour photography. | #FEFEFE #020202 #585855 #312F2B #D4D4D4 | `godly_frames/rows/14_podium.png` |
| 15 | [Shopify Editions Spring ’26](https://www.shopify.com/editions/spring2026) | ecommerce | Dark, Gradient, Experimental, 3D, Large Type, Editorial, Long Scrolling, Lenis, Three.js, Theatre.js, Showcase | An immersive Shopify Editions showcase with cinematic visuals, dark scenes, abstract 3D imagery, and feature-led product storytelling. | #0A0A0B #222C2E #4F4F56 #F6F6F6 #6D6B72 | `godly_frames/rows/15_shopify-editions-spring-26.png` |
| 16 | [Belen Jones](https://www.belenjones.com/) | portfolio | Pastel, Transitions, GSAP, Typographic, 3D, Large Type, Editorial, Three.js | A striking portfolio that pairs oversized typography with 3D editorial project showcases and shifting pastel scenes. | #E1D1D6 #0C0C0C #7C656E #C6CCE2 #A18B92 | `godly_frames/rows/16_belen-jones.png` |
| 17 | [Icebug](https://www.icebug.com/en-GB?ref=minimal.gallery) | ecommerce | Dark, Earthy, Cart Functionality, Clean, Big Background Image, Large Type, Editorial | Icebug’s homepage pairs outdoor footwear imagery with a bold editorial hero and simple shopping navigation. | #272827 #4C4F49 #8B9092 #151714 #6D6F6A | `godly_frames/rows/17_icebug.png` |
| 18 | [Orior AI](https://www.oriorai.com/) | ai | Radix UI, Transitions, Motion, Minimal, Clean, Large Type | A clean AI landing page for creating consistent photorealistic characters across photos and video, with a striking portrait hero. | #F6F7F1 #020202 #D0AC92 #BA8C6E #2F2B26 | `godly_frames/rows/18_orior-ai.png` |
| 19 | [dirt](https://dirtverse.co/) | agency | Motion, Minimal, Clean, 3D, Animation, Large Type, Editorial, Framer Sites, Lenis | A bold studio site for Dirt that pairs large typography with animated 3D visuals and a curated portfolio of real-world brand work. | #FDFEFE #D4D5D8 #0A090A #B4B1B3 #2B2C2D | `godly_frames/rows/19_dirt.png` |
| 20 | [Avara](https://avara.xyz/) | web3 | Dark, Vibrant, Transitions, Minimal, Playful, Illustrative, Howler.js, LottieFiles, Showcase | A dark interactive showcase for Avara that turns its ecosystem products into playful character-style illustrations with slick motion. | #020202 #FAFBFC #2B2E2E #D3FAFC #8AFDA4 | `godly_frames/rows/20_avara.png` |
| 21 | [Aave](https://aave.com/) | finance | Pastel, Gradient, Motion, Typographic, Minimal, Clean, Large Type, 3D Illustration, Long Scrolling, Web3 | A polished DeFi homepage that showcases Aave’s savings, borrowing, and developer tools with a clean product-led layout. | #FAF9FD #151515 #DCD6FB #28282A #D2D1D3 | `godly_frames/rows/21_aave.png` |
| 22 | [Topology](https://www.topology.vc/) | finance | Pastel, Gradient, Scrolling Animation, Experimental, Minimal, 3D, Large Type | An immersive venture firm site that pairs elegant 3D visuals with a clear focus on AI, robotics, neurotech, and scientific discovery. | #151515 #E7EBEA #D2D4D3 #6E6E6E #8B8D90 | `godly_frames/rows/22_topology.png` |
| 23 | [Pacôme Pertant](https://pacomepertant.com/) | portfolio | Dark, Gradient, Neon, Transitions, GSAP, Experimental, 3D, Playful, Interactive, Animation, Large Type, Lenis, Howler.js, LottieFiles, Three.js, PWA, Motion | An immersive dark portfolio that presents Pacôme Pertant’s motion and sound work through a playful 3D showreel and interactive project view. | #0A0A0B #071441 #29316A #122557 #4D4891 | `godly_frames/rows/23_pacome-pertant.png` |
| 24 | [Area Technology](https://www.area.tech/) | agency | Vibrant, Typographic, Experimental, Minimal, Clean, Large Type, Portfolio, Case Study | A sleek design studio site that showcases advanced visual technology through bold identity work and vivid experimental imagery. | #FEFEFE #A6B8C4 #CFD4D8 #CB0272 #080808 | `godly_frames/rows/24_area-technology.png` |
| 25 | [Silo](https://www.silosilosilo.com/) | ecommerce | Muted, GSAP, Cart Functionality, Geometric, Minimal, Clean, 3D, Lenis, Swiper | A minimalist storefront for a modular aluminum lid system, using soft product imagery and a restrained monochrome layout to showcase the parts clearly. | #FEFEFE #CBCBCB #B1B2B1 #92918F #6C6A69 | `godly_frames/rows/25_silo.png` |
| 26 | [Aside](https://aside.com/) | ai | Pastel, Gradient, Base UI, Motion, Minimal, Clean, Light, Productivity | A polished AI browser landing page that showcases autonomous web tasks, local memory, and secure login handling for agents. | #FBFCFC #D4F3F9 #D3D4D4 #B0EEFA #90E4F9 | `godly_frames/rows/26_aside.png` |
| 27 | [Ragged Edge](https://raggededge.com/) | agency | Vibrant, Gradient, GSAP, Typographic, Minimal, Large Type, Editorial, Long Scrolling, Lenis, Three.js, Tempus, Htmx, Portfolio, Case Study | A striking branding agency homepage that pairs animated spectrum visuals with polished case studies and a confident editorial layout. | #FDFDFD #0B100C #CDCEC9 #292C1C #EEE7DB | `godly_frames/rows/27_ragged-edge.png` |
| 28 | [Mintlify](https://www.mintlify.com/) | ai | Gradient, Base UI, Radix UI, Motion, Minimal, Clean, Large Type, Light, Long Scrolling, SaaS | A polished landing page for Mintlify that positions self-updating documentation as the knowledge layer for AI agents and enterprise teams. | #FCFDFC #CFD0CE #B3B3B2 #E25836 #0C0E0E | `godly_frames/rows/28_mintlify.png` |
| 29 | [UNVEIL®](https://unveil.fr/) | agency | Vibrant, Transitions, Experimental, Minimal, Light, Portfolio, Design | A French creative studio showcases its portfolio through cascading diagonal stacked cards that expand into immersive full-screen project visuals. | #F8F8F8 #BEB2A8 #B39D85 #D3D0CD #787072 | `godly_frames/rows/29_unveil.png` |
| 30 | [Superpower](https://superpower.com/) | health | Scrolling Animation, Big Background Image, Large Type, Editorial | A longevity clinic website blends cinematic amber photography with fast scroll animations to present personalized whole-body health programs. | #FDFDFD #020201 #D1D1D1 #31302F #737170 | `godly_frames/rows/30_superpower.png` |
| 31 | [Bigpicture Company](https://www.bpco.kr/) | agency | Typographic, Experimental, Minimal, Large Type, Editorial | A Seoul creative agency showcases offline marketing projects through bold oversized type, scrolling marquee text, and editorial photography. | #EEEEEE #0B0909 #D3D4D5 #B0B1B3 #909191 | `godly_frames/rows/31_bigpicture-company.png` |
| 32 | [Desktop.fm](https://desktop.fm/) | music | Vibrant, Neon, Transitions, Experimental, Minimal, 3D, Animation, Startup | A coming-soon landing page for Desktop.fm featuring an animated 3D CD that spins, tilts, and changes color as neon green laser lines sweep across light and dark backgrounds. | #B4BBBC #000101 #D3D4D4 #082F16 #959796 | `godly_frames/rows/32_desktop-fm.png` |
| 33 | [reboot](https://reboot.studio/) | agency | Muted, Scrolling Animation, Typographic, Minimal, Clean, Large Type, Light, Design | A Barcelona-based studio offering world-class marketing sites for software startups, blending design, engineering, branding, and 3D at a weekly rate. | #FCFCFC #D3D4D3 #AFAFAF #939393 #060D10 | `godly_frames/rows/33_reboot.png` |
| 34 | [Logan Liffick](https://loganliffick.com/) | personal | Vibrant, Minimal, Playful, Interactive | A personal site arranging blog posts in a colorful calendar grid where expandable cards reveal short everyday life entries. | #F0F0F1 #27272A #CDD1D3 #B8B6B5 #4A4B49 | `godly_frames/rows/34_logan-liffick.png` |
| 35 | [Lovi](https://lovi.care/) | health | Pastel, Gradient, Transitions, Minimal, Clean, Large Type, Light, AI | Lovi is a skincare app landing page that combines AI face scanning, ingredient safety checks, and a 24/7 chat assistant to deliver science-backed personalized routines. | #F7F7F6 #D3D0CF #B2B2B1 #E3DCE9 #939191 | `godly_frames/rows/35_lovi.png` |
| 36 | [Amie](https://amie.so/) | product | Pastel, Gradient, Radix UI, Clean, 3D, Playful, Large Type, Productivity | Amie brings together todos, email, and calendar in one polished Mac and iOS app with natural language scheduling and helpful widgets. | #B1B3AE #F0EFF1 #101010 #D0B5BC #6CACDA | `godly_frames/rows/36_amie.png` |
| 37 | [AuthKit](https://www.authkit.com/) | saas | Dark, Minimal, Clean, Large Type, Technology | A sleek dark marketing site showcasing AuthKit's customizable login UI with support for SSO, MFA, magic links, and social login. | #060912 #161B29 #2F374A #EEF1F8 #4B5871 | `godly_frames/rows/37_authkit.png` |
| 38 | [Spring/Summer](https://springsummer.dk/) | agency | Typographic, Large Type, Editorial, Portfolio, Design | A Copenhagen design agency marks its tenth anniversary with a striking red and cream portfolio featuring work for luxury fashion and finance clients. | #F2ECDB #040707 #D0D0CA #B5AFA7 #252C2D | `godly_frames/rows/38_spring-summer.png` |
| 39 | [Paste](https://pasteapp.io/) | product | Vibrant, Gradient, Minimal, Clean, Productivity | Paste 4.0 is a polished clipboard manager for Mac and iPhone that stores your full copy history in colorful pinboards with resizable windows and M2-optimized performance. | #FAF9FA #282627 #4B4954 #CFD1D4 #ED8220 | `godly_frames/rows/39_paste.png` |
| 40 | [Family](https://family.co/) | crypto | Vibrant, Minimal, Clean, Playful, Illustrative, Web3 | Family is an Ethereum wallet for iOS with a clean mobile UI that makes sending tokens and managing NFTs feel effortless. | #FDFDFC #D0CFCE #B4B2B2 #2D2D2D #919191 | `godly_frames/rows/40_family.png` |
| 41 | [JP](https://www.jp.works/) | portfolio | Transitions, Typographic, Clean, 3D, Playful, Large Type, Light, Design | JP Silva's personal portfolio blends 3D rotating template previews with scattered playful objects and a clean about section. | #FCFCFC #D7D6D6 #273034 #717171 #8D8E8D | `godly_frames/rows/41_jp.png` |
| 42 | [Mixpanel](https://mixpanel.com/home/) | saas | Gradient, Clean, Illustrative, Large Type | Mixpanel's homepage blends warm gradient illustrations with deep navy sections to highlight its self-serve analytics platform trusted by Netflix and Pinterest. | #F4F2F3 #180932 #F1D4CE #F3B0A7 #302248 | `godly_frames/rows/42_mixpanel.png` |
| 43 | [Mike Matas](https://mikematas.com/) | portfolio | Minimal, Clean, Light, Case Study, Design | A clean, chronological portfolio from designer Mike Matas spanning his work on the original iPhone, Nest thermostat, Facebook Paper, and beyond. | #FCFCFC #050605 #D0D2D1 #3E302A #919087 | `godly_frames/rows/43_mike-matas.png` |
| 44 | [Genius](https://genius.design/) | ai | Dark, Transitions, Minimal, Large Type, Startup, Design | A dark macOS-style coming-soon page for an AI design tool featuring animated canvas previews and a waitlist signup form. | #141316 #272729 #4C4C4F #6D6E71 #363944 | `godly_frames/rows/44_genius.png` |
| 45 | [Fora](https://www.fora-concept.com/) | agency | Muted, Typographic, Large Type, Editorial | A Vienna and Berlin strategy agency presents its team and campaigns through bold serif type, muted color blocks, and portrait photography. | #FAFAF9 #D4ADE2 #964335 #8DC8DE #235046 | `godly_frames/rows/45_fora.png` |
| 46 | [Daniel Triendl](https://www.danieltriendl.com/) | portfolio | Vibrant, Transitions, Typographic, Geometric, Playful, Illustrative, Large Type, Textured | Portfolio site for Austrian illustrator Daniel Triendl, showcasing vibrant character-driven work for clients like Adobe, Airbnb, Facebook, and Monocle Magazine. | #FCFCFC #161514 #D1D0D2 #B1B1B2 #585555 | `godly_frames/rows/46_daniel-triendl.png` |
| 47 | [Postevand](https://postevand.com/) | food-drink | Muted, Cart Functionality, Typographic, Minimal, Clean, Large Type, 3D Illustration, Light | Postevand is a Scandinavian tap water brand sold in 96.6% plant-based cartons, with a clean minimal site showcasing its sustainable packaging and 3% climate pledge. | #FBFBFB #D5D5D9 #967E60 #B0B0B3 #959291 | `godly_frames/rows/47_postevand.png` |
| 48 | [Next.js Conf](https://nextjs.org/conf) | technology | Dark, Vibrant, Gradient, Minimal, 3D, Animation, Large Type | A dark event landing page for Next.js Conf features an animated 3D prism casting rainbow light beams across a black background with an email signup. | #08090A #272629 #4A4C50 #41393C #68696A | `godly_frames/rows/48_next-js-conf.png` |
| 49 | [How to Talk to White Kids about Racism](https://howtotalktowhitekidsaboutracism.com/) | education | Dark, Transitions, Playful, Colourful, Illustrative, Interactive, Large Type, Textured | A card carousel gives parents and kids simple illustrated tips on diversifying heroes, self-education, challenging intolerance, and building friendships across racial lines. | #070807 #CCA99E #474E9A #717EBB #B5938D | `godly_frames/rows/49_how-to-talk-to-white-kids-about-racism.png` |
| 50 | [Heart Aerospace](https://www.heartaerospace.com/) | startup | Muted, Typographic, Minimal, Clean, 3D, Big Background Image, Large Type | Heart Aerospace showcases their ES-19 electric regional airliner through cinematic renders and bold typographic scrolling that highlights zero emissions goals. | #FCFCFC #6C687C #B3B1B8 #94909E #D0D0D4 | `godly_frames/rows/50_heart-aerospace.png` |
| 51 | [Atlason](https://atlason.com/) | agency | Typographic, Minimal, Large Type, Editorial, Light, Design | A New York industrial design studio's minimal site uses cycling bold typography across its services while expanding into team portraits and studio philosophy on scroll. | #FCFCFC #CFCFCF #030303 #959593 #B1B1B1 | `godly_frames/rows/51_atlason.png` |
| 52 | [Vitra: Office Chair Finder](https://findmy.vitra.com/en-en/questionnaire/chairs) | ecommerce | Muted, Transitions, Minimal, Clean, Interactive, Light | Vitra's interactive tool lets users filter their full chair catalog live using sliders for height, sitting time, breathability, and padding preferences. | #F4F4F4 #D3D2D1 #B1B2AF #91928E #363635 | `godly_frames/rows/52_vitra-office-chair-finder.png` |
| 53 | [1Password: A Vision of the Future](https://www.future.1password.com/) | technology | Dark, Vibrant, Gradient, Scrolling Animation, Clean, Illustrative, Large Type, SaaS, Productivity | 1Password's scrolling microsite illustrates the growing complexity of online sign-ins and envisions a simpler passwordless future with one-click authentication. | #0B3159 #F8F8F8 #284B73 #536D92 #CAD0D5 | `godly_frames/rows/53_1password-a-vision-of-the-future.png` |
| 54 | [MacBook Air: M2](https://www.apple.com/macbook-air/) | product | Typographic, Minimal, Clean, Large Type, Light, Technology | Apple's product page opens with multiple laptops over giant AIR type before showcasing the redesigned chassis and four finishes. | #FDFDFD #121114 #282A2D #D2D2D3 #484B4E | `godly_frames/rows/54_macbook-air-m2.png` |
| 55 | [CLOU Architects](https://www.clouarchitects.com/) | architecture | Transitions, Typographic, Experimental, Minimal, Clean, Large Type, Light, Portfolio | This architecture portfolio features a spinning orbital ring of project thumbnails organized by sector around a central preview image. | #FDFEF9 #CED2D5 #ACAEAD #939494 #4D5149 | `godly_frames/rows/55_clou-architects.png` |
| 56 | [Endel Manifesto](https://manifesto.endel.io/) | health | Dark, Typographic, Illustrative, Large Type, Editorial, Long Scrolling | Endel presents a scrolling manifesto on dark backgrounds claiming human bodies lag behind modern life and exploring sound science for wellbeing. | #010101 #2E2E2E #4F4F4F #6B6B6B #E50509 | `godly_frames/rows/56_endel-manifesto.png` |
| 57 | [Resident](https://resident.co.nz/en/) | ecommerce | Muted, Minimal, Clean, Large Type, Editorial | A New Zealand furniture brand presents designer seating and sofas from Simon James and Philippe Malouin within clean white grid layouts. | #F7F7F7 #D2D0CE #131312 #564E45 #36312C | `godly_frames/rows/57_resident.png` |
| 58 | [ZiKD](https://www.zikd.space/en) | art | Vibrant, Typographic, Experimental, Minimal, 3D, Playful, Animation, Large Type, Organic, Design | A design exhibition site where glossy 3D blob shapes carrying expressive typographic phrases tumble across an oversized pill-shaped wordmark on a minimal grey background. | #F3F3F3 #030303 #470222 #D5D5D5 #845CB4 | `godly_frames/rows/58_zikd.png` |
| 59 | [RainbowKit](https://rainbowkit.com/) | web3 | Vibrant, Gradient, Clean, Interactive | RainbowKit is a React library for adding wallet connection UI to Web3 apps, featuring a polished modal with live theme, accent color, and border radius customization. | #070808 #F5F6F8 #218848 #203AB3 #91177B | `godly_frames/rows/59_rainbowkit.png` |
| 60 | [David Heckhoff](https://david-hckh.com/) | portfolio | Pastel, Transitions, Playful, 3D Illustration | A developer portfolio using a playful 3D illustrated hero alongside an animated skills scanner and scrollable WebGL project carousel. | #EFEBE1 #063671 #04244E #D7CDC2 #0D5091 | `godly_frames/rows/60_david-heckhoff.png` |
| 61 | [The Browser Company](https://www.thebrowser.company/) | startup | Dark, Vibrant, Scrolling Animation, Typographic, Illustrative, Large Type, Technology | A New York startup uses scrolling browser illustrations and a vivid blue manifesto section to argue for reimagining the web browser. | #131315 #1340F3 #1136C2 #4E6FF5 #2C2C31 | `godly_frames/rows/61_the-browser-company.png` |
| 62 | [Increase](https://increase.com/) | finance | Gradient, Transitions, Typographic, Geometric, Minimal, Clean, 3D, Large Type, Light, SaaS | A developer-focused banking infrastructure landing page with bold black typography, a bright lime and teal geometric 3D logo mark, and a clean light grey layout. | #DDE2E5 #F4F7F8 #B9FF4E #6BFF92 #C9CFD2 | `godly_frames/rows/62_increase.png` |
| 63 | [Jonnie Hallman](https://destroytoday.com/) | portfolio | Muted, Clean, Illustrative, Long Scrolling, Design | Stripe design engineer Jonnie Hallman showcases client work and his own app Cushion with rich illustrated section breaks throughout. | #FBFCFD #252621 #033418 #26639A #3693CF | `godly_frames/rows/63_jonnie-hallman.png` |
| 64 | [Basic Geometry](https://basic.site/password) | ecommerce | Muted, Earthy, Cart Functionality, Typographic, Geometric, Minimal, 3D, Large Type | A shop homepage for ribbed ceramic bowls and cylindrical vessels in muted tones, where 3D product renders scroll through bold oversized typography. | #FDFDFD #2E2D32 #94918E #B1AFAC #523738 | `godly_frames/rows/64_basic-geometry.png` |
| 65 | [Nev Flynn](https://nevflynn.com/) | personal | Dark, Pastel, Transitions, Clean, Playful, Interactive, Portfolio | An Irish developer and product designer showcases live Spotify, location, Twitter, and blog widgets in a colorful bento-style grid portfolio. | #F7F5F4 #0C1013 #91CAFB #D0D4D8 #F6B5D0 | `godly_frames/rows/65_nev-flynn.png` |
| 66 | [Honk](https://www.honk.me/) | product | Vibrant, Transitions, Playful, Large Type, Startup | Honk is a real-time messaging app for friends, shown on an electric-blue landing page with an animated iPhone mockup cycling through chats, games, voice messages, and reactions. | #0D86F7 #F5F5F7 #3097F8 #B0DEF9 #12E34D | `godly_frames/rows/66_honk.png` |
| 67 | [Unknown, Untitled](https://unknown-untitled.com/en) | agency | Transitions, Typographic, Minimal, Large Type, Design | A Paris design studio presents product and industrial work for Facebook, Rimowa, and Logitech through a spare typographic homepage. | #FDFDFD #DDDAD7 #030303 #B0B0B0 #929292 | `godly_frames/rows/67_unknown-untitled.png` |
| 68 | [Block](https://block.xyz/) | technology | Vibrant, Gradient, Transitions, Geometric, Experimental, Minimal, 3D, Animation | Block's homepage features a shifting 3D geometric shape set against vivid orange and cyan gradients, showcasing its suite of companies. | #EB3705 #16FEF8 #8E6F41 #708359 #B05A2B | `godly_frames/rows/68_block.png` |
| 69 | [Jeen-Yuhs](https://jeen-yuhs.com/) | entertainment | Dark, Vibrant, Transitions, Typographic, Experimental, Retro, Large Type, Textured, Big Background Video | A promo site for Jeen-Yuhs blends glitchy VHS animations, archival footage loops, and bold oversized type to build anticipation for the documentary. | #080808 #3A0C09 #0B102A #282727 #AAA99E | `godly_frames/rows/69_jeen-yuhs.png` |
| 70 | [PORTO ROCHA](https://www.portorocha.com/) | agency | Muted, Typographic, Big Background Image, Editorial, Design | Porto Rocha's studio site pairs a live timestamp and scrollable project index with a bold outdoor poster photo for an editorial newsroom feel. |  | `godly_frames/70_porto-rocha_card.png` |
| 71 | [Snog](https://www.snogproductions.com/) | photography | Vibrant, Transitions, Typographic, Minimal, Large Type, Editorial, Agency, Portfolio | A photo production company portfolio where overlapping editorial images animate across a white canvas, revealing projects for GQ, O Magazine, and more. | #FBFBFB #16110F #2D2B27 #DA0625 #ACAFB2 | `godly_frames/rows/71_snog.png` |
| 72 | [Him & Hers](https://app.forhims.com/) | health | Pastel, Gradient, Scrolling Animation, Typographic, Clean, Large Type | A telehealth landing page pairs bold purple typography with soft gradient backgrounds and scrolling phone mockups to highlight guided care programs. | #FBFCFC #CFD6D9 #B1D3DA #7AC8B2 #95B5D8 | `godly_frames/rows/72_him-hers.png` |
| 73 | [TWOMUCH](https://www.twomuch.studio/) | agency | Transitions, Typographic, Experimental, 3D, Playful, Animation, 3D Illustration, Light, Design | A digital design studio with a homepage showcasing tumbling 3D objects and chrome lettering that rearrange into a new composition on every visit. | #FBFBFB #B0AFAD #D1D0CF #95928E #797672 | `godly_frames/rows/73_twomuch.png` |
| 74 | [Simon Rogers](https://www.simonrogers.info/) | portfolio | Monochrome, Transitions, Typographic, Experimental, Minimal, Animation, Large Type, Design | Simon Rogers showcases his London design and development work through looping animated blue typography mixing roman and italic weights at varied scales. | #FDFDFE #CBD3F9 #AFBBF7 #95A6F7 #6F86F7 | `godly_frames/rows/74_simon-rogers.png` |
| 75 | [Miranda](https://www.niccolomiranda.com/) | portfolio | Muted, Earthy, Typographic, Retro, Illustrative, Large Type, Editorial, Textured, Design | A portfolio designed like a broadsheet newspaper with bold editorial typography and illustrated portraits showcasing digital art direction work. | #BBB2A9 #1A1816 #65554A #9E948B #7A746D | `godly_frames/rows/75_miranda.png` |
| 76 | [Seksy Planety](https://www.seksyplanety.com/) | personal | Dark, Vibrant, Neon, Transitions, Typographic, Experimental, Playful, Illustrative, Large Type | A wild neon homepage layers oversized black-and-white text with animated illustrated cards featuring sushi, chili peppers, and bananas. | #FCFCFC #030203 #AEAEAD #D7FC47 #7403E9 | `godly_frames/rows/76_seksy-planety.png` |
| 77 | [George Thomas Hatton](https://georgehatton.com/) | portfolio | Muted, Minimal, Big Background Image, Editorial, Design | A portfolio site from graphic designer George Thomas Hatton showcasing an open book spread filled with a soft blue crowd of ghostly silhouettes and a red-edged binding. |  | `godly_frames/77_george-thomas-hatton_card.png` |
| 78 | [Friends of the New](https://www.friendsofthenew.com/) | music | Black & White, Typographic, Large Type, Editorial, Agency | A music artist and talent agency site using a striking black-and-white photo grid and oversized serif wordmark on a warm off-white background to introduce its roster. |  | `godly_frames/78_friends-of-the-new_card.png` |
| 79 | [ARTWORLD](https://artworld.agency/) | agency | Black & White, Typographic, Minimal, Clean, Large Type, Editorial | A talent agency homepage presents its roster of photographers, directors, and casting artists using elegant serif and bold display typography on a clean white background. |  | `godly_frames/79_artworld_card.png` |
| 80 | [Little Troop](https://littletroop.com/) | agency | Vibrant, Typographic, Geometric, Experimental, 3D, Animation, Large Type, Portfolio | A portfolio site displays client projects on a continuously spinning 3D cube that tumbles and rotates to reveal work like Girlgaze and Court skincare. | #FEFEFE #9AC2F5 #B1ADC8 #040403 #2E3427 | `godly_frames/rows/80_little-troop.png` |
| 81 | [Schemas of Uncertainty](https://schemasofuncertainty.com/) | editorial | Muted, Transitions, Typographic, Experimental, Animation | An editorial site exploring uncertainty through dense essay columns where typography glitches and cycles through distorted animated letterforms over time. | #F5F3F3 #DCDADA #BBBCB9 #F6B4BC #EE9CA7 | `godly_frames/rows/81_schemas-of-uncertainty.png` |
| 82 | [UNLIRICE](https://unlirice.ooo/) | editorial | Vibrant, Transitions, Experimental, Playful, Animation, Large Type, Design | A creative studio or zine site where dozens of photo-filled oval and circular shapes tumble across a white canvas in a continuous animated swirl around a bold wordmark. |  | `godly_frames/rows/82_unlirice.png` |
| 83 | [Stripe Press](https://press.stripe.com/) | editorial | Dark, Vibrant, 3D, Illustrative | Stripe Press showcases a scrollable stack of richly illustrated book spines on a dark background, each linking to excerpts and detailed reviews. | #1A1816 #2A2A2A #19167E #6A6C6A #50514E | `godly_frames/rows/83_stripe-press.png` |
| 84 | [Squadeasy](https://www.squadeasy.com/) | health | Neon, Typographic, Playful, Large Type, 3D Illustration, SaaS | A bold electric-green wellness platform that motivates coworkers to build team cohesion through walking, running, and cycling challenges. | #69FE53 #FDFDFD #020302 #D1D0CD #194214 | `godly_frames/rows/84_squadeasy.png` |
| 85 | [No.10](https://y-n10.com/) | finance | Dark, Vibrant, Experimental, Playful, 3D Illustration, Long Scrolling | A family office site for Yamauchi No.10 that presents its history and philosophy through a sprawling isometric voxel world users scroll across to explore. | #070706 #2D2E2C #4B4C4B #717171 #5B5210 | `godly_frames/rows/85_no-10.png` |
| 86 | [ALT STUDIOS](https://alt-studios.com/) | agency | Black & White, Typographic, Minimal, Large Type, Long Scrolling | A coming soon page for ALT Studios reveals a scrolling manifesto pairing opposites, trading complacency and laziness for integrity and originality. | #FDFDFD #8F8F8F #AFAFAF #717171 #CFCFCF | `godly_frames/rows/86_alt-studios.png` |
| 87 | [OPX Studio](https://opx.studio/) | agency | Vibrant, Transitions, Typographic, Minimal, Clean, Big Background Image, Large Type, Design | A design studio portfolio showcasing client work through bold typography, full-screen project imagery, and a simple About/Work navigation structure. | #040404 #F8F8F8 #F3BDDA #909382 #E8B82D | `godly_frames/rows/87_opx-studio.png` |
| 88 | [Shivam Sinha](https://www.helloshivam.com/) | portfolio | Dark, Vibrant, Gradient, Neon, Custom Cursor, Experimental, Interactive | Shivam Sinha's portfolio site opens with a cursor-reactive WebGL light simulation that swirls through vivid spectral colors against a dark background. | #141413 #2A2C28 #33483C #4C4B47 #493432 | `godly_frames/rows/88_shivam-sinha.png` |
| 89 | [Dries Bos](https://www.driesbos.com/) | portfolio | Dark, Typographic, Minimal, Clean | A dark minimal portfolio site displays past client work in a clean spreadsheet style table with columns for year client studio and project type. |  | `godly_frames/89_dries-bros_card.png` |
| 90 | [MAD](https://mad.ac/) | agency | Pastel, Gradient, Playful, Large Type | MAD's agency site floats its identity across a warm gradient canvas, blending logos, team notes, and case study previews into one playful layout. |  | `godly_frames/90_mad_card.png` |
| 91 | [No Ideas](https://www.noideas.website/) | entertainment | Dark, Black & White, Typographic, Experimental, Large Type | A bold black site where white letters and numbers scatter into two swirling clusters, forming a chaotic typographic composition that doubles as a party invitation. |  | `godly_frames/91_no-ideas_card.png` |
| 92 | [Claudio Guglieri](https://guglieri.com/) | portfolio | Dark, Vibrant, Transitions, Typographic, Experimental, 3D, Large Type | A portfolio site with a black background where 3D rendered objects and morphing typography animate together to spell out the phrase Why Don't We Try? | #010101 #F1F4F5 #F27408 #282B2D #464A4D | `godly_frames/rows/92_claudio-guglieri.png` |
| 93 | [Julia Johnson](https://www.juliajohnson.com/) | photography | Typographic, Minimal, Clean, Large Type, Editorial, Portfolio | A photographer portfolio homepage that pairs bold condensed typography with editorial portrait photography, giving the layout a striking editorial magazine quality. |  | `godly_frames/93_julia-johnson_card.png` |
| 94 | [Eduardo del Fraile](https://eduardodelfraile.com/) | portfolio | Dark, Minimal, Big Background Image, Design | A Spanish designer's portfolio opens with a striking black-stage hero featuring a matte ceramic gorilla-head bottle alongside a glowing orange fruit with a paper straw. |  | `godly_frames/94_eduardo-del-fraile_card.png` |
| 95 | [NewTab](https://www.newtab-studio.com/) | agency | Vibrant, Typographic, Experimental, Playful, Large Type | NewTab Studio's portfolio site uses a bright pink background and oversized black wordmark alongside tilted project thumbnails to create a bold, chaotic first impression. |  | `godly_frames/95_newtab_card.png` |
| 96 | [Fidèle](https://fidele-editions.com/) | ecommerce | Muted, Typographic, Playful, Large Type, Editorial | A Paris-based small press and Risograph print studio whose homepage uses oversized golden type and playful floating navigation shapes to set a warm, characterful tone. |  | `godly_frames/96_fidele_card.png` |
| 97 | [Ezekiel Aquino](https://ezekielaquino.com/) | art | Black & White, Geometric, Experimental, Minimal | A generative music score rendered as a circular ring of staff notation, where musical notes spiral around a hollow center on a spare white background. |  | `godly_frames/97_ezekiel-aquino_card.png` |
| 98 | [Studio—BA](https://brunoarizio.com/) | agency | Dark, Black & White, Typographic, Geometric, Minimal, Large Type, Grid, Design | A stark black homepage pairs a white circle over a fine vertical grid with a bold declaration of Studio—BA as a multidisciplinary design practice. |  | `godly_frames/98_studio-ba_card.png` |
| 99 | [Studio Lathe](https://studiolathe.com/) | agency | Muted, Typographic, Minimal, Clean | Studio Lathe presents its portfolio as a clean typographic list of clients paired with small pill-shaped service tags on a minimal off-white background. |  | `godly_frames/99_studio-lathe_card.png` |

## Приложение B. Полная инвентаризация SL UI Library (388 компонентов)

Каждый компонент открыт как живой пакет `packages/<variant>/index.html`, снято 6 состояний: default · hover (450 мс) · press (110 мс после mousedown) · +150 мс после отпускания · +900 мс · фокус с клавиатуры (Tab). Ленты: `sl_states/strips/NNN.jpg`, листы по 8 компонентов: `shots/B/sl/states/states_XX.jpg` (XX = NNN // 8), миниатюры всех 388: `shots/B/sl/inventory/defaults_00..08.jpg`.

| № | Категория | Компонент | Описание | Motion-тэги | Цель взаимодействия | Голос/статус после клика |
|---|---|---|---|---|---|---|
| 000 | buttons | Save & Cancel | Matte buttons with smooth state changes. | Soft press, Fade-through | BUTTON Save changes
Saving
…
Saved
Sa | Saving changes. |
| 001 | buttons | Copy | Copy text with a soft confirmation. | Sheet merge, Fade-through | BUTTON Copy | Clipboard access was blocked. Select the text and copy it manually, or try again. |
| 002 | buttons | Like | A soft heartbeat. Click again to undo. | Heart fill, Soft pulse | BUTTON Like | Liked. Click again to undo. |
| 003 | buttons | Download | A download arrow that settles into a confirmation. | Arrow to check, Soft return | BUTTON Download | Download started. |
| 004 | buttons | Bookmark | A ribbon that fills as you keep an item. | Ribbon fill, Label fade | BUTTON Bookmark | Bookmarked. Click again to undo. |
| 005 | buttons | Play / Pause | A play icon that opens into two pause bars. | Icon morph, Label fade | BUTTON Play | Preview set to playing. Choose Pause to switch back. No media is playing. |
| 006 | buttons | Delete | A single action with a quiet lid motion. | Lid motion, Soft confirmation | BUTTON Delete | Deleted. |
| 007 | buttons | Upload | A file lifts into progress and confirmation. | Arrow lift, Progress to check | BUTTON Upload | No file selected. Nothing was uploaded. |
| 008 | buttons | Share | Open a link panel with separate copy and share actions. | Panel reveal, Label fade | BUTTON Share |  |
| 009 | buttons | Follow | A plus becomes a check when you follow. | Plus to check, Fade-through | BUTTON Follow
ing | Following in this preview. Click again to unfollow. |
| 010 | inputs | Text input | A matte text field with a label that makes room. | Floating label, Soft focus | INPUT  |  |
| 011 | inputs | Search input | A local search field with compact keyboard-friendly suggestions. | Lens lift, List reveal | INPUT[combobox]  | 4 suggestions. Use the arrow keys to choose. |
| 012 | inputs | Email input | A native email field with quiet format feedback. | Label float, Icon draw | INPUT  | Use an address such as name@example.com. |
| 013 | inputs | Password input | A password field with two eyes that open and close. | Eye open, Eye close | INPUT  |  |
| 014 | inputs | Number input | A bounded number field with calm step controls. | Soft step press, Floating label | INPUT  | Choose 0 to 12 in steps of 1. |
| 015 | inputs | Textarea input | A compact native textarea that grows with its content. | Auto grow, Floating label | TEXTAREA  | Add a short note for your team. |
| 016 | inputs | URL input | A URL field with a turning globe and quiet syntax feedback. | Globe turn, Icon draw | INPUT  | Use a complete address such as https://example.com. |
| 017 | inputs | Phone input | A telephone field with common international masks and forgiving deletion. | Handset ring, Live mask | INPUT  |  |
| 018 | inputs | Amount input | A numeric amount field that formats without forcing trailing zeroes. | Currency spread, Format on blur | INPUT  | Formatting is applied when you leave the field. |
| 019 | inputs | Verification code input | One native code field with six staged result cells. | Sequential result, Group settle | INPUT  | Enter 482731 to see the accepted state. |
| 020 | selection | Notifications | Notifications with immediate on/off state and smooth feedback. | Bell ring, Bell strike | INPUT  | Off |
| 021 | selection | Day & night | Day & night with immediate on/off state and smooth feedback. | Smooth slide, Sun and moon fade | INPUT  | Dark |
| 022 | selection | Sound waves | Sound waves with immediate on/off state and smooth feedback. | Wave reveal, Mute fade | INPUT  | Muted |
| 023 | selection | Privacy lock | Privacy lock with immediate on/off state and smooth feedback. | Shackle close, Key reveal | INPUT  | Private |
| 024 | selection | Auto sync | Auto sync with immediate on/off state and smooth feedback. | Single orbit, Soft settle | INPUT  | Automatic |
| 025 | selection | Wi-Fi | Wi-Fi with immediate on/off state and smooth feedback. | Signal unfold, Quiet fade | INPUT  | Offline |
| 026 | selection | Location | Location with immediate on/off state and smooth feedback. | Pin landing, Soft lift | INPUT  | Enabled |
| 027 | selection | Battery saver | Battery saver with immediate on/off state and smooth feedback. | Leaf reveal, Fade-through | INPUT  | Saving energy |
| 028 | selection | Microphone | Microphone with immediate on/off state and smooth feedback. | Mute stroke, Wave fade | INPUT  | Muted |
| 029 | selection | Auto save | Auto save with immediate on/off state and smooth feedback. | Check draw, Slot settle | INPUT  | Automatic |
| 030 | checkboxes | Signature check | Signature check with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 031 | checkboxes | Precision square | Precision square with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 032 | checkboxes | Circle check | Circle check with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 033 | checkboxes | Task complete | Task complete with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 034 | checkboxes | Select together | Select together with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 035 | checkboxes | Square cross | Square cross with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 036 | checkboxes | Circle cross | Circle cross with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 037 | checkboxes | Star | Star with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 038 | checkboxes | Heart | Heart with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 039 | checkboxes | Bookmark check | Bookmark check with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 040 | checkboxes | Shield | Shield with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 041 | checkboxes | Pin | Pin with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 042 | checkboxes | Follow topic | Follow topic with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 043 | checkboxes | Ring outline | Ring outline with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 044 | checkboxes | Open corners | Open corners with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 045 | checkboxes | Selection chips | Selection chips with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 046 | checkboxes | Weekdays | Weekdays with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT Monday |  |
| 047 | checkboxes | Format cards | Format cards with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 048 | checkboxes | Texture swatches | Texture swatches with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 049 | checkboxes | Round checklist | Round checklist with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 050 | checkboxes | Exclusion list | Exclusion list with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 051 | checkboxes | Feature list | Feature list with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 052 | checkboxes | File list | File list with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 053 | checkboxes | Selection table | Selection table with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 054 | checkboxes | Nested list | Nested list with independent selection and reversible motion. | Soft selection, Reversible feedback | INPUT  |  |
| 055 | sliders | Volume | Volume with native input and precise, immediate control. | Progressive sound waves, Soft feedback | INPUT  |  |
| 056 | sliders | Brightness | Brightness with native input and precise, immediate control. | Sun response, Soft feedback | INPUT  |  |
| 057 | sliders | Stepped density | Stepped density with native input and precise, immediate control. | Discrete selection, Soft feedback | INPUT  |  |
| 058 | sliders | Price range | Price range with native input and precise, immediate control. | Dual handles, Soft feedback | INPUT Minimum price |  |
| 059 | sliders | Vertical level | Vertical level with native input and precise, immediate control. | Vertical fader, Soft feedback | INPUT  |  |
| 060 | sliders | Playback scrubber | Playback scrubber with native input and precise, immediate control. | Continuous playhead, Soft feedback | INPUT  |  |
| 061 | sliders | Playback speed | Playback speed with native input and precise, immediate control. | Clickable speed stops, Soft feedback | INPUT  |  |
| 062 | sliders | Zoom | Zoom with native input and precise, immediate control. | Live magnification, Soft feedback | INPUT  |  |
| 063 | sliders | Temperature | Temperature with native input and precise, immediate control. | Thermometer response, Soft feedback | INPUT  |  |
| 064 | sliders | Stereo balance | Stereo balance with native input and precise, immediate control. | Center-origin fill, Soft feedback | INPUT  |  |
| 065 | sliders | Exposure | Exposure with native input and precise, immediate control. | Precise neutral scale, Soft feedback | INPUT  |  |
| 066 | sliders | Segmented level | Segmented level with native input and precise, immediate control. | Segment fill, Soft feedback | INPUT  |  |
| 067 | sliders | Rating scale | Rating scale with native input and precise, immediate control. | Fractional star fill, Soft feedback | BUTTON[radio] 1 star |  |
| 068 | sliders | Time window | Time window with native input and precise, immediate control. | Bounded interval, Soft feedback | INPUT Start time |  |
| 069 | sliders | Distance bubble | Distance bubble with native input and precise, immediate control. | Following value, Soft feedback | INPUT  |  |
| 070 | sliders | Pill meter | Pill meter with native input and precise, immediate control. | Vertical fill, Soft feedback | INPUT  |  |
| 071 | sliders | Mini mixer | Mini mixer with native input and precise, immediate control. | Independent channels, Soft feedback | INPUT  |  |
| 072 | sliders | Type size | Type size with native input and precise, immediate control. | Live type preview, Soft feedback | INPUT  |  |
| 073 | sliders | Corner radius | Corner radius with native input and precise, immediate control. | Immediate rounding, Soft feedback | INPUT  |  |
| 074 | sliders | Opacity | Opacity with native input and precise, immediate control. | Transparency preview, Soft feedback | INPUT  |  |
| 075 | menus | Action menu | Action menu with keyboard navigation and local feedback. | Connected slide | BUTTON Project actions |  |
| 076 | menus | Sort menu | Sort menu with keyboard navigation and local feedback. | Rising sheet | BUTTON Last updated |  |
| 077 | menus | Multi-select menu | Multi-select menu with keyboard navigation and local feedback. | Sequenced choices | BUTTON Labels
1 |  |
| 078 | menus | Context menu | Context menu with keyboard navigation and local feedback. | Pointer-origin reveal | BUTTON Open file actions |  |
| 079 | menus | Command menu | Command menu with keyboard navigation and local feedback. | Connected expansion | BUTTON Quick commands |  |
| 080 | menus | Workspace switcher | Workspace switcher with keyboard navigation and local feedback. | Soft rise | BUTTON Studio workspace |  |
| 081 | menus | Status picker | Status picker with keyboard navigation and local feedback. | Corner reveal | BUTTON In progress |  |
| 082 | menus | Assignee menu | Assignee menu with keyboard navigation and local feedback. | Sequenced people | BUTTON Assign someone |  |
| 083 | menus | Appearance menu | Appearance menu with keyboard navigation and local feedback. | Side reveal | BUTTON Matte |  |
| 084 | menus | Density menu | Density menu with keyboard navigation and local feedback. | Upward sheet | BUTTON Comfortable |  |
| 085 | menus | Export menu | Export menu with keyboard navigation and local feedback. | Connected slide | BUTTON Export file |  |
| 086 | menus | Access menu | Access menu with keyboard navigation and local feedback. | Offset reveal | BUTTON Can view |  |
| 087 | menus | Reminder menu | Reminder menu with keyboard navigation and local feedback. | Gentle lift | BUTTON Remind me |  |
| 088 | menus | Folder menu | Folder menu with keyboard navigation and local feedback. | Nested slide | BUTTON Move to folder |  |
| 089 | menus | Insert menu | Insert menu with keyboard navigation and local feedback. | Compact reveal | BUTTON Insert block |  |
| 090 | navigation | Underline tabs | Underline tabs with responsive interaction and local preview state. | Sliding underline | BUTTON[tab] Overview |  |
| 091 | navigation | View switcher | View switcher with responsive interaction and local preview state. | Soft selection | BUTTON[tab] List |  |
| 092 | navigation | Folder trail | Folder trail with responsive interaction and local preview state. | Folder transition | BUTTON Studio | Open a folder to explore. |
| 093 | navigation | Pagination | Pagination with responsive interaction and local preview state. | Moving page marker | BUTTON Previous page | 1–2 of 10 |
| 094 | navigation | Side navigation | Side navigation with responsive interaction and local preview state. | Collapsing rail | BUTTON Collapse navigation | Projects

A place for your next idea.

Three active projects |
| 095 | navigation | Step navigation | Step navigation with responsive interaction and local preview state. | Step progression | BUTTON Details | Give your idea a home.

Start with a clear project brief and a little room to explore. |
| 096 | navigation | Bottom navigation | Bottom navigation with responsive interaction and local preview state. | Sliding dock | BUTTON Projects | Your workspace

A quiet place for your next project. |
| 097 | navigation | Section index | Section index with responsive interaction and local preview state. | Scroll tracking | BUTTON Brief |  |
| 098 | navigation | Collection navigation | Collection navigation with responsive interaction and local preview state. | Horizontal slide | BUTTON Previous project | Brand system, 1 of 3 |
| 099 | navigation | Tree navigation | Tree navigation with responsive interaction and local preview state. | Reversible branches | LI[treeitem] Design
Brand guide
Components | Brand guide
Visual direction |
| 100 | overlays | Project modal | Project modal with responsive interaction and local preview state. | Soft scale | BUTTON New project | Try it here. Nothing leaves this preview. |
| 101 | overlays | Details drawer | Details drawer with responsive interaction and local preview state. | Side reveal | BUTTON Project details | Try it here. Nothing leaves this preview. |
| 102 | overlays | Collection sheet | Collection sheet with responsive interaction and local preview state. | Bottom sheet | BUTTON Choose collection | Try it here. Nothing leaves this preview. |
| 103 | overlays | Project popover | Project popover with responsive interaction and local preview state. | Anchored reveal | BUTTON Project info | Try it here. Nothing leaves this preview. |
| 104 | overlays | Context tooltip | Context tooltip with responsive interaction and local preview state. | Quiet fade | BUTTON Version history | Hover, focus or tap for a hint. |
| 105 | overlays | Confirmation dialog | Confirmation dialog with responsive interaction and local preview state. | Gentle rise | BUTTON Archive project | Try it here. Nothing leaves this preview. |
| 106 | overlays | Action palette | Action palette with responsive interaction and local preview state. | Top reveal | BUTTON Find an action | Try it here. Nothing leaves this preview. |
| 107 | overlays | Document preview | Document preview with responsive interaction and local preview state. | Expanding surface | BUTTON Preview document | Try it here. Nothing leaves this preview. / 1 / 2 |
| 108 | overlays | Quick edit | Quick edit with responsive interaction and local preview state. | Anchored editor | BUTTON Rename project | Try it here. Nothing leaves this preview. |
| 109 | overlays | Guided tour | Guided tour with responsive interaction and local preview state. | Step fade | BUTTON Take a quick tour | Try it here. Nothing leaves this preview. |
| 110 | feedback | Status toast | A compact status message with a pausable timeout. | Soft arrival | BUTTON Success | Changes saved |
| 111 | feedback | Undo snackbar | A reversible action with asynchronous Undo feedback. | Action confirmation | BUTTON Undo | Item restored. |
| 112 | feedback | Notification stack | Three visible notifications with a bounded waiting queue. | Queued messages | BUTTON Dismiss notification |  |
| 113 | feedback | Inline alert | An in-place warning that opens and closes without a hard layout jump. | Gentle collapse | BUTTON Dismiss notification | Message dismissed. |
| 114 | feedback | Connection banner | Offline, reconnecting and connected states with a retry action. | Reconnect feedback | BUTTON Reconnect | Connected. |
| 115 | feedback | Linear progress | Determinate or indeterminate progress with cancelable demo work. | Continuous progress | BUTTON Start export | Operation started. |
| 116 | feedback | Circular progress | A progress ring with synchronized percentage and completion. | Smooth ring | BUTTON Prepare files | Operation started. |
| 117 | feedback | Skeleton card | A same-size placeholder that fades into loaded content. | Content reveal | BUTTON Load content | Loading content. |
| 118 | feedback | Loading indicator | A stoppable indicator for work of unknown duration. | Quiet pulse | BUTTON Start sync | Operation started. |
| 119 | feedback | Retry notice | An actionable error state with asynchronous retry and recovery. | Error recovery | BUTTON Try again | Operation complete. |
| 120 | data-display | Metric card | A summary metric with selectable periods and a matching trend line. | Value transition | BUTTON 7 days |  |
| 121 | data-display | Sortable table | A compact file table with reversible sorting and row selection. | Row reordering | BUTTON Name | Sorted by name, descending. |
| 122 | data-display | Avatar group | An overlapping avatar group with expandable members and local selection. | Member reveal | BUTTON AL | Alex Lee, Design. |
| 123 | data-display | Status badges | Labeled status badges with filterable project rows. | Filtered rows | BUTTON All | 4 projects shown. |
| 124 | data-display | Details list | A description list with additional metadata that expands in place. | Detail disclosure | BUTTON More details | Additional details shown. |
| 125 | data-display | Activity timeline | A chronological activity list with expandable earlier events. | History disclosure | BUTTON Earlier activity | Additional details shown. |
| 126 | data-display | File card | A file summary with selectable sample files and expandable properties. | File selection | BUTTON Details | Additional details shown. |
| 127 | data-display | Bar chart | A selectable weekly bar chart with a fixed, labeled comparison scale. | Shared-scale update | BUTTON This week |  |
| 128 | data-display | Donut chart | A storage breakdown with labeled values and selectable categories. | Segment emphasis | BUTTON Assets
42 GB | Assets: 42 GB. |
| 129 | data-display | Calendar | A month view with selectable dates, scheduled events and keyboard navigation. | Month transition | BUTTON Previous month | August 2026 |
| 130 | buttons | Split export action | Choose an export format from a keyboard menu, then run or cancel the selected action. | Soft press, Reversible reveal | BUTTON Export SVG | SVG export completed. |
| 131 | buttons | Cancellable processing | Run a cancelable action with callback-driven progress and a retryable error state. | Soft press, State transition | BUTTON Prepare assets | Preparing assets… |
| 132 | buttons | Hold to confirm | Hold using pointer, Space or Enter to confirm a deliberate action. | Soft press, Hold progress | BUTTON Hold to archive | Released early. Nothing was archived. |
| 133 | buttons | Action queue | Queue up to three jobs, remove waiting jobs and run them serially with cancellation. | Soft press, State transition | BUTTON Add take | Take added. 1 queued. |
| 134 | buttons | Record a take | Start and stop a recording session with elapsed time, cancellation and device cleanup. | Soft press, State transition | BUTTON Start recording | Starting recorder… |
| 135 | buttons | Approve or reject | Make a reversible local review decision with explicit Approve and Reject controls. | Soft press, State transition | BUTTON Approve | Approval selected. |
| 136 | buttons | Refresh snapshot | Refresh a data snapshot while keeping the previous value available during work or failure. | Soft press, State transition | BUTTON Refresh snapshot | Reading latest snapshot… |
| 137 | buttons | Duplicate item | Create a copy without changing the original, with confirmed results, cancellation and retry. | Soft press, Reversible reveal | BUTTON Duplicate | 1 copy created. Original unchanged. |
| 138 | buttons | Press and repeat | Adjust a bounded quantity with single presses, pointer hold repeat and keyboard shortcuts. | Soft press, State transition | BUTTON Decrease copies | 2 / 2 copies selected. |
| 139 | buttons | Shuffle and undo | Pick a different local suggestion without immediate repeats, then undo the last pick. | Soft press, State transition | BUTTON Shuffle | Warm contrast selected. |
| 140 | inputs | Tag input | Add and remove up to six unique text tags without splitting pasted or composed text. | Soft press, Reversible field focus | INPUT e.g. Research | Enter adds one tag. Each tag can be removed. |
| 141 | inputs | Assignee combobox | Filter a local set of people and commit a stable ID; unavailable people cannot be selected. | Soft press, Reversible field focus | INPUT[combobox] Choose a person | Choose a person. Unavailable people are disabled. |
| 142 | inputs | Date range input | Choose two calendar dates and read an inclusive day count with date-order validation. | Soft press, Reversible field focus | INPUT YYYY-MM-DD | Both the first and last day are included. |
| 143 | inputs | Time input | Enter a local wall-clock time in five-minute steps and compare morning, noon and evening presets. | Soft press, Reversible field focus | INPUT HH:MM | Five-minute steps. No date or time zone is attached. |
| 144 | inputs | Duration input | Compose hours and minutes into a bounded duration, with quick quarter-hour adjustments. | Soft press, Reversible field focus | INPUT  | Up to 23 hours and 59 minutes. |
| 145 | inputs | Measurement input | Edit a length in centimetres or inches while preserving its underlying millimetre value. | Soft press, Reversible field focus | INPUT  | Range: 0–10,000 mm. Unit changes keep the same length. |
| 146 | inputs | Editable title | Edit a local title with explicit Apply and Cancel actions while preserving its original text. | Soft press, Reversible field focus | BUTTON Edit title | Enter applies. Escape cancels. |
| 147 | inputs | Key–value input | Build up to three metadata pairs with unique keys and literal text values. | Soft press, Reversible field focus | INPUT  | Keys must be unique. Values can be empty. |
| 148 | inputs | Color input | Choose a color with the project palette, keyboard sliders, editable six-digit hex field and swatch presets. | Soft press, Reversible field focus | BUTTON Choose color | Use # followed by six hexadecimal digits. / #B6CBBB |
| 149 | inputs | Attachment input | Choose one local document, validate its size and extension, and remove it without uploading anything. | Soft press, Reversible field focus | BUTTON Choose demo file | Demo only. Choose a sample document. |
| 150 | selection | Presence rail | Three presence positions share a sliding indicator and one keyboard tab stop. | Sliding position, Shape transition | BUTTON[radio] Available | Available selected |
| 151 | selection | Reading density | A bounded stepper moves through three reading densities and changes sample spacing. | Reversible spacing | BUTTON Less spacing | Compact spacing |
| 152 | selection | Reading aids | A master switch gates two reading aids while preserving each child preference. | Switch travel, Sample highlight | BUTTON[switch] On | Aids off. Your choices are kept. |
| 153 | selection | Focus override | A temporary focus preset suppresses two saved preferences and restores them when released. | Switch travel, Preset surface | BUTTON[switch] Off | Activity feed and inline hints off |
| 154 | selection | Snap modes | Two compact rows choose independent off, soft or firm snapping with per-row radio navigation. | Guide fade, Marker travel | BUTTON[radio] Off | Grid: off / Guides: firm |
| 155 | selection | Week rhythm | Seven independent day toggles combine with replaceable weekday and weekend presets. | Day check reveal | BUTTON Mo | 4 active days |
| 156 | selection | Measurement units | A two-way unit selector converts a fixed route distance and ascent from canonical metric values. | Segment crossfade | BUTTON[radio] Metric | Metric units selected |
| 157 | selection | Inherited setting | Choose a workspace default or a remembered personal override, with visible source and effective value. | Source segment, Switch travel | BUTTON[radio] Workspace | Following workspace default |
| 158 | selection | Preview mode | A draft layout selection previews immediately; Apply commits locally and Cancel or Escape restores the applied mode. | Outline indentation | BUTTON[radio] List | List layout applied |
| 159 | selection | Output priority | A fallback switch enables a secondary output and a swap action exchanges primary and fallback priority. | Switch travel, Fallback fade | BUTTON[switch] On | Headphones only |
| 160 | checkboxes | Limited shortlist | Choose up to three topics; remaining options pause until a choice is removed. | Reversible selection, Soft press | INPUT  | 0 of 3 selected |
| 161 | checkboxes | Selection budget | Build a selection within eight points, with exact costs and a remaining budget. | Reversible selection, Soft press | INPUT  | 0 of 8 points used · 8 available |
| 162 | checkboxes | Permission matrix | Choose view and edit rights per resource; edit implies view and removing view removes edit. | Reversible selection, Soft press | INPUT  | 0 permissions selected |
| 163 | checkboxes | Grouped quotas | Choose up to two items from each group with separate limits and totals. | Reversible selection, Soft press | INPUT  | Tools 0/2 · Formats 0/2 |
| 164 | checkboxes | Filtered bulk selection | Select all visible search results while retaining selections outside the current filter. | Reversible selection, Soft press | INPUT Filter assets | 1 selected · 4 visible |
| 165 | checkboxes | Ranked shortlist | Keep up to three priorities in selection order and promote any selected choice. | Reversible selection, Soft press | INPUT  | No ranked priorities |
| 166 | checkboxes | Exclusive none | Choose several channels or a mutually exclusive no-updates option. | Reversible selection, Soft press | INPUT  | No preference selected |
| 167 | checkboxes | Dependent export options | Select optional export details with an explicit dependency on source files. | Reversible selection, Soft press | INPUT  | 0 export options selected |
| 168 | checkboxes | Optional delivery choice | Choose one delivery mode with native radios and an explicit clear action. | Reversible selection, Soft press | INPUT  | Standard · 0 credits |
| 169 | checkboxes | Include or exclude rules | Set each filter to any, include or exclude with independent native radio groups. | Reversible selection, Soft press | INPUT  | No active rules |
| 170 | sliders | Loop selection | Trim a loop to half-second boundaries or lock its duration and move the complete interval without crossing clip edges. | Immediate range tracking, Soft press | INPUT Loop start |  |
| 171 | sliders | Source crossfade | Crossfade between two sources using linear or equal-power curves and inspect the resulting amplitude and decibel values. | Immediate range tracking, Soft press | INPUT Mix toward source B |  |
| 172 | sliders | Logarithmic gain | Adjust gain in 0.1 dB steps with its true logarithmic amplitude multiplier, a unity shortcut and reversible mute. | Immediate range tracking, Soft press | INPUT Gain |  |
| 173 | sliders | Bounded allocation | Allocate design and engineering hours while reserving at least ten hours for each discipline and calculating QA from the remainder. | Immediate range tracking, Soft press | INPUT Design |  |
| 174 | sliders | Gradient stops | Position shade, sage and light stops on a real CSS gradient while preserving their order and a five-percent minimum gap. | Immediate range tracking, Soft press | INPUT Shade stop |  |
| 175 | sliders | Log frequency band | Select frequency cutoffs on a logarithmic scale with a constant ratio per step and display the band width in octaves. | Immediate range tracking, Soft press | INPUT Low cutoff |  |
| 176 | sliders | ADSR envelope | Edit attack, decay, sustain and release with a proportionally scaled envelope graph and two reversible sound-shape presets. | Immediate range tracking, Soft press | INPUT Attack |  |
| 177 | sliders | Axis dead zone | Calibrate inner dead zone and outer saturation, then test the signed input against the rescaled output response. | Immediate range tracking, Soft press | INPUT Inner dead zone |  |
| 178 | sliders | Symmetric tolerance | Set a nominal measurement and symmetric tolerance, then compare a sample with the accepted band and its signed deviation. | Immediate range tracking, Soft press | INPUT Nominal |  |
| 179 | sliders | Cart quantity | Choose 1–20 items, adjust one at a time and see the example subtotal update. | Immediate range tracking, Soft press | INPUT Quantity |  |
| 180 | sliders | Reading spacing | Adjust paragraph line spacing with an immediately updated reading sample and a default shortcut. | Immediate range tracking, Soft press | INPUT Line spacing |  |
| 181 | sliders | Content width | Set a centered content column to 50–100% of its container and preview actual text reflow. | Immediate range tracking, Soft press | INPUT Content width |  |
| 182 | sliders | Card spacing | Adjust the exact pixel gap between list cards without changing their content or size. | Immediate range tracking, Soft press | INPUT Space between cards |  |
| 183 | sliders | Thumbnail size | Resize six gallery thumbnails in pixels while preserving their aspect ratio and wrapping them inside the container. | Immediate range tracking, Soft press | INPUT Thumbnail size |  |
| 184 | menus | Grouped resource picker | Search projects and documents in labeled groups and inspect the selected resource. | Reversible panel reveal, Soft selection | BUTTON Choose a resource | Choose a local resource to inspect. |
| 185 | menus | Nested topic menu | Navigate topic branches with a breadcrumb and Back, then assign a leaf topic. | Reversible panel reveal, Soft selection | BUTTON Choose a topic | Select a leaf topic for this sample. |
| 186 | menus | Recent action menu | Zoom and pin a visible sample canvas, then repeat or clear recent local commands. | Reversible panel reveal, Soft selection | BUTTON Actions & recents | Try an action, then repeat it from Recents. |
| 187 | menus | Tag assignment menu | Search, create and toggle tags in a cancellable draft before applying the assignment. | Reversible panel reveal, Soft selection | BUTTON Edit assigned tags | Changes stay in the draft until Apply. |
| 188 | menus | Branch and tag menu | Filter branches and release tags, select a revision and inspect its comparison with main. | Reversible panel reveal, Soft selection | BUTTON Choose a revision | Browse branches or release tags. |
| 189 | menus | Weekly delivery menu | Combine weekday presets, individual days and a 24-hour time in a cancellable weekly preference. | Reversible panel reveal, Soft selection | BUTTON Delivery window | Local preference. No delivery is scheduled. |
| 190 | menus | Sort recipe menu | See sample tasks reorder while choosing date or name, direction and priority-first sorting. | Reversible panel reveal, Soft selection | BUTTON Sort tasks | Choose a field, direction and whether priority comes first. |
| 191 | menus | Column visibility menu | Toggle optional table columns or apply compact and complete presets while retaining the required task name. | Reversible panel reveal, Soft selection | BUTTON Visible columns | Choose the columns shown in this sample. |
| 192 | menus | Document checkpoint menu | Inspect document checkpoints, restore a chosen version to the sample and undo the restore. | Reversible panel reveal, Soft selection | BUTTON Browse checkpoints | Preview a version before using it locally. |
| 193 | menus | Inline variable menu | Filter template variables and insert a literal token at the editor selection, with one-step undo. | Reversible panel reveal, Soft selection | BUTTON Insert a variable | Place the caret in the message, then insert. |
| 194 | navigation | Project section tabs | Six always-visible section tabs that wrap to fit their container and share one content panel. | Soft selection | BUTTON[tab] Overview |  |
| 195 | navigation | Drill-down navigator | Nested destination screens replace the current level and Back restores the exact parent choice. | Soft selection, Reversible disclosure | BUTTON Back |  |
| 196 | navigation | Navigation history | Local Back and Forward controls preserve visited destinations and discard a forward branch after a new visit. | Soft selection | BUTTON Back | VISIT 1 OF 1
Home

Your studio links and recent project destinations. / [Home] |
| 197 | navigation | Contextual navigation rail | The destination rail adapts to the chosen object and remembers the last section for each context. | Soft selection | BUTTON Document | DOCUMENT
Project brief

The brief describes the audience, constraints and navigation goals. |
| 198 | navigation | Landmark jump and return | A compact landmark chooser moves focus inside a reading pane and returns to the exact previous reading position. | Bounded scroll, Reversible disclosure | BUTTON Jump to |  |
| 199 | navigation | Searchable route finder | Filter destination names and paths, open a real local detail view, then return with the query and result focus preserved. | Soft selection | INPUT Try design or studio | 5 destinations / Projects / ProductProject briefAudience, goals and constraints for the product navigation. |
| 200 | navigation | Alphabet jump navigator | Letter shortcuts and keyboard navigation move through a local directory with a return point for the previous group. | Bounded scroll, Soft selection | BUTTON A |  |
| 201 | navigation | Reference jump and return | Inline references reveal their notes within the same reading pane and restore the exact source link on return. | Bounded scroll | BUTTON Return |  |
| 202 | navigation | Reading queue navigator | Move through a reading queue, mark documents read or unread, and undo reading changes in sequence. | Soft selection | BUTTON Project brief
Unread | DOCUMENT 1 OF 3
Audience and goals

Build a compact navigator for project material. Keep every route easy to identify. / |
| 203 | navigation | Spatial destination map | Navigate an original compact floor plan with spatial arrow keys and return through the visited rooms. | Soft room highlight | BUTTON Entrance | ENTRANCE
Arrival point

The entrance connects the shared library and the design studio. |
| 204 | overlays | Workspace settings | Stage workspace density and guidance preferences, then apply or discard the local draft. | Soft local reveal, Reversible fade | BUTTON Workspace settings | Comfortable rows · hints on |
| 205 | overlays | Calendar date picker | Browse months and choose a calendar date with arrow keys, month shortcuts and a reversible draft. | Soft local reveal, Reversible fade | BUTTON Choose a date | September 15, 2026 / September 2026 / September 15, 2026 |
| 206 | overlays | Notification inbox | Filter a local notification inbox, mark items read, and reverse individual read state. | Soft local reveal, Reversible fade | BUTTON Review notifications | 2 unread notifications / 2 UNREAD · LOCAL |
| 207 | overlays | Plan comparison | Compare two example plans, switch billing periods and hide equal features before selecting locally. | Soft local reveal, Reversible fade | BUTTON Compare plans | No plan selected |
| 208 | overlays | Compact style inspector | Inspect and adjust a sample element’s corner radius and opacity, with a live text-safe label and CSS readout. | Soft local reveal, Reversible fade | BUTTON Inspect appearance | 12 px corners · 100% opacity |
| 209 | overlays | Keyboard shortcut guide | Search a keyboard reference and switch between Windows and Mac key notation without executing commands. | Soft local reveal, Reversible fade | BUTTON Keyboard shortcuts | Find a shortcut by name or key / 5 SHORTCUTS |
| 210 | overlays | Project filter overlay | Build project filters with a live matching count, then apply or discard the local result set. | Soft local reveal, Reversible fade | BUTTON Filter projects | 4 projects · no filters |
| 211 | overlays | RGB color mixer | Mix an RGB color with bounded channels and a validated hexadecimal input before applying the local choice. | Soft local reveal, Reversible fade | BUTTON Mix a color | #A8C0AE selected / Six digits, with or without #. |
| 212 | overlays | Focus timer overlay | Run, pause and restart a real local countdown; closing keeps time and reset or destroy clears the timer. | Soft local reveal, Reversible fade | BUTTON Open focus timer | 5 minute session ready / Ready when you are. |
| 213 | overlays | Version history overlay | Inspect three text revisions and load a chosen version into a local draft, with a one-step undo. | Soft local reveal, Reversible fade | BUTTON Review versions | Current draft · Version 3 / Viewing Version 3 · current draft |
| 214 | feedback | Form error summary | Check a name and email format, follow error links to invalid fields, and see an explicit confirmation after both pass. | Soft press | INPUT Workspace name | Enter both fields, then check. |
| 215 | feedback | Unsaved draft | An editable draft with an explicit save checkpoint, cancellation and local discard. | Soft press | INPUT Draft title | Edit the title to create an unsaved draft. |
| 216 | feedback | Session expiry | A deadline warning with a real clock, a cancelable renewal and a recoverable expired state. | Soft press | BUTTON Extend session | The session deadline has been extended. |
| 217 | feedback | Capacity guard | A storage threshold preview that rejects oversized additions and recovers when space is freed. | Soft press, Capacity transition | BUTTON Research audio · 18 MB | Local capacity model. Storage is not changed. |
| 218 | feedback | Version conflict | A two-version comparison with an explicit choice and cancelable conflict resolution. | Soft press | BUTTON Your draft
Research notes, rev | Your draft is selected. |
| 219 | feedback | Partial completion receipt | A per-item result receipt that retries only unsuccessful items and retains confirmed results. | Soft press | BUTTON Retry unfinished | Waiting for the operation… |
| 220 | feedback | Access request feedback | A blocked feature with a request reason and distinct waiting, denied and granted outcomes. | Soft press | TEXTAREA Reason for access | Requesting access does not imply that access is granted. |
| 221 | feedback | No results recovery | A zero-results state that explains active constraints and recovers by widening the local search. | Soft press | INPUT Search sample files | 0 sample files found. Search stays on this device. |
| 222 | feedback | Incident timeline | A service incident history with scoped details and a reversible local acknowledgement. | Soft press, Reversible disclosure | BUTTON Service details | Sample incident. Acknowledgement is local to this view. |
| 223 | feedback | Readiness checklist | A cancelable preflight checklist with explicit pass and blocked results for each requirement. | Soft press | BUTTON Run checks | Waiting for the operation… |
| 224 | data-display | Conversion funnel | Select a funnel stage for drop-off details and animate its percentage bars between entry and previous-stage bases. | Soft selection | BUTTON From start | Submitted · 240 people · 360 lost from Started |
| 225 | data-display | Review score matrix | Navigate a criterion-by-platform score matrix and reveal remaining gaps to a five-point target. | Soft selection | BUTTON Scores | iOS · Usability · 4 / 5 · 1 point to target |
| 226 | data-display | Storage treemap | Select proportional rectangles and switch their area between storage size and file count. | Soft selection | BUTTON Storage size | Assets · 50 GB · 50% of 100 GB |
| 227 | data-display | Cycle comparison | Compare two labeled cycle bars per team on a shared scale and inspect absolute or relative changes. | Soft selection | BUTTON Issue change | Studio · +30 issues · +25% from cycle 1 |
| 228 | data-display | Grouped work log | Expand independent work groups, select an entry and inspect its share of logged time. | Reversible group reveal | BUTTON Planning
8 h | Brief · 3 h · 11% of 28 logged hours |
| 229 | data-display | Latency distribution | Inspect five labeled latency statistics and compare regions with animated bars on a shared scale. | Soft selection | BUTTON East region | East · Median · 35 ms · half at or below this value |
| 230 | data-display | Interactive series legend | Toggle labeled line series with distinct stroke patterns and a live visible-total summary. | Soft selection | BUTTON Direct
115
✓ | 2 series · 175 visits shown |
| 231 | data-display | Hourly heatmap | Inspect a weekday and time cell in a labeled, keyboard-navigable heatmap. | Soft selection | BUTTON 5 | Monday · 09:00 · 5 cases |
| 232 | data-display | Duration histogram | Select a duration interval and switch between frequency and cumulative counts. | Shared-scale morph | BUTTON Frequency | 6–8 minutes · 9 jobs · 30% of total |
| 233 | data-display | Channel ranking | Rank acquisition channels by visits or conversion rate while preserving selection. | Soft selection | BUTTON Visits | Direct · 420 visits · 21 sign-ups · 5% conversion |
| 234 | buttons | Add item | Add or remove one local item with a plus that resolves into a drawn check. | Plus to check, Soft press | BUTTON Add item | Item added. Activate again to remove it. |
| 235 | buttons | Send message | Run a message action with a paper plane departure and confirmed check state. | Plane departure, Check draw | BUTTON Send message | Demo finished locally. No message was sent. |
| 236 | buttons | Edit mode | Enter or leave a local editing mode while the pencil resolves into a check. | Pencil settle, Check draw | BUTTON Edit | Editing is on. Activate Done to leave it. |
| 237 | buttons | Link or unlink | Connect or separate two items with animated chain halves and explicit pressed state. | Chain connect, Soft press | BUTTON Link items | Items are linked. Activate again to unlink. |
| 238 | buttons | Lock or unlock | Toggle a local lock state while the shackle opens and settles into place. | Shackle close, Soft press | BUTTON Lock | Locked. Activate again to unlock. |
| 239 | buttons | Details disclosure | Reveal compact supporting content with a rotating chevron and reversible height motion. | Chevron rotate, Reversible reveal | BUTTON Show details | Details are visible. |
| 240 | buttons | Filter toggle | Apply or clear a local filter with a funnel that tightens into an active marker. | Funnel tighten, Marker pop | BUTTON Apply filter | Filter is active. Activate again to clear it. |
| 241 | buttons | Sort direction | Switch between ascending and descending order while the arrow and rows exchange direction. | Arrow flip, Row reorder | BUTTON Ascending | Sorted in descending order. |
| 242 | buttons | Pin item | Pin or unpin one local item with a thumbtack that rotates into its resting position. | Pin settle, Soft press | BUTTON Pin item | Item is pinned. Activate again to unpin. |
| 243 | buttons | Print document | Run a print callback while a page feeds through the printer and resolves to a check. | Paper feed, Check draw | BUTTON Print | Demo finished locally. No print job was created. |
| 244 | buttons | Search reveal | Reveal a working local search field, filter literal project names and choose a result. | Field reveal, Chevron turn | BUTTON Search | 3 results. |
| 245 | buttons | Visibility toggle | Show or hide local content with an eye that opens and removes its diagonal stroke. | Eye reveal, Slash dissolve | BUTTON Show | Content is visible. Activate again to hide it. |
| 246 | buttons | Zoom view | Step a local view through 100%, 125% and 150%, then return to its original scale. | Sample scale, Magnifier to reset | BUTTON Zoom in | View zoom: 125%. |
| 247 | buttons | Expand or collapse | Switch a local display mode with four corner strokes that move continuously outward and inward. | Corner travel, Soft press | BUTTON Expand | Display is expanded. Activate again to collapse it. |
| 248 | buttons | Grid or list view | Switch between grid and list presentation with cells that flow into aligned rows. | Grid to list, Cell flow | BUTTON List view | List view is active. |
| 249 | buttons | Sidebar toggle | Open or close a local sidebar state while a panel slides inside a stable frame. | Panel slide, Divider reveal | BUTTON Open panel | Sidebar is open. Activate again to close it. |
| 250 | buttons | Notifications toggle | Enable or silence local alerts with a bell that settles as its diagonal stroke disappears. | Bell settle, Slash dissolve | BUTTON Enable alerts | Notifications are on. Activate again to mute them. |
| 251 | buttons | Attachment toggle | Attach or remove one local draft file with a clean paperclip that settles without an extra badge. | Paperclip settle, Soft press | BUTTON Attach file | A local draft file is attached. Activate again to remove it. |
| 252 | buttons | Undo action | Run a real undo callback with a short backward arrow motion and immediate confirmation. | Arrow rewind, Check draw | BUTTON Undo | Demo finished locally. No application action was changed. |
| 253 | buttons | Move item | Run a real move callback while an item follows its arrow and resolves to a check. | Item travel, Check draw | BUTTON Move item | Demo finished locally. No item was moved. |
| 254 | buttons | Text editor toolbar | Format an editable local text sample with seven compact controls in one coordinated toolbar. | Toolbar press, Format transition | BUTTON Apply bold | Bold on. |
| 255 | buttons | Image transform toolbar | Rotate and mirror one local image sample from a coordinated two-action toolbar. | Forward rotation, Mirror transition | BUTTON Rotate image to 90 degrees | Rotation: 90°. |
| 256 | buttons | Crop mode | Enter or leave a local crop mode while handles close around the visible sample. | Handle close, Image scale | BUTTON Start crop | Crop mode is on. |
| 257 | buttons | Cart item | Add or remove one local product with a compact cart whose plus turns into a check. | Cart settle, Plus-to-check draw | BUTTON Add to cart | Item is in the cart. |
| 258 | buttons | Archive item | Archive or restore a local document with direction-aware sheet and lid motion. | Document descent and return, Archive lid settle | BUTTON Archive | Item is archived. |
| 259 | buttons | Complete task | Complete or reopen one local task with two optically centered checks and a controlled line draw. | Centered check draw, Text strike | BUTTON Mark done | Task is complete. |
| 260 | buttons | Assign person | Assign or remove one local teammate as a clean single-contour avatar docks into a task slot. | Single-contour avatar dock, Connector retract | BUTTON Assign person | Alex is assigned. |
| 261 | buttons | Compare items | Split two already-visible local cards from one stack and connect their aligned edges. | Symmetric split, Straight connector | BUTTON Compare | Two items are separated for comparison. |
| 262 | buttons | New folder | Create or remove a local folder preview with layered documents and a hinged front panel. | Folder hinge, Document rise | BUTTON New folder | Demo folder is visible. |
| 263 | buttons | Comment on selection | Attach or remove one local review note from a visibly selected line of copy. | Anchored bubble, Comment reveal | BUTTON Add comment | Selected text has one comment. |
| 264 | buttons | Translate text | Switch a fixed local phrase between English and Russian with a calm directional handoff. | Word handoff, Arrow exchange | BUTTON Translate | Sample language is Russian. |
| 265 | buttons | Tag item | Attach or remove one local category tag with compact uppercase typography and a balanced icon. | Tag settle, Label reveal | BUTTON Add tag | Item is tagged Design. |
| 266 | buttons | Add photo | Add or clear a synthetic local photo as a complete image card settles over a small print stack. | Photo settle, Print fan | BUTTON Add photo | Demo photo is selected. |
| 267 | buttons | Close item | Close or reopen one local item as a clean cross gives way to a return arrow. | Cross retract, Return draw | BUTTON Close item | Item is closed locally. |
| 268 | buttons | Open externally | Move a local preview out of its frame and return it with one continuous diagonal gesture. | Diagonal launch, Frame settle | BUTTON Open externally | Preview is shown externally in this demo. |
| 269 | buttons | Read status | Mark one local message read or unread as the envelope settles and a centered check draws inside it. | Envelope settle, Inner check draw | BUTTON Mark read | Message is read. |
| 270 | buttons | Flag item | Flag or clear one local item as the empty fabric contour fills cleanly without an extra badge. | Flag unfurl, Fabric fill | BUTTON Flag item | Item is flagged. |
| 271 | buttons | Snooze item | Snooze or resume one local item as alarm-clock hands resolve into a centered pause mark. | Alarm settle, Pause resolve | BUTTON Snooze item | Item is snoozed locally. |
| 272 | buttons | Publish item | Move one local draft into a published state while its arrow resolves into a check. | Arrow rise, Check resolve | BUTTON Publish item | Item is marked published locally. |
| 273 | buttons | Sync item | Include or remove one local item from sync with two continuous opposing arrows. | Arrow exchange, Sync check | BUTTON Sync item | Item is marked for sync. |
| 274 | buttons | Report issue | Select or cancel one local report draft as an alert resolves into confirmation. | Alert retract, Confirmation draw | BUTTON Report issue | A local report draft is selected. |
| 275 | buttons | Power control | Turn one local control on or off with a stable power-button glyph and a restrained press pulse. | Power pulse, Ring settle | BUTTON Turn on | Control is on. |
| 276 | buttons | Group items | Group or ungroup local items as two cards meet inside one shared boundary and separate along the same path. | Card convergence, Boundary draw | BUTTON Group items | Items are grouped. |
| 277 | inputs | Username input | Validate a concise profile handle while preserving the user’s editable draft. | Reversible field focus, Smooth validation | INPUT Username | Available format. |
| 278 | inputs | Slug input | Edit a readable Unicode page path with live validation and a literal path preview. | Reversible field focus, Smooth validation | INPUT Page slug | Readable path is ready. |
| 279 | inputs | Percentage input | Enter a bounded percentage and read the same value through a smoothly updating meter. | Reversible field focus, Smooth validation | INPUT Completion percentage | Percentage is within range. |
| 280 | inputs | Coordinate input | Edit latitude and longitude together with clear geographic bounds and a compact position preview. | Reversible field focus, Smooth validation | INPUT Latitude | Coordinates are within geographic bounds. |
| 281 | inputs | Semantic version input | Compose major, minor and patch numbers as one valid semantic version. | Reversible field focus, Smooth validation | INPUT Major version | Semantic version is complete. |
| 282 | inputs | IPv4 input | Enter, paste and validate a complete dotted IPv4 address in one familiar field. | Reversible field focus, Smooth validation | INPUT IPv4 address | IPv4 address is complete. |
| 283 | inputs | Card number input | Format and locally validate a payment-card number without sending or storing it. | Reversible field focus, Smooth validation | INPUT Card number | Number passes the local checksum. |
| 284 | inputs | Shortcut input | Capture one keyboard chord with clear recording, cancellation and removal states. | Reversible field focus, Smooth validation | INPUT Keyboard shortcut | Shortcut saved locally. |
| 285 | inputs | Search and replace input | Preview a literal local text replacement before applying it to a sample line. | Reversible field focus, Smooth validation | INPUT Find text | 1 literal match found. |
| 286 | inputs | Formula input | Evaluate basic arithmetic with a small local parser and no dynamic code execution. | Reversible field focus, Smooth validation | INPUT Formula | Expression calculated locally. |
| 287 | selection | Line wrap | Toggle editor line wrapping with a compact code preview that reflows without losing content. | Switch travel, Line reflow | BUTTON[switch] On | Long lines stay on one row. |
| 288 | selection | Sticky header | Keep a page header attached while scrolling, with a miniature layout that shows the exact behavior. | Switch travel, Header docking | BUTTON[switch] Off | Header stays attached while scrolling. |
| 289 | selection | Grid overlay | Show or hide a layout grid over a canvas while keeping artwork clearly visible. | Switch travel, Grid reveal | BUTTON[switch] Off | Layout grid is visible. |
| 290 | selection | Hide balances | Mask sensitive totals locally while preserving labels and the surrounding financial layout. | Switch travel, Value mask | BUTTON[switch] Off | Balances are masked. |
| 291 | selection | Link previews | Expand or collapse a contextual link card without changing the original message text. | Switch travel, Preview expansion | BUTTON[switch] On | Only the link text is shown. |
| 292 | selection | Completed items | Show or collapse completed rows while leaving active tasks untouched and in place. | Switch travel, Row collapse | BUTTON[switch] On | Completed items are collapsed. |
| 293 | selection | Autoplay previews | Choose whether muted media previews start automatically, with a clear static state indicator. | Switch travel, Playback cue | BUTTON[switch] Off | Muted previews start automatically. |
| 294 | selection | Text direction | Switch a writing surface between left-to-right and right-to-left flow with proper radio behavior. | Segment selection, Text realignment | BUTTON[radio] Left to right | Text flows from left to right. |
| 295 | selection | Link destination | Choose whether links reuse the current tab or open a new one, with an explicit two-state preview. | Segment selection, Tab reveal | BUTTON[radio] Same tab | Links reuse the current tab. |
| 296 | selection | Sidebar labels | Toggle a navigation rail between icons only and labeled items without changing the active destination. | Segment selection, Sidebar expansion | BUTTON[radio] Icons only | The sidebar shows icons only. |
| 297 | menus | Project questions | Project questions with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Can I change the colors? |  |
| 298 | selection | Project format | Project format with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Choose a format |  |
| 299 | selection | Project topics | Project topics with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Project topics
1 | Topics selected: 1. |
| 300 | inputs | Sample document queue | Sample document queue with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Choose demo file | The queue is empty. |
| 301 | inputs | Project brief wizard | Project brief wizard with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON About you |  |
| 302 | navigation | Studio navigation | Studio navigation with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Find |  |
| 303 | data-display | Project collection | Project collection with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Previous project | The project is not saved yet. |
| 304 | selection | Section order | Section order with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Move up | Changes apply only to this example. |
| 305 | data-display | Local project discussion | Local project discussion with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Reply |  |
| 306 | selection | Privacy preferences | Privacy preferences with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT  | Essential features are always enabled. |
| 307 | inputs | Library material search | Library material search with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT[combobox]  | Materials: 4. |
| 308 | navigation | Project workspace | Project workspace with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON[tab] Overview |  |
| 309 | selection | Material filters | Material filters with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Categories
1 | Showing: 2 of 4. |
| 310 | data-display | Featured material | Featured material with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Bookmark | Added to favorites. |
| 311 | inputs | Project brief contact form | Project brief contact form with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT Your name |  |
| 312 | inputs | Subscription example | Subscription example with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT Email | Local subscription demonstration. |
| 313 | buttons | Page direction chooser | Page direction chooser with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Choose a direction |  |
| 314 | checkboxes | Project feature set | Project feature set with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT  | Features selected: 1. |
| 315 | feedback | Dismissible announcement | Dismissible announcement with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Hide | Announcement dismissed in this example. |
| 316 | navigation | Studio footer | Studio footer with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Library | Choose a section. |
| 317 | inputs | Sign-in and recovery example | Sign-in and recovery example with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Sign in | This is an example. No account sign-in takes place. |
| 318 | inputs | Profile registration example | Profile registration example with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT Your name | Data stays in this preview. No account is created. |
| 319 | inputs | Email and message contact form | Email and message contact form with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT Your email | This is an example form. No message is sent. |
| 320 | inputs | Appointment slot chooser | Appointment slot chooser with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Today | Choosing a time does not create an appointment. |
| 321 | selection | Billing period plan | Billing period plan with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Month | Choose a period and review the total. No payment takes place. |
| 322 | data-display | Plan comparison | Plan comparison with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Basic | Both plans are examples. |
| 323 | data-display | Sample review carousel | Sample review carousel with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Back | «I built a prototype in an evening. The states were ready; I only needed to adjust the details.»
AM
Anna Morozova

Produ |
| 324 | data-display | Team contacts | Team contacts with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Anna | Names and contacts are examples. |
| 325 | data-display | Visits overview | Visits overview with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON 7 days | A sample dataset, not live analytics. |
| 326 | data-display | Project process | Project process with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Discovery | Example section: choose a step to see its details. |
| 327 | selection | Product set chooser | Product set chooser with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Compact | Sample product. Nothing is submitted to an order. |
| 328 | selection | Local shopping cart | Local shopping cart with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON − | Example cart. No checkout takes place. |
| 329 | selection | Delivery method chooser | Delivery method chooser with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Pickup point | Prices and addresses are examples only. |
| 330 | inputs | Sample promo code | Sample promo code with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT Promo code | The promo code works only in this local example. |
| 331 | data-display | Saved material collection | Saved material collection with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Remove | «Form fields» removed. You can restore the whole collection. |
| 332 | navigation | Article reading guide | Article reading guide with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Start with the main task | The mouse wheel, Page Down and contents links control the same article. |
| 333 | data-display | Material selection table | Material selection table with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT  | Rows selected: 3. |
| 334 | feedback | Local notification inbox | Local notification inbox with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Mark all read | All items marked as read only in this preview. |
| 335 | buttons | Export settings preview | Export settings preview with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON JSON | No file is downloaded. This is a local settings demonstration. |
| 336 | feedback | Page recovery search | Page recovery search with the reviewed local state and reversible motion. | Reversible reveal, Soft press | INPUT[searchbox] Search the site | Search covers four built-in sections. |
| 337 | buttons | Back to top | Back to top with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Back to top
Back to top | Returned to the top of the example. |
| 338 | buttons | Show more | Show more with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Show more
Show more | Showing 6 of 9 items. |
| 339 | buttons | Reset settings | Reset settings with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Reset settings
Reset settings | Example defaults restored. |
| 340 | buttons | Redo action | Redo action with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Redo
Redo | The undone title has been restored. |
| 341 | buttons | Invert selection | Invert selection with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Invert | Selected: Work. |
| 342 | buttons | Expand all | Expand all with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Expand all
Collapse all | Both sections expanded. |
| 343 | buttons | Invite member | Invite member with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Invite
Invite | Your application can send an invitation here. This example sends nothing. |
| 344 | buttons | Sign out | Sign out with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Sign out
Sign out | Your application can end the session here. You have not been signed out. |
| 345 | buttons | Call | Call with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Call
Call | Your application can start a call here. This example starts no call. |
| 346 | buttons | Compose email | Compose email with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Compose email
Compose email | Your application can open an email here. This example opens no mail app. |
| 347 | buttons | Support chat | Support chat with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Support chat
Support chat | Your application can open support chat here. This example only demonstrates the action. |
| 348 | buttons | Get directions | Get directions with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Get directions
Get directions | Your application can open directions here. No location is requested. |
| 349 | buttons | Add to calendar | Add to calendar with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Add to calendar
Add to calenda | Your application can add an event here. Your calendar is unchanged. |
| 350 | selection | Price currency | Price currency with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON ₽ RUB | Fixed example prices, not exchange rates. |
| 351 | selection | Checkout payment choice | Checkout payment choice with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON[radio] Bank card
Online after checkou | No payment is made and no order is placed. |
| 352 | inputs | Signature field | Signature field with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Draw | Example field, not a legal signature. |
| 353 | selection | Single-vote poll | Single-vote poll with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON[radio] Practical examples | Sample results. No votes are sent. |
| 354 | data-display | Partner marks | Partner marks with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Line | Fictional brands and original SVG marks for this example. |
| 355 | data-display | Business hours | Business hours with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Mon | Sample schedule, not a real studio status. |
| 356 | sliders | Resizable panels | Resizable panels with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON Equal widths | Left 50%, right 50%. Use the left and right arrow keys to resize. |
| 357 | data-display | Order tracking | Order tracking with the reviewed local state and reversible motion. | Reversible reveal, Soft press | BUTTON SL-2048 | Local sample orders. No data is loaded. |
| 358 | inputs | Profile editor | Profile editor with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | INPUT Full name | Local example. Changes are not sent to a server. |
| 359 | inputs | Verified contact replacement | Verified contact replacement with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Email | Local example. Changes are not sent to a server. |
| 360 | inputs | Password change | Password change with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | INPUT Current password | Local example. Changes are not sent to a server. |
| 361 | data-display | Active sessions | Active sessions with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON End session | Local example. Changes are not sent to a server. |
| 362 | selection | Sign-in methods | Sign-in methods with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Disconnect | Local example. Changes are not sent to a server. |
| 363 | selection | Two-step protection | Two-step protection with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Connect | Local example. Changes are not sent to a server. |
| 364 | data-display | Recovery codes | Recovery codes with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | INPUT  | Local example. Changes are not sent to a server. |
| 365 | data-display | Passkey manager | Passkey manager with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Name | Local example. Changes are not sent to a server. |
| 366 | selection | Profile visibility | Profile visibility with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | INPUT  | Local example. Changes are not sent to a server. |
| 367 | inputs | Saved addresses | Saved addresses with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Edit | Local example. Changes are not sent to a server. |
| 368 | selection | Communication preferences | Communication preferences with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | INPUT  | Local example. Changes are not sent to a server. |
| 369 | data-display | Security history | Security history with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON All | Local example. Changes are not sent to a server. |
| 370 | inputs | Document recipient | Document recipient with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Individual | Local example. Changes are not sent to a server. |
| 371 | selection | Saved payment methods | Saved payment methods with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Remove | Local example. Changes are not sent to a server. |
| 372 | data-display | Account documents | Account documents with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON All | Local example. Changes are not sent to a server. |
| 373 | selection | Subscription management | Subscription management with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Month | Local example. Changes are not sent to a server. |
| 374 | data-display | Purchase history | Purchase history with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON October 12 order
Received · 2  | Local example. Changes are not sent to a server. |
| 375 | inputs | Purchase returns | Purchase returns with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Notebook | Local example. Changes are not sent to a server. |
| 376 | inputs | Support tickets | Support tickets with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Delivery question
Open · today | Local example. Changes are not sent to a server. |
| 377 | buttons | Account data export | Account data export with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | INPUT  | Local example. Changes are not sent to a server. |
| 378 | selection | Language and region | Language and region with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Russian | Local example. Changes are not sent to a server. |
| 379 | data-display | Account balance | Account balance with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON All | Local example. Changes are not sent to a server. |
| 380 | selection | Reward redemption | Reward redemption with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Icon set
300 points | Local example. Changes are not sent to a server. |
| 381 | data-display | Referral results | Referral results with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Anna
Condition met | Local example. Changes are not sent to a server. |
| 382 | data-display | Product licenses and devices | Product licenses and devices with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Studio collection
Perpetual li | Local example. Changes are not sent to a server. |
| 383 | inputs | Your appointments | Your appointments with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Design review
Upcoming · Octob | Local example. Changes are not sent to a server. |
| 384 | inputs | Your reviews | Your reviews with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Composition course
Published | Local example. Changes are not sent to a server. |
| 385 | selection | Organization members | Organization members with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Anna Smith
Owner · You | Local example. Changes are not sent to a server. |
| 386 | inputs | Organization ownership transfer | Organization ownership transfer with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Boris | Local example. Changes are not sent to a server. |
| 387 | selection | Account lifecycle | Account lifecycle with application-owned actions and an explicit local demonstration. | Reversible reveal, Soft press | BUTTON Pause | Local example. Changes are not sent to a server. |
