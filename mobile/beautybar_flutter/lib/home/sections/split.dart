/// Split panels. Port of Split.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// Two pictures side by side (at most two), each with a caption strip.
Widget? splitSection(SectionCtx c) {
  final s = c.settings;
  final panels = s.l('items').take(2).toList();
  if (panels.isEmpty) return null;
  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      SectionHeading(title: s.s('title')),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
        child: Row(
          children: [
            for (var n = 0; n < panels.length; n++) ...[
              if (n > 0) SizedBox(width: gap.itemTight),
              Expanded(
                child: _Panel(item: panels[n], c: c),
              ),
            ],
          ],
        ),
      ),
    ],
  );
}

class _Panel extends StatelessWidget {
  final J item;
  final SectionCtx c;
  const _Panel({required this.item, required this.c});

  @override
  Widget build(BuildContext context) {
    final got = inherit(item, c.data.collections);
    final image = got.image;
    final button = item.s('buttonLabel');
    return Tap(
      onTap: () => openLink(item, c.links),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Radii.lg),
        child: Container(
          height: 220,
          color: colors.page,
          child: Stack(
            children: [
              if (image != null && image.isNotEmpty) Positioned.fill(child: NetImage(image, fit: BoxFit.cover)),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  color: const Color(0x59000000), // rgba(0,0,0,0.35)
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(got.title, style: ts(14, w: 700, c: const Color(0xFFFFFFFF))),
                      if (button.isNotEmpty) Text(button, style: ts(10, c: const Color(0xD9FFFFFF))),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
