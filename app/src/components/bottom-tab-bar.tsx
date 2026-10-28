import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookmarkIcon, LiveFeedIcon, MapRadarIcon } from '@/components/astra-icons';

export type AstraTabKey = 'feed' | 'map' | 'bookmarks';

interface BottomTabBarProps {
  activeTab: AstraTabKey;
  onSelectTab: (tab: AstraTabKey) => void;
  savedCount?: number;
}

export function BottomTabBar({
  activeTab,
  onSelectTab,
  savedCount = 0,
}: BottomTabBarProps) {
  return (
    <View style={styles.outerBar}>
      <View style={styles.tabBarPill}>
        {/* 1. Live Feed */}
        <Pressable
          onPress={() => onSelectTab('feed')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'feed' }}
          style={({ pressed }) => [
            styles.tabItem,
            activeTab === 'feed' && styles.tabItemActive,
            pressed && styles.tabItemPressed,
          ]}>
          <LiveFeedIcon
            size={18}
            color={activeTab === 'feed' ? '#FFFFFF' : '#93C5FD'}
            active={activeTab === 'feed'}
          />
          <Text style={[styles.tabLabel, activeTab === 'feed' && styles.tabLabelActive]}>
            Live Feed
          </Text>
          {activeTab === 'feed' ? <View style={styles.activeIndicator} /> : null}
        </Pressable>

        {/* 2. Map View */}
        <Pressable
          onPress={() => onSelectTab('map')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'map' }}
          style={({ pressed }) => [
            styles.tabItem,
            activeTab === 'map' && styles.tabItemActive,
            pressed && styles.tabItemPressed,
          ]}>
          <MapRadarIcon
            size={18}
            color={activeTab === 'map' ? '#FFFFFF' : '#93C5FD'}
            active={activeTab === 'map'}
          />
          <Text style={[styles.tabLabel, activeTab === 'map' && styles.tabLabelActive]}>
            Map View
          </Text>
          {activeTab === 'map' ? <View style={styles.activeIndicator} /> : null}
        </Pressable>

        {/* 3. Saved Bookmarks */}
        <Pressable
          onPress={() => onSelectTab('bookmarks')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'bookmarks' }}
          style={({ pressed }) => [
            styles.tabItem,
            activeTab === 'bookmarks' && styles.tabItemActive,
            pressed && styles.tabItemPressed,
          ]}>
          <View style={styles.iconWithBadge}>
            <BookmarkIcon
              size={17}
              color={activeTab === 'bookmarks' ? '#FFFFFF' : '#93C5FD'}
              active={activeTab === 'bookmarks' || savedCount > 0}
            />
            {savedCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{savedCount}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.tabLabel, activeTab === 'bookmarks' && styles.tabLabelActive]}>
            Saved Bookmarks
          </Text>
          {activeTab === 'bookmarks' ? <View style={styles.activeIndicator} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerBar: {
    backgroundColor: '#050B18',
    borderTopWidth: 1,
    borderTopColor: '#1D4ED8',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  tabBarPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14, 30, 56, 0.78)',
    borderRadius: 18,
    padding: 5,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    gap: 6,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 14,
    gap: 5,
  },
  tabItemActive: {
    backgroundColor: '#0EA5E9',
    borderWidth: 1,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  tabItemPressed: {
    opacity: 0.82,
  },
  iconWithBadge: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -13,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#050B18',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3.5,
  },
  badgeText: {
    color: '#7DD3FC',
    fontSize: 9.5,
    fontWeight: '800',
  },
  tabLabel: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  activeIndicator: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
