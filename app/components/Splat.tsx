import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export type SplatVariant = 'normal' | 'bonus' | 'negative';

const SPLAT_IMAGES = {
  normal: require('../../assets/splat.png'),
  bonus: require('../../assets/bonus-splat.png'),
  negative: require('../../assets/negative-splat.png')
} as const;

interface SplatProps {
  position: { top: number; left: number };
  variant: SplatVariant;
}

export const Splat: React.FC<SplatProps> = ({ position, variant }) => {
  return (
    <View
      style={[
        styles.splat,
        {
          top: position.top,
          left: position.left,
        },
      ]}
    >
      <Image 
        source={SPLAT_IMAGES[variant]}
        style={styles.splatImage}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  splat: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splatImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
});