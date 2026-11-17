import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../contexts/ThemeContext';

export function Logo() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Image source={require('../../../assets/icon.png')} style={styles.icon} />
      <Text style={[styles.brand, { color: colors.text }]}>Veyron</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 28,
  },
  icon: {
    borderRadius: 8,
    height: 32,
    width: 32,
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
