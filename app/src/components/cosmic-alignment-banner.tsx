import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polygon, Polyline } from 'react-native-svg';

interface CosmicAlignmentBannerProps {
  /** Active zodiac glyph from getAstrologicalConstellation (e.g. '♏'). */
  symbol: string;
  title?: string;
  /** Active signal telemetry subtitle. */
  subtitle?: string;
}

const BANNER_HEIGHT = 66;
const CHAMFER = 14;
const NEON = '#00F0FF';

function chamferPoints(w: number, h: number, inset: number, c: number): string {
  const l = inset;
  const t = inset;
  const r = w - inset;
  const b = h - inset;
  return [
    `${l + c},${t}`,
    `${r - c},${t}`,
    `${r},${t + c}`,
    `${r},${b - c}`,
    `${r - c},${b}`,
    `${l + c},${b}`,
    `${l},${b - c}`,
    `${l},${t + c}`,
  ].join(' ');
}

/**
 * Wide horizontal sci-fi HUD banner: double-layered chamfered neon frame, six angled tech
 * hash stripes in the top-right bezel, glowing zodiac emblem, and a telemetry waveform pulse.
 */
export function CosmicAlignmentBanner({
  symbol,
  title = "Tonight's Cosmic Alignment",
  subtitle,
}: CosmicAlignmentBannerProps) {
  const [width, setWidth] = useState(340);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };

  const hashStartX = width - 88;

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <Svg width={width} height={BANNER_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Soft outer bloom */}
        <Polygon
          points={chamferPoints(width, BANNER_HEIGHT, 1.5, CHAMFER)}
          fill="none"
          stroke={NEON}
          strokeWidth={5}
          opacity={0.12}
        />
        {/* Outer neon frame */}
        <Polygon
          points={chamferPoints(width, BANNER_HEIGHT, 1.5, CHAMFER)}
          fill="rgba(6, 22, 48, 0.72)"
          stroke="rgba(0, 240, 255, 0.55)"
          strokeWidth={1.5}
        />
        {/* Inner secondary frame */}
        <Polygon
          points={chamferPoints(width, BANNER_HEIGHT, 5, CHAMFER - 3)}
          fill="none"
          stroke="rgba(0, 240, 255, 0.28)"
          strokeWidth={1}
        />
        {/* Six angled tech hash stripes (//////) etched into the top-right bezel */}
        {Array.from({ length: 6 }).map((_, i) => {
          const x = hashStartX + i * 9;
          return (
            <Line
              key={`hash-${i}`}
              x1={x}
              y1={11}
              x2={x + 6}
              y2={3.5}
              stroke={NEON}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.9}
            />
          );
        })}
      </Svg>

      <View style={styles.content} pointerEvents="none">
        <View style={styles.emblem}>
          <Text style={styles.emblemSymbol}>{`${symbol}\uFE0E`}</Text>
        </View>

        <View style={styles.textColumn}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <Svg width={46} height={26} viewBox="0 0 46 26" style={styles.waveform}>
          <Polyline
            points="0,13 8,13 11,5 15,21 19,3 23,23 27,9 30,13 46,13"
            fill="none"
            stroke={NEON}
            strokeWidth={5}
            strokeLinejoin="round"
            opacity={0.22}
          />
          <Polyline
            points="0,13 8,13 11,5 15,21 19,3 23,23 27,9 30,13 46,13"
            fill="none"
            stroke={NEON}
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: BANNER_HEIGHT,
    marginHorizontal: 14,
    marginBottom: 12,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  emblem: {
    width: 42,
    height: 42,
    borderRadius: 11,
    borderWidth: 1.3,
    borderColor: NEON,
    backgroundColor: 'rgba(0, 160, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  emblemSymbol: {
    fontSize: 23,
    color: '#7DD3FC',
    fontWeight: '700',
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#7DD3FC',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginTop: 2,
    opacity: 0.85,
  },
  waveform: {
    marginRight: 2,
  },
});
