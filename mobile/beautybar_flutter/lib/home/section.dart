/// What every home section is handed. (The props HomeScreen.tsx passes.)
library;

import '../core/api.dart';
import '../core/json.dart';
import '../core/links.dart';

class SectionCtx {
  /// The section's settings, as the editor saved them (b.settings).
  final J settings;
  /// The home payload: collections, rows, newArrivals, reviews, lives, payments.
  final HomePayload data;
  /// Suggestions for whoever is signed in (complete_look only); may be null.
  final Recommendations? recs;
  final LinkHandlers links;
  /// Put a single-variant product in the basket, for a section that can.
  final OnAdd? onAdd;

  const SectionCtx({required this.settings, required this.data, required this.recs, required this.links, this.onAdd});

  OnOpenCollection? get onOpenCollection => links.onOpenCollection;
  OnOpenProduct? get onOpenProduct => links.onOpenProduct;
  OnOpenScreen? get onOpenScreen => links.onOpenScreen;
}
