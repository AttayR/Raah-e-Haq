import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  onSubmit: (rating: number) => void;
  onClose: () => void;
}

const RatingModal: React.FC<Props> = ({ visible, onSubmit, onClose }) => {
  const [rating, setRating] = useState(5);
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Rate your ride</Text>
          <View style={styles.stars}>
            {[1,2,3,4,5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRating(n)}>
                <Text style={[styles.star, n <= rating && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.button} onPress={() => onSubmit(rating)}>
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '85%', backgroundColor: 'white', borderRadius: 12, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', marginVertical: 16 },
  star: { fontSize: 32, color: '#9CA3AF', marginHorizontal: 6 },
  starActive: { color: '#F59E0B' },
  button: { backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700' },
  cancel: { textAlign: 'center', marginTop: 12, color: '#6B7280' },
});

export default RatingModal;


