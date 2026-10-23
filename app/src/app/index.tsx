import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Connect to your live project-loring database
const SUPABASE_URL = 'https://pvdzgmglfcmdysyorjhf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-zw9isL2SkCT7r9O0fUwYA_SfmPynKp';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VIBE_FILTERS = ['All', 'Watch Party', 'Drag/Show', 'Circuit/DJ', 'Nightlife'];

interface EventItem {
  id: string | number;
  venue_name?: string;
  title?: string;
  event_date?: string;
  start_time?: string | null;
  short_summary?: string | null;
  flyer_image_url?: string | null;
  talent_names?: string[] | null;
  vibe_tags?: string[] | null;
}

export default function App() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState('All');

  useEffect(() => {
    fetchEvents(selectedTag);
  }, [selectedTag]);

  async function fetchEvents(tag: string) {
    setLoading(true);
    try {
      let query = supabase
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .order('event_date', { ascending: true });

      if (tag !== 'All') {
        query = query.contains('vibe_tags', [tag]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents((data as EventItem[]) || []);
    } catch (error: any) {
      console.error('Error fetching events:', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.logo}>✦ ASTRA</Text>
        <Text style={styles.subHeader}>📍 MINNEAPOLIS</Text>
      </View>

      {/* Interactive Vibe Filter Chips */}
      <View style={styles.filterBarContainer}>
        <FlatList
          data={VIBE_FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: tag }) => {
            const isSelected = selectedTag === tag;
            return (
              <Pressable
                onPress={() => setSelectedTag(tag)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {tag}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={styles.loadingText}>Reading the stars...</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.feed}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No events found for &ldquo;{selectedTag}&rdquo;.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Event Flyer Image - Fully Uncropped & Proportionate */}
              {item.flyer_image_url && item.flyer_image_url.startsWith('http') ? (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item.flyer_image_url }}
                    style={styles.cardImage}
                    resizeMode="contain"
                  />
                </View>
              ) : null}

              <View style={styles.cardHeader}>
                <Text style={styles.venueText}>{item.venue_name?.toUpperCase()}</Text>
                <Text style={styles.dateText}>
                  {item.event_date} {item.start_time ? `• ${item.start_time.slice(0, 5)}` : ''}
                </Text>
              </View>

              <Text style={styles.titleText}>{item.title}</Text>
              <Text style={styles.summaryText}>{item.short_summary}</Text>

              {/* Talent / Performers Lineup */}
              {item.talent_names && item.talent_names.length > 0 ? (
                <Text style={styles.talentText}>
                  🎧 Featuring: {item.talent_names.join(', ')}
                </Text>
              ) : null}

              <View style={styles.tagContainer}>
                {item.vibe_tags?.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.buttonRow}>
                <View style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>⭐️ Remind Me</Text>
                </View>
                <View style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Rally the Crew</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: 2,
  },
  subHeader: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    letterSpacing: 1,
  },
  filterBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#a855f7',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  feed: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageContainer: {
    width: '100%',
    backgroundColor: '#05070d',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: {
    width: '100%',
    maxHeight: 450,
    aspectRatio: 16 / 9,
    alignSelf: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  venueText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  dateText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  summaryText: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  talentText: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  tagText: {
    color: '#e9d5ff',
    fontSize: 11,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryButtonText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 13,
  },
});