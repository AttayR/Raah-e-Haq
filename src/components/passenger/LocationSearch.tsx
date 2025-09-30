import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { fetchAutocomplete, fetchPlaceDetails } from '../../services/placesService';

type Suggestion = { id: string; title: string; subtitle: string; icon: string; coords: { latitude: number; longitude: number } };

type Props = {
  mode: 'pickup' | 'destination';
  query: string;
  onChangeQuery: (q: string) => void;
  onSelect: (s: Suggestion) => void;
  readOnly?: boolean;
};

const LocationSearch: React.FC<Props> = ({ mode, query, onChangeQuery, onSelect, readOnly }) => {
  const [remote, setRemote] = useState<Suggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (readOnly || query.length < 2) { setRemote([]); return; }
      try {
        const results = await fetchAutocomplete(query);
        if (cancelled) return;
        const mapped: Suggestion[] = results.map((r) => ({
          id: r.place_id,
          title: r.structured_formatting?.main_text || r.description,
          subtitle: r.structured_formatting?.secondary_text || r.description,
          icon: '📍',
          coords: { latitude: 0, longitude: 0 },
        }));
        setRemote(mapped);
      } catch {
        setRemote([]);
      }
    })();
    return () => { cancelled = true; };
  }, [query, readOnly]);

  return (
    <View>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder={mode === 'pickup' ? '📍 Pickup location' : '🔍 Search destination...'}
          value={query}
          onChangeText={onChangeQuery}
          placeholderTextColor="#9CA3AF"
          editable={!readOnly}
        />
      </View>
      <View style={styles.suggestionList}>
        {remote.map((s, idx) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.suggestionItem, idx === 0 && styles.suggestionActive]}
            onPress={async () => {
              if (s.coords.latitude === 0) {
                const details = await fetchPlaceDetails(s.id);
                if (details) onSelect({ ...s, coords: { latitude: details.latitude, longitude: details.longitude } });
                return;
              }
              onSelect(s);
            }}
          >
            <View style={[styles.suggestionIcon, idx === 0 && styles.suggestionIconActive]}>
              <Text>{s.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionTitle}>{s.title}</Text>
              <Text style={styles.suggestionSubtitle}>{s.subtitle}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchBox: { backgroundColor: 'white', marginTop: 0, borderRadius: 12, elevation: 2, overflow: 'hidden' },
  input: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
  suggestionList: { marginTop: 8 },
  suggestionItem: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestionActive: { backgroundColor: '#f8f9ff' },
  suggestionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  suggestionIconActive: { backgroundColor: '#667eea' },
  suggestionTitle: { fontWeight: '600', color: '#2d3748' },
  suggestionSubtitle: { fontSize: 12, color: '#9CA3AF' },
});

export default LocationSearch;


