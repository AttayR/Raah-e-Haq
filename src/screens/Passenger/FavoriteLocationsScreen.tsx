import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, SafeAreaView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'src/assets/icons/index';
import { BrandColors } from 'src/theme/colors';

type FavoritePlace = {
  id: string;
  label: string;
  address: string;
  tag?: 'Home' | 'Work' | 'Other';
};

const initialData: FavoritePlace[] = [
  { id: 'home', label: 'Home', address: 'House 12, Street 7, Iqbal Town', tag: 'Home' },
  { id: 'work', label: 'Work', address: 'Office 3, Tech Park, Johar Town', tag: 'Work' },
];

const FavoriteLocationsScreen = () => {
  const navigation = useNavigation();
  const [favorites, setFavorites] = useState<FavoritePlace[]>(initialData);
  const [query, setQuery] = useState('');

  const onAdd = () => {
    if (!query.trim()) return;
    const newItem: FavoritePlace = {
      id: String(Date.now()),
      label: 'Custom',
      address: query.trim(),
      tag: 'Other',
    };
    setFavorites([newItem, ...favorites]);
    setQuery('');
  };

  const onRemove = (id: string) => {
    setFavorites(favorites.filter((f) => f.id !== id));
  };

  const renderItem = ({ item }: { item: FavoritePlace }) => (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name={item.tag === 'Home' ? 'home' : item.tag === 'Work' ? 'briefcase' : 'staro'} size={18} color={BrandColors.primary} type={'antDesignIcon'} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
        <TouchableOpacity onPress={() => onRemove(item.id)}>
          <Icon name="delete" size={18} color="#ef4444" type={'antDesignIcon'} />
        </TouchableOpacity>
      </View>
      <Text style={styles.address}>{item.address}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="edit" size={14} color="#111827" type={'antDesignIcon'} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]}>
          <Icon name="enviromento" size={14} color="#fff" type={'antDesignIcon'} />
          <Text style={[styles.actionText, { color: '#fff' }]}>Set Pickup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="left" size={20} color="#111827" type={'antDesignIcon'} />
        </TouchableOpacity>
        <Text style={styles.title}>Favorite Locations</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.searchBar}>
        <Icon name="search1" size={16} color="#6b7280" type={'antDesignIcon'} />
        <TextInput
          style={styles.input}
          placeholder="Add a place or search address"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#111827',
    paddingVertical: 6,
  },
  addBtn: {
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addText: {
    color: '#fff',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  address: {
    color: '#374151',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionText: {
    color: '#111827',
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: BrandColors.primary,
  },
});

export default FavoriteLocationsScreen;



