/// Talking to the store. Port of api.ts.
///
/// The channel header is what makes an order show up under App in the
/// dashboard, and which Meta dataset its purchase reports to.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/widgets.dart' show AppLifecycleState, WidgetsBinding, WidgetsBindingObserver;
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

import 'json.dart';

const String apiBase = 'https://srv2120209.hstgr.cloud/api/storefront';

/// The website itself, for the screens that are simply the real site shown in the app.
final String siteOrigin = apiBase.replaceFirst(RegExp(r'/api/storefront/?$'), '');

/// The sizes our server's image resizer makes (next.config defaults).
const List<int> _imageWidths = [64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];

/// A small WebP copy of a picture, sized for where it is shown, instead of the full original
/// (banners are 2+ MB; the copy is ~100 KB). Only for our own files and Shopify photos;
/// anything else (SVG, GIF, other sites) is returned unchanged.
String sizedImage(String url, double logicalWidth, double pixelRatio) {
  final uri = Uri.tryParse(url);
  if (uri == null || !uri.hasScheme) return url;
  final host = uri.host;
  final ours = host == Uri.parse(siteOrigin).host && uri.path.startsWith('/media/');
  if (!ours && host != 'cdn.shopify.com') return url;
  final path = uri.path.toLowerCase();
  if (path.endsWith('.svg') || path.endsWith('.gif')) return url;
  final want = (logicalWidth.isFinite && logicalWidth > 0 ? logicalWidth : 400) * pixelRatio;
  final w = _imageWidths.firstWhere((s) => s >= want, orElse: () => _imageWidths.last);
  return '$siteOrigin/_next/image?url=${Uri.encodeComponent(url)}&w=$w&q=75';
}

String? _token;
void setToken(String? t) => _token = t;
String? get token => _token;

/// This phone, as the shop's customer tracking knows it (made once in boot.dart).
String _visitor = '';
void setVisitor(String v) => _visitor = v;
String get visitor => _visitor;

class ApiError implements Exception {
  final String message;
  ApiError(this.message);
  @override
  String toString() => message;
}

Map<String, dynamic> _device() {
  final view = PlatformDispatcher.instance.views.isNotEmpty ? PlatformDispatcher.instance.views.first : null;
  final ratio = view?.devicePixelRatio ?? 1;
  return {
    'platform': Platform.isIOS ? 'ios' : 'android',
    'osVersion': Platform.operatingSystemVersion,
    'bundleId': '',
    'appVersion': '',
    'buildVersion': '',
    'model': '',
    'locale': Platform.localeName,
    'timezone': DateTime.now().timeZoneName,
    'width': ((view?.physicalSize.width ?? 0) / ratio).round(),
    'height': ((view?.physicalSize.height ?? 0) / ratio).round(),
    'density': ratio,
    'tracking': false,
  };
}

final http.Client _client = http.Client();

/// One request to the storefront API. Answers `data` from `{ ok, data }`,
/// throws [ApiError] with the shop's error otherwise.
Future<dynamic> api(String path, {String method = 'GET', Object? body}) async {
  final headers = <String, String>{
    'x-store-channel': 'app',
    'x-app-device': Uri.encodeComponent(jsonEncode(_device())),
    if (body != null) 'content-type': 'application/json',
    if (_token != null) 'authorization': 'Bearer $_token',
    if (_visitor.isNotEmpty) 'x-visitor': _visitor,
  };
  final uri = Uri.parse(apiBase + path);
  final req = http.Request(method, uri)..headers.addAll(headers);
  if (body != null) req.body = jsonEncode(body);
  final res = await http.Response.fromStream(await _client.send(req));
  dynamic json;
  try {
    json = jsonDecode(utf8.decode(res.bodyBytes));
  } catch (_) {
    throw ApiError('request_failed');
  }
  if (json is! Map || json['ok'] != true) {
    throw ApiError(json is Map && json['error'] != null ? json['error'].toString() : 'request_failed');
  }
  return json['data'];
}

// ------------------------------------------------------------------ models --

double? _num(dynamic v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);

/// A product as a card shows it (Card in api.ts).
class ProductCard {
  final String id;
  final String handle;
  final String name;
  final String? image;
  final double? priceMin;
  final double? compareAt;
  final String? vendor;
  /// The only variant, when there is exactly one - so a card can add it straight away.
  final String? variantId;
  final int? variantCount;
  /// How many are left.
  final int? available;
  /// How many have been bought.
  final int? sold;
  final J raw;

  ProductCard({
    required this.id,
    required this.handle,
    required this.name,
    this.image,
    this.priceMin,
    this.compareAt,
    this.vendor,
    this.variantId,
    this.variantCount,
    this.available,
    this.sold,
    this.raw = J.empty,
  });

  factory ProductCard.from(dynamic v) {
    final j = J.from(v);
    return ProductCard(
      id: j.s('id'),
      handle: j.s('handle'),
      name: j.s('name'),
      image: j['image'] is String ? j['image'] as String : null,
      priceMin: _num(j['priceMin']),
      compareAt: _num(j['compareAt']),
      vendor: j['vendor'] is String ? j['vendor'] as String : null,
      variantId: j['variantId']?.toString(),
      variantCount: _num(j['variantCount'])?.toInt(),
      available: _num(j['available'])?.toInt(),
      sold: _num(j['sold'])?.toInt(),
      raw: j,
    );
  }

  static List<ProductCard> list(dynamic v) => v is List ? v.map(ProductCard.from).toList() : <ProductCard>[];
}

/// A collection as the home payload lists it.
class CollectionInfo {
  final String handle;
  final String title;
  final String? image;
  final bool ownImage;
  final int productCount;
  CollectionInfo({required this.handle, required this.title, this.image, this.ownImage = false, this.productCount = 0});
  factory CollectionInfo.from(dynamic v) {
    final j = J.from(v);
    return CollectionInfo(
      handle: j.s('handle'),
      title: j.s('title'),
      image: j['image'] is String ? j['image'] as String : null,
      ownImage: j.b('ownImage'),
      productCount: j.i('productCount'),
    );
  }
}

/// Everything the front page needs, in one request.
///
/// reviews: J with id, name, productRating (num|null), comment (String|null)
/// lives:   J with id, title, hostName, coverUrl, status, scheduledAt,
///          peakViewers, likes, pieces, href
/// payments: J with id, name, nameAr, kind, note, noteAr, color, logo
class HomePayload {
  final J theme;
  final List<CollectionInfo> collections;
  final Map<String, List<ProductCard>> rows;
  final List<ProductCard> newArrivals;
  final List<J> reviews;
  final List<J> lives;
  final List<J> payments;
  HomePayload({
    required this.theme,
    required this.collections,
    required this.rows,
    required this.newArrivals,
    required this.reviews,
    required this.lives,
    required this.payments,
  });
  factory HomePayload.from(dynamic v) {
    final j = J.from(v);
    final rows = <String, List<ProductCard>>{};
    j.o('rows').raw.forEach((k, val) => rows[k] = ProductCard.list(val));
    return HomePayload(
      theme: j.o('theme'),
      collections: (j.list('collections')).map(CollectionInfo.from).toList(),
      rows: rows,
      newArrivals: ProductCard.list(j['newArrivals']),
      reviews: j.l('reviews'),
      lives: j.l('lives'),
      payments: j.l('payments'),
    );
  }
}

HomePayload? _homeCache;
Future<HomePayload>? _homeInflight;

/// Everything the front page needs, in one request. (Shared by placed sections.)
Future<HomePayload> fetchHome({bool fresh = false}) {
  if (!fresh && _homeInflight != null) return _homeInflight!;
  final f = api('/home').then((d) => _homeCache = HomePayload.from(d));
  _homeInflight = f;
  f.catchError((_) {
    _homeInflight = null;
    return _homeCache ?? HomePayload.from(const {});
  });
  return f;
}

class Variant {
  final String id;
  final String? variantTitle;
  final String? sku;
  final double? price;
  final double? compareAt;
  final int available;
  Variant({required this.id, this.variantTitle, this.sku, this.price, this.compareAt, this.available = 0});
  factory Variant.from(dynamic v) {
    final j = J.from(v);
    return Variant(
      id: j.s('id'),
      variantTitle: j['variantTitle']?.toString(),
      sku: j['sku']?.toString(),
      price: _num(j['price']),
      compareAt: _num(j['compareAt']),
      available: j.i('available'),
    );
  }
}

class Product {
  final String id;
  final String handle;
  final String name;
  final String? description;
  final String? image;
  final List<String> images;
  final String? category;
  final String? vendor;
  final List<String> tags;
  final double? priceMin;
  final double? priceMax;
  final double? compareAt;
  final int available;
  final List<Variant> variants;
  final String? selectedVariantId;
  Product({
    required this.id,
    required this.handle,
    required this.name,
    this.description,
    this.image,
    this.images = const [],
    this.category,
    this.vendor,
    this.tags = const [],
    this.priceMin,
    this.priceMax,
    this.compareAt,
    this.available = 0,
    this.variants = const [],
    this.selectedVariantId,
  });
  factory Product.from(dynamic v) {
    final j = J.from(v);
    return Product(
      id: j.s('id'),
      handle: j.s('handle'),
      name: j.s('name'),
      description: j['description']?.toString(),
      image: j['image'] is String ? j['image'] as String : null,
      images: j.ls('images'),
      category: j['category']?.toString(),
      vendor: j['vendor']?.toString(),
      tags: j.ls('tags'),
      priceMin: _num(j['priceMin']),
      priceMax: _num(j['priceMax']),
      compareAt: _num(j['compareAt']),
      available: j.i('available'),
      variants: j.list('variants').map(Variant.from).toList(),
      selectedVariantId: j['selectedVariantId']?.toString(),
    );
  }
}

/// One product, by product handle or by variant id.
Future<Product> fetchProduct(String id) async => Product.from(await api('/products/${Uri.encodeComponent(id)}'));

/// Search the catalogue. Returns { products, count }.
Future<({List<ProductCard> products, int count})> searchProducts(String q, {int limit = 40}) async {
  final d = J.from(await api('/products?limit=$limit&q=${Uri.encodeComponent(q)}'));
  return (products: ProductCard.list(d['products']), count: d.i('count'));
}

/// "manual" | "price-ascending" | "price-descending" | "title-ascending" | "newest"
typedef Sort = String;

class CollectionFilters {
  final List<String> brands;
  final double min;
  final double max;
  final bool inStock;
  final bool onSale;
  const CollectionFilters({this.brands = const [], this.min = 0, this.max = 0, this.inStock = false, this.onSale = false});
}

/// One collection's products. Sorting and paging happen on the server.
///
/// Answers: collection (J: handle, title, description, image, productCount),
/// products, total, offset, limit, sort, facets (J: vendors [{name,count}], priceMin, priceMax) or null.
class CollectionPayload {
  final J collection;
  final List<ProductCard> products;
  final int total;
  final int offset;
  final int limit;
  final String sort;
  final J? facets;
  CollectionPayload(this.collection, this.products, this.total, this.offset, this.limit, this.sort, this.facets);
}

Future<CollectionPayload> fetchCollection(String handle,
    {Sort sort = 'manual', int offset = 0, int limit = 24, CollectionFilters? filters}) async {
  final f = filters;
  final path = '/collections/${Uri.encodeComponent(handle)}?sort=$sort&offset=$offset&limit=$limit'
      '${f != null && f.brands.isNotEmpty ? '&vendor=${Uri.encodeComponent(f.brands.join(','))}' : ''}'
      '${f != null && f.min > 0 ? '&minPrice=${_plain(f.min)}' : ''}'
      '${f != null && f.max > 0 ? '&maxPrice=${_plain(f.max)}' : ''}'
      '${f != null && f.inStock ? '&inStock=1' : ''}'
      '${f != null && f.onSale ? '&onSale=1' : ''}';
  final d = J.from(await api(path));
  return CollectionPayload(
    d.o('collection'),
    ProductCard.list(d['products']),
    d.i('total'),
    d.i('offset'),
    d.i('limit', limit),
    d.s('sort', sort),
    d.has('facets') ? d.o('facets') : null,
  );
}

String _plain(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

class PricedLine {
  final String itemId;
  final String productName;
  final String? variantTitle;
  final String? sku;
  final String? imageUrl;
  final double price;
  final int quantity;
  final int maxAvailable;
  /// True when the shop had fewer left than the basket asked for.
  final bool adjusted;
  PricedLine({
    required this.itemId,
    required this.productName,
    this.variantTitle,
    this.sku,
    this.imageUrl,
    required this.price,
    required this.quantity,
    required this.maxAvailable,
    required this.adjusted,
  });
  factory PricedLine.from(dynamic v) {
    final j = J.from(v);
    return PricedLine(
      itemId: j.s('itemId'),
      productName: j.s('productName'),
      variantTitle: j['variantTitle']?.toString(),
      sku: j['sku']?.toString(),
      imageUrl: j['imageUrl'] is String ? j['imageUrl'] as String : null,
      price: j.n('price'),
      quantity: j.i('quantity'),
      maxAvailable: j.i('maxAvailable'),
      adjusted: j.b('adjusted'),
    );
  }
}

class PricedCart {
  final List<PricedLine> lines;
  final double subtotal;
  final int itemCount;
  /// Lines that no longer exist or sold out, so the app can say so.
  final List<String> removed;
  PricedCart(this.lines, this.subtotal, this.itemCount, this.removed);
}

class CartLine {
  final String itemId;
  final int quantity;
  const CartLine(this.itemId, this.quantity);
  Map<String, dynamic> toJson() => {'itemId': itemId, 'quantity': quantity};
}

/// What the basket is really worth. Every price comes back from the shop.
Future<PricedCart> priceCart(List<CartLine> lines) async {
  final d = J.from(await api('/cart/price', method: 'POST', body: {'lines': lines.map((l) => l.toJson()).toList()}));
  return PricedCart(d.list('lines').map(PricedLine.from).toList(), d.n('subtotal'), d.i('itemCount'), d.ls('removed'));
}

/// What a code is worth on this basket. Checkout re-runs it, so this is a preview.
/// ok: code, label, amount, subtotal — not ok: reason, requiredAmount?, requiredQuantity?, subtotal
Future<J> previewDiscount(String code, List<CartLine> lines) async =>
    J.from(await api('/discount', method: 'POST', body: {'code': code, 'lines': lines.map((l) => l.toJson()).toList()}));

// -------------------------------------------------------------- signing in --

/// Is this number already known to the shop? status: "already_verified" | "needs_code"
Future<J> checkPhone(String phone) async => J.from(await api('/auth/request-code', method: 'POST', body: {'phone': phone}));

/// Send the code, the way the shopper chose: "sms" | "whatsapp".
Future<J> requestCode(String phone, String channel) async =>
    J.from(await api('/auth/request-code', method: 'POST', body: {'phone': phone, 'channel': channel}));

/// Trade a code for a token. Answers { token, phone }.
Future<J> verifyCode(String phone, String code, [String? name]) async =>
    J.from(await api('/auth/verify', method: 'POST', body: {'phone': phone, 'code': code, if (name != null) 'name': name}));

/// A number the shop already trusts needs no code. Answers { token, phone }.
Future<J> loginVerified(String phone) async => J.from(await api('/auth/login', method: 'POST', body: {'phone': phone}));

/// phone, name, email, governorate, city, address, orders[]
Future<J> fetchAccount() async => J.from(await api('/me'));
Future<List<J>> fetchOrders() async => J.from(await api('/orders')).l('orders');

class Address {
  final String customerName;
  final String? email;
  final String governorate;
  final String city;
  final String address;
  final String? note;
  final String? paymentMethod;
  const Address({
    required this.customerName,
    this.email,
    required this.governorate,
    required this.city,
    required this.address,
    this.note,
    this.paymentMethod,
  });
}

/// Place the order. Answers the order number.
Future<String> placeOrder(Address a, {required String phone, String? couponCode, required List<CartLine> lines}) async {
  final d = J.from(await api('/orders', method: 'POST', body: {
    'customerName': a.customerName,
    'phone': phone,
    'email': a.email,
    'governorate': a.governorate,
    'city': a.city,
    'address': a.address,
    if (a.note != null) 'note': a.note,
    'couponCode': couponCode,
    'paymentMethod': a.paymentMethod,
    'lines': lines.map((l) => l.toJson()).toList(),
  }));
  return d.s('orderNumber');
}

/// How this shop can be paid: id, name, nameAr, kind, note, noteAr, logo, enabled
Future<List<J>> fetchPayments() async {
  final d = await api('/payments');
  return d is List ? d.map(J.from).toList() : <J>[];
}

// ------------------------------------------------------------------ reels --

/// A kept live, as a reel: id, title, hostName, coverUrl, recordingUrl, likes,
/// views, products[] (id, itemId, productName, imageUrl, price, pinned, sortOrder, available)
Future<List<J>> fetchReels() async {
  final d = await api('/reels');
  return d is List ? d.map(J.from).toList() : <J>[];
}

/// She watched it: counted by the shop once per half hour per phone.
Future<void> viewReel(String id) async {
  try {
    await api('/reels/${Uri.encodeComponent(id)}/view', method: 'POST');
  } catch (_) {}
}

/// A like, or taking it back. Returns the new total.
Future<int> likeReel(String id, bool on) async =>
    J.from(await api('/reels/${Uri.encodeComponent(id)}/like', method: on ? 'POST' : 'DELETE')).i('likes');

// ----------------------------------------------------------------- offers --

/// Which screen she is on, for the shop to choose an offer for.
class OfferContext {
  /// "index" | "product" | "collection" | "cart" | "search" | "checkout" | "other"
  final String pageType;
  final String? productKey;
  final String? collectionHandle;
  const OfferContext(this.pageType, {this.productKey, this.collectionHandle});
  Map<String, dynamic> toJson() => {
        'pageType': pageType,
        if (productKey != null) 'productKey': productKey,
        if (collectionHandle != null) 'collectionHandle': collectionHandle,
      };
  @override
  bool operator ==(Object other) =>
      other is OfferContext && other.pageType == pageType && other.productKey == productKey && other.collectionHandle == collectionHandle;
  @override
  int get hashCode => Object.hash(pageType, productKey, collectionHandle);
}

/// An offer to show (OfferConfig): id, dwell, idle, cart, maxPerSession,
/// cooldownHours, skipIfCartEmpty, style, headline, body, button, dismiss,
/// accent, bg, fg, image, code, segments[{label,code,weight}], unique. Null for none.
Future<J?> decideOffer(OfferContext ctx, int cartCount) async {
  final d = J.from(await api('/offers/decide',
      method: 'POST', body: {'channel': 'app', 'visitorId': _visitor, ...ctx.toJson(), 'cartCount': cartCount}));
  return d.has('offer') ? d.o('offer') : null;
}

/// A code made for this shopper, for a campaign that hands out one per person.
Future<String> claimOffer(String id) async =>
    J.from(await api('/offers/claim', method: 'POST', body: {'channel': 'app', 'visitorId': _visitor, 'cid': id})).s('code');

/// What she did with a popup: "shown" | "dismissed" | "claimed". Fire and forget.
void offerEvent(String type, String id, {String? trigger, String? code}) {
  if (_visitor.isEmpty) return;
  api('/offers/event', method: 'POST', body: {
    'channel': 'app',
    'visitorId': _visitor,
    'type': type,
    'cid': id,
    if (trigger != null) 'trigger': trigger,
    if (code != null) 'code': code,
  }).catchError((_) => null);
}

// --------------------------------------------------------------- tracking --

/// What she did, for the shop's customer page. Fire and forget.
void track(String type, [Map<String, dynamic> data = const {}]) {
  if (_visitor.isEmpty) return;
  api('/track', method: 'POST', body: {
    'type': type,
    'channel': 'app',
    'platform': Platform.isIOS ? 'ios' : 'android',
    'visitorId': _visitor,
    ...data,
  }).catchError((_) => null);
}

/// A tap that matters (placing the order, a coupon, signing in).
void tap(String label, [String? target]) => track('click', {'label': label, 'important': true, 'target': target});

String _session = '';
int _sessionAt = 0;
({String id, int shownMs, int? since})? _screen;
final Random _rand = Random();
String _rid() => List.generate(10, (_) => 'abcdefghijklmnopqrstuvwxyz0123456789'[_rand.nextInt(36)]).join();

void _collect(Map<String, dynamic> body) {
  _client
      .post(Uri.parse('$siteOrigin/api/analytics/collect'), headers: {'content-type': 'application/json'}, body: jsonEncode(body))
      .catchError((_) => http.Response('', 500));
}

void _leaveScreen() {
  final s = _screen;
  if (s == null) return;
  final ms = s.shownMs + (s.since != null ? DateTime.now().millisecondsSinceEpoch - s.since! : 0);
  _collect({'kind': 'leave', 'pageviewId': s.id, 'seconds': (ms / 1000).round(), 'scroll': 0});
}

/// Visits, for the shop's Analytics page.
void screenView(String path, [String? title]) {
  if (_visitor.isEmpty) return;
  _leaveScreen();
  final now = DateTime.now().millisecondsSinceEpoch;
  if (_session.isEmpty || now - _sessionAt > 30 * 60 * 1000) _session = 's-${_rid()}${now.toRadixString(36)}';
  _sessionAt = now;
  final id = 'p-${_rid()}${now.toRadixString(36)}';
  _screen = (id: id, shownMs: 0, since: now);
  _collect({
    'kind': 'pageview',
    'channel': 'app',
    'platform': Platform.isIOS ? 'ios' : 'android',
    'path': path,
    'title': title ?? path,
    'visitorId': _visitor,
    'sessionId': _session,
    'pageviewId': id,
    'appVersion': '',
  });
}

/// The app put away: the screen's time stops (and is reported); brought back, it starts again.
class AnalyticsLifecycle with WidgetsBindingObserver {
  static void install() => WidgetsBinding.instance.addObserver(AnalyticsLifecycle());
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final s = _screen;
    if (s == null) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (state == AppLifecycleState.resumed) {
      _screen = (id: s.id, shownMs: s.shownMs, since: now);
    } else if (s.since != null) {
      _screen = (id: s.id, shownMs: s.shownMs + now - s.since!, since: null);
      _leaveScreen();
    }
  }
}

Timer? _cartTimer;
String? _cartSent;

/// The basket as it stands, once it has stopped changing for a moment.
void trackCart(List<Map<String, dynamic>> lines) {
  final sig = jsonEncode(lines.map((l) => [l['itemId'], l['quantity']]).toList());
  if (_visitor.isEmpty || sig == _cartSent || (_cartSent == null && lines.isEmpty)) return;
  _cartTimer?.cancel();
  _cartTimer = Timer(const Duration(milliseconds: 1500), () {
    _cartSent = sig;
    api('/track', method: 'POST', body: {
      'channel': 'app',
      'platform': Platform.isIOS ? 'ios' : 'android',
      'visitorId': _visitor,
      'cart': lines,
    }).catchError((_) => null);
  });
}

// --------------------------------------------------------- recommendations --

/// What goes with the signed-in shopper's past orders.
class Recommendations {
  /// "pairs" | "fallback" | "none"
  final String mode;
  final String? basedOn;
  final List<ProductCard> products;
  Recommendations(this.mode, this.basedOn, this.products);
}

Future<Recommendations> fetchRecommendations() async {
  final d = J.from(await api('/recommendations'));
  return Recommendations(d.s('mode', 'none'), d['basedOn']?.toString(), ProductCard.list(d['products']));
}

// ---------------------------------------------------------------- rewards --

/// A gift, as the basket needs it.
class Gift {
  final String id;
  final String title;
  final String code;
  final String detail;
  final double cost;
  final bool ready;
  Gift({required this.id, required this.title, required this.code, required this.detail, required this.cost, required this.ready});
}

/// enrolled, user{signatureBalance}, availableRewards[], myRewards[]
Future<J> fetchLoyalty() async => J.from(await api('/loyalty'));

/// Answers { balance, userReward: { code } | null }
Future<J> redeemReward(String rewardId) async => J.from(await api('/loyalty/redeem', method: 'POST', body: {'rewardId': rewardId}));

final NumberFormat _int = NumberFormat('#,##0', 'en_US');
String _money(double n) => 'EGP ${_int.format(n.round())}';

String _giftDetail(String? kind, double? value, double? minOrder) {
  final over = minOrder != null && minOrder != 0 ? ' on orders over ${_money(minOrder)}' : '';
  if (kind == 'free_shipping') return 'Free delivery$over';
  if (kind == 'percent' && value != null && value != 0) return '${_plain(value)}% off$over';
  if (kind == 'amount' && value != null && value != 0) return '${_money(value)} off$over';
  return 'A gift';
}

bool _spendable(String? k) => k == 'percent' || k == 'amount' || k == 'free_shipping';

/// What she is closest to, when nothing is spendable yet.
({double short, String title, double balance})? nextGift(J? l, [double shipping = 0]) {
  if (l == null || !l.b('enrolled')) return null;
  final balance = l.o('user').n('signatureBalance');
  final list = l
      .l('availableRewards')
      .where((r) => _spendable(r['discountKind']?.toString()))
      .where((r) => shipping > 0 || r.s('discountKind') != 'free_shipping')
      .where((r) => r.s('status') != 'locked')
      .where((r) => r.n('signatureCost') > balance)
      .toList()
    ..sort((a, b) => a.n('signatureCost').compareTo(b.n('signatureCost')));
  if (list.isEmpty) return null;
  final c = list.first;
  return (short: c.n('signatureCost') - balance, title: c.s('titleEn'), balance: balance);
}

/// The rewards worth offering in a basket, already redeemed ones first.
List<Gift> giftsFrom(J? l, [double shipping = 0]) {
  if (l == null || !l.b('enrolled')) return [];
  final now = DateTime.now().millisecondsSinceEpoch;
  double at(String? v) => v == null || v.isEmpty ? double.infinity : (DateTime.tryParse(v)?.millisecondsSinceEpoch.toDouble() ?? double.infinity);
  final held = l
      .l('myRewards')
      .where((r) => r.s('code').isNotEmpty && (r.s('status') == 'available' || r.s('status') == 'claimed'))
      .where((r) => shipping > 0 || r.s('type') != 'delivery')
      .where((r) => !r.has('expiresAt') || at(r.s('expiresAt')) > now)
      .toList()
    ..sort((a, b) => at(a['expiresAt']?.toString()).compareTo(at(b['expiresAt']?.toString())));

  final seen = <String>[];
  final mine = <Gift>[];
  for (final r in held) {
    if (seen.contains(r.s('rewardId'))) continue;
    seen.add(r.s('rewardId'));
    mine.add(Gift(id: r.s('id'), title: r.s('title'), code: r.s('code'), detail: 'Ready to use', cost: 0, ready: true));
  }

  final balance = l.o('user').n('signatureBalance');
  final affordable = l
      .l('availableRewards')
      .where((r) => r.s('status') == 'affordable' || r.s('status') == 'available')
      .where((r) => _spendable(r['discountKind']?.toString()))
      .where((r) => shipping > 0 || r.s('discountKind') != 'free_shipping')
      .where((r) => r.n('signatureCost') <= balance)
      .where((r) => !seen.contains(r.s('id')))
      .toList()
    ..sort((a, b) => a.n('signatureCost').compareTo(b.n('signatureCost')));

  return [
    ...mine,
    ...affordable.map((r) => Gift(
          id: r.s('id'),
          title: r.s('titleEn'),
          code: '',
          detail: _giftDetail(r['discountKind']?.toString(), r.nOrNull('discountValue'), r.nOrNull('minOrderValue')),
          cost: r.n('signatureCost'),
          ready: false,
        )),
  ].take(6).toList();
}
