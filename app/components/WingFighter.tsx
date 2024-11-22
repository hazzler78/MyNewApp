import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
  TouchableWithoutFeedback,
  Animated,
  GestureResponderEvent,
  Text,
  Pressable,
} from 'react-native';

interface WingFighterProps {
  onGameEnd: (score: number) => void;
}

interface PlayerShip {
  position: { x: number; y: number };
  width: number;
  height: number;
}

interface Enemy {
  id: string;
  position: { x: number; y: number };
  type: 'basic' | 'fast' | 'boss';
}

interface Explosion {
  id: string;
  position: { x: number; y: number };
  startTime: number;
  scale: Animated.Value;
}

interface Bullet {
  id: string;
  position: { x: number; y: number };
}

export const WingFighter: React.FC<WingFighterProps> = ({ onGameEnd }) => {
  const [player, setPlayer] = useState<PlayerShip>({
    position: {
      x: Dimensions.get('window').width / 2 - 25,
      y: Dimensions.get('window').height - 100,
    },
    width: 50,
    height: 50,
  });

  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [stars, setStars] = useState<{
    id: string;
    x: number;
    y: number;
    size: number;
    speed: number;
  }[]>([]);
  const [powerUp, setPowerUp] = useState<{
    type: 'doubleShot';
    active: boolean;
  }>({
    type: 'doubleShot',
    active: false,
  });
  const [enemiesDestroyed, setEnemiesDestroyed] = useState(0);
  const [explosionCounter, setExplosionCounter] = useState(0);

  // Add star generation effect
  useEffect(() => {
    // Initialize stars
    const initialStars = Array.from({ length: 50 }, (_, i) => ({
      id: `star-${i}`,
      x: Math.random() * Dimensions.get('window').width,
      y: Math.random() * Dimensions.get('window').height,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 2 + 1,
    }));
    setStars(initialStars);

    // Move stars
    const moveStars = setInterval(() => {
      setStars(prevStars => prevStars.map(star => ({
        ...star,
        y: star.y + star.speed,
        ...(star.y > Dimensions.get('window').height 
          ? { y: -5, x: Math.random() * Dimensions.get('window').width }
          : {})
      })));
    }, 16);

    return () => clearInterval(moveStars);
  }, []);

  // Add enemy spawning effect
  useEffect(() => {
    if (!isPlaying) return;

    // Spawn an enemy every 2 seconds
    const spawnInterval = setInterval(() => {
      const newEnemy: Enemy = {
        id: generateUniqueId(),
        position: {
          x: Math.random() * (Dimensions.get('window').width - 30), // Account for enemy width
          y: -30, // Start above the screen
        },
        type: 'basic',
      };
      setEnemies(prev => [...prev, newEnemy]);
    }, 2000);

    return () => clearInterval(spawnInterval);
  }, [isPlaying]);

  // Add enemy movement effect
  useEffect(() => {
    if (!isPlaying) return;

    const moveInterval = setInterval(() => {
      setEnemies(prev => prev
        .map(enemy => ({
          ...enemy,
          position: {
            ...enemy.position,
            y: enemy.position.y + 3, // Move down slowly
          },
        }))
        // Remove enemies that are off screen
        .filter(enemy => enemy.position.y < Dimensions.get('window').height)
      );
    }, 16);

    return () => clearInterval(moveInterval);
  }, [isPlaying]);

  // Update player movement to work with touch and mouse
  const handlePlayerMove = useCallback((event: GestureResponderEvent) => {
    const { locationX, pageX } = event.nativeEvent;
    const xPosition = pageX || locationX;
    
    setPlayer(prev => ({
      ...prev,
      position: {
        ...prev.position,
        x: Math.max(0, Math.min(xPosition - prev.width / 2, 
          Dimensions.get('window').width - prev.width)),
      },
    }));
  }, []);

  // Update shooting effect to handle double shot
  useEffect(() => {
    if (!isPlaying) return;

    const shootInterval = setInterval(() => {
      setBullets(prev => {
        if (powerUp.active) {
          // Double shot
          return [
            ...prev,
            {
              id: `bullet-${Date.now()}-1`,
              position: {
                x: player.position.x + 10,
                y: player.position.y,
              },
            },
            {
              id: `bullet-${Date.now()}-2`,
              position: {
                x: player.position.x + player.width - 20,
                y: player.position.y,
              },
            },
          ];
        } else {
          // Single shot
          return [...prev, {
            id: `bullet-${Date.now()}`,
            position: {
              x: player.position.x + player.width / 2 - 2.5,
              y: player.position.y,
            },
          }];
        }
      });
    }, 200);

    return () => clearInterval(shootInterval);
  }, [isPlaying, player.position, powerUp.active]);

  // Move bullets and check collisions in the same effect
  useEffect(() => {
    if (!isPlaying) return;

    const moveInterval = setInterval(() => {
      setBullets(prevBullets => {
        // First, move all bullets
        const movedBullets = prevBullets.map(bullet => ({
          ...bullet,
          position: {
            ...bullet.position,
            y: bullet.position.y - 10,
          },
        }));

        // Then check collisions
        const remainingBullets = movedBullets.filter(bullet => {
          // Remove bullets that are off screen
          if (bullet.position.y < -10) return false;

          // Check for collision with any enemy
          const hitEnemy = enemies.find(enemy => 
            bullet.position.x >= enemy.position.x - 10 &&     // Left edge with margin
            bullet.position.x <= enemy.position.x + 40 &&     // Right edge with margin
            bullet.position.y >= enemy.position.y &&          // Top edge
            bullet.position.y <= enemy.position.y + 30        // Bottom edge
          );

          if (hitEnemy) {
            // Remove the enemy
            setEnemies(prev => prev.filter(e => e.id !== hitEnemy.id));
            
            // Create explosion
            const newExplosionScale = new Animated.Value(0);
            startExplosionAnimation(newExplosionScale);
            
            setExplosions(prev => [...prev, {
              id: generateUniqueId(),
              position: {
                x: hitEnemy.position.x - 20,
                y: hitEnemy.position.y - 20,
              },
              startTime: Date.now(),
              scale: newExplosionScale,
            }]);

            // Update score and check for power-up
            setScore(prev => prev + 100);
            setEnemiesDestroyed(prev => {
              const newCount = prev + 1;
              if (newCount >= 5) {
                setPowerUp({
                  type: 'doubleShot',
                  active: true,
                });
              }
              return newCount;
            });

            return false; // Remove the bullet that hit
          }

          return true; // Keep bullets that didn't hit anything
        });

        return remainingBullets;
      });
    }, 16);

    return () => clearInterval(moveInterval);
  }, [isPlaying, enemies]);

  // Animation for explosion
  const startExplosionAnimation = (newExplosionScale: Animated.Value) => {
    Animated.sequence([
      Animated.timing(newExplosionScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(newExplosionScale, {
        toValue: 0,
        duration: 150,
        delay: 100,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Fix explosion keys with UUID-style unique IDs
  const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // 1. Add this to persist double shot between game sessions
  useEffect(() => {
    if (enemiesDestroyed >= 5) {
      setPowerUp({
        type: 'doubleShot',
        active: true,
      });
    }
  }, [enemiesDestroyed]);

  return (
    <Pressable 
      onPress={handlePlayerMove}
      onPressIn={handlePlayerMove}
      style={styles.container}
    >
      <View style={styles.gameArea}>
        {/* Background Stars */}
        {stars.map(star => (
          <View
            key={star.id}
            style={[
              styles.star,
              {
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
              },
            ]}
          />
        ))}

        {/* Power-up indicator */}
        {powerUp.active && (
          <Text style={styles.powerUpText}>Double Shot Active!</Text>
        )}

        {/* Explosions */}
        {explosions.map(explosion => (
          <Animated.Image
            key={explosion.id}
            source={{ uri: '/explosion.png' }}
            style={[
              styles.explosion,
              {
                left: explosion.position.x,
                top: explosion.position.y,
                opacity: explosion.scale,
                transform: [
                  { scale: explosion.scale },
                  { rotate: `${Math.random() * 360}deg` },
                ],
              },
            ]}
          />
        ))}

        {/* Bullets */}
        {bullets.map(bullet => (
          <Image
            key={bullet.id}
            source={{ uri: '/laser.png' }}
            style={[
              styles.bullet,
              {
                left: bullet.position.x,
                top: bullet.position.y,
              },
            ]}
          />
        ))}

        {/* Player Ship */}
        <Image
          source={{ uri: '/player-ship.png' }}
          style={[
            styles.playerShip,
            {
              left: player.position.x,
              top: player.position.y,
            },
          ]}
        />

        {/* Enemies */}
        {enemies.map(enemy => (
          <Image
            key={enemy.id}
            source={{ uri: '/enemy-ship.png' }}
            style={[
              styles.enemy,
              {
                left: enemy.position.x,
                top: enemy.position.y,
              },
            ]}
          />
        ))}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gameArea: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  playerShip: {
    position: 'absolute',
    width: 50,
    height: 50,
    zIndex: 2,
  },
  enemy: {
    position: 'absolute',
    width: 30,
    height: 30,
    zIndex: 1,
  },
  bullet: {
    position: 'absolute',
    width: 10,
    height: 20,
    zIndex: 1,
  },
  explosion: {
    position: 'absolute',
    width: 70,
    height: 70,
    zIndex: 3,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 50,
    opacity: 0.5,
  },
  powerUpText: {
    position: 'absolute',
    top: 40,
    left: 20,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    zIndex: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 5,
  },
}); 