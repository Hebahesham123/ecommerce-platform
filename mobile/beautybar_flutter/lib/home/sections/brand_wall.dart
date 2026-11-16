/// Shop by brand. Port of BrandWall.tsx.
library;

import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// The houses the shop ships a mark for, baked in when this app was
/// generated. A list rather than a lookup: which files exist is known at
/// generation time, and asking the network for filenames would be a strange
/// thing for a phone to do.
const List<String> _marks = [
  'adidas', 'chanel', 'christian-dior', 'fendi', 'gucci', 'hermes', 'louis-vuitton', 'prada', 'valentino', 'yves-saint-laurent',
];
final Set<String> _hasMark = _marks.toSet();

class _House {
  final J item;
  final String name;
  final String logo;
  final int count;
  final bool known;
  const _House({required this.item, required this.name, required this.logo, required this.count, required this.known});
}

/// The houses the shop carries, each with how many pieces it holds.
///
/// It points at the collection the shop already keeps per house, and the count
/// is read off the catalogue every time it draws. A hand-typed count is wrong
/// by next week, and a wrong count is worse than none: it is the one number
/// here a shopper could check.
Widget? brandWallSection(SectionCtx c) {
  final s = c.settings;
  String markFor(String handle) => _hasMark.contains(handle) ? '$siteOrigin/brands/$handle.webp' : '';

  final houses = <_House>[];
  for (final i in s.l('items')) {
    CollectionInfo? found;
    if (i.has('handle')) {
      for (final col in c.data.collections) {
        if (col.handle == i.s('handle')) {
          found = col;
          break;
        }
      }
    }
    final name = i.s('label').isNotEmpty ? i.s('label') : (found != null && found.title.isNotEmpty ? found.title : i.s('handle'));
    // Hers first, because that is her saying so; then the mark this shop
    // ships for the handle; then a collection picture, but only if it is hers
    // rather than the first product's.
    var logo = i.s('imageUrl');
    if (logo.isEmpty) logo = markFor(i.s('handle'));
    if (logo.isEmpty && found != null && found.ownImage) logo = found.image ?? '';
    final h = _House(item: i, name: name, logo: logo, count: found?.productCount ?? 0, known: found != null);
    if (h.name.isNotEmpty && (!h.known || h.count > 0)) houses.add(h);
  }
  if (houses.isEmpty) return null;
  return _BrandWall(settings: s, houses: houses, links: c.links);
}

class _BrandWall extends StatelessWidget {
  final J settings;
  final List<_House> houses;
  final LinkHandlers links;
  const _BrandWall({required this.settings, required this.houses, required this.links});

  @override
  Widget build(BuildContext context) {
    final s = settings;
    final screen = MediaQuery.sizeOf(context).width;
    final rowsN = s.n('rows');
    final rows = math.max(1, math.min(4, (rowsN > 0 ? rowsN : 3).truncate()));
    // How wide a tile is. The card keeps its shape, the mark square is as tall
    // as the card, and the type scales from that height so a smaller tile does
    // not keep full-size words. Floored at nine, below which a name stops
    // being readable.
    final sizeN = s.n('size');
    final size = math.max(110, math.min(300, (sizeN > 0 ? sizeN : 178).truncate())).toDouble();
    final cardH = (size * 0.34).roundToDouble();
    // The room the words have: the tile less the mark square and the panel's
    // padding. Scaling from this keeps a long name inside its panel at every
    // width rather than at most of them.
    final panelW = size - cardH - 16;
    final nameSize = math.max(9, math.min(13, (panelW * 0.1).round())).toDouble();
    // A mark stored as /brands/gucci.webp is relative to the shop, and a phone
    // has no shop to be relative to.
    String full(String u) => u.contains('//') ? u : siteOrigin + u;
    final showCount = s['showCount'] != false;
    void go(J to) => openLink(to, links);

    final columns = <List<_House>>[];
    for (var i = 0; i < houses.length; i += rows) {
      columns.add(houses.sublist(i, math.min(i + rows, houses.length)));
    }
    // Each column is at least the tile width and shares out any room left over,
    // the way the editor sizes its columns (minmax(size, 1fr)): a short wall
    // fills the row rather than stopping part way across it.
    final room = screen - Spacing.lg * 2;
    final natural = columns.length * size + (columns.length - 1) * gap.item;
    final colW = natural < room ? (room - (columns.length - 1) * gap.item) / columns.length : size;
    final ts0 = s.n('titleSize');
    final titleSize = ts0 > 0 ? ts0 : 16.0;
    final linkSize = titleSize <= 16 ? 12.0 : (titleSize * 0.82).roundToDouble();
    final markSize = math.max(7.0, nameSize - 3);
    final link = css(s.s('linkColor'), colors.accent);
    final title = s.s('title');
    final subtitle = s.s('subtitle');
    final seeAllLabel = s.s('seeAllLabel');
    final countSize = math.max(8.0, nameSize - 2);

    Widget card(_House h) {
      return Tap(
        onTap: () => go(h.item),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: colW,
            height: cardH,
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(
                width: cardH,
                color: const Color(0xFF0F172A),
                padding: const EdgeInsets.all(6),
                alignment: Alignment.center,
                child: h.logo.isNotEmpty
                    // The marks are stored dark on transparent, which is right
                    // on a white tile and invisible on this one. tintColor
                    // repaints every opaque pixel, so one file serves both grounds.
                    ? SizedBox.expand(
                        child: CachedNetworkImage(
                          imageUrl: sizedImage(full(h.logo), 256, MediaQuery.devicePixelRatioOf(context)),
                          fit: BoxFit.contain,
                          color: const Color(0xFFFFFFFF),
                          colorBlendMode: BlendMode.srcIn,
                          fadeInDuration: const Duration(milliseconds: 150),
                          errorWidget: (_, _, _) => const SizedBox.shrink(),
                          placeholder: (_, _) => const SizedBox.shrink(),
                        ),
                      )
                    : Text(
                        h.name.toUpperCase(),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: ts(markSize, w: 700, c: const Color(0xFFFFFFFF), lh: (markSize * 1.1).roundToDouble(), ls: markSize * 0.08),
                      ),
              ),
              Expanded(
                child: Container(
                  color: const Color(0xFFF1F5F9),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(h.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: ts(nameSize, c: const Color(0xFF0F172A), lh: (nameSize * 1.25).roundToDouble())),
                      if (showCount && h.count > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Text('${grouped(h.count)}${h.count == 1 ? ' piece' : ' pieces'}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: ts(countSize, c: const Color(0xFF94A3B8), lh: (countSize * 1.25).roundToDouble())),
                        ),
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Text('Visit the store ›',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: ts(nameSize, w: 600, c: link, lh: (nameSize * 1.25).roundToDouble())),
                      ),
                    ],
                  ),
                ),
              ),
            ]),
          ),
        ),
      );
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      // The editor's heading for a row: the title over its small line, the
      // link centred against the pair.
      if (title.isNotEmpty || subtitle.isNotEmpty || seeAllLabel.isNotEmpty)
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              if (title.isNotEmpty)
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ts(titleSize,
                        w: 700, c: const Color(0xFF0F172A), family: titleFont, ls: titleFont != null ? -0.16 : -0.4)),
              if (subtitle.isNotEmpty)
                Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, lh: 16, c: const Color(0xFF64748B))),
            ]),
          ),
          if (seeAllLabel.isNotEmpty) ...[
            const SizedBox(width: Spacing.sm),
            Tap(
              onTap: () => go(J({'handle': s['seeAllHandle'], 'url': s['seeAllUrl']})),
              child: Text('$seeAllLabel ›', style: ts(linkSize, w: 700, c: link)),
            ),
          ],
        ]),
      // Out to the screen's edges like the editor's rail, the page margin put back inside.
      Padding(
        padding: const EdgeInsets.only(top: Spacing.sm),
        child: Bleed(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(left: Spacing.lg, right: Spacing.lg, bottom: Spacing.xs),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var at = 0; at < columns.length; at++) ...[
                if (at > 0) SizedBox(width: gap.item),
                Column(mainAxisSize: MainAxisSize.min, children: [
                  for (var k = 0; k < columns[at].length; k++) ...[
                    if (k > 0) SizedBox(height: gap.item),
                    card(columns[at][k]),
                  ],
                ]),
              ],
            ]),
          ),
        ),
      ),
    ]);
  }
}
