/// Banner. Port of Banner.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// One picture with an optional heading over it; tapping it follows its link
/// (a collection, a product, a screen or an address).
Widget? bannerSection(SectionCtx c) {
  final s = c.settings;
  final heading = s.s('heading');
  final subheading = s.s('subheading');
  final handle = s.s('handle');
  var imageUrl = s.s('imageUrl');
  if (imageUrl.isEmpty) {
    for (final col in c.data.collections) {
      if (col.handle == handle) {
        imageUrl = col.image ?? '';
        break;
      }
    }
  }
  if (imageUrl.isEmpty && heading.isEmpty) return null;
  return Tap(
    onTap: () => openLink(s, c.links),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(Radii.lg),
      child: Container(
        height: 144,
        color: colors.page,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (imageUrl.isNotEmpty) Positioned.fill(child: NetImage(imageUrl, fit: BoxFit.cover)),
            if (heading.isNotEmpty || subheading.isNotEmpty)
              Positioned.fill(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  color: const Color(0x47000000), // rgba(0,0,0,0.28)
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (heading.isNotEmpty) Text(heading, style: ts(17, w: 700, c: const Color(0xFFFFFFFF))),
                      if (subheading.isNotEmpty) Text(subheading, style: ts(11, c: const Color(0xD9FFFFFF))),
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
