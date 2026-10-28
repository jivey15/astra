import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { ConstellationCanvas } from '@/components/constellation-canvas';
import { ZodiacConstellation } from '@/constants/constellations';

interface ConstellationLoaderProps {
  constellation: ZodiacConstellation;
  selectedTag?: string;
}

export function ConstellationLoader({ constellation, selectedTag }: ConstellationLoaderProps) {
  const orbitRotation = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    const rotateAnim = Animated.loop(
      Animated.timing(orbitRotation, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1.06,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0.92,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    rotateAnim.start();
    pulseAnim.start();

    return () => {
      rotateAnim.stop();
      pulseAnim.stop();
    };
  }, [orbitRotation, ringPulse]);

  const spin = orbitRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const reverseSpin = orbitRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      {/* Astrolabe / Celestial Compass HUD Frame */}
      <View style={styles.celestialStage}>
        {/* Pulsing Electric Cyan Backdrop */}
        <Animated.View
          style={[
            styles.nebulaGlow,
            {
              transform: [{ scale: ringPulse }],
            },
          ]}
        />

        {/* Outer Rotating Orbital Ring with Cyan Nodes */}
        <Animated.View
          style={[
            styles.outerOrbitRing,
            {
              transform: [{ rotate: spin }],
            },
          ]}>
          <View style={[styles.orbitNode, styles.orbitNodeTop]} />
          <View style={[styles.orbitNode, styles.orbitNodeBottom]} />
        </Animated.View>

        {/* Inner Counter-Rotating HUD Ring */}
        <Animated.View
          style={[
            styles.innerOrbitRing,
            {
              transform: [{ rotate: reverseSpin }],
            },
          ]}
        />

        {/* Animated Zodiac Constellation Map */}
        <View style={styles.constellationFrame}>
          <ConstellationCanvas
            constellation={constellation}
            width={220}
            height={170}
            variant="loader"
            showLabels
          />
        </View>
      </View>

      {/* Cyan-Tinted HUD Constellation Identity Pill */}
      <View style={styles.signPill}>
        <Text style={styles.signSymbol}>{constellation.symbol}</Text>
        <Text style={styles.signPillText}>
          {constellation.monthName.toUpperCase()} SKY • {constellation.latinName.toUpperCase()}
        </Text>
      </View>

      <Text style={styles.loadingTitle}>Reading the stars...</Text>
      <Text style={styles.loadingSubtitle}>
        {selectedTag && selectedTag !== 'All'
          ? `Scanning ${selectedTag} frequencies across Minneapolis`
          : `Aligning ${constellation.name} (${constellation.alphaStar}) with Loring Orbit`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
    backgroundColor: '#050B18',
  },
  celestialStage: {
    width: 256,
    height: 256,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  nebulaGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#0EA5E9',
    opacity: 0.14,
  },
  outerOrbitRing: {
    position: 'absolute',
    width: 244,
    height: 244,
    borderRadius: 122,
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderStyle: 'dashed',
  },
  orbitNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  orbitNodeTop: {
    top: -4,
    left: '50%',
    marginLeft: -4,
  },
  orbitNodeBottom: {
    bottom: -4,
    left: '50%',
    marginLeft: -4,
    backgroundColor: '#7DD3FC',
  },
  innerOrbitRing: {
    position: 'absolute',
    width: 204,
    height: 204,
    borderRadius: 102,
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  constellationFrame: {
    width: 220,
    height: 170,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 30, 56, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  signPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0EA5E9',
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginBottom: 12,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  signSymbol: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  signPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#93C5FD',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
});
