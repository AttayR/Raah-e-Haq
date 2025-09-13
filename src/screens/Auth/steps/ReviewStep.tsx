import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  Dimensions,
  Image,
  TouchableOpacity,
} from 'react-native';
import { BrandColors } from '../../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;

interface ReviewData {
  // Personal Info
  fullName: string;
  email: string;
  cnic: string;
  address: string;
  phoneNumber: string;
  
  // Vehicle Info (for drivers)
  vehicleType: string;
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  
  // Documents
  driverPicture: string;
  cnicPicture: string;
  vehiclePictures: string[];
  
  // Role
  role: 'driver' | 'passenger';
}

interface ReviewStepProps {
  data: ReviewData;
  onDataChange: (data: Partial<ReviewData>) => void;
}

const vehicleTypeLabels: Record<string, string> = {
  car: 'Car',
  bike: 'Bike',
  van: 'Van',
  truck: 'Truck',
};

export default function ReviewStep({ data }: ReviewStepProps) {
  // Safety check for undefined data
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Loading...</Text>
      </View>
    );
  }

  const renderPersonalInfo = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name="person" size={20} color={BrandColors.primary} />
        <Text style={styles.sectionTitle}>Personal Information</Text>
      </View>
      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Full Name</Text>
          <Text style={styles.infoValue}>{data.fullName || 'Not provided'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{data.email || 'Not provided'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Phone Number</Text>
          <Text style={styles.infoValue}>{data.phoneNumber || 'Not provided'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>CNIC</Text>
          <Text style={styles.infoValue}>{data.cnic || 'Not provided'}</Text>
        </View>
        <View style={styles.infoItemFull}>
          <Text style={styles.infoLabel}>Address</Text>
          <Text style={styles.infoValue}>{data.address || 'Not provided'}</Text>
        </View>
      </View>
    </View>
  );

  const renderVehicleInfo = () => {
    if (data.role === 'passenger') return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="local-taxi" size={20} color={BrandColors.primary} />
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
        </View>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Vehicle Type</Text>
            <Text style={styles.infoValue}>
              {vehicleTypeLabels[data.vehicleType || ''] || data.vehicleType || 'Not provided'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Registration Number</Text>
            <Text style={styles.infoValue}>{data.vehicleNumber || 'Not provided'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Brand</Text>
            <Text style={styles.infoValue}>{data.vehicleBrand || 'Not provided'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Model</Text>
            <Text style={styles.infoValue}>{data.vehicleModel || 'Not provided'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Year</Text>
            <Text style={styles.infoValue}>{data.vehicleYear || 'Not provided'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Color</Text>
            <Text style={styles.infoValue}>{data.vehicleColor || 'Not provided'}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDocuments = () => {
    if (data.role === 'passenger') return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="description" size={20} color={BrandColors.primary} />
          <Text style={styles.sectionTitle}>Documents</Text>
        </View>
        <View style={styles.documentsGrid}>
          <View style={styles.documentItem}>
            <Text style={styles.documentLabel}>Driver Picture</Text>
            <View style={styles.documentPreview}>
              {data.driverPicture ? (
                <Image source={{ uri: data.driverPicture }} style={styles.documentImage} />
              ) : (
                <View style={styles.documentPlaceholder}>
                  <Icon name="person" size={24} color="#9ca3af" />
                </View>
              )}
              <View style={styles.documentStatus}>
                <Icon 
                  name={data.driverPicture ? 'check-circle' : 'error'} 
                  size={16} 
                  color={data.driverPicture ? '#10b981' : '#ef4444'} 
                />
              </View>
            </View>
          </View>

          <View style={styles.documentItem}>
            <Text style={styles.documentLabel}>CNIC Picture</Text>
            <View style={styles.documentPreview}>
              {data.cnicPicture ? (
                <Image source={{ uri: data.cnicPicture }} style={styles.documentImage} />
              ) : (
                <View style={styles.documentPlaceholder}>
                  <Icon name="credit-card" size={24} color="#9ca3af" />
                </View>
              )}
              <View style={styles.documentStatus}>
                <Icon 
                  name={data.cnicPicture ? 'check-circle' : 'error'} 
                  size={16} 
                  color={data.cnicPicture ? '#10b981' : '#ef4444'} 
                />
              </View>
            </View>
          </View>

          <View style={styles.documentItemFull}>
            <Text style={styles.documentLabel}>Vehicle Pictures</Text>
            <View style={styles.vehiclePicturesPreview}>
              {(data.vehiclePictures || []).length > 0 ? (
                <View style={styles.vehiclePicturesGrid}>
                  {(data.vehiclePictures || []).slice(0, 4).map((uri, index) => (
                    <Image key={index} source={{ uri }} style={styles.vehiclePicturePreview} />
                  ))}
                  {(data.vehiclePictures || []).length > 4 && (
                    <View style={styles.morePicturesIndicator}>
                      <Text style={styles.morePicturesText}>+{(data.vehiclePictures || []).length - 4}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.noPicturesPlaceholder}>
                  <Icon name="local-taxi" size={24} color="#9ca3af" />
                  <Text style={styles.noPicturesText}>No pictures uploaded</Text>
                </View>
              )}
              <View style={styles.documentStatus}>
                <Icon 
                  name={(data.vehiclePictures || []).length >= 4 ? 'check-circle' : 'error'} 
                  size={16} 
                  color={(data.vehiclePictures || []).length >= 4 ? '#10b981' : '#ef4444'} 
                />
              </View>
            </View>
            <Text style={styles.vehiclePicturesCount}>
              {(data.vehiclePictures || []).length}/6 pictures uploaded
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderAccountType = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name="account-circle" size={20} color={BrandColors.primary} />
        <Text style={styles.sectionTitle}>Account Type</Text>
      </View>
      <View style={styles.accountTypeCard}>
        <Icon 
          name={data.role === 'driver' ? 'local-taxi' : 'person'} 
          size={32} 
          color={BrandColors.primary} 
        />
        <View style={styles.accountTypeInfo}>
          <Text style={styles.accountTypeTitle}>
            {data.role === 'driver' ? 'Driver Account' : 'Passenger Account'}
          </Text>
          <Text style={styles.accountTypeDescription}>
            {data.role === 'driver' 
              ? 'You can provide rides and earn money' 
              : 'You can book rides and travel safely'
            }
          </Text>
        </View>
      </View>
    </View>
  );

  const getCompletionStatus = () => {
    const requiredFields = [
      data.fullName || '',
      data.email || '',
      data.cnic || '',
      data.address || '',
      data.phoneNumber || '',
    ];

    if (data.role === 'driver') {
      requiredFields.push(
        data.vehicleType || '',
        data.vehicleNumber || '',
        data.vehicleBrand || '',
        data.vehicleModel || '',
        data.vehicleYear || '',
        data.vehicleColor || '',
        data.driverPicture || '',
        data.cnicPicture || ''
      );
    }

    const completedFields = requiredFields.filter(field => field && field.trim()).length;
    const totalFields = requiredFields.length;
    const percentage = (completedFields / totalFields) * 100;

    return {
      completed: completedFields,
      total: totalFields,
      percentage: Math.round(percentage),
      isComplete: percentage === 100
    };
  };

  const completionStatus = getCompletionStatus();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Completion Status */}
      <View style={styles.completionCard}>
        <View style={styles.completionHeader}>
          <Icon 
            name={completionStatus.isComplete ? 'check-circle' : 'hourglass-empty'} 
            size={24} 
            color={completionStatus.isComplete ? '#10b981' : '#f59e0b'} 
          />
          <Text style={styles.completionTitle}>
            {completionStatus.isComplete ? 'Ready to Create Account' : 'Almost Complete'}
          </Text>
        </View>
        <Text style={styles.completionSubtitle}>
          {completionStatus.isComplete 
            ? 'All required information has been provided. You can now create your account.'
            : `${completionStatus.completed} of ${completionStatus.total} required fields completed (${completionStatus.percentage}%)`
          }
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${completionStatus.percentage}%`,
                backgroundColor: completionStatus.isComplete ? '#10b981' : BrandColors.primary
              }
            ]} 
          />
        </View>
      </View>

      {/* Review Sections */}
      {renderAccountType()}
      {renderPersonalInfo()}
      {renderVehicleInfo()}
      {renderDocuments()}

      {/* Terms and Conditions */}
      <View style={styles.termsCard}>
        <View style={styles.termsHeader}>
          <Icon name="info" size={20} color="#6b7280" />
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
        </View>
        <Text style={styles.termsText}>
          By creating an account, you agree to our Terms of Service and Privacy Policy. 
          Your information will be used to verify your identity and provide our services.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  completionCard: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 20 : 25,
    padding: isSmallScreen ? 20 : 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  completionTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  completionSubtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: isSmallScreen ? 20 : 25,
    padding: isSmallScreen ? 20 : 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoItemFull: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#1f2937',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  accountTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  accountTypeInfo: {
    flex: 1,
  },
  accountTypeTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  accountTypeDescription: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#6b7280',
  },
  documentsGrid: {
    gap: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  documentItemFull: {
    gap: 8,
  },
  documentLabel: {
    fontSize: isSmallScreen ? 14 : 16,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  documentPreview: {
    position: 'relative',
  },
  documentImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  documentPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentStatus: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 2,
  },
  vehiclePicturesPreview: {
    position: 'relative',
  },
  vehiclePicturesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  vehiclePicturePreview: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  morePicturesIndicator: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePicturesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  noPicturesPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  noPicturesText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  vehiclePicturesCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
  termsCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: isSmallScreen ? 16 : 20,
    padding: isSmallScreen ? 16 : 20,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.primary,
    marginBottom: 20,
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  termsTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  termsText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
