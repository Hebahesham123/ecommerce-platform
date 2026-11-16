/// One collection, dressed as Beauty Bar's website: a dark banner with the name
/// in italic serif, brand chips, a bar with filters and sorting, and cream cards
/// with caramel prices. Every part is the merchant's - App → App theme →
/// Collection. Port of CollectionScreen.tsx.
///
/// Filtering and sorting are requests to the shop, not a shuffle of what
/// arrived, so they cover the whole collection and not only the loaded page.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/color.dart';
import '../core/json.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../widgets/fade.dart';
import '../widgets/pieces.dart';

const List<({String key, String label})> _sorts = [
  (key: 'manual', label: 'Featured'),
  (key: 'newest', label: 'Newest'),
  (key: 'price-ascending', label: 'Price: low to high'),
  (key: 'price-descending', label: 'Price: high to low'),
  (key: 'title-ascending', label: 'A–Z'),
];

const CollectionFilters _none = CollectionFilters();

const Color _white = Color(0xFFFFFFFF);
const Color _countInk = Color(0xFF74685E);

/// A number written the way JavaScript's String(n) writes it.
String _jsNum(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// JS `Number(t) || 0`.
double _number(String? t) {
  final s = (t ?? '').trim();
  if (s.isEmpty) return 0;
  final v = double.tryParse(s);
  return v == null || v.isNaN ? 0 : v;
}

CollectionFilters _with(CollectionFilters f, {List<String>? brands, double? min, double? max, bool? inStock, bool? onSale}) =>
    CollectionFilters(
      brands: brands ?? f.brands,
      min: min ?? f.min,
      max: max ?? f.max,
      inStock: inStock ?? f.inStock,
      onSale: onSale ?? f.onSale,
    );

/// A collection link can carry a narrowing: "all?minPrice=3000&maxPrice=4999"
/// is the whole shop between those prices, which is how a price tier opens.
({String handle, CollectionFilters filters}) _splitLink(String link) {
  final parts = link.split('?');
  final params = <String, String>{};
  for (final pair in (parts.length > 1 ? parts[1] : '').split('&')) {
    final kv = pair.split('=');
    if (kv[0].isEmpty) continue;
    final raw = kv.length > 1 ? kv[1] : '';
    String value;
    try {
      value = Uri.decodeComponent(raw);
    } catch (_) {
      value = raw;
    }
    params[kv[0]] = value;
  }
  return (
    handle: parts[0],
    filters: CollectionFilters(
      brands: (params['vendor'] ?? '').split(',').map((v) => v.trim()).where((v) => v.isNotEmpty).toList(),
      min: _number(params['minPrice']),
      max: _number(params['maxPrice']),
      inStock: params['inStock'] == '1',
      onSale: params['onSale'] == '1',
    ),
  );
}

int _off(double? price, double? compareAt) =>
    price != null && compareAt != null && compareAt > price ? ((1 - price / compareAt) * 100 + 0.5).floor() : 0;

/// Port of CollectionScreen.tsx.
class CollectionScreen extends StatefulWidget {
  final String handle;
  final void Function(String id) onOpenProduct;
  /// A card with a single option adds straight from the grid.
  final void Function(String variantId) onAdd;
  const CollectionScreen({super.key, required this.handle, required this.onOpenProduct, required this.onAdd});
  @override
  State<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends State<CollectionScreen> {
  late String _handle;
  late CollectionFilters _preset;
  late String _sort;
  late CollectionFilters _filters;
  late CollectionFilters _draft;
  bool _panel = false;
  bool _sorting = false;
  bool _single = false;
  CollectionPayload? _data;
  List<ProductCard> _products = const [];
  String? _error;
  bool _loadingMore = false;
  int _gen = 0;
  final ScrollController _scroll = ScrollController();
  final TextEditingController _minText = TextEditingController();
  final TextEditingController _maxText = TextEditingController();

  J get _c => screens.o('collection');

  int get _pageSize {
    final n = _c.n('pageSize');
    return math.min(math.max(n == 0 || n.isNaN ? 24 : n, 6), 60).toInt();
  }

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void didUpdateWidget(covariant CollectionScreen old) {
    super.didUpdateWidget(old);
    if (old.handle != widget.handle) _open();
  }

  @override
  void dispose() {
    _gen++;
    _scroll.dispose();
    _minText.dispose();
    _maxText.dispose();
    super.dispose();
  }

  void _open() {
    final s = _splitLink(widget.handle);
    _handle = s.handle;
    _preset = s.filters;
    _sort = _c.sOr('sortDefault', 'manual');
    _filters = _preset;
    _setDraft(_preset);
    _load();
  }

  /// Fetch the first page again (RN's effect on handle, sort, filters, pageSize).
  void _load() {
    final gen = ++_gen;
    _data = null;
    _products = const [];
    _error = null;
    _loadingMore = false;
    fetchCollection(_handle, sort: _sort, offset: 0, limit: _pageSize, filters: _filters).then((d) {
      if (gen != _gen || !mounted) return;
      setState(() {
        _data = d;
        _products = d.products;
      });
      _checkEnd();
    }).catchError((Object e) {
      if (gen != _gen || !mounted) return;
      setState(() => _error = e.toString());
    });
  }

  void _setSort(String s) => setState(() {
        _sort = s;
        _sorting = false;
        _load();
      });

  void _setFilters(CollectionFilters f) => setState(() {
        _filters = f;
        _load();
      });

  void _setDraft(CollectionFilters f) {
    _draft = f;
    final minText = f.min != 0 ? _jsNum(f.min) : '';
    final maxText = f.max != 0 ? _jsNum(f.max) : '';
    if (_minText.text != minText) _minText.value = TextEditingValue(text: minText, selection: TextSelection.collapsed(offset: minText.length));
    if (_maxText.text != maxText) _maxText.value = TextEditingValue(text: maxText, selection: TextSelection.collapsed(offset: maxText.length));
  }

  void _more() {
    final data = _data;
    if (data == null || _loadingMore || _products.length >= data.total) return;
    final gen = _gen;
    setState(() => _loadingMore = true);
    fetchCollection(_handle, sort: _sort, offset: _products.length, limit: _pageSize, filters: _filters).then((d) {
      if (gen != _gen || !mounted) return;
      setState(() => _products = [..._products, ...d.products.where((x) => !_products.any((y) => y.id == x.id))]);
    }).catchError((_) {}).whenComplete(() {
      if (gen != _gen || !mounted) return;
      setState(() => _loadingMore = false);
      _checkEnd();
    });
  }

  /// FlatList's onEndReached with onEndReachedThreshold 0.5: within half a
  /// screen of the end, including when the list does not fill the screen.
  void _checkEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      final m = _scroll.position;
      if (m.extentAfter < m.viewportDimension * 0.5) _more();
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    final accent = css(c.s('priceColor'), const Color(0xFFB0603E));
    if (_error != null) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: ts(13, c: const Color(0xFFE11D48)))));
    }
    final data = _data;
    if (data == null) return Center(child: _spinner(accent));

    final ink = css(c.s('inkColor'), const Color(0xFF211A15));
    final line = css(c.s('lineColor'), const Color(0xFFEADFD2));
    final vendors = data.facets != null ? data.facets!.l('vendors') : const <J>[];
    final columns = _single ? 1 : (c.n('columns') == 3 ? 3 : 2);
    final f = _filters;
    final active = f.brands.length + (f.min > 0 || f.max > 0 ? 1 : 0) + (f.inStock ? 1 : 0) + (f.onSale ? 1 : 0);
    final range = _preset.min > 0 && _preset.max > 0
        ? '${money(_preset.min)} – ${money(_preset.max)}'
        : _preset.max > 0
            ? 'Under ${money(_preset.max)}'
            : _preset.min > 0
                ? '${money(_preset.min)}+'
                : '';
    final productCount = data.collection.i('productCount');
    final subtitle = range.isNotEmpty
        ? '$range · ${data.total} pieces'
        : c.sOr(
            'heroSubtitle',
            ['${productCount != 0 ? productCount : data.total}+ pieces', vendors.take(5).map((v) => v.s('name')).join(' · ')]
                .where((x) => x.isNotEmpty)
                .join(' · '),
          );

    Widget chip(bool on, String text, VoidCallback onTap) => Tap(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: on ? ink : _white,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: on ? ink : line),
            ),
            child: Text(text, style: ts(11, w: 600, ls: 0.6, c: on ? _white : ink)),
          ),
        );

    final heroAccent = css(c.s('heroAccent'), const Color(0xFFD08159));
    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (c.b('showHero'))
          Container(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 24),
            decoration: BoxDecoration(
              color: css(c.s('heroTo'), const Color(0xFF3D2619)),
              gradient: fadeGradient(
                angle: 135,
                colors: [css(c.s('heroFrom'), const Color(0xFF1C1410)), css(c.s('heroTo'), const Color(0xFF3D2619))],
              ),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (c.s('heroKicker').isNotEmpty) Text(c.s('heroKicker').toUpperCase(), style: ts(10, w: 600, ls: 2.2, c: heroAccent)),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(data.collection.s('title').toUpperCase(), style: ts(32, italic: true, c: _white, family: titleFont)),
              ),
              if (subtitle.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(subtitle, style: ts(12, lh: 18, c: const Color.fromRGBO(255, 255, 255, 0.7))),
                ),
            ]),
          ),
        if (c.b('showBrandChips') && vendors.length > 1)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(children: [
              for (final (i, name) in ['', ...vendors.take(14).map((v) => v.s('name'))].indexed) ...[
                if (i > 0) const SizedBox(width: 6),
                chip(
                  name.isNotEmpty ? f.brands.length == 1 && f.brands[0] == name : f.brands.isEmpty,
                  name.isNotEmpty ? name.toUpperCase() : 'ALL',
                  () => _setFilters(_with(f, brands: name.isNotEmpty ? [name] : [])),
                ),
              ],
            ]),
          ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: line))),
          child: Row(children: [
            Expanded(child: Text('${data.total} products', style: ts(12, c: _countInk))),
            if (c.b('showLayoutToggle')) ...[
              const SizedBox(width: 8),
              Tap(
                onTap: () => setState(() => _single = !_single),
                child: Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: _white, shape: BoxShape.circle, border: Border.all(color: line)),
                  child: Text(_single ? '▦' : '▢', style: ts(14, c: ink)),
                ),
              ),
            ],
            if (c.b('showFilters')) ...[
              const SizedBox(width: 8),
              _pill(accent, active > 0 ? 'Filters · $active' : 'Filters', ink, () {
                setState(() {
                  _setDraft(_filters);
                  _panel = !_panel;
                  _sorting = false;
                });
              }),
            ],
            if (c.b('showSort')) ...[
              const SizedBox(width: 8),
              _pill(line, '${(_sorts.where((x) => x.key == _sort).firstOrNull ?? _sorts[0]).label} ▾', ink, () {
                setState(() {
                  _sorting = !_sorting;
                  _panel = false;
                });
              }),
            ],
          ]),
        ),
        if (_sorting)
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 16, top: 10),
            child: Wrap(spacing: 6, runSpacing: 6, children: [
              for (final o in _sorts) chip(o.key == _sort, o.label, () => _setSort(o.key)),
            ]),
          ),
        if (_panel) _filtersPanel(data, vendors, chip, ink, line),
      ],
    );

    // The rows of the grid, as FlatList with numColumns lays them out.
    final rowCount = (_products.length / columns).ceil();
    final itemCount = 1 + (_products.isEmpty ? 1 : rowCount) + (_loadingMore ? 1 : 0);

    return ColoredBox(
      color: css(c.s('pageBg'), const Color(0xFFF8F5F0)),
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.depth == 0 && n.metrics.extentAfter < n.metrics.viewportDimension * 0.5) _more();
          return false;
        },
        child: ListView.builder(
          key: ValueKey('columns-$columns'),
          controller: _scroll,
          padding: const EdgeInsets.only(bottom: 24),
          itemCount: itemCount,
          itemBuilder: (context, index) {
            if (index == 0) return header;
            if (_products.isEmpty && index == 1) return _empty(ink, active > 0);
            final row = index - 1;
            if (row >= rowCount) {
              return Padding(padding: const EdgeInsets.all(16), child: Center(child: _spinner(accent)));
            }
            final items = _products.skip(row * columns).take(columns).toList();
            if (columns == 1) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: _CollectionCard(key: ValueKey(items[0].id), card: items[0], large: _single, fill: false, onOpen: widget.onOpenProduct, onAdd: widget.onAdd),
              );
            }
            // columnWrapperStyle: gap 8, paddingHorizontal 12, marginTop 8; each
            // item is flex 1/columns of what the row has left over.
            return Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, top: 8),
              child: LayoutBuilder(builder: (context, box) {
                final free = box.maxWidth - 8 * (items.length - 1);
                final w = free / columns;
                return IntrinsicHeight(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    for (var i = 0; i < items.length; i++) ...[
                      if (i > 0) const SizedBox(width: 8),
                      SizedBox(
                        width: w,
                        child: _CollectionCard(key: ValueKey(items[i].id), card: items[i], large: _single, onOpen: widget.onOpenProduct, onAdd: widget.onAdd),
                      ),
                    ],
                  ]),
                );
              }),
            );
          },
        ),
      ),
    );
  }

  Widget _spinner(Color color) => SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: color, strokeWidth: 2));

  Widget _pill(Color border, String text, Color ink, VoidCallback onTap) => Tap(
        onTap: onTap,
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.circular(16), border: Border.all(color: border)),
          child: Text(text, style: ts(12, w: 600, c: ink)),
        ),
      );

  Widget _filtersPanel(CollectionPayload data, List<J> vendors, Widget Function(bool, String, VoidCallback) chip, Color ink, Color line) {
    final d = _draft;
    final label = ts(10, w: 600, ls: 1.6, c: _countInk);
    Widget input(TextEditingController ctl, String placeholder, void Function(double) onValue) => Expanded(
          child: Container(
            height: 34,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            alignment: Alignment.centerLeft,
            decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.circular(8), border: Border.all(color: line)),
            child: TextField(
              controller: ctl,
              keyboardType: TextInputType.number,
              style: ts(12, c: const Color(0xFF000000)),
              decoration: InputDecoration.collapsed(hintText: placeholder, hintStyle: ts(12, c: const Color(0xFFA0A0A0))),
              onChanged: (t) => setState(() => onValue(_number(t))),
            ),
          ),
        );
    final facets = data.facets;
    final children = <Widget>[
      if (vendors.isNotEmpty) Text('BRAND', style: label),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final v in vendors)
          chip(d.brands.contains(v.s('name')), '${v.s('name')}  ${v.s('count')}', () {
            final name = v.s('name');
            final on = d.brands.contains(name);
            setState(() => _setDraft(_with(d, brands: on ? d.brands.where((b) => b != name).toList() : [...d.brands, name])));
          }),
      ]),
      Text('PRICE', style: label),
      Wrap(spacing: 6, runSpacing: 6, children: [
        for (final r in const [
          (label: 'Under 5,000', min: 0.0, max: 5000.0),
          (label: '5,000 – 10,000', min: 5000.0, max: 10000.0),
          (label: 'Over 10,000', min: 10000.0, max: 0.0),
        ])
          chip(d.min == r.min && d.max == r.max, r.label, () {
            final on = d.min == r.min && d.max == r.max;
            setState(() => _setDraft(on ? _with(d, min: 0, max: 0) : _with(d, min: r.min, max: r.max)));
          }),
      ]),
      Row(children: [
        input(_minText, _jsNum(facets != null ? facets.n('priceMin') : 0), (v) => _setDraft(_with(_draft, min: v))),
        const SizedBox(width: 8),
        Expanded(child: Text('–', style: ts(12, c: _countInk))),
        const SizedBox(width: 8),
        input(_maxText, _jsNum(facets != null ? facets.n('priceMax') : 0), (v) => _setDraft(_with(_draft, max: v))),
      ]),
      Wrap(spacing: 6, runSpacing: 6, children: [
        chip(d.inStock, 'In stock only', () => setState(() => _setDraft(_with(d, inStock: !d.inStock)))),
        chip(d.onSale, 'On sale', () => setState(() => _setDraft(_with(d, onSale: !d.onSale)))),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(children: [
          Expanded(
            child: Tap(
              onTap: () {
                _setDraft(_none);
                _panel = false;
                _setFilters(_none);
              },
              child: Container(
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(19), border: Border.all(color: line)),
                child: Text('Clear', style: ts(12, w: 600, c: ink)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: Tap(
              onTap: () {
                _panel = false;
                _setFilters(_draft);
              },
              child: _applyButton(ink, 'SHOW RESULTS'),
            ),
          ),
        ]),
      ),
    ];
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.circular(16), border: Border.all(color: line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          children[i],
        ],
      ]),
    );
  }

  Widget _applyButton(Color ink, String text) => Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(19)),
        child: Text(text, style: ts(12, w: 700, ls: 1.4, c: _white)),
      );

  Widget _empty(Color ink, bool active) => Padding(
        padding: const EdgeInsets.all(40),
        child: Column(children: [
          Text('Nothing matches that — yet', textAlign: TextAlign.center, style: ts(18, italic: true, c: ink, family: titleFont)),
          if (active)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Tap(onTap: () => _setFilters(_none), child: _applyButton(ink, 'CLEAR FILTERS')),
            ),
        ]),
      );
}

/// A tile as the website draws one: white picture, cream panel, serif name, caramel price.
class _CollectionCard extends StatefulWidget {
  final ProductCard card;
  final bool large;
  /// In a grid row, where the row's tallest card sets everyone's height.
  final bool fill;
  final void Function(String id) onOpen;
  final void Function(String variantId)? onAdd;
  const _CollectionCard({super.key, required this.card, required this.large, this.fill = true, required this.onOpen, this.onAdd});
  @override
  State<_CollectionCard> createState() => _CollectionCardState();
}

class _CollectionCardState extends State<_CollectionCard> {
  bool _added = false;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = screens.o('collection');
    final card = widget.card;
    final large = widget.large;
    final discount = _off(card.priceMin, card.compareAt);
    final accent = css(c.s('priceColor'), const Color(0xFFB0603E));
    final ink = css(c.s('inkColor'), const Color(0xFF211A15));
    final nl = c.n('nameLines');
    final nameLines = (nl == 0 || nl.isNaN ? 2 : nl).clamp(1, 3).toInt();
    final onAdd = widget.onAdd;
    return Container(
      margin: const EdgeInsets.only(top: 8),
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(color: _white, border: Border.all(color: css(c.s('lineColor'), const Color(0xFFEADFD2)))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Tap(
          onTap: () => widget.onOpen(card.id),
          child: AspectRatio(
            aspectRatio: large ? 0.8 : 1,
            child: ColoredBox(
              color: _white,
              child: Stack(children: [
                if ((card.image ?? '').isNotEmpty)
                  Positioned.fill(
                    child: Padding(padding: const EdgeInsets.all(8), child: NetImage(card.image, fit: BoxFit.contain)),
                  ),
                if (c.b('showBadge') && discount > 0)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      color: accent,
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      child: Text('−$discount%', style: ts(9.5, w: 700, c: _white)),
                    ),
                  ),
              ]),
            ),
          ),
        ),
        _grow(
          widget.fill,
          Container(
            color: css(c.s('cardBg'), const Color(0xFFF3ECE4)),
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (c.b('showVendor') && (card.vendor ?? '').isNotEmpty)
                Text(card.vendor!.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(9, w: 600, ls: 1.2, c: accent)),
              if (c.b('showRating') && c.s('ratingText').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text('★ ${c.s('ratingText')}', style: ts(10, w: 600, c: ink)),
                ),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(card.name,
                    maxLines: nameLines,
                    overflow: TextOverflow.ellipsis,
                    style: ts(large ? 16 : 13, lh: 18, c: ink, family: titleFont)),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(money(card.priceMin), style: ts(large ? 19 : 14, w: 600, c: accent, family: titleFont)),
                      if (discount > 0)
                        Text(money(card.compareAt), style: ts(10, c: const Color(0xFF9CA3AF), deco: TextDecoration.lineThrough)),
                    ]),
                  ),
                  if (c.b('showQuickAdd') && onAdd != null)
                    Tap(
                      onTap: () {
                        final v = card.variantId;
                        if (v != null && v.isNotEmpty) {
                          onAdd(v);
                          setState(() => _added = true);
                          _timer?.cancel();
                          _timer = Timer(const Duration(milliseconds: 1400), () {
                            if (mounted) setState(() => _added = false);
                          });
                        } else {
                          widget.onOpen(card.id);
                        }
                      },
                      child: Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _added ? const Color(0xFF4A7858) : null,
                          border: Border.all(color: _added ? const Color(0xFF4A7858) : accent),
                        ),
                        child: Text(_added ? '✓' : '+', style: ts(16, lh: 18, c: _added ? _white : accent)),
                      ),
                    ),
                ]),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// RN `flex: 1` - only where the height is bounded (a grid row).
Widget _grow(bool fill, Widget child) => fill ? Expanded(child: child) : child;
