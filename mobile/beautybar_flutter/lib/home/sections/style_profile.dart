/// Style profile. Port of StyleProfile.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// Put the shopper name in, or take the token out.
String _personalise(String template, String? name) {
  final first = (name ?? '').trim().split(' ').first;
  if (first.isNotEmpty) return template.split('{name}').join(first);
  var out = template.split('{name}').join('').trim();
  // A possessive reads as "'s profile" once the name is gone, so the
  // apostrophe leaves with it rather than dangling at the front of the line.
  if (out.startsWith("'s ") || out.startsWith('’s ')) out = out.substring(3).trim();
  if (out == "'s" || out == '’s') out = '';
  while (out.startsWith(',') || out.startsWith('،')) {
    out = out.substring(1).trim();
  }
  return out.isNotEmpty ? out[0].toUpperCase() + out.substring(1) : '';
}

Widget? styleProfileSection(SectionCtx c, {String? shopperName}) {
  final s = c.settings;
  final items = s.l('items').where((i) => i.s('label').isNotEmpty).toList();
  final cardTitle = _personalise(s.s('cardTitle'), shopperName);
  if (items.isEmpty && cardTitle.isEmpty) return null;
  return _StyleProfile(settings: s, items: items, cardTitle: cardTitle, links: c.links);
}

class _StyleProfile extends StatelessWidget {
  final J settings;
  final List<J> items;
  final String cardTitle;
  final LinkHandlers links;
  const _StyleProfile({required this.settings, required this.items, required this.cardTitle, required this.links});

  @override
  Widget build(BuildContext context) {
    final s = settings;
    void go(J to) => openLink(to, links);
    final radius = s.n('radius');
    final r = radius > 0 ? radius : 14.0;
    // The club's own colours, so a shopper's taste sits on the same card her
    // status does rather than on a settings panel.
    final society = s.s('style') != 'plain';
    final deep = css(s.sOr('deepFrom', '#2b2119'), const Color(0xFF2B2119));
    final deepTo = css(s.sOr('deepTo', '#43301f'), const Color(0xFF43301F));
    final gold = css(s.sOr('gold', '#e0b877'), const Color(0xFFE0B877));
    final onDeep = css(s.sOr('onDeep', '#f0e6d8'), const Color(0xFFF0E6D8));
    final onDeepSoft = css(s.sOr('onDeepSoft', '#c9b79f'), const Color(0xFFC9B79F));
    final opens = s.s('handle').isNotEmpty || s.s('url').isNotEmpty || s.s('productId').isNotEmpty || s.s('screen').isNotEmpty;
    final kicker = s.sOr('kicker', 'Your society');
    final glyph = s.sOr('glyph', '✦');
    // The faint gold wash in the corner. The preview blurs one circle; a phone
    // has no blur, so it is drawn as rings that fade outwards round the same
    // centre - 24 in from the right edge, 16 down from the top.
    const wash = [176.0, 152.0, 128.0, 104.0, 80.0];
    final title = s.s('title');
    final subtitle = s.s('subtitle');
    final cardSubtitle = s.s('cardSubtitle');
    final footNote = s.s('footNote');
    const slate = Color(0xFF64748B);

    final Widget head;
    if (society) {
      head = Tap(
        onTap: opens ? () => go(s) : null,
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              if (kicker.isNotEmpty)
                Text((glyph.isNotEmpty ? '$glyph ' : '') + kicker.toUpperCase(), style: ts(9, w: 700, lh: 13, ls: 1.8, c: gold)),
              if (cardTitle.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(cardTitle,
                      style: ts(17, w: 700, lh: 21, c: onDeep, family: titleFont, ls: titleFont != null ? -0.17 : 0)),
                ),
              if (cardSubtitle.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(cardSubtitle, style: ts(11, lh: 16, c: onDeepSoft)),
                ),
            ]),
          ),
          if (opens) ...[
            const SizedBox(width: 8),
            Text('→', style: ts(13, lh: 19, c: gold)),
          ],
        ]),
      );
    } else {
      head = Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        if (cardTitle.isNotEmpty) Text(cardTitle, style: ts(12, w: 700, lh: 18, c: colors.ink)),
        if (cardSubtitle.isNotEmpty) Text(cardSubtitle, style: ts(11, lh: 16, c: slate)),
      ]);
    }

    Widget tag(J i) {
      final colorS = i.s('color');
      final has = colorS.isNotEmpty;
      final Color border;
      final Color bg;
      if (society) {
        border = has ? cssA(colorS, 'aa') : hexA(gold, '59');
        bg = has ? cssA(colorS, '1f') : hexA(gold, '14');
      } else {
        border = has ? css(colorS) : colors.line;
        bg = has ? cssA(colorS, '0f') : colors.surface;
      }
      return Tap(
        onTap: () => go(i),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(color: bg, border: Border.all(color: border), borderRadius: BorderRadius.circular(999)),
          child: Text(i.s('label'),
              style: ts(11, w: 500, lh: 16, c: has ? css(colorS) : (society ? onDeep : colors.inkMuted))),
        ),
      );
    }

    final content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      head,
      Padding(
        padding: EdgeInsets.only(top: society ? 12 : 8),
        child: Wrap(spacing: 6, runSpacing: 6, children: [for (final i in items) tag(i)]),
      ),
      if (footNote.isNotEmpty)
        Padding(
          padding: EdgeInsets.only(top: society ? 12 : 8),
          child: Text(footNote, style: society ? ts(10, lh: 15, c: onDeepSoft) : ts(11, lh: 16, c: slate)),
        ),
    ]);

    final card = Container(
      margin: const EdgeInsets.only(top: Spacing.sm),
      decoration: BoxDecoration(
        color: society ? deep : css(s.s('cardBg'), colors.surface),
        border: Border.all(color: society ? hexA(gold, '3d') : colors.line),
        borderRadius: BorderRadius.circular(r),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(clipBehavior: Clip.none, children: [
        if (society)
          Positioned.fill(
            child: Fade(angle: 135, colors: [deep, deep, deepTo], locations: const [0, 0.45, 1], borderRadius: BorderRadius.circular(r)),
          ),
        if (society)
          for (final d in wash)
            Positioned(
              right: 24 - d / 2,
              top: 16 - d / 2,
              width: d,
              height: d,
              child: IgnorePointer(
                child: Opacity(
                  opacity: 0.04,
                  child: Container(decoration: BoxDecoration(color: gold, shape: BoxShape.circle)),
                ),
              ),
            ),
        Padding(padding: EdgeInsets.all(society ? 16 : 12), child: content),
      ]),
    );

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      if (title.isNotEmpty)
        Text(title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: ts(16, w: 700, lh: 24, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4)),
      if (subtitle.isNotEmpty) Text(subtitle, style: ts(11, lh: 16, c: slate)),
      card,
    ]);
  }
}
