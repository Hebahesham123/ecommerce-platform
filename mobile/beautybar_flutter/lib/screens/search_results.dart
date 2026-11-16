/// What the search box on the front page turns up. Port of SearchResults.tsx.
///
/// The shop does the matching. An app that filtered a downloaded list could
/// only ever find what it had already fetched, which on a catalogue of any
/// size is a search that quietly lies about what the shop sells.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../widgets/pieces.dart';

/// Port of SearchResults.tsx.
class SearchResults extends StatefulWidget {
  final String query;
  final void Function(String id) onOpenProduct;
  const SearchResults({super.key, required this.query, required this.onOpenProduct});
  @override
  State<SearchResults> createState() => _SearchResultsState();
}

class _SearchResultsState extends State<SearchResults> {
  List<ProductCard>? _rows;
  String? _error;
  Timer? _timer;
  int _gen = 0;

  @override
  void initState() {
    super.initState();
    _search();
  }

  @override
  void didUpdateWidget(covariant SearchResults old) {
    super.didUpdateWidget(old);
    if (old.query != widget.query) _search();
  }

  @override
  void dispose() {
    _gen++;
    _timer?.cancel();
    super.dispose();
  }

  // Typing is not a request; a pause is. Without this every letter is a
  // round trip, and the answers race each other back.
  void _search() {
    final gen = ++_gen;
    _rows = null;
    _error = null;
    _timer?.cancel();
    final query = widget.query;
    _timer = Timer(const Duration(milliseconds: 300), () {
      searchProducts(query).then((d) {
        if (gen == _gen && mounted) setState(() => _rows = d.products);
      }).catchError((Object e) {
        if (gen == _gen && mounted) setState(() => _error = e.toString());
      });
    });
  }

  Widget _note(String text) => Padding(
        padding: const EdgeInsets.all(Spacing.xl),
        child: Text(text, textAlign: TextAlign.center, style: ts(13, c: colors.inkSoft)),
      );

  @override
  Widget build(BuildContext context) {
    if (_error != null) return _note(_error!);
    final rows = _rows;
    if (rows == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: Spacing.xl),
        child: Align(
          alignment: Alignment.topCenter,
          child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: colors.accent, strokeWidth: 2)),
        ),
      );
    }
    if (rows.isEmpty) return _note('Nothing matches “${widget.query}”.');

    final count = (rows.length / 2).ceil();
    return ListView.separated(
      padding: const EdgeInsets.all(Spacing.lg),
      itemCount: count,
      separatorBuilder: (_, _) => const SizedBox(height: Spacing.md),
      itemBuilder: (context, row) {
        final items = rows.skip(row * 2).take(2).toList();
        // Each tile is flex 0.5 of what its row has left after the gap.
        return LayoutBuilder(builder: (context, box) {
          final w = (box.maxWidth - Spacing.md * (items.length - 1)) * 0.5;
          return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const SizedBox(width: Spacing.md),
              SizedBox(
                width: w,
                child: ProductTile(key: ValueKey(items[i].id), card: items[i], fill: true, onPress: widget.onOpenProduct),
              ),
            ],
          ]);
        });
      },
    );
  }
}
