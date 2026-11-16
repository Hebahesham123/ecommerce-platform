/// Port of PageScreen.tsx: AllCollectionsScreen and PageScreen.
library;

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/json.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../widgets/pieces.dart' show NetImage, Tap;

const Color _blank = Color(0xFFF3ECE4);

/// Every department the shop has, drawn as a page.
///
/// The list is the catalogue's, asked for here rather than carried through the
/// app for a screen that may never be opened, and never kept by hand: a second
/// list of departments is a list that goes out of date.
class AllCollectionsScreen extends StatefulWidget {
  final void Function(String handle, String title) onOpen;
  const AllCollectionsScreen({super.key, required this.onOpen});
  @override
  State<AllCollectionsScreen> createState() => _AllCollectionsScreenState();
}

class _AllCollectionsScreenState extends State<AllCollectionsScreen> {
  List<J>? _items;

  @override
  void initState() {
    super.initState();
    fetchHome().then((home) {
      if (!mounted) return;
      setState(() => _items = home.collections
          .map((c) => J({
                'id': c.handle,
                'imageUrl': c.image,
                'label': c.title,
                'handle': c.handle,
              }))
          .toList());
    }).catchError((Object _) {
      if (mounted) setState(() => _items = []);
    });
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    if (items == null) {
      return Padding(
        padding: const EdgeInsets.all(Spacing.xl),
        child: Center(
          // RN ActivityIndicator, small (20).
          child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: colors.accent)),
        ),
      );
    }
    return PageScreen(
      page: J({'id': 'all-collections', 'handle': 'collections', 'line2': 'All collections', 'layout': 'circles', 'items': items.map((i) => i.raw).toList()}),
      onOpen: (tile) => widget.onOpen(tile.s('handle'), tile.s('label')),
    );
  }
}

/// Not a collection: a collection is a wall of products, and the honest answer
/// to "what do you have for her?" is eleven answers. So it is the website's own
/// shape - a small line, a headline over two lines, and pictures that each open
/// a collection.
///
/// [page] is a theme page J: id, handle, kicker, line1, line2, layout, items[] (J tiles).
class PageScreen extends StatelessWidget {
  final J page;
  final void Function(J tile) onOpen;
  const PageScreen({super.key, required this.page, required this.onOpen});

  @override
  Widget build(BuildContext context) {
    final tiles = page.l('items').where((t) => t.s('label').isNotEmpty || t.s('imageUrl').isNotEmpty).toList();
    final circles = page.s('layout') != 'tiles';
    final kicker = page.s('kicker');
    final line1 = page.s('line1');
    final line2 = page.s('line2');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(Spacing.lg),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
            if (kicker.isNotEmpty) Text(kicker.toUpperCase(), style: ts(10, w: 700, ls: 2.4, c: colors.accent)),
            if (line1.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(line1.toUpperCase(), style: ts(15, w: 600, ls: 3, c: colors.inkMuted)),
              ),
            if (line2.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(line2, style: ts(26, w: 700, c: colors.ink, family: titleFont)),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: LayoutBuilder(builder: (context, box) {
            final w = box.maxWidth;
            return Wrap(children: [
              for (final t in tiles)
                SizedBox(
                  key: ValueKey(t.s('id')),
                  width: circles ? w * 0.3333 : w * 0.5,
                  child: Tap(onTap: () => onOpen(t), child: circles ? _circle(t) : _tile(t)),
                ),
            ]);
          }),
        ),
      ]),
    );
  }

  Widget _circle(J t) {
    final label = t.s('label');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
        AspectRatio(
          aspectRatio: 1,
          child: ClipOval(
            child: ColoredBox(
              color: _blank,
              child: t.s('imageUrl').isNotEmpty ? NetImage(t.s('imageUrl'), fit: BoxFit.cover) : const SizedBox.expand(),
            ),
          ),
        ),
        if (label.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(label.toUpperCase(),
                maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, w: 600, ls: 1, c: colors.ink)),
          ),
      ]),
    );
  }

  Widget _tile(J t) {
    final label = t.s('label');
    return Padding(
      padding: const EdgeInsets.all(4),
      child: AspectRatio(
        aspectRatio: 0.75,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: ColoredBox(
            color: _blank,
            child: LayoutBuilder(builder: (context, box) {
              return Stack(children: [
                if (t.s('imageUrl').isNotEmpty) Positioned.fill(child: NetImage(t.s('imageUrl'), fit: BoxFit.cover)),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: box.maxHeight / 2,
                  child: const ColoredBox(color: Color.fromRGBO(20, 12, 7, 0.42)),
                ),
                if (label.isNotEmpty)
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: 10,
                    child: Text(label.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: ts(12, w: 700, ls: 0.8, c: const Color(0xFFFFFFFF))),
                  ),
              ]);
            }),
          ),
        ),
      ),
    );
  }
}
