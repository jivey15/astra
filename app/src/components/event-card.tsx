import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BookmarkIcon, OrbitBroadcastIcon } from '@/components/astra-icons';

export interface EventItem {
  id: string | number;
  venue_name?: string | null;
  title?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  cover_info?: string | null;
  age_limit?: string | null;
  short_summary?: string | null;
  description?: string | null;
  flyer_image_url?: string | null;
  post_url?: string | null;
  ticket_url?: string | null;
  shortcode?: string | null;
  ig_handle?: string | null;
  talent_names?: string[] | null;
  vibe_tags?: string[] | null;
  is_approved?: boolean | null;
  isPast?: boolean;
}

export type EventCardVariant = 'carousel' | 'grid' | 'full';

interface EventCardProps {
  item: EventItem;
  isReminded: boolean;
  onToggleRemind: (id: string | number) => void;
  onSendToOrbit?: (item: EventItem) => void;
  variant?: EventCardVariant;
  cardWidth?: number;
}

function LinearGradient({
  colors,
  style,
  pointerEvents,
  direction = 'to bottom',
  children,
}: {
  colors: [string, string, ...string[]];
  style?: any;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  direction?: string;
  children?: React.ReactNode;
}) {
  const gradientValue = `linear-gradient(${direction}, ${colors.join(', ')})`;
  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        style,
        {
          backgroundImage: gradientValue,
          experimental_backgroundImage: gradientValue,
        },
      ]}>
      {children}
    </View>
  );
}

const IG_HANDLE_BY_VENUE: [RegExp, string][] = [
  [/saloon/i, 'thesaloonmn'],
  [/eagle/i, 'eaglempls'],
  [/lush/i, 'lush.mpls'],
  [/jet\s?set/i, 'jetsetbarmpls'],
  [/black\s?hart/i, 'blackhartstp'],
  [/19\s?bar/i, 'the19bar'],
];

/** Resolves the source Instagram handle (explicit `ig_handle`, else normalized from venue name). */
export function resolveIgHandle(item: EventItem): string {
  const explicit = item.ig_handle?.trim().replace(/^@/, '');
  if (explicit) return explicit;
  const venue = item.venue_name || '';
  for (const [pattern, handle] of IG_HANDLE_BY_VENUE) {
    if (pattern.test(venue)) return handle;
  }
  const slug = venue.toLowerCase().replace(/[^a-z0-9._]/g, '');
  return slug || 'astra_signal';
}

/** Thickened glowing neon cyan L-brackets hugging all 4 outer corners of the card frame. */
function HudCornerBrackets() {
  return (
    <>
      <View pointerEvents="none" style={[styles.bracket, styles.bracketTL]} />
      <View pointerEvents="none" style={[styles.bracket, styles.bracketTR]} />
      <View pointerEvents="none" style={[styles.bracket, styles.bracketBL]} />
      <View pointerEvents="none" style={[styles.bracket, styles.bracketBR]} />
    </>
  );
}

/** Compact Instagram-style gradient camera badge. */
function InstagramBadge() {
  return (
    <LinearGradient
      direction="to bottom right"
      colors={['#F58529', '#DD2A7B', '#8134AF']}
      style={styles.igBadge}>
      <View style={styles.igCameraRing}>
        <View style={styles.igCameraLens} />
      </View>
      <View style={styles.igCameraDot} />
    </LinearGradient>
  );
}

/** Smoked-glass neon rim button surface (dark translucent gradient + glowing cyan border). */
function GlassButton({
  onPress,
  accessibilityLabel,
  selected,
  borderColor,
  glowIntensity,
  compact,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  borderColor: string;
  glowIntensity: number;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.glassButton,
        compact && styles.glassButtonCompact,
        { borderColor, shadowOpacity: glowIntensity },
        pressed && styles.buttonPressed,
      ]}>
      <LinearGradient
        colors={['rgba(14, 42, 82, 0.85)', 'rgba(6, 18, 38, 0.95)']}
        style={[styles.glassButtonInner, compact && styles.glassButtonInnerCompact]}>
        {children}
      </LinearGradient>
    </Pressable>
  );
}

export function formatDatePart(dateStr?: string | null): string {
  let formattedDate = dateStr || 'TBA';
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) {
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const months = [
        'JAN',
        'FEB',
        'MAR',
        'APR',
        'MAY',
        'JUN',
        'JUL',
        'AUG',
        'SEP',
        'OCT',
        'NOV',
        'DEC',
      ];
      formattedDate = `${days[dt.getDay()]}, ${months[dt.getMonth()]} ${dt.getDate()}`;
    }
  }
  return formattedDate;
}

export function formatTimePart(timeStr?: string | null): string {
  if (!timeStr) return 'TBA';
  if (/[AP]M/i.test(timeStr)) return timeStr.trim();

  const rawTime = timeStr.slice(0, 5);
  const parts = rawTime.split(':');
  if (parts.length === 2) {
    const hour24 = parseInt(parts[0], 10);
    const min = parts[1];
    if (!Number.isNaN(hour24)) {
      const suffix = hour24 >= 12 ? 'PM' : 'AM';
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      return `${hour12}:${min} ${suffix}`;
    }
  }
  return rawTime;
}

export function formatEventDate(dateStr?: string | null, timeStr?: string | null): string {
  const formattedDate = formatDatePart(dateStr);
  if (!timeStr) return formattedDate;
  return `${formattedDate} • ${formatTimePart(timeStr)}`;
}

export function formatCompactDate(dateStr?: string | null, timeStr?: string | null): string {
  let shortDate = dateStr || 'TBA';
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) {
      const months = [
        'JAN',
        'FEB',
        'MAR',
        'APR',
        'MAY',
        'JUN',
        'JUL',
        'AUG',
        'SEP',
        'OCT',
        'NOV',
        'DEC',
      ];
      shortDate = `${months[dt.getMonth()]} ${dt.getDate()}`;
    }
  }
  if (!timeStr) return shortDate;
  const rawTime = timeStr.slice(0, 5);
  const parts = rawTime.split(':');
  if (parts.length === 2) {
    const hour24 = parseInt(parts[0], 10);
    if (!Number.isNaN(hour24)) {
      const suffix = hour24 >= 12 ? 'PM' : 'AM';
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      return `${shortDate} • ${hour12}${suffix}`;
    }
  }
  return shortDate;
}

export function EventCard({
  item,
  isReminded,
  onToggleRemind,
  onSendToOrbit,
  variant = 'grid',
  cardWidth,
}: EventCardProps) {
  const [imageError, setImageError] = useState(false);
  const [fullFlyerVisible, setFullFlyerVisible] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(4 / 5);
  const remindScale = useRef(new Animated.Value(1)).current;
  const orbitScale = useRef(new Animated.Value(1)).current;

  const isCompact = variant === 'carousel' || variant === 'grid';
  const isFeaturedCarousel = variant === 'carousel';

  const hasValidFlyer =
    Boolean(item.flyer_image_url && item.flyer_image_url.startsWith('http')) && !imageError;

  useEffect(() => {
    if (!hasValidFlyer || !item.flyer_image_url) return;
    let isMounted = true;
    Image.getSize(
      item.flyer_image_url,
      (width, height) => {
        if (isMounted && width > 0 && height > 0) {
          setImageAspectRatio(width / height);
        }
      },
      () => {
        // Fallback aspect ratio preserved if size lookup fails
      }
    );
    return () => {
      isMounted = false;
    };
  }, [hasValidFlyer, item.flyer_image_url]);

  const formattedDateTime = formatEventDate(item.event_date, item.start_time);
  const compactDateTime = formatCompactDate(item.event_date, item.start_time);
  const igHandle = resolveIgHandle(item);
  const venueDisplay = (item.venue_name || 'Minneapolis Venue').toUpperCase();
  const titleDisplay = item.title || 'Untitled Cosmic Signal';
  const rawTags = item.vibe_tags && item.vibe_tags.length > 0 ? item.vibe_tags : ['DJs'];
  const tags = Array.from(
    new Set(
      rawTags.map((t) => {
        const lower = String(t).trim().toLowerCase();
        if (lower === 'circuit/dj' || lower === 'dj' || lower === 'dance') return 'DJs';
        return t;
      })
    )
  );

  const resolvedSourceUrl =
    item.ticket_url ||
    item.post_url ||
    (item.shortcode ? `https://www.instagram.com/p/${item.shortcode}/` : null);

  const handleOpenSourceUrl = async () => {
    if (!resolvedSourceUrl) return;
    try {
      await Linking.openURL(resolvedSourceUrl);
    } catch {
      // Handled gracefully if URL cannot be opened
    }
  };

  const handleRemindPress = () => {
    Animated.sequence([
      Animated.timing(remindScale, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(remindScale, {
        toValue: 1,
        friction: 4,
        tension: 130,
        useNativeDriver: true,
      }),
    ]).start();

    onToggleRemind(item.id);
  };

  const handleOrbitPress = async () => {
    Animated.sequence([
      Animated.timing(orbitScale, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(orbitScale, {
        toValue: 1,
        friction: 4,
        tension: 130,
        useNativeDriver: true,
      }),
    ]).start();

    onSendToOrbit?.(item);

    const title = item.title || titleDisplay;
    const venue_name = item.venue_name || 'Minneapolis';
    const formatted_date = formatDatePart(item.event_date);
    const start_time = formatTimePart(item.start_time);
    const post_url = resolvedSourceUrl || '';

    const shareMessage = post_url
      ? `Tracked via Astra ⚡ ${title} @ ${venue_name} (${formatted_date} • ${start_time})\n${post_url}`
      : `Tracked via Astra ⚡ ${title} @ ${venue_name} (${formatted_date} • ${start_time})`;

    try {
      await Share.share({
        title,
        message: shareMessage,
        url: post_url || undefined,
      });
    } catch {
      // Handled gracefully by toast notification
    }
  };

  const renderRemindContent = (compact: boolean) => (
    <>
      <View
        style={
          isReminded ? ({ filter: 'drop-shadow(0px 0px 4px #00F0FF)' } as any) : undefined
        }>
        <BookmarkIcon
          size={compact ? 13 : 15}
          color={isReminded ? '#00F0FF' : '#7DD3FC'}
          active={isReminded}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.remindButtonText,
          compact && styles.buttonTextCompact,
          isReminded && styles.remindButtonTextActive,
        ]}>
        {compact
          ? isReminded
            ? 'Saved'
            : 'Remind'
          : isReminded
          ? 'Remind me ✓'
          : 'Remind me'}
      </Text>
      {isReminded ? (
        <>
          <View style={styles.remindDivider} />
          <Pressable
            onPress={() => setFullFlyerVisible(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Open details for ${titleDisplay}`}>
            <Text style={styles.remindChevron}>›</Text>
          </Pressable>
        </>
      ) : null}
    </>
  );

  return (
    <View style={[styles.cardRoot, cardWidth ? { width: cardWidth } : undefined]}>
      <View
        style={[
          styles.card,
          isCompact && styles.cardCompact,
          isFeaturedCarousel && styles.cardFeaturedCarousel,
          isReminded && styles.cardReminded,
        ]}>
        {/* Thickened glowing neon cyan L-brackets hugging all 4 outer corners */}
        <HudCornerBrackets />

      <View style={[styles.cardInner, isCompact && styles.cardInnerCompact]}>
        {/* 36px GLASSMORPHIC IG HEADER BAR */}
        <View style={styles.hudHeaderBar}>
          <View style={styles.hudHeaderLeft}>
            <InstagramBadge />
            <Text style={styles.hudHandleText} numberOfLines={1}>
              @{igHandle}
            </Text>
          </View>
          <Pressable
            onPress={() => setFullFlyerVisible(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Open details for ${titleDisplay}`}
            style={styles.hudKebabButton}>
            <Text style={styles.hudKebabText}>⋮</Text>
          </Pressable>        </View>

        {/* EDGE-TO-EDGE FLYER HERO WITH CLEAN HUD OVERLAY */}
        <Pressable
          onPress={() => setFullFlyerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Open full flyer and details for ${titleDisplay}`}
          style={[
            styles.heroContainer,
            variant === 'carousel' && styles.heroCarousel,
            variant === 'grid' && styles.heroGrid,
          ]}>
          {hasValidFlyer ? (
            <Image
              source={{ uri: item.flyer_image_url! }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.fallbackHero}>
              <View style={styles.fallbackOrb} />
              <Text style={styles.fallbackStar}>✦</Text>
              <Text style={styles.fallbackLabel}>ASTRA SIGNAL</Text>
            </View>
          )}

          {/* Clean Bottom LinearGradient Scrim (Behind Text, Above Image, No Middle Stop Line) */}
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(15, 23, 42, 0.95)']}
            style={styles.bottomGradientOverlay}
          />

          {/* Top HUD Venue Pill (full variant only; compact cards show the IG handle in the header bar) */}
          {!isCompact ? (
            <View style={styles.topOverlayRow}>
              <View style={styles.venuePill}>
                <View style={styles.venueDot} />
                <Text style={styles.venuePillText} numberOfLines={1}>
                  {venueDisplay}
                </Text>
              </View>

              <View style={styles.datePill}>
                <Text style={styles.datePillText}>{formattedDateTime}</Text>
              </View>
            </View>
          ) : null}

          {/* Bottom Text & Tag Pills Layer (Above Gradient) */}
          <View style={[styles.bottomOverlayWrapper, isCompact && styles.bottomOverlayWrapperCompact]}>
            {/* Vibe Tags in Overlay */}
            <View style={styles.tagRow}>
              {(isCompact ? tags.slice(0, 1) : tags).map((tag, idx) => (
                <View
                  key={`${tag}-${idx}`}
                  style={[styles.vibeTag, isCompact && styles.vibeTagCompact]}>
                  <Text
                    style={[styles.vibeTagText, isCompact && styles.vibeTagTextCompact]}
                    numberOfLines={1}>
                    {tag}
                  </Text>
                </View>
              ))}
              {isCompact && tags.length > 1 ? (
                <View style={styles.extraTagPill}>
                  <Text style={styles.extraTagText}>+{tags.length - 1}</Text>
                </View>
              ) : null}
            </View>

            {/* Event Title in Overlay */}
            <Text
              style={[styles.overlayTitle, isCompact && styles.overlayTitleCompact]}
              numberOfLines={2}>
              {titleDisplay}
            </Text>

            {/* Date & Time Row */}
            <Text
              style={[styles.overlayDateSub, isCompact && styles.overlayDateSubCompact]}
              numberOfLines={1}>
              {isCompact ? compactDateTime : `${venueDisplay} • ${formattedDateTime}`}
            </Text>
          </View>
        </Pressable>

        {/* CARD BODY: COMPACT OR FULL DETAILS + INTERACTIVE ACTION BUTTONS */}
        <View style={[styles.cardBody, isCompact && styles.cardBodyCompact]}>
          {!isCompact && item.short_summary ? (
            <Text style={styles.summaryText} numberOfLines={3}>
              {item.short_summary}
            </Text>
          ) : null}

          {!isCompact &&
          ((item.talent_names && item.talent_names.length > 0) ||
            item.age_limit ||
            (item.cover_info && item.cover_info !== 'Check flyer')) ? (
            <View style={styles.detailsRow}>
              {item.talent_names && item.talent_names.length > 0 ? (
                <View style={styles.talentBadge}>
                  <Text style={styles.talentText} numberOfLines={1}>
                    🎧 Featuring: {item.talent_names.join(', ')}
                  </Text>
                </View>
              ) : null}

              {item.age_limit ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{item.age_limit}</Text>
                </View>
              ) : null}

              {item.cover_info && item.cover_info !== 'Check flyer' ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{item.cover_info}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Interactive Action Buttons: 'Remind me' & 'Send to orbit' (smoked-glass neon rim) */}
          <View style={[styles.actionRow, isCompact && styles.actionRowCompact]}>
            <Animated.View style={[styles.actionButtonFlex, { transform: [{ scale: remindScale }] }]}>
              <GlassButton
                onPress={handleRemindPress}
                selected={isReminded}
                accessibilityLabel={`Remind me about ${titleDisplay}`}
                borderColor="#00F0FF"
                glowIntensity={isReminded ? 0.9 : 0.35}
                compact={isCompact}>
                {renderRemindContent(isCompact)}
              </GlassButton>
            </Animated.View>

            <Animated.View style={[styles.actionButtonFlex, { transform: [{ scale: orbitScale }] }]}>
              <GlassButton
                onPress={handleOrbitPress}
                accessibilityLabel={`Send ${titleDisplay} to orbit`}
                borderColor="rgba(0, 240, 255, 0.45)"
                glowIntensity={0.18}
                compact={isCompact}>
                <OrbitBroadcastIcon size={isCompact ? 13 : 15} color="#7DD3FC" />
                <Text
                  numberOfLines={1}
                  style={[styles.orbitButtonText, isCompact && styles.buttonTextCompact]}>
                  {isCompact ? 'Orbit' : 'Send to orbit'}
                </Text>
              </GlassButton>
            </Animated.View>
          </View>
        </View>
      </View>
      </View>

      {/* Source footer pill, directly beneath the card frame */}
      <View style={styles.sourcePillRow}>
        <View style={styles.sourcePill}>
          <Text style={styles.sourcePillText} numberOfLines={1}>
            🏷️ Gathered from IG @{igHandle}
          </Text>
        </View>
      </View>

      {/* FULL-FLYER & FULL-DESCRIPTION HUD LIGHTBOX MODAL */}
      <Modal
        visible={fullFlyerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullFlyerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalHudContainer}>
            {/* Modal Top Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalVenue}>{venueDisplay}</Text>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {titleDisplay}
                </Text>
                <Text style={styles.modalDate}>{formattedDateTime}</Text>
              </View>
              <Pressable
                onPress={() => setFullFlyerVisible(false)}
                style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕ CLOSE</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}>
              {/* Full Uncropped Flyer */}
              {hasValidFlyer ? (
                <View style={styles.modalImageFrame}>
                  <Image
                    source={{ uri: item.flyer_image_url! }}
                    style={[styles.modalFullImage, { aspectRatio: imageAspectRatio }]}
                    resizeMode="contain"
                    onLoad={(e) => {
                      const src = e.nativeEvent?.source;
                      if (src?.width && src?.height) {
                        setImageAspectRatio(src.width / src.height);
                      }
                    }}
                  />
                </View>
              ) : null}

              {/* Vibe Tags */}
              <View style={styles.modalTagRow}>
                {tags.map((tag, idx) => (
                  <View key={`modal-tag-${idx}`} style={styles.vibeTag}>
                    <Text style={styles.vibeTagText}>{tag}</Text>
                  </View>
                ))}
                {item.age_limit ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{item.age_limit}</Text>
                  </View>
                ) : null}
                {item.cover_info && item.cover_info !== 'Check flyer' ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{item.cover_info}</Text>
                  </View>
                ) : null}
              </View>

              {/* Full Description */}
              {item.short_summary ? (
                <Text style={styles.modalDescription}>{item.short_summary}</Text>
              ) : (
                <Text style={styles.modalDescription}>
                  Live Minneapolis event signal transmitted from {item.venue_name || 'Loring Orbit'}.
                </Text>
              )}

              {/* Talent / Performers Lineup */}
              {item.talent_names && item.talent_names.length > 0 ? (
                <View style={styles.talentBadge}>
                  <Text style={styles.talentText}>
                    🎧 Featuring: {item.talent_names.join(', ')}
                  </Text>
                </View>
              ) : null}

              {/* Sleek Source / Ticket Link Button */}
              {resolvedSourceUrl ? (
                <Pressable
                  onPress={handleOpenSourceUrl}
                  accessibilityRole="link"
                  accessibilityLabel="View Source or Tickets"
                  style={({ pressed }) => [
                    styles.sourceLinkButton,
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text style={styles.sourceLinkButtonText}>View Source / Tickets ↗</Text>
                </Pressable>
              ) : null}
            </ScrollView>

            {/* Modal Interactive Action Buttons */}
            <View style={styles.modalActions}>
              <View style={styles.actionButtonFlex}>
                <GlassButton
                  onPress={handleRemindPress}
                  selected={isReminded}
                  accessibilityLabel={`Remind me about ${titleDisplay}`}
                  borderColor="#00F0FF"
                  glowIntensity={isReminded ? 0.9 : 0.35}>
                  {renderRemindContent(false)}
                </GlassButton>
              </View>

              <View style={styles.actionButtonFlex}>
                <GlassButton
                  onPress={handleOrbitPress}
                  accessibilityLabel={`Send ${titleDisplay} to orbit`}
                  borderColor="rgba(0, 240, 255, 0.45)"
                  glowIntensity={0.18}>
                  <OrbitBroadcastIcon size={16} color="#7DD3FC" />
                  <Text style={styles.orbitButtonText}>Send to orbit</Text>
                </GlassButton>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardRoot: {
    marginVertical: 8,
  },
  card: {
    position: 'relative',
    backgroundColor: 'rgba(8, 18, 38, 0.88)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.32)',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  cardCompact: {
    borderRadius: 16,
  },
  cardFeaturedCarousel: {
    borderColor: 'rgba(0, 240, 255, 0.5)',
    shadowOpacity: 0.36,
  },
  cardReminded: {
    borderColor: 'rgba(0, 240, 255, 0.6)',
    shadowOpacity: 0.45,
  },
  cardInner: {
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 18, 38, 0.88)',
  },
  cardInnerCompact: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  bracket: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: '#00F0FF',
    zIndex: 6,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 6,
  },
  bracketTL: {
    top: -1.5,
    left: -1.5,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 8,
  },
  bracketTR: {
    top: -1.5,
    right: -1.5,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 8,
  },
  bracketBL: {
    bottom: -1.5,
    left: -1.5,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 8,
  },
  bracketBR: {
    bottom: -1.5,
    right: -1.5,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 8,
  },
  hudHeaderBar: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(14, 42, 82, 0.55)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 240, 255, 0.18)',
  },
  hudHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  hudHandleText: {
    flexShrink: 1,
    color: '#CFFAFE',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hudKebabButton: {
    width: 22,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudKebabText: {
    color: 'rgba(125, 211, 252, 0.85)',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  igBadge: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igCameraRing: {
    width: 11,
    height: 11,
    borderRadius: 3.5,
    borderWidth: 1.4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  igCameraLens: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
  },
  igCameraDot: {
    position: 'absolute',
    top: 4,
    right: 4.5,
    width: 1.8,
    height: 1.8,
    borderRadius: 0.9,
    backgroundColor: '#FFFFFF',
  },
  sourcePillRow: {
    alignItems: 'flex-start',
    marginTop: 7,
    paddingLeft: 6,
  },
  sourcePill: {
    maxWidth: '100%',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 42, 82, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.16)',
  },
  sourcePillText: {
    color: 'rgba(147, 197, 253, 0.9)',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  glassButton: {
    borderRadius: 10,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 3,
  },
  glassButtonCompact: {
    borderRadius: 8,
  },
  glassButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  glassButtonInnerCompact: {
    paddingVertical: 7,
    paddingHorizontal: 5,
    gap: 4,
  },
  remindDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 1,
    backgroundColor: 'rgba(0, 240, 255, 0.45)',
  },
  remindChevron: {
    color: '#00F0FF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 17,
  },
  heroContainer: {
    position: 'relative',
    width: '100%',
    height: 381,
    backgroundColor: '#050B18',
    overflow: 'hidden',
  },
  heroCarousel: {
    height: 267,
  },
  heroGrid: {
    height: 245,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  fallbackHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050B18',
  },
  fallbackOrb: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
  },
  fallbackStar: {
    fontSize: 30,
    color: '#38BDF8',
    marginBottom: 4,
  },
  fallbackLabel: {
    fontSize: 10,
    color: '#93C5FD',
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  bottomGradientOverlay: {
    position: 'absolute',
    height: '58%',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  topOverlayRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  topOverlayRowCompact: {
    top: 8,
    left: 8,
    right: 8,
  },
  venuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(5, 11, 24, 0.86)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#38BDF8',
    maxWidth: '94%',
  },
  venuePillCompact: {
    paddingHorizontal: 7.5,
    paddingVertical: 3.5,
  },
  venueDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38BDF8',
  },
  venuePillText: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  venuePillTextCompact: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  datePill: {
    backgroundColor: 'rgba(5, 11, 24, 0.86)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  datePillText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
  },
  bottomOverlayWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 24,
    paddingHorizontal: 14,
    paddingBottom: 12,
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  bottomOverlayWrapperCompact: {
    paddingTop: 18,
    paddingHorizontal: 10,
    paddingBottom: 9,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  vibeTag: {
    backgroundColor: 'rgba(14, 42, 82, 0.85)',
    paddingHorizontal: 8.5,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.6)',
  },
  vibeTagCompact: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  vibeTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  vibeTagTextCompact: {
    fontSize: 9,
  },
  extraTagPill: {
    backgroundColor: 'rgba(14, 30, 56, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  extraTagText: {
    color: '#7DD3FC',
    fontSize: 8.5,
    fontWeight: '800',
  },
  overlayTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 23,
    marginBottom: 3,
  },
  overlayTitleCompact: {
    fontSize: 13.5,
    lineHeight: 17,
    marginBottom: 2,
  },
  overlayDateSub: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  overlayDateSubCompact: {
    fontSize: 10,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  cardBodyCompact: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  summaryText: {
    color: '#93C5FD',
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  talentBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    maxWidth: '100%',
  },
  talentText: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
  },
  metaChip: {
    backgroundColor: 'rgba(10, 21, 40, 0.9)',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  metaChipText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionRowCompact: {
    gap: 5,
  },
  actionButtonFlex: {
    flex: 1,
  },
  remindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  remindButtonActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.28)',
    borderColor: '#7DD3FC',
  },
  remindButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
  remindButtonTextActive: {
    color: '#CFFAFE',
  },
  orbitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 21, 40, 0.85)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  orbitButtonText: {
    color: '#93C5FD',
    fontWeight: '700',
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
  buttonCompact: {
    paddingVertical: 7,
    paddingHorizontal: 5,
    borderRadius: 8,
    gap: 4,
  },
  buttonTextCompact: {
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 24, 0.92)',
    padding: 16,
    justifyContent: 'center',
  },
  modalHudContainer: {
    maxHeight: '90%',
    backgroundColor: 'rgba(14, 30, 56, 0.96)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    padding: 16,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(29, 78, 216, 0.6)',
    paddingBottom: 10,
  },
  modalVenue: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  modalDate: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 12,
    gap: 12,
  },
  modalImageFrame: {
    width: '100%',
    backgroundColor: '#050B18',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    overflow: 'hidden',
  },
  modalFullImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 4 / 5,
  },
  modalTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalDescription: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  sourceLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginTop: 2,
  },
  sourceLinkButtonText: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(29, 78, 216, 0.6)',
  },
});
