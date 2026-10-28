import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { CompassIcon, MapRadarIcon, RibbonIcon } from '@/components/astra-icons';

export type AstraTabKey = 'feed' | 'map' | 'bookmarks';

interface BottomTabBarProps {
  activeTab: AstraTabKey;
  onSelectTab: (tab: AstraTabKey) => void;
  savedCount?: number;
}

const NEON = '#00F0FF';
const DOCK_HEIGHT = 80;
const ORB_SIZE = 56;
const ORB_RISE = 18;
const NOTCH_RADIUS = ORB_SIZE / 2 + 6;
const ORB_CENTER_Y = ORB_SIZE / 2 - ORB_RISE; // orb center relative to the dock's top edge
const CORNER = 24;

/**
 * Builds the dock silhouette: rounded top corners (24px) with a circular notch that cradles
 * the raised center orb. `closed` adds the side/bottom edges so it can be used as the fill.
 */
function buildDockPath(w: number, h: number, closed: boolean): string {
  const cx = w / 2;
  const R = NOTCH_RADIUS;
  const lead = 18;
  const top =
    `M0,${CORNER} Q0,0 ${CORNER},0 L${cx - R - lead},0 ` +
    `C${cx - R - 6},0 ${cx - R},${ORB_CENTER_Y * 0.3} ${cx - R},${ORB_CENTER_Y} ` +
    `A${R},${R} 0 0 0 ${cx + R},${ORB_CENTER_Y} ` +
    `C${cx + R},${ORB_CENTER_Y * 0.3} ${cx + R + 6},0 ${cx + R + lead},0 ` +
    `L${w - CORNER},0 Q${w},0 ${w},${CORNER}`;
  return closed ? `${top} L${w},${h} L0,${h} Z` : top;
}

interface DockTabProps {
  label: string;
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

function DockTab({ label, active, onPress, children }: DockTabProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}>
      {children}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomTabBar({ activeTab, onSelectTab, savedCount = 0 }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const mapActive = activeTab === 'map';

  return (
    <View style={styles.outerBar} pointerEvents="box-none">
      <View style={[styles.dock, { height: DOCK_HEIGHT }]}>
        {/* Smoked-glass dock silhouette with glowing #00F0FF top rim */}
        <Svg width={width} height={DOCK_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={buildDockPath(width, DOCK_HEIGHT, true)} fill="rgba(6, 14, 30, 0.94)" />
          <Path
            d={buildDockPath(width, DOCK_HEIGHT, false)}
            fill="none"
            stroke={NEON}
            strokeWidth={6}
            opacity={0.14}
          />
          <Path d={buildDockPath(width, DOCK_HEIGHT, false)} fill="none" stroke={NEON} strokeWidth={1.5} />
        </Svg>

        <View style={styles.tabRow}>
          {/* Left: Live Feed */}
          <DockTab label="Live Feed" active={activeTab === 'feed'} onPress={() => onSelectTab('feed')}>
            <CompassIcon size={25} color={NEON} active={activeTab === 'feed'} />
          </DockTab>

          {/* Center: spacer reserved for the raised orb + its label */}
          <Pressable
            onPress={() => onSelectTab('map')}
            accessibilityRole="tab"
            accessibilityState={{ selected: mapActive }}
            accessibilityLabel="Map View"
            style={styles.centerSlot}>
            <Text style={[styles.tabLabel, styles.centerLabel, mapActive && styles.tabLabelActive]}>
              Map View
            </Text>
          </Pressable>

          {/* Right: Saved Bookmarks */}
          <DockTab
            label="Saved Bookmarks"
            active={activeTab === 'bookmarks'}
            onPress={() => onSelectTab('bookmarks')}>
            <View style={styles.iconWithBadge}>
              <RibbonIcon size={25} color={NEON} active={activeTab === 'bookmarks' || savedCount > 0} />
              {savedCount > 0 ? <View style={styles.badgeDot} /> : null}
            </View>
          </DockTab>
        </View>
      </View>

      {/* Raised center orb: 56x56, rising 18px above the dock's top edge */}
      <Pressable
        onPress={() => onSelectTab('map')}
        accessibilityRole="button"
        accessibilityLabel="Open Map View"
        style={({ pressed }) => [
          styles.orbWrapper,
          { left: width / 2 - ORB_SIZE / 2 },
          pressed && styles.tabItemPressed,
        ]}>
        <View style={[styles.orbHalo, mapActive && styles.orbHaloActive]} />
        <Svg width={ORB_SIZE} height={ORB_SIZE} style={styles.orbSvg}>
          <Defs>
            <SvgLinearGradient id="orbCore" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#00F0FF" />
              <Stop offset="1" stopColor="#0284C7" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={ORB_SIZE / 2} cy={ORB_SIZE / 2} r={ORB_SIZE / 2 - 0.75} fill="url(#orbCore)" />
          <Circle
            cx={ORB_SIZE / 2}
            cy={ORB_SIZE / 2}
            r={ORB_SIZE / 2 - 3}
            fill="none"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth={1}
          />
        </Svg>
        <View style={styles.orbGlyph} pointerEvents="none">
          <MapRadarIcon size={22} color="#04122A" active />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerBar: {
    position: 'relative',
    paddingTop: ORB_RISE,
    backgroundColor: 'transparent',
    zIndex: 30,
    overflow: 'visible',
  },
  dock: {
    position: 'relative',
    borderTopLeftRadius: CORNER,
    borderTopRightRadius: CORNER,
    backgroundColor: 'transparent',
    shadowColor: NEON,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
    paddingVertical: 2,
  },
  tabItemPressed: {
    opacity: 0.8,
  },
  centerSlot: {
    width: NOTCH_RADIUS * 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 34,
  },
  centerLabel: {
    marginTop: 0,
  },
  tabLabel: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    opacity: 0.75,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
    opacity: 1,
    textShadowColor: NEON,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  iconWithBadge: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: NEON,
    borderWidth: 1.5,
    borderColor: '#050A14',
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },
  orbWrapper: {
    position: 'absolute',
    top: 0,
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  orbHalo: {
    position: 'absolute',
    width: ORB_SIZE + 22,
    height: ORB_SIZE + 22,
    borderRadius: (ORB_SIZE + 22) / 2,
    backgroundColor: 'rgba(0, 240, 255, 0.16)',
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  orbHaloActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.28)',
    shadowOpacity: 1,
    shadowRadius: 22,
  },
  orbSvg: {
    position: 'absolute',
  },
  orbGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
