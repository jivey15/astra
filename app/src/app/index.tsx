import { createClient } from '@supabase/supabase-js';
import { router, useLocalSearchParams } from 'expo-router';
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
import { AstraTabKey, BottomTabBar } from '@/components/bottom-tab-bar';
import { ConstellationHeader } from '@/components/constellation-header';
import { ConstellationLoader } from '@/components/constellation-loader';
import { EventCard, EventItem } from '@/components/event-card';
import { MapViewPlaceholder } from '@/components/map-view-placeholder';
import { getConstellationForMonth } from '@/constants/constellations';

// Connect to live project-loring database
const SUPABASE_URL = 'https://pvdzgmglfcmdysyorjhf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-zw9isL2SkCT7r9O0fUwYA_SfmPynKp';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VIBE_FILTERS = ['All', 'Watch Party', 'Drag/Show', 'Circuit/DJ', 'Nightlife'];

const FlatListCellPassthrough = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);

export function parseEventDate(dateString?: string | null): Date | null {
  if (!dateString) return null;
  const trimmed = String(dateString).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTodayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isEventExpired(dateString?: string | null): boolean {
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

export default function App() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { width: screenWidth } = useWindowDimensions();

  // Responsive card dimensions for Hybrid Dashboard Layout:
  // ~46% screen width for horizontal snapping carousel so two cards sit side-by-side
  const carouselCardWidth = Math.max(152, Math.round(screenWidth * 0.46));
  // 2-column vertical grid card width (14px horizontal padding on each side + 10px column gap)
  const gridCardWidth = Math.max(148, Math.floor((screenWidth - 28 - 10) / 2));

  const currentSystemMonth = useMemo(() => new Date().getMonth(), []);
  const [constellationMonth, setConstellationMonth] = useState<number>(currentSystemMonth);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [allKnownEvents, setAllKnownEvents] = useState<Record<string, EventItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Local state for 'Remind me' bookmarks
  const [remindedIds, setRemindedIds] = useState<(string | number)[]>([]);

  // Secondary Navigation Bar state ('feed' | 'map' | 'bookmarks')
  const [activeTab, setActiveTab] = useState<AstraTabKey>('feed');

  // Cosmic feedback toast banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (params.tab === 'map' || params.tab === 'bookmarks' || params.tab === 'feed') {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const fetchEvents = useCallback(async (tag: string, isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Calculate an ISO date string for exactly 14 days ago
      const fourteenDaysAgoDate = new Date();
      fourteenDaysAgoDate.setDate(fourteenDaysAgoDate.getDate() - 14);
      const fourteenDaysAgo = fourteenDaysAgoDate.toISOString().split('T')[0];

      let query = supabase
        .from('events')
        .select('*')
        .eq('is_approved', true)
        .gte('event_date', fourteenDaysAgo)
        .order('event_date', { ascending: true });

      if (tag !== 'All') {
        query = query.contains('vibe_tags', [tag]);
      }

      const { data, error } = await query;

      if (error) throw error;
      const fetched = ((data as EventItem[]) || []).filter(
        (item) => item.is_approved === true
      );
      setEvents(fetched);

      // Cache events by ID so bookmarked items persist across filter changes
      setAllKnownEvents((prev) => {
        const next = { ...prev };
        for (const item of fetched) {
          next[String(item.id)] = item;
        }
        return next;
      });
    } catch (error: any) {
      console.error('Error fetching events:', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(selectedTag);
  }, [fetchEvents, selectedTag]);

  const handleToggleRemind = useCallback(
    (eventId: string | number) => {
      setRemindedIds((prev) => {
        const exists = prev.includes(eventId);
        if (exists) {
          showToast('Removed from Saved Bookmarks');
          return prev.filter((id) => id !== eventId);
        } else {
          showToast('✦ Saved to Remind Me Bookmarks');
          return [...prev, eventId];
        }
      });
    },
    [showToast]
  );

  const handleSendToOrbit = useCallback(
    (item: EventItem) => {
      showToast(`📡 Broadcasting "${item.title || 'Event'}" to your orbit...`);
    },
    [showToast]
  );

  const handleCycleMonth = useCallback(() => {
    setConstellationMonth((prev) => (prev + 1) % 12);
  }, []);

  const handleSelectTab = useCallback((tab: AstraTabKey) => {
    setActiveTab(tab);
    try {
      router.setParams({ tab });
    } catch {
      // Safe fallback if router is not ready
    }
  }, []);

  const activeConstellation = useMemo(
    () => getConstellationForMonth(constellationMonth),
    [constellationMonth]
  );

  // Split fetched events into upcomingEvents (event_date >= today) and pastEvents (event_date < today)
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const today = getTodayIsoDate();
    const upcoming: (EventItem & { isPast: boolean })[] = [];
    const past: (EventItem & { isPast: boolean })[] = [];

    events.forEach((event) => {
      const eventDateStr = (event.event_date || '').trim().slice(0, 10);
      const isPast = /^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)
        ? eventDateStr < today
        : isEventExpired(event.event_date);

      if (isPast) {
        past.push({ ...event, isPast: true });
      } else {
        upcoming.push({ ...event, isPast: false });
      }
    });

    upcoming.sort((a, b) => {
      const timeA = parseEventDate(a.event_date)?.getTime() ?? 0;
      const timeB = parseEventDate(b.event_date)?.getTime() ?? 0;
      return timeA - timeB;
    });

    past.sort((a, b) => {
      const timeA = parseEventDate(a.event_date)?.getTime() ?? 0;
      const timeB = parseEventDate(b.event_date)?.getTime() ?? 0;
      return timeB - timeA;
    });

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events]);

  // Top Section: 'Tonight's Alignment / Featured Orbit' (next 4 to 6 upcoming featured events)
  const featuredEvents = useMemo(() => upcomingEvents.slice(0, 6), [upcomingEvents]);

  const bookmarkedEvents = useMemo(() => {
    return remindedIds
      .map((id) => allKnownEvents[String(id)] || events.find((e) => e.id === id))
      .filter((item): item is EventItem => Boolean(item) && item.is_approved === true)
      .map((item) => ({ ...item, isPast: isEventExpired(item.event_date) }));
  }, [allKnownEvents, events, remindedIds]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Deep Cosmic Navy Background Gradient Layers (#050B18 -> #0A1528) */}
      <View style={styles.bgGradientTop} pointerEvents="none" />
      <View style={styles.bgGradientBottom} pointerEvents="none" />

      {/* Dynamic Zodiac Constellation Header */}
      <ConstellationHeader
        constellation={activeConstellation}
        onCycleMonth={handleCycleMonth}
        isCurrentMonth={constellationMonth === currentSystemMonth}
        eventCount={upcomingEvents.length}
      />

      {/* Optional Reset Banner when previewing other months' constellations */}
      {constellationMonth !== currentSystemMonth ? (
        <View style={styles.monthPreviewBar}>
          <Text style={styles.monthPreviewText}>
            Previewing {activeConstellation.monthName} ({activeConstellation.symbol}{' '}
            {activeConstellation.name})
          </Text>
          <Pressable
            onPress={() => setConstellationMonth(currentSystemMonth)}
            style={styles.monthResetBtn}>
            <Text style={styles.monthResetText}>Return to Current Month</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Floating Cyan HUD Toast Feedback */}
      {toastMessage ? (
        <View style={styles.toastBanner} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* MAIN VIEW SWITCHER */}
      {activeTab === 'feed' ? (
        <View style={styles.mainContent}>
          {/* Interactive Electric Cyan Vibe Filter Chips */}
          <View style={styles.filterBarContainer}>
            <FlatList
              data={VIBE_FILTERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.filterList}
              renderItem={({ item: tag }) => {
                const isSelected = selectedTag === tag;
                return (
                  <Pressable
                    onPress={() => setSelectedTag(tag)}
                    style={[styles.filterChip, isSelected && styles.filterChipActive]}>
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}>
                      {tag === 'All' ? '✦ All Signals' : tag}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          {/* Matching Zodiac Constellation Loading Screen or Hybrid Dashboard Feed */}
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
                  onRefresh={() => fetchEvents(selectedTag, true)}
                  tintColor="#38BDF8"
                />
              }
              ListHeaderComponent={
                featuredEvents.length > 0 ? (
                  <View style={styles.featuredSection}>
                    {/* TOP SECTION: 'Tonight's Alignment / Featured Orbit' */}
                    <View style={styles.sectionHeaderRow}>
                      <View>
                        <Text style={styles.sectionEyebrow}>✦ FEATURED ORBIT</Text>
                        <Text style={styles.sectionTitle}>Tonight&apos;s Alignment</Text>
                      </View>
                      <View style={styles.sectionCountBadge}>
                        <Text style={styles.sectionCountText}>
                          {featuredEvents.length} FEATURED
                        </Text>
                      </View>
                    </View>

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

                    {/* BOTTOM SECTION HEADER: 'Upcoming Signals' (2-Column Vertical Grid) */}
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
                      No signals detected for &ldquo;{selectedTag}&rdquo;
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      Try switching to another vibe frequency or check back as new Minneapolis flyers are synced.
                    </Text>
                    {selectedTag !== 'All' ? (
                      <Pressable
                        onPress={() => setSelectedTag('All')}
                        style={styles.emptyActionBtn}>
                        <Text style={styles.emptyActionText}>Reset Filter to All</Text>
                      </Pressable>
                    ) : null}
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
            events={upcomingEvents}
            remindedIds={remindedIds}
            onToggleRemind={handleToggleRemind}
            onJumpToFeed={() => handleSelectTab('feed')}
          />
        </View>
      ) : (
        /* SAVED BOOKMARKS VIEW (2-Column Compact HUD Grid) */
        <View style={styles.mainContent}>
          <View style={styles.bookmarksHeader}>
            <View style={styles.bookmarksTitleRow}>
              <BookmarkIcon size={18} color="#38BDF8" active />
              <Text style={styles.bookmarksTitle}>Saved Bookmarks</Text>
            </View>
            <Text style={styles.bookmarksSubtitle}>
              {bookmarkedEvents.length === 0
                ? 'Tap "Remind" on any event card to lock it into your personal orbit.'
                : `${bookmarkedEvents.length} upcoming Minneapolis event${
                    bookmarkedEvents.length === 1 ? '' : 's'
                  } locked in your personal constellation.`}
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
                  Bookmark events with the &ldquo;Remind&rdquo; button in the Live Feed to build your nightlife lineup.
                </Text>
                <Pressable
                  onPress={() => handleSelectTab('feed')}
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

      {/* Secondary Navigation Bar (Bottom Tab Navigation Menu) */}
      <BottomTabBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
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
  monthPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: 'rgba(14, 30, 56, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#38BDF8',
  },
  monthPreviewText: {
    color: '#93C5FD',
    fontSize: 11.5,
    fontWeight: '700',
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
    backgroundColor: '#050B18',
    borderBottomWidth: 1,
    borderBottomColor: '#1D4ED8',
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
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
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
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
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
