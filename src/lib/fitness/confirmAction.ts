import { Alert } from 'react-native';

/** Ask before a fitness write. Resolves false when the person cancels. */
export function confirmFitnessAction(
  title: string,
  message: string,
  options?: { confirmLabel?: string; destructive?: boolean },
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options?.confirmLabel ?? 'Confirm',
        style: options?.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
