import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { elevation, radius, typeScale } from '../../constants/designSystem';
import type { FitnessPalette } from '../../constants/fitnessPalette';
import { useFitnessPalette, useFitnessStyles } from '../../hooks/useFitnessPalette';

type DockSlot = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  soon?: boolean;
  onPress?: () => void;
};

type VeyronDockProps = {
  onHome?: () => void;
  /** Four slots around the center Home button: left pair, then right pair. */
  slots?: [DockSlot, DockSlot, DockSlot, DockSlot];
};

const LAUNCHER_SLOTS: [DockSlot, DockSlot, DockSlot, DockSlot] = [
  { label: 'Analytics', icon: 'stats-chart-outline', soon: true },
  { label: 'History', icon: 'time-outline', soon: true },
  { label: 'Smart', icon: 'sparkles-outline', soon: true },
  { label: 'Profile', icon: 'person-outline' },
];

export function VeyronDock({ onHome, slots = LAUNCHER_SLOTS }: VeyronDockProps) {
  const p = useFitnessPalette();
  const styles = useFitnessStyles(buildStyles);
  const [left, midLeft, midRight, right] = slots;

  return (
    <View style={styles.dock}>
      <DockButton {...left} />
      <DockButton {...midLeft} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Home"
        onPress={onHome}
        style={styles.fab}
      >
        <Ionicons color={p.onLime} name="home" size={22} />
      </Pressable>
      <DockButton {...midRight} />
      <DockButton {...right} />
    </View>
  );
}

function DockButton({ icon, activeIcon, label, onPress, active, soon }: DockSlot) {
  const p = useFitnessPalette();
  const styles = useFitnessStyles(buildStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: soon, selected: active }}
      disabled={soon || !onPress}
      onPress={onPress}
      style={styles.btn}
    >
      <Ionicons
        color={active ? p.lime : p.textMuted}
        name={active && activeIcon ? activeIcon : icon}
        size={20}
      />
      <Text style={[styles.label, active && styles.labelOn]}>{label}</Text>
      {soon ? <Text style={styles.soon}>Upcoming</Text> : null}
    </Pressable>
  );
}

function buildStyles(p: FitnessPalette) {
  return {
    dock: {
      ...elevation.card,
      alignItems: 'flex-end' as const,
      backgroundColor: p.surface,
      borderColor: p.border,
      borderRadius: radius.full,
      borderWidth: 1,
      flexDirection: 'row' as const,
      justifyContent: 'space-around' as const,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    btn: {
      alignItems: 'center' as const,
      flex: 1,
      gap: 2,
      justifyContent: 'center' as const,
      minHeight: 48,
    },
    label: {
      ...typeScale.caption,
      color: p.textMuted,
      textTransform: 'none' as const,
    },
    labelOn: {
      color: p.lime,
    },
    soon: {
      ...typeScale.body,
      color: p.textMuted,
      fontSize: 9,
      lineHeight: 11,
    },
    fab: {
      ...elevation.fab,
      alignItems: 'center' as const,
      backgroundColor: p.lime,
      borderColor: p.surface,
      borderRadius: radius.full,
      borderWidth: 3,
      height: 48,
      justifyContent: 'center' as const,
      marginBottom: 10,
      width: 48,
    },
  };
}
