import { createClient } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BookmarkIcon } from '@/components/astra-icons';
import { BottomTabBar } from '@/components/bottom-tab-bar';
import { CosmicAlignmentBanner } from '@/components/cosmic-alignment-banner';
import { CosmicBackdrop } from '@/components/constellation-canvas';
import { ConstellationHeader } from '@/components/constellation-header';
import { ConstellationLoader } from '@/components/constellation-loader';
import { EventCard, formatTimePart } from '@/components/event-card';
import { MapViewPlaceholder } from '@/components/map-view-placeholder';
import { getAstrologicalConstellation, getConstellationForMonth } from '@/constants/constellations';
import {
  cancelEventReminderNotification,
  loadPersistedBookmarks,
  savePersistedBookmarks,
  scheduleEventReminderNotification,
} from '@/utils/bookmarks-and-notifications';

// Connect to your live project-loring database
const SUPABASE_URL = 'https://pvdzgmglfcmdysyorjhf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-zw9isL2SkCT7r9O0fUwYA_SfmPynKp';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Curated Astra v1.0 Category Pillars ('Circuit/DJ' renamed to 'DJs')
export const CATEGORY_PILLARS = [
  'All Signals',
  'DJs',
  'Drag/Show',
  'Watch Party',
  'Leather/Gear',
  'Community',
];

const FlatListCellPassthrough = ({ children }) => <>{children}</>;

export function parseEventDate(dateString) {
  if (!dateString) return null;
  const trimmed = String(dateString).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTodayIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getIsoDatePlusDays(days, baseDate = new Date()) {
  const dt = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  dt.setDate(dt.getDate() + days);
  return getTodayIsoDate(dt);
}

export function isEventExpired(dateString) {
  if (!dateString) return false;
  const trimmed = String(dateString).trim();
  const datePart = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart < getTodayIsoDate();
  }
  const eventDate = parseEventDate(trimmed);
  if (!eventDate) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDate < todayStart;
}

export function eventMatchesCategory(event, category) {
  if (!category || category === 'All' || category === 'All Signals') {
    return true;
  }

  const rawTags = (event.vibe_tags || []).map((t) => String(t).trim().toLowerCase());
  const textBlob = `${event.title || ''} ${event.short_summary || ''} ${event.description || ''}`.toLowerCase();

  switch (category) {
    case 'DJs':
      return (
        rawTags.some((t) =>
          ['djs', 'circuit/dj', 'dj', 'dance', 'circuit', 'club', 'house', 'techno', 'nightlife'].includes(t)
        ) || /\b(dj|djs|dance|circuit|beats|house music)\b/i.test(textBlob)
      );
    case 'Drag/Show':
      return (
        rawTags.some((t) => ['drag/show', 'drag', 'show', 'cabaret', 'burlesque', 'pageant'].includes(t)) ||
        /\b(drag|show|cabaret|revue|performances|queens)\b/i.test(textBlob)
      );
    case 'Watch Party':
      return (
        rawTags.some((t) => ['watch party', 'viewing party', 'sports', 'football'].includes(t)) ||
        /\b(watch party|viewing party|vikings|vikes|football|game day|race)\b/i.test(textBlob)
      );
    case 'Leather/Gear':
      return (
        rawTags.some((t) =>
          ['leather/gear', 'leather', 'gear', 'bear', 'bear night', 'fetish', 'pup', 'kink'].includes(t)
        ) || /\b(leather|gear|bear|den|harness|pup|bootblack|underwear)\b/i.test(textBlob)
      );
    case 'Community':
      return (
        rawTags.some((t) =>
          ['community', 'social', 'trivia', 'bingo', 'karaoke', 'mixer', 'fundraiser', 'sports'].includes(t)
        ) || /\b(community|trivia|bingo|karaoke|fundraiser|benefit|league|stonewall|mixer)\b/i.test(textBlob)
      );
    default:
      return rawTags.includes(category.toLowerCase());
  }
}

export default function App() {
  const { width: screenWidth } = useWindowDimensions();

  const carouselCardWidth = Math.max(152, Math.round(screenWidth * 0.46));
  const gridCardWidth = Math.max(148, Math.floor((screenWidth - 28 - 10) / 2));

  const currentSystemMonth = useMemo(() => new Date().getMonth(), []);
  const [constellationMonth, setConstellationMonth] = useState(currentSystemMonth);

  const [events, setEvents] = useState([]);
  const [allKnownEvents, setAllKnownEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState('All Signals');

  // Interactive Top-Right Telemetry Toggle ('FULL ORBIT' vs 'TONIGHT'S ORBIT')
  const [tonightOnly, setTonightOnly] = useState(false);

  // Persisted 'Remind me' bookmarks
  const [remindedIds, setRemindedIds] = useState([]);
  const [bookmarksHydrated, setBookmarksHydrated] = useState(false);

  // Secondary Navigation Bar state ('feed' | 'map' | 'bookmarks')
  const [activeTab, setActiveTab] = useState('feed');

  // Cosmic feedback toast banner
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    loadPersistedBookmarks().then(({ remindedIds: savedIds, cachedEvents }) => {
      if (!isMounted) return;
      if (savedIds.length > 0) {
        setRemindedIds(savedIds);
      }
      if (Object.keys(cachedEvents).length > 0) {
        setAllKnownEvents((prev) => ({ ...cachedEvents, ...prev }));
      }
      setBookmarksHydrated(true);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!bookmarksHydrated) return;
    const bookmarkedCache = {};
    for (const id of remindedIds) {
      const ev = allKnownEvents[String(id)];
      if (ev) {
        bookmarkedCache[String(id)] = ev;
      }
    }
    savePersistedBookmarks(remindedIds, bookmarkedCache);
  }, [allKnownEvents, bookmarksHydrated, remindedIds]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const fetchEvents = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const fourteenDaysAgoDate = new Date();
      fourteenDaysAgoDate.setDate(fourteenDaysAgoDate.getDate() - 14);
      const fourteenDaysAgo = fourteenDaysAgoDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_approved', true)
        .gte('event_date', fourteenDaysAgo)
        .order('event_date', { ascending: true });

      if (error) throw error;
      const fetched = (data || []).filter((item) => item.is_approved === true);
      setEvents(fetched);

      setAllKnownEvents((prev) => {
        const next = { ...prev };
        for (const item of fetched) {
          next[String(item.id)] = item;
        }
        return next;
      });
    } catch (error) {
      console.error('Error fetching events:', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(false);
  }, [fetchEvents]);

  const handleToggleRemind = useCallback(
    (eventId) => {
      const targetEvent =
        allKnownEvents[String(eventId)] || events.find((e) => e.id === eventId);

      setRemindedIds((prev) => {
        const exists = prev.includes(eventId);
        if (exists) {
          cancelEventReminderNotification(eventId);
          showToast('Removed from Saved Bookmarks • Alert Canceled');
          return prev.filter((id) => id !== eventId);
        } else {
          if (targetEvent) {
            scheduleEventReminderNotification(targetEvent).then(({ scheduled, triggerDate }) => {
              if (scheduled && triggerDate) {
                const timeLabel = formatTimePart(
                  `${String(triggerDate.getHours()).padStart(2, '0')}:${String(
                    triggerDate.getMinutes()
                  ).padStart(2, '0')}`
                );
                showToast(`✦ Saved to Bookmarks • 4h Push Alert set (${timeLabel})`);
              } else {
                showToast('✦ Saved to Bookmarks (4h Reminder Armed)');
              }
            });
          } else {
            showToast('✦ Saved to Remind Me Bookmarks');
          }
          return [...prev, eventId];
        }
      });
    },
    [allKnownEvents, events, showToast]
  );

  const handleSendToOrbit = useCallback(
    (item) => {
      showToast(`📡 Broadcasting "${item.title || 'Event'}" to your orbit...`);
    },
    [showToast]
  );

  const handleCycleMonth = useCallback(() => {
    setConstellationMonth((prev) => (prev + 1) % 12);
  }, []);

  const handleToggleTonightOnly = useCallback(() => {
    setTonightOnly((prev) => {
      const next = !prev;
      showToast(
        next
          ? "⚡ TONIGHT'S ORBIT ACTIVE • Showing tonight's signals only"
          : '✦ FULL ORBIT ACTIVE • Showing all upcoming signals'
      );
      return next;
    });
  }, [showToast]);

  const activeConstellation = useMemo(
    () => getConstellationForMonth(constellationMonth),
    [constellationMonth]
  );

  // Smart 7-Day Category Sorting & Dimming (`today` through `today + 7 days`)
  const sortedFilterPills = useMemo(() => {
    const today = getTodayIsoDate();
    const sevenDaysAhead = getIsoDatePlusDays(7);

    const eventsThisWeek = events.filter((ev) => {
      const dateStr = (ev.event_date || '').trim().slice(0, 10);
      return dateStr >= today && dateStr <= sevenDaysAhead;
    });

    const otherPillars = CATEGORY_PILLARS.slice(1);
    const activePillars = [];
    const inactivePillars = [];

    for (const pillar of otherPillars) {
      const count7d = eventsThisWeek.filter((ev) => eventMatchesCategory(ev, pillar)).length;
      if (count7d > 0) {
        activePillars.push({ label: pillar, hasWeeklyEvents: true, count7d });
      } else {
        inactivePillars.push({ label: pillar, hasWeeklyEvents: false, count7d: 0 });
      }
    }

    return [
      { label: 'All Signals', hasWeeklyEvents: true, count7d: eventsThisWeek.length },
      ...activePillars,
      ...inactivePillars,
    ];
  }, [events]);

  // Split fetched events into upcomingEvents (event_date >= today) and pastEvents (event_date < today)
  const { allUpcomingEvents, upcomingEvents, pastEvents } = useMemo(() => {
    const today = getTodayIsoDate();
    const allUpcoming = [];
    const filteredUpcoming = [];
    const filteredPast = [];

    events.forEach((event) => {
      const eventDateStr = (event.event_date || '').trim().slice(0, 10);
      const isPast = /^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)
        ? eventDateStr < today
        : isEventExpired(event.event_date);

      if (!isPast) {
        allUpcoming.push({ ...event, isPast: false });
      }

      if (!eventMatchesCategory(event, selectedTag)) {
        return;
      }

      if (tonightOnly) {
        if (eventDateStr === today) {
          filteredUpcoming.push({ ...event, isPast: false });
        }
        return;
      }

      if (isPast) {
        filteredPast.push({ ...event, isPast: true });
      } else {
        filteredUpcoming.push({ ...event, isPast: false });
      }
    });

    const sortAsc = (a, b) => {
      const timeA = parseEventDate(a.event_date)?.getTime() ?? 0;
      const timeB = parseEventDate(b.event_date)?.getTime() ?? 0;
      return timeA - timeB;
    };

    const sortDesc = (a, b) => {
      const timeA = parseEventDate(a.event_date)?.getTime() ?? 0;
      const timeB = parseEventDate(b.event_date)?.getTime() ?? 0;
      return timeB - timeA;
    };

    allUpcoming.sort(sortAsc);
    filteredUpcoming.sort(sortAsc);
    filteredPast.sort(sortDesc);

    return {
      allUpcomingEvents: allUpcoming,
      upcomingEvents: filteredUpcoming,
      pastEvents: filteredPast,
    };
  }, [events, selectedTag, tonightOnly]);

  const featuredEvents = useMemo(() => upcomingEvents.slice(0, 6), [upcomingEvents]);

  // Live astrological sign (zodiac glyph + Bayer star) for the Cosmic Alignment HUD banner
  const liveSign = useMemo(() => getAstrologicalConstellation(new Date()), []);

  const bookmarkedEvents = useMemo(() => {
    return remindedIds
      .map((id) => allKnownEvents[String(id)] || events.find((e) => e.id === id))
      .filter((item) => Boolean(item))
      .map((item) => ({ ...item, isPast: isEventExpired(item.event_date) }));
  }, [allKnownEvents, events, remindedIds]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CosmicBackdrop />

      <ConstellationHeader
        constellation={activeConstellation}
        onCycleMonth={handleCycleMonth}
        isCurrentMonth={constellationMonth === currentSystemMonth}
        eventCount={upcomingEvents.length}
        tonightOnly={tonightOnly}
        onToggleTonightOnly={handleToggleTonightOnly}
      />

      {tonightOnly ? (
        <View style={styles.tonightActiveBar}>
          <Text style={styles.tonightActiveText}>
            ⚡ TONIGHT&apos;S ORBIT FILTER ACTIVE ({getTodayIsoDate()})
          </Text>
          <Pressable
            onPress={() => setTonightOnly(false)}
            style={styles.monthResetBtn}>
            <Text style={styles.monthResetText}>Return to Full Orbit</Text>
          </Pressable>
        </View>
      ) : null}

      {toastMessage ? (
        <View style={styles.toastBanner} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {activeTab === 'feed' ? (
        <View style={styles.mainContent}>
          <View style={styles.filterBarContainer}>
            <FlatList
              data={sortedFilterPills}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.label}
              contentContainerStyle={styles.filterList}
              renderItem={({ item: pill }) => {
                const isSelected = selectedTag === pill.label;
                const isDimmed = !pill.hasWeeklyEvents && !isSelected;
                return (
                  <Pressable
                    onPress={() => setSelectedTag(pill.label)}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                      isDimmed && styles.filterChipDimmed,
                    ]}>
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}>
                      {pill.label === 'All Signals' ? '+ All Signals' : pill.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          {loading ? (
            <ConstellationLoader
              constellation={activeConstellation}
              selectedTag={selectedTag}
            />
          ) : (
            <FlatList
              key="hybrid-feed-sorted"
              data={upcomingEvents}
              keyExtractor={(item) => `grid-${item.id}`}
              style={styles.feedFlatList}
              contentContainerStyle={styles.dashboardScrollGrid}
              ListHeaderComponentStyle={styles.listHeaderFullWidth}
              ListFooterComponentStyle={styles.listFooterFullWidth}
              CellRendererComponent={FlatListCellPassthrough}
              removeClippedSubviews={false}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchEvents(true)}
                  tintColor="#38BDF8"
                />
              }
              ListHeaderComponent={
                featuredEvents.length > 0 ? (
                  <View style={styles.featuredSection}>
                    <CosmicAlignmentBanner
                      symbol={liveSign.symbol}
                      subtitle={`${featuredEvents.length} FEATURED SIGNAL${
                        featuredEvents.length === 1 ? '' : 'S'
                      } • ${tonightOnly ? "TONIGHT'S ORBIT" : 'FULL ORBIT'} • ${(
                        liveSign.bayerStar || ''
                      ).toUpperCase()}`}
                    />

                    <FlatList
                      data={featuredEvents}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      snapToInterval={carouselCardWidth + 10}
                      snapToAlignment="start"
                      keyExtractor={(item) => `carousel-${item.id}`}
                      style={styles.carouselFlatList}
                      contentContainerStyle={styles.carouselList}
                      removeClippedSubviews={false}
                      renderItem={({ item }) => (
                        <View style={styles.carouselItemWrapper}>
                          <EventCard
                            item={item}
                            variant="carousel"
                            cardWidth={carouselCardWidth}
                            isReminded={remindedIds.includes(item.id)}
                            onToggleRemind={handleToggleRemind}
                            onSendToOrbit={handleSendToOrbit}
                          />
                        </View>
                      )}
                    />

                    <View style={[styles.sectionHeaderRow, styles.upcomingSectionHeader]}>
                      <View>
                        <Text style={styles.sectionEyebrow}>📡 MINNEAPOLIS TELEMETRY</Text>
                        <Text style={styles.sectionTitle}>Upcoming Signals</Text>
                      </View>
                      <View style={styles.sectionCountBadgeSecondary}>
                        <Text style={styles.sectionCountTextSecondary}>
                          {upcomingEvents.length} UPCOMING
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : undefined
              }
              ListEmptyComponent={
                pastEvents.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStar}>✦</Text>
                    <Text style={styles.emptyTitle}>
                      {tonightOnly
                        ? 'No signals scheduled for Tonight'
                        : `No signals detected for “${selectedTag}”`}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      {tonightOnly
                        ? 'Tap the top-right telemetry box or the button below to return to Full Orbit.'
                        : 'Try switching to another active vibe pillar or check back as new Minneapolis flyers are synced.'}
                    </Text>
                  </View>
                ) : undefined
              }
              renderItem={({ item }) => (
                <View style={styles.gridItemWrapper}>
                  <EventCard
                    item={item}
                    variant="grid"
                    cardWidth={gridCardWidth}
                    isReminded={remindedIds.includes(item.id)}
                    onToggleRemind={handleToggleRemind}
                    onSendToOrbit={handleSendToOrbit}
                  />
                </View>
              )}
              ListFooterComponent={
                pastEvents.length > 0 ? (
                  <View style={styles.pastSection}>
                    <View style={styles.pastDividerContainer}>
                      <View style={styles.pastDividerLine} />
                      <Text style={styles.pastDividerText}>Recent Signals</Text>
                      <View style={styles.pastDividerLine} />
                    </View>
                    <View style={styles.pastEventsGrid}>
                      {pastEvents.map((item) => (
                        <View
                          key={`past-${item.id}`}
                          style={[styles.gridItemWrapper, styles.pastCardWrapper]}>
                          <EventCard
                            item={item}
                            variant="grid"
                            cardWidth={gridCardWidth}
                            isReminded={remindedIds.includes(item.id)}
                            onToggleRemind={handleToggleRemind}
                            onSendToOrbit={handleSendToOrbit}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : undefined
              }
            />
          )}
        </View>
      ) : activeTab === 'map' ? (
        <View style={styles.mainContent}>
          <MapViewPlaceholder
            events={allUpcomingEvents}
            remindedIds={remindedIds}
            onToggleRemind={handleToggleRemind}
            onSendToOrbit={handleSendToOrbit}
            onJumpToFeed={() => setActiveTab('feed')}
          />
        </View>
      ) : (
        <View style={styles.mainContent}>
          <View style={styles.bookmarksHeader}>
            <View style={styles.bookmarksTitleRow}>
              <BookmarkIcon size={18} color="#38BDF8" active />
              <Text style={styles.bookmarksTitle}>Saved Bookmarks</Text>
            </View>
            <Text style={styles.bookmarksSubtitle}>
              {bookmarkedEvents.length === 0
                ? 'Tap "Remind" on any event card to lock it into your personal orbit and arm a 4-hour prior push alert.'
                : `${bookmarkedEvents.length} Minneapolis event${
                    bookmarkedEvents.length === 1 ? '' : 's'
                  } locked in your personal constellation (4-hour prior reminder armed).`}
            </Text>
          </View>

          <FlatList
            key="bookmarks-grid-2col"
            data={bookmarkedEvents}
            numColumns={2}
            keyExtractor={(item) => `saved-${item.id}`}
            style={styles.feedFlatList}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.dashboardScroll}
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyBookmarkCircle}>
                  <BookmarkIcon size={26} color="#38BDF8" active={false} />
                </View>
                <Text style={styles.emptyTitle}>Your orbit is currently empty</Text>
                <Text style={styles.emptySubtitle}>
                  Bookmark events with the &ldquo;Remind&rdquo; button in the Live Feed to build your nightlife lineup and receive a push alert 4 hours before showtime.
                </Text>
                <Pressable
                  onPress={() => setActiveTab('feed')}
                  style={styles.emptyActionBtn}>
                  <Text style={styles.emptyActionText}>Explore Live Feed ✦</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.gridItemWrapper, item.isPast && styles.pastCardWrapper]}>
                <EventCard
                  item={item}
                  variant="grid"
                  cardWidth={gridCardWidth}
                  isReminded={remindedIds.includes(item.id)}
                  onToggleRemind={handleToggleRemind}
                  onSendToOrbit={handleSendToOrbit}
                />
              </View>
            )}
          />
        </View>
      )}

      <BottomTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        savedCount={remindedIds.length}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B18',
  },
  bgGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: '#050B18',
  },
  bgGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: '#0A1528',
  },
  mainContent: {
    flex: 1,
  },
  tonightActiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: 'rgba(14, 30, 56, 0.94)',
    borderBottomWidth: 1,
    borderBottomColor: '#00F0FF',
  },
  tonightActiveText: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  monthResetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0EA5E9',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  monthResetText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  toastBanner: {
    position: 'absolute',
    top: 118,
    alignSelf: 'center',
    zIndex: 50,
    backgroundColor: 'rgba(14, 30, 56, 0.95)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  filterBarContainer: {
    backgroundColor: 'rgba(5, 10, 20, 0.45)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 240, 255, 0.2)',
    paddingVertical: 11,
  },
  filterList: {
    paddingHorizontal: 14,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 18, 38, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(0, 160, 255, 0.16)',
    borderColor: '#00F0FF',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 4,
  },
  filterChipDimmed: {
    opacity: 0.38,
  },
  filterChipText: {
    color: '#93C5FD',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dashboardScroll: {
    paddingBottom: 28,
  },
  dashboardScrollGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 28,
  },
  listHeaderFullWidth: {
    width: '100%',
  },
  listFooterFullWidth: {
    width: '100%',
  },
  featuredSection: {
    paddingTop: 14,
    paddingBottom: 6,
    marginHorizontal: -14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  upcomingSectionHeader: {
    marginTop: 18,
    marginBottom: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(29, 78, 216, 0.5)',
  },
  sectionEyebrow: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  sectionCountBadge: {
    backgroundColor: '#0EA5E9',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sectionCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionCountBadgeSecondary: {
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sectionCountTextSecondary: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  feedFlatList: {
    overflow: 'visible',
  },
  carouselFlatList: {
    overflow: 'visible',
  },
  carouselList: {
    paddingHorizontal: 14,
  },
  carouselItemWrapper: {
    marginRight: 10,
  },
  gridRow: {
    paddingHorizontal: 14,
    justifyContent: 'space-between',
  },
  gridItemWrapper: {
    overflow: 'visible',
  },
  pastSection: {
    width: '100%',
  },
  pastEventsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pastCardWrapper: {
    opacity: 0.55,
    filter: 'grayscale(40%)',
  },
  pastDividerContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  pastDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(147, 197, 253, 0.2)',
  },
  pastDividerText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginHorizontal: 12,
    textTransform: 'uppercase',
  },
  bookmarksHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1D4ED8',
    backgroundColor: '#050B18',
    marginBottom: 12,
  },
  bookmarksTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookmarksTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bookmarksSubtitle: {
    color: '#93C5FD',
    fontSize: 12.5,
    marginTop: 4,
    lineHeight: 18,
  },
  emptyState: {
    paddingVertical: 56,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBookmarkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStar: {
    fontSize: 32,
    color: '#38BDF8',
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#93C5FD',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  emptyActionBtn: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
