import React from 'react';
import { Image, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { REGISTRATION_STEPS } from '../../features/auth/registration/registrationForm';
import { REGISTRATION_COPY as COPY } from '../../features/auth/copy/registration';
import { styles } from './RegistrationScreen.styles';

interface Props {
  title: string;
  subtitle: string;
  /** Index into REGISTRATION_STEPS; null hides the progress (the phone step). */
  stepIndex: number | null;
}

/** Brand header of the registration screen with the step progress (moved out in T-201). */
export default function RegistrationHeader({ title, subtitle, stepIndex }: Props) {
  return (
    <View style={styles.fixedHeader}>
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      <View style={styles.decorativeCircle3} />
      <View style={styles.decorativeCircle4} />
      <View style={styles.decorativeCircle5} />

      <View style={styles.logoContainer}>
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {stepIndex === null ? null : (
        <>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${((stepIndex + 1) / REGISTRATION_STEPS.length) * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{COPY.form.progress(stepIndex + 1, REGISTRATION_STEPS.length)}</Text>
          </View>

          <View style={styles.stepIndicators}>
            {REGISTRATION_STEPS.map((step, index) => {
              const isActive = index === stepIndex;
              const isCompleted = index < stepIndex;
              return (
                <View key={step.key} style={styles.stepIndicator}>
                  <View
                    style={[
                      styles.stepCircle,
                      isActive && styles.stepCircleActive,
                      isCompleted && styles.stepCircleCompleted,
                    ]}
                  >
                    <Icon
                      name={isCompleted ? 'check' : step.icon}
                      size={16}
                      color={isCompleted || isActive ? styles.stepIconActive.color : styles.stepIconIdle.color}
                    />
                  </View>
                  <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>{step.title}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
