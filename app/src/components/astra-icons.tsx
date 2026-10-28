import React from 'react';
import { StyleSheet, View } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
  active?: boolean;
}

/**
 * Crisp geometric Bookmark Icon for 'Remind me' & 'Saved Bookmarks'
 */
export function BookmarkIcon({ size = 18, color = '#FFFFFF', active = false }: IconProps) {
  const w = Math.round(size * 0.72);
  const h = size;
  const notchSize = Math.max(4, Math.round(w * 0.44));

  return (
    <View style={[styles.iconBox, { width: size, height: size }]}>
      <View
        style={{
          width: w,
          height: h,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderWidth: 1.75,
          borderColor: color,
          backgroundColor: active ? color : 'transparent',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}>
        {/* V-notch cutout at the bottom of the bookmark */}
        <View
          style={{
            width: notchSize,
            height: notchSize,
            backgroundColor: '#050B18',
            borderTopWidth: active ? 0 : 1.75,
            borderLeftWidth: active ? 0 : 1.75,
            borderColor: color,
            transform: [{ translateY: notchSize * 0.52 }, { rotate: '45deg' }],
          }}
        />
      </View>
    </View>
  );
}

/**
 * Broadcast / Send to Orbit Icon (planet core + tilted orbital ring + satellite node)
 */
export function OrbitBroadcastIcon({ size = 18, color = '#FFFFFF' }: IconProps) {
  const coreSize = Math.max(5, Math.round(size * 0.32));
  const ringWidth = size;
  const ringHeight = Math.max(7, Math.round(size * 0.48));
  const satSize = Math.max(3.5, Math.round(size * 0.2));

  return (
    <View style={[styles.iconBox, { width: size + 2, height: size + 2 }]}>
      {/* Tilted orbital ellipse */}
      <View
        style={{
          position: 'absolute',
          width: ringWidth,
          height: ringHeight,
          borderRadius: ringWidth,
          borderWidth: 1.5,
          borderColor: color,
          transform: [{ rotate: '-28deg' }],
        }}
      />
      {/* Broadcast wave node */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: satSize,
          height: satSize,
          borderRadius: satSize / 2,
          backgroundColor: '#38BDF8',
        }}
      />
      {/* Central star core */}
      <View
        style={{
          width: coreSize,
          height: coreSize,
          borderRadius: coreSize / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/**
 * Live Feed Icon (Four-point star / pulse constellation grid)
 */
export function LiveFeedIcon({ size = 20, color = '#FFFFFF', active = false }: IconProps) {
  const dot = Math.max(4, Math.round(size * 0.24));
  return (
    <View style={[styles.iconBox, { width: size, height: size }]}>
      {/* Outer pulse ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: active ? 1.8 : 1.4,
          borderColor: color,
          opacity: active ? 0.95 : 0.65,
        }}
      />
      {/* Vertical star ray */}
      <View
        style={{
          position: 'absolute',
          width: 2,
          height: size * 0.68,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
      {/* Horizontal star ray */}
      <View
        style={{
          position: 'absolute',
          width: size * 0.68,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
      {/* Center glowing core */}
      <View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: active ? '#38BDF8' : color,
        }}
      />
    </View>
  );
}

/**
 * Map View Icon (Compass / Location Pin on Radar)
 */
export function MapRadarIcon({ size = 20, color = '#FFFFFF', active = false }: IconProps) {
  const pinSize = Math.round(size * 0.72);
  const innerDot = Math.max(4, Math.round(size * 0.24));

  return (
    <View style={[styles.iconBox, { width: size, height: size }]}>
      <View
        style={{
          width: pinSize,
          height: pinSize,
          borderTopLeftRadius: pinSize / 2,
          borderTopRightRadius: pinSize / 2,
          borderBottomLeftRadius: pinSize / 2,
          borderBottomRightRadius: 2,
          borderWidth: 1.75,
          borderColor: color,
          backgroundColor: active ? 'rgba(14, 165, 233, 0.25)' : 'transparent',
          transform: [{ translateY: -1 }, { rotate: '45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: innerDot,
            height: innerDot,
            borderRadius: innerDot / 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
