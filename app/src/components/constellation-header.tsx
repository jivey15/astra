import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConstellationCanvas } from '@/components/constellation-canvas';
import { ZodiacConstellation } from '@/constants/constellations';

interface ConstellationHeaderProps {
  constellation: ZodiacConstellation;
  onCycleMonth?: () => void;
  isCurrentMonth?: boolean;
  eventCount?: number;
}

export function ConstellationHeader({
  constellation,
  onCycleMonth,
  isCurrentMonth = true,
  eventCount,
}: ConstellationHeaderProps) {
  const [headerWidth, setHeaderWidth] = useState(380);
  const headerHeight = 108;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - headerWidth) > 4) {
      setHeaderWidth(w);
    }
  };

  const constellationAreaWidth = Math.max(180, Math.round(headerWidth * 0.56));

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
          constellation={constellation}
          width={constellationAreaWidth}
          height={headerHeight}
          variant="header"
        />
      </View>

      {/* Foreground Brand & Cyan-Tinted HUD Badge */}
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
            {constellation.tagline}
          </Text>
        </View>

        {/* Cyan-Tinted HUD Zodiac Badge */}
        <Pressable
          onPress={onCycleMonth}
          accessibilityRole="button"
          accessibilityLabel={`Current zodiac constellation: ${constellation.name} for ${constellation.monthName}`}
          style={({ pressed }) => [
            styles.zodiacBadge,
            pressed && styles.zodiacBadgePressed,
          ]}>
          <View style={styles.zodiacTopRow}>
            <Text style={styles.zodiacSymbol}>{constellation.symbol}</Text>
            <Text style={styles.zodiacName}>{constellation.name.toUpperCase()}</Text>
          </View>
          <Text style={styles.zodiacMeta}>
            {constellation.monthName.slice(0, 3).toUpperCase()} • α {constellation.alphaStar}
          </Text>
          {!isCurrentMonth ? (
            <Text style={styles.previewHint}>TAP FOR NEXT • PREVIEW</Text>
          ) : typeof eventCount === 'number' ? (
            <Text style={styles.previewHint}>
              {eventCount} SIGNAL{eventCount === 1 ? '' : 'S'} LOCKED
            </Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'relative',
    minHeight: 108,
    backgroundColor: '#050B18',
    borderBottomWidth: 1,
    borderBottomColor: '#1D4ED8',
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
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
    backgroundColor: '#050B18',
  },
  gradientBandBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: '#0A1528',
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
    paddingVertical: 14,
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
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  zodiacBadgePressed: {
    opacity: 0.82,
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
  zodiacName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.1,
  },
  zodiacMeta: {
    fontSize: 10,
    color: '#7DD3FC',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  previewHint: {
    fontSize: 8.5,
    color: '#93C5FD',
    marginTop: 2,
    letterSpacing: 0.6,
    fontWeight: '700',
  },
});
