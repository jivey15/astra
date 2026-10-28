import { createClient } from '@supabase/supabase-js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookmarkIcon, MapRadarIcon } from '@/components/astra-icons';
import { EventItem, formatEventDate } from '@/components/event-card';

const SUPABASE_URL = 'https://pvdzgmglfcmdysyorjhf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-zw9isL2SkCT7r9O0fUwYA_SfmPynKp';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function isMapEventExpired(dateString?: string | null): boolean {
  if (!dateString) return false;
  const trimmed = String(dateString).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return false;

  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0);
  if (now.getHours() < 4) {
    cutoff.setDate(cutoff.getDate() - 1);
  }

  return parsed < cutoff;
}

interface MapViewPlaceholderProps {
  events: EventItem[];
  remindedIds: (string | number)[];
  onToggleRemind: (id: string | number) => void;
  onJumpToFeed: () => void;
}

interface VenuePin {
  id: string;
  venueName: string;
  neighborhood: string;
  coordsLabel: string;
  x: number; // 0..1
  y: number; // 0..1
  color: string;
  event?: EventItem;
}

const DEFAULT_MSP_VENUES: Omit<VenuePin, 'event'>[] = [
  {
    id: 'saloon',
    venueName: 'The Saloon MN',
    neighborhood: 'Hennepin Ave • Downtown',
    coordsLabel: '44.9762° N, 93.2760° W',
    x: 0.42,
    y: 0.38,
    color: '#38BDF8',
  },
  {
    id: 'eagle',
    venueName: 'EagleBoltBar',
    neighborhood: 'Washington Ave • Downtown East',
    coordsLabel: '44.9740° N, 93.2594° W',
    x: 0.66,
    y: 0.52,
    color: '#0EA5E9',
  },
  {
    id: 'lush',
    venueName: 'LUSH Lounge & Theater',
    neighborhood: 'Central Ave • NE Arts District',
    coordsLabel: '44.9903° N, 93.2474° W',
    x: 0.58,
    y: 0.22,
    color: '#7DD3FC',
  },
  {
    id: 'loring',
    venueName: 'Loring Park Orbit Hub',
    neighborhood: 'Loring Park • Core Sector',
    coordsLabel: '44.9698° N, 93.2842° W',
    x: 0.26,
    y: 0.66,
    color: '#38BDF8',
  },
  {
    id: 'blackhart',
    venueName: 'Black Hart of St. Paul',
    neighborhood: 'University Ave • Midway',
    coordsLabel: '44.9558° N, 93.1592° W',
    x: 0.82,
    y: 0.74,
    color: '#7DD3FC',
  },
];

export function MapViewPlaceholder({
  events,
  remindedIds,
  onToggleRemind,
  onJumpToFeed,
}: MapViewPlaceholderProps) {
  const radarPulse = useRef(new Animated.Value(0)).current;
  const [fetchedApprovedEvents, setFetchedApprovedEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchApprovedMapEvents() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('is_approved', true)
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
    const loop = Animated.loop(
      Animated.timing(radarPulse, {
        toValue: 1,
        duration: 3800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [radarPulse]);

  const approvedEvents = useMemo(() => {
    const sourceEvents = events && events.length > 0 ? events : fetchedApprovedEvents;
    return sourceEvents.filter(
      (ev) => ev.is_approved === true && !ev.isPast && !isMapEventExpired(ev.event_date)
    );
  }, [events, fetchedApprovedEvents]);

  const pins: VenuePin[] = useMemo(() => {
    const activePins = DEFAULT_MSP_VENUES.map((base, idx) => {
      const matchedEvent =
        approvedEvents.find((ev) =>
          (ev.venue_name || '').toLowerCase().includes(base.venueName.split(' ')[1]?.toLowerCase() || base.id)
        ) || approvedEvents[idx];
      return {
        ...base,
        event: matchedEvent,
      };
    }).filter((pin) => Boolean(pin.event && !pin.event.isPast));

    return activePins.length > 0
      ? activePins
      : DEFAULT_MSP_VENUES.map((base) => ({ ...base, event: undefined }));
  }, [approvedEvents]);

  const [selectedPinId, setSelectedPinId] = useState<string>(pins[0]?.id ?? 'saloon');
  const activePin = pins.find((p) => p.id === selectedPinId) || pins[0];
  const activeEvent = activePin?.event;
  const isReminded = activeEvent ? remindedIds.includes(activeEvent.id) : false;

  const pulseScale = radarPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1.45],
  });

  const pulseOpacity = radarPulse.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.55, 0.2, 0],
  });

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Top Status Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.badgeRow}>
          <MapRadarIcon size={16} color="#38BDF8" active />
          <Text style={styles.badgeText}>INTERACTIVE SPATIAL RADAR • PLACEHOLDER</Text>
        </View>
        <Text style={styles.title}>Minneapolis Nightlife Orbit</Text>
        <Text style={styles.subtitle}>
          Live geospatial telemetry for Loring Park, Hennepin Ave & Northeast venues. Tap any cyan beacon to inspect active signals.
        </Text>
      </View>

      {/* Stylized Dark-Mode Radar Map Canvas */}
      <View style={styles.mapFrame}>
        {/* Subtle Coordinate Grid Lines */}
        <View style={[styles.gridLineH, { top: '25%' }]} />
        <View style={[styles.gridLineH, { top: '50%' }]} />
        <View style={[styles.gridLineH, { top: '75%' }]} />
        <View style={[styles.gridLineV, { left: '25%' }]} />
        <View style={[styles.gridLineV, { left: '50%' }]} />
        <View style={[styles.gridLineV, { left: '75%' }]} />

        {/* Stylized Mississippi River Diagonal Channel */}
        <View style={styles.riverChannel} />

        {/* Concentric Cyan Radar Rings */}
        <View style={[styles.radarRing, { width: 110, height: 110, borderRadius: 55 }]} />
        <View style={[styles.radarRing, { width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.radarRing, { width: 290, height: 290, borderRadius: 145 }]} />

        {/* Animated Sweeping Radar Pulse */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.radarSweep,
            {
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />

        {/* District Labels */}
        <Text style={[styles.districtLabel, { top: 14, left: 16 }]}>NE ARTS SECTOR</Text>
        <Text style={[styles.districtLabel, { bottom: 14, left: 16 }]}>LORING PARK CORE</Text>
        <Text style={[styles.districtLabel, { top: 14, right: 16 }]}>MISSISSIPPI CORRIDOR</Text>
        <Text style={[styles.districtLabel, { bottom: 14, right: 16 }]}>44.9778° N • 93.2650° W</Text>

        {/* Interactive Venue Beacon Pins */}
        {pins.map((pin) => {
          const isSelected = pin.id === activePin?.id;
          return (
            <Pressable
              key={pin.id}
              onPress={() => setSelectedPinId(pin.id)}
              style={[
                styles.pinWrapper,
                {
                  left: `${pin.x * 100}%`,
                  top: `${pin.y * 100}%`,
                },
              ]}>
              <View
                style={[
                  styles.pinHalo,
                  {
                    backgroundColor: pin.color,
                    opacity: isSelected ? 0.42 : 0.18,
                    transform: [{ scale: isSelected ? 1.35 : 1 }],
                  },
                ]}
              />
              <View
                style={[
                  styles.pinCore,
                  {
                    backgroundColor: pin.color,
                    borderColor: isSelected ? '#FFFFFF' : '#050B18',
                  },
                ]}
              />
              <View style={[styles.pinLabelBubble, isSelected && styles.pinLabelBubbleActive]}>
                <Text
                  style={[styles.pinLabelText, isSelected && styles.pinLabelTextActive]}
                  numberOfLines={1}>
                  {pin.venueName}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Selected Venue / Signal HUD Inspector Card */}
      {activePin ? (
        <View style={styles.inspectorCard}>
          <View style={styles.inspectorHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inspectorCoords}>{activePin.coordsLabel}</Text>
              <Text style={styles.inspectorVenue}>{activePin.venueName}</Text>
              <Text style={styles.inspectorNeighborhood}>{activePin.neighborhood}</Text>
            </View>
            <View style={styles.beaconStatusPill}>
              <View style={styles.beaconDot} />
              <Text style={styles.beaconStatusText}>ACTIVE BEACON</Text>
            </View>
          </View>

          {activeEvent ? (
            <View style={styles.eventPreviewBox}>
              <Text style={styles.eventPreviewLabel}>NEXT TRANSMITTED SIGNAL</Text>
              <Text style={styles.eventPreviewTitle}>{activeEvent.title}</Text>
              <Text style={styles.eventPreviewDate}>
                {formatEventDate(activeEvent.event_date, activeEvent.start_time)}
              </Text>

              <View style={styles.inspectorActions}>
                <Pressable
                  onPress={() => onToggleRemind(activeEvent.id)}
                  style={[styles.smallRemindBtn, isReminded && styles.smallRemindBtnActive]}>
                  <BookmarkIcon
                    size={14}
                    color="#FFFFFF"
                    active={isReminded}
                  />
                  <Text style={styles.smallRemindText}>
                    {isReminded ? 'Saved ✓' : 'Remind me'}
                  </Text>
                </Pressable>

                <Pressable onPress={onJumpToFeed} style={styles.jumpFeedBtn}>
                  <Text style={styles.jumpFeedText}>Open in Live Feed →</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={onJumpToFeed} style={styles.jumpFeedBtnFull}>
              <Text style={styles.jumpFeedText}>Return to Live Feed →</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
    height: 310,
    backgroundColor: '#050B18',
    borderRadius: 22,
    borderWidth: 1.25,
    borderColor: '#38BDF8',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  riverChannel: {
    position: 'absolute',
    width: 480,
    height: 22,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    transform: [{ rotate: '32deg' }, { translateY: -18 }],
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.22)',
  },
  radarSweep: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  districtLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '700',
    color: '#93C5FD',
    opacity: 0.65,
    letterSpacing: 1,
  },
  pinWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -45 }, { translateY: -18 }],
    width: 90,
  },
  pinHalo: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  pinCore: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
  },
  pinLabelBubble: {
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 30, 56, 0.88)',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  pinLabelBubbleActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0EA5E9',
  },
  pinLabelText: {
    color: '#93C5FD',
    fontSize: 9.5,
    fontWeight: '700',
  },
  pinLabelTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  inspectorCard: {
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  inspectorCoords: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '700',
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
  beaconStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  beaconStatusText: {
    color: '#7DD3FC',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  eventPreviewBox: {
    backgroundColor: 'rgba(5, 11, 24, 0.78)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  eventPreviewLabel: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  eventPreviewTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  eventPreviewDate: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    marginBottom: 12,
  },
  inspectorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallRemindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  smallRemindBtnActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.28)',
    borderColor: '#7DD3FC',
  },
  smallRemindText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  jumpFeedBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(14, 30, 56, 0.85)',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  jumpFeedBtnFull: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(14, 30, 56, 0.85)',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  jumpFeedText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
  },
});
