import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Animated,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { CrossPlatformImage } from './CrossPlatformImage';
import { Splat, SplatVariant } from './Splat';

type FlyVariant = 'normal' | 'splat' | 'bonus';

const GAME_DURATION = 45; // seconds
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FlyPosition {
  key: number;
  x: number;
  y: number;
  direction: {
    x: number;
    y: number;
  };
  speed: number;
  pattern: 'straight' | 'zigzag' | 'circular' | 'hover';
  patternOffset: number;
  currentSize: number;
  sizeDirection: 'growing' | 'shrinking';
}

interface WhackAFlyProps {
  onGameEnd: () => void;
  onSubmitScore?: (score: number, playerName: string) => void;
}

const MIN_SPEED = 0.2;
const MAX_SPEED = 0.3;
const MIN_SIZE = 30;
const MAX_SIZE = 60;
const SIZE_CHANGE_SPEED = 0.005;
const PATTERN_INTENSITY = 5;
const CENTER_BIAS = 0.7;
const SPAWN_INTERVAL = 2000;
const SCREEN_PADDING = 20;  // Keep flies away from edges
const INITIAL_FLIES = 3;   // Start with 3 flies
const MIN_FLIES = 2;       // Minimum flies on screen
const MAX_FLIES = 6;       // Maximum flies on screen
const SPAWN_ACCELERATION = 0.9; // Spawn gets faster over time

interface SplatPosition {
  id: string;
  position: { top: number; left: number };
  variant: SplatVariant;
}

export function WhackAFly({ onGameEnd, onSubmitScore }: WhackAFlyProps) {
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [flies, setFlies] = useState<FlyPosition[]>([]);
  const [highScore, setHighScore] = useState(0);
  const [score, setScore] = useState(0);
  const [splats, setSplats] = useState<SplatPosition[]>([]);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState('');

  const spawnFly = useCallback((): FlyPosition => {
    const padding = SCREEN_PADDING;
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    
    switch(edge) {
      case 0: // top
        x = padding + Math.random() * (SCREEN_WIDTH - 2 * padding);
        y = padding;
        break;
      case 1: // right
        x = SCREEN_WIDTH - padding;
        y = padding + Math.random() * (SCREEN_HEIGHT - 2 * padding);
        break;
      case 2: // bottom
        x = padding + Math.random() * (SCREEN_WIDTH - 2 * padding);
        y = SCREEN_HEIGHT - padding;
        break;
      default: // left
        x = padding;
        y = padding + Math.random() * (SCREEN_HEIGHT - 2 * padding);
        break;
    }

    const targetX = (Math.random() * SCREEN_WIDTH * (1 - CENTER_BIAS)) + 
                   (SCREEN_WIDTH * 0.5 * CENTER_BIAS);
    const targetY = (Math.random() * SCREEN_HEIGHT * (1 - CENTER_BIAS)) + 
                   (SCREEN_HEIGHT * 0.5 * CENTER_BIAS);

    const patterns: Array<'straight' | 'zigzag' | 'circular' | 'hover'> = 
      ['straight', 'zigzag', 'circular', 'hover'];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];

    const sizeDirection = Math.random() > 0.5 ? 'growing' : 'shrinking';
    const initialSize = sizeDirection === 'growing' ? MIN_SIZE : MAX_SIZE;

    const speed = MIN_SPEED + (Math.random() * (MAX_SPEED - MIN_SPEED) * 0.8);

    const newFly: FlyPosition = {
      key: Date.now(),
      x,
      y,
      direction: {
        x: (targetX - x) / Math.sqrt((targetX - x) ** 2 + (targetY - y) ** 2),
        y: (targetY - y) / Math.sqrt((targetX - x) ** 2 + (targetY - y) ** 2)
      },
      speed,
      pattern,
      patternOffset: Math.random() * Math.PI * 2,
      currentSize: initialSize,
      sizeDirection,
    };

    return newFly;
  }, []);

  const startGame = () => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setFlies([]);
    setGameStatus('playing');
  };

  const handleFlyPress = (key: number, position: { top: number; left: number }) => {
    if (gameStatus !== 'playing') return;
    
    const flyPosition = flies.find(f => f.key === key);
    
    if (flyPosition) {
      const timeBonus = Math.floor(timeLeft / 10);
      const speedBonus = Math.floor(flyPosition.speed * 10);
      const totalScore = 1 + timeBonus + speedBonus;
      
      setScore(prev => prev + totalScore);
      setFlies(current => current.filter(fly => fly.key !== key));
      
      const splatId = `splat-${Date.now()}`;
      setSplats(prev => [...prev, { 
        id: splatId, 
        position,
        variant: 'normal'
      }]);
      
      setTimeout(() => {
        setSplats(prev => prev.filter(splat => splat.id !== splatId));
      }, 1000);
    }
  };

  const handleGameEnd = useCallback(() => {
    setGameStatus('ended');
    
    if (score > 0) {
      setShowNameInput(true);
      setIsNewHighScore(true);
    }
    
    onGameEnd();
  }, [score, onGameEnd]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimeout(() => handleGameEnd(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, handleGameEnd]);

  useEffect(() => {
    if (gameStatus === 'playing') {
      setTimeLeft(GAME_DURATION);
      
      // Spawn initial flies
      for (let i = 0; i < INITIAL_FLIES; i++) {
        spawnFly();
      }
    }
  }, [gameStatus]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    // Calculate spawn interval based on time remaining
    const timeProgress = timeLeft / GAME_DURATION;
    const currentSpawnInterval = SPAWN_INTERVAL * 
      Math.pow(SPAWN_ACCELERATION, GAME_DURATION - timeLeft);

    const spawnTimer = setInterval(() => {
      setFlies(current => {
        if (current.length < MAX_FLIES) {
          const newFly = spawnFly();
          return [...current, newFly];
        }
        return current;
      });
    }, currentSpawnInterval);

    return () => clearInterval(spawnTimer);
  }, [gameStatus, timeLeft]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    // Check if we need to spawn more flies
    if (flies.length < MIN_FLIES) {
      const fliesNeeded = MIN_FLIES - flies.length;
      for (let i = 0; i < fliesNeeded; i++) {
        spawnFly();
      }
    }
  }, [flies.length, gameStatus]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const moveFlies = () => {
      const time = Date.now() / 1000;

      setFlies(current => 
        current.map(fly => {
          let newX = fly.x;
          let newY = fly.y;
          let offsetX = 0;
          let offsetY = 0;

          // Calculate pattern offsets
          switch (fly.pattern) {
            case 'zigzag':
              offsetX = Math.sin(time * 1.2 + fly.patternOffset) * PATTERN_INTENSITY;
              offsetY = Math.cos(time * 1.2 + fly.patternOffset) * PATTERN_INTENSITY;
              break;
            case 'circular':
              offsetX = Math.sin(time * 0.8 + fly.patternOffset) * (PATTERN_INTENSITY * 2);
              offsetY = Math.cos(time * 0.8 + fly.patternOffset) * (PATTERN_INTENSITY * 2);
              break;
            case 'hover':
              const hoverPhase = Math.sin(time * 0.5 + fly.patternOffset);
              if (hoverPhase > 0.7) {
                return fly;
              }
              break;
          }

          // Calculate new position
          newX += fly.direction.x * fly.speed + offsetX;
          newY += fly.direction.y * fly.speed + offsetY;

          // Keep flies within bounds
          const flySize = fly.currentSize || MAX_SIZE;
          const halfSize = flySize / 2;

          // Bounce off screen edges
          if (newX < SCREEN_PADDING + halfSize) {
            newX = SCREEN_PADDING + halfSize;
            fly.direction.x *= -1;
          }
          if (newX > SCREEN_WIDTH - SCREEN_PADDING - halfSize) {
            newX = SCREEN_WIDTH - SCREEN_PADDING - halfSize;
            fly.direction.x *= -1;
          }
          if (newY < SCREEN_PADDING + halfSize) {
            newY = SCREEN_PADDING + halfSize;
            fly.direction.y *= -1;
          }
          if (newY > SCREEN_HEIGHT - SCREEN_PADDING - halfSize) {
            newY = SCREEN_HEIGHT - SCREEN_PADDING - halfSize;
            fly.direction.y *= -1;
          }

          return {
            ...fly,
            x: newX,
            y: newY,
            direction: fly.direction,
          };
        })
      );
    };

    const animationFrame = requestAnimationFrame(moveFlies);
    return () => cancelAnimationFrame(animationFrame);
  }, [flies, gameStatus]);

  const handleSubmitScore = () => {
    if (playerName && onSubmitScore) {
      onSubmitScore(score, playerName);
      setShowNameInput(false);
      setPlayerName('');
    }
  };

  const renderGameOver = () => (
    <View style={styles.gameOver}>
      <Text style={styles.gameOverText}>Game Over!</Text>
      <Text style={styles.scoreText}>Final Score: {score}</Text>
      
      {showNameInput ? (
        <View style={styles.nameInputContainer}>
          <TextInput
            style={styles.nameInput}
            placeholder="Enter your name"
            maxLength={20}
            onChangeText={setPlayerName}
            value={playerName}
          />
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleSubmitScore}
          >
            <Text style={styles.buttonText}>Submit Score</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.startButton}
          onPress={startGame}
        >
          <Text style={styles.startText}>Play Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.text}>Score: {score}</Text>
        <Text style={styles.text}>Time: {timeLeft}</Text>
        <Text style={styles.text}>High Score: {highScore}</Text>
      </View>

      {gameStatus === 'idle' && (
        <TouchableWithoutFeedback onPress={startGame}>
          <View style={styles.startButton}>
            <Text style={styles.startText}>Start Game</Text>
          </View>
        </TouchableWithoutFeedback>
      )}

      {gameStatus === 'ended' && (
        renderGameOver()
      )}

      {flies.map(fly => (
        <TouchableWithoutFeedback 
          key={fly.key} 
          onPress={() => handleFlyPress(fly.key, { top: fly.y, left: fly.x })}
        >
          <Animated.View 
            style={[
              styles.fly, 
              { 
                left: fly.x - fly.currentSize/2, 
                top: fly.y - fly.currentSize/2,
                width: fly.currentSize,
                height: fly.currentSize,
                transform: [
                  { rotate: `${Math.atan2(fly.direction.y, fly.direction.x)}rad` }
                ]
              }
            ]}
          >
            <CrossPlatformImage
              source={{ uri: '/fly.png' }}
              style={[
                styles.flyImage,
                { opacity: Math.max(0.6, fly.currentSize / MAX_SIZE) }
              ]}
            />
          </Animated.View>
        </TouchableWithoutFeedback>
      ))}

      {splats.map(splat => (
        <Splat
          key={splat.id}
          position={splat.position}
          variant={splat.variant}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  fly: {
    position: 'absolute',
    zIndex: 1000,
  },
  flyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  startButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -25 }],
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    width: 150,
    alignItems: 'center',
  },
  startText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameOver: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -50 }],
    alignItems: 'center',
  },
  gameOverText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  scoreText: {
    fontSize: 18,
    marginBottom: 20,
  },
  nameInputContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  nameInput: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    width: '80%',
    marginBottom: 10,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});