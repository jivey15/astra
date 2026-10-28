import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
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
  children,
}: {
  colors: [string, string, ...string[]];
  style?: any;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  children?: React.ReactNode;
}) {
  const gradientValue = `linear-gradient(to bottom, ${colors.join(', ')})`;
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
  const venueDisplay = (item.venue_name || 'Minneapolis Venue').toUpperCase();
  const titleDisplay = item.title || 'Untitled Cosmic Signal';
  const tags = item.vibe_tags && item.vibe_tags.length > 0 ? item.vibe_tags : ['Nightlife'];

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
    const formatted_time = formatTimePart(item.start_time);
    const description = item.description || item.short_summary || '';

    const shareMessage = `🏈 ${title} @ ${venue_name}
${formatted_date} • ${formatted_time}

${description}

✨ Tracked via Astra`;

    try {
      await Share.share({
        title,
        message: shareMessage,
        url: item.post_url || undefined,
      });
    } catch {
      // Handled gracefully by toast notification
    }
  };

  return (
    <View
      style={[
        styles.card,
        isCompact && styles.cardCompact,
        isFeaturedCarousel && styles.cardFeaturedCarousel,
        isReminded && styles.cardReminded,
        cardWidth ? { width: cardWidth } : undefined,
      ]}>
      <View style={[styles.cardInner, isCompact && styles.cardInnerCompact]}>
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

          {/* Top HUD Venue Pill */}
          <View style={[styles.topOverlayRow, isCompact && styles.topOverlayRowCompact]}>
            <View style={[styles.venuePill, isCompact && styles.venuePillCompact]}>
              <View style={styles.venueDot} />
              <Text
                style={[styles.venuePillText, isCompact && styles.venuePillTextCompact]}
                numberOfLines={1}>
                {venueDisplay}
              </Text>
            </View>

            {!isCompact ? (
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>{formattedDateTime}</Text>
              </View>
            ) : null}
          </View>

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

          {/* Interactive Action Buttons: 'Remind me' & 'Send to orbit' */}
          <View style={[styles.actionRow, isCompact && styles.actionRowCompact]}>
            <Animated.View style={[styles.actionButtonFlex, { transform: [{ scale: remindScale }] }]}>
              <Pressable
                onPress={handleRemindPress}
                accessibilityRole="button"
                accessibilityState={{ selected: isReminded }}
                accessibilityLabel={`Remind me about ${titleDisplay}`}
                style={({ pressed }) => [
                  styles.remindButton,
                  isCompact && styles.buttonCompact,
                  isReminded && styles.remindButtonActive,
                  pressed && styles.buttonPressed,
                ]}>
                <BookmarkIcon
                  size={isCompact ? 13 : 15}
                  color="#FFFFFF"
                  active={isReminded}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.remindButtonText,
                    isCompact && styles.buttonTextCompact,
                    isReminded && styles.remindButtonTextActive,
                  ]}>
                  {isCompact
                    ? isReminded
                      ? 'Saved'
                      : 'Remind'
                    : isReminded
                    ? 'Remind me ✓'
                    : 'Remind me'}
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View style={[styles.actionButtonFlex, { transform: [{ scale: orbitScale }] }]}>
              <Pressable
                onPress={handleOrbitPress}
                accessibilityRole="button"
                accessibilityLabel={`Send ${titleDisplay} to orbit`}
                style={({ pressed }) => [
                  styles.orbitButton,
                  isCompact && styles.buttonCompact,
                  pressed && styles.buttonPressed,
                ]}>
                <OrbitBroadcastIcon size={isCompact ? 13 : 15} color="#7DD3FC" />
                <Text
                  numberOfLines={1}
                  style={[styles.orbitButtonText, isCompact && styles.buttonTextCompact]}>
                  {isCompact ? 'Orbit' : 'Send to orbit'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
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
            </ScrollView>

            {/* Modal Interactive Action Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={handleRemindPress}
                style={[styles.remindButton, styles.actionButtonFlex, isReminded && styles.remindButtonActive]}>
                <BookmarkIcon size={16} color="#FFFFFF" active={isReminded} />
                <Text style={styles.remindButtonText}>
                  {isReminded ? 'Remind me ✓' : 'Remind me'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleOrbitPress}
                style={[styles.orbitButton, styles.actionButtonFlex]}>
                <OrbitBroadcastIcon size={16} color="#7DD3FC" />
                <Text style={styles.orbitButtonText}>Send to orbit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderRadius: 18,
    marginVertical: 11,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  cardCompact: {
    borderRadius: 16,
    marginVertical: 11,
  },
  cardFeaturedCarousel: {
    borderColor: '#38BDF8',
    borderWidth: 1.25,
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  cardReminded: {
    borderColor: '#38BDF8',
    shadowOpacity: 0.35,
  },
  cardInner: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  cardInnerCompact: {
    borderRadius: 16,
    overflow: 'hidden',
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
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 8.5,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#38BDF8',
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
    color: '#7DD3FC',
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
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(29, 78, 216, 0.6)',
  },
});
