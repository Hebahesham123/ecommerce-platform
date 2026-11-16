# Porting the BeautyBar React Native app to Flutter

Source (React Native, read-only): `C:\Users\DELL\Downloads\store-app`
- `components/*.tsx`, `App.tsx`, `HomeScreen.tsx`, `api.ts`, `theme.ts`, `screens.ts`
- Note: files contain CRLF line endings.

Target (Flutter): `C:\Users\DELL\Downloads\beautybar_flutter`
- Flutter SDK: `C:\Users\DELL\flutter\bin\flutter.bat` (not on PATH; call it by full path)
- Check your work: `C:/Users/DELL/flutter/bin/flutter.bat analyze lib/<your files>` from the project dir.
  Your files must analyze with **no errors and no warnings** before you finish.

## Goal: full visual + behavioural parity

Port each assigned `.tsx` file faithfully: same layout, sizes, colours, fonts, spacing,
radii, shadows, animations, timers, texts, and the same reading of every setting
(including defaults and the "number not above nought means as usual" style rules).
Keep the original comments' intent (short Dart doc comments are welcome; don't pad).
Do not invent features or simplify away behaviour. If something truly can't be done
in Flutter, do the closest equivalent and note it in a `// PORT NOTE:` comment.

## Rules

- **Only write the files you were assigned.** Do not edit any other file (foundation
  files below, registry, app.dart, other agents' files). If you need a helper that
  doesn't exist, define it privately inside your own file.
- Keep each stub's public class/function names and constructor signatures exactly
  (app.dart and the registry already call them). You may add optional parameters.
- Packages available: flutter (material + widgets), http, shared_preferences,
  flutter_svg, cached_network_image, url_launcher, webview_flutter, video_player, intl.
  Do not add packages.
- Do not run `flutter build`, `flutter pub add`, or `flutter create`. `flutter analyze` only.

## Foundation (already written — import, don't modify)

| File | What it gives you |
|---|---|
| `lib/core/json.dart` | `J` — wrapper over loose JSON. `j.s('k')` string ('' if absent), `j.sOr('k', fb)` (JS `v \|\| fb`), `j.n('k', fb)` double, `j.nOrNull('k')`, `j.i('k', fb)` int, `j.b('k', fb)` bool (JS truthiness; fb when absent), `j.o('k')` nested J, `j.l('k')` List<J>, `j.ls('k')` List<String>, `j.list('k')` raw list, `j.has('k')`, `j['k']` raw, `j.raw` map. `truthy(v)`. |
| `lib/core/color.dart` | `css(String, [fallback])` → Color from `#rgb/#rrggbb/#rrggbbaa(CSS alpha last)/rgb()/rgba()/transparent/names`. `tryCss`. `hexA(color, '12')` = RN `accent + "12"`. `cssA(str, '80')`. `toHex(color)`. `mix(from, to, t)` (Fade.tsx mix). |
| `lib/core/theme.dart` | Globals with the RN names: `theme` (J of ThemeData: storeName, titleFont, logoUrl, accent, background, menuHandle, pages, splash, showSearch, announcement, header, live, card, strip), `colors` (.accent .ink .inkMuted .inkSoft .surface .page .line as Color), `gap` (.section .item .itemTight), `Spacing.xs/sm/md/lg/xl`, `Radii.sm/md/lg/pill`, `layout` (.tabs List<J>, .home/.product/.cart List<PackBlock>), `screens` (J: screens.o('product').s('addLabel') ...), `say(chosen, fallback)`, `titleFont` (String? — 'serif' or null; use as `fontFamily`). |
| `lib/core/style.dart` | `ts(size, w: 700, c: color, lh: 14, ls: 0.5, family: titleFont, italic:, deco:, shadows:)` → TextStyle from RN props (lh is RN absolute lineHeight). `fw(700)`. `lift` (shadow-sm BoxShadow list). `rnShadow(color:, opacity:, radius:, offset:)`. |
| `lib/core/api.dart` | Everything in api.ts: `api(path, method:, body:)`, models `ProductCard` (RN `Card`: id, handle, name, image, priceMin, compareAt, vendor, variantId, variantCount, available, sold, raw), `CollectionInfo`, `HomePayload` (collections, rows Map<String,List<ProductCard>>, newArrivals, reviews List<J>, lives List<J>, payments List<J>), `Product`, `Variant`, `PricedLine`, `PricedCart`, `CartLine`, `Gift`, `Recommendations`, `Address`, `OfferContext`, `CollectionPayload`, `CollectionFilters`; functions `fetchHome`, `fetchProduct`, `searchProducts`, `fetchCollection`, `priceCart`, `previewDiscount`, `checkPhone`, `requestCode`, `verifyCode`, `loginVerified`, `fetchAccount`, `fetchOrders`, `placeOrder`, `fetchPayments`, `fetchReels` (List<J>), `viewReel`, `likeReel`, `decideOffer` (J? offer), `claimOffer`, `offerEvent`, `track`, `tap`, `screenView`, `trackCart`, `fetchRecommendations`, `fetchLoyalty`, `redeemReward`, `giftsFrom`, `nextGift`. Constants `apiBase`, `siteOrigin`; `token`, `visitor`. Untyped answers come back as `J`. |
| `lib/core/format.dart` | `money(v)` "1,049 EGP", `moneyFirst(v)` "EGP 1,049", `plainNumber(v)`, `grouped(n)`, `shortName(name, [words])`, `withoutVendor(name, vendor)`. |
| `lib/core/links.dart` | `LinkHandlers(onOpenCollection:, onOpenProduct:, onOpenScreen:)`, `openLink(J item, handlers)` (url → productId → screen → handle), `openUrl(url)`, `hasLink(J)`, typedefs `OnAdd = void Function(String variantId, String productId)`. |
| `lib/core/prefs.dart` | `prefs` (SharedPreferences, already initialised) — use for anything RN keeps in AsyncStorage (same keys). |
| `lib/widgets/svg.dart` | `Svg(body, size:/width:/height:, viewBox: '0 0 24 24', rootAttrs: 'fill="none" stroke="..."')` renders inline SVG markup; `sc(Color)` writes a colour for SVG. Port every `<Svg>` by transcribing its JSX children to SVG markup (use SVG attribute names: stroke-width, stroke-linecap, fill-opacity, ...). `currentColor` → `sc(color)`. |
| `lib/widgets/fade.dart` | `Fade(angle:, colors: [Color], locations:, borderRadius:, padding:, width:, height:, child:)` = Fade.tsx / CSS linear-gradient; `fadeGradient(angle:, colors:, stops:)` for BoxDecoration. Plain `LinearGradient` from expo → use Flutter `LinearGradient` with begin/end converted (`Alignment(x*2-1, y*2-1)`). |
| `lib/widgets/icons.dart` | `TabIcon(tab:, on:, color:, size:)`, `HeaderIcon(name: 'search'\|'heart'\|'bag'\|'back'\|'menu'\|'plus'\|'close', color:, size:)`. |
| `lib/widgets/pieces.dart` | Pieces.tsx: `SectionHeading(title:, onSeeAll:)`, `inherit(J item, collections)` → (image:, title:), `ProductTile(card:, width:, fill:, shape:, fit:, onPress:, onAdd:)`, `ProductTile.rowWidth`, `ProductRow(products:, onOpenProduct:, onAdd:, width:, shape:, fit:)` (horizontal row with gap.item), `CardNote`, `notesFor`, `Note`, `NoteMark`, `PlusMark(size:, color:, weight:)`, `Stars(score:, size:)`, `heartPath`, `isWished/setWished`, `NetImage(url, fit:, width:, height:, background:, alignment:)` (RN `<Image>`), `Tap(onTap:, child:)` (RN `<Pressable>` without ripple), `Bleed(child:)` (see below). Re-exports links + format. |
| `lib/home/section.dart` | `SectionCtx` — what a home section gets: `c.settings` (J), `c.data` (HomePayload), `c.recs` (Recommendations?), `c.links` (LinkHandlers), `c.onAdd` (OnAdd?), shortcuts `c.onOpenCollection/onOpenProduct/onOpenScreen`. |
| `lib/home/home_screen.dart` | `HomeHandlers(links:, onAdd:, signedIn:)`, `ProductSections(handlers:)`, `CartSections(handlers:)` — use these where RN draws `<ProductSections>`/`<CartSections>`. |

## Translation notes

- **Home sections** (`lib/home/sections/<type>.dart`): keep the stub's function
  `Widget? <name>Section(SectionCtx c)`. Map the RN component's props from the
  ctx: `settings` → `c.settings`, `collections` → `c.data.collections`,
  `rows` → `c.data.rows`, `newArrivals` → `c.data.newArrivals`, `lives` → `c.data.lives`,
  `reviews` → `c.data.reviews`, `payments` → `c.data.payments`, `recs` → `c.recs`,
  handlers → `c.links` / `c.onAdd`. **Return `null` exactly when the RN component
  renders `null`** (nothing to draw) — the home screen then drops the section and
  its kicker. Implement the actual drawing in a private (Stateful)Widget in the same
  file when it needs state, timers or animation.
- **Page gutter**: each home section is already wrapped in 16px horizontal padding.
  Where the RN code bleeds to the screen edge with `marginHorizontal: -spacing.lg`
  (or similar), wrap that part in `Bleed(child: ...)` and give the scrolling content
  its own `EdgeInsets.symmetric(horizontal: 16)` padding, as the RN contentContainerStyle does.
- RN `View` flex column is the default; `flexDirection: "row"` → Row; `gap` → SizedBox spacers;
  `flex: 1` → Expanded; `position: absolute` → Stack + Positioned; `overflow: hidden` + radius →
  ClipRRect; `numberOfLines` → maxLines + ellipsis; `aspectRatio` → AspectRatio;
  `opacity` → Opacity; `Animated` → AnimationController/Tween/AnimatedBuilder;
  `setInterval/setTimeout` → Timer (cancel in dispose); `useEffect` → initState/didUpdateWidget/dispose;
  `ScrollView horizontal` → SingleChildScrollView(scrollDirection: Axis.horizontal) or ListView;
  `Image resizeMode` → `NetImage(fit:)`; `Linking.openURL` → `openUrl`;
  `TextInput` → Material `TextField` with `InputDecoration.collapsed` and RN styles;
  `Modal` → an overlay in a Stack or `showGeneralDialog`; `useWindowDimensions` → `MediaQuery.sizeOf(context)`;
  `onLayout` width → LayoutBuilder.
- Percent widths (`width: "40%"`) → FractionallySizedBox or LayoutBuilder.
- Font weights are CSS numbers (`"700"` → `w: 700`). `fontFamily: theme.titleFont` → `family: titleFont`.
- Colours in RN source as hex strings → `Color(0xFFrrggbb)` constants, or `css(...)` for
  values read from settings. RN `"#0f172a80"`-style 8-digit hex is CSS (alpha last) → use `css()`.
- Default RN text colour is black, size 14 — always give an explicit `ts(...)`.
- Keep the files self-contained and readable; prefer a few private widgets over one giant build.
