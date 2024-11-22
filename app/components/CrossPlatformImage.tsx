import React from 'react';
import { Image, ImageProps, Platform } from 'react-native';

interface CrossPlatformImageProps extends ImageProps {
  source: { uri: string };
}

export function CrossPlatformImage({ source, ...props }: CrossPlatformImageProps) {
  const imageSource = Platform.select({
    web: { uri: source.uri },
    default: source,
  });

  return <Image source={imageSource} {...props} />;
}