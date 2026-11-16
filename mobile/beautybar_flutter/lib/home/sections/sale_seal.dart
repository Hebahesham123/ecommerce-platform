/// Sale banner with a seal. Port of SaleSeal.tsx.
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// A coloured panel with a slowly turning ring of words round a big figure,
/// and optionally a picture beside it (or under it, "stacked").
Widget? saleSealSection(SectionCtx c) {
  final s = c.settings;
  if (s.s('bigText').isEmpty && s.s('tagline').isEmpty && s.s('imageUrl').isEmpty) return null;
  return _SaleSeal(settings: s, links: c.links);
}

/// A colour at a given strength, as the editor writes it: the hex plus two
/// digits of alpha (anything that is not a 3- or 6-digit hex is left as it is).
Color _alpha(String c, String a) {
  if (RegExp(r'^#[0-9a-f]{6}$', caseSensitive: false).hasMatch(c) ||
      RegExp(r'^#[0-9a-f]{3}$', caseSensitive: false).hasMatch(c)) {
    return cssA(c, a);
  }
  return css(c);
}

class _SaleSeal extends StatefulWidget {
  final J settings;
  final LinkHandlers links;
  const _SaleSeal({required this.settings, required this.links});
  @override
  State<_SaleSeal> createState() => _SaleSealState();
}

class _SaleSealState extends State<_SaleSeal> with SingleTickerProviderStateMixin {
  /// A minute a turn: noticed rather than watched.
  late final AnimationController _spin = AnimationController(vsync: this, duration: const Duration(milliseconds: 60000))
    ..repeat();

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final stacked = s.s('layout') == 'stacked';
    final bgText = s.sOr('bg', '#7a4b27');
    final bg = css(bgText, const Color(0xFF7A4B27));
    final inkText = s.sOr('inkColor', '#ffffff');
    final ink = css(inkText, const Color(0xFFFFFFFF));
    final ringText = s.sOr('ringColor', inkText);
    final ring = css(ringText, ink);
    final hv = s.nOrNull('height');
    final h = hv != null && hv > 0 ? hv : 230.0;
    final rv = s.nOrNull('radius');
    final r = rv != null && rv > 0 ? rv : 18.0;
    final seal = math.min(150, (h * 0.62).round()).toDouble();
    final reach = seal / 2 - 9;
    final opens = hasLink(s);

    final line = s.s('ringText').replaceAll(RegExp(r'\s*·\s*'), ' · ').trim();
    final letters = '$line · $line · '.split('');

    final small = s.s('smallText');
    final big = s.s('bigText');
    final tagline = s.s('tagline');
    final button = s.s('buttonLabel');
    final imageUrl = s.s('imageUrl');

    final sealView = SizedBox(
      width: seal,
      height: seal,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _spin,
              builder: (_, child) => Transform.rotate(angle: _spin.value * 2 * math.pi, child: child),
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  for (var i = 0; i < letters.length; i++)
                    Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.rotationZ((i / letters.length) * 2 * math.pi)
                          .multiplied(Matrix4.translationValues(0, -reach, 0)),
                      child: Text(
                        letters[i] == ' ' ? ' ' : letters[i].toUpperCase(),
                        style: ts(8, w: 700, ls: 0.16, c: ring),
                      ),
                    ),
                ],
              ),
            ),
          ),
          // A hairline ring at 35% of the ring colour, 13 in from the seal's edge.
          Positioned(
            left: 13,
            right: 13,
            top: 13,
            bottom: 13,
            child: Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: _alpha(ringText, '59')),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (small.isNotEmpty)
                    Text(
                      small,
                      style: ts(13, lh: 14, italic: true, c: ring, family: titleFont),
                    ),
                  if (big.isNotEmpty)
                    Text(
                      big,
                      style: ts(30, lh: 32, w: 700, c: ink, family: titleFont),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );

    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          sealView,
          if (tagline.isNotEmpty) ...[
            const SizedBox(height: 8),
            Opacity(
              opacity: 0.9,
              child: Text(
                tagline,
                textAlign: TextAlign.center,
                style: ts(11, lh: 15, c: ink),
              ),
            ),
          ],
          if (button.isNotEmpty) ...[
            const SizedBox(height: 8 + 2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(999)),
              child: Text(button.toUpperCase(), style: ts(11, lh: 16, w: 700, ls: 1.32, c: bg)),
            ),
          ],
        ],
      ),
    );

    final panel = Container(
      color: bg,
      constraints: stacked ? BoxConstraints(minHeight: (h * 0.78).roundToDouble()) : null,
      child: Stack(
        fit: StackFit.passthrough,
        alignment: Alignment.center,
        children: [
          Positioned.fill(child: Fade(angle: 150, colors: [bg, css(s.s('bg2'), colors.accent)])),
          content,
        ],
      ),
    );

    Widget? picture(double? width, double? height) {
      if (imageUrl.isEmpty) return null;
      // The picture is cropped to fill its frame around the point she chose
      // ("50% 40%"), the way object-position crops it in the editor: cover
      // with an alignment places it exactly as RN's FocalImage does.
      final m = RegExp(r'(-?[\d.]+)%\s+(-?[\d.]+)%').firstMatch(s.s('focal'));
      double part(String? v) {
        final x = double.tryParse(v ?? '');
        return x == null ? 0.5 : (x / 100).clamp(0.0, 1.0);
      }

      final fx = m != null ? part(m.group(1)) : 0.5;
      final fy = m != null ? part(m.group(2)) : 0.5;
      final badge = s.s('badge');
      return SizedBox(
        width: width,
        height: height,
        child: ClipRect(
          child: Stack(
            children: [
              Positioned.fill(
                child: NetImage(imageUrl, fit: BoxFit.cover, alignment: Alignment(fx * 2 - 1, fy * 2 - 1)),
              ),
              if (badge.isNotEmpty)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: css(s.sOr('badgeBg', '#2b1b10'), const Color(0xFF2B1B10)),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      badge,
                      style: ts(10, lh: 15, w: 700, c: css(s.sOr('badgeColor', '#ffffff'), const Color(0xFFFFFFFF))),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    Widget body;
    if (stacked) {
      final pic = picture(double.infinity, (h * 0.55).roundToDouble());
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [panel, ?pic],
      );
    } else {
      body = LayoutBuilder(
        builder: (context, box) {
          final pic = picture((box.maxWidth * 0.42), null);
          return ConstrainedBox(
            constraints: BoxConstraints(minHeight: h),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: panel),
                  ?pic,
                ],
              ),
            ),
          );
        },
      );
    }

    return Tap(
      onTap: opens ? () => openLink(s, widget.links) : null,
      child: ClipRRect(borderRadius: BorderRadius.circular(r), child: body),
    );
  }
}
