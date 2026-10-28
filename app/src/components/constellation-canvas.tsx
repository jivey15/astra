import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

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

/* ------------------------------------------------------------------ */
/* Full-screen fixed Cosmic Nebula backdrop with edge constellations   */
/* ------------------------------------------------------------------ */

interface BackdropCluster {
  /** Which outer edge of the viewport the cluster hugs. */
  side: 'left' | 'right';
  /** Vertical anchor as a fraction of viewport height. */
  y: number;
  /** Star offsets in px relative to the edge anchor (right-side offsets are negative). */
  points: [number, number][];
  edges: [number, number][];
}

const BACKDROP_CLUSTERS: BackdropCluster[] = [
  {
    side: 'left',
    y: 0.31,
    points: [
      [4, 0],
      [30, -26],
      [58, -12],
      [50, 24],
      [18, 36],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
    ],
  },
  {
    side: 'right',
    y: 0.22,
    points: [
      [-6, 0],
      [-34, 16],
      [-62, 4],
      [-74, 38],
      [-38, 50],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
    ],
  },
  {
    side: 'left',
    y: 0.74,
    points: [
      [6, 0],
      [44, -10],
      [86, -22],
      [112, -2],
      [102, 30],
      [64, 24],
      [46, -10],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 1],
    ],
  },
  {
    side: 'right',
    y: 0.58,
    points: [
      [-4, 0],
      [-30, -24],
      [-54, -8],
      [-46, 28],
      [-76, 44],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
    ],
  },
];

const BACKDROP_FIELD_STARS: [number, number, number][] = [
  [0.18, 0.06, 1],
  [0.44, 0.1, 1.2],
  [0.7, 0.05, 1],
  [0.88, 0.14, 1.3],
  [0.3, 0.22, 1],
  [0.56, 0.3, 1.1],
  [0.78, 0.4, 1],
  [0.22, 0.48, 1.2],
  [0.5, 0.55, 1],
  [0.84, 0.68, 1.2],
  [0.36, 0.7, 1],
  [0.62, 0.8, 1.3],
  [0.14, 0.9, 1],
  [0.74, 0.92, 1.1],
];

/**
 * Deep cosmic navy (#050A14) base + radial/linear nebula glows + glowing cyan constellation
 * clusters on the left/right outer edges. Rendered once behind the scrolling feed with
 * `pointerEvents="none"` so cards scroll over it and the constellations peek out from behind.
 */
export function CosmicBackdrop() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="nebulaPrimary" cx="0.3" cy="0.22" r="0.65">
            <Stop offset="0" stopColor="rgb(0,160,255)" stopOpacity={0.14} />
            <Stop offset="1" stopColor="rgb(0,160,255)" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="nebulaSecondary" cx="0.85" cy="0.78" r="0.6">
            <Stop offset="0" stopColor="rgb(56,189,248)" stopOpacity={0.08} />
            <Stop offset="1" stopColor="rgb(56,189,248)" stopOpacity={0} />
          </RadialGradient>
          <SvgLinearGradient id="nebulaLinear" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="rgb(5,10,20)" stopOpacity={0} />
            <Stop offset="1" stopColor="rgb(2,132,199)" stopOpacity={0.1} />
          </SvgLinearGradient>
          <RadialGradient id="starHalo" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="rgb(0,240,255)" stopOpacity={0.55} />
            <Stop offset="1" stopColor="rgb(0,240,255)" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width={width} height={height} fill="#050A14" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#nebulaPrimary)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#nebulaSecondary)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#nebulaLinear)" />

        {BACKDROP_FIELD_STARS.map(([fx, fy, r], idx) => (
          <Circle
            key={`field-${idx}`}
            cx={fx * width}
            cy={fy * height}
            r={r}
            fill={idx % 2 === 0 ? '#7DD3FC' : '#FFFFFF'}
            opacity={0.45}
          />
        ))}

        {BACKDROP_CLUSTERS.map((cluster, cIdx) => {
          const anchorX = cluster.side === 'left' ? 0 : width;
          const anchorY = cluster.y * height;
          const pts = cluster.points.map(([dx, dy]) => ({
            x: anchorX + dx,
            y: anchorY + dy,
          }));

          return (
            <React.Fragment key={`cluster-${cIdx}`}>
              {cluster.edges.map(([a, b], eIdx) => (
                <Line
                  key={`edge-${cIdx}-${eIdx}`}
                  x1={pts[a].x}
                  y1={pts[a].y}
                  x2={pts[b].x}
                  y2={pts[b].y}
                  stroke="rgba(0, 240, 255, 0.35)"
                  strokeWidth={0.8}
                />
              ))}
              {pts.map((p, sIdx) => (
                <React.Fragment key={`star-${cIdx}-${sIdx}`}>
                  <Circle cx={p.x} cy={p.y} r={8} fill="url(#starHalo)" />
                  <Circle cx={p.x} cy={p.y} r={3} fill="#00F0FF" />
                  <Circle cx={p.x} cy={p.y} r={1.2} fill="#FFFFFF" />
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
