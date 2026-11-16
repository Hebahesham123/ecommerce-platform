import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../../widgets/svg.dart';
import '../section.dart';

/// Circle row. Generated from the dashboard — App → App theme. (Port of CircleRow.tsx.)
///
/// Settings: perRow, tileStyle ("tinted" | "cover" | "standout"), coverNote,
/// title, subtitle, seeAllLabel/Handle/ProductId/Screen/Url, size, showLabel,
/// showNote, shape ("circle" | "rounded" | "square"), radius, titleSize,
/// labelSize, labelBold, labelColor, linkColor, bg (paints the whole section,
/// edge to edge), items [{id, imageUrl, label, note, handle, url}].
Widget? circleRowSection(SectionCtx c) {
  final items = c.settings
      .l('items')
      .where((i) => i.s('imageUrl').isNotEmpty || i.s('label').isNotEmpty || i.s('handle').isNotEmpty)
      .toList();
  if (items.isEmpty) return null;
  return _CircleRow(settings: c.settings, items: items, collections: c.data.collections, links: c.links);
}

/// The cards a standout tile stands on, cycling.
const _cards = [Color(0xFFE7DACD), Color(0xFFDBE3DD), Color(0xFFEAD8D6), Color(0xFFDCDFE8), Color(0xFFEAE2CF), Color(0xFFDED8E4)];

/// The shop's colour at four strengths, cycling, so the row has a rhythm
/// without anybody choosing seven colours by hand.
const _tints = ['24', '17', '2e', '1d'];

const _slate = Color(0xFF64748B);
const _ground = Color(0xFFF1F5F9);

/// 1234 as "1,234", the way the editor writes a count.
String _thousands(int n) => n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

/// A path like /departments/bags.webp is relative to the shop; a phone needs
/// the whole address. Anything already absolute is left alone.
String _full(String u) => u.contains('//') || u.startsWith('data:') ? u : siteOrigin + u;

class _CircleRow extends StatelessWidget {
  final J settings;
  final List<J> items;
  final List<CollectionInfo> collections;
  final LinkHandlers links;
  const _CircleRow({required this.settings, required this.items, required this.collections, required this.links});

  J get s => settings;

  double get size => s.n('size', 0) > 0 ? s.n('size') : 76;
  double get cell => math.max(size + 14, 56);

  /// Nought is a rail. Anything else is a grid that many across, with the
  /// tiles taking the width their column gives them.
  double get perRow => s.n('perRow', 0).clamp(0.0, 6.0);
  bool get grid => perRow > 0;

  bool get tinted => s.s('tileStyle') == 'tinted';
  bool get cover => s.s('tileStyle') == 'cover';

  /// A coloured card with the product standing out of the top of it. The
  /// pictures are stored cut out of their ground, so nothing has to be erased
  /// against the card and this matches the preview exactly.
  bool get standout => s.s('tileStyle') == 'standout';

  double get coverW => math.max((size * 1.55).roundToDouble(), 108);

  /// `settings.shape ?? "circle"`: only a missing shape is a circle.
  String get shape => s['shape'] == null ? 'circle' : s.s('shape');

  double get tileRadius => shape == 'square'
      ? 0
      : shape == 'rounded'
          ? (s.n('radius', 0) > 0 ? s.n('radius') : 22)
          : (size / 2).roundToDouble();

  double get titleSize => s.n('titleSize', 0) > 0 ? s.n('titleSize') : 16;
  double get linkSize => titleSize <= 16 ? 12 : (titleSize * 0.82).roundToDouble();
  double get labelSize => s.n('labelSize', 0) > 0 ? s.n('labelSize') : 10;

  bool get showLabel => s['showLabel'] != false;
  bool get showNote => s['showNote'] != false;

  // The card, and the room kept above it for the overflow.
  double get cardH => (size * 1.34).roundToDouble();
  double get standPad => (size * 0.36).roundToDouble();

  // Where the picture's box begins, measured from the top of the cell. Its
  // foot sits clear of the label rather than on it - the label plate starts
  // about a third of the way up the card and has no ground of its own, so a
  // heel's point would otherwise land straight on the word underneath.
  double get standBoxH => (cardH * 0.92).roundToDouble();
  double get standLift => math.max(0, standPad + cardH - (cardH * 0.32).roundToDouble() - standBoxH);

  void _go(J to) => openLink(to, links);

  String _name(J i, ({String? image, String title}) borrowed) => i.s('label').isNotEmpty ? i.s('label') : borrowed.title;

  /// How many that collection really holds, read when this draws.
  String _under(J i) {
    CollectionInfo? found;
    for (final c in collections) {
      if (c.handle == i['handle']) {
        found = c;
        break;
      }
    }
    final count = found?.productCount ?? 0;
    if (i.s('note').isNotEmpty) return i.s('note');
    if (s.s('coverNote').isNotEmpty) return s.s('coverNote');
    return count > 0 ? '${_thousands(count)}${count == 1 ? ' piece' : ' pieces'}' : '';
  }

  @override
  Widget build(BuildContext context) {
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [_head(), _rail()],
    );
    final bg = s.s('bg');
    if (bg.isEmpty) return content;
    return Bleed(
      child: Container(
        color: css(bg),
        padding: const EdgeInsets.symmetric(horizontal: Spacing.lg, vertical: Spacing.md),
        child: content,
      ),
    );
  }

  Widget _head() {
    final title = s.s('title');
    final subtitle = s.s('subtitle');
    final seeAll = s.s('seeAllLabel');
    // The editor's heading: bold, drawn a little tight, in the title face, at
    // the line height a web page gives it.
    final titleStyle = ts(titleSize,
        w: 700,
        c: colors.ink,
        family: titleFont,
        lh: (titleSize * 1.5).roundToDouble(),
        ls: titleSize * (titleFont != null ? -0.01 : -0.025));
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (title.isNotEmpty) Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: titleStyle),
              if (subtitle.isNotEmpty)
                Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, lh: 16, c: _slate)),
            ],
          ),
        ),
        if (seeAll.isNotEmpty) ...[
          const SizedBox(width: Spacing.sm),
          Tap(
            onTap: () => _go(J({
              'url': s['seeAllUrl'],
              'handle': s['seeAllHandle'],
              'productId': s['seeAllProductId'],
              'screen': s['seeAllScreen'],
            })),
            child: Text('$seeAll ›',
                style: ts(linkSize,
                    w: 700, lh: (linkSize * 1.5).roundToDouble(), c: css(s.s('linkColor'), colors.accent))),
          ),
        ],
      ],
    );
  }

  /// A rail that scrolls, or a row that wraps.
  ///
  /// The rail runs to the screen's edges and gives the gutter back inside, as
  /// the editor's does, so the last tile slides off the edge rather than
  /// stopping short of it.
  Widget _rail() {
    if (grid) {
      // A grid shares the width out in equal columns with the item gap between
      // them; each tile then takes the whole of its column.
      final half = gap.item / 2;
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Bleed(
          by: half,
          child: LayoutBuilder(builder: (context, box) {
            // A hair under the share, so rounding never pushes the last column down.
            final colW = box.maxWidth / math.max(1, perRow) - 0.01;
            return Wrap(
              runSpacing: gap.item,
              children: [
                for (var at = 0; at < items.length; at++)
                  SizedBox(
                    key: ValueKey('${items[at].s('id')}#$at'),
                    width: colW,
                    child: Padding(padding: EdgeInsets.symmetric(horizontal: half), child: _tile(items[at], at)),
                  ),
              ],
            );
          }),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Bleed(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(left: 16, right: 16, bottom: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var at = 0; at < items.length; at++) ...[
                if (at > 0) SizedBox(width: gap.item),
                KeyedSubtree(key: ValueKey('${items[at].s('id')}#$at'), child: _tile(items[at], at)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _tile(J i, int at) {
    if (standout) return _standout(i, at);
    if (cover) return _cover(i);
    return _plain(i, at);
  }

  Widget _standout(J i, int at) {
    final borrowed = inherit(i, collections);
    final name = _name(i, borrowed);
    final under = _under(i);
    final own = i.s('imageUrl');
    Widget body(double w) => SizedBox(
          width: w,
          height: standPad + cardH,
          child: Stack(clipBehavior: Clip.none, children: [
            Positioned(
              left: 0,
              right: 0,
              top: standPad,
              height: cardH,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(tileRadius),
                child: Container(
                  color: _cards[at % _cards.length],
                  child: Stack(children: [
                    Positioned(
                      left: 8,
                      right: 8,
                      bottom: 8,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (showLabel)
                            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, w: 700, lh: 14, c: colors.ink)),
                          if (under.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 1),
                              child: Text(under, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(9, lh: 9, c: _slate)),
                            ),
                        ],
                      ),
                    ),
                  ]),
                ),
              ),
            ),
            if (own.isNotEmpty)
              Positioned(
                left: w * 0.04,
                right: w * 0.04,
                top: standLift,
                child: IgnorePointer(child: _StandPhoto(uri: _full(own), height: standBoxH)),
              )
            else
              Positioned(
                left: 0,
                right: 0,
                bottom: (cardH * 0.3).roundToDouble(),
                height: (cardH * 0.46).roundToDouble(),
                child: IgnorePointer(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: _DeptMark(name: name, size: (cardH * 0.46).roundToDouble()),
                  ),
                ),
              ),
          ]),
        );
    return Tap(
      onTap: () => _go(i),
      child: grid ? LayoutBuilder(builder: (_, box) => body(box.maxWidth)) : body(size),
    );
  }

  Widget _cover(J i) {
    final borrowed = inherit(i, collections);
    final own = i.s('imageUrl').isNotEmpty ? i.s('imageUrl') : borrowed.image;
    final photo = own != null && own.isNotEmpty ? _full(own) : null;
    final under = _under(i);
    final tile = AspectRatio(
      aspectRatio: 4 / 5,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(tileRadius),
        child: Container(
          color: _ground,
          child: Stack(fit: StackFit.expand, children: [
            if (photo != null) NetImage(photo, fit: BoxFit.cover),
            // Dark where the words are, clear where the picture is.
            const Fade(
              angle: 180,
              colors: [Color.fromRGBO(10, 8, 7, 0.06), Color.fromRGBO(10, 8, 7, 0.34), Color.fromRGBO(10, 8, 7, 0.76)],
              locations: [0, 0.48, 1],
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 28, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (showLabel)
                      Text(_name(i, borrowed),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: ts(13, w: 700, lh: 16, c: const Color(0xFFFFFFFF))),
                    if (under.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(under,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: ts(10, lh: 10, c: const Color.fromRGBO(255, 255, 255, 0.75))),
                      ),
                  ],
                ),
              ),
            ),
          ]),
        ),
      ),
    );
    return Tap(onTap: () => _go(i), child: grid ? tile : SizedBox(width: coverW, child: tile));
  }

  Widget _plain(J i, int at) {
    final borrowed = inherit(i, collections);
    final own = i.s('imageUrl').isNotEmpty ? i.s('imageUrl') : borrowed.image;
    final photo = own != null && own.isNotEmpty ? _full(own) : null;
    final name = _name(i, borrowed);
    final radius = BorderRadius.circular(tileRadius);

    // The tile itself: a set size on a rail, the column's width in a grid.
    Widget round(Widget child) => grid
        ? AspectRatio(aspectRatio: tinted ? 5 / 4 : 1, child: child)
        : SizedBox(width: size, height: size, child: child);

    final Widget art;
    if (tinted) {
      // Whole, not cropped: a department is a kind of thing, and half a shoe
      // is a worse picture of "shoes" than a shoe.
      art = round(ClipRRect(
        borderRadius: radius,
        child: Container(
          color: hexA(colors.accent, _tints[at % _tints.length]),
          child: Stack(fit: StackFit.expand, children: [
            if (photo != null)
              grid
                  // Percent padding is of the tile's width, on every side.
                  ? LayoutBuilder(
                      builder: (_, box) => Padding(
                        padding: EdgeInsets.fromLTRB(box.maxWidth * 0.14, box.maxWidth * 0.14, box.maxWidth * 0.14, box.maxWidth * 0.26),
                        child: NetImage(photo, fit: BoxFit.contain),
                      ),
                    )
                  : NetImage(photo, fit: BoxFit.contain),
            if (showLabel)
              Positioned(
                left: 6,
                right: 6,
                bottom: 6,
                child: Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: ts(10, w: 700, c: colors.ink)),
              ),
          ]),
        ),
      ));
    } else {
      art = round(Container(
        decoration: BoxDecoration(color: _ground, borderRadius: radius),
        foregroundDecoration: shape == 'circle'
            ? BoxDecoration(borderRadius: radius, border: Border.all(color: const Color(0xFFE2E8F0)))
            : null,
        clipBehavior: Clip.antiAlias,
        child: photo != null ? NetImage(photo, fit: BoxFit.cover) : null,
      ));
    }

    final note = i.s('note');
    return Tap(
      onTap: () => _go(i),
      child: SizedBox(
        width: grid ? null : cell,
        child: Column(
          crossAxisAlignment: tinted ? CrossAxisAlignment.start : CrossAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            art,
            if (showNote && note.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: SizedBox(
                  width: double.infinity,
                  child: Text(note,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: ts(11, w: 700, lh: 16, c: colors.accent)),
                ),
              ),
            if (showLabel && !tinted)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: SizedBox(
                  width: double.infinity,
                  child: Text(name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: ts(labelSize,
                          w: s.b('labelBold') ? 600 : 400,
                          lh: (labelSize * 1.5).roundToDouble(),
                          c: css(s.s('labelColor'), _slate))),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// A cut-out hung from its top.
///
/// The picture is drawn standing on the bottom of its box at whichever of
/// width and height fits. That shared bottom edge is the baseline the whole
/// row rests on, and it is why a tall bottle rises out of its card while a
/// wide sneaker stays inside its own. (React Native measures the image and
/// its box to get there; BoxFit.contain anchored at the bottom is the same
/// drawing.)
class _StandPhoto extends StatelessWidget {
  final String uri;
  final double height;
  const _StandPhoto({required this.uri, required this.height});
  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity,
        height: height,
        child: NetImage(uri, fit: BoxFit.contain, alignment: Alignment.bottomCenter),
      );
}

/// The mark for a department, chosen by what it is called.
///
/// Drawn rather than photographed: a photograph of one bag is a picture of
/// that bag, and a drawing of a bag is a picture of "bags". Matched loosely
/// and in both languages, because a shop names its own departments.
class _DeptMark extends StatelessWidget {
  final String name;
  final double size;
  const _DeptMark({required this.name, required this.size});

  // The editor's slate-800 at 85%.
  static const _line = 'stroke="rgba(30,41,59,0.85)" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"';

  static String _p(String d) => '<path $_line d="$d"/>';

  @override
  Widget build(BuildContext context) {
    final n = name.toLowerCase();
    bool has(List<String> w) => w.any(n.contains);
    final String body;
    if (has(['bag', 'clutch', 'tote', 'حقيب', 'شنط'])) {
      body = _p('M5 8h14l-1.2 12.5H6.2L5 8Z') + _p('M9 8V6.2a3 3 0 0 1 6 0V8');
    } else if (has(['heel', 'pump', 'stiletto', 'كعب'])) {
      body = _p('M4 5.5v7.2A3.3 3.3 0 0 0 7.3 16h6.2l4.6 3.2H21v-1.8c0-2-1.6-3.1-3.7-4-3-1.3-5.2-4-6.2-7.9H4Z');
    } else if (has(['sneak', 'trainer', 'shoe', 'footwear', 'حذاء', 'سنيكرز'])) {
      body = _p('M3 14.2c0-1.7.9-2.7 2.1-3.6L8 8.4l1.9 1.9 2.7-.9 1.9 2c2 .7 4.6 1.4 5.5 2.9V17a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17Z') +
          _p('M8 8.4V5.6');
    } else if (has(['sunglass', 'glass', 'eyewear', 'نظار'])) {
      body = _p('M3 10h7v3.2A2.4 2.4 0 0 1 7.6 15.6H5.4A2.4 2.4 0 0 1 3 13.2Z') +
          _p('M14 10h7v3.2a2.4 2.4 0 0 1-2.4 2.4h-2.2A2.4 2.4 0 0 1 14 13.2Z') +
          _p('M10 11.2h4') +
          _p('M3 10 5.4 7.2M21 10 18.6 7.2');
    } else if (has(['sandal', 'slipper', 'slide', 'flip', 'صندل', 'شبشب'])) {
      body = _p('M7.4 4h9.2l-1 13.6a3.6 3.6 0 0 1-7.2 0Z') + _p('M8.4 8.4 15.6 10M8.4 11.8 15.6 10');
    } else if (has(['perfume', 'fragrance', 'scent', 'عطر', 'برفيوم'])) {
      body = _p('M10.2 3.2h3.6v2.6h-3.6Z') +
          _p('M8.2 9a3.2 3.2 0 0 1 3.2-3.2h1.2A3.2 3.2 0 0 1 15.8 9v8.8a3 3 0 0 1-3 3h-1.6a3 3 0 0 1-3-3Z') +
          _p('M17.6 5.4h1.8M19.4 3.6v3.6');
    } else if (has(['swim', 'bikini', 'beach', 'سباحة', 'مايوه'])) {
      body = _p('M8 3.6h8l-1 6.2c0 3.2-1.2 5.4-3 7.4-1.8-2-3-4.2-3-7.4Z') + _p('M9.2 8h5.6');
    } else if (has(['belt', 'حزام'])) {
      body = _p('M3 9.6h18v4.8H3Z') + _p('M9.6 9.6v4.8M14.4 9.6v4.8');
    } else if (has(['watch', 'jewel', 'ring', 'ساعة', 'مجوهرات'])) {
      body = '<circle $_line cx="12" cy="12" r="4.4"/>${_p('M9.2 7.8 9.8 3.4h4.4l.6 4.4M9.2 16.2l.6 4.4h4.4l.6-4.4')}';
    } else {
      body = '${_p('M3.6 12.4 12.4 3.6h7v7l-8.8 8.8z')}<circle cx="15.8" cy="8.2" r="1.3" fill="rgba(30,41,59,0.85)"/>';
    }
    return Svg(body, size: size, rootAttrs: 'fill="none"');
  }
}
