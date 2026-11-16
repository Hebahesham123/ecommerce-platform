/// Where the merchant pointed something, and who knows how to get there. (Pieces.tsx)
library;

import 'package:url_launcher/url_launcher.dart';
import 'json.dart';

typedef OnOpenCollection = void Function(String handle);
typedef OnOpenProduct = void Function(String id);
typedef OnOpenScreen = void Function(String screen);

/// Put a single-variant product in the basket.
typedef OnAdd = void Function(String variantId, String productId);

/// Who knows how to get there. Every section that links takes these.
class LinkHandlers {
  final OnOpenCollection? onOpenCollection;
  final OnOpenProduct? onOpenProduct;
  final OnOpenScreen? onOpenScreen;
  const LinkHandlers({this.onOpenCollection, this.onOpenProduct, this.onOpenScreen});
}

/// Open a web address outside the app.
Future<void> openUrl(String url) async {
  try {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  } catch (_) {}
}

/// Follow one link: an item with any of url / productId / screen / handle,
/// checked most-specific first (exactly as openLink in Pieces.tsx).
void openLink(J to, LinkHandlers h) {
  final url = to.s('url');
  if (url.isNotEmpty) {
    openUrl(url);
    return;
  }
  final productId = to.s('productId');
  if (productId.isNotEmpty) return h.onOpenProduct?.call(productId);
  final screen = to.s('screen');
  if (screen.isNotEmpty) return h.onOpenScreen?.call(screen);
  final handle = to.s('handle');
  if (handle.isNotEmpty) return h.onOpenCollection?.call(handle);
}

/// Whether an item links anywhere at all.
bool hasLink(J to) => to.s('url').isNotEmpty || to.s('productId').isNotEmpty || to.s('screen').isNotEmpty || to.s('handle').isNotEmpty;
