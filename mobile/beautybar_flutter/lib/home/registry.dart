/// Which widget draws which kind of section. A kind this build does not know is left out, not a crash.
library;

import 'package:flutter/widgets.dart';
import 'section.dart';
import 'sections/hero.dart';
import 'sections/promo_bar.dart';
import 'sections/collection_tabs.dart';
import 'sections/cards.dart';
import 'sections/tiers.dart';
import 'sections/split.dart';
import 'sections/trust_badges.dart';
import 'sections/banner.dart';
import 'sections/collection_row.dart';
import 'sections/collection_grid.dart';
import 'sections/new_arrivals.dart';
import 'sections/categories.dart';
import 'sections/live_now.dart';
import 'sections/coming_up_live.dart';
import 'sections/countdown_deals.dart';
import 'sections/info_rows.dart';
import 'sections/sale_seal.dart';
import 'sections/free_shipping.dart';
import 'sections/shipping_goal.dart';
import 'sections/payment_plans.dart';
import 'sections/price_slider.dart';
import 'sections/offer_cards.dart';
import 'sections/product_reasons.dart';
import 'sections/moments.dart';
import 'sections/circle_row.dart';
import 'sections/pick_colour.dart';
import 'sections/price_drop.dart';
import 'sections/style_profile.dart';
import 'sections/brand_wall.dart';
import 'sections/pay_strip.dart';
import 'sections/bundle_save.dart';
import 'sections/review_summary.dart';
import 'sections/brand_timeline.dart';
import 'sections/complete_look.dart';
import 'sections/promo_card.dart';
import 'sections/showcase.dart';
import 'sections/reviews.dart';
import 'sections/text.dart';

typedef SectionBuilder = Widget? Function(SectionCtx c);

/// Each builder returns a Widget, or null when it has nothing to draw.
final Map<String, SectionBuilder> sectionBuilders = {
  'hero': heroSection,
  'promo_bar': promoBarSection,
  'collection_tabs': collectionTabsSection,
  'cards': cardsSection,
  'tiers': tiersSection,
  'split': splitSection,
  'trust_badges': trustBadgesSection,
  'banner': bannerSection,
  'collection_row': collectionRowSection,
  'collection_grid': collectionGridSection,
  'new_arrivals': newArrivalsSection,
  'categories': categoriesSection,
  'live_now': liveNowSection,
  'coming_up_live': comingUpLiveSection,
  'countdown_deals': countdownDealsSection,
  'info_rows': infoRowsSection,
  'sale_seal': saleSealSection,
  'free_shipping': freeShippingSection,
  'shipping_goal': shippingGoalSection,
  'payment_plans': paymentPlansSection,
  'price_slider': priceSliderSection,
  'offer_cards': offerCardsSection,
  'product_reasons': productReasonsSection,
  'moments': momentsSection,
  'circle_row': circleRowSection,
  'pick_colour': pickColourSection,
  'price_drop': priceDropSection,
  'style_profile': styleProfileSection,
  'brand_wall': brandWallSection,
  'pay_strip': payStripSection,
  'bundle_save': bundleSaveSection,
  'review_summary': reviewSummarySection,
  'brand_timeline': brandTimelineSection,
  'complete_look': completeLookSection,
  'promo_card': promoCardSection,
  'showcase': showcaseSection,
  'reviews': reviewsSection,
  'text': textSection,
};
