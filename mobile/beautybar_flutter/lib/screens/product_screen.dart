/// One product, dressed as Beauty Bar's website. Every part is the merchant's -
/// App → App theme → Product. Port of ProductScreen.tsx.
///
/// The basket holds variant ids, never products: a product with three sizes has
/// three different things to have in stock, and an order line that only knows
/// the product cannot say which one to send.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/gestures.dart' show VelocityTracker;
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../core/api.dart';
import '../core/color.dart';
import '../core/json.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../home/home_screen.dart';
import '../widgets/pieces.dart';

const String _nl = '\n';

/// The description with its HTML taken out and its lists kept as lines.
String _plain(String html) {
  final lines = html
      .replaceAll(RegExp(r'<br[^>]*>', caseSensitive: false), _nl)
      .replaceAll(RegExp(r'<[/](p|div|li|h[1-6])>', caseSensitive: false), _nl)
      .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .split(_nl)
      .map((l) => l.trim())
      .toList();
  final kept = <String>[];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].isNotEmpty || (i > 0 && lines[i - 1].isNotEmpty)) kept.add(lines[i]);
  }
  return kept.join(_nl).trim();
}

/// A steady number for a product, so its viewer count does not jump between visits.
int _seeded(String id, int min, int max) {
  var h = 0;
  for (var i = 0; i < id.length; i++) {
    h = (h * 31 + id.codeUnitAt(i)) % 1000003;
  }
  final lo = math.min(min, max);
  final hi = math.max(min, max);
  return lo + (h % (hi - lo + 1));
}

/// A number written the way JavaScript's String(n) writes it.
String _jsNum(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// JS Math.round.
int _round(double v) => (v + 0.5).floor();

/// JS `n || fallback` for a number.
double _or(double v, double fallback) => v == 0 || v.isNaN ? fallback : v;

/// How far the finger travels down before letting go goes back to the reel.
const double _pullBack = 120;

const Color _rule = Color.fromRGBO(69, 46, 31, 0.13);
const Color _white = Color(0xFFFFFFFF);

/// Port of ProductScreen.tsx. Draws ProductSections (home/home_screen.dart) where
/// the React Native one draws `<ProductSections .../>`.
class ProductScreen extends StatefulWidget {
  final String id;
  /// Set when opened from a reel: dragging the product down goes back to the reel.
  final VoidCallback? onPullBack;
  final void Function(String variantId, [Product? product]) onAdd;
  /// Add, then go to the basket.
  final void Function(String variantId, Product product, int quantity) onBuyNow;
  final void Function(String id) onOpenProduct;
  final void Function(String screen) onOpenScreen;
  final void Function(String handle)? onOpenCollection;
  final bool signedIn;
  /// A section placed here that fills the basket itself, like a bundle.
  final OnAdd? onAddBundle;
  const ProductScreen({super.key, required this.id, this.onPullBack, required this.onAdd, required this.onBuyNow, required this.onOpenProduct, required this.onOpenScreen, this.onOpenCollection, this.signedIn = false, this.onAddBundle});
  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> with SingleTickerProviderStateMixin {
  Product? _product;
  String? _error;
  String? _chosen;
  int _qty = 1;
  int _slide = 0;
  double _width = 0;
  String? _fold = 'description';
  bool _more = false;
  List<ProductCard> _related = const [];
  bool _added = false;
  int _viewers = 0;
  int _gen = 0;
  Timer? _viewersTimer;
  Timer? _addedTimer;
  final PageController _gallery = PageController();
  final ScrollController _page = ScrollController();

  // Opened from a reel, the page is a sheet over the video, and it moves the
  // way one does: at the top of the page, a finger going down takes the
  // whole page with it, a little behind, with the reel showing above; let go
  // far enough and it drops away, otherwise it settles back. Sideways is the
  // gallery's, upwards is reading on, and below the top it is all scrolling.
  late final AnimationController _drag = AnimationController.unbounded(vsync: this);
  bool _atTop = true;
  int? _pointer;
  Offset _start = Offset.zero;
  bool _active = false;
  bool _failed = false;
  VelocityTracker? _velocity;

  J get _p => screens.o('product');

  @override
  void initState() {
    super.initState();
    _page.addListener(() {
      _atTop = _page.offset <= 1;
      // The gesture belongs to the top of the page: scrolled away, it lets go.
      if (_active && !_atTop) _cancelDrag();
    });
    _load();
    _startViewers();
  }

  @override
  void didUpdateWidget(covariant ProductScreen old) {
    super.didUpdateWidget(old);
    if (old.id != widget.id) {
      _load();
      _startViewers();
    }
  }

  @override
  void dispose() {
    _gen++;
    _viewersTimer?.cancel();
    _addedTimer?.cancel();
    _gallery.dispose();
    _page.dispose();
    _drag.dispose();
    super.dispose();
  }

  /// Called from initState / didUpdateWidget, which both rebuild afterwards.
  void _load() {
    final gen = ++_gen;
    final p = _p;
    _product = null;
    _error = null;
    _related = const [];
    _qty = 1;
    _slide = 0;
    fetchProduct(widget.id).then((d) {
      if (gen != _gen || !mounted) return;
      track('product_view', {'productId': d.id, 'productName': d.name, 'imageUrl': d.image, 'value': d.priceMin});
      final first = d.variants.where((v) => v.available > 0).firstOrNull ?? d.variants.firstOrNull;
      setState(() {
        _product = d;
        _chosen = first?.id;
      });
      final vendor = d.vendor ?? '';
      if (vendor.isNotEmpty && p.b('showRelated')) {
        searchProducts(vendor, limit: 12).then((r) {
          if (gen != _gen || !mounted) return;
          setState(() => _related = r.products.where((x) => x.id != d.id && x.handle != d.handle).take(10).toList());
        }).catchError((_) {});
      }
    }).catchError((Object e) {
      if (gen != _gen || !mounted) return;
      setState(() => _error = e.toString());
    });
  }

  // A few people come and go while the shopper looks.
  void _startViewers() {
    _viewersTimer?.cancel();
    final p = _p;
    if (!p.b('showViewers')) return;
    final base = _seeded(widget.id, _or(p.n('viewersMin'), 12).round(), _or(p.n('viewersMax'), 40).round());
    _viewers = base;
    final rand = math.Random();
    _viewersTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) setState(() => _viewers = base + _round(rand.nextDouble() * 4) - 2);
    });
  }

  // ------------------------------------------------------------ pull back --

  bool get _enabled => widget.onPullBack != null && _atTop;

  // PORT NOTE: react-native-gesture-handler's PanGestureHandler (activeOffsetY
  // 12, failOffsetX ±15, simultaneous with the page's scroll) is done with raw
  // pointer events beside the scroll view, which keeps scrolling as before.
  void _down(PointerDownEvent e) {
    if (_pointer != null) return;
    _pointer = e.pointer;
    _start = e.position;
    _active = false;
    _failed = !_enabled;
    _velocity = VelocityTracker.withKind(e.kind)..addPosition(e.timeStamp, e.position);
  }

  void _move(PointerMoveEvent e) {
    if (e.pointer != _pointer) return;
    _velocity?.addPosition(e.timeStamp, e.position);
    if (_failed) return;
    final d = e.position - _start;
    if (!_active) {
      // Sideways first is the gallery's.
      if (d.dx.abs() > 15 || !_enabled) {
        _failed = true;
        return;
      }
      // Only a finger going down takes the page.
      if (d.dy < 12) return;
      _active = true;
      _drag.stop();
    }
    _drag.value = d.dy;
  }

  void _up(PointerUpEvent e) {
    if (e.pointer != _pointer) return;
    _pointer = null;
    if (!_active) return;
    _active = false;
    final dy = e.position.dy - _start.dy;
    final vy = _velocity?.getVelocity().pixelsPerSecond.dy ?? 0;
    final away = dy > _pullBack || (dy > 40 && vy > 900);
    final back = widget.onPullBack;
    if (away && back != null) {
      _drag.animateTo(1400, duration: const Duration(milliseconds: 220), curve: Curves.easeInOut).then((_) => back());
      return;
    }
    _settle();
  }

  void _cancel(PointerCancelEvent e) {
    if (e.pointer != _pointer) return;
    _pointer = null;
    if (_active) _cancelDrag();
  }

  void _cancelDrag() {
    _active = false;
    _failed = true;
    _settle();
  }

  void _settle() {
    // PORT NOTE: Animated.spring({speed: 16, bounciness: 4}) approximated with a
    // lightly bouncing Flutter spring of a similar feel.
    const spring = SpringDescription(mass: 1, stiffness: 420, damping: 34);
    _drag.animateWith(SpringSimulation(spring, _drag.value, 0, 0));
  }

  // ---------------------------------------------------------------- drawing --

  @override
  Widget build(BuildContext context) {
    final p = _p;
    final accent = css(p.s('accentColor'), const Color(0xFF9D6540));
    final ink = css(p.s('inkColor'), const Color(0xFF211A15));
    final muted = css(p.s('mutedColor'), const Color(0xFF74685E));
    final dark = css(p.s('darkColor'), const Color(0xFF211A15));

    if (_error != null) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: ts(13, c: const Color(0xFFE11D48)))));
    }
    final product = _product;
    if (product == null) {
      return Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: accent, strokeWidth: 2)));
    }

    final variant = product.variants.where((v) => v.id == _chosen).firstOrNull ?? product.variants.firstOrNull;
    final price = variant != null && variant.price != null ? variant.price : product.priceMin;
    final compareAt = variant != null && variant.compareAt != null ? variant.compareAt : product.compareAt;
    final discount = price != null && compareAt != null && compareAt > price ? _round((1 - price / compareAt) * 100) : 0;
    final left = variant != null ? variant.available : product.available;
    final soldOut = variant == null || left <= 0 || price == null;
    final images = product.images.isNotEmpty
        ? product.images
        : (product.image ?? '').isNotEmpty
            ? [product.image!]
            : <String>[];
    final months = math.max(1.0, _or(p.n('instalmentMonths'), 6));
    final providers = p.s('instalmentProviders').split(RegExp(r'[·,|]')).map((x) => x.trim()).where((x) => x.isNotEmpty).toList();
    final description = (product.description ?? '').isNotEmpty ? _plain(product.description!) : '';
    final ratingValue = p.s('ratingValue');
    final rv = double.tryParse(ratingValue.trim()) ?? 0;
    final stars = (rv.isNaN ? 0 : _round(rv)).clamp(0, 5);
    Widget starLine(Color on, Color offColor) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [for (var i = 0; i < 5; i++) Text('★', style: ts(11, c: i < stars ? on : offColor))],
        );
    final lowAt = _or(p.n('lowStockAt'), 5);
    final label = ts(10, w: 600, ls: 1.6, c: muted);

    final sheet = Container(
      decoration: const BoxDecoration(color: _white, borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (p.b('showBreadcrumb'))
            Text('Home / ${(product.category ?? '').isNotEmpty ? product.category : 'Shop'} / ${product.name}',
                maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, c: const Color(0xFF64748B))),
          if ((product.vendor ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(product.vendor!.toUpperCase(), style: ts(10, w: 600, ls: 2, c: muted)),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(product.name, style: ts(24, lh: 28, c: ink, family: titleFont)),
          ),
          if (p.b('showRating') && ratingValue.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text(ratingValue, style: ts(14, c: _white, family: titleFont)),
                      const SizedBox(width: 6),
                      starLine(const Color(0xFFF5D27A), const Color.fromRGBO(255, 255, 255, 0.35)),
                    ]),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      [p.s('reviewCount').isNotEmpty ? '${p.s('reviewCount')} ${p.s('reviewsWord')}' : '', p.s('verifiedLabel')]
                          .where((x) => x.isNotEmpty)
                          .join(' · '),
                      style: ts(12, c: muted),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Tap(
                    onTap: () => widget.onOpenScreen('happy-customers'),
                    child: Text('See all', style: ts(12, c: accent, deco: TextDecoration.underline)),
                  ),
                ],
              ),
            ),
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.only(top: 12),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: _rule))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(money(price), style: ts(34, w: 600, c: accent, family: titleFont)),
                if (discount > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(children: [
                      Text(money(compareAt), style: ts(13, c: const Color(0xFF9CA3AF), deco: TextDecoration.lineThrough)),
                      if (p.b('showSave') && compareAt != null && price != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFFE8F1EA), borderRadius: BorderRadius.circular(999)),
                          child: Text('${say(p.s('saveLabel'), 'Save')} ${money(compareAt - price)}',
                              style: ts(11, w: 600, c: const Color(0xFF3F6F4F))),
                        ),
                      ],
                    ]),
                  ),
              ],
            ),
          ),
          if (p.b('showInstalments') && price != null && price > 0)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(say(p.s('instalmentsTitle'), 'Installments').toUpperCase(), style: label),
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF4EBE1),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE6D6C4)),
                  ),
                  child: Row(children: [
                    Expanded(
                      child: Text.rich(
                        TextSpan(style: ts(12, lh: 17, c: muted), children: [
                          const TextSpan(text: 'Pay '),
                          TextSpan(text: money(_round(price / months)), style: TextStyle(color: ink, fontWeight: FontWeight.w700)),
                          const TextSpan(text: ' per month for '),
                          TextSpan(text: '${_jsNum(months)} months', style: TextStyle(color: ink, fontWeight: FontWeight.w700)),
                        ]),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      for (var i = 0; i < providers.length; i++) ...[
                        if (i > 0) const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                          decoration: BoxDecoration(
                            color: i == providers.length - 1 ? const Color(0xFFC83A2C) : dark,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(providers[i],
                              style: ts(9.5, w: 700, c: i == providers.length - 1 ? _white : const Color(0xFFD9A36F))),
                        ),
                      ],
                    ]),
                  ]),
                ),
              ]),
            ),
          if (p.b('showVariants') && product.variants.length > 1)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('CHOOSE${variant != null && (variant.variantTitle ?? '').isNotEmpty ? ' · ${variant.variantTitle}' : ''}', style: label),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [for (final v in product.variants) _variantChip(v, variant != null && v.id == variant.id, ink)],
                  ),
                ),
              ]),
            ),
          if (p.b('showQuantity') && !soldOut)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(children: [
                Text('QTY', style: label),
                const SizedBox(width: 12),
                Container(
                  decoration: BoxDecoration(
                    color: _white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0xFFE0D4C4)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    _step('−', ink, () => setState(() => _qty = math.max(1, _qty - 1))),
                    SizedBox(width: 24, child: Text('$_qty', textAlign: TextAlign.center, style: ts(14, w: 600, c: ink))),
                    _step('+', ink, () => setState(() => _qty = math.min(math.max(1, left), _qty + 1))),
                  ]),
                ),
              ]),
            ),
          if (p.b('showViewers') && _viewers > 0)
            Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8E9E3),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEED2C6)),
              ),
              child: Row(children: [
                Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    say(p.s('viewersText'), '{n} people are viewing this right now').split('{n}').join('$_viewers'),
                    style: ts(12, w: 500, c: const Color(0xFFB0402C)),
                  ),
                ),
              ]),
            ),
          if (p.b('showStock') && !soldOut && left <= lowAt)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFBF6EF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE8DCCB)),
                  ),
                  child: Text(
                    '⏱  ${say(p.s('lowStockText'), 'Only {n} left in stock — order soon!').split('{n}').join('$left')}',
                    style: ts(12, w: 500, c: ink),
                  ),
                ),
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  height: 4,
                  clipBehavior: Clip.antiAlias,
                  alignment: Alignment.centerLeft,
                  decoration: BoxDecoration(color: const Color(0xFFE5DBCD), borderRadius: BorderRadius.circular(2)),
                  child: FractionallySizedBox(
                    widthFactor: math.max(8, math.min(100, (left / math.max(1, lowAt * 2)) * 100)) / 100,
                    heightFactor: 1,
                    child: Container(decoration: BoxDecoration(color: const Color(0xFFC0644A), borderRadius: BorderRadius.circular(2))),
                  ),
                ),
              ]),
            ),
          if (p.b('showPerks')) _perks(p, accent, ink),
          if (p.b('showDescription') && description.isNotEmpty)
            _foldBox(
              title: say(p.s('descriptionTitle'), 'Description'),
              open: _fold == 'description',
              ink: ink,
              onToggle: () => setState(() => _fold = _fold == 'description' ? null : 'description'),
              body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(description,
                    maxLines: _more ? null : 4, overflow: _more ? null : TextOverflow.ellipsis, style: ts(13, lh: 20, c: muted)),
                if (description.length > 220)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Tap(
                      onTap: () => setState(() => _more = !_more),
                      child: Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(_more ? 'Show less' : 'Read more', style: ts(12, c: accent, deco: TextDecoration.underline)),
                      ),
                    ),
                  ),
              ]),
            ),
          if (p.s('shippingText').isNotEmpty)
            _foldBox(
              title: say(p.s('shippingTitle'), 'Delivery & returns'),
              open: _fold == 'shipping',
              ink: ink,
              onToggle: () => setState(() => _fold = _fold == 'shipping' ? null : 'shipping'),
              body: Text(p.s('shippingText'), style: ts(13, lh: 20, c: muted)),
            ),
        ],
      ),
    );

    final scroll = CustomScrollView(
      controller: _page,
      physics: widget.onPullBack != null ? const ClampingScrollPhysics() : null,
      slivers: [
        SliverToBoxAdapter(child: _galleryBlock(images, discount, accent, p)),
        if (p.b('showThumbs') && images.length > 1) SliverToBoxAdapter(child: _thumbs(images, accent)),
        // PORT NOTE: the sheet's `marginTop: -8` (lapping over the gallery) is a
        // translate of everything below the gallery; the bottom padding is 8px
        // shorter (24 → 16) so the page still ends where it did.
        SliverToBoxAdapter(
          child: Transform.translate(
            offset: const Offset(0, -8),
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  sheet,
                  if (p.b('showReviewsCard') && ratingValue.isNotEmpty) _reviews(p, ratingValue, dark, starLine),
                  if (p.b('showRelated') && _related.isNotEmpty) _relatedBlock(p, ink, accent),
                  // What the merchant put on the product screen.
                  ProductSections(
                    handlers: HomeHandlers(
                      links: LinkHandlers(
                        onOpenCollection: widget.onOpenCollection,
                        onOpenProduct: widget.onOpenProduct,
                        onOpenScreen: widget.onOpenScreen,
                      ),
                      onAdd: widget.onAddBundle,
                      // As the React Native code passes it: a bare `signedIn` (true).
                      signedIn: true,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );

    // the bar that stays
    final footer = Container(
      decoration: const BoxDecoration(color: _white, border: Border(top: BorderSide(color: _rule))),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(children: [
        Expanded(
          child: Opacity(
            opacity: soldOut ? 0.45 : 1,
            child: Tap(
              onTap: soldOut
                  ? null
                  : () {
                      for (var i = 0; i < _qty; i++) {
                        widget.onAdd(variant.id, product);
                      }
                      setState(() => _added = true);
                      _addedTimer?.cancel();
                      _addedTimer = Timer(const Duration(milliseconds: 1600), () {
                        if (mounted) setState(() => _added = false);
                      });
                    },
              child: _cta(
                _added ? const Color(0xFF4A7858) : accent,
                soldOut
                    ? say(p.s('soldOutLabel'), 'Sold out').toUpperCase()
                    : _added
                        ? 'ADDED ✓'
                        : say(p.s('addLabel'), 'Add to cart').toUpperCase(),
              ),
            ),
          ),
        ),
        if (p.b('showBuyNow') && !soldOut) ...[
          const SizedBox(width: 8),
          Expanded(
            child: Tap(
              onTap: () => widget.onBuyNow(variant.id, product, _qty),
              child: _cta(dark, say(p.s('buyNowLabel'), 'Buy now')),
            ),
          ),
        ],
      ]),
    );

    Widget body = Column(children: [Expanded(child: scroll), footer]);
    if (widget.onPullBack != null) {
      // The page itself moves at the top, so it does not also stretch or glow.
      body = ScrollConfiguration(behavior: ScrollConfiguration.of(context).copyWith(overscroll: false), child: body);
    }

    return Listener(
      onPointerDown: _down,
      onPointerMove: _move,
      onPointerUp: _up,
      onPointerCancel: _cancel,
      child: AnimatedBuilder(
        animation: _drag,
        builder: (context, child) {
          final v = _drag.value;
          final follow = v <= 0 ? 0.0 : v * 0.7;
          final dim = 1 - (v.clamp(0.0, 700.0) / 700) * 0.18;
          return Opacity(opacity: dim, child: Transform.translate(offset: Offset(0, follow), child: child));
        },
        child: ColoredBox(color: css(p.s('pageBg'), const Color(0xFFF8F5F0)), child: body),
      ),
    );
  }

  Widget _galleryBlock(List<String> images, int discount, Color accent, J p) {
    final pages = images.isNotEmpty ? images : [''];
    return ColoredBox(
      color: _white,
      child: LayoutBuilder(builder: (context, box) {
        _width = box.maxWidth;
        final w = _width > 0 ? _width : 1.0;
        return SizedBox(
          height: w,
          child: Stack(children: [
            NotificationListener<ScrollEndNotification>(
              onNotification: (n) {
                if (n.depth == 0 && _width > 0) {
                  final i = (n.metrics.pixels / _width).round();
                  if (i != _slide) setState(() => _slide = i);
                }
                return false;
              },
              child: PageView.builder(
                controller: _gallery,
                itemCount: pages.length,
                itemBuilder: (context, i) => ColoredBox(
                  color: _white,
                  child: pages[i].isNotEmpty
                      ? Padding(padding: const EdgeInsets.all(12), child: NetImage(pages[i], fit: BoxFit.contain))
                      : const SizedBox.expand(),
                ),
              ),
            ),
            if (p.b('showBadge') && discount > 0)
              Positioned(
                top: 12,
                left: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFC0644A), borderRadius: BorderRadius.circular(6)),
                  child: Text('−$discount%', style: ts(11, w: 700, c: _white)),
                ),
              ),
            if (images.length > 1)
              Positioned(
                bottom: 8,
                left: 0,
                right: 0,
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  for (var i = 0; i < images.length; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
                    Container(
                      width: i == _slide ? 16 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: i == _slide ? accent : const Color.fromRGBO(0, 0, 0, 0.13),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ],
                ]),
              ),
          ]),
        );
      }),
    );
  }

  Widget _thumbs(List<String> images, Color accent) {
    return Align(
      alignment: Alignment.centerLeft,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        // The white is the content's, as in RN's contentContainerStyle.
        child: Container(
          color: _white,
          padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
          child: Row(children: [
            for (var i = 0; i < images.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Tap(
                onTap: () {
                  setState(() => _slide = i);
                  if (_width > 0 && _gallery.hasClients) {
                    _gallery.animateTo(i * _width, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
                  }
                },
                child: Container(
                  width: 56,
                  height: 56,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: i == _slide ? accent : const Color(0x00000000), width: 2),
                  ),
                  child: NetImage(images[i], fit: BoxFit.cover, width: 52, height: 52),
                ),
              ),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _variantChip(Variant v, bool on, Color ink) {
    final out = v.available <= 0;
    return Opacity(
      opacity: out ? 0.35 : 1,
      child: Tap(
        onTap: out
            ? null
            : () => setState(() {
                  _chosen = v.id;
                  _qty = 1;
                }),
        child: Container(
          constraints: const BoxConstraints(minWidth: 44),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: on ? ink : _white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: on ? ink : const Color(0xFFE0D4C4)),
          ),
          child: Text(
            v.variantTitle ?? 'One size',
            textAlign: TextAlign.center,
            style: ts(12, w: 600, c: on ? _white : ink, deco: out ? TextDecoration.lineThrough : null),
          ),
        ),
      ),
    );
  }

  Widget _step(String sign, Color ink, VoidCallback onTap) => Tap(
        onTap: onTap,
        child: SizedBox(width: 36, height: 36, child: Center(child: Text(sign, style: ts(16, c: ink)))),
      );

  Widget _perks(J p, Color accent, Color ink) {
    final perks = [('🚚', p.s('perk1')), ('↩️', p.s('perk2')), ('✦', p.s('perk3'))].where((x) => x.$2.isNotEmpty).toList();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < perks.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          Row(children: [
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: Color(0xFFF4EBE1), shape: BoxShape.circle),
              child: Text(perks[i].$1, style: ts(12, c: accent)),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(perks[i].$2, style: ts(12, c: ink))),
          ]),
        ],
      ]),
    );
  }

  Widget _foldBox({required String title, required bool open, required Color ink, required VoidCallback onToggle, required Widget body}) {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: _rule))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Tap(
          onTap: onToggle,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Flexible(child: Text(title, style: ts(14, w: 600, c: ink))),
              Text(open ? '˄' : '˅', style: ts(14, c: ink)),
            ]),
          ),
        ),
        if (open) body,
      ]),
    );
  }

  Widget _reviews(J p, String ratingValue, Color dark, Widget Function(Color, Color) starLine) {
    return Container(
      margin: const EdgeInsets.only(left: 12, right: 12, top: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      decoration: BoxDecoration(color: dark, borderRadius: BorderRadius.circular(20)),
      child: Column(children: [
        if (p.s('reviewsKicker').isNotEmpty)
          Text(p.s('reviewsKicker').toUpperCase(), style: ts(10, w: 600, ls: 2.2, c: const Color(0xFFC98B5E))),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text.rich(
            TextSpan(children: [
              TextSpan(text: p.s('reviewsHeading').isNotEmpty ? '${p.s('reviewsHeading')} ' : ''),
              if (p.s('reviewsItalic').isNotEmpty)
                TextSpan(text: p.s('reviewsItalic'), style: const TextStyle(fontStyle: FontStyle.italic, color: Color(0xFFE6C9A8))),
            ]),
            textAlign: TextAlign.center,
            style: ts(24, c: _white, family: titleFont),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(ratingValue, style: ts(44, c: _white, family: titleFont)),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              starLine(const Color(0xFFD9A441), const Color.fromRGBO(255, 255, 255, 0.2)),
              if (p.s('reviewCount').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('${p.s('reviewCount')} ${p.s('reviewsWord')}', style: ts(12, c: const Color.fromRGBO(255, 255, 255, 0.6))),
                ),
            ]),
          ]),
        ),
        if (p.s('reviewsButton').isNotEmpty)
          Tap(
            onTap: () => widget.onOpenScreen('happy-customers'),
            child: Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color.fromRGBO(255, 255, 255, 0.25)),
              ),
              child: Text('${p.s('reviewsButton').toUpperCase()}  →', style: ts(11, w: 600, ls: 1.6, c: _white)),
            ),
          ),
      ]),
    );
  }

  Widget _relatedBlock(J p, Color ink, Color accent) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, left: 12, right: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (p.s('relatedKicker').isNotEmpty) Text(p.s('relatedKicker').toUpperCase(), style: ts(10, w: 600, ls: 1.6, c: accent)),
        if (p.s('relatedTitle').isNotEmpty) Text(p.s('relatedTitle'), style: ts(22, c: ink, family: titleFont)),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(top: 12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (var i = 0; i < _related.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              _relatedCard(_related[i], ink, accent),
            ],
          ]),
        ),
      ]),
    );
  }

  Widget _relatedCard(ProductCard r, Color ink, Color accent) {
    return Tap(
      onTap: () => widget.onOpenProduct(r.id),
      child: Container(
        width: 132,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEADFD2)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AspectRatio(
            aspectRatio: 1,
            child: ColoredBox(
              color: _white,
              child: (r.image ?? '').isNotEmpty
                  ? Padding(padding: const EdgeInsets.all(12), child: NetImage(r.image, fit: BoxFit.contain))
                  : null,
            ),
          ),
          Container(
            color: const Color(0xFFF3ECE4),
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(r.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(12, c: ink, family: titleFont)),
              Text(money(r.priceMin), style: ts(13, w: 600, c: accent, family: titleFont)),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _cta(Color bg, String text) => Container(
        height: 48,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        child: Text(text, textAlign: TextAlign.center, style: ts(12, w: 700, ls: 1.4, c: _white)),
      );
}
