import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Icon, ListItem, type BottomSheetHandle, type IconName } from '../../../components/ui';
import { haptics } from '../../../core/haptics';
import { t } from '../../../i18n';
import { space } from '../../../theme';

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** Optional second line (`bodySmall` `textSecondary`). */
  hint?: string;
};

export type ChoiceSheetRowProps<T extends string> = {
  icon: IconName;
  title: string;
  value: T;
  choices: ReadonlyArray<Choice<T>>;
  /**
   * Applied after the sheet has closed (shared-settings §5): a theme or language switch
   * re-renders the whole tree, which would otherwise cut the close animation short.
   */
  onChoose: (value: T) => void;
  testID: string;
};

/**
 * Account → Preferences value row with its picker sheet (shared-settings §5): one 64 row with the
 * current value and a chevron, a modal BottomSheet titled like the row with one radio row per
 * choice. Picking applies at once (selection haptic, the sheet closes, then `onChoose`); there is
 * no Save button. The sheet mounts on first open only.
 */
export function ChoiceSheetRow<T extends string>({ icon, title, value, choices, onChoose, testID }: ChoiceSheetRowProps<T>) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<BottomSheetHandle>(null);
  const chosen = useRef<T | null>(null);
  const current = choices.find((choice) => choice.value === value)?.label ?? '';

  const onClose = () => {
    setOpen(false);
    const next = chosen.current;
    chosen.current = null;
    if (next !== null && next !== value) onChoose(next);
  };

  return (
    <>
      <ListItem
        icon={icon}
        title={title}
        value={current}
        onPress={() => setOpen(true)}
        accessibilityLabel={`${title}, ${current}`}
        accessibilityHint={t('account.pickerHint')}
        testID={testID}
      />
      {open ? (
        <BottomSheet
          ref={sheetRef}
          mode="modal"
          visible
          onClose={onClose}
          accessibilityLabel={title}
          testID={`${testID}-sheet`}
          header={
            <AppText variant="h3" accessibilityRole="header" style={styles.sheetTitle}>
              {title}
            </AppText>
          }
        >
          <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.options}>
            {choices.map((choice) => {
              const selected = choice.value === value;
              return (
                <ListItem
                  key={choice.value}
                  title={choice.label}
                  subtitle={choice.hint}
                  chevron={false}
                  leading={<Icon name={selected ? 'radioOn' : 'radioOff'} color={selected ? 'primaryText' : 'textMuted'} />}
                  accessibilityLabel={choice.label}
                  selectionRole="radio"
                  checked={selected}
                  onPress={() => {
                    haptics.selection();
                    chosen.current = choice.value;
                    // Animates out, then onClose applies the choice.
                    sheetRef.current?.close();
                  }}
                  testID={`${testID}-option-${choice.value}`}
                />
              );
            })}
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { paddingHorizontal: space[4], paddingBottom: space[2] },
  options: { paddingBottom: space[4] },
});
