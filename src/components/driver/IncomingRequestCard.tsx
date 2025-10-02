import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandColors } from '../../theme/colors';
import { RideRequest } from '../../services/rideService';

type Props = {
  request: RideRequest;
  onAccept: () => void;
  onBid?: (amount: number) => void;
};

const IncomingRequestCard: React.FC<Props> = ({ request, onAccept, onBid }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>New Ride</Text>
      <Text style={styles.meta}>From: {request.pickup.address || `${request.pickup.latitude.toFixed(3)}, ${request.pickup.longitude.toFixed(3)}`}</Text>
      <Text style={styles.meta}>To: {request.destination.address || `${request.destination.latitude.toFixed(3)}, ${request.destination.longitude.toFixed(3)}`}</Text>
      <Text style={styles.meta}>Fare: PKR {request.fare}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btnPrimary} onPress={onAccept}>
          <Text style={styles.btnText}>Accept</Text>
        </TouchableOpacity>
        {onBid && (
          <TouchableOpacity style={styles.btnSecondary} onPress={() => onBid(Math.max(50, Math.round(request.fare * 0.9)))}>
            <Text style={styles.btnText}>Bid</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', padding: 12, borderRadius: 12, gap: 6, elevation: 3 },
  row: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: BrandColors.primary },
  meta: { fontSize: 13, color: '#374151' },
  btnPrimary: { flex: 1, backgroundColor: BrandColors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnSecondary: { flex: 1, backgroundColor: '#6b7280', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
});

export default IncomingRequestCard;


