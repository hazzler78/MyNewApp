import { Text, View, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform, Image, TextInput } from "react-native";
import { useState, useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';

type FlyVariant = 'normal' | 'bonus' | 'negative';

type Fly = {
  id: string;
  position: { top: number; left: number };
  variant: FlyVariant;
  timeout?: NodeJS.Timeout;
  createdAt?: number;
};

type Level = {
  name: string;
  timeLimit: number;
  numberOfFlies: number;
  pointsPerFly: number;
  colors: string[];
};

type HighScore = {
  score: number;
  date: string;
  playerName: string;
};

type HighScores = Record<number, HighScore[]>;

const LEVELS: Level[] = [
  {
    name: "Beginner",
    timeLimit: 30,
    numberOfFlies: 7,
    pointsPerFly: 1,
    colors: ['#a8e6cf', '#dcedc1'] as const
  },
  {
    name: "Advanced",
    timeLimit: 20,
    numberOfFlies: 5,
    pointsPerFly: 1,
    colors: ['#ffd3b6', '#ffaaa5'] as const
  },
  {
    name: "Expert",
    timeLimit: 10,
    numberOfFlies: 3,
    pointsPerFly: 1,
    colors: ['#ff8b94', '#ff6b6b'] as const
  }
];

const FLY_POINTS = {
  normal: 1,
  bonus: 3,
  negative: -2,
} as const;

const generateNewFlyPosition = () => {
  const FLY_SIZE = 50;
  const HEADER_HEIGHT = 100;
  const BOTTOM_PADDING = 150;
  const SIDE_PADDING = 20;
  
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  
  // Ensure flies stay fully within visible area
  const maxLeft = windowWidth - FLY_SIZE - SIDE_PADDING;
  const maxTop = windowHeight - FLY_SIZE - BOTTOM_PADDING;
  const minLeft = SIDE_PADDING;
  const minTop = HEADER_HEIGHT + SIDE_PADDING;
  
  // Round positions to prevent partial pixel placement
  return {
    left: Math.floor(Math.random() * (maxLeft - minLeft)) + minLeft,
    top: Math.floor(Math.random() * (maxTop - minTop)) + minTop
  };
};

// Add these imports at the top of your file
const FLY_IMAGES = {
  normal: require('../assets/fly.png'),
  bonus: require('../assets/bonus-fly.png'),
  negative: require('../assets/bad-fly.png')
} as const;

const SPLAT_IMAGES = {
  normal: require('../assets/splat.png'),
  bonus: require('../assets/bonus-splat.png'),
  negative: require('../assets/negative-splat.png')
} as const;

// Update the Fly component to use the images
const Fly = ({ id, position, variant, onCatch }: { 
  id: string; 
  position: { top: number; left: number }; 
  variant: FlyVariant;
  onCatch: (id: string, position: { top: number; left: number }, variant: FlyVariant) => void 
}) => {
  return (
    <TouchableOpacity
      onPress={() => onCatch(id, position, variant)}
      style={[
        styles.fly,
        {
          top: position.top,
          left: position.left,
        },
      ]}
    >
      <Image 
        source={FLY_IMAGES[variant]}
        style={styles.flyImage}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
};

// Update the Splat component to use the images
const Splat = ({ position, variant }: { 
  position: { top: number; left: number };
  variant: FlyVariant;
}) => {
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

const HIGHSCORES_STORAGE_KEY = '@fly_swatter_highscores';

type GameStatus = 'idle' | 'countdown' | 'playing' | 'input' | 'ended';

// Add this type and constants for fly generation
type FlyDistribution = {
  normal: number;
  bonus: number;
  negative: number;
};

const MINIMUM_NORMAL_FLIES = 0.6; // At least 60% normal flies
const MAXIMUM_NEGATIVE_FLIES = 0.2; // Maximum 20% negative flies
const MAXIMUM_BONUS_FLIES = 0.2; // Maximum 20% bonus flies

// Add this function to check and correct fly distribution
const correctFlyDistribution = (flies: Fly[]): Fly[] => {
  const distribution = flies.reduce((acc, fly) => {
    acc[fly.variant]++;
    return acc;
  }, { normal: 0, bonus: 0, negative: 0 });

  const totalFlies = flies.length;
  const normalPercentage = distribution.normal / totalFlies;
  const negativePercentage = distribution.negative / totalFlies;

  console.log('Checking distribution:', {
    normal: normalPercentage,
    negative: negativePercentage,
    total: totalFlies
  });

  // If distribution is bad, force correction
  if (normalPercentage < MINIMUM_NORMAL_FLIES || negativePercentage > MAXIMUM_NEGATIVE_FLIES) {
    console.log('Correcting bad distribution');
    return flies.map((fly, index) => {
      // Force at least 60% normal flies
      if (index < Math.ceil(totalFlies * MINIMUM_NORMAL_FLIES)) {
        return { ...fly, variant: 'normal' };
      }
      // Allow some bonus flies
      if (index < Math.ceil(totalFlies * (MINIMUM_NORMAL_FLIES + MAXIMUM_BONUS_FLIES))) {
        return { ...fly, variant: 'bonus' };
      }
      // Rest can be negative (but will be limited by previous conditions)
      return { ...fly, variant: 'negative' };
    });
  }

  return flies;
};

// Add this helper function to generate a balanced fly variant
const generateBalancedFlyVariant = (currentFlies: Fly[]): FlyVariant => {
  // Count current fly types
  const flyCounts = currentFlies.reduce((acc, fly) => {
    acc[fly.variant]++;
    return acc;
  }, { normal: 0, bonus: 0, negative: 0 });

  const totalFlies = currentFlies.length;
  
  // Calculate percentages
  const percentages = {
    normal: totalFlies > 0 ? flyCounts.normal / totalFlies : 1,
    bonus: totalFlies > 0 ? flyCounts.bonus / totalFlies : 0,
    negative: totalFlies > 0 ? flyCounts.negative / totalFlies : 0
  };

  console.log('Current fly distribution:', percentages);

  // Force normal flies if we're below minimum
  if (percentages.normal < MINIMUM_NORMAL_FLIES) {
    return 'normal';
  }

  // Prevent more negative flies if at maximum
  if (percentages.negative >= MAXIMUM_NEGATIVE_FLIES) {
    // Choose between normal and bonus
    return Math.random() < 0.8 ? 'normal' : 'bonus';
  }

  // Prevent more bonus flies if at maximum
  if (percentages.bonus >= MAXIMUM_BONUS_FLIES) {
    // Choose between normal and negative
    return Math.random() < 0.8 ? 'normal' : 'negative';
  }

  // Otherwise, use weighted random selection
  const rand = Math.random();
  if (rand < 0.7) return 'normal';
  if (rand < 0.85) return 'bonus';
  return 'negative';
};

// Update the debug function to receive currentLevel
const debugGameState = (message: string, data: any, level: number) => {
  console.log(`[DEBUG] ${message}:`, {
    ...data,
    levelConfig: LEVELS[level],
    shouldBe: {
      flies: LEVELS[level].numberOfFlies,
      time: LEVELS[level].timeLimit
    }
  });
};

// Add level validation
const validateLevel = (level: number) => {
  console.log('Validating level:', {
    level,
    settings: LEVELS[level],
    expectedFlies: LEVELS[level].numberOfFlies,
    expectedTime: LEVELS[level].timeLimit
  });
  
  return {
    flies: LEVELS[level].numberOfFlies,
    time: LEVELS[level].timeLimit,
    name: LEVELS[level].name
  };
};

export default function Index() {
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highScores, setHighScores] = useState<HighScores>({
    0: [],
    1: [],
    2: []
  });
  const [splats, setSplats] = useState<Array<{top: number; left: number; variant: FlyVariant}>>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [flies, setFlies] = useState<Fly[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [playerName, setPlayerName] = useState<string>('');
  const [showNameInput, setShowNameInput] = useState(false);

  // Move debug function here, after all state declarations
  const debugHighScores = (message: string) => {
    console.log(`[DEBUG] ${message}`, {
      currentLevel,
      score,
      highScores,
    });
  };

  const selectLevel = (index: number) => {
    console.log('Selecting level:', {
      index,
      name: LEVELS[index].name,
      flies: LEVELS[index].numberOfFlies,
      time: LEVELS[index].timeLimit
    });
    
    // Set level and start game in one go
    startGameWithLevel(index);
  };

  // New function to handle both level selection and game start
  const startGameWithLevel = (levelIndex: number) => {
    const levelConfig = LEVELS[levelIndex];
    
    console.log('Starting game with level:', {
      index: levelIndex,
      name: levelConfig.name,
      flies: levelConfig.numberOfFlies,
      time: levelConfig.timeLimit
    });

    // Set everything in sequence
    setCurrentLevel(levelIndex);
    setFlies([]);
    setSplats([]);
    setScore(0);
    setTimeLeft(levelConfig.timeLimit);
    setGameStatus('countdown');
    setCountdown(3);
    setIsPlaying(false);

    const startGameplay = () => {
      const gameConfig = LEVELS[levelIndex]; // Use levelIndex directly
      console.log('Starting gameplay for level:', {
        index: levelIndex,
        name: gameConfig.name,
        flies: gameConfig.numberOfFlies,
        time: gameConfig.timeLimit
      });

      setGameStatus('playing');
      setTimeLeft(gameConfig.timeLimit);
      setIsPlaying(true);
      
      // Create initial flies
      const initialFlies: Fly[] = [];
      for (let i = 0; i < gameConfig.numberOfFlies; i++) {
        initialFlies.push({
          id: `fly-${Date.now()}-${Math.random()}`,
          position: generateNewFlyPosition(),
          variant: 'normal'
        });
      }

      console.log('Created flies for level:', {
        level: gameConfig.name,
        created: initialFlies.length,
        expected: gameConfig.numberOfFlies,
        timeSet: gameConfig.timeLimit
      });
      
      setFlies(initialFlies);
    };

    // Start countdown
    const countdownTimer = setInterval(() => {
      setCountdown((prev: number | null) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimer);
          setTimeout(startGameplay, 1000);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Add some console logs to help us debug
  useEffect(() => {
    console.log('Game Status:', gameStatus);
    console.log('Time Left:', timeLeft);
    console.log('Is Playing:', isPlaying);
  }, [gameStatus, timeLeft, isPlaying]);

  // Load high scores when component mounts
  useEffect(() => {
    const loadHighScores = async () => {
      try {
        const savedScores = await AsyncStorage.getItem(HIGHSCORES_STORAGE_KEY);
        console.log('Loading saved scores:', savedScores);
        
        if (savedScores) {
          const parsedScores = JSON.parse(savedScores);
          console.log('Parsed saved scores:', parsedScores);
          setHighScores(parsedScores);
        } else {
          console.log('No saved scores found, initializing with defaults');
          const initialScores = {
            0: [],
            1: [],
            2: []
          };
          await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(initialScores));
          setHighScores(initialScores);
        }
      } catch (error) {
        console.error('Error loading high scores:', error);
        // Initialize with empty arrays if there's an error
        setHighScores({
          0: [],
          1: [],
          2: []
        });
      }
    };

    loadHighScores();
  }, []); // Only run once on mount

  // Save high scores whenever they change
  useEffect(() => {
    const saveHighScores = async () => {
      try {
        await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(highScores));
        console.log('Saved high scores:', highScores); // Debug log
      } catch (error) {
        console.error('Error saving high scores:', error);
      }
    };

    saveHighScores();
  }, [highScores]);

  // Update the game timer effect
  useEffect(() => {
    let gameTimer: NodeJS.Timeout | undefined;
    
    if (isPlaying && gameStatus === 'playing') {
      console.log('Starting game timer with:', timeLeft);
      
      gameTimer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          console.log('Time remaining:', newTime);
          
          if (newTime <= 0) {
            clearInterval(gameTimer);
            setIsPlaying(false);
            
            // Check for high score
            const currentScores = Array.isArray(highScores[currentLevel]) 
              ? highScores[currentLevel] 
              : [];
            
            const shouldAdd = currentScores.length < 10 || 
              currentScores.some(existingScore => score > existingScore.score);
            
            if (shouldAdd) {
              setGameStatus('input');
              setShowNameInput(true);
            } else {
              setGameStatus('ended');
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);

      return () => {
        if (gameTimer) {
          console.log('Clearing game timer');
          clearInterval(gameTimer);
        }
      };
    }
  }, [isPlaying, gameStatus]);

  const catchFly = (flyId: string, position: { top: number; left: number }, variant: FlyVariant) => {
    if (!isPlaying || timeLeft <= 0) return;
    
    setSplats(prev => [...prev, { ...position, variant }]);
    setScore(prev => prev + FLY_POINTS[variant]);
    
    // Remove caught fly
    setFlies(prev => {
      const caughtFly = prev.find(f => f.id === flyId);
      if (caughtFly?.timeout) {
        clearTimeout(caughtFly.timeout);
      }
      
      const remaining = prev.filter(f => f.id !== flyId);
      
      // Only generate new fly if it was a normal fly
      if (variant === 'normal') {
        const newFly: Fly = {
          id: `fly-${Date.now()}-${Math.random()}`,
          position: generateNewFlyPosition(),
          variant: 'normal'
        };
        return [...remaining, newFly];
      }
      
      return remaining;
    });

    // Clean up splat after 1 second
    setTimeout(() => {
      setSplats(prev => prev.filter(p => p.top !== position.top || p.left !== position.left));
    }, 1000);
  };

  // Update the useEffect that manages flies
  useEffect(() => {
    if (isPlaying && gameStatus === 'playing') {
      const targetFlies = LEVELS[currentLevel].numberOfFlies;
      
      // Regular fly management
      if (flies.length < targetFlies) {
        setFlies(prev => {
          const newFlies = [...prev];
          while (newFlies.length < targetFlies) {
            newFlies.push({
              id: `fly-${Date.now()}-${Math.random()}`,
              position: generateNewFlyPosition(),
              variant: 'normal' // Only generate normal flies here
            });
          }
          return newFlies;
        });
      }

      // Special fly spawning system
      const spawnSpecialFly = () => {
        const SPECIAL_FLY_DURATION = 2000; // 2 seconds (reduced from 3)
        
        setFlies(prev => {
          // Randomly choose between bonus and negative
          const isBonus = Math.random() < 0.6; // 60% chance for bonus flies
          const specialFly: Fly = {
            id: `special-${Date.now()}`,
            position: generateNewFlyPosition(),
            variant: isBonus ? 'bonus' : 'negative',
            createdAt: Date.now()
          };

          // Set timeout to remove the special fly
          const timeout = setTimeout(() => {
            setFlies(current => 
              current.filter(f => f.id !== specialFly.id)
            );
          }, SPECIAL_FLY_DURATION);

          specialFly.timeout = timeout;
          return [...prev, specialFly];
        });
      };

      // More frequent special fly spawning
      const spawnInterval = setInterval(() => {
        const shouldSpawn = Math.random() < 0.3; // 30% chance every interval (increased from 20%)
        if (shouldSpawn) {
          spawnSpecialFly();
        }
      }, 1500); // Check every 1.5 seconds (reduced from 2)

      // Cleanup
      return () => {
        clearInterval(spawnInterval);
        // Clear any existing special fly timeouts
        setFlies(current => {
          current.forEach(fly => {
            if (fly.timeout) {
              clearTimeout(fly.timeout);
            }
          });
          return current;
        });
      };
    }
  }, [isPlaying, gameStatus, currentLevel]);

  // Add reset function near other game functions
  const handleResetPress = () => {

    try {
      const initialScores = {
        0: [],
        1: [],
        2: []
      };
      const saveScores = async () => {
        await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(initialScores));
      };
      saveScores();
      setHighScores(initialScores);
    } catch (error) {
      console.error('Error resetting high scores:', error);
    }
  };

  // Add this near the top of the Index component
  useEffect(() => {
    const checkHighScores = async () => {
      try {
        const savedScores = await AsyncStorage.getItem(HIGHSCORES_STORAGE_KEY);
        console.log('Current stored high scores:', savedScores);
      } catch (error) {
        console.error('Error checking high scores:', error);
      }
    };

    checkHighScores();
  }, [highScores]); // This will log whenever highScores changes

  // Add console log to debug high scores
  useEffect(() => {
    console.log('Current high scores:', highScores);
  }, [highScores]);

  // Add this effect to monitor high scores changes
  useEffect(() => {
    console.log('High scores updated:', highScores);
  }, [highScores]);

  // Update the NameInputOverlay component to be more mobile-friendly
  const NameInputOverlay = () => (
    <View style={styles.nameInputOverlay}>
      <View style={styles.nameInputDialog}>
        <Text style={styles.nameInputTitle}>New High Score! 🎉</Text>
        <Text style={styles.nameInputSubtitle}>Enter your initials:</Text>
        <TextInput
          style={[
            styles.nameInput,
            Platform.OS === 'ios' && styles.nameInputIOS,
            Platform.OS === 'android' && styles.nameInputAndroid
          ]}
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={3}
          autoCapitalize="characters"
          autoFocus={Platform.OS === 'web'}
          keyboardType="default"
          returnKeyType="done"
          onSubmitEditing={submitScore}
          editable={true}
        />
        <TouchableOpacity 
          style={[styles.button, !playerName && styles.buttonDisabled]}
          disabled={!playerName}
          onPress={submitScore}
        >
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Update the submitScore function to properly handle score insertion
  const submitScore = async () => {
    if (!playerName) return;
    
    console.log('Submitting score:', {
      level: currentLevel,
      score,
      playerName,
      currentHighScores: highScores[currentLevel]
    });
    
    const newScore = {
      score,
      date: new Date().toLocaleDateString(),
      playerName: playerName.toUpperCase()
    };

    // Make sure we're working with an array
    let currentLevelScores = Array.isArray(highScores[currentLevel]) 
      ? highScores[currentLevel] 
      : [];

    // Add new score and sort
    currentLevelScores = [...currentLevelScores, newScore]
      .sort((a, b) => b.score - a.score) // Sort in descending order
      .slice(0, 10); // Keep only top 10

    try {
      const updatedScores = {
        ...highScores,
        [currentLevel]: currentLevelScores
      };
      
      console.log('Saving updated scores:', updatedScores);
      await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(updatedScores));
      setHighScores(updatedScores);
      
      // Reset states in the correct order
      setShowNameInput(false);
      setPlayerName('');
      setGameStatus('ended');
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  // Add this useEffect to monitor state changes
  useEffect(() => {
    console.log('Game Status:', gameStatus);
    console.log('Show Name Input:', showNameInput);
    console.log('Player Name:', playerName);
  }, [gameStatus, showNameInput, playerName]);

  // Update the Leaderboard component
  const Leaderboard = ({ level }: { level: number }) => {
    // Ensure we have a valid array of scores
    const scores = Array.isArray(highScores[level]) ? highScores[level] : [];
    
    console.log('Rendering leaderboard with scores:', scores); // Debug log
    
    return (
      <View style={styles.leaderboard}>
        <Text style={styles.leaderboardTitle}>{LEVELS[level].name} Leaderboard</Text>
        {scores.length === 0 ? (
          <Text style={styles.noScores}>No scores yet!</Text>
        ) : (
          scores.map((score, index) => (
            <View key={index} style={styles.scoreRow}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.playerName}>{score.playerName}</Text>
              <Text style={styles.scoreValue}>{score.score}</Text>
              <Text style={styles.scoreDate}>{score.date}</Text>
            </View>
          ))
        )}
      </View>
    );
  };

  // Add this effect to monitor state changes
  useEffect(() => {
    console.log('State Change:', {
      gameStatus,
      showNameInput,
      isPlaying,
      score,
      platform: Platform.OS
    });
  }, [gameStatus, showNameInput, isPlaying, score]);

  // Add this effect to monitor level changes
  useEffect(() => {
    console.log('Level changed:', {
      currentLevel,
      timeLimit: LEVELS[currentLevel].timeLimit,
      numberOfFlies: LEVELS[currentLevel].numberOfFlies
    });
  }, [currentLevel]);

  // Add this effect to monitor time and flies
  useEffect(() => {
    console.log('Game state update:', {
      timeLeft,
      fliesCount: flies.length,
      currentLevel,
      levelSettings: LEVELS[currentLevel]
    });
  }, [timeLeft, flies.length, currentLevel]);

  // Add this effect to monitor level changes
  useEffect(() => {
    if (gameStatus === 'playing') {
      const config = validateLevel(currentLevel);
      console.log('Level state check:', {
        currentLevel,
        expectedFlies: config.flies,
        expectedTime: config.time,
        actualFlies: flies.length,
        actualTime: timeLeft
      });
    }
  }, [currentLevel, gameStatus, flies.length, timeLeft]);

  return (
    <View style={styles.container}>
      {/* Game header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fly Swatter!</Text>
        {gameStatus === 'playing' && (
          <>
            <Text style={styles.timer}>Time: {timeLeft}s</Text>
            <Text style={styles.score}>Score: {score}</Text>
          </>
        )}
      </View>

      {/* Level Selection - Show when idle */}
      {gameStatus === 'idle' && (
        <View style={styles.buttonContainer}>
          <Text style={styles.instructions}>Select Difficulty:</Text>
          {LEVELS.map((level, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.levelButton,
                currentLevel === index && styles.selectedLevel
              ]}
              onPress={() => selectLevel(index)}
            >
              <Text style={styles.buttonText}>{level.name}</Text>
              <Text style={styles.levelDetails}>
                Time: {level.timeLimit}s • Flies: {level.numberOfFlies}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Countdown overlay */}
      {gameStatus === 'countdown' && countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* Game area - only show when playing */}
      {gameStatus === 'playing' && (
        <View style={styles.gameArea}>
          {flies.map((fly: Fly) => (
            <Fly
              key={fly.id}
              id={fly.id}
              position={fly.position}
              variant={fly.variant}
              onCatch={catchFly}
            />
          ))}
          {splats.map((position, index) => (
            <Splat key={index} position={position} variant={position.variant} />
          ))}
        </View>
      )}

      {/* Game over screen - Only show if not in input mode */}
      {gameStatus === 'ended' && !showNameInput && (
        <View style={styles.overlay}>
          <Text style={styles.gameOver}>Game Over!</Text>
          <Text style={styles.finalScore}>Score: {score}</Text>
          <Leaderboard level={currentLevel} />
          <TouchableOpacity 
            style={styles.button}
            onPress={() => setGameStatus('idle')}
          >
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Name input overlay - Show when in input state */}
      {(gameStatus === 'input' || showNameInput) && (
        <View style={styles.nameInputOverlay}>
          <View style={styles.nameInputDialog}>
            <Text style={styles.nameInputTitle}>New High Score! 🎉</Text>
            <Text style={styles.nameInputSubtitle}>Enter your initials:</Text>
            <TextInput
              style={[
                styles.nameInput,
                Platform.OS === 'ios' && styles.nameInputIOS,
                Platform.OS === 'android' && styles.nameInputAndroid
              ]}
              value={playerName}
              onChangeText={setPlayerName}
              maxLength={3}
              autoCapitalize="characters"
              autoFocus={Platform.OS === 'web'}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={submitScore}
            />
            <TouchableOpacity 
              style={[styles.button, !playerName && styles.buttonDisabled]}
              disabled={!playerName}
              onPress={submitScore}
            >
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rest of your components */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    marginTop: 5,
  },
  timer: {
    fontSize: 20,
    color: 'white',
    marginTop: 5,
  },
  score: {
    fontSize: 20,
    color: 'white',
    marginTop: 5,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  instructions: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  levelButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    maxWidth: 300,
    marginVertical: 10,
    alignItems: 'center',
  },
  selectedLevel: {
    backgroundColor: '#2E7D32',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  levelDetails: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
    opacity: 0.9,
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 40,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  countdownText: {
    fontSize: 100,
    fontWeight: 'bold',
    color: 'white',
  },
  gameOver: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  finalScore: {
    fontSize: 24,
    color: 'white',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  fly: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flyImage: {
    width: '100%',
    height: '100%',
  },
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
  newHighScoreAlert: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  newHighScoreText: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  nameInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  nameInputDialog: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  nameInputTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  nameInputSubtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 10,
    width: '100%',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  nameInputIOS: {
    paddingVertical: 12,
  },
  nameInputAndroid: {
    paddingVertical: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  leaderboard: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    marginVertical: 20,
  },
  leaderboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    marginVertical: 2,
    borderRadius: 4,
  },
  rank: {
    color: 'white',
    width: 40,
  },
  playerName: {
    color: 'white',
    width: 80,
    textAlign: 'center',
  },
  scoreValue: {
    color: 'white',
    width: 60,
    textAlign: 'right',
  },
  scoreDate: {
    color: 'white',
    width: 100,
    textAlign: 'right',
    fontSize: 12,
  },
  noScores: {
    color: 'white',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bonusFly: {
    color: '#FFD700',
  },
  negativeFly: {
    color: '#FF4444',
  },
});