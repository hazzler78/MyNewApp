import { Text, View, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform, Image, TextInput, ScrollView, Button } from "react-native";
import { useState, useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NZGame } from './components/NZGame';
import { WhackAFly } from './components/WhackAFly';

type FlyVariant = 'normal' | 'bonus' | 'negative';
type GameMode = 'flies' | 'nz-challenge' | 'whack-a-fly';

// Add the GameStatus type here
type GameStatus = 'idle' | 'countdown' | 'playing' | 'input' | 'ended' | 'nz-game' | 'whack-a-fly' | 'level-select';

type Level = {
  name: string;
  timeLimit: number;
  numberOfFlies: number;
  pointsPerFly: number;
  spawnDelay: number;
  colors: string[];
};

type HighScore = {
  score: number;
  date: string;
  playerName: string;
  gameMode: 'flies' | 'nz-challenge';
  survivalTime?: number; // in seconds
};

type HighScores = {
  flies: {
    [key: number]: Array<HighScore>;
  };
  'whack-a-fly': Array<HighScore>;
  'nz-challenge': Array<HighScore>;
};

const LEVELS: Level[] = [
  {
    name: "Beginner",
    timeLimit: 0,
    numberOfFlies: 1,
    pointsPerFly: 1,
    spawnDelay: 2000,
    colors: ['#a8e6cf', '#dcedc1']
  },
  {
    name: "Advanced",
    timeLimit: 0,
    numberOfFlies: 1,
    pointsPerFly: 1,
    spawnDelay: 1000,
    colors: ['#ffd3b6', '#ffaaa5']
  },
  {
    name: "Expert",
    timeLimit: 0,
    numberOfFlies: 1,
    pointsPerFly: 1,
    spawnDelay: 800,
    colors: ['#ff8b94', '#ff6b6b']
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

// Update the image imports at the top of your file
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

// First, define the Fly type (if not already defined)
type Fly = {
  id: string;
  position: { top: number; left: number };
  variant: FlyVariant;
  timeout?: NodeJS.Timeout;
};

// Then define the component props
interface FlyProps {
  id: string;
  position: { top: number; left: number };
  variant: FlyVariant;
  onCatch: (id: string, position: { top: number; left: number }, variant: FlyVariant) => void;
}

// Update the Fly component
const FlyComponent: React.FC<FlyProps> = ({ id, position, variant, onCatch }) => {
  // Create two animated values for x and y movement
  const wiggleX = useRef(new Animated.Value(0)).current;
  const wiggleY = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create random wiggle animations
    const createWiggleAnimation = () => {
      const randomX = (Math.random() - 0.5) * 20; // Increase/decrease 20 for more/less movement
      const randomY = (Math.random() - 0.5) * 20;
      const randomRotation = (Math.random() - 0.5) * 0.2; // Subtle rotation

      return Animated.parallel([
        Animated.sequence([
          Animated.timing(wiggleX, {
            toValue: randomX,
            duration: 1000 + Math.random() * 1000, // Random duration
            useNativeDriver: true,
          }),
          Animated.timing(wiggleX, {
            toValue: -randomX,
            duration: 1000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(wiggleY, {
            toValue: randomY,
            duration: 800 + Math.random() * 500,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleY, {
            toValue: -randomY,
            duration: 800 + Math.random() * 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(rotation, {
            toValue: randomRotation,
            duration: 1200 + Math.random() * 500,
            useNativeDriver: true,
          }),
          Animated.timing(rotation, {
            toValue: -randomRotation,
            duration: 1200 + Math.random() * 500,
            useNativeDriver: true,
          }),
        ]),
      ]);
    };

    // Create infinite animation loop
    const startAnimation = () => {
      const wiggleAnimation = createWiggleAnimation();
      wiggleAnimation.start(() => {
        startAnimation(); // Restart animation when complete
      });
    };

    startAnimation();

    // Cleanup animation when fly is removed
    return () => {
      wiggleX.stopAnimation();
      wiggleY.stopAnimation();
      rotation.stopAnimation();
    };
  }, []);

  // Convert rotation to interpolated string
  const spin = rotation.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-30deg', '30deg'],
  });

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
      <Animated.View
        style={{
          transform: [
            { translateX: wiggleX },
            { translateY: wiggleY },
            { rotate: spin },
          ],
        }}
      >
        <Image 
          source={FLY_IMAGES[variant]}
          style={styles.flyImage}
          resizeMode="contain"
        />
      </Animated.View>
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
  const distribution = flies.reduce<Record<FlyVariant, number>>((acc, fly) => {
    acc[fly.variant] = (acc[fly.variant] || 0) + 1;
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

// Constants for game rules
const MAX_FLIES = 20;

// Add this helper function to format time
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function App() {
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(LEVELS[0].timeLimit);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highScores, setHighScores] = useState<HighScores>({
    flies: {
      0: [],
      1: [],
      2: []
    },
    'whack-a-fly': [],
    'nz-challenge': []
  });
  const [splats, setSplats] = useState<Array<{ id: string; position: { top: number; left: number }; variant: FlyVariant }>>([]);
  const [countdown, setCountdown] = useState(3);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [flies, setFlies] = useState<Fly[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [score, setScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [playerName, setPlayerName] = useState<string>('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('flies');
  const [showHighScores, setShowHighScores] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState(1);
  const [lastSpawnTime, setLastSpawnTime] = useState(Date.now());
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Move debug function here, after all state declarations
  const debugHighScores = (message: string) => {
    console.log(`[DEBUG] ${message}`, {
      currentLevel,
      score,
      currentScores: gameMode === 'flies' 
        ? highScores.flies[currentLevel] 
        : highScores['nz-challenge'],
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
    console.log('Starting game with level:', levelIndex);
    const levelConfig = LEVELS[levelIndex];
    
    // Initial setup
    setCurrentLevel(levelIndex);
    setFlies([]);
    setSplats([]);
    setScore(0);
    setTimeLeft(levelConfig.timeLimit);
    setGameStatus('countdown');
    setCountdown(3);
    
    console.log('Game initialized:', {
      level: levelIndex,
      timeLimit: levelConfig.timeLimit,
      status: 'countdown'
    });
  };

  // Add this new effect for handling countdown
  useEffect(() => {
    if (gameStatus === 'countdown') {
      console.log('Starting countdown sequence');
      let count = 3;
      
      const countdownTimer = setInterval(() => {
        count--;
        console.log('Countdown:', count);
        
        if (count === 0) {
          console.log('Countdown complete');
          clearInterval(countdownTimer);
          
          // Transition to gameplay
          setGameStatus('playing');
          setIsPlaying(true);
          setTimeLeft(LEVELS[currentLevel].timeLimit);
          setGameStartTime(Date.now());
          
          console.log('Game started with:', {
            status: 'playing',
            isPlaying: true,
            timeLeft: LEVELS[currentLevel].timeLimit
          });
        } else {
          setCountdown(count);
        }
      }, 1000);

      return () => clearInterval(countdownTimer);
    }
  }, [gameStatus, currentLevel]);

  // Update the game timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    console.log('Timer Effect State:', {
      isPlaying,
      gameStatus,
      timeLeft,
      shouldStart: isPlaying && gameStatus === 'playing' && timeLeft > 0
    });

    if (isPlaying && gameStatus === 'playing' && timeLeft > 0) {
      console.log('Starting gameplay timer');
      
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          console.log('Time remaining:', newTime);
          
          if (newTime <= 0) {
            console.log('Game over - time up');
            clearInterval(timer);
            setIsPlaying(false);
            setGameStatus('ended');
            return 0;
          }
          return newTime;
        });
      }, 1000);

      return () => {
        if (timer) {
          clearInterval(timer);
          console.log('Clearing gameplay timer');
        }
      };
    }
  }, [isPlaying, gameStatus, timeLeft]);

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
        if (savedScores) {
          const parsedScores = JSON.parse(savedScores) as HighScores;
          setHighScores(parsedScores);
        } else {
          const initialScores: HighScores = {
            flies: {
              0: [],
              1: [],
              2: []
            },
            'whack-a-fly': [],
            'nz-challenge': []
          };
          await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(initialScores));
          setHighScores(initialScores);
        }
      } catch (error) {
        console.error('Error loading high scores:', error);
        setHighScores({
          flies: {
            0: [],
            1: [],
            2: []
          },
          'whack-a-fly': [],
          'nz-challenge': []
        });
      }
    };

    loadHighScores();
  }, []);

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

  const catchFly = (id: string, position: { top: number; left: number }, variant: FlyVariant) => {
    // Update score
    setScore(prev => prev + FLY_POINTS[variant]);
    
    // Remove the caught fly
    setFlies(prev => prev.filter(fly => fly.id !== id));
    
    // Add splat effect
    const splatId = `splat-${Date.now()}`;
    setSplats(prev => [...prev, { id: splatId, position, variant }]);
    
    // Remove splat after animation
    setTimeout(() => {
      setSplats(prev => prev.filter(splat => splat.id !== splatId));
    }, 1000);
  };

  // Update the useEffect that manages flies
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const spawnInterval = setInterval(() => {
      setFlies(prev => {
        // Check if game should end
        if (prev.length >= MAX_FLIES) {
          setGameStatus('ended');
          return prev;
        }

        const now = Date.now();
        const gameTimeElapsed = (now - gameStartTime) / 1000; // Time elapsed in seconds
        
        // Calculate difficulty multiplier based on time
        // Every minute reduces spawn delay by 20% (max 80% reduction)
        const difficultyMultiplier = Math.max(0.2, 1 - (gameTimeElapsed / 60) * 0.2);
        
        // Apply difficulty to base spawn delay
        const currentDelay = LEVELS[currentLevel].spawnDelay * difficultyMultiplier;
        
        if (now - lastSpawnTime >= currentDelay) {
          setLastSpawnTime(now);
          return [...prev, {
            id: Math.random().toString(),
            position: generateNewFlyPosition(),
            variant: generateBalancedFlyVariant(prev)
          }];
        }
        return prev;
      });
    }, 100);

    return () => clearInterval(spawnInterval);
  }, [gameStatus, currentLevel, lastSpawnTime, gameStartTime]);

  // Add reset function near other game functions
  const handleResetPress = () => {

    try {
      const initialScores = {
        flies: {
          0: [],
          1: [],
          2: []
        },
        'whack-a-fly': [],
        'nz-challenge': []
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

  // Update the NameInputOverlay component to use correct style names
  const NameInputOverlay = () => (
    <View style={styles.nameInputOverlay}>
      <View style={styles.nameInputDialog}>
        <Text style={styles.nameInputTitle}>New High Score! 🎉</Text>
        <Text style={styles.nameInputSubtitle}>Enter your initials:</Text>
        <TextInput
          style={[
            styles.nameInput,
            Platform.OS === 'ios' ? styles.nameInputBorder : styles.nameInputOutline
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

  // Update the submitScore function to handle both game modes correctly
  const submitScore = async () => {
    if (!playerName) return;
    
    const survivalTime = Math.floor((Date.now() - gameStartTime) / 1000);
    
    const newScore: HighScore = {
      score,
      date: new Date().toLocaleDateString(),
      playerName: playerName.toUpperCase(),
      gameMode: gameMode === 'whack-a-fly' ? 'flies' : gameMode,
      survivalTime
    };

    try {
      const updatedHighScores: HighScores = {
        ...highScores,
        flies: { ...highScores.flies },
        'nz-challenge': [...(highScores['nz-challenge'] || [])]
      };
      
      if (gameMode === 'flies') {
        const levelScores = [...(updatedHighScores.flies[currentLevel] || [])];
        levelScores.push(newScore);
        levelScores.sort((a, b) => b.score - a.score);
        updatedHighScores.flies[currentLevel] = levelScores.slice(0, 10);
      } else {
        // Handle NZ Challenge scores
        const nzScores = [...updatedHighScores['nz-challenge']];
        nzScores.push(newScore);
        nzScores.sort((a, b) => b.score - a.score);
        updatedHighScores['nz-challenge'] = nzScores.slice(0, 10);
      }

      console.log('Saving scores:', updatedHighScores); // Debug log
      await AsyncStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(updatedHighScores));
      setHighScores(updatedHighScores);
      setShowNameInput(false);
      setGameStatus('idle');
      setPlayerName('');
    } catch (error) {
      console.error('Error saving high score:', error);
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
    // Safely access flies scores for the given level
    const scores = highScores.flies[level] || [];
    
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

  // Add this near the top of the component
  const renderGameModeSelection = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.menuHeader}>Select Game Mode</Text>
      
      <View style={styles.gameModeList}>
        {/* Classic Mode */}
        <TouchableOpacity 
          style={styles.gameModeButton}
          onPress={() => {
            setGameMode('flies');
            setGameStatus('level-select');  // New status for level selection
          }}
        >
          <View style={styles.gameModeContent}>
            <Image 
              source={require('../assets/fly.png')} 
              style={styles.modeIcon}
            />
            <View style={styles.modeTextContainer}>
              <Text style={styles.modeName}>Classic Mode</Text>
              <Text style={styles.modeDescription}>Catch flies in multiple difficulty levels</Text>
            </View>
            <Text style={styles.arrowIcon}>→</Text>
          </View>
        </TouchableOpacity>

        {/* N vs Z Challenge */}
        <TouchableOpacity 
          style={styles.gameModeButton}
          onPress={() => {
            setGameMode('nz-challenge');
            setGameStatus('nz-game');
          }}
        >
          <View style={styles.gameModeContent}>
            <Text style={styles.letterIcon}>N</Text>
            <View style={styles.modeTextContainer}>
              <Text style={styles.modeName}>N vs Z Challenge</Text>
              <Text style={styles.modeDescription}>Find the hidden Z among the Ns</Text>
            </View>
            <Text style={styles.arrowIcon}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Whack-A-Fly */}
        <TouchableOpacity 
          style={styles.gameModeButton}
          onPress={() => {
            setGameMode('whack-a-fly');
            setGameStatus('whack-a-fly');
          }}
        >
          <View style={styles.gameModeContent}>
            <Image 
              source={require('../assets/splat.png')} 
              style={styles.modeIcon}
            />
            <View style={styles.modeTextContainer}>
              <Text style={styles.modeName}>Whack-A-Fly</Text>
              <Text style={styles.modeDescription}>Fast-paced fly swatting action</Text>
            </View>
            <Text style={styles.arrowIcon}>→</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.highScoresButton}
        onPress={() => setShowHighScores(true)}
      >
        <Text style={styles.highScoresText}>🏆 High Scores</Text>
      </TouchableOpacity>

      {/* Add this modal */}
      {showHighScores && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>High Scores</Text>
            <ScrollView style={styles.scoresScrollView}>
              {LEVELS.map((level, index) => (
                <View key={index} style={styles.levelScores}>
                  <Text style={styles.levelTitle}>{level.name}</Text>
                  {(highScores.flies[index] || []).map((score, scoreIndex) => (
                    <View key={scoreIndex} style={styles.highScoreRow}>
                      <Text style={styles.rank}>#{scoreIndex + 1}</Text>
                      <Text style={styles.playerName}>{score.playerName}</Text>
                      <Text style={styles.scoreValue}>{score.score}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowHighScores(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  // Update the handleNZGameOver function in Index component
  const handleNZGameOver = (score: number) => {
    try {
      // Safely access nz-challenge scores
      const currentScores = highScores?.['nz-challenge'] || [];
      console.log('Current NZ scores:', currentScores); // Debug log
      
      const shouldAdd = currentScores.length < 10 || 
        currentScores.some(existingScore => score > existingScore.score);
      
      console.log('Should add score:', shouldAdd, 'Score:', score); // Debug log
      
      if (shouldAdd) {
        setGameMode('nz-challenge'); // Make sure we're in the right mode
        setGameStatus('input');
        setShowNameInput(true);
        setScore(score);
      } else {
        setGameStatus('idle');
      }
    } catch (error) {
      console.error('Error in handleNZGameOver:', error);
      setGameStatus('idle'); // Fallback to safe state
    }
  };

  // Define renderHighScores inside the component
  const renderHighScores = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>High Scores</Text>
        
        {/* Classic Mode Scores */}
        <Text style={styles.gameModeTitle}>Classic Mode</Text>
        <ScrollView style={styles.scoresScrollView}>
          {LEVELS.map((level, index) => (
            <View key={`classic-${index}`} style={styles.levelScores}>
              <Text style={styles.levelTitle}>{level.name}</Text>
              {(highScores.flies[index] || [])
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((score, scoreIndex) => (
                  <View key={scoreIndex} style={styles.highScoreRow}>
                    <Text style={styles.rank}>#{scoreIndex + 1}</Text>
                    <Text style={styles.playerName}>{score.playerName}</Text>
                    <Text style={styles.scoreValue}>{score.score}</Text>
                  </View>
                ))}
            </View>
          ))}
        </ScrollView>

        {/* Whack-a-Fly Scores */}
        <Text style={styles.gameModeTitle}>Whack-a-Fly</Text>
        <ScrollView style={styles.scoresScrollView}>
          {(highScores['whack-a-fly'] || [])
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((score, index) => (
              <View key={`whack-${index}`} style={styles.highScoreRow}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <Text style={styles.playerName}>{score.playerName}</Text>
                <Text style={styles.scoreValue}>{score.score}</Text>
              </View>
            ))}
        </ScrollView>

        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setShowHighScores(false)}
        >
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // First, let's add a level selection screen
  const renderLevelSelection = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.menuHeader}>Select Difficulty</Text>
      <View style={styles.levelList}>
        {LEVELS.map((level, index) => {
          const bestTime = highScores.flies[index]
            ?.reduce((max, score) => Math.max(max, score.survivalTime || 0), 0);
          
          return (
            <TouchableOpacity 
              key={index}
              style={styles.levelButton}
              onPress={() => {
                setCurrentLevel(index);
                setGameStatus('countdown');
              }}
            >
              <Text style={styles.modeName}>{level.name}</Text>
              <Text style={styles.modeDescription}>
                Initial Flies: {level.numberOfFlies}
                {bestTime > 0 && `\nBest Time: ${Math.floor(bestTime / 60)}:${(bestTime % 60).toString().padStart(2, '0')}`}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  );

  // Update the game mode selection handler
  const handleClassicModeSelect = () => {
    setGameMode('flies');
    setGameStatus('level-select'); // New status for level selection
  };

  // Update renderContent to include level selection
  const renderContent = () => {
    switch (gameStatus) {
      case 'idle':
        return renderGameModeSelection();
      case 'level-select':
        return renderLevelSelection();
      case 'countdown':
        return (
          <LinearGradient
            colors={LEVELS[currentLevel].colors as string[]}
            style={styles.container}
          >
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          </LinearGradient>
        );
      case 'playing':
        return (
          <LinearGradient
            colors={LEVELS[currentLevel].colors as string[]}
            style={styles.container}
          >
            <View style={styles.header}>
              <Text style={styles.flyCountText}>Flies: {flies.length}/{MAX_FLIES}</Text>
              <Text style={styles.timeText}>Time: {formatTime(currentTime)}</Text>
              <Text style={styles.scoreText}>Score: {score}</Text>
            </View>
            {flies.map(fly => (
              <FlyComponent
                key={fly.id}
                id={fly.id}
                position={fly.position}
                variant={fly.variant}
                onCatch={catchFly}
              />
            ))}
            {splats.map(splat => (
              <Splat
                key={splat.id}
                position={splat.position}
                variant={splat.variant}
              />
            ))}
          </LinearGradient>
        );
      case 'nz-game':
        return <NZGame onGameEnd={() => setGameStatus('ended')} />;
      case 'whack-a-fly':
        return <WhackAFly onGameEnd={() => setGameStatus('ended')} />;
      case 'ended':
        return renderGameOver();
      
      default:
        return null;
    }
  };

  const renderGameOver = () => (
    <View style={styles.gameOverContainer}>
      <Text style={styles.gameOverTitle}>Game Over!</Text>
      <Text style={styles.gameOverScore}>Final Score: {score}</Text>
      
      {showNameInput ? (
        <NameInputOverlay />
      ) : (
        <TouchableOpacity 
          style={styles.playAgainButton}
          onPress={() => {
            setGameStatus('idle');
            setScore(0);
            setTimeLeft(LEVELS[currentLevel].timeLimit);
          }}
        >
          <Text style={styles.playAgainButtonText}>Play Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Update the useEffect that handles game over
  useEffect(() => {
    if (gameStatus === 'ended' && !showNameInput) {
      const currentScores = gameMode === 'flies' 
        ? (highScores.flies[currentLevel] || [])
        : highScores['nz-challenge'];

      // Always show input if less than 10 scores or if current score is higher than lowest score
      const isHighScore = currentScores.length < 10 || 
        score > Math.min(...currentScores.map(s => s.score), 0);

      console.log('High score check:', { 
        score, 
        currentScores: currentScores.map(s => s.score),
        isHighScore 
      });

      if (isHighScore) {
        setShowNameInput(true);
        setIsNewHighScore(true);
      }
    }
  }, [gameStatus, score, currentLevel, gameMode, highScores]);

  // Add this useEffect to update the timer
  useEffect(() => {
    if (gameStatus === 'playing') {
      const timerInterval = setInterval(() => {
        setCurrentTime(Math.floor((Date.now() - gameStartTime) / 1000));
      }, 1000);

      return () => clearInterval(timerInterval);
    }
  }, [gameStatus, gameStartTime]);

  return (
    <View style={styles.container}>
      {renderContent() || null}
      {/* Your modals and overlays */}
    </View>
  );
}

const styles = StyleSheet.create({
  // Base container styles
  container: {
    flex: 1,
    overflow: 'hidden',  // Prevent scrolling
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  
  // Game status text styles
  timeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  flyCountText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },

  // Fly and splat styles
  fly: {
    position: 'absolute',
    zIndex: 1000,
  },
  flyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  splat: {
    position: 'absolute',
    zIndex: 900,
  },
  splatImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },

  // Menu and game mode styles
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  gameModeList: {
    width: '100%',
    maxWidth: 500,
  },
  gameModeButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gameModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIcon: {
    width: 40,
    height: 40,
    marginRight: 15,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modeDescription: {
    fontSize: 14,
    color: '#666',
  },
  arrowIcon: {
    fontSize: 24,
    color: '#666',
  },
  letterIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    width: 40,
    height: 40,
    textAlign: 'center',
    lineHeight: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 15,
    color: '#333',
  },

  // High scores styles
  highScoresButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  highScoresText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  gameModeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    color: '#333',
  },
  scoresScrollView: {
    maxHeight: 200,
  },
  levelScores: {
    marginBottom: 15,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: '#666',
  },
  highScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rank: {
    width: 40,
    fontSize: 16,
    color: '#888',
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    marginHorizontal: 10,
  },
  scoreValue: {
    width: 60,
    fontSize: 16,
    textAlign: 'right',
    fontWeight: 'bold',
  },

  // Game over styles
  gameOverContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  gameOverTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  gameOverScore: {
    fontSize: 24,
    color: 'white',
    marginBottom: 30,
  },
  gameOverText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },

  // Button styles
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  playAgainButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  playAgainButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Name input styles
  nameInput: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    width: '80%',
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 18,
  },
  nameInputBorder: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  nameInputOutline: {
    borderWidth: 1,
    borderColor: '#ccc',
  },
  nameInputContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  nameInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameInputDialog: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  nameInputTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  nameInputSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },

  // Countdown styles
  countdownContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  countdownText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: 'white',
  },

  // Level selection styles
  levelList: {
    width: '100%',
    maxWidth: 500,
  },
  levelButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  // Leaderboard styles
  leaderboard: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    margin: 10,
    maxWidth: 500,
    width: '100%',
  },
  leaderboardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  noScores: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  scoreDate: {
    fontSize: 14,
    color: '#888',
    marginLeft: 10,
  },
});
