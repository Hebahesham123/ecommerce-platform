/// The whole app: the tabs along the bottom, and what sits above them.
/// Port of App.tsx.
///
/// Two things live here because everything else needs them and nothing else
/// owns them — the basket and the signed-in token. The basket is kept as ids
/// and quantities only; every price on screen comes back from the shop
/// through /cart/price, so a basket edited on the phone cannot make anything
/// cheaper.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/api.dart';
import 'core/json.dart';
import 'core/links.dart';
import 'core/prefs.dart';
import 'core/style.dart';
import 'core/theme.dart';
import 'home/home_screen.dart';
import 'screens/app_chrome.dart';
import 'screens/cart_screen.dart';
import 'screens/checkout_screen.dart';
import 'screens/collection_screen.dart';
import 'screens/offer_popup.dart';
import 'screens/page_screen.dart';
import 'screens/product_screen.dart';
import 'screens/reels_screen.dart';
import 'screens/search_results.dart';
import 'screens/sign_in_screen.dart';
import 'screens/splash.dart';
import 'screens/web_page.dart';
import 'widgets/icons.dart';
import 'widgets/tab_bar.dart';

/// A screen pushed on top of a tab. Tabs themselves are not pushed.
sealed class Route0 {
  const Route0();
}

class CollectionRoute extends Route0 {
  final String handle;
  final String? title;
  const CollectionRoute(this.handle, [this.title]);
}

class PageRoute0 extends Route0 {
  final String handle;
  const PageRoute0(this.handle);
}

class CollectionsRoute extends Route0 {
  const CollectionsRoute();
}

class SearchRoute extends Route0 {
  final String term;
  const SearchRoute(this.term);
}

class ProductRoute extends Route0 {
  final String id;
  final bool fromReel;
  const ProductRoute(this.id, {this.fromReel = false});
}

class CheckoutRoute extends Route0 {
  const CheckoutRoute();
}

class SignInRoute extends Route0 {
  const SignInRoute();
}

class PlacedRoute extends Route0 {
  final String orderNumber;
  const PlacedRoute(this.orderNumber);
}

/// One of the website's pages, inside the app.
class WebRoute extends Route0 {
  final String path;
  final String title;
  const WebRoute(this.path, this.title);
}

const String _tokenKey = 'app_token';
const String _phoneKey = 'app_phone';

class ShopApp extends StatefulWidget {
  /// Bumped when a new theme is applied mid-visit, so everything redraws
  /// without losing the basket or the screen she is on.
  final int rev;
  const ShopApp({super.key, this.rev = 0});
  @override
  State<ShopApp> createState() => _ShopAppState();
}

class _ShopAppState extends State<ShopApp> {
  late TabKey _tab = visibleTabs().isNotEmpty ? visibleTabs().first.s('key') : 'shop';
  List<String> _suggest = [];
  List<Route0> _stack = [];
  List<CartLine> _lines = [];
  PricedCart? _cart;
  ({String code, double amount})? _coupon;
  J? _loyalty;
  String? _giftBusy;
  String? _phone;
  bool _busy = false;
  String? _notice;
  Timer? _noticeTimer;
  String? _reelStart;
  String _query = '';
  String? _pendingCode;
  Timer? _searchTimer;
  int _priceRun = 0;

  Route0? get _top => _stack.isEmpty ? null : _stack.last;
  int get _count => _lines.fold(0, (n, l) => n + l.quantity);

  @override
  void initState() {
    super.initState();
    // The token is the account: kept on the phone so she signs in once.
    final t = prefs.getString(_tokenKey);
    final p = prefs.getString(_phoneKey);
    if (t != null && p != null) {
      setToken(t);
      _phone = p;
      _loadLoyalty();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _screenView());
  }

  @override
  void dispose() {
    _noticeTimer?.cancel();
    _searchTimer?.cancel();
    super.dispose();
  }

  // ------------------------------------------------------------- analytics --

  void _screenView() {
    final top = _top;
    final String path;
    if (top == null) {
      path = '/$_tab';
    } else if (top is ProductRoute) {
      path = '/product/${top.id}';
    } else if (top is CollectionRoute) {
      path = '/collection/${top.handle}';
    } else if (top is PageRoute0) {
      path = '/page/${top.handle}';
    } else {
      path = '/${_kind(top)}';
    }
    screenView(path);
  }

  String _kind(Route0 r) => switch (r) {
        CollectionRoute() => 'collection',
        PageRoute0() => 'page',
        CollectionsRoute() => 'collections',
        SearchRoute() => 'search',
        ProductRoute() => 'product',
        CheckoutRoute() => 'checkout',
        SignInRoute() => 'signin',
        PlacedRoute() => 'placed',
        WebRoute() => 'web',
      };

  /// Every change of tab or screen goes through here, so it is counted once.
  void _nav(VoidCallback change) {
    final beforeTab = _tab;
    final beforeTop = _top;
    setState(change);
    if (beforeTab != _tab || !identical(beforeTop, _top)) _screenView();
  }

  void _say(String text) {
    _noticeTimer?.cancel();
    setState(() => _notice = text);
    // A note says its piece and goes; one that lingers is in the way.
    _noticeTimer = Timer(const Duration(milliseconds: 2600), () {
      if (mounted) setState(() => _notice = null);
    });
  }

  void _push(Route0 r) => _nav(() => _stack = [..._stack, r]);
  void _pop() => _nav(() => _stack = _stack.sublist(0, _stack.length - 1));

  // ---------------------------------------------------------------- basket --

  void _setLines(List<CartLine> next) {
    setState(() => _lines = next);
    _reprice();
  }

  /// Re-price whenever the basket changes. The basket follows the shop.
  Future<void> _reprice() async {
    final run = ++_priceRun;
    final lines = _lines;
    if (lines.isEmpty) {
      setState(() => _cart = null);
      _trackCart();
      return;
    }
    try {
      final c = await priceCart(lines);
      if (!mounted || run != _priceRun) return;
      setState(() => _cart = c);
      final corrected = c.lines.map((l) => CartLine(l.itemId, l.quantity)).toList();
      if (corrected.length != lines.length || c.lines.any((l) => l.adjusted)) {
        setState(() => _lines = corrected);
        if (c.removed.isNotEmpty) _say('Some items sold out and were removed.');
      }
      _trackCart();
      if (_pendingCode != null && _lines.isNotEmpty) {
        final code = _pendingCode!;
        _pendingCode = null;
        _applyCoupon(code);
      }
    } catch (_) {}
  }

  /// The basket as she left it, for the shop's customer page.
  void _trackCart() {
    trackCart((_lines.isNotEmpty ? (_cart?.lines ?? <PricedLine>[]) : <PricedLine>[])
        .map((l) => {
              'itemId': l.itemId,
              'name': l.variantTitle != null && l.variantTitle!.isNotEmpty ? '${l.productName} - ${l.variantTitle}' : l.productName,
              'imageUrl': l.imageUrl,
              'price': l.price,
              'quantity': l.quantity,
            })
        .toList());
  }

  void _add(String variantId, [Product? product]) {
    track('add_to_cart', {
      'productId': product != null ? product.id : variantId,
      if (product != null) 'productName': product.name,
      if (product != null) 'imageUrl': product.image,
      if (product != null) 'value': product.priceMin,
      'quantity': 1,
    });
    final found = _lines.any((l) => l.itemId == variantId);
    _setLines(found
        ? _lines.map((l) => l.itemId == variantId ? CartLine(l.itemId, l.quantity + 1) : l).toList()
        : [..._lines, CartLine(variantId, 1)]);
    _say('Added to your basket');
  }

  void _setQuantity(String itemId, int quantity) {
    _setLines(quantity <= 0
        ? _lines.where((l) => l.itemId != itemId).toList()
        : _lines.map((l) => l.itemId == itemId ? CartLine(itemId, quantity) : l).toList());
  }

  Future<void> _applyCoupon(String code) async {
    if (code.isEmpty) {
      setState(() => _coupon = null);
      return;
    }
    try {
      tap('Apply coupon');
      final res = await previewDiscount(code, _lines);
      if (!mounted) return;
      if (res.b('ok')) {
        setState(() => _coupon = (code: res.s('code'), amount: res.n('amount')));
        _say(res.s('label'));
      } else {
        setState(() => _coupon = null);
        _say('That code does not apply to this basket.');
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _coupon = null);
      _say('That code could not be checked.');
    }
  }

  // --------------------------------------------------------------- rewards --

  /// Her standing, once she is signed in. A guest has no rewards to offer.
  Future<void> _loadLoyalty() async {
    try {
      final l = await fetchLoyalty();
      if (mounted) setState(() => _loyalty = l);
    } catch (_) {
      /* a shop without a loyalty programme simply has no rewards */
    }
  }

  String? get _giftNote {
    final next = nextGift(_loyalty);
    if (next == null) return null;
    String n(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();
    return '${n(next.short)} more signatures for ${next.title} — you have ${n(next.balance)} so far';
  }

  /// Spend a gift on this basket. The app never decides to spend her points for her.
  Future<void> _useGift(Gift g) async {
    if (_giftBusy != null) return;
    setState(() => _giftBusy = g.id);
    try {
      var code = g.code;
      if (!g.ready) {
        final res = await redeemReward(g.id);
        code = res.o('userReward').s('code');
        _loadLoyalty();
        if (code.isEmpty) {
          _say('Redeemed - it comes with your order.');
          return;
        }
      }
      await _applyCoupon(code);
    } catch (e) {
      _say(e.toString());
    } finally {
      if (mounted) setState(() => _giftBusy = null);
    }
  }

  // ------------------------------------------------------- account & order --

  void _signedIn(String token, String who) {
    setToken(token);
    prefs.setString(_tokenKey, token);
    prefs.setString(_phoneKey, who);
    _nav(() {
      _phone = who;
      _stack = _stack.where((s) => s is! SignInRoute).toList();
    });
    _loadLoyalty();
  }

  void _checkout() {
    track('checkout_start', {'value': _cart?.subtotal, 'quantity': _count});
    if (_phone == null) return _push(const SignInRoute());
    _push(const CheckoutRoute());
  }

  Future<void> _place(Address address) async {
    final phone = _phone;
    if (phone == null) return;
    setState(() => _busy = true);
    tap('Place order');
    try {
      final number = await placeOrder(address, phone: phone, couponCode: _coupon?.code, lines: _lines);
      _setLines([]);
      _nav(() {
        _coupon = null;
        _stack = [PlacedRoute(number)];
      });
    } catch (e) {
      _say(e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ------------------------------------------------------------ navigation --

  void _goTab(TabKey k) {
    // Leaving the feed (or coming back to it) starts on the grid.
    if (k != _tab) reelIsOpen = false;
    _nav(() {
      _stack = [];
      _query = '';
      _tab = k;
    });
  }

  /// A link that points at a whole screen.
  void _goScreen(String screen) {
    // "search:<words>" - a link to the results for those words.
    if (screen.startsWith('search:')) return _push(SearchRoute(screen.substring(7)));
    if (screen == 'home' || screen == 'search') return _goTab('shop');
    // A specific replay — open the feed on that one rather than on whatever is newest.
    if (screen.startsWith('reel:')) {
      _reelStart = screen.substring(5);
      return _goTab('reels');
    }
    // A live on air: its broadcast, inside the app.
    if (screen.startsWith('live:')) {
      return _push(WebRoute('/store/live/${Uri.encodeComponent(screen.substring(5))}', 'Live'));
    }
    if (screen == 'live') return _goTab('shop');
    if (screen == 'cart' || screen == 'orders' || screen == 'account' || screen == 'reels') return _goTab(screen);
    if (screen == 'collections') return _push(const CollectionsRoute());
    // One of the merchant's own pages, if the handle names one.
    if (theme.l('pages').any((p) => p.s('handle') == screen)) return _push(PageRoute0(screen));
    _say(screen == 'reviews' ? 'Reviews are on the home screen.' : 'Coming soon in the app.');
  }

  LinkHandlers get _links => LinkHandlers(
        onOpenCollection: (h) => _push(CollectionRoute(h)),
        onOpenProduct: (id) => _push(ProductRoute(id)),
        onOpenScreen: _goScreen,
      );

  void _onQuery(String v) {
    _nav(() {
      _query = v;
      if (v.isNotEmpty) {
        _stack = [];
        _tab = 'shop';
      }
    });
    // What she searched for in the header, once she has stopped typing.
    _searchTimer?.cancel();
    final term = v.trim();
    if (term.length >= 2) {
      _searchTimer = Timer(const Duration(milliseconds: 1200), () {
        track('search', {'term': term.length > 100 ? term.substring(0, 100) : term});
      });
    }
  }

  /// Android's back button walks back through the stack, then to the first tab.
  bool get _canExit => _stack.isEmpty && _tab == (visibleTabs().isNotEmpty ? visibleTabs().first.s('key') : 'shop') && _query.isEmpty;

  void _back() {
    if (_stack.isNotEmpty) return _pop();
    if (_query.isNotEmpty) return _nav(() => _query = '');
    _goTab(visibleTabs().isNotEmpty ? visibleTabs().first.s('key') : 'shop');
  }

  // ---------------------------------------------------------------- drawing --

  Widget _body() {
    final top = _top;
    if (top != null) {
      switch (top) {
        case CollectionsRoute():
          return AllCollectionsScreen(onOpen: (handle, title) => _push(CollectionRoute(handle, title)));
        case PageRoute0():
          final page = theme.l('pages').firstWhere((p) => p.s('handle') == top.handle,
              orElse: () => J({'id': '', 'handle': top.handle, 'items': <dynamic>[]}));
          return PageScreen(
            page: page,
            onOpen: (tile) {
              if (tile.s('url').isNotEmpty) {
                openUrl(tile.s('url'));
                return;
              }
              if (tile.s('productId').isNotEmpty) return _push(ProductRoute(tile.s('productId')));
              if (tile.s('screen').isNotEmpty) return _goScreen(tile.s('screen'));
              if (tile.s('handle').isNotEmpty) _push(CollectionRoute(tile.s('handle'), tile.s('label')));
            },
          );
        case CollectionRoute():
          return CollectionScreen(
            key: ValueKey('c-${top.handle}'),
            handle: top.handle,
            onOpenProduct: (id) => _push(ProductRoute(id)),
            onAdd: (v) => _add(v),
          );
        case SearchRoute():
          return SearchResults(key: ValueKey('s-${top.term}'), query: top.term, onOpenProduct: (id) => _push(ProductRoute(id)));
        case ProductRoute():
          return ProductScreen(
            key: ValueKey('p-${top.id}-${_stack.length}'),
            id: top.id,
            onPullBack: top.fromReel ? _pop : null,
            onAdd: _add,
            onBuyNow: (v, product, quantity) {
              for (var i = 0; i < quantity; i++) {
                _add(v, product);
              }
              _goTab('cart');
            },
            onOpenProduct: (id) => _push(ProductRoute(id)),
            onOpenScreen: _goScreen,
            signedIn: _phone != null,
            onOpenCollection: (h) => _push(CollectionRoute(h)),
          );
        case WebRoute():
          return WebPage(key: ValueKey('w-${top.path}'), path: top.path);
        case CheckoutRoute():
          return CheckoutScreen(phone: _phone ?? '', busy: _busy, onPlace: _place);
        case SignInRoute():
          return SignInScreen(onSignedIn: _signedIn);
        case PlacedRoute():
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(Spacing.xl),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text('Thank you', style: ts(22, w: 700, c: colors.ink)),
                const SizedBox(height: Spacing.sm),
                Text('Your order is ${top.orderNumber}.', style: ts(14, c: colors.inkMuted)),
                const SizedBox(height: Spacing.sm + Spacing.md),
                GestureDetector(
                  onTap: () => _goTab('shop'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(10)),
                    child: Text('Keep shopping', style: ts(14, w: 700, c: Colors.white)),
                  ),
                ),
              ]),
            ),
          );
      }
    }
    if (_tab == 'shop' && _query.trim().isNotEmpty) {
      return SearchResults(key: ValueKey('q-${_query.trim()}'), query: _query.trim(), onOpenProduct: (id) => _push(ProductRoute(id)));
    }
    switch (_tab) {
      case 'shop':
        return HomeScreen(
          handlers: HomeHandlers(links: _links, onAdd: (v, _) => _add(v), signedIn: _phone != null),
          onCollections: (t) => setState(() => _suggest = t),
        );
      case 'reels':
        return const SizedBox.shrink(); // drawn below, under whatever is opened from it
      case 'cart':
        return CartScreen(
          lines: _cart?.lines ?? const [],
          subtotal: _cart?.subtotal ?? 0,
          discount: _coupon?.amount ?? 0,
          gifts: giftsFrom(_loyalty),
          giftNote: _giftNote,
          giftBusy: _giftBusy,
          onUseGift: _useGift,
          onChangeQuantity: _setQuantity,
          onApplyCoupon: screens.o('cart').b('showCoupon', true) ? _applyCoupon : null,
          onCheckout: _checkout,
          onOpenCollection: (h) => _push(CollectionRoute(h)),
          onOpenProduct: (id) => _push(ProductRoute(id)),
          onOpenScreen: _goScreen,
          onAddBundle: (v) => _add(v),
          signedIn: _phone != null,
        );
      case 'orders':
        return const WebPage(key: ValueKey('orders'), path: '/store/account/orders');
      default:
        return const WebPage(key: ValueKey('account'), path: '/store/account');
    }
  }

  String get _heading {
    final top = _top;
    if (top == null) return theme.s('storeName');
    return switch (top) {
      CheckoutRoute() => say(screens.o('checkout').s('title'), 'Checkout'),
      SignInRoute() => 'Sign in',
      CollectionRoute() => top.title ?? '',
      WebRoute() => top.title,
      _ => '',
    };
  }

  /// Which screen she is on, for the shop to choose a popup for.
  OfferContext get _offerContext {
    final top = _top;
    if (top != null) {
      return switch (top) {
        ProductRoute() => OfferContext('product', productKey: top.id),
        CollectionRoute() => OfferContext('collection', collectionHandle: top.handle),
        SearchRoute() => const OfferContext('search'),
        CheckoutRoute() || SignInRoute() || PlacedRoute() => const OfferContext('checkout'),
        _ => const OfferContext('other'),
      };
    }
    if (_tab == 'shop') return OfferContext(_query.trim().isNotEmpty ? 'search' : 'index');
    if (_tab == 'cart') return const OfferContext('cart');
    return const OfferContext('other');
  }

  @override
  Widget build(BuildContext context) {
    final top = _top;
    // The reels feed is a full-screen page with its own header; everything else wears the shop's.
    final chrome = !(_tab == 'reels' && _stack.isEmpty);

    // The reels feed stays loaded while a product opened from it is on top.
    final reels = ReelsScreen(
      key: const ValueKey('reels'),
      startId: _reelStart,
      paused: _stack.isNotEmpty,
      cartCount: _count,
      onClose: () => _goTab('shop'),
      onOpenProduct: (id) => _push(ProductRoute(id, fromReel: true)),
      onAdd: (itemId) => _add(itemId),
      onCheckout: () => _goTab('cart'),
      onOpenPage: (path) => _push(WebRoute(path, 'Review')),
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
      child: PopScope(
        canPop: _canExit,
        onPopInvokedWithResult: (didPop, _) {
          // An open reel takes the back press for itself (it closes the reel).
          if (didPop || (_tab == 'reels' && _stack.isEmpty && reelIsOpen)) return;
          _back();
        },
        child: Scaffold(
          backgroundColor: colors.page,
          resizeToAvoidBottomInset: true,
          body: SafeArea(
            child: Stack(children: [
              Column(children: [
                if (chrome)
                  AppChrome(
                    suggest: _suggest,
                    query: _query,
                    onQuery: _onQuery,
                    cartCount: _count,
                    onHome: () => _goTab('shop'),
                    onBag: () => _goTab('cart'),
                    // The saved list is kept on the website's account page.
                    onWishlist: () => _goTab('account'),
                    onOpenCollection: (handle) => _nav(() {
                      _query = '';
                      _tab = 'shop';
                      _stack = [CollectionRoute(handle)];
                    }),
                    onOpenProduct: (id) => _push(ProductRoute(id)),
                    onOpenScreen: _goScreen,
                  ),
                if (_stack.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: colors.surface, border: Border(bottom: BorderSide(color: colors.line))),
                    child: Row(children: [
                      GestureDetector(
                        onTap: _pop,
                        behavior: HitTestBehavior.opaque,
                        child: SizedBox(width: 28, height: 28, child: Center(child: HeaderIcon(name: 'back', color: colors.ink, size: 20))),
                      ),
                      const SizedBox(width: Spacing.sm),
                      Expanded(
                        child: Text(_heading,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(15, w: 700, c: colors.ink, family: titleFont)),
                      ),
                    ]),
                  ),
                Expanded(
                  child: Stack(children: [
                    if (_tab == 'reels') Positioned.fill(child: reels),
                    if (_tab != 'reels')
                      Positioned.fill(child: _body())
                    else if (top != null)
                      Positioned.fill(
                        child: Container(
                          // A product from the reel shows the reel when dragged; anything else covers it.
                          color: top is ProductRoute && top.fromReel ? null : colors.page,
                          child: _body(),
                        ),
                      ),
                  ]),
                ),
                TabBar0(active: _tab, cartCount: _count, onSelect: _goTab),
              ]),
              if (_notice != null)
                Positioned(
                  left: Spacing.lg,
                  right: Spacing.lg,
                  bottom: 78,
                  child: GestureDetector(
                    onTap: () => setState(() => _notice = null),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(color: colors.ink, borderRadius: BorderRadius.circular(10)),
                      child: Text(_notice!, textAlign: TextAlign.center, style: ts(12, c: Colors.white)),
                    ),
                  ),
                ),
              OfferPopup(
                context: _offerContext,
                cartCount: _count,
                onApplyCode: (code) {
                  if (_count > 0) {
                    _applyCoupon(code);
                    _goTab('cart');
                  } else {
                    _pendingCode = code;
                    _say('Your code $code is saved - it goes on your basket as soon as you add something.');
                  }
                },
              ),
              // Above everything, and gone by itself a moment later.
              Splash(
                onOpenCollection: (handle) => _nav(() {
                  _tab = 'shop';
                  _stack = [..._stack, CollectionRoute(handle, handle)];
                }),
                onOpenProduct: (id) => _nav(() {
                  _tab = 'shop';
                  _stack = [..._stack, ProductRoute(id)];
                }),
                onOpenScreen: _goScreen,
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
