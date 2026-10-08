import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Typography } from '../../../theme/typography';
import type { AppTheme } from '../../../theme';
import { toast } from '../../../core/toast';
import { REJECTED_DOCUMENTS_COPY } from '../copy/accountStatus';
import { VEHICLE_UPLOAD_FIELDS, type RejectedItem, type UploadFile, type VehicleUploadField } from '../documentsApi';
import { pickUploadImage } from '../hooks/useRejectedDocuments';
import { ON_PRIMARY, RADIUS, SPACING } from './accountStatusStyles';

interface Props {
  item: RejectedItem;
  uploading: boolean;
  disabled: boolean;
  colors: AppTheme['colors'];
  onSubmit: (item: RejectedItem, files: Partial<Record<VehicleUploadField, UploadFile>>) => Promise<boolean>;
}

/**
 * A rejected vehicle. Collapsed to one "Choose new photos" button; opened, the driver picks a
 * new photo for each part that needs one, then sends them together (the first accepted upload
 * puts the vehicle back in review, so a second one would be refused with 409).
 */
export default function RejectedVehicleRow({ item, uploading, disabled, colors, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Partial<Record<VehicleUploadField, UploadFile>>>({});
  const picked = Object.keys(files).length;
  const canSubmit = picked > 0 && !disabled && !uploading;

  const pick = async (field: VehicleUploadField) => {
    const result = await pickUploadImage();
    if (!result) {
      return;
    }
    if ('problem' in result) {
      toast.error(result.problem);
      return;
    }
    setFiles(prev => ({ ...prev, [field]: result.file }));
  };

  const submit = async () => {
    if (await onSubmit(item, files)) {
      setFiles({});
      setOpen(false);
    }
  };

  const close = () => {
    setFiles({});
    setOpen(false);
  };

  if (!open) {
    return (
      <TouchableOpacity
        testID={`vehicle-${item.id}-open`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.outline, { borderColor: disabled ? colors.border : colors.accent }]}
      >
        <Icon name="add-a-photo" size={18} color={disabled ? colors.mutedText : colors.accent} />
        <Text style={[styles.outlineText, { color: disabled ? colors.mutedText : colors.accent }]}>
          {REJECTED_DOCUMENTS_COPY.choosePhotos}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.fields}>
      <Text style={[styles.hint, { color: colors.mutedText }]}>{REJECTED_DOCUMENTS_COPY.vehicleIntro}</Text>
      {VEHICLE_UPLOAD_FIELDS.map(field => {
        const chosen = !!files[field];
        return (
          <TouchableOpacity
            key={field}
            testID={`vehicle-${item.id}-${field}`}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen, disabled: disabled || uploading }}
            disabled={disabled || uploading}
            onPress={() => pick(field)}
            style={[styles.field, { borderColor: chosen ? colors.success : colors.border }]}
          >
            <Icon
              name={chosen ? 'check-circle' : 'add-a-photo'}
              size={18}
              color={chosen ? colors.success : colors.mutedText}
            />
            <Text style={[styles.fieldText, { color: colors.text }]}>
              {REJECTED_DOCUMENTS_COPY.vehicleFields[field]}
            </Text>
            {chosen ? (
              <Text style={[styles.chosen, { color: colors.text }]}>{REJECTED_DOCUMENTS_COPY.selected}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        testID={`vehicle-${item.id}-submit`}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy: uploading }}
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.submit, { backgroundColor: canSubmit || uploading ? colors.primary : colors.disabledFill }]}
      >
        {uploading ? <ActivityIndicator color={ON_PRIMARY} /> : null}
        <Text style={[styles.submitText, { color: canSubmit || uploading ? ON_PRIMARY : colors.disabledText }]}>
          {uploading ? REJECTED_DOCUMENTS_COPY.uploading : REJECTED_DOCUMENTS_COPY.sendForReview}
        </Text>
      </TouchableOpacity>
      {uploading ? null : (
        <TouchableOpacity testID={`vehicle-${item.id}-cancel`} accessibilityRole="button" onPress={close} style={styles.cancel}>
          <Text style={[styles.cancelText, { color: colors.accent }]}>{REJECTED_DOCUMENTS_COPY.cancel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outline: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  outlineText: {
    ...Typography.button,
  },
  fields: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  hint: {
    ...Typography.small,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  fieldText: {
    ...Typography.subtitle,
    flex: 1,
  },
  chosen: {
    ...Typography.small,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  submitText: {
    ...Typography.button,
  },
  cancel: {
    alignSelf: 'center',
    paddingVertical: SPACING.xs,
  },
  cancelText: {
    ...Typography.subtitle,
    fontWeight: '700',
  },
});
