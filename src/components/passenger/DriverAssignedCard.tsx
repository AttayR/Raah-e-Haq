import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BrandColors } from '../../theme/colors';

type Props = {
  name?: string;
  vehicle?: string;
  eta?: string;
  onCall?: () => void;
  onMessage?: () => void;
};

const DriverAssignedCard: React.FC<Props> = ({ name = 'Driver', vehicle = 'Car', eta = '5 min', onCall, onMessage }) => {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}><Text style={{ color: 'white', fontWeight: '800' }}>{name.charAt(0)}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.sub}>{vehicle} • ETA {eta}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={onCall}><Text style={styles.btnText}>Call</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={onMessage}><Text style={styles.btnText}>Message</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 15, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', elevation: 2 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: BrandColors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '700', color: '#2d3748' },
  sub: { fontSize: 12, color: '#6b7280' },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnText: { fontWeight: '700', color: '#111827' },
});

export default DriverAssignedCard;


