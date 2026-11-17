import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { layout, typeScale } from '../../constants/designSystem';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useTheme } from '../../contexts/ThemeContext';
import { useImmersiveTopPad } from '../../hooks/useImmersiveTopPad';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  contentStyle?: StyleProp<ViewStyle>;
  hideHeader?: boolean;
  backgroundColor?: string;
  /** @deprecated Tab bar is owned by the root tab navigator. */
  hideTabBar?: boolean;
}

export function AppShell({
  children,
  title = 'Veyron',
  contentStyle,
  hideHeader = false,
  backgroundColor,
}: AppShellProps) {
  const { colors } = useTheme();
  const topPad = useImmersiveTopPad();
  const rootBg = backgroundColor ?? colors.background;

  return (
    <View style={[styles.root, { backgroundColor: rootBg, paddingTop: topPad }]}>
      {!hideHeader ? (
        <View style={styles.topBar}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <ThemeToggle />
        </View>
      ) : null}

      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: layout.headerHeight,
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
  },
  title: {
    ...typeScale.section,
    flex: 1,
    paddingRight: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.gutter,
  },
});
