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
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  variant: FlyVariant;
  points: number;
}

interface WhackAFlyProps {
  onGameEnd: () => void;
  onSubmitScore?: (score: number, playerName: string) => void;
}

const MIN_SPEED = 0.2;
const MAX_SPEED = 0.3;
const MIN_SIZE = 40;
const MAX_SIZE = 60;
const SIZE_CHANGE_SPEED = 0.005;
const PATTERN_INTENSITY = 3;
const CENTER_BIAS = 0.8;
const SPAWN_INTERVAL = 2000;
const SCREEN_PADDING = 40;  // More padding from edges
const INITIAL_FLIES = 3;   // Start with 3 flies
const MIN_FLIES = 2;       // Minimum flies on screen
const MAX_FLIES = 6;       // Maximum flies on screen
const SPAWN_ACCELERATION = 0.9; // Spawn gets faster over time
const COMBO_TIMEOUT = 1000; // Time window for combo (1 second)
const MAX_COMBO_MULTIPLIER = 4; // Maximum combo multiplier
const COMBO_THRESHOLDS = {
  NORMAL: 0,
  GOOD: 3,
  GREAT: 5,
  AMAZING: 8
};
const ROTATION_SPEED = 0.5;   // Slower rotation
const BOUNCE_DAMPENING = 0.8; // Softer bounces

interface SplatPosition {
  id: string;
  position: { top: number; left: number };
  variant: SplatVariant;
}

interface HighScore {
  score: number;
  playerName: string;
  date: string;
  gameMode: string;
  survivalTime?: number;
}

// Update the game status type
type GameStatus = 'idle' | 'playing' | 'ended' | 'menu';

export function WhackAFly({ onGameEnd, onSubmitScore }: WhackAFlyProps) {
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [flies, setFlies] = useState<FlyPosition[]>([]);
  const [highScore, setHighScore] = useState(0);
  const [score, setScore] = useState(0);
  const [splats, setSplats] = useState<SplatPosition[]>([]);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [comboCount, setComboCount] = useState(0);
  const [lastCatchTime, setLastCatchTime] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [showComboText, setShowComboText] = useState(false);
  const [comboText, setComboText] = useState('');
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [showHighScores, setShowHighScores] = useState(false);
  const [flyScale] = useState(new Animated.Value(1));
  const [debugInfo, setDebugInfo] = useState({
    gameStatus: 'idle',
    fliesCount: 0,
    renderCycle: 0
  });

  // Declare updateFlyPosition first
  const updateFlyPosition = useCallback((fly: FlyPosition): FlyPosition => {
    const padding = SCREEN_PADDING;
    let newX = fly.x + (fly.direction.x * fly.speed);
    let newY = fly.y + (fly.direction.y * fly.speed);
    let newDirectionX = fly.direction.x;
    let newDirectionY = fly.direction.y;

    // Bounce off screen edges
    if (newX <= padding || newX >= SCREEN_WIDTH - padding - fly.currentSize) {
      newDirectionX *= -1;
      newX = newX <= padding ? padding : SCREEN_WIDTH - padding - fly.currentSize;
    }

    if (newY <= padding || newY >= SCREEN_HEIGHT - padding - fly.currentSize) {
      newDirectionY *= -1;
      newY = newY <= padding ? padding : SCREEN_HEIGHT - padding - fly.currentSize;
    }

    return {
      ...fly,
      x: newX,
      y: newY,
      direction: {
        x: newDirectionX,
        y: newDirectionY
      }
    };
  }, []);

  // Then declare spawnFly which can use updateFlyPosition
  const spawnFly = useCallback((): FlyPosition => {
    const size = MIN_SIZE;
    const padding = SCREEN_PADDING;
    
    const x = Math.random() * (SCREEN_WIDTH - size - padding * 2) + padding;
    const y = Math.random() * (SCREEN_HEIGHT - size - padding * 2) + padding;
    
    const newFly: FlyPosition = {
      key: Date.now(),
      x,
      y,
      direction: {
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
      },
      speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
      pattern: 'straight',
      patternOffset: 0,
      currentSize: size,
      sizeDirection: 'growing',
      variant: 'normal',
      points: 1
    };

    console.log('Spawned new fly:', newFly);
    return newFly;
  }, []);

  // Then startGame which uses both functions
  const startGame = useCallback(() => {
    console.log('Starting game with full initialization...');
    
    // Reset game state
    setGameStatus('playing');
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setComboCount(0);
    setComboMultiplier(1);
    setSplats([]);
    
    // Create initial flies with explicit typing
    const initialFlies: FlyPosition[] = Array.from({ length: INITIAL_FLIES }, () => {
      const size = MIN_SIZE;
      const padding = SCREEN_PADDING;
      
      // Calculate safe spawn area
      const safeX = Math.random() * (SCREEN_WIDTH - size - padding * 2) + padding;
      const safeY = Math.random() * (SCREEN_HEIGHT - size - padding * 2) + padding;
      
      const fly: FlyPosition = {
        key: Date.now() + Math.random(),
        x: safeX,
        y: safeY,
        direction: {
          x: (Math.random() * 2 - 1) * MAX_SPEED,
          y: (Math.random() * 2 - 1) * MAX_SPEED,
        },
        speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
        pattern: 'straight',
        patternOffset: 0,
        currentSize: size,
        sizeDirection: 'growing',
        variant: 'normal',
        points: 1
      };

      console.log('Created fly:', fly);
      return fly;
    });

    console.log('Setting initial flies:', initialFlies);
    setFlies(initialFlies);

    // Debug info
    setDebugInfo({
      gameStatus: 'playing',
      fliesCount: INITIAL_FLIES,
      renderCycle: 0
    });

    console.log('Game started with:', {
      status: 'playing',
      initialFlies: initialFlies.length,
      timeLeft: GAME_DURATION
    });
  }, []);

  // Add game loop effect
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    console.log('Game loop started');
    const gameLoop = setInterval(() => {
      setFlies(prevFlies => {
        // Update positions
        const updatedFlies = prevFlies.map(updateFlyPosition);
        console.log('Updated flies positions:', updatedFlies);
        return updatedFlies;
      });
    }, 16); // ~60fps

    // Spawn new flies
    const spawnLoop = setInterval(() => {
      setFlies(prevFlies => {
        if (prevFlies.length < MAX_FLIES) {
          console.log('Spawning new fly');
          return [...prevFlies, spawnFly()];
        }
        return prevFlies;
      });
    }, SPAWN_INTERVAL);

    return () => {
      clearInterval(gameLoop);
      clearInterval(spawnLoop);
    };
  }, [gameStatus, updateFlyPosition, spawnFly]);

  const handleFlyPress = useCallback((fly: FlyPosition) => {
    if (gameStatus !== 'playing') return;
    
    // Calculate position for splat effect
    const position = {
      top: fly.y,
      left: fly.x
    };
    
    const currentTime = Date.now();
    const timeSinceLastCatch = currentTime - lastCatchTime;
    
    // Update combo
    if (timeSinceLastCatch <= COMBO_TIMEOUT) {
      setComboCount(prev => prev + 1);
      setComboMultiplier(prev => Math.min(prev + 0.5, MAX_COMBO_MULTIPLIER));
      
      // Set combo feedback text
      let newComboText = '';
      if (comboCount >= COMBO_THRESHOLDS.AMAZING) {
        newComboText = 'AMAZING!';
      } else if (comboCount >= COMBO_THRESHOLDS.GREAT) {
        newComboText = 'GREAT!';
      } else if (comboCount >= COMBO_THRESHOLDS.GOOD) {
        newComboText = 'GOOD!';
      }
      
      if (newComboText) {
        setComboText(newComboText);
        setShowComboText(true);
        setTimeout(() => setShowComboText(false), 1000);
      }
    } else {
      // Reset combo if too much time has passed
      setComboCount(0);
      setComboMultiplier(1);
    }
    
    setLastCatchTime(currentTime);

    // Calculate score with combo multiplier
    const points = Math.round(fly.points * comboMultiplier);
    setScore(prev => prev + points);

    // Add splat effect
    const newSplat: SplatPosition = {
      id: `splat-${Date.now()}`,
      position,
      variant: fly.variant === 'bonus' ? 'bonus' : 'normal'
    };
    
    setSplats(prev => [...prev, newSplat]);
    setTimeout(() => {
      setSplats(prev => prev.filter(s => s.id !== newSplat.id));
    }, 1000);

    // Remove the hit fly
    setFlies(prev => prev.filter(f => f.key !== fly.key));
  }, [gameStatus, comboCount, comboMultiplier, lastCatchTime]);

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
    if (gameStatus !== 'playing') return;

    if (flies.length < MIN_FLIES) {
      const fliesNeeded = MIN_FLIES - flies.length;
      const newFlies = [...flies];
      for (let i = 0; i < fliesNeeded; i++) {
        newFlies.push(spawnFly());
      }
      setFlies(newFlies);
    }
  }, [flies.length, gameStatus, spawnFly]);

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

          // Smoother pattern movements
          switch (fly.pattern) {
            case 'zigzag':
              offsetX = Math.sin(time * 0.8 + fly.patternOffset) * PATTERN_INTENSITY;
              offsetY = Math.cos(time * 0.8 + fly.patternOffset) * PATTERN_INTENSITY;
              break;
            case 'circular':
              const radius = PATTERN_INTENSITY * 2;
              offsetX = Math.sin(time * 0.5 + fly.patternOffset) * radius;
              offsetY = Math.cos(time * 0.5 + fly.patternOffset) * radius;
              break;
            case 'hover':
              const hoverPhase = Math.sin(time * 0.3 + fly.patternOffset);
              if (hoverPhase > 0.7) {
                return {
                  ...fly,
                  direction: {
                    x: fly.direction.x * 0.95, // Gradual slowdown
                    y: fly.direction.y * 0.95
                  }
                };
              }
              break;
          }

          // Calculate new position with smoother movement
          const speedFactor = fly.variant === 'bonus' ? 1.2 : 1;
          newX += (fly.direction.x * fly.speed * speedFactor + offsetX) * 0.8;
          newY += (fly.direction.y * fly.speed * speedFactor + offsetY) * 0.8;

          // Improved boundary checking with soft bouncing
          const flySize = fly.currentSize;
          const halfSize = flySize / 2;
          let newDirectionX = fly.direction.x;
          let newDirectionY = fly.direction.y;

          if (newX < SCREEN_PADDING + halfSize) {
            newX = SCREEN_PADDING + halfSize;
            newDirectionX = Math.abs(fly.direction.x) * BOUNCE_DAMPENING;
          } else if (newX > SCREEN_WIDTH - SCREEN_PADDING - halfSize) {
            newX = SCREEN_WIDTH - SCREEN_PADDING - halfSize;
            newDirectionX = -Math.abs(fly.direction.x) * BOUNCE_DAMPENING;
          }

          if (newY < SCREEN_PADDING + halfSize) {
            newY = SCREEN_PADDING + halfSize;
            newDirectionY = Math.abs(fly.direction.y) * BOUNCE_DAMPENING;
          } else if (newY > SCREEN_HEIGHT - SCREEN_PADDING - halfSize) {
            newY = SCREEN_HEIGHT - SCREEN_PADDING - halfSize;
            newDirectionY = -Math.abs(fly.direction.y) * BOUNCE_DAMPENING;
          }

          // Gradually move towards center
          const centerX = SCREEN_WIDTH / 2;
          const centerY = SCREEN_HEIGHT / 2;
          const centerPull = 0.001;
          newDirectionX += (centerX - newX) * centerPull;
          newDirectionY += (centerY - newY) * centerPull;

          // Normalize direction vector
          const magnitude = Math.sqrt(newDirectionX ** 2 + newDirectionY ** 2);
          if (magnitude > 0) {
            newDirectionX /= magnitude;
            newDirectionY /= magnitude;
          }

          return {
            ...fly,
            x: newX,
            y: newY,
            direction: {
              x: newDirectionX,
              y: newDirectionY
            }
          };
        })
      );
    };

    const animationFrame = requestAnimationFrame(moveFlies);
    return () => cancelAnimationFrame(animationFrame);
  }, [flies, gameStatus]);

  // Add render function
  const renderGame = () => {
    console.log('Rendering game with:', {
      fliesCount: flies.length,
      gameStatus,
      screenDims: `${SCREEN_WIDTH}x${SCREEN_HEIGHT}`
    });

    return (
      <View style={styles.container}>
        {/* Game Header */}
        <View style={styles.header}>
          <Text style={styles.text}>Score: {score}</Text>
          <Text style={styles.text}>Time: {timeLeft}</Text>
        </View>

        {/* Game Area */}
        <View style={styles.gameArea}>
          {flies.map((fly) => (
            <TouchableWithoutFeedback
              key={fly.key}
              onPress={() => handleFlyPress(fly)}
            >
              <View
                style={[
                  styles.flyWrapper,
                  {
                    transform: [
                      { translateX: fly.x },
                      { translateY: fly.y }
                    ],
                    width: fly.currentSize,
                    height: fly.currentSize,
                  },
                ]}
              >
                <CrossPlatformImage
                  source={require('../assets/fly.png')}
                  style={styles.flyImage}
                  resizeMode="contain"
                />
              </View>
            </TouchableWithoutFeedback>
          ))}
        </View>

        {/* Debug Overlay */}
        {__DEV__ && (
          <View style={styles.debugOverlay}>
            <Text style={styles.debugText}>Flies: {flies.length}</Text>
            <Text style={styles.debugText}>Status: {gameStatus}</Text>
            <Text style={styles.debugText}>Screen: {SCREEN_WIDTH}x{SCREEN_HEIGHT}</Text>
          </View>
        )}
      </View>
    );
  };

  // Add useEffect for game initialization
  useEffect(() => {
    console.log('Component mounted, starting game directly');
    startGame(); // Remove the delay and start immediately
  }, [startGame]);

  // Add a debug effect to monitor state changes
  useEffect(() => {
    console.log('Game state updated:', {
      status: gameStatus,
      fliesCount: flies.length,
      timeLeft,
      screenDimensions: `${SCREEN_WIDTH}x${SCREEN_HEIGHT}`
    });
  }, [gameStatus, flies.length, timeLeft]);

  // Add spawn control effect
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    console.log('Setting up spawn interval');
    const spawnInterval = setInterval(() => {
      setFlies(prevFlies => {
        if (prevFlies.length < MAX_FLIES) {
          console.log('Spawning new fly, current count:', prevFlies.length);
          return [...prevFlies, spawnFly()];
        }
        return prevFlies;
      });
    }, SPAWN_INTERVAL);

    return () => clearInterval(spawnInterval);
  }, [gameStatus, spawnFly]);

  // Add movement effect
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    console.log('Setting up movement interval');
    const movementInterval = setInterval(() => {
      setFlies(prevFlies => {
        console.log('Moving flies, count:', prevFlies.length);
        return prevFlies.map(updateFlyPosition);
      });
    }, 16); // ~60fps

    return () => clearInterval(movementInterval);
  }, [gameStatus, updateFlyPosition]);

  // Add this effect to monitor flies state
  useEffect(() => {
    console.log('Flies state changed:', {
      count: flies.length,
      positions: flies.map(f => ({ x: Math.round(f.x), y: Math.round(f.y) }))
    });
  }, [flies]);

  // Add this effect to monitor fly spawning
  useEffect(() => {
    if (gameStatus === 'playing' && flies.length === 0) {
      console.log('No flies detected in playing state, forcing spawn');
      const initialFlies: FlyPosition[] = Array.from({ length: INITIAL_FLIES }, () => ({
        key: Date.now() + Math.random(),
        x: Math.random() * (SCREEN_WIDTH - MIN_SIZE - SCREEN_PADDING * 2) + SCREEN_PADDING,
        y: Math.random() * (SCREEN_HEIGHT - MIN_SIZE - SCREEN_PADDING * 2) + SCREEN_PADDING,
        direction: {
          x: (Math.random() * 2 - 1) * MAX_SPEED,
          y: (Math.random() * 2 - 1) * MAX_SPEED,
        },
        speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
        pattern: 'straight',
        patternOffset: 0,
        currentSize: MIN_SIZE,
        sizeDirection: 'growing',
        variant: 'normal',
        points: 1
      }));
      setFlies(initialFlies);
    }
  }, [gameStatus, flies.length]);

  // Add this check at the top of the component
  useEffect(() => {
    try {
      const flyImage = require('../assets/fly.png');
      console.log('Fly image loaded:', flyImage);
    } catch (error) {
      console.error('Failed to load fly image:', error);
    }
  }, []);

  return (
    <View style={styles.container}>
      {renderGame()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 1,
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  flyWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.2)', // Debug background
    borderWidth: 1,
    borderColor: 'red',
  },
  flyImage: {
    width: '100%',
    height: '100%',
  },
  debugOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 100,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  gameModeButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    boxShadow: '0px 2px 3.84px rgba(0,0,0,0.25)',
    elevation: 5,
  },
});
