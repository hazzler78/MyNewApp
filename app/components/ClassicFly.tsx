import React from 'react';
import { View, Image, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { FlyVariant } from '../types';

interface ClassicFlyProps {
  id: string;
  position: { top: number; left: number };
  variant: FlyVariant;
  size?: number;
  onPress: (id: string, position: { top: number; left: number }, variant: FlyVariant) => void;
}

const FLY_IMAGES = {
  normal: { uri: '/fly.png' },
  bonus: { uri: '/bonus-fly.png' },
  negative: { uri: '/bad-fly.png' }
};

export const ClassicFly: React.FC<ClassicFlyProps> = ({
  id,
  position,
  variant,
  size = 50,
  onPress
}) => {
  return (
    <TouchableWithoutFeedback
      onPress={() => onPress(id, position, variant)}
    >
      <View
        style={[
          styles.flyContainer,
          {
            top: position.top,
            left: position.left,
            width: size,
            height: size,
          }
        ]}
      >
        <Image
          source={FLY_IMAGES[variant]}
          style={styles.flyImage}
          resizeMode="contain"
          accessibilityLabel={`${variant} fly`}
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  flyContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flyImage: {
    width: '100%',
    height: '100%',
  }
});