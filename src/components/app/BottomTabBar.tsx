import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '../../constants/designSystem';
import type { FitnessPalette } from '../../constants/fitnessPalette';
import { useFitnessStyles } from '../../hooks/useFitnessPalette';
import type { MainTabParamList } from '../../navigation/types';

import { VeyronDock } from './VeyronDock';

export type MainTabRoute = keyof MainTabParamList;

type BottomTabBarProps = {
  activeRoute: MainTabRoute;
  onNavigate: (route: MainTabRoute) => void;
  onReturn?: () => void;
};

export function BottomTabBar({ activeRoute, onNavigate, onReturn }: BottomTabBarProps) {
  const styles = useFitnessStyles(buildStyles);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <VeyronDock
        onHome={onReturn}
        slots={[
          {
            label: 'Workout',
            icon: 'barbell-outline',
            activeIcon: 'barbell',
            active: activeRoute === 'Workout',
            onPress: () => onNavigate('Workout'),
          },
          {
            label: 'Meals',
            icon: 'restaurant-outline',
            activeIcon: 'restaurant',
            active: activeRoute === 'Meals',
            onPress: () => onNavigate('Meals'),
          },
          {
            label: 'Analytics',
            icon: 'stats-chart-outline',
            activeIcon: 'stats-chart',
            active: activeRoute === 'Analytics',
            onPress: () => onNavigate('Analytics'),
          },
          {
            label: 'Profile',
            icon: 'person-outline',
            activeIcon: 'person',
            active: activeRoute === 'Profile',
            onPress: () => onNavigate('Profile'),
          },
        ]}
      />
    </View>
  );
}

function buildStyles(p: FitnessPalette) {
  return {
    wrap: {
      backgroundColor: p.bg,
      paddingHorizontal: layout.gutter,
      paddingTop: 8,
    },
  };
}
