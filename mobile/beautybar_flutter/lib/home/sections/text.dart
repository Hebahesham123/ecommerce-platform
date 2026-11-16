import 'package:flutter/widgets.dart';

import '../../core/style.dart';
import '../../core/theme.dart';
import '../section.dart';

/// Text. Generated from the dashboard — App → App theme. (Port of Text.tsx.)
Widget? textSection(SectionCtx c) {
  final heading = c.settings.s('heading');
  final body = c.settings.s('body');
  if (heading.isEmpty && body.isEmpty) return null;
  return Container(
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(color: colors.page, borderRadius: BorderRadius.circular(Radii.lg)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (heading.isNotEmpty) Text(heading, style: ts(15, w: 700, c: colors.ink)),
        if (body.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(body, style: ts(12, lh: 18, c: colors.inkMuted)),
          ),
      ],
    ),
  );
}
