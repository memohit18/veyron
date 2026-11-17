import {
  IMAGE_UPLOAD_MAX_DIMENSION,
  IMAGE_UPLOAD_QUALITY,
} from '../lib/images/imageResponse';

export type PreparedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

function getNativeModules() {
  try {
    // Lazy require so a stale native binary does not crash app boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImageManipulator = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    return { ImagePicker, ImageManipulator };
  } catch {
    throw new Error(
      'Photo upload needs a rebuilt app. Run: npm run ios (rebuilds native modules).',
    );
  }
}

async function requestLibraryAccess(
  ImagePicker: typeof import('expo-image-picker'),
) {
  if (!ImagePicker.getMediaLibraryPermissionsAsync) {
    throw new Error(
      'Photo upload needs a rebuilt app. Run: npm run ios (rebuilds native modules).',
    );
  }

  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required to upload images.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/native module|ExponentImagePicker|Cannot find/i.test(message)) {
      throw new Error(
        'Photo upload needs a rebuilt app. Run: npm run ios (rebuilds native modules).',
      );
    }
    throw error;
  }
}

function isGifAsset(mimeType?: string | null, fileName?: string | null) {
  const mime = (mimeType ?? '').toLowerCase();
  const name = (fileName ?? '').toLowerCase();
  return mime.includes('gif') || name.endsWith('.gif');
}

/** Photo or GIF, without flattening an animation into a still JPEG. */
export async function pickDemoMedia(): Promise<PreparedImage | null> {
  const { ImagePicker, ImageManipulator } = getNativeModules();
  await requestLibraryAccess(ImagePicker);

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (!asset.uri) return null;

  if (isGifAsset(asset.mimeType, asset.fileName)) {
    return {
      uri: asset.uri,
      fileName: asset.fileName || 'demo.gif',
      mimeType: 'image/gif',
    };
  }

  return compressStill(ImageManipulator, asset);
}

export async function pickAndPrepareImage(): Promise<PreparedImage | null> {
  const { ImagePicker, ImageManipulator } = getNativeModules();
  await requestLibraryAccess(ImagePicker);

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  return compressStill(ImageManipulator, asset);
}

async function compressStill(
  ImageManipulator: typeof import('expo-image-manipulator'),
  asset: { uri: string; width?: number; height?: number; fileName?: string | null; mimeType?: string | null },
): Promise<PreparedImage | null> {
  const width = asset.width || IMAGE_UPLOAD_MAX_DIMENSION;
  const height = asset.height || IMAGE_UPLOAD_MAX_DIMENSION;
  const longest = Math.max(width, height);
  const scale =
    longest > IMAGE_UPLOAD_MAX_DIMENSION
      ? IMAGE_UPLOAD_MAX_DIMENSION / longest
      : 1;
  const fileName = asset.fileName?.replace(/\.\w+$/, '.jpg') || 'photo.jpg';

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      scale < 1
        ? [
            {
              resize: {
                width: Math.round(width * scale),
                height: Math.round(height * scale),
              },
            },
          ]
        : [],
      {
        compress: IMAGE_UPLOAD_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    return {
      uri: manipulated.uri || asset.uri,
      fileName,
      mimeType: 'image/jpeg',
    };
  } catch {
    if (!asset.uri) return null;
    return {
      uri: asset.uri,
      fileName,
      mimeType: asset.mimeType || 'image/jpeg',
    };
  }
}
