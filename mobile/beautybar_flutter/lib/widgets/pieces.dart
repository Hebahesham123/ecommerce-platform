/// The bits every section is made of, so they all look like one app.
/// Port of Pieces.tsx.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/rendering.dart' show OverflowBoxFit;
import 'package:flutter/widgets.dart';

import '../core/api.dart';
import '../core/color.dart';
import '../core/format.dart';
import '../core/json.dart';
import '../core/links.dart';
import '../core/prefs.dart';
import '../core/style.dart';
import '../core/theme.dart';
import 'svg.dart';

export '../core/links.dart';
export '../core/format.dart' show money, moneyFirst, plainNumber, shortName, withoutVendor, grouped;

/// A network picture (React Native `<Image source={{uri}} resizeMode=...>`).
/// [fit]: BoxFit.cover for "cover", BoxFit.contain for "contain".
class NetImage extends StatelessWidget {
  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final Color? background;
  final Alignment alignment;
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover, this.width, this.height, this.background, this.alignment = Alignment.center});

  @override
  Widget build(BuildContext context) {
    final u = url;
    final bg = Container(width: width, height: height, color: background);
    if (u == null || u.isEmpty) return bg;
    final ratio = MediaQuery.devicePixelRatioOf(context);
    final shown = width ?? MediaQuery.sizeOf(context).width;
    return Container(
      width: width,
      height: height,
      color: background,
      child: CachedNetworkImage(
        imageUrl: sizedImage(u, shown, ratio),
        memCacheWidth: (shown.isFinite && shown > 0) ? (shown * ratio).round() : null,
        fit: fit,
        width: width,
        height: height,
        alignment: alignment,
        fadeInDuration: const Duration(milliseconds: 150),
        errorWidget: (_, __, ___) => const SizedBox.shrink(),
        placeholder: (_, __) => const SizedBox.shrink(),
      ),
    );
  }
}

/// Run a child past its parent's side padding, the way React Native's
/// `marginHorizontal: -16` does (Flutter has no negative margins). Home
/// sections sit inside a 16px gutter, so `Bleed(child: row)` reaches the
/// screen edges; give the scrolling content its own 16px padding inside.
class Bleed extends StatelessWidget {
  final double by;
  final Widget child;
  const Bleed({super.key, this.by = Spacing.lg, required this.child});
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final w = c.maxWidth.isFinite ? c.maxWidth + by * 2 : c.maxWidth;
      return OverflowBox(
        fit: OverflowBoxFit.deferToChild,
        minWidth: w,
        maxWidth: w,
        alignment: Alignment.center,
        child: child,
      );
    });
  }
}

/// A tap target with no ripple (React Native `<Pressable>`).
class Tap extends StatelessWidget {
  final VoidCallback? onTap;
  final Widget child;
  final HitTestBehavior behavior;
  const Tap({super.key, this.onTap, required this.child, this.behavior = HitTestBehavior.opaque});
  @override
  Widget build(BuildContext context) => GestureDetector(onTap: onTap, behavior: behavior, child: child);
}

class SectionHeading extends StatelessWidget {
  final String title;
  final VoidCallback? onSeeAll;
  const SectionHeading({super.key, required this.title, this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    if (title.isEmpty) return const SizedBox.shrink();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Text(title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: ts(16, w: 700, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4)),
        ),
        if (onSeeAll != null) ...[
          const SizedBox(width: Spacing.sm),
          Tap(onTap: onSeeAll, child: Text('See all', style: ts(12, w: 600, c: colors.accent))),
        ],
      ],
    );
  }
}

/// What a card pointed at a collection looks like: the merchant's own image
/// and title win; otherwise the collection's.
({String? image, String title}) inherit(J item, List<CollectionInfo> collections) {
  final handle = item.s('handle');
  CollectionInfo? found;
  if (handle.isNotEmpty) {
    for (final c in collections) {
      if (c.handle == handle) {
        found = c;
        break;
      }
    }
  }
  final img = item.s('imageUrl');
  return (
    image: img.isNotEmpty ? img : (found?.image != null && found!.image!.isNotEmpty ? found.image : null),
    title: item.s('title').isNotEmpty ? item.s('title') : (item.s('label').isNotEmpty ? item.s('label') : (found?.title ?? '')),
  );
}

/// Five stars, filled to a score.
class Stars extends StatelessWidget {
  final double score;
  final double size;
  const Stars({super.key, required this.score, this.size = 9});
  @override
  Widget build(BuildContext context) {
    final part = (score / 5).clamp(0.0, 1.0);
    return Stack(children: [
      Text('★★★★★', style: ts(size, c: const Color(0xFFD9D2C9))),
      Positioned.fill(
        child: ClipRect(
          child: Align(
            alignment: Alignment.centerLeft,
            widthFactor: part,
            child: Text('★★★★★', maxLines: 1, softWrap: false, style: ts(size, c: colors.accent)),
          ),
        ),
      ),
    ]);
  }
}

class Note {
  final String key;
  final String text;
  final Color ink;
  final String mark;
  const Note({required this.key, required this.text, required this.ink, required this.mark});
}

/// The mark in front of a fact: an 11px line drawing.
class NoteMark extends StatelessWidget {
  final String kind;
  final Color color;
  const NoteMark({super.key, required this.kind, required this.color});
  @override
  Widget build(BuildContext context) {
    final c = sc(color);
    final line = 'fill="none" stroke="$c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    final String body;
    switch (kind) {
      case 'van':
        body = '<path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" $line/><circle cx="7" cy="18" r="1.6" $line/><circle cx="17" cy="18" r="1.6" $line/>';
      case 'star':
        body = '<path d="m12 3.6 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" fill="$c"/>';
      case 'drop':
        body = '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v6.2l2.3-2.3 1.4 1.4L12 17.1l-4.7-4.8 1.4-1.4L11 13.2V7Z" fill="$c"/>';
      case 'bag':
        body = '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" $line/>';
      case 'few':
        body = '<path d="M12 3 3 8v8l9 5 9-5V8z" $line/><path d="M3 8l9 5 9-5M12 13v8" $line/>';
      default:
        body = '<path d="M4 12 12 4h7v7l-8 8z" $line/><circle cx="15.5" cy="8.5" r="1.3" fill="$c"/>';
    }
    return Svg(body, size: 11);
  }
}

/// The plus on a card's round add button: 14px, a 2.5 stroke, round ends.
class PlusMark extends StatelessWidget {
  final double size;
  final Color color;
  final double weight;
  const PlusMark({super.key, this.size = 14, this.color = const Color(0xFFFFFFFF), this.weight = 2.5});
  @override
  Widget build(BuildContext context) => Svg(
      '<path d="M12 5v14M5 12h14" fill="none" stroke="${sc(color)}" stroke-width="$weight" stroke-linecap="round"/>',
      size: size);
}

const String heartPath = 'M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z';
const String _wish = 'wish_';

/// Whether this phone has hearted a product, kept on the phone.
bool isWished(String id) => prefs.getString(_wish + id) == '1';
void setWished(String id, bool on) => on ? prefs.setString(_wish + id, '1') : prefs.remove(_wish + id);

/// The card's note: one true thing at a time, turning over on its top edge.
class CardNote extends StatefulWidget {
  final List<Note> notes;
  const CardNote({super.key, required this.notes});
  @override
  State<CardNote> createState() => _CardNoteState();
}

class _CardNoteState extends State<CardNote> with SingleTickerProviderStateMixin {
  int _at = 0;
  late final AnimationController _turn = AnimationController(vsync: this, duration: const Duration(milliseconds: 420), value: 1);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void didUpdateWidget(covariant CardNote old) {
    super.didUpdateWidget(old);
    if (old.notes.length != widget.notes.length) _start();
  }

  void _start() {
    _timer?.cancel();
    if (widget.notes.length < 2) return;
    _timer = Timer.periodic(const Duration(milliseconds: 2600), (_) {
      if (!mounted) return;
      setState(() => _at = (_at + 1) % widget.notes.length);
      _turn.forward(from: 0);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _turn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.notes.isEmpty) return const SizedBox.shrink();
    final note = widget.notes[_at % widget.notes.length];
    return Container(
      margin: const EdgeInsets.only(top: 4),
      height: 15,
      alignment: Alignment.centerLeft,
      child: ClipRect(
        child: AnimatedBuilder(
          animation: _turn,
          builder: (_, child) {
            final tilt = (-88 + 88 * _turn.value) * math.pi / 180;
            return Opacity(
              opacity: _turn.value.clamp(0.0, 1.0),
              child: Transform(
                alignment: Alignment.topCenter,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 1 / 300)
                  ..rotateX(tilt),
                child: child,
              ),
            );
          },
          child: Row(children: [
            NoteMark(kind: note.mark, color: note.ink),
            const SizedBox(width: 4),
            Flexible(
              child: Text(note.text,
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(9, w: 700, c: note.ink, lh: 11)),
            ),
          ]),
        ),
      ),
    );
  }
}

/// The facts a card can put its name to, in the order a shopper weighs them.
List<Note> notesFor(ProductCard? card, bool scarce, int? left) {
  final c = theme.o('card');
  if (!c.b('ticker')) return [];
  final notes = <Note>[];
  notes.add(const Note(key: 'van', mark: 'van', ink: Color(0xFF15803D), text: 'Free delivery on everything'));
  final score = double.tryParse(c.s('rating'));
  if (score != null && score.isFinite && score > 0) {
    notes.add(Note(
      key: 'star',
      mark: 'star',
      ink: const Color(0xFFB45309),
      text: c.s('reviews').isNotEmpty ? '${c.s('rating')} from ${c.s('reviews')} ratings' : '${c.s('rating')} out of 5',
    ));
  }
  if (card != null && card.compareAt != null && card.priceMin != null && card.compareAt! > card.priceMin!) {
    notes.add(Note(key: 'drop', mark: 'drop', ink: const Color(0xFFB42318), text: 'You save ${money(card.compareAt! - card.priceMin!)}'));
  }
  final sold = card?.sold ?? 0;
  if (sold > 0) {
    notes.add(Note(key: 'bag', mark: 'bag', ink: const Color(0xFF334155), text: '${grouped(sold)} sold'));
  }
  if (left == 1) {
    notes.add(const Note(key: 'few', mark: 'few', ink: Color(0xFFB42318), text: 'Last one'));
  } else if (scarce && left != null) {
    notes.add(Note(key: 'few', mark: 'few', ink: const Color(0xFFB42318), text: 'Only $left left'));
  }
  if (c.s('tickerText').isNotEmpty) {
    notes.add(Note(key: 'own', mark: 'tag', ink: const Color(0xFF334155), text: c.s('tickerText')));
  }
  return notes;
}

/// A product card's heart: in the card's top corner.
class _Heart extends StatelessWidget {
  final bool on;
  final VoidCallback onPress;
  final bool market;
  const _Heart({required this.on, required this.onPress, required this.market});
  @override
  Widget build(BuildContext context) {
    final s = market ? 16.0 : 14.0;
    final stroke = on ? colors.accent : (market ? const Color(0xFF334155) : const Color(0xFF94A3B8));
    final icon = Svg(
        '<path d="$heartPath" fill="${on ? sc(colors.accent) : 'none'}" stroke="${sc(stroke)}" stroke-width="${market ? 1.8 : 2}" stroke-linecap="round" stroke-linejoin="round"/>',
        size: s);
    return Positioned(
      right: 8,
      top: 8,
      child: Tap(
        onTap: onPress,
        child: market
            ? SizedBox(width: 24, height: 24, child: Center(child: icon))
            : Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(color: Color(0xE6FFFFFF), shape: BoxShape.circle, boxShadow: lift),
                child: Center(child: icon),
              ),
      ),
    );
  }
}

/// One product, everywhere a product is drawn — the same card the editor
/// draws. A row of them is 148 wide in the marketplace look and 160 in the
/// classic one.
class ProductTile extends StatefulWidget {
  final ProductCard card;
  final double? width;
  /// True in a grid, where the column decides the width.
  final bool fill;
  /// The picture's proportions: "square", "wide" or "tall".
  final String shape;
  /// "cover" crops to fill the frame, "contain" fits the whole picture in.
  final String fit;
  final void Function(String id)? onPress;
  /// Put the one variant in the basket. Without it the card has no button.
  final OnAdd? onAdd;

  const ProductTile({
    super.key,
    required this.card,
    this.width,
    this.fill = false,
    this.shape = 'square',
    this.fit = 'cover',
    this.onPress,
    this.onAdd,
  });

  /// The default width of a card in a row.
  static double get rowWidth => theme.o('card').s('look') == 'market' ? 148 : 160;

  @override
  State<ProductTile> createState() => _ProductTileState();
}

class _ProductTileState extends State<ProductTile> {
  late bool _wished = isWished(widget.card.id);

  @override
  void didUpdateWidget(covariant ProductTile old) {
    super.didUpdateWidget(old);
    if (old.card.id != widget.card.id) _wished = isWished(widget.card.id);
  }

  void _toggle() {
    setState(() => _wished = !_wished);
    setWished(widget.card.id, _wished);
  }

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    final tc = theme.o('card');
    final width = widget.width ?? ProductTile.rowWidth;
    final score = double.tryParse(tc.s('rating')) ?? 0;
    final stars = tc.b('stars') && score.isFinite && score > 0;
    final left = card.available;
    final lowAt = tc.i('lowAt', 5);
    final scarce = tc.b('stock') && left != null && left > 0 && left <= lowAt;
    final single = card.variantId != null && (card.variantCount ?? 1) == 1;
    final market = tc.s('look') == 'market';
    final canAdd = widget.onAdd != null;
    void add() => single && card.variantId != null ? widget.onAdd?.call(card.variantId!, card.id) : widget.onPress?.call(card.id);
    final off = card.compareAt != null && card.priceMin != null && card.compareAt! > card.priceMin!
        ? (((card.compareAt! - card.priceMin!) / card.compareAt!) * 100).round()
        : 0;
    final notes = notesFor(card, scarce, left);
    final aspect = widget.shape == 'wide' ? 4 / 3 : (widget.shape == 'tall' ? 3 / 4 : 1.0);
    final photoBg = css(tc.s('photoBg'), const Color(0xFFECE8E3));
    final photo = AspectRatio(
      aspectRatio: aspect,
      child: NetImage(card.image, fit: widget.fit == 'contain' ? BoxFit.contain : BoxFit.cover, background: photoBg),
    );
    final radius = tc.n('radius', 22);

    Widget offStamp({double top = 8}) => Positioned(
          left: 8,
          top: top,
          child: IgnorePointer(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(6)),
              child: Text('−$off%', style: ts(10, w: 700, c: const Color(0xFFFFFFFF), lh: 15)),
            ),
          ),
        );

    Widget plus({double right = 2, double bottom = 4}) => Positioned(
          right: right,
          bottom: bottom,
          child: Tap(
            onTap: add,
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(color: colors.accent, shape: BoxShape.circle, boxShadow: lift),
              child: const Center(child: PlusMark()),
            ),
          ),
        );

    if (market) {
      return SizedBox(
        width: widget.fill ? double.infinity : width,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFFFFFFFF),
            borderRadius: BorderRadius.circular(radius),
            boxShadow: const [BoxShadow(color: Color(0x140F172A), blurRadius: 3, offset: Offset(0, 1))],
          ),
          child: Stack(children: [
            Tap(
              onTap: () => widget.onPress?.call(card.id),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                ClipRRect(borderRadius: BorderRadius.circular(radius), child: Container(color: photoBg, child: photo)),
                Padding(
                  padding: EdgeInsets.only(top: 4, bottom: 6, left: 6, right: canAdd ? 32 : 6),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Row(children: [
                      Expanded(
                        child: Text(withoutVendor(card.name, card.vendor),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: ts(11, w: 500, c: const Color(0xFF0F172A), lh: 14)),
                      ),
                      if (stars) ...[
                        const SizedBox(width: 4),
                        Text('★', style: ts(9, c: const Color(0xFF15803D), lh: 11)),
                        const SizedBox(width: 2),
                        Text(tc.s('rating'), style: ts(9, w: 700, c: const Color(0xFF334155), lh: 13)),
                      ],
                    ]),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                        Text(moneyFirst(card.priceMin), style: ts(13, w: 800, c: const Color(0xFF0F172A), lh: 16)),
                        if (off > 0) ...[
                          const SizedBox(width: 6),
                          Text(plainNumber(card.compareAt),
                              style: ts(10, c: const Color(0xFF94A3B8), lh: 15, deco: TextDecoration.lineThrough)),
                        ],
                      ]),
                    ),
                    CardNote(notes: notes),
                  ]),
                ),
              ]),
            ),
            if (off > 0) offStamp(),
            _Heart(on: _wished, onPress: _toggle, market: true),
            if (canAdd) plus(),
          ]),
        ),
      );
    }

    final addOn = tc.b('add');
    return SizedBox(
      width: widget.fill ? double.infinity : width,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Tap(
              onTap: () => widget.onPress?.call(card.id),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Padding(
                  padding: const EdgeInsets.all(6),
                  child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Container(color: photoBg, child: photo)),
                ),
                Padding(
                  padding: EdgeInsets.only(left: 8, bottom: 8, right: canAdd && !addOn ? 36 : 8),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    if (card.vendor != null && card.vendor!.isNotEmpty)
                      Text(card.vendor!.toUpperCase(),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(9, w: 700, c: const Color(0xFF0F172A), lh: 13, ls: 0.72)),
                    Text(shortName(withoutVendor(card.name, card.vendor)),
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, c: const Color(0xFF64748B), lh: 15)),
                    if (stars)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Row(children: [
                          Stars(score: score),
                          const SizedBox(width: 4),
                          Text(tc.s('rating'), style: ts(9, w: 600, c: const Color(0xFF475569))),
                          if (tc.s('reviews').isNotEmpty) ...[
                            const SizedBox(width: 4),
                            Text('(${tc.s('reviews')})', style: ts(9, c: const Color(0xFF94A3B8))),
                          ],
                        ]),
                      ),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 6, children: [
                        Text(money(card.priceMin), style: ts(13, w: 700, c: colors.accent)),
                        if (off > 0)
                          Text(money(card.compareAt), style: ts(10, c: const Color(0xFF94A3B8), lh: 15, deco: TextDecoration.lineThrough)),
                      ]),
                    ),
                    CardNote(notes: notes),
                    if (scarce)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: Container(
                              height: 3,
                              color: const Color(0xFFE2E8F0),
                              alignment: Alignment.centerLeft,
                              child: FractionallySizedBox(
                                widthFactor: math.max(8, (((lowAt - left + 1) / lowAt) * 100).round()) / 100,
                                child: Container(color: colors.accent),
                              ),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text('Only $left left', style: ts(9, w: 600, c: colors.accent)),
                        ]),
                      ),
                  ]),
                ),
              ]),
            ),
            if (addOn && canAdd)
              Tap(
                onTap: add,
                child: Container(
                  margin: const EdgeInsets.only(left: 8, right: 8, bottom: 8),
                  height: 32,
                  decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(8)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (single) ...[const PlusMark(size: 12, weight: 3), const SizedBox(width: 4)],
                    Text(single ? say(tc.s('addLabel'), 'Add to bag').toUpperCase() : 'CHOOSE SIZE',
                        style: ts(11, w: 700, ls: 0.88, c: const Color(0xFFFFFFFF))),
                  ]),
                ),
              ),
          ]),
          if (off > 0) offStamp(),
          _Heart(on: _wished, onPress: _toggle, market: false),
          if (canAdd && !addOn) plus(right: 8, bottom: 8),
        ]),
      ),
    );
  }
}

/// A horizontal row of product cards with the item gap between them.
class ProductRow extends StatelessWidget {
  final List<ProductCard> products;
  final void Function(String id)? onOpenProduct;
  final OnAdd? onAdd;
  final double? width;
  final String shape;
  final String fit;
  const ProductRow({super.key, required this.products, this.onOpenProduct, this.onAdd, this.width, this.shape = 'square', this.fit = 'cover'});
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (var i = 0; i < products.length; i++) ...[
          if (i > 0) SizedBox(width: gap.item),
          ProductTile(card: products[i], width: width, shape: shape, fit: fit, onPress: onOpenProduct, onAdd: onAdd),
        ],
      ]),
    );
  }
}
