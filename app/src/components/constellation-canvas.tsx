import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { ZodiacConstellation } from '@/constants/constellations';

interface ConstellationCanvasProps {
  constellation: ZodiacConstellation;
  width: number;
  height: number;
  variant?: 'header' | 'loader';
  showLabels?: boolean;
}

const AMBIENT_STARS = [
  { x: 0.06, y: 0.18, s: 2 },
  { x: 0.12, y: 0.78, s: 1.5 },
  { x: 0.24, y: 0.14, s: 2.2 },
  { x: 0.31, y: 0.86, s: 1.8 },
  { x: 0.42, y: 0.19, s: 1.5 },
  { x: 0.58, y: 0.12, s: 2.4 },
  { x: 0.67, y: 0.88, s: 1.8 },
  { x: 0.79, y: 0.16, s: 2 },
  { x: 0.91, y: 0.28, s: 1.6 },
  { x: 0.94, y: 0.76, s: 2.2 },
  { x: 0.49, y: 0.68, s: 1.5 },
];

export function ConstellationCanvas({
  constellation,
  width,
  height,
  variant = 'header',
  showLabels = false,
}: ConstellationCanvasProps) {
  const pulseA = useRef(new Animated.Value(0.45)).current;
  const pulseB = useRef(new Animated.Value(0.95)).current;
  const lineGlow = useRef(new Animated.Value(0.4)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animA = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseA, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseA, {
          toValue: 0.4,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const animB = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseB, {
          toValue: 0.42,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseB, {
          toValue: 1,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const animLines = Animated.loop(
      Animated.sequence([
        Animated.timing(lineGlow, {
          toValue: variant === 'loader' ? 0.9 : 0.68,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lineGlow, {
          toValue: variant === 'loader' ? 0.35 : 0.26,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const animDrift = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animA.start();
    animB.start();
    animLines.start();
    animDrift.start();

    return () => {
      animA.stop();
      animB.stop();
      animLines.stop();
      animDrift.stop();
    };
  }, [drift, lineGlow, pulseA, pulseB, variant]);

  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-2.5, 2.5],
  });

  const lineThickness = variant === 'loader' ? 1.85 : 1.35;

  return (
    <View style={[styles.canvas, { width, height }]} pointerEvents="none">
      {/* Ambient Background Field Stars in Ice Blue & White */}
      {AMBIENT_STARS.map((star, idx) => {
        const animOpacity = idx % 2 === 0 ? pulseA : pulseB;
        return (
          <Animated.View
            key={`bg-star-${idx}`}
            style={{
              position: 'absolute',
              left: star.x * width,
              top: star.y * height,
              width: star.s,
              height: star.s,
              borderRadius: star.s / 2,
              backgroundColor: idx % 2 === 0 ? '#7DD3FC' : '#FFFFFF',
              opacity: Animated.multiply(animOpacity, variant === 'loader' ? 0.6 : 0.42),
            }}
          />
        );
      })}

      {/* Animated Constellation Group */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateY }],
          },
        ]}>
        {/* Ice Blue (#7DD3FC) Constellation Connecting Lines */}
        {constellation.edges.map(([fromIdx, toIdx], edgeIndex) => {
          const fromStar = constellation.stars[fromIdx];
          const toStar = constellation.stars[toIdx];
          if (!fromStar || !toStar) return null;

          const x1 = fromStar.x * width;
          const y1 = fromStar.y * height;
          const x2 = toStar.x * width;
          const y2 = toStar.y * height;

          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.hypot(dx, dy);
          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          return (
            <Animated.View
              key={`edge-${edgeIndex}`}
              style={{
                position: 'absolute',
                left: midX - length / 2,
                top: midY - lineThickness / 2,
                width: length,
                height: lineThickness,
                borderRadius: lineThickness,
                backgroundColor: '#7DD3FC',
                opacity: lineGlow,
                transform: [{ rotate: `${angleDeg}deg` }],
              }}
            />
          );
        })}

        {/* Glowing Cyan & Crisp White Star Nodes */}
        {constellation.stars.map((star, idx) => {
          const cx = star.x * width;
          const cy = star.y * height;
          const baseSize = (star.size ?? 4) * (variant === 'loader' ? 1.25 : 1);
          const haloSize = baseSize * (star.isAlpha ? 3.9 : 2.7);
          const starPulse = idx % 2 === 0 ? pulseA : pulseB;

          return (
            <View
              key={`star-${idx}`}
              style={{
                position: 'absolute',
                left: cx - haloSize / 2,
                top: cy - haloSize / 2,
                width: haloSize,
                height: haloSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {/* Outer Electric Cyan Halo */}
              <Animated.View
                style={{
                  position: 'absolute',
                  width: haloSize,
                  height: haloSize,
                  borderRadius: haloSize / 2,
                  backgroundColor: star.isAlpha ? '#38BDF8' : '#7DD3FC',
                  opacity: Animated.multiply(starPulse, star.isAlpha ? 0.42 : 0.28),
                  transform: [{ scale: starPulse }],
                }}
              />

              {/* Alpha Star Cyan-White Diffraction Spikes */}
              {star.isAlpha ? (
                <>
                  <Animated.View
                    style={{
                      position: 'absolute',
                      width: haloSize * 1.18,
                      height: 1.3,
                      backgroundColor: '#7DD3FC',
                      opacity: starPulse,
                    }}
                  />
                  <Animated.View
                    style={{
                      position: 'absolute',
                      width: 1.3,
                      height: haloSize * 1.18,
                      backgroundColor: '#7DD3FC',
                      opacity: starPulse,
                    }}
                  />
                </>
              ) : null}

              {/* Bright White / Cyan Star Core */}
              <Animated.View
                style={{
                  width: baseSize,
                  height: baseSize,
                  borderRadius: baseSize / 2,
                  backgroundColor: '#FFFFFF',
                  borderWidth: star.isAlpha ? 1 : 0,
                  borderColor: '#38BDF8',
                  opacity: starPulse,
                }}
              />

              {/* Star Astronomical Label */}
              {(showLabels && star.label) || (variant === 'header' && star.isAlpha && star.label) ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.starLabel,
                    star.isAlpha && styles.alphaStarLabel,
                    { top: haloSize * 0.78 },
                  ]}>
                  {star.label}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    overflow: 'hidden',
  },
  starLabel: {
    position: 'absolute',
    fontSize: 8.5,
    letterSpacing: 0.7,
    color: '#93C5FD',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  alphaStarLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
