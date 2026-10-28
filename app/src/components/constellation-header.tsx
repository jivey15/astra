import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConstellationCanvas } from '@/components/constellation-canvas';
import {
  getAstrologicalConstellation,
  getMonthAbbreviation,
  ZodiacConstellation,
} from '@/constants/constellations';

interface ConstellationHeaderProps {
  constellation?: ZodiacConstellation;
  onCycleMonth?: () => void;
  isCurrentMonth?: boolean;
  eventCount?: number;
  tonightOnly?: boolean;
  onToggleTonightOnly?: () => void;
}

export function ConstellationHeader({
  constellation,
  onCycleMonth,
  isCurrentMonth = true,
  eventCount = 0,
  tonightOnly = false,
  onToggleTonightOnly,
}: ConstellationHeaderProps) {
  const [headerWidth, setHeaderWidth] = useState(380);
  const headerHeight = 108;

  const liveConstellation = useMemo(
    () => (isCurrentMonth ? getAstrologicalConstellation(new Date()) : constellation) || getAstrologicalConstellation(new Date()),
    [constellation, isCurrentMonth]
  );

  const monthAbbr = useMemo(
    () =>
      isCurrentMonth
        ? getMonthAbbreviation(new Date())
        : liveConstellation.monthName.slice(0, 3).toUpperCase(),
    [isCurrentMonth, liveConstellation.monthName]
  );

  const bayerLabel =
    liveConstellation.bayerStar || `α ${liveConstellation.alphaStar}`;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - headerWidth) > 4) {
      setHeaderWidth(w);
    }
  };

  const constellationAreaWidth = Math.max(180, Math.round(headerWidth * 0.56));

  const handlePressTelemetry = () => {
    if (onToggleTonightOnly) {
      onToggleTonightOnly();
    } else if (onCycleMonth) {
      onCycleMonth();
    }
  };

  return (
    <View style={styles.headerContainer} onLayout={handleLayout}>
      {/* Deep Cosmic Navy Gradient Bands (#050B18 -> #0A1528) */}
      <View style={styles.gradientBandTop} pointerEvents="none" />
      <View style={styles.gradientBandBottom} pointerEvents="none" />

      {/* Electric Cyan Ambient Telemetry Glow */}
      <View style={styles.ambientOrb} pointerEvents="none" />

      {/* Animated Zodiac Constellation Sky Backdrop */}
      <View style={[styles.constellationWrapper, { width: constellationAreaWidth }]}>
        <ConstellationCanvas
          constellation={liveConstellation}
          width={constellationAreaWidth}
          height={headerHeight}
          variant="header"
        />
      </View>

      {/* Foreground Brand & Interactive Top-Right Telemetry Box */}
      <View style={styles.headerContent}>
        <View style={styles.brandColumn}>
          <View style={styles.logoRow}>
            <Text style={styles.logoStar}>✦</Text>
            <Text style={styles.logoText}>ASTRA</Text>
            <View style={styles.liveDotContainer}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>ORBIT LIVE</Text>
            </View>
          </View>

          <Text style={styles.subHeader}>📍 MINNEAPOLIS • LORING SECTOR</Text>
          <Text style={styles.taglineText} numberOfLines={1}>
            {liveConstellation.tagline}
          </Text>
        </View>

        {/* Interactive Top-Right Telemetry Box (Dynamic Zodiac + FULL ORBIT / TONIGHT'S ORBIT Toggle) */}
        <Pressable
          onPress={handlePressTelemetry}
          accessibilityRole="button"
          accessibilityState={{ selected: tonightOnly }}
          accessibilityLabel={`Telemetry orbit toggle: ${
            tonightOnly ? "Tonight's Orbit active" : 'Full Orbit active'
          }. Current sign ${liveConstellation.name}.`}
          style={({ pressed }) => [
            styles.zodiacBadge,
            tonightOnly && styles.zodiacBadgeTonightActive,
            pressed && styles.zodiacBadgePressed,
          ]}>
          <View style={styles.zodiacTopRow}>
            <Text style={[styles.zodiacSymbol, tonightOnly && styles.zodiacSymbolTonight]}>
              {liveConstellation.symbol}
            </Text>
            <Text style={styles.zodiacName}>{liveConstellation.name.toUpperCase()}</Text>
          </View>

          <Text style={styles.zodiacMeta}>
            {monthAbbr} • {bayerLabel}
          </Text>

          <Text style={[styles.signalsLockedText, tonightOnly && styles.signalsLockedTextTonight]}>
            {eventCount} SIGNAL{eventCount === 1 ? '' : 'S'} LOCKED
          </Text>

          <View style={[styles.orbitModePill, tonightOnly && styles.orbitModePillActive]}>
            <View style={[styles.orbitModeDot, tonightOnly && styles.orbitModeDotActive]} />
            <Text style={[styles.orbitModeText, tonightOnly && styles.orbitModeTextActive]}>
              {tonightOnly ? "TONIGHT'S ORBIT" : 'FULL ORBIT'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'relative',
    minHeight: 112,
    backgroundColor: 'rgba(5, 10, 20, 0.55)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 240, 255, 0.28)',
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  gradientBandTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
    backgroundColor: 'rgba(5, 10, 20, 0.35)',
  },
  gradientBandBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(0, 160, 255, 0.06)',
  },
  ambientOrb: {
    position: 'absolute',
    top: -45,
    right: 16,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0EA5E9',
    opacity: 0.12,
  },
  constellationWrapper: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.95,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  brandColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  logoStar: {
    fontSize: 20,
    color: '#38BDF8',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3.2,
  },
  liveDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    marginLeft: 4,
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38BDF8',
  },
  liveLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#7DD3FC',
    letterSpacing: 0.8,
  },
  subHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93C5FD',
    marginTop: 4,
    letterSpacing: 1.3,
  },
  taglineText: {
    fontSize: 11,
    color: '#7DD3FC',
    opacity: 0.78,
    marginTop: 3,
    fontStyle: 'italic',
  },
  zodiacBadge: {
    backgroundColor: 'rgba(8, 18, 38, 0.82)',
    borderWidth: 1.25,
    borderColor: 'rgba(0, 240, 255, 0.55)',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    alignItems: 'flex-end',
    justifyContent: 'center',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  zodiacBadgeTonightActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.24)',
    borderColor: '#00F0FF',
    borderWidth: 1.75,
    shadowColor: '#00F0FF',
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 8,
  },
  zodiacBadgePressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  zodiacTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  zodiacSymbol: {
    fontSize: 14,
    color: '#38BDF8',
  },
  zodiacSymbolTonight: {
    color: '#00F0FF',
  },
  zodiacName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.1,
  },
  zodiacMeta: {
    fontSize: 9.5,
    color: '#7DD3FC',
    fontWeight: '700',
    marginTop: 1.5,
    letterSpacing: 0.4,
  },
  signalsLockedText: {
    fontSize: 8.5,
    color: '#93C5FD',
    marginTop: 2,
    letterSpacing: 0.6,
    fontWeight: '800',
  },
  signalsLockedTextTonight: {
    color: '#FFFFFF',
  },
  orbitModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 11, 24, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  orbitModePillActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#00F0FF',
  },
  orbitModeDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: '#7DD3FC',
  },
  orbitModeDotActive: {
    backgroundColor: '#FFFFFF',
  },
  orbitModeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#7DD3FC',
    letterSpacing: 0.7,
  },
  orbitModeTextActive: {
    color: '#FFFFFF',
  },
});
