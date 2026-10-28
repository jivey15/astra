import { createClient } from '@supabase/supabase-js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { MapRadarIcon } from '@/components/astra-icons';
import { EventCard, EventItem } from '@/components/event-card';

const SUPABASE_URL = 'https://pvdzgmglfcmdysyorjhf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-zw9isL2SkCT7r9O0fUwYA_SfmPynKp';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getLocalTodayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isMapEventExpired(dateString?: string | null): boolean {
  if (!dateString) return false;
  const trimmed = String(dateString).trim();
  const datePart = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart < getLocalTodayIso();
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed < todayStart;
}

export interface MapViewPlaceholderProps {
  events: EventItem[];
  remindedIds: (string | number)[];
  onToggleRemind: (id: string | number) => void;
  onSendToOrbit?: (item: EventItem) => void;
  onJumpToFeed: () => void;
}

interface TwinCitiesVenueNode {
  id: string;
  shortName: string;
  venueName: string;
  aliases: string[];
  neighborhood: string;
  lat: number;
  lng: number;
  coordsLabel: string;
  x: number; // Calibrated normalized screen projection (0..1)
  y: number; // Calibrated normalized screen projection (0..1)
  color: string;
}

const TWIN_CITIES_VENUES: TwinCitiesVenueNode[] = [
  {
    id: 'lush',
    shortName: 'LUSH',
    venueName: 'LUSH Lounge & Theater',
    aliases: ['lush', 'lushmpls', 'lush.mpls'],
    neighborhood: '990 Central Ave NE • NE Arts District',
    lat: 44.9903,
    lng: -93.2474,
    coordsLabel: '44.9903° N, 93.2474° W',
    x: 0.62,
    y: 0.16,
    color: '#38BDF8',
  },
  {
    id: 'jetset',
    shortName: 'Jetset',
    venueName: 'Jetset Underground',
    aliases: ['jetset', 'jetsetbarmpls', 'jetset underground'],
    neighborhood: '115 N 1st St • North Loop',
    lat: 44.9849,
    lng: -93.2691,
    coordsLabel: '44.9849° N, 93.2691° W',
    x: 0.34,
    y: 0.24,
    color: '#7DD3FC',
  },
  {
    id: 'saloon',
    shortName: 'The Saloon',
    venueName: 'The Saloon MN',
    aliases: ['saloon', 'thesaloonmn', 'the saloon'],
    neighborhood: '830 Hennepin Ave • Downtown Core',
    lat: 44.9762,
    lng: -93.276,
    coordsLabel: '44.9762° N, 93.2760° W',
    x: 0.38,
    y: 0.45,
    color: '#00F0FF',
  },
  {
    id: 'eagle',
    shortName: 'The Eagle',
    venueName: 'Eagle MPLS',
    aliases: ['eagle', 'eaglempls', 'eagleboltbar', 'the eagle'],
    neighborhood: '515 Washington Ave S • Downtown East',
    lat: 44.974,
    lng: -93.2594,
    coordsLabel: '44.9740° N, 93.2594° W',
    x: 0.63,
    y: 0.49,
    color: '#38BDF8',
  },
  {
    id: 'the19bar',
    shortName: 'The 19 Bar',
    venueName: 'The 19 Bar',
    aliases: ['19 bar', 'the19bar', 'the 19 bar'],
    neighborhood: '19 W 15th St • Loring Park',
    lat: 44.9692,
    lng: -93.2848,
    coordsLabel: '44.9692° N, 93.2848° W',
    x: 0.19,
    y: 0.66,
    color: '#7DD3FC',
  },
  {
    id: 'stonewall',
    shortName: 'Stonewall Sports',
    venueName: 'Stonewall Sports Twin Cities',
    aliases: ['stonewall', 'stonewalltwincities', 'stonewall sports'],
    neighborhood: 'Loring Park / Twin Cities Sector',
    lat: 44.9708,
    lng: -93.2682,
    coordsLabel: '44.9708° N, 93.2682° W',
    x: 0.45,
    y: 0.74,
    color: '#38BDF8',
  },
  {
    id: 'blackhart',
    shortName: 'Black Hart',
    venueName: 'The Black Hart of Saint Paul',
    aliases: ['black hart', 'blackhart', 'blackhartstp'],
    neighborhood: '1415 University Ave W • St. Paul Midway',
    lat: 44.9558,
    lng: -93.1592,
    coordsLabel: '44.9558° N, 93.1592° W',
    x: 0.84,
    y: 0.78,
    color: '#7DD3FC',
  },
];

// Primary cyan constellation spine + secondary indigo triangulation edges
const CONSTELLATION_EDGES: {
  from: string;
  to: string;
  variant: 'primary' | 'secondary';
}[] = [
  { from: 'the19bar', to: 'saloon', variant: 'primary' },
  { from: 'saloon', to: 'jetset', variant: 'primary' },
  { from: 'jetset', to: 'lush', variant: 'primary' },
  { from: 'lush', to: 'eagle', variant: 'primary' },
  { from: 'saloon', to: 'eagle', variant: 'primary' },
  { from: 'eagle', to: 'blackhart', variant: 'primary' },
  { from: 'the19bar', to: 'stonewall', variant: 'primary' },
  { from: 'stonewall', to: 'eagle', variant: 'primary' },
  // Subtle indigo triangulation web
  { from: 'jetset', to: 'eagle', variant: 'secondary' },
  { from: 'saloon', to: 'stonewall', variant: 'secondary' },
  { from: 'stonewall', to: 'blackhart', variant: 'secondary' },
];

const BACKGROUND_STARS = [
  { x: 0.08, y: 0.14, s: 2 },
  { x: 0.16, y: 0.36, s: 1.8 },
  { x: 0.25, y: 0.12, s: 2.4 },
  { x: 0.49, y: 0.11, s: 1.6 },
  { x: 0.78, y: 0.15, s: 2.2 },
  { x: 0.89, y: 0.29, s: 1.8 },
  { x: 0.76, y: 0.38, s: 1.5 },
  { x: 0.12, y: 0.84, s: 2.1 },
  { x: 0.31, y: 0.88, s: 1.6 },
  { x: 0.64, y: 0.87, s: 2 },
  { x: 0.91, y: 0.58, s: 1.8 },
  { x: 0.52, y: 0.33, s: 1.6 },
];

function matchEventToVenueId(event: EventItem): string | null {
  const haystack = `${event.venue_name || ''} ${event.title || ''}`.toLowerCase();
  for (const venue of TWIN_CITIES_VENUES) {
    if (venue.aliases.some((alias) => haystack.includes(alias))) {
      return venue.id;
    }
  }
  return null;
}

export function MapViewPlaceholder({
  events,
  remindedIds,
  onToggleRemind,
  onSendToOrbit,
  onJumpToFeed,
}: MapViewPlaceholderProps) {
  const { width: screenWidth } = useWindowDimensions();
  const drawerGridCardWidth = Math.max(142, Math.floor((screenWidth - 32 - 28 - 10) / 2));

  const starPulse = useRef(new Animated.Value(0.6)).current;
  const lineGlow = useRef(new Animated.Value(0.45)).current;

  const [mapCanvasSize, setMapCanvasSize] = useState({ width: 340, height: 370 });
  const [fetchedApprovedEvents, setFetchedApprovedEvents] = useState<EventItem[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('saloon');
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchApprovedMapEvents() {
      try {
        const today = getLocalTodayIso();
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('is_approved', true)
          .gte('event_date', today)
          .order('event_date', { ascending: true });

        if (error) throw error;
        if (isMounted && data) {
          setFetchedApprovedEvents(
            (data as EventItem[]).filter((ev) => ev.is_approved === true)
          );
        }
      } catch (err: any) {
        console.error('Error fetching approved map events:', err?.message || err);
      }
    }

    fetchApprovedMapEvents();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(starPulse, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(starPulse, {
          toValue: 0.5,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const lineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineGlow, {
          toValue: 0.85,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lineGlow, {
          toValue: 0.35,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    lineLoop.start();
    return () => {
      pulseLoop.stop();
      lineLoop.stop();
    };
  }, [lineGlow, starPulse]);

  const upcomingApprovedEvents = useMemo(() => {
    const sourceEvents = events && events.length > 0 ? events : fetchedApprovedEvents;
    return sourceEvents.filter(
      (ev) => ev.is_approved !== false && !ev.isPast && !isMapEventExpired(ev.event_date)
    );
  }, [events, fetchedApprovedEvents]);

  const venuesWithEvents = useMemo(() => {
    const buckets: Record<string, EventItem[]> = {};
    for (const v of TWIN_CITIES_VENUES) {
      buckets[v.id] = [];
    }

    for (const ev of upcomingApprovedEvents) {
      const matchedId = matchEventToVenueId(ev);
      if (matchedId && buckets[matchedId]) {
        buckets[matchedId].push(ev);
      }
    }

    return TWIN_CITIES_VENUES.map((venue) => ({
      ...venue,
      upcomingEvents: buckets[venue.id] || [],
    }));
  }, [upcomingApprovedEvents]);

  const selectedVenue = useMemo(
    () =>
      venuesWithEvents.find((v) => v.id === selectedVenueId) || venuesWithEvents[0],
    [selectedVenueId, venuesWithEvents]
  );

  const handleMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setMapCanvasSize({ width, height });
    }
  };

  const handleSelectVenueStar = (venueId: string) => {
    setSelectedVenueId(venueId);
    setDrawerVisible(true);
  };

  const venueById = useMemo(() => {
    const map: Record<string, (typeof venuesWithEvents)[number]> = {};
    for (const v of venuesWithEvents) {
      map[v.id] = v;
    }
    return map;
  }, [venuesWithEvents]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Top Status Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.badgeRow}>
          <MapRadarIcon size={16} color="#38BDF8" active />
          <Text style={styles.badgeText}>TWIN CITIES CONSTELLATION TELEMETRY</Text>
        </View>
        <Text style={styles.title}>Minneapolis–St. Paul Star Map</Text>
        <Text style={styles.subtitle}>
          Real-time venue star nodes plotted across Loring Park, Hennepin Ave, Northeast & St. Paul Midway. Tap any star node to open its venue signal drawer.
        </Text>
      </View>

      {/* Interactive Dark Telemetry Constellation Map Canvas */}
      <View style={styles.mapFrame} onLayout={handleMapLayout}>
        {/* Celestial Coordinate Grid Lines */}
        <View style={[styles.gridLineH, { top: '25%' }]} pointerEvents="none" />
        <View style={[styles.gridLineH, { top: '50%' }]} pointerEvents="none" />
        <View style={[styles.gridLineH, { top: '75%' }]} pointerEvents="none" />
        <View style={[styles.gridLineV, { left: '25%' }]} pointerEvents="none" />
        <View style={[styles.gridLineV, { left: '50%' }]} pointerEvents="none" />
        <View style={[styles.gridLineV, { left: '75%' }]} pointerEvents="none" />

        {/* Stylized Mississippi River Corridor */}
        <View style={styles.riverChannel} pointerEvents="none" />

        {/* Ambient Starfield */}
        {BACKGROUND_STARS.map((star, idx) => (
          <Animated.View
            key={`ambient-star-${idx}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: star.x * mapCanvasSize.width,
              top: star.y * mapCanvasSize.height,
              width: star.s,
              height: star.s,
              borderRadius: star.s / 2,
              backgroundColor: idx % 2 === 0 ? '#7DD3FC' : '#FFFFFF',
              opacity: Animated.multiply(starPulse, 0.45),
            }}
          />
        ))}

        {/* Glowing Cyan & Indigo Vector Constellation Lines Connecting Venues */}
        {CONSTELLATION_EDGES.map((edge, idx) => {
          const fromNode = venueById[edge.from];
          const toNode = venueById[edge.to];
          if (!fromNode || !toNode) return null;

          const x1 = fromNode.x * mapCanvasSize.width;
          const y1 = fromNode.y * mapCanvasSize.height;
          const x2 = toNode.x * mapCanvasSize.width;
          const y2 = toNode.y * mapCanvasSize.height;

          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.hypot(dx, dy);
          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          const isConnectedToSelected =
            selectedVenue?.id === edge.from || selectedVenue?.id === edge.to;
          const isPrimary = edge.variant === 'primary';
          const thickness = isConnectedToSelected ? 2 : isPrimary ? 1.4 : 1;

          return (
            <Animated.View
              key={`constellation-edge-${idx}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: midX - length / 2,
                top: midY - thickness / 2,
                width: length,
                height: thickness,
                borderRadius: thickness,
                backgroundColor: isConnectedToSelected
                  ? '#00F0FF'
                  : isPrimary
                  ? '#38BDF8'
                  : '#6366F1',
                opacity: isConnectedToSelected
                  ? 0.9
                  : isPrimary
                  ? lineGlow
                  : Animated.multiply(lineGlow, 0.55),
                transform: [{ rotate: `${angleDeg}deg` }],
              }}
            />
          );
        })}

        {/* Sector Telemetry Corner Labels */}
        <Text style={[styles.districtLabel, { top: 12, left: 14 }]} pointerEvents="none">
          NORTH LOOP / NE SECTOR
        </Text>
        <Text style={[styles.districtLabel, { bottom: 12, left: 14 }]} pointerEvents="none">
          LORING PARK CORE
        </Text>
        <Text style={[styles.districtLabel, { top: 12, right: 14 }]} pointerEvents="none">
          MISSISSIPPI CORRIDOR
        </Text>
        <Text style={[styles.districtLabel, { bottom: 12, right: 14 }]} pointerEvents="none">
          ST. PAUL MIDWAY →
        </Text>

        {/* Interactive Glowing Venue Star Nodes */}
        {venuesWithEvents.map((venue) => {
          const isSelected = venue.id === selectedVenue?.id;
          const count = venue.upcomingEvents.length;
          const hasSignals = count > 0;
          const cx = venue.x * mapCanvasSize.width;
          const cy = venue.y * mapCanvasSize.height;

          return (
            <Pressable
              key={venue.id}
              onPress={() => handleSelectVenueStar(venue.id)}
              accessibilityRole="button"
              accessibilityLabel={`${venue.venueName}, ${count} upcoming events. Tap to open venue drawer.`}
              style={[
                styles.starNodeTouchArea,
                {
                  left: cx - 54,
                  top: cy - 22,
                },
              ]}>
              <View style={styles.starIconContainer}>
                {/* Pulsing Cyan Outer Halo */}
                <Animated.View
                  style={[
                    styles.starOuterHalo,
                    {
                      backgroundColor: isSelected
                        ? '#00F0FF'
                        : hasSignals
                        ? venue.color
                        : '#6366F1',
                      opacity: isSelected
                        ? 0.55
                        : Animated.multiply(starPulse, hasSignals ? 0.42 : 0.2),
                      transform: [{ scale: isSelected ? 1.45 : starPulse }],
                    },
                  ]}
                />

                {/* Star Diffraction Spikes */}
                {hasSignals || isSelected ? (
                  <>
                    <View
                      style={[
                        styles.spikeH,
                        isSelected && { width: 28, backgroundColor: '#00F0FF' },
                      ]}
                    />
                    <View
                      style={[
                        styles.spikeV,
                        isSelected && { height: 28, backgroundColor: '#00F0FF' },
                      ]}
                    />
                  </>
                ) : null}

                {/* Crisp Star Core */}
                <View
                  style={[
                    styles.starCore,
                    {
                      backgroundColor: hasSignals || isSelected ? '#FFFFFF' : '#93C5FD',
                      borderColor: isSelected ? '#00F0FF' : venue.color,
                    },
                  ]}
                />
              </View>

              {/* Venue Name & Event Count Badge Pill */}
              <View
                style={[
                  styles.nodeLabelPill,
                  isSelected && styles.nodeLabelPillSelected,
                  !hasSignals && !isSelected && styles.nodeLabelPillDimmed,
                ]}>
                <Text
                  style={[
                    styles.nodeLabelText,
                    isSelected && styles.nodeLabelTextSelected,
                  ]}
                  numberOfLines={1}>
                  {venue.shortName}
                </Text>
                <View
                  style={[
                    styles.nodeCountBadge,
                    hasSignals ? styles.nodeCountBadgeActive : styles.nodeCountBadgeZero,
                  ]}>
                  <Text style={styles.nodeCountBadgeText}>{count}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Quick Venue Selector Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.venueSelectorStrip}>
        {venuesWithEvents.map((v) => {
          const isSelected = v.id === selectedVenue?.id;
          return (
            <Pressable
              key={`chip-${v.id}`}
              onPress={() => handleSelectVenueStar(v.id)}
              style={[styles.venueChip, isSelected && styles.venueChipActive]}>
              <Text style={[styles.venueChipText, isSelected && styles.venueChipTextActive]}>
                ✦ {v.shortName} ({v.upcomingEvents.length})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Selected Venue Summary Card (Tap to Open Full Drawer) */}
      {selectedVenue ? (
        <View style={styles.inspectorCard}>
          <View style={styles.inspectorHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inspectorCoords}>{selectedVenue.coordsLabel}</Text>
              <Text style={styles.inspectorVenue}>{selectedVenue.venueName}</Text>
              <Text style={styles.inspectorNeighborhood}>{selectedVenue.neighborhood}</Text>
            </View>
            <Pressable
              onPress={() => setDrawerVisible(true)}
              style={styles.openDrawerPill}>
              <View style={styles.beaconDot} />
              <Text style={styles.openDrawerPillText}>
                {selectedVenue.upcomingEvents.length} SIGNAL
                {selectedVenue.upcomingEvents.length === 1 ? '' : 'S'} • OPEN DRAWER ↑
              </Text>
            </Pressable>
          </View>

          {selectedVenue.upcomingEvents.length > 0 ? (
            <View style={styles.inlineCardsGrid}>
              {selectedVenue.upcomingEvents.map((ev) => (
                <View key={`inline-venue-card-${ev.id}`} style={styles.inlineCardWrap}>
                  <EventCard
                    item={ev}
                    variant="grid"
                    cardWidth={drawerGridCardWidth}
                    isReminded={remindedIds.includes(ev.id)}
                    onToggleRemind={onToggleRemind}
                    onSendToOrbit={onSendToOrbit}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noVenueSignalsBox}>
              <Text style={styles.noVenueSignalsTitle}>
                0 upcoming approved signals locked for {selectedVenue.shortName}
              </Text>
              <Text style={styles.noVenueSignalsSub}>
                Select another glowing star node on the constellation map or browse the full live feed.
              </Text>
              <Pressable onPress={onJumpToFeed} style={styles.jumpFeedBtnFull}>
                <Text style={styles.jumpFeedText}>Explore Full Live Feed →</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {/* VENUE CONSTELLATION BOTTOM SHEET / DRAWER MODAL */}
      <Modal
        visible={drawerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerVisible(false)}>
        <View style={styles.drawerBackdrop}>
          <Pressable
            style={styles.drawerBackdropDismiss}
            onPress={() => setDrawerVisible(false)}
          />
          <View style={styles.drawerSheet}>
            <View style={styles.drawerHandleBar} />

            {selectedVenue ? (
              <>
                <View style={styles.drawerHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inspectorCoords}>
                      ✦ CONSTELLATION NODE • {selectedVenue.coordsLabel}
                    </Text>
                    <Text style={styles.drawerTitle}>{selectedVenue.venueName}</Text>
                    <Text style={styles.inspectorNeighborhood}>
                      {selectedVenue.neighborhood}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setDrawerVisible(false)}
                    style={styles.drawerCloseBtn}>
                    <Text style={styles.drawerCloseText}>✕ CLOSE</Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.drawerScroll}
                  contentContainerStyle={styles.drawerScrollContent}
                  showsVerticalScrollIndicator={false}>
                  {selectedVenue.upcomingEvents.length > 0 ? (
                    <View style={styles.inlineCardsGrid}>
                      {selectedVenue.upcomingEvents.map((ev) => (
                        <View key={`drawer-card-${ev.id}`} style={styles.inlineCardWrap}>
                          <EventCard
                            item={ev}
                            variant="grid"
                            cardWidth={drawerGridCardWidth}
                            isReminded={remindedIds.includes(ev.id)}
                            onToggleRemind={onToggleRemind}
                            onSendToOrbit={onSendToOrbit}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noVenueSignalsBox}>
                      <Text style={styles.noVenueSignalsTitle}>
                        No upcoming signals currently scheduled at {selectedVenue.venueName}
                      </Text>
                      <Text style={styles.noVenueSignalsSub}>
                        New flyers are synced daily at 08:00 UTC. Tap another star node on the constellation map to inspect active venues.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 34,
  },
  headerBanner: {
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  badgeText: {
    color: '#38BDF8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#93C5FD',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  mapFrame: {
    position: 'relative',
    width: '100%',
    height: 370,
    backgroundColor: '#050B18',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  riverChannel: {
    position: 'absolute',
    width: 520,
    height: 20,
    left: -60,
    top: '44%',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    transform: [{ rotate: '28deg' }],
  },
  districtLabel: {
    position: 'absolute',
    fontSize: 8.5,
    fontWeight: '800',
    color: '#93C5FD',
    opacity: 0.62,
    letterSpacing: 1,
  },
  starNodeTouchArea: {
    position: 'absolute',
    width: 108,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  starIconContainer: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starOuterHalo: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  spikeH: {
    position: 'absolute',
    width: 22,
    height: 1.2,
    backgroundColor: '#7DD3FC',
    opacity: 0.85,
  },
  spikeV: {
    position: 'absolute',
    width: 1.2,
    height: 22,
    backgroundColor: '#7DD3FC',
    opacity: 0.85,
  },
  starCore: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
  },
  nodeLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 7.5,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 11, 24, 0.92)',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  nodeLabelPillSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.32)',
    borderColor: '#00F0FF',
  },
  nodeLabelPillDimmed: {
    opacity: 0.72,
  },
  nodeLabelText: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  nodeLabelTextSelected: {
    color: '#FFFFFF',
  },
  nodeCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCountBadgeActive: {
    backgroundColor: '#0EA5E9',
  },
  nodeCountBadgeZero: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
  },
  nodeCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  venueSelectorStrip: {
    gap: 8,
    paddingBottom: 14,
  },
  venueChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  venueChipActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#00F0FF',
  },
  venueChipText: {
    color: '#93C5FD',
    fontSize: 11.5,
    fontWeight: '700',
  },
  venueChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  inspectorCard: {
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  inspectorCoords: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  inspectorVenue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  inspectorNeighborhood: {
    color: '#93C5FD',
    fontSize: 12,
    marginTop: 2,
  },
  openDrawerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 165, 233, 0.22)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00F0FF',
  },
  openDrawerPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  inlineCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  inlineCardWrap: {
    overflow: 'visible',
  },
  noVenueSignalsBox: {
    backgroundColor: 'rgba(5, 11, 24, 0.75)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(29, 78, 216, 0.6)',
    alignItems: 'center',
  },
  noVenueSignalsTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  noVenueSignalsSub: {
    color: '#93C5FD',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  jumpFeedBtnFull: {
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#0EA5E9',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  jumpFeedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 24, 0.82)',
    justifyContent: 'flex-end',
  },
  drawerBackdropDismiss: {
    flex: 1,
  },
  drawerSheet: {
    maxHeight: '84%',
    backgroundColor: '#071022',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  drawerHandleBar: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(125, 211, 252, 0.45)',
    marginBottom: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(29, 78, 216, 0.6)',
  },
  drawerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  drawerCloseBtn: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  drawerCloseText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  drawerScroll: {
    marginTop: 8,
  },
  drawerScrollContent: {
    paddingBottom: 20,
  },
});
